import { describe, it, expect, vi } from 'vitest';
import { makeWebdavProvider } from './webdav.js';

const PROPFIND_XML = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response><d:href>/dav/Spanish/</d:href>
    <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
  <d:response><d:href>/dav/Spanish/Verbs/</d:href>
    <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype>
      <d:getetag>"v1"</d:getetag><d:getlastmodified>Wed, 25 Jun 2026 10:00:00 GMT</d:getlastmodified></d:prop></d:propstat></d:response>
  <d:response><d:href>/dav/Spanish/top.md</d:href>
    <d:propstat><d:prop><d:resourcetype/><d:getetag>"e9"</d:getetag>
      <d:getcontentlength>5</d:getcontentlength>
      <d:getlastmodified>Wed, 25 Jun 2026 11:00:00 GMT</d:getlastmodified></d:prop></d:propstat></d:response>
</d:multistatus>`;

function mockFetch(handler) {
  return vi.fn(async (url, opts = {}) => handler(url, opts));
}

const cfg = { baseUrl: 'https://dav.example.com/dav', authHeader: 'Basic xyz' };

describe('webdav provider', () => {
  it('list parses PROPFIND children (excludes the queried collection)', async () => {
    const fetchFn = mockFetch(async (url, opts) => {
      expect(opts.method).toBe('PROPFIND');
      expect(opts.headers.Depth).toBe('1');
      expect(opts.headers.Authorization).toBe('Basic xyz');
      return { ok: true, status: 207, text: async () => PROPFIND_XML };
    });
    const p = makeWebdavProvider({ ...cfg, fetchFn });
    const items = await p.list('Spanish');
    const byPath = Object.fromEntries(items.map(e => [e.path, e]));
    expect(byPath['Spanish']).toBeUndefined();             // excludes self
    expect(byPath['Spanish/Verbs'].type).toBe('dir');
    expect(byPath['Spanish/top.md'].type).toBe('file');
    expect(byPath['Spanish/top.md'].etag).toBe('"e9"');
  });

  it('read returns body and ETag', async () => {
    const fetchFn = mockFetch(async () => ({
      ok: true, status: 200, text: async () => 'hello',
      headers: { get: (h) => (h.toLowerCase() === 'etag' ? '"e1"' : null) },
    }));
    const p = makeWebdavProvider({ ...cfg, fetchFn });
    const r = await p.read('Spanish/top.md');
    expect(r.body).toBe('hello');
    expect(r.etag).toBe('"e1"');
  });

  it('write sends PUT, includes If-Match, returns new ETag', async () => {
    let seen;
    const fetchFn = mockFetch(async (url, opts) => {
      seen = opts;
      return { ok: true, status: 200, text: async () => '',
        headers: { get: (h) => (h.toLowerCase() === 'etag' ? '"e2"' : null) } };
    });
    const p = makeWebdavProvider({ ...cfg, fetchFn });
    const res = await p.write('x.md', 'data', { ifMatch: '"e1"' });
    expect(seen.method).toBe('PUT');
    expect(seen.headers['If-Match']).toBe('"e1"');
    expect(res.etag).toBe('"e2"');
  });

  it('write with no cached etag does NOT send If-Match (falsy guard)', async () => {
    let seen;
    const fetchFn = mockFetch(async (url, opts) => {
      if (opts.method === 'PUT') { seen = opts; return { ok: true, status: 200, text: async () => '', headers: { get: () => null } }; }
      // follow-up PROPFIND for the etag
      return { ok: true, status: 207, text: async () => PROPFIND_XML };
    });
    const p = makeWebdavProvider({ ...cfg, fetchFn });
    await p.write('x.md', 'data', { ifMatch: null });
    expect('If-Match' in seen.headers).toBe(false);
  });

  it('write with no ETag response fetches the etag via follow-up read', async () => {
    const fetchFn = mockFetch(async (url, opts) => {
      if (opts.method === 'PUT') return { ok: true, status: 201, text: async () => '', headers: { get: () => null } };
      if (opts.method === 'GET') return { ok: true, status: 200, text: async () => 'data', headers: { get: (h) => (h.toLowerCase() === 'etag' ? '"follow"' : null) } };
      return { ok: true, status: 207, text: async () => PROPFIND_XML };
    });
    const p = makeWebdavProvider({ ...cfg, fetchFn });
    const res = await p.write('x.md', 'data', {});
    expect(res.etag).toBe('"follow"');
  });

  it('write throws ETAG_MISMATCH on 412', async () => {
    const fetchFn = mockFetch(async () => ({ ok: false, status: 412, text: async () => '' }));
    const p = makeWebdavProvider({ ...cfg, fetchFn });
    await expect(p.write('x.md', 'd', { ifMatch: '"old"' }))
      .rejects.toMatchObject({ code: 'ETAG_MISMATCH' });
  });

  it('move sends MOVE with an absolute Destination', async () => {
    let seen;
    const fetchFn = mockFetch(async (url, opts) => { seen = { url, opts }; return { ok: true, status: 201, text: async () => '' }; });
    const p = makeWebdavProvider({ ...cfg, fetchFn });
    await p.move('A/n.md', 'Z/n.md');
    expect(seen.opts.method).toBe('MOVE');
    expect(seen.opts.headers.Destination).toContain('/dav/Z/n.md');
  });

  it('exists returns false on 404', async () => {
    const fetchFn = mockFetch(async () => ({ ok: false, status: 404, text: async () => '' }));
    const p = makeWebdavProvider({ ...cfg, fetchFn });
    expect(await p.exists('nope.md')).toBe(false);
  });
});
