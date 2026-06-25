import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../connection.js';
import { newId, nowIso } from '../ids.js';
import { pushOps, pullSince } from '../sync.js';
import { listDecks, createDeck } from '../decks.js';

let db;
beforeEach(() => { db = openDb(':memory:'); });

describe('sync', () => {
  it('push upserts a deck and pull returns it after a cursor', () => {
    const id = newId();
    const t1 = '2026-06-25T10:00:00.000+00:00';
    pushOps(db, [{ entity: 'deck', id, type: 'upsert', updatedAt: t1, payload: { name: 'Spanish', pinned: false, archived: false } }]);
    expect(listDecks(db).find(d => d.id === id)).toBeTruthy();
    const pulled = pullSince(db, '2026-06-25T09:00:00.000+00:00');
    expect(pulled.decks.find(d => d.id === id)).toBeTruthy();
    const none = pullSince(db, '2026-06-25T11:00:00.000+00:00');
    expect(none.decks.find(d => d.id === id)).toBeFalsy();
  });

  it('applies LWW: a strictly-later updatedAt wins; earlier is ignored', () => {
    const id = newId();
    pushOps(db, [{ entity: 'deck', id, type: 'upsert', updatedAt: '2026-06-25T10:00:00.000+00:00', payload: { name: 'A', pinned: false, archived: false } }]);
    pushOps(db, [{ entity: 'deck', id, type: 'upsert', updatedAt: '2026-06-25T09:00:00.000+00:00', payload: { name: 'OLD', pinned: false, archived: false } }]);
    expect(listDecks(db).find(d => d.id === id).name).toBe('A'); // earlier ignored
    pushOps(db, [{ entity: 'deck', id, type: 'upsert', updatedAt: '2026-06-25T11:00:00.000+00:00', payload: { name: 'NEW', pinned: true, archived: false } }]);
    expect(listDecks(db).find(d => d.id === id).name).toBe('NEW'); // later wins
  });

  it('push delete tombstones and pull includes the tombstone', () => {
    const id = newId();
    pushOps(db, [{ entity: 'deck', id, type: 'upsert', updatedAt: '2026-06-25T10:00:00.000+00:00', payload: { name: 'Z', pinned: false, archived: false } }]);
    pushOps(db, [{ entity: 'deck', id, type: 'delete', updatedAt: '2026-06-25T11:00:00.000+00:00' }]);
    expect(listDecks(db).find(d => d.id === id)).toBeFalsy(); // hidden from reads
    const pulled = pullSince(db, '2026-06-25T09:00:00.000+00:00');
    const tomb = pulled.decks.find(d => d.id === id);
    expect(tomb.deleted).toBe(true);
  });

  it('round-trips a note aggregate with values', () => {
    const ntId = newId(), deckId = newId(), noteId = newId();
    const t = nowIso();
    pushOps(db, [
      { entity: 'note_type', id: ntId, type: 'upsert', updatedAt: t, payload: { name: 'Basic', css: '', fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }] } },
      { entity: 'deck', id: deckId, type: 'upsert', updatedAt: t, payload: { name: 'D', pinned: false, archived: false } },
      { entity: 'note', id: noteId, type: 'upsert', updatedAt: t, payload: { noteTypeId: ntId, deckId, created: t, values: { Front: 'hola' } } },
    ]);
    const pulled = pullSince(db, null);
    const note = pulled.notes.find(n => n.id === noteId);
    expect(note.values).toEqual({ Front: 'hola' });
  });

  // Bug 1 regression test: note_type re-push preserves note values
  it('note_type re-push preserves existing note values', () => {
    const ntId = newId(), deckId = newId(), noteId = newId();
    const t1 = '2026-06-25T10:00:00.000+00:00';
    pushOps(db, [
      { entity: 'note_type', id: ntId, type: 'upsert', updatedAt: t1, payload: { name: 'Basic', css: '', fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }] } },
      { entity: 'deck', id: deckId, type: 'upsert', updatedAt: t1, payload: { name: 'D', pinned: false, archived: false } },
      { entity: 'note', id: noteId, type: 'upsert', updatedAt: t1, payload: { noteTypeId: ntId, deckId, created: t1, values: { Front: 'hola' } } },
    ]);
    const t2 = '2026-06-25T11:00:00.000+00:00';
    pushOps(db, [
      { entity: 'note_type', id: ntId, type: 'upsert', updatedAt: t2, payload: { name: 'Basic', css: 'body { color: red; }', fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }] } }
    ]);
    const note = pullSince(db, null).notes.find(n => n.id === noteId);
    expect(note.values).toEqual({ Front: 'hola' });
  });

  it('adding field via note_type re-push backfills empty value for existing notes', () => {
    const ntId = newId(), deckId = newId(), noteId = newId();
    const t1 = '2026-06-25T10:00:00.000+00:00';
    pushOps(db, [
      { entity: 'note_type', id: ntId, type: 'upsert', updatedAt: t1, payload: { name: 'Basic', css: '', fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }] } },
      { entity: 'deck', id: deckId, type: 'upsert', updatedAt: t1, payload: { name: 'D', pinned: false, archived: false } },
      { entity: 'note', id: noteId, type: 'upsert', updatedAt: t1, payload: { noteTypeId: ntId, deckId, created: t1, values: { Front: 'hola' } } },
    ]);
    const t2 = '2026-06-25T11:00:00.000+00:00';
    pushOps(db, [
      { entity: 'note_type', id: ntId, type: 'upsert', updatedAt: t2, payload: { name: 'Basic', css: '', fields: [{ name: 'Front' }, { name: 'Back' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '{{Back}}' }] } }
    ]);
    const note = pullSince(db, null).notes.find(n => n.id === noteId);
    expect(note.values).toEqual({ Front: 'hola', Back: '' });
  });

  // Bug 2 regression test: delete unknown note doesn't throw
  it('delete of unknown note id does not throw', () => {
    const unknownId = newId();
    expect(() => {
      pushOps(db, [
        { entity: 'note', id: unknownId, type: 'delete', updatedAt: '2026-06-25T10:00:00.000+00:00' }
      ]);
    }).not.toThrow();
  });

  // Bug 3 regression test: two unknown deck deletes don't throw
  it('two unknown deck deletes in one batch do not throw', () => {
    expect(() => {
      pushOps(db, [
        { entity: 'deck', id: newId(), type: 'delete', updatedAt: '2026-06-25T10:00:00.000+00:00' },
        { entity: 'deck', id: newId(), type: 'delete', updatedAt: '2026-06-25T10:01:00.000+00:00' }
      ]);
    }).not.toThrow();
  });

  // Bug 4 regression test: sync delete of a deck frees its UNIQUE name for recreation
  it('sync delete frees deck name so it can be recreated', () => {
    const id = newId();
    pushOps(db, [{ entity: 'deck', id, type: 'upsert', updatedAt: '2026-06-25T10:00:00.000+00:00', payload: { name: 'Spanish', pinned: false, archived: false } }]);
    pushOps(db, [{ entity: 'deck', id, type: 'delete', updatedAt: '2026-06-25T11:00:00.000+00:00' }]);
    expect(() => createDeck(db, { name: 'Spanish' })).not.toThrow();
    const decks = listDecks(db);
    expect(decks.filter(d => d.name === 'Spanish')).toHaveLength(1);
  });

  it('sync-deleted deck tombstone still appears in pullSince', () => {
    const id = newId();
    const t1 = '2026-06-25T10:00:00.000+00:00';
    const t2 = '2026-06-25T11:00:00.000+00:00';
    pushOps(db, [{ entity: 'deck', id, type: 'upsert', updatedAt: t1, payload: { name: 'Spanish', pinned: false, archived: false } }]);
    pushOps(db, [{ entity: 'deck', id, type: 'delete', updatedAt: t2 }]);
    const pulled = pullSince(db, '2026-06-25T09:00:00.000+00:00');
    const tomb = pulled.decks.find(d => d.id === id);
    expect(tomb).toBeTruthy();
    expect(tomb.deleted).toBe(true);
  });
});
