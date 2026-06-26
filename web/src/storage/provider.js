export const DEFAULT_CAPABILITIES = { supportsConditionalWrite: false, supportsMove: false };

export function normalizePath(p) {
  if (p == null) return '';
  let s = String(p).replace(/\\/g, '/').replace(/\/+/g, '/');
  s = s.replace(/^\//, '');
  if (s !== '') s = s.replace(/\/$/, '');
  return s;
}

export function dirname(p) {
  const s = normalizePath(p);
  const i = s.lastIndexOf('/');
  return i === -1 ? '' : s.slice(0, i);
}

export function basename(p) {
  const s = normalizePath(p);
  const i = s.lastIndexOf('/');
  return i === -1 ? s : s.slice(i + 1);
}

export function joinPath(...parts) {
  return normalizePath(parts.filter(x => x != null && x !== '').join('/'));
}
