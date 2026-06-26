import { describe, it, expect, beforeEach } from 'vitest';
import { openLocalDb } from '../local/db.js';
import { makeRepo } from '../local/repo.js';
import { makeMemoryProvider } from '../storage/memory.js';
import { makeVaultSync } from './vaultSync.js';

let provider;
beforeEach(() => { provider = makeMemoryProvider(); });

// Fresh IndexedDB + repo + sync on the SAME provider (simulates a second device / clean cache).
async function freshDevice() {
  const db = await openLocalDb(`ankinote-rt-${Date.now()}-${Math.random()}`);
  const repo = makeRepo(db);
  const sync = makeVaultSync({ db, provider });
  return { db, repo, sync };
}

describe('round-trip after wipe (second device)', () => {
  it('note renders after pull: note.noteTypeId matches a note type id', async () => {
    // Device A: create note type + deck + note, then flush.
    const a = await freshDevice();
    const nt = await a.repo.createNoteType({
      name: 'Basic', css: '', fields: [{ name: 'Front' }],
      templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }],
    });
    const deck = await a.repo.createDeck({ name: 'Spanish' });
    const note = await a.repo.createNote({ noteTypeId: nt.id, deckId: deck.id, values: { Front: 'hola' } });
    await a.sync.syncOnce();

    // Device B: fresh DB, pull from the same provider.
    const b = await freshDevice();
    await b.sync.syncOnce();

    const types = await b.repo.listNoteTypes();
    expect(types.some(t => t.name === 'Basic')).toBe(true);

    const decks = await b.repo.listDecks();
    const spanish = decks.find(d => d.name === 'Spanish');
    expect(spanish).toBeDefined();
    const notes = await b.repo.listNotesInDeck(spanish.id);
    const pulled = notes.find(n => n.id === note.id);
    expect(pulled).toBeDefined();

    // The render-critical invariant: noteTypesById[note.noteTypeId] is defined.
    const noteTypesById = Object.fromEntries(types.map(t => [t.id, t]));
    expect(noteTypesById[pulled.noteTypeId]).toBeDefined();
    expect(noteTypesById[pulled.noteTypeId].templates[0]).toBeDefined();
  });

  it('pinned/archived flags and empty decks survive a round-trip', async () => {
    const a = await freshDevice();
    const pinned = await a.repo.createDeck({ name: 'Pinned' });
    await a.repo.updateDeck(pinned.id, { pinned: true });
    await a.repo.createDeck({ name: 'EmptyDeck' }); // empty, no notes
    await a.sync.syncOnce();

    const b = await freshDevice();
    await b.sync.syncOnce();

    const decks = await b.repo.listDecks();
    const p = decks.find(d => d.name === 'Pinned');
    const empty = decks.find(d => d.name === 'EmptyDeck');
    expect(p).toBeDefined();
    expect(p.pinned).toBe(true);
    expect(empty).toBeDefined();
  });

  it('pull does not clobber a strictly-newer local note with an older incoming file', async () => {
    const a = await freshDevice();
    const nt = await a.repo.createNoteType({
      name: 'Basic', css: '', fields: [{ name: 'Front' }],
      templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }],
    });
    const deck = await a.repo.createDeck({ name: 'D' });
    const note = await a.repo.createNote({ noteTypeId: nt.id, deckId: deck.id, values: { Front: 'old' } });
    await a.sync.syncOnce();
    const path = `D/${note.id}.md`;

    // Device B pulls everything fresh.
    const b = await freshDevice();
    await b.sync.syncOnce();

    // Local edit on B that is strictly NEWER than the file on the provider.
    await b.repo.updateNote(note.id, { values: { Front: 'newer-local' } });
    const local = await b.db.get('notes', note.id);
    // Drop the just-enqueued write so pull is what acts (simulate read-before-flush race).
    for (const o of await b.db.getAll('outbox')) await b.db.delete('outbox', o.opId);
    // Force re-import by clearing the cached etag for this path.
    await b.db.delete('fileMeta', path);

    await b.sync.syncOnce(); // pull sees the older provider file

    const after = await b.db.get('notes', note.id);
    expect(after.values.Front).toBe('newer-local'); // not clobbered
    expect(after.updatedAt).toBe(local.updatedAt);
  });
});
