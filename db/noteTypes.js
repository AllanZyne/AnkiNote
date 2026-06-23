function insertFieldsAndTemplates(db, noteTypeId, fields, templates) {
  const fStmt = db.prepare(
    'INSERT INTO field (note_type_id, name, ord) VALUES (?, ?, ?)'
  );
  fields.forEach((f, i) => fStmt.run(noteTypeId, f.name, i));
  const tStmt = db.prepare(
    'INSERT INTO card_template (note_type_id, name, front_html, back_html, ord) VALUES (?, ?, ?, ?, ?)'
  );
  templates.forEach((t, i) =>
    tStmt.run(noteTypeId, t.name, t.frontHtml ?? '', t.backHtml ?? '', i));
}

export function createNoteType(db, { name, css = '', fields, templates }) {
  const tx = db.transaction(() => {
    const info = db.prepare('INSERT INTO note_type (name, css) VALUES (?, ?)')
      .run(name, css);
    const id = info.lastInsertRowid;
    insertFieldsAndTemplates(db, id, fields, templates);
    return id;
  });
  return getNoteType(db, tx());
}

export function getNoteType(db, id) {
  const nt = db.prepare('SELECT id, name, css FROM note_type WHERE id = ?').get(id);
  if (!nt) return undefined;
  nt.fields = db.prepare(
    'SELECT id, name, ord FROM field WHERE note_type_id = ? ORDER BY ord'
  ).all(id);
  nt.templates = db.prepare(
    'SELECT id, name, front_html AS frontHtml, back_html AS backHtml, ord FROM card_template WHERE note_type_id = ? ORDER BY ord'
  ).all(id);
  return nt;
}

export function listNoteTypes(db) {
  return db.prepare('SELECT id FROM note_type ORDER BY name')
    .all().map(r => getNoteType(db, r.id));
}

export function updateNoteType(db, id, { name, css = '', fields, templates }) {
  const tx = db.transaction(() => {
    db.prepare('UPDATE note_type SET name = ?, css = ? WHERE id = ?').run(name, css, id);
    db.prepare('DELETE FROM field WHERE note_type_id = ?').run(id);
    db.prepare('DELETE FROM card_template WHERE note_type_id = ?').run(id);
    insertFieldsAndTemplates(db, id, fields, templates);
  });
  tx();
  return getNoteType(db, id);
}

export function deleteNoteType(db, id) {
  const inUse = db.prepare('SELECT 1 FROM note WHERE note_type_id = ? LIMIT 1').get(id);
  if (inUse) throw new Error('note type in use');
  db.prepare('DELETE FROM note_type WHERE id = ?').run(id);
}
