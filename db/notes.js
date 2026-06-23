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
    'SELECT id, note_type_id AS noteTypeId, box_id AS boxId, created, modified FROM note WHERE id = ?'
  ).get(id);
  if (!note) return undefined;
  note.values = loadValues(db, id);
  note.cardIds = db.prepare('SELECT id FROM card WHERE note_id = ? ORDER BY id').all(id).map(r => r.id);
  return note;
}

export function createNote(db, { noteTypeId, boxId, values }) {
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    const info = db.prepare(
      'INSERT INTO note (note_type_id, box_id, created, modified) VALUES (?, ?, ?, ?)'
    ).run(noteTypeId, boxId, now, now);
    const noteId = info.lastInsertRowid;
    const fields = fieldMap(db, noteTypeId);
    const fvStmt = db.prepare('INSERT INTO field_value (note_id, field_id, value_md) VALUES (?, ?, ?)');
    for (const [name, fieldId] of Object.entries(fields)) {
      fvStmt.run(noteId, fieldId, values[name] ?? '');
    }
    const templates = db.prepare('SELECT id FROM card_template WHERE note_type_id = ?').all(noteTypeId);
    const cStmt = db.prepare('INSERT INTO card (note_id, card_template_id) VALUES (?, ?)');
    for (const t of templates) cStmt.run(noteId, t.id);
    return noteId;
  });
  return getNote(db, tx());
}

export function listNotesInBox(db, boxId) {
  return db.prepare('SELECT id FROM note WHERE box_id = ? ORDER BY id DESC')
    .all(boxId).map(r => getNote(db, r.id));
}

export function updateNote(db, id, { boxId, values }) {
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    if (boxId != null) db.prepare('UPDATE note SET box_id = ? WHERE id = ?').run(boxId, id);
    if (values) {
      const note = db.prepare('SELECT note_type_id AS ntid FROM note WHERE id = ?').get(id);
      const fields = fieldMap(db, note.ntid);
      const upd = db.prepare(
        'UPDATE field_value SET value_md = ? WHERE note_id = ? AND field_id = ?'
      );
      for (const [name, md] of Object.entries(values)) {
        if (fields[name] != null) upd.run(md, id, fields[name]);
      }
    }
    db.prepare('UPDATE note SET modified = ? WHERE id = ?').run(now, id);
  });
  tx();
  return getNote(db, id);
}

export function deleteNote(db, id) {
  db.prepare('DELETE FROM note WHERE id = ?').run(id);
}

export function searchNotes(db, query) {
  const q = (query ?? '').trim();
  if (!q) {
    return db.prepare('SELECT id FROM note ORDER BY id DESC').all().map(r => getNote(db, r.id));
  }
  const ids = db.prepare(
    `SELECT DISTINCT n.id AS id FROM note n
     JOIN field_value fv ON fv.note_id = n.id
     WHERE instr(lower(fv.value_md), lower(?)) > 0
     ORDER BY n.id DESC`
  ).all(q).map(r => r.id);
  return ids.map(id => getNote(db, id));
}
