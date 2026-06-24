import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '../connection.js';
import { createDeck, listDecks, renameDeck, deleteDeck, setDeckPinned, setDeckArchived, validateDeckPath } from '../decks.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let db;
beforeEach(() => { db = openDb(':memory:'); });

describe('decks', () => {
  it('creates a top-level deck', () => {
    const deck = createDeck(db, { name: 'Spanish' });
    expect(deck).toEqual({ id: expect.any(Number), name: 'Spanish', parentId: null, pinned: false, archived: false });
  });

  it('creates a nested deck and lists all', () => {
    const parent = createDeck(db, { name: 'Lang' });
    createDeck(db, { name: 'Verbs', parentId: parent.id });
    const all = listDecks(db);
    expect(all).toHaveLength(2);
    expect(all.find(d => d.name === 'Verbs').parentId).toBe(parent.id);
  });

  it('renames a deck', () => {
    const deck = createDeck(db, { name: 'Old' });
    renameDeck(db, deck.id, 'New');
    expect(listDecks(db)[0].name).toBe('New');
  });

  it('deletes a deck and cascades to children', () => {
    const parent = createDeck(db, { name: 'Lang' });
    createDeck(db, { name: 'Verbs', parentId: parent.id });
    deleteDeck(db, parent.id);
    expect(listDecks(db)).toHaveLength(0);
  });

  it('defaults pinned and archived to false on create', () => {
    const deck = createDeck(db, { name: 'New' });
    expect(deck.pinned).toBe(false);
    expect(deck.archived).toBe(false);
    expect(listDecks(db)[0]).toMatchObject({ pinned: false, archived: false });
  });

  it('sets and clears the pinned flag', () => {
    const deck = createDeck(db, { name: 'D' });
    setDeckPinned(db, deck.id, true);
    expect(listDecks(db)[0].pinned).toBe(true);
    setDeckPinned(db, deck.id, false);
    expect(listDecks(db)[0].pinned).toBe(false);
  });

  it('sets and clears the archived flag', () => {
    const deck = createDeck(db, { name: 'D' });
    setDeckArchived(db, deck.id, true);
    expect(listDecks(db)[0].archived).toBe(true);
    setDeckArchived(db, deck.id, false);
    expect(listDecks(db)[0].archived).toBe(false);
  });

  it('validateDeckPath accepts a nested path and normalizes whitespace', () => {
    expect(validateDeckPath(' Spanish :: Verbs ')).toMatchObject({ valid: true, normalized: 'Spanish::Verbs' });
  });

  it('validateDeckPath rejects empty segments and empty names', () => {
    expect(validateDeckPath('Spanish::').valid).toBe(false);
    expect(validateDeckPath('::Verbs').valid).toBe(false);
    expect(validateDeckPath('A::::B').valid).toBe(false);
    expect(validateDeckPath('   ').valid).toBe(false);
  });
});

describe('deck table migration', () => {
  const testDbPath = path.join(process.cwd(), `test-migration-${process.pid}.db`);
  afterEach(() => { fs.rmSync(testDbPath, { force: true }); });

  it('migrates an old deck table (missing pinned/archived) when opening the database', () => {
    // Create old-shape deck table (only id, name, parent_id)
    const oldDb = new Database(testDbPath);
    oldDb.exec(`
      CREATE TABLE deck (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER
      );
      INSERT INTO deck (name, parent_id) VALUES ('Spanish', NULL);
    `);
    oldDb.close();

    // Open with openDb (should auto-migrate)
    const migratedDb = openDb(testDbPath);
    const decks = listDecks(migratedDb);
    expect(decks).toHaveLength(1);
    expect(decks[0]).toMatchObject({ name: 'Spanish', pinned: false, archived: false });
    migratedDb.close();
  });
});
