import { newId, nowIso } from './ids.js';

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
  return db.prepare('SELECT id, name, pinned, archived FROM deck WHERE name = ? AND deleted = 0').get(name);
}

function ancestorPaths(name) {
  const segs = name.split('::');
  const paths = [];
  for (let i = 1; i < segs.length; i++) paths.push(segs.slice(0, i).join('::'));
  return paths;
}

function insertDeck(db, name) {
  const id = newId();
  const updatedAt = nowIso();
  db.prepare('INSERT INTO deck (id, name, updated_at) VALUES (?, ?, ?)').run(id, name, updatedAt);
  return { id, updatedAt };
}

export function createDeck(db, { name }) {
  const v = validateDeckPath(name);
  if (!v.valid) throw new Error('invalid deck name');
  const path = v.normalized;
  return db.transaction(() => {
    if (deckByName(db, path)) throw new Error('deck exists');
    for (const anc of ancestorPaths(path)) {
      if (!deckByName(db, anc)) insertDeck(db, anc);
    }
    const { id, updatedAt } = insertDeck(db, path);
    return { id, name: path, pinned: false, archived: false, updatedAt };
  })();
}

export function listDecks(db) {
  return db.prepare('SELECT id, name, pinned, archived, updated_at AS updatedAt FROM deck WHERE deleted = 0 ORDER BY name')
    .all().map(d => ({ ...d, pinned: !!d.pinned, archived: !!d.archived }));
}

export function deleteDeck(db, id) {
  const deck = db.prepare('SELECT name FROM deck WHERE id = ?').get(id);
  if (!deck) return;
  const ts = nowIso();
  db.transaction(() => {
    db.prepare("UPDATE deck SET name = '__deleted__' || id, deleted = 1, updated_at = ? WHERE name = ? OR name LIKE ? ESCAPE '\\'")
      .run(ts, deck.name, likePrefix(deck.name));
  })();
}

export function setDeckPinned(db, id, pinned) {
  db.prepare('UPDATE deck SET pinned = ?, updated_at = ? WHERE id = ?').run(pinned ? 1 : 0, nowIso(), id);
}

export function setDeckArchived(db, id, archived) {
  db.prepare('UPDATE deck SET archived = ?, updated_at = ? WHERE id = ?').run(archived ? 1 : 0, nowIso(), id);
}

export function renameDeck(db, id, newName) {
  const v = validateDeckPath(newName);
  if (!v.valid) throw new Error('invalid deck name');
  const target = v.normalized;
  const row = db.prepare('SELECT id, name FROM deck WHERE id = ? AND deleted = 0').get(id);
  if (!row) throw new Error('deck not found');
  const oldName = row.name;
  if (target === oldName) return;
  if (target.startsWith(oldName + '::')) throw new Error('cannot move into own subtree');
  const ts = nowIso();
  db.transaction(() => {
    for (const anc of ancestorPaths(target)) {
      if (!deckByName(db, anc)) insertDeck(db, anc);
    }
    const affected = db.prepare("SELECT id, name FROM deck WHERE deleted = 0 AND (name = ? OR name LIKE ? ESCAPE '\\')")
      .all(oldName, likePrefix(oldName));
    for (const a of affected) {
      const rewritten = target + a.name.slice(oldName.length);
      const clash = db.prepare('SELECT id FROM deck WHERE name = ? AND id != ? AND deleted = 0').get(rewritten, a.id);
      if (clash) {
        db.prepare('UPDATE note SET deck_id = ?, updated_at = ? WHERE deck_id = ?').run(a.id, ts, clash.id);
        db.prepare("UPDATE deck SET name = '__deleted__' || id, deleted = 1, updated_at = ? WHERE id = ?").run(ts, clash.id);
      }
      db.prepare('UPDATE deck SET name = ?, updated_at = ? WHERE id = ?').run(rewritten, ts, a.id);
    }
  })();
}
