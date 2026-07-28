const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { ALL_EXTENSIONS, getAssetCategory } = require('./constants');

let watchers = {};

function setupWatcher(db, mainWindow, libraryPath, libraryId, ignoreRegex) {
  if (watchers[libraryId]) {
    watchers[libraryId].close();
  }

  const defaultIgnore = (p) => /(^|[\/\\])\.(?!app)/.test(p);
  let ignoreFn = defaultIgnore;
  if (ignoreRegex && ignoreRegex.trim()) {
    try {
      if (ignoreRegex.length > 200) throw new Error('Regex too long');
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
    if (!ALL_EXTENSIONS.includes(ext)) return;
    try {
      const stat = fs.statSync(filePath);
      const category = getAssetCategory(ext);
      db.prepare(`
        INSERT OR REPLACE INTO assets (library_id, file_path, file_name, file_ext, file_size, modified_date, created_date, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(libraryId, filePath, path.basename(filePath), ext, stat.size, stat.mtime.toISOString(), stat.birthtime.toISOString(), category);
      mainWindow?.webContents.send('asset-added', { libraryId, filePath });
    } catch (e) {}
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

function stopAllWatchers() {
  Object.values(watchers).forEach(w => w.close());
  watchers = {};
}

module.exports = { setupWatcher, stopWatcher, stopAllWatchers };
