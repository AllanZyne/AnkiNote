import { toInstant } from '../local/clock.js';
import { serializeNote, parseNote } from '../vault/note.js';
import { serializeNoteType, parseNoteType } from '../vault/noteType.js';
import { serializeDecks, parseDecks } from '../vault/meta.js';
import { scanVault } from '../vault/scan.js';
import { dirToDeckPath, isAnkinotePath, INDEX_PATH, DECKS_PATH } from '../vault/paths.js';
import { dirname } from '../storage/provider.js';
import { serializeIndex } from '../vault/meta.js';

const NOTE_TYPES_PREFIX = '.ankinote/note-types/';

export function makeVaultSync({ db, provider, intervalMs = 15000 }) {
  const isLocal = !!provider.local;
  let status = { state: isLocal ? 'local' : 'syncing', pending: 0, lastSyncedAt: null };
  const subs = new Set();
  let timer = null, onlineHandler = null, inFlight = false;
  const set = (p) => { status = { ...status, ...p }; for (const cb of subs) cb(status); };
  const pendingCount = async () => (await db.getAll('outbox')).length;

  async function bodyFor(op) {
    if (op.kind === 'note') {
      const note = await db.get('notes', op.id);
      if (!note) return null;
      const deck = await db.get('decks', note.deckId);
      return serializeNote({ id: note.id, noteType: note.noteTypeId, created: note.created, modified: note.updatedAt, fields: note.values });
    }
    if (op.kind === 'noteType') {
      const all = await db.getAll('noteTypes');
      const nt = all.find(t => t.name === op.id && !t.deleted);
      if (!nt) return null;
      return serializeNoteType(nt);
    }
    if (op.kind === 'decks') {
      const decks = (await db.getAll('decks')).filter(d => !d.deleted);
      const map = {};
      for (const d of decks) map[d.name] = { pinned: !!d.pinned, archived: !!d.archived };
      return serializeDecks(map);
    }
    return null;
  }

  async function setFileMeta(path, etag) { await db.put('fileMeta', { path, etag, modified: null }); }
  async function getEtag(path) { const m = await db.get('fileMeta', path); return m?.etag; }

  async function flush() {
    const ops = (await db.getAll('outbox')).sort((a, b) => a.opId - b.opId);
    for (const op of ops) {
      if (op.op === 'remove') {
        await provider.remove(op.path);
        await db.delete('fileMeta', op.path);
      } else if (op.op === 'move') {
        try { await provider.move(op.from, op.path); } catch { /* source may already be gone */ }
        const e = await getEtag(op.from); await db.delete('fileMeta', op.from);
        if (e) await setFileMeta(op.path, e);
      } else { // write
        const body = await bodyFor(op);
        if (body == null) { await db.delete('outbox', op.opId); continue; }
        try {
          const currentEtag = await getEtag(op.path);
          const wopts = provider.capabilities?.supportsConditionalWrite ? { ifMatch: currentEtag } : {};
          const { etag } = await provider.write(op.path, body, wopts);
          await setFileMeta(op.path, etag);
        } catch (e) {
          if (e.code === 'ETAG_MISMATCH') {
            const conflictPath = op.path.replace(/\.md$/, '.conflict.md');
            await provider.write(conflictPath, body);
            const fresh = await provider.read(op.path);
            await setFileMeta(op.path, fresh.etag);
          } else { throw e; }
        }
      }
      await db.delete('outbox', op.opId);
    }
  }

  async function ensureDeckByName(deckName) {
    const allDecks = (await db.getAll('decks')).filter(d => !d.deleted);
    const existing = allDecks.find(d => d.name === deckName);
    if (existing) return existing.id;
    // Create deck record so it appears in listDecks
    const newDeckId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.put('decks', {
      id: newDeckId,
      name: deckName,
      pinned: false,
      archived: false,
      deleted: false,
      updatedAt: now
    });
    return newDeckId;
  }

  async function importFile(path) {
    if (path.endsWith('.conflict.md')) return;                  // opaque, never import
    const { body, etag } = await provider.read(path);
    if (path === DECKS_PATH) {
      // deck state is applied lazily by the UI from decks.json; store in meta
      await db.put('meta', { key: 'decks.json', value: body });
    } else if (path.startsWith(NOTE_TYPES_PREFIX) && path.endsWith('.md')) {
      const nt = parseNoteType(body);
      // Note-type files carry no modtime; refresh in place keyed by name.
      await db.put('noteTypes', { id: nt.name, ...nt, deleted: false, updatedAt: new Date().toISOString() });
    } else if (!isAnkinotePath(path) && path.endsWith('.md')) {
      const n = parseNote(body);
      const local = await db.get('notes', n.id);
      // LWW: only overwrite when the incoming file is strictly newer (no server safety net).
      if (!local || toInstant(n.modified) > toInstant(local.updatedAt)) {
        const deck = dirToDeckPath(dirname(path));
        const deckId = await ensureDeckByName(deck);
        await db.put('notes', { id: n.id, noteTypeId: n.noteType, deckId, deck, created: n.created, values: n.fields, deleted: false, updatedAt: n.modified });
      }
    }
    await setFileMeta(path, etag);
  }

  // Recreate empty decks and restore pinned/archived flags from stored decks.json. Idempotent (match by name).
  async function applyDecksJson() {
    const m = await db.get('meta', 'decks.json');
    const map = parseDecks(m?.value);
    for (const [name, flags] of Object.entries(map)) {
      const id = await ensureDeckByName(name);
      const row = await db.get('decks', id);
      row.pinned = !!flags?.pinned;
      row.archived = !!flags?.archived;
      await db.put('decks', row);
    }
  }

  async function pull() {
    const files = await scanVault(provider);
    for (const f of files) {
      if (f.path === INDEX_PATH) continue;                      // rebuildable, skip
      const known = await getEtag(f.path);
      if (known && f.etag && known === f.etag) continue;        // unchanged
      await importFile(f.path);
    }
    await applyDecksJson();
    // rewrite index.json from the note store
    const notes = await db.getAll('notes');
    const index = { notes: {}, generatedAt: new Date().toISOString() };
    for (const n of notes.filter(x => !x.deleted)) {
      index.notes[n.id] = { path: `${(n.deck ? n.deck.split('::').join('/') + '/' : '')}${n.id}.md`, noteType: n.noteTypeId, deck: n.deck, title: Object.values(n.values || {})[0] || '', etag: await getEtag(`${(n.deck ? n.deck.split('::').join('/') + '/' : '')}${n.id}.md`) || null, modified: n.updatedAt };
    }
    await provider.write(INDEX_PATH, serializeIndex(index));
  }

  const engine = {
    subscribe(cb) { subs.add(cb); cb(status); return () => subs.delete(cb); },
    getStatus() { return status; },
    async syncOnce() {
      if (isLocal) { set({ state: 'local', pending: await pendingCount() }); return; }
      if (inFlight) return;
      inFlight = true;
      set({ state: 'syncing', pending: await pendingCount() });
      try {
        await flush();
        await pull();
        set({ state: 'synced', pending: await pendingCount(), lastSyncedAt: new Date().toISOString() });
      } catch (e) {
        set({ state: e.code === 'HTTP' || e.httpError ? 'error' : 'offline', pending: await pendingCount() });
      } finally { inFlight = false; }
    },
    start() {
      if (timer) return;
      onlineHandler = () => engine.syncOnce();
      timer = setInterval(onlineHandler, intervalMs);
      if (typeof window !== 'undefined') window.addEventListener('online', onlineHandler);
      // No immediate sync here — callers do an explicit initial syncOnce() so its
      // settled state (synced/offline/error) is observable right after connect.
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
      if (onlineHandler && typeof window !== 'undefined') window.removeEventListener('online', onlineHandler);
      onlineHandler = null;
    },
  };
  return engine;
}
