const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ipcMain, dialog, shell, nativeImage } = require('electron');
const { getAssetCategory } = require('./constants');
const { scanDirectory } = require('./scanner');
const { setupWatcher, stopWatcher } = require('./watchers');

const THUMB_CACHE_DIR = null;

function getThumbCacheDir(app) {
  if (!THUMB_CACHE_DIR) {
    const dir = path.join(app.getPath('userData'), 'thumbnails');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
  return THUMB_CACHE_DIR;
}

function getThumbCachePath(filePath, cacheDir) {
  const hash = crypto.createHash('md5').update(filePath.toLowerCase()).digest('hex');
  return path.join(cacheDir, `${hash}.jpg`);
}

function getCachedThumbnail(filePath, cacheDir) {
  const thumbPath = getThumbCachePath(filePath, cacheDir);
  if (fs.existsSync(thumbPath)) {
    try {
      const data = fs.readFileSync(thumbPath);
      return `data:image/jpeg;base64,${data.toString('base64')}`;
    } catch (e) {}
  }
  return null;
}

function toFileUrl(filePath) {
  return 'file:///' + filePath.replace(/\\/g, '/');
}

function generateThumbnail(filePath, cacheDir) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 10 * 1024 * 1024) return null;

    const ext = path.extname(filePath).toLowerCase();
    const img = nativeImage.createFromPath(filePath);
    if (img.isEmpty()) return null;

    const size = img.getSize();

    if (ext === '.ico') {
      const data = fs.readFileSync(filePath);
      if (data.length >= 6) {
        const count = data.readUInt16LE(4);
        let best = null;
        for (let i = 0; i < count; i++) {
          const off = 6 + i * 16;
          if (off + 16 > data.length) break;
          const w = data[off] || 256;
          const h = data[off + 1] || 256;
          if (!best || w < best.w) best = { w, h };
        }
        if (best) {
          const target = best.w < size.width ? img.resize({ width: best.w }) : img;
          const pngBuf = target.toPNG();
          const thumbPath = getThumbCachePath(filePath, cacheDir);
          fs.writeFileSync(thumbPath, pngBuf);
          return `data:image/png;base64,${pngBuf.toString('base64')}`;
        }
      }
    }

    if (size.width <= 200 && size.height <= 200) return toFileUrl(filePath);

    const pngBuf = img.resize({ width: 200, quality: 'good' }).toPNG();
    const thumbPath = getThumbCachePath(filePath, cacheDir);
    fs.writeFileSync(thumbPath, pngBuf);
    return `data:image/png;base64,${pngBuf.toString('base64')}`;
  } catch (e) {
    console.warn('Thumbnail generation failed for', filePath, e.message);
    return null;
  }
}

const countCache = { data: null, dirty: true };

function invalidateCountCache() {
  countCache.dirty = true;
}

function getCachedCategoryCounts(db) {
  if (!countCache.dirty && countCache.data) return countCache.data;
  const counts = {};
  const rows = db.prepare('SELECT category, COUNT(*) as count FROM assets GROUP BY category').all();
  rows.forEach(r => counts[r.category] = r.count);
  countCache.data = counts;
  countCache.dirty = false;
  return counts;
}

function getCachedTotalAssets(db) {
  if (!countCache.dirty && countCache.data) return db.prepare('SELECT COUNT(*) as count FROM assets').get().count;
  return db.prepare('SELECT COUNT(*) as count FROM assets').get().count;
}

