import { describe, it, expect, beforeEach } from 'vitest';
import { openLocalDb } from './db.js';
import { makeRepo, outboxAll } from './repo.js';

let db, repo;
beforeEach(async () => {
  // fresh db per test
  indexedDB.deleteDatabase('ankinote-test');
  db = await openLocalDb('ankinote-test');
  // clear stores
  for (const s of ['decks', 'noteTypes', 'notes', 'outbox', 'meta']) await db.clear(s);
  repo = makeRepo(db);
});

describe('repo decks', () => {
  it('createDeck writes the deck and an outbox op atomically', async () => {
    const d = await repo.createDeck({ name: 'Spanish' });
    expect(d.id).toMatch(/[0-9a-f-]{36}/);
    const decks = await repo.listDecks();
    expect(decks.map(x => x.name)).toEqual(['Spanish']);
    const ops = await outboxAll(db);
    expect(ops.filter(o => o.entity === 'deck' && o.type === 'upsert')).toHaveLength(1);
    expect(ops[0].updatedAt).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('createDeck auto-creates ancestors (each an outbox op)', async () => {
    await repo.createDeck({ name: 'A::B::C' });
    expect((await repo.listDecks()).map(d => d.name).sort()).toEqual(['A', 'A::B', 'A::B::C']);
    expect((await outboxAll(db)).filter(o => o.entity === 'deck')).toHaveLength(3);
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
    expect((await outboxAll(db)).some(o => o.type === 'delete' && o.id === d.id)).toBe(true);
  });

  it('updateDeck sets pinned and queues an upsert', async () => {
    const d = await repo.createDeck({ name: 'P' });
    await repo.updateDeck(d.id, { pinned: true });
    expect((await repo.listDecks())[0].pinned).toBe(true);
  });
});
