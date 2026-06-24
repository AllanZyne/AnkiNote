export function createDeck(db, { name, parentId = null }) {
  const info = db.prepare(
    'INSERT INTO deck (name, parent_id) VALUES (?, ?)'
  ).run(name, parentId);
  return { id: info.lastInsertRowid, name, parentId, pinned: false, archived: false };
}

export function listDecks(db) {
  return db.prepare(
    'SELECT id, name, parent_id AS parentId, pinned, archived FROM deck ORDER BY name'
  ).all().map(d => ({ ...d, pinned: !!d.pinned, archived: !!d.archived }));
}

export function renameDeck(db, id, name) {
  db.prepare('UPDATE deck SET name = ? WHERE id = ?').run(name, id);
}

export function setDeckPinned(db, id, pinned) {
  db.prepare('UPDATE deck SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id);
}

export function setDeckArchived(db, id, archived) {
  db.prepare('UPDATE deck SET archived = ? WHERE id = ?').run(archived ? 1 : 0, id);
}

export function deleteDeck(db, id) {
  db.prepare('DELETE FROM deck WHERE id = ?').run(id);
}
