const path = require('path');
const fs = require('fs');
const { ALL_EXTENSIONS_SET, getAssetCategory } = require('./constants');
const { extractImageMetadata } = require('./metadata');

const BATCH_SIZE = 500;

async function metadataFor(filePath, category) {
  if (category !== 'images') return null;
  const meta = await extractImageMetadata(filePath);
  if (!meta) return null;
  return [meta.width, meta.height, meta.bitDepth, meta.hasAlpha];
}

async function getAllFiles(dirPath, ignoreRegex, signal, results = []) {
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
          await getAllFiles(fullPath, ignoreRegex, signal, results);
        }
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (ALL_EXTENSIONS_SET.has(ext)) {
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

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    if (signal?.aborted) break;
    const chunk = files.slice(i, i + BATCH_SIZE);
    const stats = await Promise.all(chunk.map(f =>
      fs.promises.stat(f).catch(() => null)
    ));
    const metaResults = await Promise.all(chunk.map((f, j) => {
      if (!stats[j]) return Promise.resolve(null);
      const ext = path.extname(f).toLowerCase();
      const category = getAssetCategory(ext);
      return metadataFor(f, category);
    }));

    const insertChunk = db.transaction((entries) => {
      for (const [filePath, stat, meta, ext] of entries) {
        if (!stat) continue;
        const category = getAssetCategory(ext);
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
      }
    });
    insertChunk(chunk.map((f, j) => [f, stats[j], metaResults[j], path.extname(f)]));
  }

  return { count: files.length, files };
}

function pruneStaleAssets(db, libraryId, existingPaths) {
  if (existingPaths.length === 0) {
    const count = db.prepare('SELECT COUNT(*) as count FROM assets WHERE library_id = ?').get(libraryId).count;
    if (count === 0) return 0;
    db.prepare('DELETE FROM assets WHERE library_id = ?').run(libraryId);
    return count;
  }
  const placeholders = existingPaths.map(() => '?').join(',');
  const stale = db.prepare(`SELECT id FROM assets WHERE library_id = ? AND file_path NOT IN (${placeholders})`).all(libraryId, ...existingPaths);
  if (stale.length === 0) return 0;
  const staleIds = stale.map(r => r.id);
  const idPlaceholders = staleIds.map(() => '?').join(',');
  db.prepare(`DELETE FROM assets WHERE id IN (${idPlaceholders})`).run(...staleIds);
  return staleIds.length;
}

module.exports = { scanDirectory, getAllFiles, pruneStaleAssets };
