import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../connection.js';
import { createDeck, listDecks, renameDeck, deleteDeck, setDeckPinned, setDeckArchived } from '../decks.js';

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
});
