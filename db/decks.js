export function createDeck(db, { name, parentId = null }) {
  const info = db.prepare(
    'INSERT INTO deck (name, parent_id) VALUES (?, ?)'
  ).run(name, parentId);
  return { id: info.lastInsertRowid, name, parentId };
}

export function listDecks(db) {
  return db.prepare('SELECT id, name, parent_id AS parentId FROM deck ORDER BY name')
    .all();
}

export function renameDeck(db, id, name) {
  db.prepare('UPDATE deck SET name = ? WHERE id = ?').run(name, id);
}

export function deleteDeck(db, id) {
  db.prepare('DELETE FROM deck WHERE id = ?').run(id);
}
