import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { rmSync } from 'node:fs';
import { openDb } from '../connection.js';
import { listDecks } from '../decks.js';

const PATH = `/tmp/ankinote-deckmig-${process.pid}.db`;
afterEach(() => rmSync(PATH, { force: true }));

describe('parent_id -> path migration', () => {
  it('converts nested parent_id decks to full-path names and drops parent_id', () => {
    const raw = new Database(PATH);
    raw.exec(`CREATE TABLE deck (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      parent_id INTEGER REFERENCES deck(id) ON DELETE CASCADE,
      pinned INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0)`);
    const ins = raw.prepare('INSERT INTO deck (name, parent_id, pinned) VALUES (?, ?, ?)');
    const s = ins.run('Spanish', null, 1).lastInsertRowid;
    ins.run('Verbs', s, 0);
    raw.close();

    const db = openDb(PATH);
    const names = listDecks(db).map(d => d.name).sort();
    expect(names).toEqual(['Spanish', 'Spanish::Verbs']);
    expect(listDecks(db).find(d => d.name === 'Spanish').pinned).toBe(true);
    const cols = db.prepare('PRAGMA table_info(deck)').all().map(c => c.name);
    expect(cols).not.toContain('parent_id');
  });
});
