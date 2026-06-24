import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(join(here, 'schema.sql'), 'utf8');

export function openDb(path = ':memory:') {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  // Migrate existing deck table if columns are missing
  const deckCols = db.prepare('PRAGMA table_info(deck)').all().map(c => c.name);
  if (!deckCols.includes('pinned'))   db.exec('ALTER TABLE deck ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
  if (!deckCols.includes('archived')) db.exec('ALTER TABLE deck ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
  return db;
}
