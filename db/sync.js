import { toInstant, nowIso } from './ids.js';

function storedUpdatedAt(db, table, id) {
  const row = db.prepare(`SELECT updated_at AS u FROM ${table} WHERE id = ?`).get(id);
  return row ? row.u : null;
}

const TABLE = { deck: 'deck', note_type: 'note_type', note: 'note' };

function wins(incomingIso, storedIso) {
  if (storedIso == null) return true;
  return toInstant(incomingIso) > toInstant(storedIso);
}

function upsertDeck(db, id, ts, p) {
  const exists = db.prepare('SELECT 1 FROM deck WHERE id = ?').get(id);
  if (exists) {
    db.prepare('UPDATE deck SET name = ?, pinned = ?, archived = ?, deleted = 0, updated_at = ? WHERE id = ?')
      .run(p.name, p.pinned ? 1 : 0, p.archived ? 1 : 0, ts, id);
  } else {
    db.prepare('INSERT INTO deck (id, name, pinned, archived, deleted, updated_at) VALUES (?, ?, ?, ?, 0, ?)')
      .run(id, p.name, p.pinned ? 1 : 0, p.archived ? 1 : 0, ts);
  }
}

function upsertNoteType(db, id, ts, p) {
  const exists = db.prepare('SELECT 1 FROM note_type WHERE id = ?').get(id);
  if (exists) {
    db.prepare('UPDATE note_type SET name = ?, css = ?, deleted = 0, updated_at = ? WHERE id = ?').run(p.name, p.css ?? '', ts, id);

    // Reconcile fields by name (preserves stable ids, avoiding CASCADE delete of field_values)
    const existingFields = db.prepare('SELECT id, name, ord FROM field WHERE note_type_id = ?').all(id);
    const existingFieldsByName = new Map(existingFields.map(f => [f.name, f]));
    const incomingFieldNames = new Set((p.fields ?? []).map(f => f.name));

    (p.fields ?? []).forEach((f, i) => {
      const existing = existingFieldsByName.get(f.name);
      if (existing) {
        db.prepare('UPDATE field SET ord = ? WHERE id = ?').run(i, existing.id);
      } else {
        const newFieldId = cryptoId();
        db.prepare('INSERT INTO field (id, note_type_id, name, ord) VALUES (?, ?, ?, ?)').run(newFieldId, id, f.name, i);
        // Backfill empty value for all existing notes of this type
        const noteIds = db.prepare('SELECT id FROM note WHERE note_type_id = ?').all(id);
        const insertValue = db.prepare('INSERT INTO field_value (id, note_id, field_id, value_md) VALUES (?, ?, ?, ?)');
        noteIds.forEach(n => insertValue.run(cryptoId(), n.id, newFieldId, ''));
      }
    });

    existingFields.forEach(f => {
      if (!incomingFieldNames.has(f.name)) {
        db.prepare('DELETE FROM field WHERE id = ?').run(f.id);
      }
    });

    // Reconcile card_templates by name (preserves stable ids, avoiding CASCADE delete of cards)
    const existingTemplates = db.prepare('SELECT id, name FROM card_template WHERE note_type_id = ?').all(id);
    const existingTemplatesByName = new Map(existingTemplates.map(t => [t.name, t]));
    const incomingTemplateNames = new Set((p.templates ?? []).map(t => t.name));

    (p.templates ?? []).forEach((t, i) => {
      const existing = existingTemplatesByName.get(t.name);
      if (existing) {
        db.prepare('UPDATE card_template SET front_html = ?, back_html = ?, ord = ? WHERE id = ?')
          .run(t.frontHtml ?? '', t.backHtml ?? '', i, existing.id);
      } else {
        const newTemplateId = cryptoId();
        db.prepare('INSERT INTO card_template (id, note_type_id, name, front_html, back_html, ord) VALUES (?, ?, ?, ?, ?, ?)')
          .run(newTemplateId, id, t.name, t.frontHtml ?? '', t.backHtml ?? '', i);
        // Backfill a card for each existing note of this type
        const noteIds = db.prepare('SELECT id FROM note WHERE note_type_id = ?').all(id);
        const insertCard = db.prepare('INSERT INTO card (id, note_id, card_template_id) VALUES (?, ?, ?)');
        noteIds.forEach(n => insertCard.run(cryptoId(), n.id, newTemplateId));
      }
    });

    existingTemplates.forEach(t => {
      if (!incomingTemplateNames.has(t.name)) {
        db.prepare('DELETE FROM card_template WHERE id = ?').run(t.id);
      }
    });
  } else {
    db.prepare('INSERT INTO note_type (id, name, css, deleted, updated_at) VALUES (?, ?, ?, 0, ?)').run(id, p.name, p.css ?? '', ts);
    const fStmt = db.prepare('INSERT INTO field (id, note_type_id, name, ord) VALUES (?, ?, ?, ?)');
    (p.fields ?? []).forEach((f, i) => fStmt.run(f.id ?? cryptoId(), id, f.name, i));
    const tStmt = db.prepare('INSERT INTO card_template (id, note_type_id, name, front_html, back_html, ord) VALUES (?, ?, ?, ?, ?, ?)');
    (p.templates ?? []).forEach((t, i) => tStmt.run(t.id ?? cryptoId(), id, t.name, t.frontHtml ?? '', t.backHtml ?? '', i));
  }
}

