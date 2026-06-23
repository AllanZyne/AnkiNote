import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb } from '../../db/connection.js';
import { buildApp } from '../app.js';

let app, db;
const basic = {
  name: 'Basic', css: '',
  fields: [{ name: 'Front' }, { name: 'Back' }],
  templates: [{ name: 'Card 1', frontHtml: '{{Front}}', backHtml: '{{Back}}' }],
};

async function setup() {
  db = openDb(':memory:'); app = buildApp(db);
  const nt = (await request(app).post('/api/note-types').send(basic)).body;
  const box = (await request(app).post('/api/boxes').send({ name: 'B' })).body;
  return { ntId: nt.id, boxId: box.id };
}

describe('note routes', () => {
  let ids;
  beforeEach(async () => { ids = await setup(); });

  it('creates a note and lists it in its box', async () => {
    const created = await request(app).post('/api/notes')
      .send({ noteTypeId: ids.ntId, boxId: ids.boxId, values: { Front: 'hola', Back: 'hi' } });
    expect(created.status).toBe(201);
    const list = await request(app).get(`/api/notes?box=${ids.boxId}`);
    expect(list.body).toHaveLength(1);
  });

  it('searches notes by content', async () => {
    await request(app).post('/api/notes')
      .send({ noteTypeId: ids.ntId, boxId: ids.boxId, values: { Front: 'gato', Back: 'cat' } });
    const res = await request(app).get('/api/notes?q=cat');
    expect(res.body).toHaveLength(1);
  });

  it('updates and deletes a note', async () => {
    const created = await request(app).post('/api/notes')
      .send({ noteTypeId: ids.ntId, boxId: ids.boxId, values: { Front: 'a', Back: 'b' } });
    const upd = await request(app).put(`/api/notes/${created.body.id}`)
      .send({ values: { Front: 'A', Back: 'b' } });
    expect(upd.body.values.Front).toBe('A');
    const del = await request(app).delete(`/api/notes/${created.body.id}`);
    expect(del.status).toBe(204);
  });
});
