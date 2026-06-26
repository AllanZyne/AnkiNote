import { normalizePath } from './provider.js';

export function makeMemoryProvider(seed = {}) {
  const files = new Map();   // path -> { body, etag, modified }
  const dirs = new Set();    // explicit empty dirs
  let counter = 0;
  const nextEtag = () => String(++counter);
  const stamp = () => new Date(counter).toISOString();

  function putFile(path, body, etag) {
    files.set(path, { body, etag: etag ?? nextEtag(), modified: stamp() });
  }
  for (const [path, body] of Object.entries(seed)) putFile(normalizePath(path), body);

  function childrenOf(prefix) {
    const base = normalizePath(prefix);
    const pre = base === '' ? '' : base + '/';
    const seen = new Map(); // childPath -> entry
    const consider = (full) => {
      if (!full.startsWith(pre)) return;
      const rest = full.slice(pre.length);
      if (rest === '') return;
      const slash = rest.indexOf('/');
      if (slash === -1) {
        const f = files.get(full);
        if (f) seen.set(full, { path: full, type: 'file', etag: f.etag, modified: f.modified, size: f.body.length });
      } else {
        const childDir = pre + rest.slice(0, slash);
        if (!seen.has(childDir)) seen.set(childDir, { path: childDir, type: 'dir', etag: null, modified: null, size: 0 });
      }
    };
    for (const full of files.keys()) consider(full);
    for (const d of dirs) consider(d);
    return [...seen.values()];
  }

  return {
    capabilities: { supportsConditionalWrite: true, supportsMove: true },

    async list(path) { return childrenOf(path); },

    async read(path) {
      const p = normalizePath(path);
      const f = files.get(p);
      if (!f) throw Object.assign(new Error('not found: ' + p), { code: 'NOT_FOUND' });
      return { body: f.body, etag: f.etag };
    },

    async write(path, body, opts = {}) {
      const p = normalizePath(path);
      const existing = files.get(p);
      if (opts.ifMatch !== undefined) {
        if (!existing || existing.etag !== opts.ifMatch) {
          throw Object.assign(new Error('etag mismatch'), { code: 'ETAG_MISMATCH' });
        }
      }
      const etag = nextEtag();
      putFile(p, body, etag);
      return { etag };
    },

    async mkdir(path) { dirs.add(normalizePath(path)); },

    async remove(path) {
      const p = normalizePath(path);
      files.delete(p);
      dirs.delete(p);
      const pre = p + '/';
      for (const k of [...files.keys()]) if (k.startsWith(pre)) files.delete(k);
      for (const k of [...dirs]) if (k.startsWith(pre)) dirs.delete(k);
    },

    async move(from, to) {
      const a = normalizePath(from), b = normalizePath(to);
      const rename = (k) => b + k.slice(a.length);
      if (files.has(a)) { const f = files.get(a); files.delete(a); putFile(rename(a), f.body); }
      const pre = a + '/';
      for (const k of [...files.keys()]) if (k.startsWith(pre)) { const f = files.get(k); files.delete(k); putFile(rename(k), f.body); }
      for (const k of [...dirs]) if (k === a || k.startsWith(pre)) { dirs.delete(k); dirs.add(rename(k)); }
    },

    async exists(path) {
      const p = normalizePath(path);
      return files.has(p) || dirs.has(p);
    },
  };
}
