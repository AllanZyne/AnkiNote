import express from 'express';
import { boxesRouter } from './routes/boxes.js';

export function buildApp(db) {
  const app = express();
  app.use(express.json());
  app.use('/api/boxes', boxesRouter(db));
  return app;
}
