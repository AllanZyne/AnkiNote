import { describe, it, expect } from 'vitest';
import { makeMemoryProvider } from './memory.js';

describe('memory provider', () => {
  it('write then read round-trips with an etag', async () => {
    const p = makeMemoryProvider();
    const { etag } = await p.write('a/b.md', 'hello');
    expect(etag).toBeTruthy();
    const r = await p.read('a/b.md');
    expect(r.body).toBe('hello');
    expect(r.etag).toBe(etag);
  });

  it('list returns immediate children with inferred dirs', async () => {
    const p = makeMemoryProvider();
    await p.write('Spanish/Verbs/n1.md', 'x');
    await p.write('Spanish/top.md', 'y');
    const root = await p.list('Spanish');
    const byPath = Object.fromEntries(root.map(e => [e.path, e.type]));
    expect(byPath['Spanish/Verbs']).toBe('dir');
    expect(byPath['Spanish/top.md']).toBe('file');
  });

  it('exists reflects writes and removes', async () => {
    const p = makeMemoryProvider();
    await p.write('x.md', '1');
    expect(await p.exists('x.md')).toBe(true);
    await p.remove('x.md');
    expect(await p.exists('x.md')).toBe(false);
  });

  it('conditional write throws ETAG_MISMATCH on stale ifMatch', async () => {
    const p = makeMemoryProvider();
    const { etag } = await p.write('x.md', '1');
    await p.write('x.md', '2'); // bumps etag
    await expect(p.write('x.md', '3', { ifMatch: etag }))
      .rejects.toMatchObject({ code: 'ETAG_MISMATCH' });
  });

  it('move relocates a file and a whole subtree', async () => {
    const p = makeMemoryProvider();
    await p.write('A/n.md', '1');
    await p.write('A/B/m.md', '2');
    await p.move('A', 'Z');
    expect(await p.exists('A/n.md')).toBe(false);
    expect((await p.read('Z/n.md')).body).toBe('1');
    expect((await p.read('Z/B/m.md')).body).toBe('2');
  });

  it('seed populates initial files', async () => {
    const p = makeMemoryProvider({ '.ankinote/settings.json': '{}' });
    expect((await p.read('.ankinote/settings.json')).body).toBe('{}');
  });

  it('conditional write throws ETAG_MISMATCH on ifMatch against missing file', async () => {
    const p = makeMemoryProvider();
    await expect(p.write('missing.md', 'content', { ifMatch: 'any-etag' }))
      .rejects.toMatchObject({ code: 'ETAG_MISMATCH' });
  });
});
