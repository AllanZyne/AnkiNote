import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '../connection.js';
import { createDeck, listDecks, deleteDeck, setDeckPinned, setDeckArchived, validateDeckPath } from '../decks.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let db;
beforeEach(() => { db = openDb(':memory:'); });

describe('decks', () => {
  it('creates a top-level deck with a uuid id and updatedAt', () => {
    const deck = createDeck(db, { name: 'Spanish' });
    expect(deck).toMatchObject({ name: 'Spanish', pinned: false, archived: false });
    expect(deck.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(deck.updatedAt).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('auto-creates missing ancestors', () => {
    createDeck(db, { name: 'A::B::C' });
    expect(listDecks(db).map(d => d.name).sort()).toEqual(['A', 'A::B', 'A::B::C']);
  });

  it('does not duplicate an existing ancestor', () => {
    createDeck(db, { name: 'A' });
    createDeck(db, { name: 'A::B' });
    expect(listDecks(db).filter(d => d.name === 'A')).toHaveLength(1);
  });

  it('rejects creating a duplicate deck', () => {
    createDeck(db, { name: 'Spanish' });
    expect(() => createDeck(db, { name: 'Spanish' })).toThrow('deck exists');
  });

  it('rejects an invalid deck name', () => {
    expect(() => createDeck(db, { name: 'A::' })).toThrow('invalid deck name');
  });

  it('deletes a deck and its prefix descendants', () => {
    createDeck(db, { name: 'A::B::C' });
    createDeck(db, { name: 'A::X' });
    const ab = listDecks(db).find(d => d.name === 'A::B');
    deleteDeck(db, ab.id);
    expect(listDecks(db).map(d => d.name).sort()).toEqual(['A', 'A::X']);
  });

  it('deleteDeck escapes LIKE wildcards (underscore)', () => {
    createDeck(db, { name: 'A_b::child' });
    createDeck(db, { name: 'AQb::x' });
    const ab = listDecks(db).find(d => d.name === 'A_b');
    deleteDeck(db, ab.id);
    expect(listDecks(db).map(d => d.name).sort()).toEqual(['AQb', 'AQb::x']);
  });

  it('deleteDeck escapes LIKE wildcards (percent)', () => {
    createDeck(db, { name: 'A%b::child' });
    createDeck(db, { name: 'AZZb::x' });
    const ab = listDecks(db).find(d => d.name === 'A%b');
    deleteDeck(db, ab.id);
    expect(listDecks(db).map(d => d.name).sort()).toEqual(['AZZb', 'AZZb::x']);
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

  it.skip('migrates an old deck table (missing pinned/archived) when opening the database', () => {
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
