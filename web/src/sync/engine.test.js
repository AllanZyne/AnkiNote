import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openLocalDb } from '../local/db.js';
import { makeRepo } from '../local/repo.js';
import { makeSyncEngine } from './engine.js';

let db, repo;
beforeEach(async () => {
  const dbName = `ankinote-sync-test-${Date.now()}-${Math.random()}`;
  db = await openLocalDb(dbName);
  repo = makeRepo(db);
});

describe('sync engine', () => {
  it('pushes queued ops then clears the outbox; status becomes synced', async () => {
    await repo.createDeck({ name: 'Spanish' });
    const fetchFn = vi.fn(async (url) => ({
      ok: true,
      json: async () => url.includes('/push')
        ? { applied: [] }
        : { decks: [], noteTypes: [], notes: [], serverTime: '2026-06-25T10:00:00.000+00:00' },
    }));
    const engine = makeSyncEngine({ db, fetchFn });
    await engine.syncOnce();
    expect(fetchFn.mock.calls.some(c => c[0].includes('/api/sync/push'))).toBe(true);
    expect(await db.getAll('outbox')).toHaveLength(0);
    expect(engine.getStatus().state).toBe('synced');
  });

  it('pull applies an incoming deck by LWW', async () => {
    const fetchFn = vi.fn(async (url) => ({
      ok: true,
      json: async () => url.includes('/push')
        ? { applied: [] }
        : { decks: [{ id: 'srv1', name: 'FromServer', pinned: false, archived: false, deleted: false, updatedAt: '2026-06-25T10:00:00.000+00:00' }], noteTypes: [], notes: [], serverTime: '2026-06-25T11:00:00.000+00:00' },
    }));
    const engine = makeSyncEngine({ db, fetchFn });
    await engine.syncOnce();
    expect((await repo.listDecks()).find(d => d.id === 'srv1').name).toBe('FromServer');
  });

  it('older incoming does not overwrite newer local (LWW)', async () => {
    const d = await repo.createDeck({ name: 'Local' });
    // local updatedAt is "now" (future vs the 2020 server payload)
    const fetchFn = vi.fn(async (url) => ({
      ok: true,
      json: async () => url.includes('/push')
        ? { applied: [] }
        : { decks: [{ id: d.id, name: 'OldName', pinned: false, archived: false, deleted: false, updatedAt: '2020-01-01T00:00:00.000+00:00' }], noteTypes: [], notes: [], serverTime: '2026-06-25T11:00:00.000+00:00' },
    }));
    const engine = makeSyncEngine({ db, fetchFn });
    await engine.syncOnce();
    expect((await repo.listDecks()).find(x => x.id === d.id).name).toBe('Local');
  });

  it('network failure sets state offline', async () => {
    await repo.createDeck({ name: 'X' });
    const fetchFn = vi.fn(async () => { throw new Error('network down'); });
    const engine = makeSyncEngine({ db, fetchFn });
    await engine.syncOnce();
    expect(engine.getStatus().state).toBe('offline');
    expect(await db.getAll('outbox')).toHaveLength(1); // not lost
  });
});
