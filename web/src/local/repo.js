import { nowIso } from './clock.js';
import { planCreate, planRename, planDelete } from '../lib/deckOps.js';
import { noteFilePath, noteTypePath, DECKS_PATH } from '../vault/paths.js';

const uid = () => crypto.randomUUID();
const enqueueDecks = (store, at) => store.add({ op: 'write', kind: 'decks', path: DECKS_PATH, at });

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
        await enqueueDecks(tx.objectStore('outbox'), ts);
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
        await enqueueDecks(ostore, ts);
      }
      for (const m of merges) {
        const fromDeck = await dstore.get(m.fromId);
        const toDeck = await dstore.get(m.toId);
        const notes = (await tx.objectStore('notes').getAll()).filter(n => n.deckId === m.fromId);
        for (const note of notes) {
          const from = noteFilePath(fromDeck.name, note.id);
          note.deckId = m.toId; note.updatedAt = ts;
          await tx.objectStore('notes').put(note);
          const path = noteFilePath(toDeck.name, note.id);
          await ostore.add({ op: 'move', kind: 'note', id: note.id, from, path, at: ts });
        }
        const dead = await dstore.get(m.fromId);
        dead.deleted = true; dead.updatedAt = ts;
        await dstore.put(dead);
        await enqueueDecks(ostore, ts);
      }
      for (const r of renames) {
        const row = await dstore.get(r.id);
        const oldName = row.name;
        row.name = r.name; row.updatedAt = ts;
        await dstore.put(row);
        await enqueueDecks(ostore, ts);
        // if deck name changed, emit move ops for notes in this deck
        if (oldName !== r.name) {
          const notes = (await tx.objectStore('notes').getAll()).filter(n => n.deckId === r.id && !n.deleted);
          for (const note of notes) {
            const from = noteFilePath(oldName, note.id);
            const path = noteFilePath(r.name, note.id);
            await ostore.add({ op: 'move', kind: 'note', id: note.id, from, path, at: ts });
          }
        }
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
      await enqueueDecks(tx.objectStore('outbox'), ts);
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
        await enqueueDecks(tx.objectStore('outbox'), ts);
      }
      await tx.done;
    },

    // --- note types ---
    async listNoteTypes() {
      return (await db.getAll('noteTypes')).filter(n => !n.deleted)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async getNoteType(id) {
      const nt = await db.get('noteTypes', id);
      return nt && !nt.deleted ? nt : undefined;
    },
    async createNoteType({ name, css = '', fields, templates }) {
      const ts = nowIso();
      const id = uid();
      const nt = {
        id, name, css, deleted: false, updatedAt: ts,
        fields: fields.map((f, i) => ({ name: f.name, ord: i })),
        templates: templates.map((t, i) => ({ name: t.name, frontHtml: t.frontHtml ?? '', backHtml: t.backHtml ?? '', ord: i })),
      };
      const tx = db.transaction(['noteTypes', 'outbox'], 'readwrite');
      await tx.objectStore('noteTypes').put(nt);
      await tx.objectStore('outbox').add({ op: 'write', kind: 'noteType', id: name, path: noteTypePath(name), at: ts });
      await tx.done;
      return nt;
    },
    async updateNoteType(id, { name, css = '', fields, templates }) {
      const ts = nowIso();
      const tx = db.transaction(['noteTypes', 'outbox'], 'readwrite');
      const nt = await tx.objectStore('noteTypes').get(id);
      nt.name = name; nt.css = css; nt.updatedAt = ts;
      nt.fields = fields.map((f, i) => ({ name: f.name, ord: i }));
      nt.templates = templates.map((t, i) => ({ name: t.name, frontHtml: t.frontHtml ?? '', backHtml: t.backHtml ?? '', ord: i }));
      await tx.objectStore('noteTypes').put(nt);
      await tx.objectStore('outbox').add({ op: 'write', kind: 'noteType', id: name, path: noteTypePath(name), at: ts });
      await tx.done;
      return nt;
    },
    async deleteNoteType(id) {
      const ts = nowIso();
      const tx = db.transaction(['noteTypes', 'outbox'], 'readwrite');
      const nt = await tx.objectStore('noteTypes').get(id);
      nt.deleted = true; nt.updatedAt = ts;
      await tx.objectStore('noteTypes').put(nt);
      await tx.objectStore('outbox').add({ op: 'remove', kind: 'noteType', id: nt.name, path: noteTypePath(nt.name), at: ts });
      await tx.done;
    },

    // --- notes ---
    async getNote(id) {
      const n = await db.get('notes', id);
      return n && !n.deleted ? n : undefined;
    },
    async listNotesInDeck(deckId) {
      return (await db.getAll('notes')).filter(n => !n.deleted && n.deckId === deckId)
        .sort((a, b) => (a.created < b.created ? 1 : -1));
    },
    async searchNotes(q) {
      const query = (q ?? '').trim().toLowerCase();
      const live = (await db.getAll('notes')).filter(n => !n.deleted);
      const rows = !query ? live
        : live.filter(n => Object.values(n.values || {}).some(v => String(v).toLowerCase().includes(query)));
      return rows.sort((a, b) => (a.created < b.created ? 1 : -1));
    },
    async createNote({ noteTypeId, deckId, values }) {
      const ts = nowIso();
      const id = uid();
      const note = { id, noteTypeId, deckId, created: ts, values: { ...values }, deleted: false, updatedAt: ts };
      const tx = db.transaction(['decks', 'notes', 'outbox'], 'readwrite');
      await tx.objectStore('notes').put(note);
      const deck = await tx.objectStore('decks').get(deckId);
      const path = noteFilePath(deck.name, id);
      await tx.objectStore('outbox').add({ op: 'write', kind: 'note', id, path, at: ts });
      await tx.done;
      return note;
    },
    async updateNote(id, { deckId, values }) {
      const ts = nowIso();
      const tx = db.transaction(['decks', 'notes', 'outbox'], 'readwrite');
      const note = await tx.objectStore('notes').get(id);
      const oldDeckId = note.deckId;
      if (deckId != null) note.deckId = deckId;
      if (values) note.values = { ...note.values, ...values };
      note.updatedAt = ts;
      await tx.objectStore('notes').put(note);
      const deck = await tx.objectStore('decks').get(note.deckId);
      const path = noteFilePath(deck.name, id);
      if (deckId != null && deckId !== oldDeckId) {
        const oldDeck = await tx.objectStore('decks').get(oldDeckId);
        const from = noteFilePath(oldDeck.name, id);
        await tx.objectStore('outbox').add({ op: 'move', kind: 'note', id, from, path, at: ts });
      } else {
        await tx.objectStore('outbox').add({ op: 'write', kind: 'note', id, path, at: ts });
      }
      await tx.done;
      return note;
    },
    async deleteNote(id) {
      const ts = nowIso();
      const tx = db.transaction(['decks', 'notes', 'outbox'], 'readwrite');
      const note = await tx.objectStore('notes').get(id);
      const deck = await tx.objectStore('decks').get(note.deckId);
      const path = noteFilePath(deck.name, id);
      note.deleted = true; note.updatedAt = ts;
      await tx.objectStore('notes').put(note);
      await tx.objectStore('outbox').add({ op: 'remove', kind: 'note', id, path, at: ts });
      await tx.done;
    },
  };
  return repo;
}

function notePayload(n) {
  return { noteTypeId: n.noteTypeId, deckId: n.deckId, created: n.created, values: n.values };
}

function ntPayload(nt) {
  return {
    name: nt.name, css: nt.css,
    fields: nt.fields.map(f => ({ name: f.name, ord: f.ord })),
    templates: nt.templates.map(t => ({ name: t.name, frontHtml: t.frontHtml, backHtml: t.backHtml, ord: t.ord })),
  };
}
