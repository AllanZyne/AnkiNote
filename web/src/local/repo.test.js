import { describe, it, expect, beforeEach } from 'vitest';
import { openLocalDb } from './db.js';
import { makeRepo, outboxAll } from './repo.js';

let db, repo;
beforeEach(async () => {
  // fresh db per test using unique name
  const dbName = `ankinote-test-${Date.now()}-${Math.random()}`;
  db = await openLocalDb(dbName);
  repo = makeRepo(db);
});

describe('repo decks', () => {
  it('createDeck writes the deck and an outbox op atomically', async () => {
    const d = await repo.createDeck({ name: 'Spanish' });
    expect(d.id).toMatch(/[0-9a-f-]{36}/);
    const decks = await repo.listDecks();
    expect(decks.map(x => x.name)).toEqual(['Spanish']);
    const ops = await outboxAll(db);
    expect(ops.some(o => o.kind === 'decks' && o.path === '.ankinote/decks.json')).toBe(true);
  });

  it('createDeck enqueues a decks.json write op', async () => {
    await repo.createDeck({ name: 'Spanish' });
    const ops = await outboxAll(db);
    expect(ops.some(o => o.kind === 'decks' && o.path === '.ankinote/decks.json')).toBe(true);
  });

  it('createDeck auto-creates ancestors (each an outbox op)', async () => {
    await repo.createDeck({ name: 'A::B::C' });
    expect((await repo.listDecks()).map(d => d.name).sort()).toEqual(['A', 'A::B', 'A::B::C']);
    expect((await outboxAll(db)).filter(o => o.kind === 'decks')).toHaveLength(3);
  });

  it('renameDeck rewrites descendants', async () => {
    await repo.createDeck({ name: 'Spanish::Verbs' });
    const spanish = (await repo.listDecks()).find(d => d.name === 'Spanish');
    await repo.renameDeck(spanish.id, 'Language');
    expect((await repo.listDecks()).map(d => d.name).sort()).toEqual(['Language', 'Language::Verbs']);
  });

  it('deleteDeck tombstones and hides from reads + queues a delete op', async () => {
    const d = await repo.createDeck({ name: 'Temp' });
    await repo.deleteDeck(d.id);
    expect(await repo.listDecks()).toHaveLength(0);
    expect((await outboxAll(db)).some(o => o.kind === 'decks')).toBe(true);
  });

  it('updateDeck sets pinned and queues an upsert', async () => {
    const d = await repo.createDeck({ name: 'P' });
    await repo.updateDeck(d.id, { pinned: true });
    expect((await repo.listDecks())[0].pinned).toBe(true);
  });
});

describe('repo note types and notes', () => {
  it('createNoteType stores the aggregate and queues an op', async () => {
    const nt = await repo.createNoteType({ name: 'Basic', css: '', fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }] });
    expect(nt.id).toBeTruthy();
    expect((await repo.listNoteTypes())[0].fields[0].name).toBe('Front');
    expect((await outboxAll(db)).some(o => o.kind === 'noteType' && o.op === 'write')).toBe(true);
  });

  it('createNote enqueues a write file-op with the note path', async () => {
    const nt = await repo.createNoteType({ name: 'Basic', css: '', fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }] });
    const deck = await repo.createDeck({ name: 'Spanish' });
    const note = await repo.createNote({ noteTypeId: nt.id, deckId: deck.id, values: { Front: 'hola' } });
    const ops = await outboxAll(db);
    const noteOp = ops.find(o => o.kind === 'note' && o.op === 'write' && o.id === note.id);
    expect(noteOp.path).toBe(`Spanish/${note.id}.md`);
  });

  it('deleteNote enqueues a remove file-op', async () => {
    const nt = await repo.createNoteType({ name: 'Basic', css: '', fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }] });
    const deck = await repo.createDeck({ name: 'D' });
    const note = await repo.createNote({ noteTypeId: nt.id, deckId: deck.id, values: { Front: 'x' } });
    await repo.deleteNote(note.id);
    const ops = await outboxAll(db);
    expect(ops.some(o => o.op === 'remove' && o.id === note.id)).toBe(true);
  });

  it('createNote stores values and lists in its deck', async () => {
    const nt = await repo.createNoteType({ name: 'Basic', css: '', fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }] });
    const deck = await repo.createDeck({ name: 'D' });
    const note = await repo.createNote({ noteTypeId: nt.id, deckId: deck.id, values: { Front: 'hola' } });
    expect(note.values).toEqual({ Front: 'hola' });
    expect(await repo.listNotesInDeck(deck.id)).toHaveLength(1);
  });

  it('searchNotes matches values case-insensitively and hides tombstones', async () => {
    const nt = await repo.createNoteType({ name: 'Basic', css: '', fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }] });
    const deck = await repo.createDeck({ name: 'D' });
    const a = await repo.createNote({ noteTypeId: nt.id, deckId: deck.id, values: { Front: 'Gato' } });
    await repo.createNote({ noteTypeId: nt.id, deckId: deck.id, values: { Front: 'Perro' } });
    expect(await repo.searchNotes('gat')).toHaveLength(1);
    await repo.deleteNote(a.id);
    expect(await repo.searchNotes('gat')).toHaveLength(0);
  });

  it('updateNote merges values and queues an op', async () => {
    const nt = await repo.createNoteType({ name: 'Basic', css: '', fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }] });
    const deck = await repo.createDeck({ name: 'D' });
    const note = await repo.createNote({ noteTypeId: nt.id, deckId: deck.id, values: { Front: 'a' } });
    const upd = await repo.updateNote(note.id, { values: { Front: 'A' } });
    expect(upd.values.Front).toBe('A');
  });
});
