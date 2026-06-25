import { nowIso } from './clock.js';
import { planCreate, planRename, planDelete } from '../lib/deckOps.js';

const uid = () => crypto.randomUUID();

export async function outboxAll(db) {
  return db.getAll('outbox');
}

export function makeRepo(db) {
  async function liveDecks() {
    return (await db.getAll('decks')).filter(d => !d.deleted);
  }

  const repo = {
    async listDecks() {
      return (await liveDecks())
        .map(d => ({ id: d.id, name: d.name, pinned: !!d.pinned, archived: !!d.archived, updatedAt: d.updatedAt }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async createDeck({ name }) {
      const decks = await liveDecks();
      const { creates } = planCreate(decks, name, uid);
      const ts = nowIso();
      const tx = db.transaction(['decks', 'outbox'], 'readwrite');
      for (const c of creates) {
        const row = { id: c.id, name: c.name, pinned: false, archived: false, deleted: false, updatedAt: ts };
        await tx.objectStore('decks').put(row);
        await tx.objectStore('outbox').add({ entity: 'deck', id: c.id, type: 'upsert', updatedAt: ts, payload: { name: c.name, pinned: false, archived: false } });
      }
      await tx.done;
      const leaf = creates[creates.length - 1];
      return { id: leaf.id, name: leaf.name, pinned: false, archived: false, updatedAt: ts };
    },

    async renameDeck(id, name) {
      const decks = await liveDecks();
      const { creates, renames, merges } = planRename(decks, id, name, uid);
      const ts = nowIso();
      const tx = db.transaction(['decks', 'notes', 'outbox'], 'readwrite');
      const dstore = tx.objectStore('decks');
      const ostore = tx.objectStore('outbox');
      for (const c of creates) {
        await dstore.put({ id: c.id, name: c.name, pinned: false, archived: false, deleted: false, updatedAt: ts });
        await ostore.add({ entity: 'deck', id: c.id, type: 'upsert', updatedAt: ts, payload: { name: c.name, pinned: false, archived: false } });
      }
      for (const m of merges) {
        // re-point notes from the colliding deck to the surviving (renamed) deck
        const notes = (await tx.objectStore('notes').getAll()).filter(n => n.deckId === m.fromId);
        for (const note of notes) {
          note.deckId = m.toId; note.updatedAt = ts;
          await tx.objectStore('notes').put(note);
          await ostore.add({ entity: 'note', id: note.id, type: 'upsert', updatedAt: ts, payload: notePayload(note) });
        }
        const dead = await dstore.get(m.fromId);
        dead.deleted = true; dead.updatedAt = ts;
        await dstore.put(dead);
        await ostore.add({ entity: 'deck', id: m.fromId, type: 'delete', updatedAt: ts });
      }
      for (const r of renames) {
        const row = await dstore.get(r.id);
        row.name = r.name; row.updatedAt = ts;
        await dstore.put(row);
        await ostore.add({ entity: 'deck', id: r.id, type: 'upsert', updatedAt: ts, payload: { name: row.name, pinned: !!row.pinned, archived: !!row.archived } });
      }
      await tx.done;
    },

    async updateDeck(id, patch) {
      const ts = nowIso();
      const tx = db.transaction(['decks', 'outbox'], 'readwrite');
      const row = await tx.objectStore('decks').get(id);
      if (patch.pinned !== undefined) row.pinned = patch.pinned;
      if (patch.archived !== undefined) row.archived = patch.archived;
      row.updatedAt = ts;
      await tx.objectStore('decks').put(row);
      await tx.objectStore('outbox').add({ entity: 'deck', id, type: 'upsert', updatedAt: ts, payload: { name: row.name, pinned: !!row.pinned, archived: !!row.archived } });
      await tx.done;
      return { id, name: row.name, pinned: !!row.pinned, archived: !!row.archived, updatedAt: ts };
    },

    async deleteDeck(id) {
      const decks = await liveDecks();
      const { deletes } = planDelete(decks, id);
      const ts = nowIso();
      const tx = db.transaction(['decks', 'outbox'], 'readwrite');
      for (const did of deletes) {
        const row = await tx.objectStore('decks').get(did);
        row.deleted = true; row.updatedAt = ts;
        await tx.objectStore('decks').put(row);
        await tx.objectStore('outbox').add({ entity: 'deck', id: did, type: 'delete', updatedAt: ts });
      }
      await tx.done;
    },
  };
  return repo;
}

function notePayload(n) {
  return { noteTypeId: n.noteTypeId, deckId: n.deckId, created: n.created, values: n.values };
}
