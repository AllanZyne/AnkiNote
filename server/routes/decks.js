import { Router } from 'express';
import {
  createDeck, listDecks, renameDeck, deleteDeck, setDeckPinned, setDeckArchived
} from '../../db/decks.js';

export function decksRouter(db) {
  const r = Router();
  r.get('/', (_req, res) => res.json(listDecks(db)));
  r.post('/', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
      res.status(201).json(createDeck(db, { name }));
    } catch (e) {
      if (e.message === 'deck exists') return res.status(409).json({ error: 'deck exists' });
      return res.status(400).json({ error: e.message });
    }
  });
  r.patch('/:id', (req, res) => {
    const id = req.params.id;
    const { name, pinned, archived } = req.body;
    const has = (v) => v !== undefined;
    if (!has(name) && !has(pinned) && !has(archived)) {
      return res.status(400).json({ error: 'name, pinned, or archived required' });
    }
    if (has(pinned) && typeof pinned !== 'boolean') {
      return res.status(400).json({ error: 'pinned must be boolean' });
    }
    if (has(archived) && typeof archived !== 'boolean') {
      return res.status(400).json({ error: 'archived must be boolean' });
    }
    try {
      if (has(name)) renameDeck(db, id, name);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    if (has(pinned)) setDeckPinned(db, id, pinned);
    if (has(archived)) setDeckArchived(db, id, archived);
    res.json(listDecks(db).find(d => d.id === id));
  });
  r.delete('/:id', (req, res) => {
    deleteDeck(db, req.params.id);
    res.status(204).end();
  });
  return r;
}
