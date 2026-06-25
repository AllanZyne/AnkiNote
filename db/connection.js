import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { newId, nowIso } from './ids.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(join(here, 'schema.sql'), 'utf8');

// Tables in FK-dependency order, with their FK columns -> referenced table.
const TABLES = [
  { name: 'note_type', fks: {} },
  { name: 'deck', fks: {} },
  { name: 'field', fks: { note_type_id: 'note_type' } },
  { name: 'card_template', fks: { note_type_id: 'note_type' } },
  { name: 'note', fks: { note_type_id: 'note_type', deck_id: 'deck' } },
  { name: 'field_value', fks: { note_id: 'note', field_id: 'field' } },
  { name: 'card', fks: { note_id: 'note', card_template_id: 'card_template' } },
];

function colType(db, table, col) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all().find(c => c.name === col);
  return info ? info.type : null;
}

function migrateIntegerIdsToUuids(db) {
  // Detect: if note_type.id is INTEGER, this is a legacy DB.
  if (colType(db, 'note_type', 'id') !== 'INTEGER') return;
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      const idMaps = {}; // table -> Map(oldIntId -> uuid)
      for (const t of TABLES) {
        idMaps[t.name] = new Map();
        for (const row of db.prepare(`SELECT id FROM ${t.name}`).all()) {
          idMaps[t.name].set(row.id, newId());
        }
      }
      const ts = nowIso();
      for (const t of TABLES) {
        const rows = db.prepare(`SELECT * FROM ${t.name}`).all();
        db.exec(`ALTER TABLE ${t.name} RENAME TO ${t.name}_old`);
        // Recreate just this table from the new schema by extracting its CREATE statement.
        const stmt = SCHEMA.split(';').find(s => s.includes(`CREATE TABLE IF NOT EXISTS ${t.name} `));
        db.exec(stmt + ';');
        const cols = db.prepare(`PRAGMA table_info(${t.name})`).all().map(c => c.name);
        const insert = db.prepare(
          `INSERT INTO ${t.name} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
        );
        for (const row of rows) {
          const out = {};
          for (const c of cols) {
            if (c === 'id') out[c] = idMaps[t.name].get(row.id);
            else if (t.fks[c]) out[c] = idMaps[t.fks[c]].get(row[c]);
            else if (c === 'updated_at') out[c] = ts;
            else if (c === 'deleted') out[c] = 0;
            else out[c] = row[c];
          }
          insert.run(cols.map(c => out[c]));
        }
        db.exec(`DROP TABLE ${t.name}_old`);
      }
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function ensureSyncColumns(db) {
  // Backfill updated_at where null (e.g. UUID DB created before sync columns).
  for (const t of ['note_type', 'deck', 'note']) {
    const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
    if (!cols.includes('updated_at')) db.exec(`ALTER TABLE ${t} ADD COLUMN updated_at TEXT`);
    if (!cols.includes('deleted')) db.exec(`ALTER TABLE ${t} ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`);
  }
  const ts = nowIso();
  for (const t of ['note_type', 'deck', 'note']) {
    db.prepare(`UPDATE ${t} SET updated_at = ? WHERE updated_at IS NULL`).run(ts);
  }
}

export function openDb(path = ':memory:') {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrateIntegerIdsToUuids(db);
  ensureSyncColumns(db);
  return db;
}
