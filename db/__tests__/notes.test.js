import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../connection.js';
import { createNoteType } from '../noteTypes.js';
import { createBox } from '../boxes.js';
import {
  createNote, getNote, listNotesInBox, updateNote, deleteNote, searchNotes
} from '../notes.js';

let db, nt, box;
beforeEach(() => {
  db = openDb(':memory:');
  nt = createNoteType(db, {
    name: 'Basic', css: '',
    fields: [{ name: 'Front' }, { name: 'Back' }],
    templates: [{ name: 'Card 1', frontHtml: '{{Front}}', backHtml: '{{Back}}' }],
  });
  box = createBox(db, { name: 'B' });
});

describe('notes', () => {
  it('creates a note with values and one card per template', () => {
    const note = createNote(db, {
      noteTypeId: nt.id, boxId: box.id, values: { Front: 'hola', Back: 'hello' },
    });
    expect(note.values).toEqual({ Front: 'hola', Back: 'hello' });
    expect(note.cardIds).toHaveLength(1);
    expect(note.created).toBeTruthy();
  });

  it('lists notes in a box', () => {
    createNote(db, { noteTypeId: nt.id, boxId: box.id, values: { Front: 'a', Back: 'b' } });
    expect(listNotesInBox(db, box.id)).toHaveLength(1);
  });

  it('updates field values and bumps modified', () => {
    const note = createNote(db, { noteTypeId: nt.id, boxId: box.id, values: { Front: 'a', Back: 'b' } });
    const updated = updateNote(db, note.id, { values: { Front: 'A', Back: 'b' } });
    expect(updated.values.Front).toBe('A');
  });

  it('deletes a note and its cards', () => {
    const note = createNote(db, { noteTypeId: nt.id, boxId: box.id, values: { Front: 'a', Back: 'b' } });
    deleteNote(db, note.id);
    expect(getNote(db, note.id)).toBeUndefined();
    expect(db.prepare('SELECT COUNT(*) c FROM card').get().c).toBe(0);
  });

  it('searches across field values case-insensitively', () => {
    createNote(db, { noteTypeId: nt.id, boxId: box.id, values: { Front: 'Gato', Back: 'cat' } });
    createNote(db, { noteTypeId: nt.id, boxId: box.id, values: { Front: 'Perro', Back: 'dog' } });
    expect(searchNotes(db, 'gat')).toHaveLength(1);
    expect(searchNotes(db, 'DOG')).toHaveLength(1);
    expect(searchNotes(db, '')).toHaveLength(2);
  });
});