function upsertNote(db, id, ts, p) {
  const exists = db.prepare('SELECT 1 FROM note WHERE id = ?').get(id);
  if (exists) {
    db.prepare('UPDATE note SET note_type_id = ?, deck_id = ?, modified = ?, deleted = 0, updated_at = ? WHERE id = ?')
      .run(p.noteTypeId, p.deckId, ts, ts, id);
    db.prepare('DELETE FROM field_value WHERE note_id = ?').run(id);
    db.prepare('DELETE FROM card WHERE note_id = ?').run(id);
  } else {
    db.prepare('INSERT INTO note (id, note_type_id, deck_id, created, modified, deleted, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
      .run(id, p.noteTypeId, p.deckId, p.created ?? ts, ts, ts);
  }
  const fields = db.prepare('SELECT id, name FROM field WHERE note_type_id = ?').all(p.noteTypeId);
  const fvStmt = db.prepare('INSERT INTO field_value (id, note_id, field_id, value_md) VALUES (?, ?, ?, ?)');
  for (const f of fields) fvStmt.run(cryptoId(), id, f.id, (p.values ?? {})[f.name] ?? '');
  const templates = db.prepare('SELECT id FROM card_template WHERE note_type_id = ?').all(p.noteTypeId);
  const cStmt = db.prepare('INSERT INTO card (id, note_id, card_template_id) VALUES (?, ?, ?)');
  for (const t of templates) cStmt.run(cryptoId(), id, t.id);
}

import { randomUUID } from 'node:crypto';
function cryptoId() { return randomUUID(); }

const UPSERT = { deck: upsertDeck, note_type: upsertNoteType, note: upsertNote };

export function pushOps(db, ops) {
  const applied = [];
  db.transaction(() => {
    for (const op of ops) {
      const table = TABLE[op.entity];
      if (!table) continue;
      if (!wins(op.updatedAt, storedUpdatedAt(db, table, op.id))) continue;
      if (op.type === 'delete') {
        const exists = db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(op.id);
        if (exists) {
          db.prepare(`UPDATE ${table} SET deleted = 1, updated_at = ? WHERE id = ?`).run(op.updatedAt, op.id);
        } else {
          // Insert valid tombstones for unknown-id deletes
          if (table === 'deck') {
            db.prepare('INSERT INTO deck (id, name, deleted, updated_at) VALUES (?, ?, 1, ?)')
              .run(op.id, '__deleted__' + op.id, op.updatedAt);
          } else if (table === 'note_type') {
            db.prepare('INSERT INTO note_type (id, name, deleted, updated_at) VALUES (?, ?, 1, ?)')
              .run(op.id, '', op.updatedAt);
          }
          // Note: skip tombstone for unknown note (client already deleted it; no FK-valid row possible)
        }
      } else {
        UPSERT[op.entity](db, op.id, op.updatedAt, op.payload ?? {});
      }
      applied.push({ entity: op.entity, id: op.id });
    }
  })();
  return { applied };
}

function noteAggregate(db, row) {
  const values = {};
  for (const r of db.prepare(
    'SELECT f.name AS name, fv.value_md AS md FROM field_value fv JOIN field f ON f.id = fv.field_id WHERE fv.note_id = ?'
  ).all(row.id)) values[r.name] = r.md;
  return { id: row.id, noteTypeId: row.note_type_id, deckId: row.deck_id, created: row.created, values, deleted: !!row.deleted, updatedAt: row.updated_at };
}

function noteTypeAggregate(db, row) {
  const fields = db.prepare('SELECT name, ord FROM field WHERE note_type_id = ? ORDER BY ord').all(row.id);
  const templates = db.prepare('SELECT name, front_html AS frontHtml, back_html AS backHtml, ord FROM card_template WHERE note_type_id = ? ORDER BY ord').all(row.id);
  return { id: row.id, name: row.name, css: row.css, fields, templates, deleted: !!row.deleted, updatedAt: row.updated_at };
}

export function pullSince(db, since) {
  const after = (table) => {
    const rows = since
      ? db.prepare(`SELECT * FROM ${table} WHERE updated_at IS NOT NULL`).all().filter(r => toInstant(r.updated_at) > toInstant(since))
      : db.prepare(`SELECT * FROM ${table}`).all();
    return rows;
  };
  return {
    decks: after('deck').map(r => ({ id: r.id, name: r.name, pinned: !!r.pinned, archived: !!r.archived, deleted: !!r.deleted, updatedAt: r.updated_at })),
    noteTypes: after('note_type').map(r => noteTypeAggregate(db, r)),
    notes: after('note').map(r => noteAggregate(db, r)),
    serverTime: nowIso(),
  };
}
