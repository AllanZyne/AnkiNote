import express from 'express';
import { decksRouter } from './routes/decks.js';
import { noteTypesRouter } from './routes/noteTypes.js';
import { notesRouter } from './routes/notes.js';

export function buildApp(db) {
  const app = express();
  app.use(express.json());
  app.use('/api/decks', decksRouter(db));
  app.use('/api/note-types', noteTypesRouter(db));
  app.use('/api/notes', notesRouter(db));

  app.use((err, req, res, next) => {
    if (err.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(400).json({ error: 'bad reference' });
    }
    res.status(500).json({ error: err.message });
  });

  return app;
}
