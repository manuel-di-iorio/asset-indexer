const path = require('path');
const fs = require('fs');
const { ALL_EXTENSIONS, getAssetCategory } = require('./constants');
const { extractImageMetadata } = require('./metadata');

function metadataFor(filePath, category) {
  if (category !== 'images') return null;
  const meta = extractImageMetadata(filePath);
  if (!meta) return null;
  return [meta.width, meta.height, meta.bitDepth, meta.hasAlpha];
}

async function getAllFiles(dirPath, ignoreRegex, signal) {
  const results = [];
  let ignorePattern = null;
  if (ignoreRegex && ignoreRegex.trim()) {
    try {
      if (ignoreRegex.length > 200) throw new Error('Regex too long');
      ignorePattern = new RegExp(ignoreRegex, 'i');
    } catch (e) { ignorePattern = null; }
  }

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (signal?.aborted) return results;
      const fullPath = path.join(dirPath, entry.name);
      const posixPath = fullPath.replace(/\\/g, '/');

      if (ignorePattern) {
        if (ignorePattern.test(fullPath) || ignorePattern.test(posixPath) || ignorePattern.test(entry.name)) {
          continue;
        }
      }

      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) {
          const sub = await getAllFiles(fullPath, ignoreRegex, signal);
          results.push(...sub);
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

async function scanDirectory(db, dirPath, libraryId, ignoreRegex, signal) {
  const insertAsset = db.prepare(`
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
  `);

  const files = await getAllFiles(dirPath, ignoreRegex, signal);
  const insertMany = db.transaction((fileList) => {
    for (const filePath of fileList) {
      try {
        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath);
        const category = getAssetCategory(ext);
        const meta = metadataFor(filePath, category);
        insertAsset.run(
          libraryId,
          filePath,
          path.basename(filePath),
          ext,
          stat.size,
          stat.mtime.toISOString(),
          stat.birthtime.toISOString(),
          category,
          meta ? meta[0] : null,
          meta ? meta[1] : null,
          meta ? meta[2] : null,
          meta ? meta[3] : null
        );
      } catch (e) {}
    }
  });

  insertMany(files);
  return { count: files.length, files };
}

function pruneStaleAssets(db, libraryId, existingPaths) {
  const existing = new Set(existingPaths.map(p => p.toLowerCase()));
  const rows = db.prepare('SELECT id, file_path FROM assets WHERE library_id = ?').all(libraryId);
  const stale = rows.filter(r => !existing.has(r.file_path.toLowerCase())).map(r => r.id);
  if (stale.length === 0) return 0;
  const del = db.prepare('DELETE FROM assets WHERE id = ?');
  const tx = db.transaction((ids) => {
    for (const id of ids) del.run(id);
  });
  tx(stale);
  return stale.length;
}

module.exports = { scanDirectory, getAllFiles, pruneStaleAssets };
