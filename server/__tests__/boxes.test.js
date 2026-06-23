import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb } from '../../db/connection.js';
import { buildApp } from '../app.js';

let app;
beforeEach(() => { app = buildApp(openDb(':memory:')); });

describe('box routes', () => {
  it('creates and lists boxes', async () => {
    const created = await request(app).post('/api/boxes').send({ name: 'Spanish' });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Spanish');
    const list = await request(app).get('/api/boxes');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it('renames and deletes a box', async () => {
    const { body } = await request(app).post('/api/boxes').send({ name: 'Old' });
    const renamed = await request(app).patch(`/api/boxes/${body.id}`).send({ name: 'New' });
    expect(renamed.body.name).toBe('New');
    const del = await request(app).delete(`/api/boxes/${body.id}`);
    expect(del.status).toBe(204);
  });

  it('400s on missing name', async () => {
    const res = await request(app).post('/api/boxes').send({});
    expect(res.status).toBe(400);
  });
});
