export function validateDeckPath(name) {
  if (typeof name !== 'string') return { valid: false, error: 'name must be a string' };
  const segments = name.split('::').map(s => s.trim());
  if (segments.length === 0 || segments.some(s => s === '')) {
    return { valid: false, error: 'deck name has empty segments' };
  }
  return { valid: true, normalized: segments.join('::') };
}

function ancestorPaths(name) {
  const segs = name.split('::');
  const out = [];
  for (let i = 1; i < segs.length; i++) out.push(segs.slice(0, i).join('::'));
  return out;
}

const isPrefixChild = (name, p) => name === p || name.startsWith(p + '::');

export function planCreate(decks, name, makeId) {
  const v = validateDeckPath(name);
  if (!v.valid) throw new Error('invalid deck name');
  const path = v.normalized;
  const names = new Set(decks.map(d => d.name));
  if (names.has(path)) throw new Error('deck exists');
  const creates = [];
  for (const anc of ancestorPaths(path)) {
    if (!names.has(anc)) { creates.push({ id: makeId(), name: anc }); names.add(anc); }
  }
  creates.push({ id: makeId(), name: path });
  return { creates };
}

export function planRename(decks, id, newName, makeId) {
  const v = validateDeckPath(newName);
  if (!v.valid) throw new Error('invalid deck name');
  const target = v.normalized;
  const row = decks.find(d => d.id === id);
  if (!row) throw new Error('deck not found');
  const oldName = row.name;
  if (target === oldName) return { creates: [], renames: [], merges: [] };
  if (target.startsWith(oldName + '::')) throw new Error('cannot move into own subtree');

  const names = new Set(decks.map(d => d.name));
  const creates = [];
  for (const anc of ancestorPaths(target)) {
    if (!names.has(anc)) { creates.push({ id: makeId(), name: anc }); names.add(anc); }
  }
  const affected = decks.filter(d => isPrefixChild(d.name, oldName));
  const renames = [];
  const merges = [];
  for (const a of affected) {
    const rewritten = target + a.name.slice(oldName.length);
    const clash = decks.find(d => d.name === rewritten && d.id !== a.id);
    if (clash) merges.push({ fromId: clash.id, toId: a.id });
    renames.push({ id: a.id, name: rewritten });
  }
  return { creates, renames, merges };
}

export function planDelete(decks, id) {
  const row = decks.find(d => d.id === id);
  if (!row) return { deletes: [] };
  const deletes = decks.filter(d => isPrefixChild(d.name, row.name)).map(d => d.id);
  return { deletes };
}
