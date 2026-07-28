const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const chokidar = require('chokidar');
const fs = require('fs');

let mainWindow;
let db;
let watchers = {};

const ASSET_EXTENSIONS = {
  '3d-models': ['.fbx', '.obj', '.gltf', '.glb', '.blend', '.3ds', '.dae', '.stl', '.ply'],
  'images': ['.png', '.jpg', '.jpeg', '.tga', '.tiff', '.tif', '.bmp', '.gif', '.psd', '.hdr', '.exr', '.dds', '.ktx', '.webp', '.ico'],
  'materials': ['.mat', '.material', '.shader', '.mtl'],
  'audio': ['.wav', '.mp3', '.ogg', '.flac', '.aiff', '.m4a', '.wma'],
  'scripts': ['.cs', '.js', '.ts', '.py', '.lua', '.cpp', '.h'],
  'videos': ['.mp4', '.avi', '.mov', '.wmv', '.mkv', '.webm'],
  'documents': ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf']
};

const ALL_EXTENSIONS = Object.values(ASSET_EXTENSIONS).flat();

function getAssetCategory(ext) {
  const lower = ext.toLowerCase();
  for (const [category, extensions] of Object.entries(ASSET_EXTENSIONS)) {
    if (extensions.includes(lower)) return category;
  }
  return 'other';
}

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'assets.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS libraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      ignore_regex TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      library_id INTEGER,
      file_path TEXT UNIQUE NOT NULL,
      file_name TEXT NOT NULL,
      file_ext TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      modified_date DATETIME,
      created_date DATETIME,
      category TEXT DEFAULT 'other',
      is_favorite INTEGER DEFAULT 0,
      FOREIGN KEY (library_id) REFERENCES libraries(id)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#7c3aed'
    );

    CREATE TABLE IF NOT EXISTS asset_tags (
      asset_id INTEGER,
      tag_id INTEGER,
      PRIMARY KEY (asset_id, tag_id),
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS asset_collections (
      asset_id INTEGER,
      collection_id INTEGER,
      PRIMARY KEY (asset_id, collection_id),
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
    CREATE INDEX IF NOT EXISTS idx_assets_file_ext ON assets(file_ext);
    CREATE INDEX IF NOT EXISTS idx_assets_library ON assets(library_id);
    CREATE INDEX IF NOT EXISTS idx_assets_favorite ON assets(is_favorite);
  `);

  // Migrate: add ignore_regex column if missing
  const cols = db.prepare("PRAGMA table_info(libraries)").all();
  if (!cols.find(c => c.name === 'ignore_regex')) {
    db.exec("ALTER TABLE libraries ADD COLUMN ignore_regex TEXT DEFAULT ''");
  }
}

function scanDirectory(dirPath, libraryId, ignoreRegex) {
  const insertAsset = db.prepare(`
    INSERT OR REPLACE INTO assets (library_id, file_path, file_name, file_ext, file_size, modified_date, created_date, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const files = getAllFiles(dirPath, ignoreRegex);
  const insertMany = db.transaction((fileList) => {
    for (const filePath of fileList) {
      try {
        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath);
        const category = getAssetCategory(ext);
        insertAsset.run(
          libraryId,
          filePath,
          path.basename(filePath),
          ext,
          stat.size,
          stat.mtime.toISOString(),
          stat.birthtime.toISOString(),
          category
        );
      } catch (e) {}
    }
  });

  insertMany(files);
  return files.length;
}

function getAllFiles(dirPath, ignoreRegex) {
  const results = [];
  let ignorePattern = null;
  if (ignoreRegex && ignoreRegex.trim()) {
    try { ignorePattern = new RegExp(ignoreRegex, 'i'); } catch (e) { ignorePattern = null; }
  }

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const posixPath = fullPath.replace(/\\/g, '/');

      if (ignorePattern) {
        if (ignorePattern.test(fullPath) || ignorePattern.test(posixPath) || ignorePattern.test(entry.name)) {
          continue;
        }
      }

      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) {
          results.push(...getAllFiles(fullPath, ignoreRegex));
        }
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (ALL_EXTENSIONS.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch (e) {}
  return results;
}

function setupWatcher(libraryPath, libraryId, ignoreRegex) {
  if (watchers[libraryId]) {
    watchers[libraryId].close();
  }

  const defaultIgnore = (p) => /(^|[\/\\])\.(?!app)/.test(p);
  let ignoreFn = defaultIgnore;
  if (ignoreRegex && ignoreRegex.trim()) {
    try {
      const re = new RegExp(ignoreRegex, 'i');
      ignoreFn = (p) => {
        if (defaultIgnore(p)) return true;
        const str = typeof p === 'string' ? p : (Array.isArray(p) ? p.join('/') : String(p));
        return re.test(str) || re.test(str.replace(/\\/g, '/'));
      };
    } catch (e) {}
  }

  const watcher = chokidar.watch(libraryPath, {
    ignored: ignoreFn,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
  });

  watcher.on('add', (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ALL_EXTENSIONS.includes(ext)) {
      try {
        const stat = fs.statSync(filePath);
        const category = getAssetCategory(ext);
        db.prepare(`
          INSERT OR REPLACE INTO assets (library_id, file_path, file_name, file_ext, file_size, modified_date, created_date, category)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(libraryId, filePath, path.basename(filePath), ext, stat.size, stat.mtime.toISOString(), stat.birthtime.toISOString(), category);
        mainWindow?.webContents.send('asset-added', { libraryId, filePath });
      } catch (e) {}
    }
  });

  watcher.on('change', (filePath) => {
    try {
      const stat = fs.statSync(filePath);
      db.prepare(`UPDATE assets SET file_size = ?, modified_date = ? WHERE file_path = ?`)
        .run(stat.size, stat.mtime.toISOString(), filePath);
      mainWindow?.webContents.send('asset-updated', { filePath });
    } catch (e) {}
  });

  watcher.on('unlink', (filePath) => {
    db.prepare(`DELETE FROM assets WHERE file_path = ?`).run(filePath);
    mainWindow?.webContents.send('asset-removed', { filePath });
  });

  watchers[libraryId] = watcher;
}

function stopWatcher(libraryId) {
  if (watchers[libraryId]) {
    watchers[libraryId].close();
    delete watchers[libraryId];
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0D1020',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    icon: path.join(__dirname, 'renderer', 'icon.ico')
  });

  mainWindow.maximize();
  mainWindow.show();

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();

  const libraries = db.prepare('SELECT * FROM libraries').all();
  libraries.forEach(lib => setupWatcher(lib.path, lib.id, lib.ignore_regex));
});

app.on('window-all-closed', () => {
  Object.values(watchers).forEach(w => w.close());
  if (db) db.close();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('browse-folder', async () => {
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

  const count = scanDirectory(dirPath, libraryId, ignoreRegex);
  setupWatcher(dirPath, libraryId, ignoreRegex);

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
  return true;
});

ipcMain.handle('rescan-library', (event, libraryId) => {
  const lib = db.prepare('SELECT * FROM libraries WHERE id = ?').get(libraryId);
  if (!lib) return { error: 'Library not found' };

  // Remove old assets for this library
  db.prepare('DELETE FROM asset_collections WHERE asset_id IN (SELECT id FROM assets WHERE library_id = ?)').run(libraryId);
  db.prepare('DELETE FROM asset_tags WHERE asset_id IN (SELECT id FROM assets WHERE library_id = ?)').run(libraryId);
  db.prepare('DELETE FROM assets WHERE library_id = ?').run(libraryId);

  // Rescan
  const count = scanDirectory(lib.path, libraryId, lib.ignore_regex);
  setupWatcher(lib.path, libraryId, lib.ignore_regex);

  return { libraryId, assetCount: count };
});

ipcMain.handle('rescan-all', () => {
  const libraries = db.prepare('SELECT * FROM libraries').all();
  let total = 0;
  for (const lib of libraries) {
    db.prepare('DELETE FROM asset_collections WHERE asset_id IN (SELECT id FROM assets WHERE library_id = ?)').run(lib.id);
    db.prepare('DELETE FROM asset_tags WHERE asset_id IN (SELECT id FROM assets WHERE library_id = ?)').run(lib.id);
    db.prepare('DELETE FROM assets WHERE library_id = ?').run(lib.id);
    total += scanDirectory(lib.path, lib.id, lib.ignore_regex);
    setupWatcher(lib.path, lib.id, lib.ignore_regex);
  }
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
    query += ' LIMIT ?';
    values.push(params.limit);
  }
  if (params.offset) {
    query += ' OFFSET ?';
    values.push(params.offset);
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
  const counts = {};
  const rows = db.prepare('SELECT category, COUNT(*) as count FROM assets GROUP BY category').all();
  rows.forEach(r => counts[r.category] = r.count);
  return counts;
});

ipcMain.handle('get-total-assets', () => {
  return db.prepare('SELECT COUNT(*) as count FROM assets').get().count;
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
      return { type: 'image', data: `data:${mimeMap[ext] || 'image/png'};base64,${data.toString('base64')}` };
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
    const ext = path.extname(filePath).toLowerCase();
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.tiff', '.tif'];
    if (!imageExts.includes(ext)) return { type: 'none' };
    const stat = fs.statSync(filePath);
    if (stat.size > 5 * 1024 * 1024) return { type: 'none' };
    const data = fs.readFileSync(filePath);
    const mimeMap = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
      '.ico': 'image/x-icon', '.tiff': 'image/tiff', '.tif': 'image/tiff'
    };
    return { type: 'image', data: `data:${mimeMap[ext] || 'image/png'};base64,${data.toString('base64')}` };
  } catch (e) {
    return { type: 'none' };
  }
});

ipcMain.handle('get-thumbnails-batch', (event, filePaths) => {
  const results = {};
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.tiff', '.tif'];
  for (const filePath of filePaths) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      if (!imageExts.includes(ext)) continue;
      const stat = fs.statSync(filePath);
      if (stat.size > 5 * 1024 * 1024) continue;
      const data = fs.readFileSync(filePath);
      const mimeMap = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
        '.ico': 'image/x-icon', '.tiff': 'image/tiff', '.tif': 'image/tiff'
      };
      results[filePath] = `data:${mimeMap[ext] || 'image/png'};base64,${data.toString('base64')}`;
    } catch (e) {}
  }
  return results;
});

ipcMain.handle('window-minimize', () => mainWindow.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window-close', () => mainWindow.close());