function registerIpcHandlers(db, getMainWindow, app) {
  const cacheDir = getThumbCacheDir(app);

  ipcMain.handle('browse-folder', async () => {
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Asset Library Folder'
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('add-library', async (event, dirPath, ignoreRegex) => {
    if (!dirPath) return null;
    const folderName = path.basename(dirPath);
    const existing = db.prepare('SELECT id FROM libraries WHERE path = ?').get(dirPath);
    if (existing) return { error: 'Library already exists' };

    const insertLib = db.prepare('INSERT INTO libraries (path, name, ignore_regex) VALUES (?, ?, ?)');
    const info = insertLib.run(dirPath, folderName, ignoreRegex || '');
    const libraryId = info.lastInsertRowid;

    const count = await scanDirectory(db, dirPath, libraryId, ignoreRegex);
    const mainWindow = getMainWindow();
    setupWatcher(db, mainWindow, dirPath, libraryId, ignoreRegex);
    invalidateCountCache();

    return { libraryId, path: dirPath, name: folderName, assetCount: count, ignore_regex: ignoreRegex || '' };
  });

  ipcMain.handle('get-libraries', () => {
    return db.prepare('SELECT l.*, (SELECT COUNT(*) FROM assets WHERE library_id = l.id) as asset_count FROM libraries l').all();
  });

  ipcMain.handle('remove-library', (event, libraryId) => {
    stopWatcher(libraryId);
    db.prepare('DELETE FROM asset_collections WHERE asset_id IN (SELECT id FROM assets WHERE library_id = ?)').run(libraryId);
    db.prepare('DELETE FROM asset_tags WHERE asset_id IN (SELECT id FROM assets WHERE library_id = ?)').run(libraryId);
    db.prepare('DELETE FROM assets WHERE library_id = ?').run(libraryId);
    db.prepare('DELETE FROM libraries WHERE id = ?').run(libraryId);
    invalidateCountCache();
    return true;
  });

  ipcMain.handle('rescan-library', async (event, libraryId) => {
    const lib = db.prepare('SELECT * FROM libraries WHERE id = ?').get(libraryId);
    if (!lib) return { error: 'Library not found' };

    db.prepare('DELETE FROM asset_collections WHERE asset_id IN (SELECT id FROM assets WHERE library_id = ?)').run(libraryId);
    db.prepare('DELETE FROM asset_tags WHERE asset_id IN (SELECT id FROM assets WHERE library_id = ?)').run(libraryId);
    db.prepare('DELETE FROM assets WHERE library_id = ?').run(libraryId);

    const count = await scanDirectory(db, lib.path, libraryId, lib.ignore_regex);
    const mainWindow = getMainWindow();
    setupWatcher(db, mainWindow, lib.path, libraryId, lib.ignore_regex);
    invalidateCountCache();

    return { libraryId, assetCount: count };
  });

  ipcMain.handle('rescan-all', async () => {
    const libraries = db.prepare('SELECT * FROM libraries').all();
    const mainWindow = getMainWindow();
    let total = 0;
    for (const lib of libraries) {
      db.prepare('DELETE FROM asset_collections WHERE asset_id IN (SELECT id FROM assets WHERE library_id = ?)').run(lib.id);
      db.prepare('DELETE FROM asset_tags WHERE asset_id IN (SELECT id FROM assets WHERE library_id = ?)').run(lib.id);
      db.prepare('DELETE FROM assets WHERE library_id = ?').run(lib.id);
      total += await scanDirectory(db, lib.path, lib.id, lib.ignore_regex);
      setupWatcher(db, mainWindow, lib.path, lib.id, lib.ignore_regex);
    }
    invalidateCountCache();
    return total;
  });

  ipcMain.handle('get-assets', (event, params) => {
    let query = 'SELECT a.*, GROUP_CONCAT(t.name) as tags, GROUP_CONCAT(t.color) as tag_colors FROM assets a LEFT JOIN asset_tags at ON a.id = at.asset_id LEFT JOIN tags t ON at.tag_id = t.id';
    const conditions = [];
    const values = [];

    if (params.libraryIds && params.libraryIds.length > 0) {
      conditions.push(`a.library_id IN (${params.libraryIds.map(() => '?').join(',')})`);
      values.push(...params.libraryIds);
    }
    if (params.category && params.category !== 'all') {
      conditions.push('a.category = ?');
      values.push(params.category);
    }
    if (params.search) {
      conditions.push('a.file_name LIKE ?');
      values.push(`%${params.search}%`);
    }
    if (params.favorites) {
      conditions.push('a.is_favorite = 1');
    }
    if (params.collectionId) {
      conditions.push('a.id IN (SELECT asset_id FROM asset_collections WHERE collection_id = ?)');
      values.push(params.collectionId);
    }
    if (params.tagId) {
      conditions.push('a.id IN (SELECT asset_id FROM asset_tags WHERE tag_id = ?)');
      values.push(params.tagId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY a.id';

    if (params.sort) {
      switch (params.sort) {
        case 'name': query += ' ORDER BY a.file_name ASC'; break;
        case 'size': query += ' ORDER BY a.file_size DESC'; break;
        case 'modified': query += ' ORDER BY a.modified_date DESC'; break;
        case 'type': query += ' ORDER BY a.file_ext ASC'; break;
        default: query += ' ORDER BY a.file_name ASC';
      }
    } else {
      query += ' ORDER BY a.file_name ASC';
    }

    if (params.limit) {
      const limit = Math.min(Math.max(parseInt(params.limit) || 50, 1), 1000);
      query += ' LIMIT ?';
      values.push(limit);
    }
    if (params.offset) {
      const offset = Math.max(parseInt(params.offset) || 0, 0);
      query += ' OFFSET ?';
      values.push(offset);
    }

    return db.prepare(query).all(...values);
  });

  ipcMain.handle('get-asset-count', (event, params) => {
    let query = 'SELECT COUNT(*) as count FROM assets a';
    const conditions = [];
    const values = [];

    if (params.libraryIds && params.libraryIds.length > 0) {
      conditions.push(`a.library_id IN (${params.libraryIds.map(() => '?').join(',')})`);
      values.push(...params.libraryIds);
    }
    if (params.category && params.category !== 'all') {
      conditions.push('a.category = ?');
      values.push(params.category);
    }
    if (params.search) {
      conditions.push('a.file_name LIKE ?');
      values.push(`%${params.search}%`);
    }
    if (params.favorites) {
      conditions.push('a.is_favorite = 1');
    }
    if (params.collectionId) {
      conditions.push('a.id IN (SELECT asset_id FROM asset_collections WHERE collection_id = ?)');
      values.push(params.collectionId);
    }
    if (params.tagId) {
      conditions.push('a.id IN (SELECT asset_id FROM asset_tags WHERE tag_id = ?)');
      values.push(params.tagId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    return db.prepare(query).get(...values).count;
  });

  ipcMain.handle('get-asset', (event, assetId) => {
    return db.prepare(`
      SELECT a.*,
        GROUP_CONCAT(DISTINCT t.name) as tags,
        GROUP_CONCAT(DISTINCT t.color) as tag_colors,
        GROUP_CONCAT(DISTINCT c.name) as collections
      FROM assets a
      LEFT JOIN asset_tags at ON a.id = at.asset_id
      LEFT JOIN tags t ON at.tag_id = t.id
      LEFT JOIN asset_collections ac ON a.id = ac.asset_id
      LEFT JOIN collections c ON ac.collection_id = c.id
      WHERE a.id = ?
      GROUP BY a.id
    `).get(assetId);
  });

  ipcMain.handle('toggle-favorite', (event, assetId) => {
    const asset = db.prepare('SELECT is_favorite FROM assets WHERE id = ?').get(assetId);
    const newVal = asset.is_favorite ? 0 : 1;
    db.prepare('UPDATE assets SET is_favorite = ? WHERE id = ?').run(newVal, assetId);
    invalidateCountCache();
    return newVal;
  });

  ipcMain.handle('get-tags', () => {
    return db.prepare('SELECT t.*, (SELECT COUNT(*) FROM asset_tags WHERE tag_id = t.id) as asset_count FROM tags t ORDER BY t.name').all();
  });

  ipcMain.handle('add-tag', (event, name, color) => {
    try {
      const info = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, color || '#7c3aed');
      return { id: info.lastInsertRowid, name, color: color || '#7c3aed' };
    } catch (e) {
      return { error: 'Tag already exists' };
    }
  });

  ipcMain.handle('delete-tag', (event, tagId) => {
    db.prepare('DELETE FROM asset_tags WHERE tag_id = ?').run(tagId);
    db.prepare('DELETE FROM tags WHERE id = ?').run(tagId);
    return true;
  });

  ipcMain.handle('add-tag-to-asset', (event, assetId, tagId) => {
    try {
      db.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag_id) VALUES (?, ?)').run(assetId, tagId);
      return true;
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('remove-tag-from-asset', (event, assetId, tagId) => {
    db.prepare('DELETE FROM asset_tags WHERE asset_id = ? AND tag_id = ?').run(assetId, tagId);
    return true;
  });

  ipcMain.handle('get-collections', () => {
    return db.prepare('SELECT c.*, (SELECT COUNT(*) FROM asset_collections WHERE collection_id = c.id) as asset_count FROM collections c ORDER BY c.name').all();
  });

  ipcMain.handle('add-collection', (event, name, description) => {
    try {
      const info = db.prepare('INSERT INTO collections (name, description) VALUES (?, ?)').run(name, description || '');
      return { id: info.lastInsertRowid, name, description: description || '' };
    } catch (e) {
      return { error: 'Collection already exists' };
    }
  });

  ipcMain.handle('delete-collection', (event, collectionId) => {
    db.prepare('DELETE FROM asset_collections WHERE collection_id = ?').run(collectionId);
    db.prepare('DELETE FROM collections WHERE id = ?').run(collectionId);
    return true;
  });

  ipcMain.handle('add-asset-to-collection', (event, assetId, collectionId) => {
    try {
      db.prepare('INSERT OR IGNORE INTO asset_collections (asset_id, collection_id) VALUES (?, ?)').run(assetId, collectionId);
      return true;
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('remove-asset-from-collection', (event, assetId, collectionId) => {
    db.prepare('DELETE FROM asset_collections WHERE asset_id = ? AND collection_id = ?').run(assetId, collectionId);
    return true;
  });

  ipcMain.handle('get-category-counts', () => {
    return getCachedCategoryCounts(db);
  });

  ipcMain.handle('get-total-assets', () => {
    return getCachedTotalAssets(db);
  });

  ipcMain.handle('open-external', (event, filePath) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle('get-file-content', async (event, filePath) => {
    try {
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.tiff', '.tif'];
      const audioExts = ['.wav', '.mp3', '.ogg', '.flac', '.aiff', '.aif', '.m4a', '.wma'];
      const videoExts = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.wmv'];

      if (videoExts.includes(ext)) {
        const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
        if (stat.size > 500 * 1024 * 1024) return { error: 'File too large' };
        return { type: 'video', data: fileUrl };
      }

      if (stat.size > 5 * 1024 * 1024) return { error: 'File too large' };

      if (imageExts.includes(ext)) {
        const data = fs.readFileSync(filePath);
        const mimeMap = {
          '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
          '.ico': 'image/x-icon', '.tiff': 'image/tiff', '.tif': 'image/tiff'
        };
        let width, height;
        if (ext === '.ico' && data.length >= 6) {
          const count = data.readUInt16LE(4);
          let best = null;
          for (let i = 0; i < count; i++) {
            const off = 6 + i * 16;
            if (off + 16 > data.length) break;
            const w = data[off] || 256;
            const h = data[off + 1] || 256;
            if (!best || w < best.w) best = { w, h };
          }
          if (best) { width = best.w; height = best.h; }
        } else {
          const img = nativeImage.createFromPath(filePath);
          if (!img.isEmpty()) { const s = img.getSize(); width = s.width; height = s.height; }
        }
        return { type: 'image', data: `data:${mimeMap[ext] || 'image/png'};base64,${data.toString('base64')}`, width, height };
      }
      if (audioExts.includes(ext)) {
        const data = fs.readFileSync(filePath);
        const mimeMap = {
          '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
          '.flac': 'audio/flac', '.aiff': 'audio/aiff', '.aif': 'audio/aiff',
          '.m4a': 'audio/mp4', '.wma': 'audio/x-ms-wma'
        };
        return { type: 'audio', data: `data:${mimeMap[ext] || 'audio/wav'};base64,${data.toString('base64')}` };
      }
      if (ext === '.txt' || ext === '.md' || ext === '.json' || ext === '.xml' || ext === '.csv' || ext === '.log') {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { type: 'text', data: content.substring(0, 50000) };
      }
      if (['.js', '.ts', '.py', '.lua', '.cs', '.cpp', '.h', '.java', '.rs', '.go', '.rb', '.php', '.sh', '.bat', '.ps1'].includes(ext)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { type: 'code', data: content.substring(0, 50000), language: ext.slice(1) };
      }
      return { type: 'binary' };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('get-thumbnail', (event, filePath) => {
    try {
      const cached = getCachedThumbnail(filePath, cacheDir);
      if (cached) return { type: 'image', data: cached };
      const generated = generateThumbnail(filePath, cacheDir);
      if (generated) return { type: 'image', data: generated };
      return { type: 'none' };
    } catch (e) {
      return { type: 'none' };
    }
  });

  ipcMain.handle('get-thumbnails-batch', async (event, filePaths) => {
    const results = {};
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.tiff', '.tif'];
    const batch = filePaths.slice(0, 50);
    for (let i = 0; i < batch.length; i++) {
      const filePath = batch[i];
      if (i > 0 && i % 10 === 0) await new Promise(r => setImmediate(r));
      try {
        const ext = path.extname(filePath).toLowerCase();
        if (!imageExts.includes(ext)) continue;
        const cached = getCachedThumbnail(filePath, cacheDir);
        if (cached) { results[filePath] = cached; continue; }
        const generated = generateThumbnail(filePath, cacheDir);
        if (generated) results[filePath] = generated;
      } catch (e) {}
    }
    return results;
  });

  ipcMain.handle('window-minimize', () => getMainWindow()?.minimize());
  ipcMain.handle('window-maximize', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    }
  });
  ipcMain.handle('window-close', () => getMainWindow()?.close());
}

function clearThumbnailCache(app) {
  const dir = path.join(app.getPath('userData'), 'thumbnails');
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    fs.unlinkSync(path.join(dir, file));
  }
}

module.exports = { registerIpcHandlers, clearThumbnailCache };
