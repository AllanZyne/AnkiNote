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
  return app;
}
