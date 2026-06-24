import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../connection.js';
import { createDeck, listDecks, renameDeck } from '../decks.js';
import { createNoteType } from '../noteTypes.js';
import { createNote, listNotesInDeck } from '../notes.js';

let db, ntId;
beforeEach(() => {
  db = openDb(':memory:');
  ntId = createNoteType(db, {
    name: 'Basic', css: '',
    fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }],
  }).id;
});

const names = () => listDecks(db).map(d => d.name).sort();

describe('renameDeck', () => {
  it('rewrites descendants by prefix when a parent is renamed', () => {
    createDeck(db, { name: 'Spanish::Verbs' });
    const spanish = listDecks(db).find(d => d.name === 'Spanish');
    renameDeck(db, spanish.id, 'Language');
    expect(names()).toEqual(['Language', 'Language::Verbs']);
  });

  it('auto-creates intermediates when moving a deck deeper', () => {
    const verbs = createDeck(db, { name: 'Verbs' });
    renameDeck(db, verbs.id, 'Grammar::Verbs');
    expect(names()).toEqual(['Grammar', 'Grammar::Verbs']);
  });

  it('keeps notes with their deck across a rename (stable id)', () => {
    const d = createDeck(db, { name: 'Spanish' });
    createNote(db, { noteTypeId: ntId, deckId: d.id, values: { Front: 'hola' } });
    renameDeck(db, d.id, 'Language');
    expect(listNotesInDeck(db, d.id)).toHaveLength(1);
  });

  it('merges into the renamed survivor when the target name exists', () => {
    const a = createDeck(db, { name: 'A' });
    const b = createDeck(db, { name: 'B' });
    createNote(db, { noteTypeId: ntId, deckId: b.id, values: { Front: 'fromB' } });
    createNote(db, { noteTypeId: ntId, deckId: a.id, values: { Front: 'fromA' } });
    renameDeck(db, a.id, 'B'); // A -> B, collides with existing B => merge into A (survivor)
    expect(names()).toEqual(['B']);
    expect(listNotesInDeck(db, a.id)).toHaveLength(2); // both notes now under survivor (a.id, now named B)
    expect(listDecks(db).find(d => d.name === 'B').id).toBe(a.id);
  });

  it('rejects moving a deck into its own subtree', () => {
    const a = createDeck(db, { name: 'A' });
    expect(() => renameDeck(db, a.id, 'A::B')).toThrow('cannot move into own subtree');
  });

  it('rejects an invalid new name', () => {
    const a = createDeck(db, { name: 'A' });
    expect(() => renameDeck(db, a.id, 'A::')).toThrow('invalid deck name');
  });

  it('renameDeck escapes LIKE wildcards', () => {
    createDeck(db, { name: 'A_b' });
    createDeck(db, { name: 'A_b::child' });
    createDeck(db, { name: 'AQb::x' });
    const ab = listDecks(db).find(d => d.name === 'A_b');
    renameDeck(db, ab.id, 'Z');
    expect(names()).toEqual(['AQb', 'AQb::x', 'Z', 'Z::child']);
  });
});
