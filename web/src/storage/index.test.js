import { describe, it, expect } from 'vitest';
import { makeProvider } from './index.js';

describe('makeProvider', () => {
  it('builds a memory provider', async () => {
    const p = makeProvider({ type: 'memory', seed: { 'x.md': 'hi' } });
    expect((await p.read('x.md')).body).toBe('hi');
  });
  it('builds a webdav provider', () => {
    const p = makeProvider({ type: 'webdav', baseUrl: 'https://d/dav', authHeader: 'Basic x' });
    expect(p.capabilities.supportsConditionalWrite).toBe(true);
  });
  it('throws on unknown type', () => {
    expect(() => makeProvider({ type: 'ftp' })).toThrow('unknown provider type: ftp');
  });
});
