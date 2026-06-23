import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../connection.js';
import {
  createNoteType, getNoteType, listNoteTypes, updateNoteType, deleteNoteType
} from '../noteTypes.js';
import { createBox } from '../boxes.js';
import { createNote, getNote, updateNote } from '../notes.js';

let db;
beforeEach(() => { db = openDb(':memory:'); });

const basic = {
  name: 'Basic',
  css: '.card { font-size: 20px; }',
  fields: [{ name: 'Front' }, { name: 'Back' }],
  templates: [{ name: 'Card 1', frontHtml: '{{Front}}', backHtml: '{{Front}}<hr>{{Back}}' }],
};

describe('note types', () => {
  it('creates and reads back a full note type', () => {
    const nt = createNoteType(db, basic);
    const got = getNoteType(db, nt.id);
    expect(got.name).toBe('Basic');
    expect(got.css).toBe('.card { font-size: 20px; }');
    expect(got.fields.map(f => f.name)).toEqual(['Front', 'Back']);
    expect(got.fields.map(f => f.ord)).toEqual([0, 1]);
    expect(got.templates[0].frontHtml).toBe('{{Front}}');
  });

  it('lists note types', () => {
    createNoteType(db, basic);
    expect(listNoteTypes(db)).toHaveLength(1);
  });

  it('updates fields and templates wholesale', () => {
    const nt = createNoteType(db, basic);
    const updated = updateNoteType(db, nt.id, {
      name: 'Basic+', css: '',
      fields: [{ name: 'Term' }, { name: 'Def' }, { name: 'Note' }],
      templates: [{ name: 'Card 1', frontHtml: '{{Term}}', backHtml: '{{Def}}' }],
    });
    expect(updated.name).toBe('Basic+');
    expect(updated.fields.map(f => f.name)).toEqual(['Term', 'Def', 'Note']);
  });

  it('refuses to delete a note type in use', () => {
    const nt = createNoteType(db, basic);
    const box = createBox(db, { name: 'B' });
    createNote(db, { noteTypeId: nt.id, boxId: box.id, values: { Front: 'a', Back: 'b' } });
    expect(() => deleteNoteType(db, nt.id)).toThrow('note type in use');
  });

  it('deletes an unused note type', () => {
    const nt = createNoteType(db, basic);
    deleteNoteType(db, nt.id);
    expect(getNoteType(db, nt.id)).toBeUndefined();
  });

  it('preserves note field values when updating note type css only', () => {
    const nt = createNoteType(db, basic);
    const box = createBox(db, { name: 'B' });
    const note = createNote(db, { noteTypeId: nt.id, boxId: box.id, values: { Front: 'hola', Back: 'hello' } });
    const originalCardCount = note.cardIds.length;

    updateNoteType(db, nt.id, {
      name: 'Basic',
      css: '.card{color:red}',
      fields: [{ name: 'Front' }, { name: 'Back' }],
      templates: [{ name: 'Card 1', frontHtml: '{{Front}}', backHtml: '{{Front}}<hr>{{Back}}' }]
    });

    const updated = getNote(db, note.id);
    expect(updated.values).toEqual({ Front: 'hola', Back: 'hello' });
    expect(updated.cardIds.length).toBe(originalCardCount);
  });

  it('adds empty field value for new field on existing notes', () => {
    const nt = createNoteType(db, basic);
    const box = createBox(db, { name: 'B' });
    const note = createNote(db, { noteTypeId: nt.id, boxId: box.id, values: { Front: 'hola', Back: 'hello' } });

    updateNoteType(db, nt.id, {
      name: 'Basic',
      css: '',
      fields: [{ name: 'Front' }, { name: 'Back' }, { name: 'Extra' }],
      templates: [{ name: 'Card 1', frontHtml: '{{Front}}', backHtml: '{{Back}}' }]
    });

    const updated = getNote(db, note.id);
    expect(updated.values).toEqual({ Front: 'hola', Back: 'hello', Extra: '' });

    updateNote(db, note.id, { values: { Front: 'hola', Back: 'hello', Extra: 'extra content' } });
    expect(getNote(db, note.id).values.Extra).toBe('extra content');
  });

  it('removes field value when field is deleted but preserves others', () => {
    const nt = createNoteType(db, basic);
    const box = createBox(db, { name: 'B' });
    const note = createNote(db, { noteTypeId: nt.id, boxId: box.id, values: { Front: 'hola', Back: 'hello' } });

    updateNoteType(db, nt.id, {
      name: 'Basic',
      css: '',
      fields: [{ name: 'Front' }],
      templates: [{ name: 'Card 1', frontHtml: '{{Front}}', backHtml: '' }]
    });

    const updated = getNote(db, note.id);
    expect(updated.values).toEqual({ Front: 'hola' });
    expect(updated.values.Back).toBeUndefined();
  });
});
