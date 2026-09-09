import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env['DB_PATH'] ?? path.join(__dirname, '../../data/blacklist.db');

const db: DatabaseType = new Database(DB_PATH);

// WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS blacklist (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    phone      TEXT,
    name       TEXT,
    address    TEXT,
    email      TEXT,
    reason     TEXT NOT NULL DEFAULT '',
    severity   TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    added_by   TEXT NOT NULL DEFAULT 'manual'
  );

  CREATE INDEX IF NOT EXISTS idx_phone   ON blacklist(phone);
  CREATE INDEX IF NOT EXISTS idx_name    ON blacklist(name);
  CREATE INDEX IF NOT EXISTS idx_email   ON blacklist(email);

  CREATE TABLE IF NOT EXISTS reports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    blacklist_id INTEGER NOT NULL REFERENCES blacklist(id) ON DELETE CASCADE,
    comment      TEXT NOT NULL,
    verdict      TEXT NOT NULL CHECK(verdict IN ('scam','clean')),
    platform     TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_reports_blacklist ON reports(blacklist_id);

  CREATE TABLE IF NOT EXISTS check_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    query      TEXT NOT NULL,
    matched    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export default db;
