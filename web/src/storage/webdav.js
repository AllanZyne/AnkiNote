import { normalizePath } from './provider.js';

// Parse a PROPFIND Depth:1 multistatus body into child entries (vault-relative).
function parsePropfind(xml, baseUrlPath, queriedPath) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const responses = [...doc.getElementsByTagNameNS('DAV:', 'response')];
  const out = [];
  const queried = normalizePath(queriedPath);
  for (const resp of responses) {
    const hrefEl = resp.getElementsByTagNameNS('DAV:', 'href')[0];
    if (!hrefEl) continue;
    let href = decodeURIComponent(hrefEl.textContent.trim());
    // strip the server's base path prefix to get a vault-relative path
    let rel = href;
    const baseIdx = href.indexOf(baseUrlPath);
    if (baseIdx !== -1) rel = href.slice(baseIdx + baseUrlPath.length);
    rel = normalizePath(rel);
    if (rel === queried || rel === '') continue; // exclude the collection itself
    const isCollection = resp.getElementsByTagNameNS('DAV:', 'collection').length > 0;
    const etagEl = resp.getElementsByTagNameNS('DAV:', 'getetag')[0];
    const modEl = resp.getElementsByTagNameNS('DAV:', 'getlastmodified')[0];
    const lenEl = resp.getElementsByTagNameNS('DAV:', 'getcontentlength')[0];
    out.push({
      path: rel,
      type: isCollection ? 'dir' : 'file',
      etag: etagEl ? etagEl.textContent.trim() : null,
      modified: modEl ? new Date(modEl.textContent.trim()).toISOString() : null,
      size: lenEl ? Number(lenEl.textContent.trim()) : 0,
    });
  }
  return out;
}

export function makeWebdavProvider({ baseUrl, authHeader, fetchFn = fetch }) {
  const base = baseUrl.replace(/\/$/, '');
  const basePath = new URL(base).pathname.replace(/\/$/, ''); // e.g. /dav
  const urlOf = (p) => base + '/' + normalizePath(p);
  const headers = (extra = {}) => ({ ...(authHeader ? { Authorization: authHeader } : {}), ...extra });

  return {
    capabilities: { supportsConditionalWrite: true, supportsMove: true },

    async list(path) {
      const res = await fetchFn(urlOf(path), { method: 'PROPFIND', headers: headers({ Depth: '1' }) });
      if (!res.ok && res.status !== 207) throw new Error('PROPFIND failed: ' + res.status);
      return parsePropfind(await res.text(), basePath, path);
    },

    async read(path) {
      const res = await fetchFn(urlOf(path), { method: 'GET', headers: headers() });
      if (!res.ok) throw Object.assign(new Error('GET failed: ' + res.status), { code: res.status === 404 ? 'NOT_FOUND' : 'HTTP' });
      return { body: await res.text(), etag: res.headers?.get ? res.headers.get('ETag') : null };
    },

    async write(path, body, opts = {}) {
      const h = headers({ 'Content-Type': 'text/markdown; charset=utf-8' });
      if (opts.ifMatch) h['If-Match'] = opts.ifMatch; // truthiness: never send "null"/empty
      const res = await fetchFn(urlOf(path), { method: 'PUT', headers: h, body });
      if (res.status === 412) throw Object.assign(new Error('etag mismatch'), { code: 'ETAG_MISMATCH' });
      if (!res.ok) throw new Error('PUT failed: ' + res.status);
      let etag = res.headers?.get ? res.headers.get('ETag') : null;
      if (!etag) {
        // Some servers don't echo ETag on PUT; fetch it so future If-Match works.
        try { const r = await this.read(path); etag = r.etag || null; } catch { etag = null; }
      }
      return { etag };
    },

    async mkdir(path) {
      const res = await fetchFn(urlOf(path), { method: 'MKCOL', headers: headers() });
      if (!res.ok && res.status !== 405) throw new Error('MKCOL failed: ' + res.status); // 405 = already exists
    },

    async remove(path) {
      const res = await fetchFn(urlOf(path), { method: 'DELETE', headers: headers() });
      if (!res.ok && res.status !== 404) throw new Error('DELETE failed: ' + res.status);
    },

    async move(from, to) {
      const res = await fetchFn(urlOf(from), { method: 'MOVE', headers: headers({ Destination: urlOf(to), Overwrite: 'T' }) });
      if (!res.ok) throw new Error('MOVE failed: ' + res.status);
    },

    async exists(path) {
      const res = await fetchFn(urlOf(path), { method: 'PROPFIND', headers: headers({ Depth: '0' }) });
      return res.ok || res.status === 207;
    },
  };
}
