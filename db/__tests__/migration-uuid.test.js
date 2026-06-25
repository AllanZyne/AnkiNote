import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { rmSync } from 'node:fs';
import { openDb } from '../connection.js';
import { listDecks } from '../decks.js';
import { listNotesInDeck } from '../notes.js';
import { listNoteTypes } from '../noteTypes.js';

const P = `/tmp/ankinote-uuidmig-${process.pid}.db`;
afterEach(() => rmSync(P, { force: true }));

describe('integer -> UUID migration', () => {
  it('rebuilds legacy integer-id data into UUIDs preserving relationships', () => {
    const raw = new Database(P);
    raw.exec(`
      CREATE TABLE note_type (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, css TEXT NOT NULL DEFAULT '');
      CREATE TABLE field (id INTEGER PRIMARY KEY AUTOINCREMENT, note_type_id INTEGER NOT NULL, name TEXT NOT NULL, ord INTEGER NOT NULL);
      CREATE TABLE card_template (id INTEGER PRIMARY KEY AUTOINCREMENT, note_type_id INTEGER NOT NULL, name TEXT NOT NULL, front_html TEXT DEFAULT '', back_html TEXT DEFAULT '', ord INTEGER NOT NULL);
      CREATE TABLE deck (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, pinned INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE note (id INTEGER PRIMARY KEY AUTOINCREMENT, note_type_id INTEGER NOT NULL, deck_id INTEGER NOT NULL, created TEXT NOT NULL, modified TEXT NOT NULL);
      CREATE TABLE field_value (id INTEGER PRIMARY KEY AUTOINCREMENT, note_id INTEGER NOT NULL, field_id INTEGER NOT NULL, value_md TEXT NOT NULL DEFAULT '');
      CREATE TABLE card (id INTEGER PRIMARY KEY AUTOINCREMENT, note_id INTEGER NOT NULL, card_template_id INTEGER NOT NULL);
    `);
    const nt = raw.prepare('INSERT INTO note_type (name) VALUES (?)').run('Basic').lastInsertRowid;
    const f = raw.prepare('INSERT INTO field (note_type_id, name, ord) VALUES (?, ?, 0)').run(nt, 'Front').lastInsertRowid;
    const tpl = raw.prepare('INSERT INTO card_template (note_type_id, name, ord) VALUES (?, ?, 0)').run(nt, 'C').lastInsertRowid;
    const d = raw.prepare('INSERT INTO deck (name) VALUES (?)').run('Spanish').lastInsertRowid;
    const n = raw.prepare('INSERT INTO note (note_type_id, deck_id, created, modified) VALUES (?, ?, ?, ?)').run(nt, d, 'x', 'x').lastInsertRowid;
    raw.prepare('INSERT INTO field_value (note_id, field_id, value_md) VALUES (?, ?, ?)').run(n, f, 'hola');
    raw.prepare('INSERT INTO card (note_id, card_template_id) VALUES (?, ?)').run(n, tpl);
    raw.close();

    const db = openDb(P);
    // ids are now UUID strings
    const decks = listDecks(db);
    expect(decks).toHaveLength(1);
    expect(decks[0].id).toMatch(/^[0-9a-f-]{36}$/);
    // relationship preserved: the note is in the deck, with its field value
    const notes = listNotesInDeck(db, decks[0].id);
    expect(notes).toHaveLength(1);
    expect(notes[0].values).toEqual({ Front: 'hola' });
    expect(listNoteTypes(db)[0].id).toMatch(/^[0-9a-f-]{36}$/);
    // updated_at backfilled with an offset timestamp
    expect(decks[0].updatedAt).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('is idempotent on an already-UUID database', () => {
    const db1 = openDb(P); db1.close();
    const db2 = openDb(P); // must not throw / re-migrate
    expect(() => listDecks(db2)).not.toThrow();
  });
});
