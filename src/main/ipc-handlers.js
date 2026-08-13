const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ipcMain, dialog, shell, nativeImage, app } = require('electron');
const Database = require('better-sqlite3');
const { getAssetCategory } = require('./constants');
const { scanDirectory, pruneStaleAssets } = require('./scanner');
const { setupWatcher, stopWatcher, ignorePath, stopAllWatchers } = require('./watchers');
const { detectLicense } = require('./license');

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

    const count = await scanDirectory(db, dirPath, libraryId, ignoreRegex).then(r => r.count);
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

    const { count, files } = await scanDirectory(db, lib.path, libraryId, lib.ignore_regex);
    pruneStaleAssets(db, libraryId, files);
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
      const { count, files } = await scanDirectory(db, lib.path, lib.id, lib.ignore_regex);
      pruneStaleAssets(db, lib.id, files);
      total += count;
      setupWatcher(db, mainWindow, lib.path, lib.id, lib.ignore_regex);
    }
    invalidateCountCache();
    return total;
  });

  ipcMain.handle('get-assets', (event, params) => {
    let query = `SELECT a.*,
      GROUP_CONCAT(DISTINCT t.name) as tags,
      GROUP_CONCAT(DISTINCT t.color) as tag_colors,
      GROUP_CONCAT(DISTINCT c.name) as collections
    FROM assets a
    LEFT JOIN asset_tags at ON a.id = at.asset_id
    LEFT JOIN tags t ON at.tag_id = t.id
    LEFT JOIN asset_collections ac ON a.id = ac.asset_id
    LEFT JOIN collections c ON ac.collection_id = c.id`;
    const conditions = [];
    const filterConds = [];
    const values = [];

    if (params.libraryIds && params.libraryIds.length > 0) {
      filterConds.push(`a.library_id IN (${params.libraryIds.map(() => '?').join(',')})`);
      values.push(...params.libraryIds);
    }
    if (params.categories && params.categories.length > 0) {
      filterConds.push(`a.category IN (${params.categories.map(() => '?').join(',')})`);
      values.push(...params.categories);
    }
    if (params.search) {
      conditions.push('a.file_name LIKE ?');
      values.push(`%${params.search}%`);
    }
    if (params.favorites) {
      conditions.push('a.is_favorite = 1');
    }
    if (params.collectionIds && params.collectionIds.length > 0) {
      filterConds.push(`a.id IN (
        SELECT DISTINCT asset_id FROM asset_collections WHERE collection_id IN (${params.collectionIds.map(() => '?').join(',')})
      )`);
      values.push(...params.collectionIds);
    }
    if (params.tagIds && params.tagIds.length > 0) {
      filterConds.push(`a.id IN (
        SELECT DISTINCT asset_id FROM asset_tags WHERE tag_id IN (${params.tagIds.map(() => '?').join(',')})
      )`);
      values.push(...params.tagIds);
    }
    if (filterConds.length > 0) conditions.push('(' + filterConds.join(' OR ') + ')');

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY a.id';

    if (params.sort) {
      switch (params.sort) {
        case 'name': query += ' ORDER BY a.file_name COLLATE NOCASE ASC, a.id ASC'; break;
        case 'size': query += ' ORDER BY a.file_size DESC, a.id DESC'; break;
        case 'modified': query += ' ORDER BY a.modified_date DESC, a.id DESC'; break;
        case 'created': query += ' ORDER BY a.created_date DESC, a.id DESC'; break;
        case 'type': query += ' ORDER BY a.file_ext ASC, a.file_name COLLATE NOCASE ASC, a.id ASC'; break;
        default: query += ' ORDER BY a.file_name COLLATE NOCASE ASC, a.id ASC';
      }
    } else {
      query += ' ORDER BY a.file_name COLLATE NOCASE ASC, a.id ASC';
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
    const filterConds = [];
    const values = [];

    if (params.libraryIds && params.libraryIds.length > 0) {
      filterConds.push(`a.library_id IN (${params.libraryIds.map(() => '?').join(',')})`);
      values.push(...params.libraryIds);
    }
    if (params.categories && params.categories.length > 0) {
      filterConds.push(`a.category IN (${params.categories.map(() => '?').join(',')})`);
      values.push(...params.categories);
    }
    if (params.search) {
      conditions.push('a.file_name LIKE ?');
      values.push(`%${params.search}%`);
    }
    if (params.favorites) {
      conditions.push('a.is_favorite = 1');
    }
    if (params.collectionIds && params.collectionIds.length > 0) {
      filterConds.push(`a.id IN (
        SELECT DISTINCT asset_id FROM asset_collections WHERE collection_id IN (${params.collectionIds.map(() => '?').join(',')})
      )`);
      values.push(...params.collectionIds);
    }
    if (params.tagIds && params.tagIds.length > 0) {
      filterConds.push(`a.id IN (
        SELECT DISTINCT asset_id FROM asset_tags WHERE tag_id IN (${params.tagIds.map(() => '?').join(',')})
      )`);
      values.push(...params.tagIds);
    }
    if (filterConds.length > 0) conditions.push('(' + filterConds.join(' OR ') + ')');

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    return db.prepare(query).get(...values).count;
  });

  ipcMain.handle('get-asset', (event, assetId) => {
    const asset = db.prepare(`
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
    if (!asset) return null;

    if (!asset.license) {
      const lib = asset.library_id
        ? db.prepare('SELECT path FROM libraries WHERE id = ?').get(asset.library_id)
        : null;
      const detected = detectLicense(asset, lib ? lib.path : null);
      if (detected) {
        db.prepare('UPDATE assets SET license = ? WHERE id = ?').run(detected.license, assetId);
        asset.license = detected.license;
      }
    }
    return asset;
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

  ipcMain.handle('rename-tag', (event, tagId, name, color) => {
    if (!name || !name.trim()) return { error: 'Name cannot be empty' };
    try {
      db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?')
        .run(name.trim(), color || '#7c3aed', tagId);
      return true;
    } catch (e) {
      return { error: 'Tag already exists' };
    }
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

  ipcMain.handle('remove-tag-from-assets', (event, assetIds, tagId) => {
    const stmt = db.prepare('DELETE FROM asset_tags WHERE asset_id = ? AND tag_id = ?');
    const tx = db.transaction((ids) => {
      for (const id of ids) stmt.run(id, tagId);
    });
    tx(assetIds);
    return true;
  });

  ipcMain.handle('rename-asset', (event, assetId, newName) => {
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
    if (!asset) return { error: 'Asset not found' };
    if (!newName || !newName.trim()) return { error: 'Name cannot be empty' };
    const cleanName = newName.trim();
    if (cleanName.includes('/') || cleanName.includes('\\')) return { error: 'Name cannot contain path separators' };

    const dir = path.dirname(asset.file_path);
    const newPath = path.join(dir, cleanName);
    if (newPath === asset.file_path) return { error: 'Name is unchanged' };
    if (fs.existsSync(newPath)) return { error: 'A file with that name already exists' };

    const ext = path.extname(cleanName).toLowerCase();
    const category = getAssetCategory(ext);

    try {
      ignorePath(asset.file_path);
      ignorePath(newPath);
      fs.renameSync(asset.file_path, newPath);
      try { fs.unlinkSync(getThumbCachePath(asset.file_path, cacheDir)); } catch (e) {}
      db.prepare('UPDATE assets SET file_path = ?, file_name = ?, file_ext = ?, category = ? WHERE id = ?')
        .run(newPath, cleanName, ext, category, assetId);
      invalidateCountCache();
      return { ok: true, id: assetId, file_path: newPath, file_name: cleanName, file_ext: ext, category };
    } catch (e) {
      return { error: e.message };
    }
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

  ipcMain.handle('rename-collection', (event, collectionId, name, description) => {
    if (!name || !name.trim()) return { error: 'Name cannot be empty' };
    try {
      db.prepare('UPDATE collections SET name = ?, description = ? WHERE id = ?')
        .run(name.trim(), description || '', collectionId);
      return true;
    } catch (e) {
      return { error: 'Collection already exists' };
    }
  });

  ipcMain.handle('update-asset-metadata', (event, assetId, fields) => {
    const updates = [];
    const values = [];
    if (typeof fields?.license === 'string') { updates.push('license = ?'); values.push(fields.license); }
    if (typeof fields?.notes === 'string') { updates.push('notes = ?'); values.push(fields.notes); }
    if (updates.length === 0) return false;
    values.push(assetId);
    db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return true;
  });

  ipcMain.handle('update-assets-metadata', (event, assetIds, fields) => {
    const updates = [];
    const values = [];
    if (typeof fields?.license === 'string') { updates.push('license = ?'); values.push(fields.license); }
    if (typeof fields?.notes === 'string') { updates.push('notes = ?'); values.push(fields.notes); }
    if (updates.length === 0 || !Array.isArray(assetIds) || assetIds.length === 0) return false;
    const stmt = db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = ?`);
    const tx = db.transaction((ids) => {
      for (const id of ids) stmt.run(...values, id);
    });
    tx(assetIds);
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

  ipcMain.handle('remove-asset-from-collections', (event, assetIds, collectionId) => {
    const stmt = db.prepare('DELETE FROM asset_collections WHERE asset_id = ? AND collection_id = ?');
    const tx = db.transaction((ids) => {
      for (const id of ids) stmt.run(id, collectionId);
    });
    tx(assetIds);
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

  ipcMain.handle('export-database', async () => {
    const mainWindow = getMainWindow();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Database',
      defaultPath: `asset-indexer-${stamp}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });
    if (result.canceled || !result.filePath) return null;
    try {
      await db.backup(result.filePath);
      return { ok: true, path: result.filePath };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('import-database', async () => {
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Database',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const srcPath = result.filePaths[0];

    let probe;
    try {
      probe = new Database(srcPath, { readonly: true });
      const tables = probe.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('libraries','assets')").all();
      if (tables.length < 2) {
        probe.close();
        return { error: 'The selected file is not a valid Asset Indexer database.' };
      }
      probe.close();
    } catch (e) {
      if (probe) probe.close();
      return { error: 'Could not open the selected database file.' };
    }

    try {
      stopAllWatchers();
      db.close();
      const dbPath = path.join(app.getPath('userData'), 'assets.db');
      for (const suffix of ['-wal', '-shm', '-journal']) {
        try { fs.unlinkSync(dbPath + suffix); } catch (e) {}
      }
      fs.copyFileSync(srcPath, dbPath);
      app.relaunch();
      app.exit(0);
      return { ok: true };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('open-data-folder', () => {
    const dbPath = path.join(app.getPath('userData'), 'assets.db');
    shell.showItemInFolder(dbPath);
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
