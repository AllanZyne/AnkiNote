export function serializeDecks(decks) {
  return JSON.stringify(decks ?? {}, null, 2);
}

export function parseDecks(json) {
  if (!json) return {};
  try { const v = JSON.parse(json); return (v && typeof v === 'object') ? v : {}; }
  catch { return {}; }
}

export function serializeIndex(index) {
  return JSON.stringify(index ?? { notes: {} }, null, 2);
}

export function parseIndex(json) {
  if (!json) return { notes: {} };
  try {
    const v = JSON.parse(json);
    if (!v || typeof v !== 'object' || typeof v.notes !== 'object') return { notes: {} };
    return v;
  } catch { return { notes: {} }; }
}
