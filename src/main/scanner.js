const path = require('path');
const fs = require('fs');
const { ALL_EXTENSIONS, getAssetCategory } = require('./constants');

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

function scanDirectory(db, dirPath, libraryId, ignoreRegex) {
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

module.exports = { scanDirectory, getAllFiles };
