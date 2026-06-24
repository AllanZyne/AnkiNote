function rank(node) {
  if (node.archived) return 2;
  if (node.pinned) return 0;
  return 1;
}

function sortNodes(nodes) {
  nodes.sort((a, b) => rank(a) - rank(b) || a.segment.localeCompare(b.segment, undefined, { sensitivity: 'base' }));
  for (const n of nodes) sortNodes(n.children);
  return nodes;
}

export function buildDeckTree(decks) {
  const roots = [];
  const byPath = new Map();

  const ensure = (path) => {
    if (byPath.has(path)) return byPath.get(path);
    const segs = path.split('::');
    const segment = segs[segs.length - 1];
    const node = { segment, path, deck: null, pinned: false, archived: false, children: [] };
    byPath.set(path, node);
    if (segs.length === 1) {
      roots.push(node);
    } else {
      ensure(segs.slice(0, -1).join('::')).children.push(node);
    }
    return node;
  };

  for (const deck of decks) {
    const node = ensure(deck.name);
    node.deck = deck;
    node.pinned = deck.pinned;
    node.archived = deck.archived;
  }
  return sortNodes(roots);
}
