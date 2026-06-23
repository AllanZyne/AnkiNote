import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb } from '../../db/connection.js';
import { buildApp } from '../app.js';

let app;
beforeEach(() => { app = buildApp(openDb(':memory:')); });

const basic = {
  name: 'Basic', css: '.card{}',
  fields: [{ name: 'Front' }, { name: 'Back' }],
  templates: [{ name: 'Card 1', frontHtml: '{{Front}}', backHtml: '{{Back}}' }],
};

describe('note type routes', () => {
  it('creates, gets, and lists note types', async () => {
    const created = await request(app).post('/api/note-types').send(basic);
    expect(created.status).toBe(201);
    const id = created.body.id;
    const got = await request(app).get(`/api/note-types/${id}`);
    expect(got.body.fields.map(f => f.name)).toEqual(['Front', 'Back']);
    const list = await request(app).get('/api/note-types');
    expect(list.body).toHaveLength(1);
  });

  it('updates a note type', async () => {
    const { body } = await request(app).post('/api/note-types').send(basic);
    const put = await request(app).put(`/api/note-types/${body.id}`)
      .send({ ...basic, name: 'Renamed' });
    expect(put.body.name).toBe('Renamed');
  });

  it('404s for unknown id', async () => {
    const res = await request(app).get('/api/note-types/999');
    expect(res.status).toBe(404);
  });
});
