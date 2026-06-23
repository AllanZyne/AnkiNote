import { Router } from 'express';
import { createBox, listBoxes, renameBox, deleteBox } from '../../db/boxes.js';

export function boxesRouter(db) {
  const r = Router();
  r.get('/', (_req, res) => res.json(listBoxes(db)));
  r.post('/', (req, res) => {
    const { name, parentId = null } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    res.status(201).json(createBox(db, { name, parentId }));
  });
  r.patch('/:id', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    renameBox(db, Number(req.params.id), name);
    res.json(listBoxes(db).find(b => b.id === Number(req.params.id)));
  });
  r.delete('/:id', (req, res) => {
    deleteBox(db, Number(req.params.id));
    res.status(204).end();
  });
  return r;
}
