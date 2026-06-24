import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(join(here, 'schema.sql'), 'utf8');

function migrateDeckColumns(db) {
  const cols = db.prepare('PRAGMA table_info(deck)').all().map(c => c.name);
  if (!cols.includes('pinned'))   db.exec('ALTER TABLE deck ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('archived')) db.exec('ALTER TABLE deck ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
}

function migrateDeckToPaths(db) {
  const cols = db.prepare('PRAGMA table_info(deck)').all().map(c => c.name);
  if (!cols.includes('parent_id')) return; // already path-based
  const rows = db.prepare('SELECT id, name, parent_id AS parentId, pinned, archived FROM deck').all();
  const byId = new Map(rows.map(r => [r.id, r]));
  const pathOf = (r) => r.parentId == null ? r.name : `${pathOf(byId.get(r.parentId))}::${r.name}`;
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`CREATE TABLE deck_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0)`);
    const ins = db.prepare('INSERT INTO deck_new (id, name, pinned, archived) VALUES (?, ?, ?, ?)');
    for (const r of rows) ins.run(r.id, pathOf(r), r.pinned, r.archived);
    db.exec('DROP TABLE deck');
    db.exec('ALTER TABLE deck_new RENAME TO deck');
  })();
  db.pragma('foreign_keys = ON');
}

export function openDb(path = ':memory:') {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrateDeckColumns(db);   // bring very old DBs up to pinned/archived first
  migrateDeckToPaths(db);   // then convert parent_id -> full-path names
  return db;
}
