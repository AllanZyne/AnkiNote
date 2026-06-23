import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './api.js';

beforeEach(() => {
  global.fetch = vi.fn(async (url, opts) => ({
    ok: true, status: 200,
    json: async () => ({ url, method: opts?.method || 'GET', body: opts?.body }),
  }));
});

describe('api client', () => {
  it('lists boxes via GET /api/boxes', async () => {
    const res = await api.listBoxes();
    expect(res.url).toBe('/api/boxes');
    expect(res.method).toBe('GET');
  });

  it('creates a note with POST and JSON body', async () => {
    await api.createNote({ noteTypeId: 1, boxId: 2, values: { Front: 'a' } });
    const call = global.fetch.mock.calls[0];
    expect(call[0]).toBe('/api/notes');
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(call[1].body)).toEqual({ noteTypeId: 1, boxId: 2, values: { Front: 'a' } });
  });

  it('searches notes via query param', async () => {
    const res = await api.searchNotes('cat');
    expect(res.url).toBe('/api/notes?q=cat');
  });
});
