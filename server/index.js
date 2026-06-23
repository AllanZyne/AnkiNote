import { openDb } from '../db/connection.js';
import { buildApp } from './app.js';

const db = openDb(process.env.ANKINOTE_DB || 'ankinote.db');
const app = buildApp(db);
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`AnkiNote API on http://localhost:${port}`));
