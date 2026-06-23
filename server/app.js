import express from 'express';
import { boxesRouter } from './routes/boxes.js';
import { noteTypesRouter } from './routes/noteTypes.js';

export function buildApp(db) {
  const app = express();
  app.use(express.json());
  app.use('/api/boxes', boxesRouter(db));
  app.use('/api/note-types', noteTypesRouter(db));
  return app;
}
