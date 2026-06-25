import { newId, nowIso } from './ids.js';

function fieldMap(db, noteTypeId) {
  const rows = db.prepare('SELECT id, name FROM field WHERE note_type_id = ?').all(noteTypeId);
  const byName = {}; for (const r of rows) byName[r.name] = r.id;
  return byName;
}

function loadValues(db, noteId) {
  const rows = db.prepare(
    'SELECT f.name AS name, fv.value_md AS md FROM field_value fv JOIN field f ON f.id = fv.field_id WHERE fv.note_id = ?'
  ).all(noteId);
  const values = {}; for (const r of rows) values[r.name] = r.md;
  return values;
}

export function getNote(db, id) {
  const note = db.prepare(
    'SELECT id, note_type_id AS noteTypeId, deck_id AS deckId, created, modified, updated_at AS updatedAt FROM note WHERE id = ? AND deleted = 0'
  ).get(id);
  if (!note) return undefined;
  note.values = loadValues(db, id);
  note.cardIds = db.prepare('SELECT id FROM card WHERE note_id = ? ORDER BY id').all(id).map(r => r.id);
  return note;
}

export function createNote(db, { noteTypeId, deckId, values }) {
  const now = nowIso();
  const tx = db.transaction(() => {
    const noteId = newId();
    db.prepare(
      'INSERT INTO note (id, note_type_id, deck_id, created, modified, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(noteId, noteTypeId, deckId, now, now, now);
    const fields = fieldMap(db, noteTypeId);
    const fvStmt = db.prepare('INSERT INTO field_value (id, note_id, field_id, value_md) VALUES (?, ?, ?, ?)');
    for (const [name, fieldId] of Object.entries(fields)) {
      fvStmt.run(newId(), noteId, fieldId, values[name] ?? '');
    }
    const templates = db.prepare('SELECT id FROM card_template WHERE note_type_id = ?').all(noteTypeId);
    const cStmt = db.prepare('INSERT INTO card (id, note_id, card_template_id) VALUES (?, ?, ?)');
    for (const t of templates) cStmt.run(newId(), noteId, t.id);
    return noteId;
  });
  return getNote(db, tx());
}

export function listNotesInDeck(db, deckId) {
  return db.prepare('SELECT id FROM note WHERE deck_id = ? AND deleted = 0 ORDER BY created DESC')
    .all(deckId).map(r => getNote(db, r.id));
}

export function updateNote(db, id, { deckId, values }) {
  const now = nowIso();
  const tx = db.transaction(() => {
    if (deckId != null) db.prepare('UPDATE note SET deck_id = ? WHERE id = ?').run(deckId, id);
    if (values) {
      const note = db.prepare('SELECT note_type_id AS ntid FROM note WHERE id = ?').get(id);
      const fields = fieldMap(db, note.ntid);
      const upd = db.prepare('UPDATE field_value SET value_md = ? WHERE note_id = ? AND field_id = ?');
      for (const [name, md] of Object.entries(values)) {
        if (fields[name] != null) upd.run(md, id, fields[name]);
      }
    }
    db.prepare('UPDATE note SET modified = ?, updated_at = ? WHERE id = ?').run(now, now, id);
  });
  tx();
  return getNote(db, id);
}

export function deleteNote(db, id) {
  db.prepare('UPDATE note SET deleted = 1, updated_at = ? WHERE id = ?').run(nowIso(), id);
}

export function searchNotes(db, query) {
  const q = (query ?? '').trim();
  if (!q) {
    return db.prepare('SELECT id FROM note WHERE deleted = 0 ORDER BY created DESC').all().map(r => getNote(db, r.id));
  }
  const ids = db.prepare(
    `SELECT DISTINCT n.id AS id, n.created AS created FROM note n
     JOIN field_value fv ON fv.note_id = n.id
     WHERE n.deleted = 0 AND instr(lower(fv.value_md), lower(?)) > 0
     ORDER BY n.created DESC`
  ).all(q).map(r => r.id);
  return ids.map(id => getNote(db, id));
}
