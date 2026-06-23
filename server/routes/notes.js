import { Router } from 'express';
import {
  createNote, getNote, listNotesInBox, updateNote, deleteNote, searchNotes
} from '../../db/notes.js';

export function notesRouter(db) {
  const r = Router();
  r.get('/', (req, res) => {
    if (req.query.q != null) return res.json(searchNotes(db, String(req.query.q)));
    if (req.query.box != null) return res.json(listNotesInBox(db, Number(req.query.box)));
    res.json(searchNotes(db, ''));
  });
  r.get('/:id', (req, res) => {
    const note = getNote(db, Number(req.params.id));
    if (!note) return res.status(404).json({ error: 'not found' });
    res.json(note);
  });
  r.post('/', (req, res) => {
    const { noteTypeId, boxId, values } = req.body;
    if (!noteTypeId || !boxId || typeof values !== 'object') {
      return res.status(400).json({ error: 'noteTypeId, boxId, values required' });
    }
    res.status(201).json(createNote(db, { noteTypeId, boxId, values }));
  });
  r.put('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = getNote(db, id);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const { boxId, values } = req.body;
    res.json(updateNote(db, id, { boxId, values }));
  });
  r.delete('/:id', (req, res) => {
    deleteNote(db, Number(req.params.id));
    res.status(204).end();
  });
  return r;
}
