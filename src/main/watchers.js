const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { ALL_EXTENSIONS, getAssetCategory } = require('./constants');
const { extractImageMetadata } = require('./metadata');

let watchers = {};
let ignoredPaths = new Set();

function metadataFor(filePath, category) {
  if (category !== 'images') return null;
  const meta = extractImageMetadata(filePath);
  if (!meta) return null;
  return [meta.width, meta.height, meta.bitDepth, meta.hasAlpha];
}

function ignorePath(p) {
  ignoredPaths.add(p);
  setTimeout(() => ignoredPaths.delete(p), 5000);
}

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
    if (ignoredPaths.has(filePath)) return;
    const ext = path.extname(filePath).toLowerCase();
    if (!ALL_EXTENSIONS.includes(ext)) return;
    try {
      const stat = fs.statSync(filePath);
      const category = getAssetCategory(ext);
      const meta = metadataFor(filePath, category);
      db.prepare(`
        INSERT INTO assets (library_id, file_path, file_name, file_ext, file_size, modified_date, created_date, category, width, height, bit_depth, has_alpha)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(file_path) DO UPDATE SET
          library_id = excluded.library_id,
          file_name = excluded.file_name,
          file_ext = excluded.file_ext,
          file_size = excluded.file_size,
          modified_date = excluded.modified_date,
          created_date = excluded.created_date,
          category = excluded.category,
          width = excluded.width,
          height = excluded.height,
          bit_depth = excluded.bit_depth,
          has_alpha = excluded.has_alpha
      `).run(libraryId, filePath, path.basename(filePath), ext, stat.size, stat.mtime.toISOString(), stat.birthtime.toISOString(), category,
        meta ? meta[0] : null, meta ? meta[1] : null, meta ? meta[2] : null, meta ? meta[3] : null);
      mainWindow?.webContents.send('asset-added', { libraryId, filePath });
    } catch (e) {}
  });

  watcher.on('change', (filePath) => {
    if (ignoredPaths.has(filePath)) return;
    try {
      const stat = fs.statSync(filePath);
      const category = getAssetCategory(path.extname(filePath).toLowerCase());
      const meta = metadataFor(filePath, category);
      db.prepare(`UPDATE assets SET file_size = ?, modified_date = ?, width = ?, height = ?, bit_depth = ?, has_alpha = ? WHERE file_path = ?`)
        .run(stat.size, stat.mtime.toISOString(),
          meta ? meta[0] : null, meta ? meta[1] : null, meta ? meta[2] : null, meta ? meta[3] : null,
          filePath);
      mainWindow?.webContents.send('asset-updated', { filePath });
    } catch (e) {}
  });

  watcher.on('unlink', (filePath) => {
    if (ignoredPaths.has(filePath)) return;
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

module.exports = { setupWatcher, stopWatcher, stopAllWatchers, ignorePath };
