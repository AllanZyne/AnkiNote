import { Router } from 'express';
import { createDeck, listDecks, renameDeck, deleteDeck } from '../../db/decks.js';

export function decksRouter(db) {
  const r = Router();
  r.get('/', (_req, res) => res.json(listDecks(db)));
  r.post('/', (req, res) => {
    const { name, parentId = null } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    res.status(201).json(createDeck(db, { name, parentId }));
  });
  r.patch('/:id', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    renameDeck(db, Number(req.params.id), name);
    res.json(listDecks(db).find(d => d.id === Number(req.params.id)));
  });
  r.delete('/:id', (req, res) => {
    deleteDeck(db, Number(req.params.id));
    res.status(204).end();
  });
  return r;
}
