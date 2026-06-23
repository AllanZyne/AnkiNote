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
  return db;
}
