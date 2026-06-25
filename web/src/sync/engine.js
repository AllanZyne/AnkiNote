import { toInstant } from '../local/clock.js';

export function makeSyncEngine({ db, fetchFn = fetch, intervalMs = 15000 }) {
  let status = { state: 'synced', pending: 0, lastSyncedAt: null };
  const subs = new Set();
  let timer = null;
  let onlineHandler = null;
  let inFlight = false;

  function set(partial) {
    status = { ...status, ...partial };
    for (const cb of subs) cb(status);
  }

  async function pendingCount() {
    return (await db.getAll('outbox')).length;
  }

  async function applyAggregate(store, rec) {
    const local = await db.get(store, rec.id);
    if (local && !(toInstant(rec.updatedAt) > toInstant(local.updatedAt))) return;
    await db.put(store, rec);
  }

  async function push() {
    const ops = (await db.getAll('outbox')).sort((a, b) => a.opId - b.opId);
    if (ops.length === 0) return;
    const res = await fetchFn('/api/sync/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops: ops.map(({ opId, ...o }) => o) }),
    });
    if (!res.ok) throw Object.assign(new Error('push failed'), { httpError: true });
    const tx = db.transaction('outbox', 'readwrite');
    for (const o of ops) await tx.objectStore('outbox').delete(o.opId);
    await tx.done;
  }

  async function pull() {
    const meta = await db.get('meta', 'sync');
    const since = meta?.lastSyncedAt;
    const url = since ? `/api/sync/pull?since=${encodeURIComponent(since)}` : '/api/sync/pull';
    const res = await fetchFn(url);
    if (!res.ok) throw Object.assign(new Error('pull failed'), { httpError: true });
    const data = await res.json();
    for (const d of data.decks || []) await applyAggregate('decks', d);
    for (const nt of data.noteTypes || []) await applyAggregate('noteTypes', nt);
    for (const n of data.notes || []) await applyAggregate('notes', n);
    await db.put('meta', { key: 'sync', lastSyncedAt: data.serverTime });
    return data.serverTime;
  }

  const engine = {
    subscribe(cb) { subs.add(cb); cb(status); return () => subs.delete(cb); },
    getStatus() { return status; },
    async syncOnce() {
      if (inFlight) return;            // skip overlapping runs from interval/online triggers
      inFlight = true;
      set({ state: 'syncing', pending: await pendingCount() });
      try {
        await push();
        const serverTime = await pull();
        set({ state: 'synced', pending: await pendingCount(), lastSyncedAt: serverTime });
      } catch (e) {
        set({ state: e.httpError ? 'error' : 'offline', pending: await pendingCount() });
      } finally {
        inFlight = false;
      }
    },
    start() {
      if (timer) return;
      onlineHandler = () => engine.syncOnce();
      timer = setInterval(onlineHandler, intervalMs);
      if (typeof window !== 'undefined') window.addEventListener('online', onlineHandler);
      onlineHandler();
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
      if (onlineHandler && typeof window !== 'undefined') window.removeEventListener('online', onlineHandler);
      onlineHandler = null;
    },
  };
  return engine;
}
