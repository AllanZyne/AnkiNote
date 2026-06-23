export function createBox(db, { name, parentId = null }) {
  const info = db.prepare(
    'INSERT INTO box (name, parent_id) VALUES (?, ?)'
  ).run(name, parentId);
  return { id: info.lastInsertRowid, name, parentId };
}

export function listBoxes(db) {
  return db.prepare('SELECT id, name, parent_id AS parentId FROM box ORDER BY name')
    .all();
}

export function renameBox(db, id, name) {
  db.prepare('UPDATE box SET name = ? WHERE id = ?').run(name, id);
}

export function deleteBox(db, id) {
  db.prepare('DELETE FROM box WHERE id = ?').run(id);
}
