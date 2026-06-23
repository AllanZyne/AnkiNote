import { openDb } from '../db/connection.js';
import { createNoteType, listNoteTypes } from '../db/noteTypes.js';
import { createBox } from '../db/boxes.js';
import { createNote } from '../db/notes.js';

const db = openDb(process.env.ANKINOTE_DB || 'ankinote.db');

if (listNoteTypes(db).length === 0) {
  const basic = createNoteType(db, {
    name: 'Basic',
    css: '.card { font-size: 22px; text-align: center; color: #222; }\nhr { margin: 16px 0; }',
    fields: [{ name: 'Front' }, { name: 'Back' }],
    templates: [{ name: 'Card 1', frontHtml: '{{Front}}', backHtml: '{{Front}}\n<hr>\n{{Back}}' }],
  });
  const spanish = createBox(db, { name: 'Spanish' });
  const verbs = createBox(db, { name: 'Verbs', parentId: spanish.id });
  createNote(db, { noteTypeId: basic.id, boxId: spanish.id,
    values: { Front: '**hola**', Back: 'hello' } });
  createNote(db, { noteTypeId: basic.id, boxId: verbs.id,
    values: { Front: 'comer', Back: 'to eat' } });
  console.log('Seeded demo data.');
} else {
  console.log('Database already has data; skipping seed.');
}
