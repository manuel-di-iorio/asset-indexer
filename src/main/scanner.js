const path = require('path');
const fs = require('fs');
const { ALL_EXTENSIONS, getAssetCategory } = require('./constants');

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
    INSERT OR REPLACE INTO assets (library_id, file_path, file_name, file_ext, file_size, modified_date, created_date, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const files = await getAllFiles(dirPath, ignoreRegex, signal);
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

module.exports = { scanDirectory, getAllFiles };
