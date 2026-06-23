import express from 'express';
import { boxesRouter } from './routes/boxes.js';
import { noteTypesRouter } from './routes/noteTypes.js';
import { notesRouter } from './routes/notes.js';

export function buildApp(db) {
  const app = express();
  app.use(express.json());
  app.use('/api/boxes', boxesRouter(db));
  app.use('/api/note-types', noteTypesRouter(db));
  app.use('/api/notes', notesRouter(db));

  app.use((err, req, res, next) => {
    if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || (err.message && err.message.includes('FOREIGN KEY'))) {
      return res.status(400).json({ error: 'bad reference' });
    }
    res.status(500).json({ error: err.message });
  });

  return app;
}
