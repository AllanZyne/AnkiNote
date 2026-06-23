import { Router } from 'express';
import {
  createNoteType, getNoteType, listNoteTypes, updateNoteType, deleteNoteType
} from '../../db/noteTypes.js';

export function noteTypesRouter(db) {
  const r = Router();
  r.get('/', (_req, res) => res.json(listNoteTypes(db)));
  r.get('/:id', (req, res) => {
    const nt = getNoteType(db, Number(req.params.id));
    if (!nt) return res.status(404).json({ error: 'not found' });
    res.json(nt);
  });
  r.post('/', (req, res) => {
    const { name, css = '', fields, templates } = req.body;
    if (!name || !Array.isArray(fields) || !Array.isArray(templates)) {
      return res.status(400).json({ error: 'name, fields, templates required' });
    }
    res.status(201).json(createNoteType(db, { name, css, fields, templates }));
  });
  r.put('/:id', (req, res) => {
    const { name, css = '', fields, templates } = req.body;
    if (!name || !Array.isArray(fields) || !Array.isArray(templates)) {
      return res.status(400).json({ error: 'name, fields, templates required' });
    }
    res.json(updateNoteType(db, Number(req.params.id), { name, css, fields, templates }));
  });
  r.delete('/:id', (req, res) => {
    try {
      deleteNoteType(db, Number(req.params.id));
      res.status(204).end();
    } catch (e) {
      res.status(409).json({ error: e.message });
    }
  });
  return r;
}
