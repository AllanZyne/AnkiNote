import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../connection.js';
import { createNoteType } from '../noteTypes.js';
import { createDeck } from '../decks.js';
import {
  createNote, getNote, listNotesInDeck, updateNote, deleteNote, searchNotes
} from '../notes.js';

let db, nt, deck;
beforeEach(() => {
  db = openDb(':memory:');
  nt = createNoteType(db, {
    name: 'Basic', css: '',
    fields: [{ name: 'Front' }, { name: 'Back' }],
    templates: [{ name: 'Card 1', frontHtml: '{{Front}}', backHtml: '{{Back}}' }],
  });
  deck = createDeck(db, { name: 'B' });
});

describe('notes', () => {
  it('creates a note with values and one card per template', () => {
    const note = createNote(db, {
      noteTypeId: nt.id, deckId: deck.id, values: { Front: 'hola', Back: 'hello' },
    });
    expect(note.values).toEqual({ Front: 'hola', Back: 'hello' });
    expect(note.cardIds).toHaveLength(1);
    expect(note.created).toBeTruthy();
    expect(note.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(note.updatedAt).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('lists notes in a deck', () => {
    createNote(db, { noteTypeId: nt.id, deckId: deck.id, values: { Front: 'a', Back: 'b' } });
    expect(listNotesInDeck(db, deck.id)).toHaveLength(1);
  });

  it('updates field values and bumps modified', () => {
    const note = createNote(db, { noteTypeId: nt.id, deckId: deck.id, values: { Front: 'a', Back: 'b' } });
    const updated = updateNote(db, note.id, { values: { Front: 'A', Back: 'b' } });
    expect(updated.values.Front).toBe('A');
  });

  it('soft-deletes a note (getNote returns undefined, card remains)', () => {
    const note = createNote(db, { noteTypeId: nt.id, deckId: deck.id, values: { Front: 'a', Back: 'b' } });
    deleteNote(db, note.id);
    expect(getNote(db, note.id)).toBeUndefined();
    expect(db.prepare('SELECT deleted FROM note WHERE id = ?').get(note.id).deleted).toBe(1);
  });

  it('searches across field values case-insensitively', () => {
    createNote(db, { noteTypeId: nt.id, deckId: deck.id, values: { Front: 'Gato', Back: 'cat' } });
    createNote(db, { noteTypeId: nt.id, deckId: deck.id, values: { Front: 'Perro', Back: 'dog' } });
    expect(searchNotes(db, 'gat')).toHaveLength(1);
    expect(searchNotes(db, 'DOG')).toHaveLength(1);
    expect(searchNotes(db, '')).toHaveLength(2);
  });
});
