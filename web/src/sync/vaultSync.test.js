import { describe, it, expect, beforeEach } from 'vitest';
import { openLocalDb } from '../local/db.js';
import { makeRepo } from '../local/repo.js';
import { makeMemoryProvider } from '../storage/memory.js';
import { makeVaultSync } from './vaultSync.js';
import { parseNote } from '../vault/note.js';

let db, repo, provider, sync;
beforeEach(async () => {
  const dbName = `ankinote-vsync-${Date.now()}-${Math.random()}`;
  db = await openLocalDb(dbName);
  repo = makeRepo(db);
  provider = makeMemoryProvider({}, { local: false });
  sync = makeVaultSync({ db, provider });
});

describe('vault sync', () => {
  it('flush writes a created note to the provider as markdown', async () => {
    const nt = await repo.createNoteType({ name: 'Basic', css: '', fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }] });
    const deck = await repo.createDeck({ name: 'Spanish' });
    const note = await repo.createNote({ noteTypeId: nt.id, deckId: deck.id, values: { Front: 'hola' } });
    await sync.syncOnce();
    const { body } = await provider.read(`Spanish/${note.id}.md`);
    expect(parseNote(body).fields.Front).toBe('hola');
    expect((await db.getAll('outbox')).length).toBe(0); // drained
    expect(sync.getStatus().state).toBe('synced');
  });

  it('pull imports an externally-added note file into IndexedDB', async () => {
    // pre-seed a note + its note-type + decks on the provider directly
    await provider.write('.ankinote/note-types/Basic.md',
      '---\nname: Basic\nfields:\n  - Front\n---\n\n## Front\n\n```html\n{{Front}}\n```\n\n## Back\n\n```html\n\n```\n\n## CSS\n\n```css\n\n```\n');
    await provider.write('Spanish/ext1.md',
      '---\nid: ext1\nnoteType: Basic\ncreated: 2026-06-26T10:00:00.000+08:00\nmodified: 2026-06-26T10:00:00.000+08:00\n---\n\n<!-- field: Front -->\nhola-ext\n');
    await sync.syncOnce();
    const note = await db.get('notes', 'ext1');
    expect(note.values.Front).toBe('hola-ext');
    expect(note.deck).toBe('Spanish');
  });

  it('conflict on flush writes a .conflict.md sidecar and does not lose data', async () => {
    const nt = await repo.createNoteType({ name: 'Basic', css: '', fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }] });
    const deck = await repo.createDeck({ name: 'D' });
    const note = await repo.createNote({ noteTypeId: nt.id, deckId: deck.id, values: { Front: 'mine' } });
    await sync.syncOnce(); // first write establishes fileMeta etag
    // external change bumps the server etag out from under us
    const notePath = `D/${note.id}.md`;
    await provider.write(notePath, 'EXTERNAL');
    await repo.updateNote(note.id, { values: { Front: 'mine2' } });
    await sync.syncOnce();
    const conflictPath = `D/${note.id}.conflict.md`;
    expect(await provider.exists(conflictPath)).toBe(true);
  });

  it('offline (provider throws) keeps the outbox and marks offline', async () => {
    const nt = await repo.createNoteType({ name: 'Basic', css: '', fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }] });
    const deck = await repo.createDeck({ name: 'D' });
    await repo.createNote({ noteTypeId: nt.id, deckId: deck.id, values: { Front: 'x' } });
    const throwing = { ...makeMemoryProvider({}, { local: false }), write: async () => { throw new Error('network'); }, list: async () => { throw new Error('network'); } };
    const s2 = makeVaultSync({ db, provider: throwing });
    await s2.syncOnce();
    expect(s2.getStatus().state).toBe('offline');
    expect((await db.getAll('outbox')).length).toBeGreaterThan(0);
  });

  it('pull imports note into deck record by folder path and listNotesInDeck finds it', async () => {
    // Pre-seed note-type + note in Spanish/ folder
    await provider.write('.ankinote/note-types/Basic.md',
      '---\nname: Basic\nfields:\n  - Front\n---\n\n## Front\n\n```html\n{{Front}}\n```\n\n## Back\n\n```html\n\n```\n\n## CSS\n\n```css\n\n```\n');
    await provider.write('Spanish/ext2.md',
      '---\nid: ext2\nnoteType: Basic\ncreated: 2026-06-26T11:00:00.000+08:00\nmodified: 2026-06-26T11:00:00.000+08:00\n---\n\n<!-- field: Front -->\nhola-deck\n');
    await sync.syncOnce();
    const note = await db.get('notes', 'ext2');
    expect(note.values.Front).toBe('hola-deck');
    expect(note.deck).toBe('Spanish');
    // Verify deckId resolves to a real deck record
    const decks = await repo.listDecks();
    const spanishDeck = decks.find(d => d.name === 'Spanish');
    expect(spanishDeck).toBeDefined();
    expect(note.deckId).toBe(spanishDeck.id);
    // Verify listNotesInDeck finds the imported note
    const notesInDeck = await repo.listNotesInDeck(spanishDeck.id);
    expect(notesInDeck.some(n => n.id === 'ext2')).toBe(true);
  });

  it('stays in local state and does no network when the provider is local', async () => {
    const localProvider = makeMemoryProvider(); // local: true
    const calls = [];
    ['list', 'read', 'write'].forEach(m => {
      const orig = localProvider[m];
      localProvider[m] = (...a) => { calls.push(m); return orig.apply(localProvider, a); };
    });
    const s = makeVaultSync({ db, provider: localProvider });
    expect(s.getStatus().state).toBe('local');
    await s.syncOnce();
    expect(s.getStatus().state).toBe('local');
    expect(calls).toEqual([]); // no push/pull attempted
  });
});
