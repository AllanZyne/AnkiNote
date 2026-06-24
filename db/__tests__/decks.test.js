import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../connection.js';
import { createDeck, listDecks, renameDeck, deleteDeck } from '../decks.js';

let db;
beforeEach(() => { db = openDb(':memory:'); });

describe('decks', () => {
  it('creates a top-level deck', () => {
    const deck = createDeck(db, { name: 'Spanish' });
    expect(deck).toEqual({ id: expect.any(Number), name: 'Spanish', parentId: null });
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
});
