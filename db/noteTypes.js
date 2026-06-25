import { newId, nowIso } from './ids.js';

function insertFieldsAndTemplates(db, noteTypeId, fields, templates) {
  const fStmt = db.prepare(
    'INSERT INTO field (id, note_type_id, name, ord) VALUES (?, ?, ?, ?)'
  );
  fields.forEach((f, i) => fStmt.run(newId(), noteTypeId, f.name, i));
  const tStmt = db.prepare(
    'INSERT INTO card_template (id, note_type_id, name, front_html, back_html, ord) VALUES (?, ?, ?, ?, ?, ?)'
  );
  templates.forEach((t, i) =>
    tStmt.run(newId(), noteTypeId, t.name, t.frontHtml ?? '', t.backHtml ?? '', i));
}

export function createNoteType(db, { name, css = '', fields, templates }) {
  const tx = db.transaction(() => {
    const id = newId();
    db.prepare('INSERT INTO note_type (id, name, css, updated_at) VALUES (?, ?, ?, ?)')
      .run(id, name, css, nowIso());
    insertFieldsAndTemplates(db, id, fields, templates);
    return id;
  });
  return getNoteType(db, tx());
}

export function getNoteType(db, id) {
  const nt = db.prepare('SELECT id, name, css, updated_at AS updatedAt FROM note_type WHERE id = ? AND deleted = 0').get(id);
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
  return db.prepare('SELECT id FROM note_type WHERE deleted = 0 ORDER BY name')
    .all().map(r => getNoteType(db, r.id));
}

export function updateNoteType(db, id, { name, css = '', fields, templates }) {
  const tx = db.transaction(() => {
    db.prepare('UPDATE note_type SET name = ?, css = ? WHERE id = ?').run(name, css, id);

    const existingFields = db.prepare('SELECT id, name, ord FROM field WHERE note_type_id = ? ORDER BY ord').all(id);
    const existingFieldsByName = new Map(existingFields.map(f => [f.name, f]));
    const incomingFieldNames = new Set(fields.map(f => f.name));

    fields.forEach((f, i) => {
      const existing = existingFieldsByName.get(f.name);
      if (existing) {
        db.prepare('UPDATE field SET ord = ? WHERE id = ?').run(i, existing.id);
      } else {
        const newFieldId = newId();
        db.prepare('INSERT INTO field (id, note_type_id, name, ord) VALUES (?, ?, ?, ?)').run(newFieldId, id, f.name, i);
        const noteIds = db.prepare('SELECT id FROM note WHERE note_type_id = ?').all(id);
        const insertValue = db.prepare('INSERT INTO field_value (id, note_id, field_id, value_md) VALUES (?, ?, ?, ?)');
        noteIds.forEach(n => insertValue.run(newId(), n.id, newFieldId, ''));
      }
    });

    existingFields.forEach(f => {
      if (!incomingFieldNames.has(f.name)) {
        db.prepare('DELETE FROM field WHERE id = ?').run(f.id);
      }
    });

    const existingTemplates = db.prepare('SELECT id, name FROM card_template WHERE note_type_id = ?').all(id);
    const existingTemplatesByName = new Map(existingTemplates.map(t => [t.name, t]));
    const incomingTemplateNames = new Set(templates.map(t => t.name));

    templates.forEach((t, i) => {
      const existing = existingTemplatesByName.get(t.name);
      if (existing) {
        db.prepare('UPDATE card_template SET front_html = ?, back_html = ?, ord = ? WHERE id = ?')
          .run(t.frontHtml ?? '', t.backHtml ?? '', i, existing.id);
      } else {
        const newTemplateId = newId();
        db.prepare('INSERT INTO card_template (id, note_type_id, name, front_html, back_html, ord) VALUES (?, ?, ?, ?, ?, ?)')
          .run(newTemplateId, id, t.name, t.frontHtml ?? '', t.backHtml ?? '', i);
        const noteIds = db.prepare('SELECT id FROM note WHERE note_type_id = ?').all(id);
        const insertCard = db.prepare('INSERT INTO card (id, note_id, card_template_id) VALUES (?, ?, ?)');
        noteIds.forEach(n => insertCard.run(newId(), n.id, newTemplateId));
      }
    });

    existingTemplates.forEach(t => {
      if (!incomingTemplateNames.has(t.name)) {
        db.prepare('DELETE FROM card_template WHERE id = ?').run(t.id);
      }
    });
    db.prepare('UPDATE note_type SET updated_at = ? WHERE id = ?').run(nowIso(), id);
  });
  tx();
  return getNoteType(db, id);
}

export function deleteNoteType(db, id) {
  const inUse = db.prepare('SELECT 1 FROM note WHERE note_type_id = ? AND deleted = 0 LIMIT 1').get(id);
  if (inUse) throw new Error('note type in use');
  db.prepare('UPDATE note_type SET deleted = 1, updated_at = ? WHERE id = ?').run(nowIso(), id);
}
