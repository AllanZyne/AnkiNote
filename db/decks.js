function likePrefix(name) {
  return name.replace(/[\\%_]/g, c => '\\' + c) + '::%';
}

export function validateDeckPath(name) {
  if (typeof name !== 'string') return { valid: false, error: 'name must be a string' };
  const segments = name.split('::').map(s => s.trim());
  if (segments.length === 0 || segments.some(s => s === '')) {
    return { valid: false, error: 'deck name has empty segments' };
  }
  return { valid: true, normalized: segments.join('::') };
}

function deckByName(db, name) {
  return db.prepare('SELECT id, name, pinned, archived FROM deck WHERE name = ?').get(name);
}

function ancestorPaths(name) {
  const segs = name.split('::');
  const paths = [];
  for (let i = 1; i < segs.length; i++) paths.push(segs.slice(0, i).join('::'));
  return paths;
}

export function createDeck(db, { name }) {
  const v = validateDeckPath(name);
  if (!v.valid) throw new Error('invalid deck name');
  const path = v.normalized;
  return db.transaction(() => {
    if (deckByName(db, path)) throw new Error('deck exists');
    const ins = db.prepare('INSERT INTO deck (name) VALUES (?)');
    for (const anc of ancestorPaths(path)) {
      if (!deckByName(db, anc)) ins.run(anc);
    }
    const id = ins.run(path).lastInsertRowid;
    return { id, name: path, pinned: false, archived: false };
  })();
}

export function listDecks(db) {
  return db.prepare('SELECT id, name, pinned, archived FROM deck ORDER BY name')
    .all().map(d => ({ ...d, pinned: !!d.pinned, archived: !!d.archived }));
}

export function deleteDeck(db, id) {
  const deck = db.prepare('SELECT name FROM deck WHERE id = ?').get(id);
  if (!deck) return;
  db.transaction(() => {
    db.prepare("DELETE FROM deck WHERE name = ? OR name LIKE ? ESCAPE '\\'").run(deck.name, likePrefix(deck.name));
  })();
}

export function setDeckPinned(db, id, pinned) {
  db.prepare('UPDATE deck SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id);
}

export function setDeckArchived(db, id, archived) {
  db.prepare('UPDATE deck SET archived = ? WHERE id = ?').run(archived ? 1 : 0, id);
}

export function renameDeck(db, id, newName) {
  const v = validateDeckPath(newName);
  if (!v.valid) throw new Error('invalid deck name');
  const target = v.normalized;
  const row = db.prepare('SELECT id, name FROM deck WHERE id = ?').get(id);
  if (!row) throw new Error('deck not found');
  const oldName = row.name;
  if (target === oldName) return;
  if (target.startsWith(oldName + '::')) throw new Error('cannot move into own subtree');

  db.transaction(() => {
    // Auto-create missing ancestors of the new name.
    const insAnc = db.prepare('INSERT INTO deck (name) VALUES (?)');
    for (const anc of ancestorPaths(target)) {
      if (!deckByName(db, anc)) insAnc.run(anc);
    }
    // Rewrite the deck itself and all its prefix-descendants.
    const affected = db.prepare("SELECT id, name FROM deck WHERE name = ? OR name LIKE ? ESCAPE '\\'")
      .all(oldName, likePrefix(oldName));
    for (const a of affected) {
      const rewritten = target + a.name.slice(oldName.length);
      const clash = db.prepare('SELECT id FROM deck WHERE name = ? AND id != ?').get(rewritten, a.id);
      if (clash) {
        // Merge: move the colliding row's notes to the surviving (renamed) row, drop the duplicate.
        db.prepare('UPDATE note SET deck_id = ? WHERE deck_id = ?').run(a.id, clash.id);
        db.prepare('DELETE FROM deck WHERE id = ?').run(clash.id);
      }
      db.prepare('UPDATE deck SET name = ? WHERE id = ?').run(rewritten, a.id);
    }
  })();
}
