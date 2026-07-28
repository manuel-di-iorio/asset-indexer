const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3');

let db;

function getDb() {
  return db;
}

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'assets.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

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
    CREATE INDEX IF NOT EXISTS idx_assets_name ON assets(file_name);
  `);

  const ftsExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='assets_fts'").get();
  if (!ftsExists) {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
        file_name,
        content='assets',
        content_rowid='id'
      );

      INSERT INTO assets_fts(rowid, file_name) SELECT id, file_name FROM assets;

      CREATE TRIGGER IF NOT EXISTS assets_ai AFTER INSERT ON assets BEGIN
        INSERT INTO assets_fts(rowid, file_name) VALUES (new.id, new.file_name);
      END;

      CREATE TRIGGER IF NOT EXISTS assets_ad AFTER DELETE ON assets BEGIN
        INSERT INTO assets_fts(assets_fts, rowid, file_name) VALUES('delete', old.id, old.file_name);
      END;

      CREATE TRIGGER IF NOT EXISTS assets_au AFTER UPDATE ON assets BEGIN
        INSERT INTO assets_fts(assets_fts, rowid, file_name) VALUES('delete', old.id, old.file_name);
        INSERT INTO assets_fts(rowid, file_name) VALUES (new.id, new.file_name);
      END;
    `);
  }

  const cols = db.prepare("PRAGMA table_info(libraries)").all();
  if (!cols.find(c => c.name === 'ignore_regex')) {
    db.exec("ALTER TABLE libraries ADD COLUMN ignore_regex TEXT DEFAULT ''");
  }
}

module.exports = { initDatabase, getDb };
