import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb } from '../../db/connection.js';
import { buildApp } from '../app.js';
import { randomUUID } from 'node:crypto';

let app;
beforeEach(() => { app = buildApp(openDb(':memory:')); });

describe('sync routes', () => {
  it('push then pull round-trips a deck', async () => {
    const id = randomUUID();
    const push = await request(app).post('/api/sync/push').send({ ops: [
      { entity: 'deck', id, type: 'upsert', updatedAt: '2026-06-25T10:00:00.000+00:00', payload: { name: 'Spanish', pinned: false, archived: false } },
    ] });
    expect(push.status).toBe(200);
    expect(push.body.applied).toEqual([{ entity: 'deck', id }]);
    const pull = await request(app).get('/api/sync/pull?since=2026-06-25T09:00:00.000%2B00:00');
    expect(pull.status).toBe(200);
    expect(pull.body.decks.find(d => d.id === id).name).toBe('Spanish');
    expect(pull.body.serverTime).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('400s when ops is not an array', async () => {
    const res = await request(app).post('/api/sync/push').send({ ops: 'nope' });
    expect(res.status).toBe(400);
  });

  it('pull with no since returns a full snapshot', async () => {
    const res = await request(app).get('/api/sync/pull');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.decks)).toBe(true);
    expect(Array.isArray(res.body.notes)).toBe(true);
    expect(Array.isArray(res.body.noteTypes)).toBe(true);
  });
});
