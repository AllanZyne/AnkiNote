import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb } from '../../db/connection.js';
import { buildApp } from '../app.js';

let app;
beforeEach(() => { app = buildApp(openDb(':memory:')); });

describe('deck routes', () => {
  it('creates and lists decks', async () => {
    const created = await request(app).post('/api/decks').send({ name: 'Spanish' });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Spanish');
    const list = await request(app).get('/api/decks');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it('renames and deletes a deck', async () => {
    const { body } = await request(app).post('/api/decks').send({ name: 'Old' });
    const renamed = await request(app).patch(`/api/decks/${body.id}`).send({ name: 'New' });
    expect(renamed.body.name).toBe('New');
    const del = await request(app).delete(`/api/decks/${body.id}`);
    expect(del.status).toBe(204);
  });

  it('400s on missing name', async () => {
    const res = await request(app).post('/api/decks').send({});
    expect(res.status).toBe(400);
  });

  it('pins a deck via PATCH', async () => {
    const { body } = await request(app).post('/api/decks').send({ name: 'D' });
    const res = await request(app).patch(`/api/decks/${body.id}`).send({ pinned: true });
    expect(res.status).toBe(200);
    expect(res.body.pinned).toBe(true);
  });

  it('archives a deck via PATCH', async () => {
    const { body } = await request(app).post('/api/decks').send({ name: 'D' });
    const res = await request(app).patch(`/api/decks/${body.id}`).send({ archived: true });
    expect(res.body.archived).toBe(true);
  });

  it('400s on an empty PATCH body', async () => {
    const { body } = await request(app).post('/api/decks').send({ name: 'D' });
    const res = await request(app).patch(`/api/decks/${body.id}`).send({});
    expect(res.status).toBe(400);
  });

  it('409s on creating a duplicate deck', async () => {
    await request(app).post('/api/decks').send({ name: 'Spanish' });
    const res = await request(app).post('/api/decks').send({ name: 'Spanish' });
    expect(res.status).toBe(409);
  });

  it('400s on an invalid deck name', async () => {
    const res = await request(app).post('/api/decks').send({ name: 'A::' });
    expect(res.status).toBe(400);
  });

  it('renames a deck to change its level', async () => {
    await request(app).post('/api/decks').send({ name: 'Spanish::Verbs' });
    const list = (await request(app).get('/api/decks')).body;
    const spanish = list.find(d => d.name === 'Spanish');
    const res = await request(app).patch(`/api/decks/${spanish.id}`).send({ name: 'Language' });
    expect(res.status).toBe(200);
    const after = (await request(app).get('/api/decks')).body.map(d => d.name).sort();
    expect(after).toEqual(['Language', 'Language::Verbs']);
  });
});
