# Anki-style Deck Path Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch decks to Anki's string-path model — a deck *is* its full `::`-delimited path; renaming changes its level (descendants rewrite by prefix, missing intermediates auto-create, collisions merge) — and make the deck `⋯` menu close on outside click.

**Architecture:** Drop `deck.parent_id`; the `name` column holds the full path (e.g. `"Spanish::Verbs"`) and the tree is derived by splitting on `::`. The db layer owns path validation, ancestor auto-creation, prefix rewrite, merge, and prefix cascade-delete. A pure `buildDeckTree` helper turns the flat path list into a nested tree (synthesizing implied intermediate nodes) for `DeckTree`.

**Tech Stack:** Node 20 (ESM), better-sqlite3, Express 4, Vite + React 18, Vitest (node + jsdom), supertest.

## Global Constraints

- Node 20.x, ESM modules everywhere (`"type": "module"`).
- SQLite via `better-sqlite3` only; synchronous API. Store booleans as 0/1, return JS booleans from the db layer.
- A deck is its full `::` path string in `name`; there is no `parent_id` after this change.
- Deck names are **case-sensitive**; segments are trimmed; **no empty segments** (reject `"A::"`, `"::B"`, `"A::::B"`, empty/whitespace name); **names are unique**.
- Rename semantics: rewrite the deck and every `oldPath::`-prefixed descendant; auto-create missing ancestors of the new path; on collision **merge** (move the colliding row's notes into the renamed/survivor row, delete the duplicate). Reject moving a deck into its own subtree.
- `notes.deck_id` references a deck row by stable `id`; notes follow renames automatically. Merge is the only operation that re-points `deck_id`.
- Each db/API/helper task is TDD (failing test first). Commit after every task with a `feat:`/`fix:`/`test:` prefix. Do not push.
- All paths relative to repo root `/localdisk2/yzhao/work/card_note`; web tests run from `web/`.

---

## File Structure

```
db/schema.sql                          # MODIFY: deck table drops parent_id
db/connection.js                       # MODIFY: add parent_id→path rebuild migration
db/decks.js                            # MODIFY: validateDeckPath; create(auto-ancestors,dup); list(no parentId); rename(rewrite+merge); delete(prefix)
db/__tests__/decks.test.js             # MODIFY: path validation, create, delete, list
db/__tests__/deck-rename.test.js       # CREATE: rename/rewrite/merge cases
db/__tests__/migration.test.js         # CREATE: parent_id→path migration
server/routes/decks.js                 # MODIFY: POST 409 on dup; PATCH rename path logic
server/__tests__/decks.test.js         # MODIFY: rename reparent + merge; 409 dup
web/src/lib/deckTree.js                # CREATE: buildDeckTree(decks) pure helper
web/src/lib/deckTree.test.js           # CREATE: tree building + virtual nodes + sort
web/src/components/DeckTree.jsx        # MODIFY: use buildDeckTree; last-segment labels; virtual nodes have no menu
web/src/components/DeckTree.test.jsx   # MODIFY: path-based rendering
web/src/components/DeckMenu.jsx        # MODIFY: outside-click close
web/src/components/DeckMenu.test.jsx   # MODIFY: outside-click test
web/src/App.jsx                        # MODIFY: rename prompt prefills full path; addDeck sends {name} only
scripts/seed.js                        # MODIFY: create full-path decks
```

---

### Task 1: Schema drop parent_id + migration + validateDeckPath

**Files:**
- Modify: `db/schema.sql`
- Modify: `db/connection.js`
- Modify: `db/decks.js` (add `validateDeckPath` only)
- Test: `db/__tests__/migration.test.js` (create), `db/__tests__/decks.test.js` (add validate tests)

**Interfaces:**
- Produces:
  - `openDb(path)` migrates an existing `parent_id`-based deck table to full-path names and removes `parent_id`.
  - `validateDeckPath(name) -> { valid: boolean, error?: string, normalized?: string }` — trims each `::` segment; invalid if any segment empty or whole name empty; `normalized` = trimmed segments joined by `::`.

- [ ] **Step 1: Update `db/schema.sql`** — replace the `deck` table block with (no `parent_id`):

```sql
CREATE TABLE IF NOT EXISTS deck (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  pinned    INTEGER NOT NULL DEFAULT 0,
  archived  INTEGER NOT NULL DEFAULT 0
);
```

- [ ] **Step 2: Write the failing migration test** `db/__tests__/migration.test.js`:

```js
import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { rmSync } from 'node:fs';
import { openDb } from '../connection.js';
import { listDecks } from '../decks.js';

const PATH = `/tmp/ankinote-deckmig-${process.pid}.db`;
afterEach(() => rmSync(PATH, { force: true }));

describe('parent_id -> path migration', () => {
  it('converts nested parent_id decks to full-path names and drops parent_id', () => {
    const raw = new Database(PATH);
    raw.exec(`CREATE TABLE deck (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      parent_id INTEGER REFERENCES deck(id) ON DELETE CASCADE,
      pinned INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0)`);
    const ins = raw.prepare('INSERT INTO deck (name, parent_id, pinned) VALUES (?, ?, ?)');
    const s = ins.run('Spanish', null, 1).lastInsertRowid;
    ins.run('Verbs', s, 0);
    raw.close();

    const db = openDb(PATH);
    const names = listDecks(db).map(d => d.name).sort();
    expect(names).toEqual(['Spanish', 'Spanish::Verbs']);
    expect(listDecks(db).find(d => d.name === 'Spanish').pinned).toBe(true);
    const cols = db.prepare('PRAGMA table_info(deck)').all().map(c => c.name);
    expect(cols).not.toContain('parent_id');
  });
});
```

- [ ] **Step 3: Add validate tests** — append inside `describe('decks', ...)` in `db/__tests__/decks.test.js`, and add `validateDeckPath` to the import from `../decks.js`:

```js
  it('validateDeckPath accepts a nested path and normalizes whitespace', () => {
    expect(validateDeckPath(' Spanish :: Verbs ')).toMatchObject({ valid: true, normalized: 'Spanish::Verbs' });
  });

  it('validateDeckPath rejects empty segments and empty names', () => {
    expect(validateDeckPath('Spanish::').valid).toBe(false);
    expect(validateDeckPath('::Verbs').valid).toBe(false);
    expect(validateDeckPath('A::::B').valid).toBe(false);
    expect(validateDeckPath('   ').valid).toBe(false);
  });
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test -- db/__tests__/migration.test.js db/__tests__/decks.test.js`
Expected: FAIL — `validateDeckPath` undefined; migration leaves `parent_id` / short names.

- [ ] **Step 5: Implement migration in `db/connection.js`** — replace the file with:

```js
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(join(here, 'schema.sql'), 'utf8');

function migrateDeckColumns(db) {
  const cols = db.prepare('PRAGMA table_info(deck)').all().map(c => c.name);
  if (!cols.includes('pinned'))   db.exec('ALTER TABLE deck ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('archived')) db.exec('ALTER TABLE deck ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
}

function migrateDeckToPaths(db) {
  const cols = db.prepare('PRAGMA table_info(deck)').all().map(c => c.name);
  if (!cols.includes('parent_id')) return; // already path-based
  const rows = db.prepare('SELECT id, name, parent_id AS parentId, pinned, archived FROM deck').all();
  const byId = new Map(rows.map(r => [r.id, r]));
  const pathOf = (r) => r.parentId == null ? r.name : `${pathOf(byId.get(r.parentId))}::${r.name}`;
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`CREATE TABLE deck_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0)`);
    const ins = db.prepare('INSERT INTO deck_new (id, name, pinned, archived) VALUES (?, ?, ?, ?)');
    for (const r of rows) ins.run(r.id, pathOf(r), r.pinned, r.archived);
    db.exec('DROP TABLE deck');
    db.exec('ALTER TABLE deck_new RENAME TO deck');
  })();
  db.pragma('foreign_keys = ON');
}

export function openDb(path = ':memory:') {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrateDeckColumns(db);   // bring very old DBs up to pinned/archived first
  migrateDeckToPaths(db);   // then convert parent_id -> full-path names
  return db;
}
```

- [ ] **Step 6: Implement `validateDeckPath` in `db/decks.js`** — add at the top of the file (above `createDeck`):

```js
export function validateDeckPath(name) {
  if (typeof name !== 'string') return { valid: false, error: 'name must be a string' };
  const segments = name.split('::').map(s => s.trim());
  if (segments.length === 0 || segments.some(s => s === '')) {
    return { valid: false, error: 'deck name has empty segments' };
  }
  return { valid: true, normalized: segments.join('::') };
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- db/__tests__/migration.test.js db/__tests__/decks.test.js`
Expected: migration test PASS; validate tests PASS. (Other decks.test.js tests may still fail until Task 2 — that's expected; confirm the migration + validate ones pass.)

- [ ] **Step 8: Commit**

```bash
git add db/schema.sql db/connection.js db/decks.js db/__tests__/migration.test.js db/__tests__/decks.test.js
git commit -m "feat: migrate decks to full-path names; add validateDeckPath"
```

---

### Task 2: db create / list / delete (path-based)

**Files:**
- Modify: `db/decks.js`
- Test: `db/__tests__/decks.test.js`

**Interfaces:**
- Consumes: `validateDeckPath`, `openDb`.
- Produces:
  - `createDeck(db, { name }) -> { id, name, pinned: false, archived: false }` — normalize+validate; throw `Error('invalid deck name')` if invalid; throw `Error('deck exists')` if the normalized name already exists; **auto-create missing ancestor rows** (creating `"A::B::C"` also creates `"A"` and `"A::B"` if absent). Returns the leaf deck.
  - `listDecks(db) -> Array<{ id, name, pinned, archived }>` (no `parentId`).
  - `deleteDeck(db, id) -> void` — delete the deck and every row whose name starts with `name + "::"`.
  - `setDeckPinned`, `setDeckArchived` unchanged.

- [ ] **Step 1: Replace the create/list/delete tests** in `db/__tests__/decks.test.js`. Keep the existing pinned/archived and validate tests; replace the create/list/delete cases with:

```js
  it('creates a top-level deck with default flags', () => {
    const deck = createDeck(db, { name: 'Spanish' });
    expect(deck).toMatchObject({ name: 'Spanish', pinned: false, archived: false });
    expect(deck.id).toEqual(expect.any(Number));
  });

  it('auto-creates missing ancestors', () => {
    createDeck(db, { name: 'A::B::C' });
    expect(listDecks(db).map(d => d.name).sort()).toEqual(['A', 'A::B', 'A::B::C']);
  });

  it('does not duplicate an existing ancestor', () => {
    createDeck(db, { name: 'A' });
    createDeck(db, { name: 'A::B' });
    expect(listDecks(db).filter(d => d.name === 'A')).toHaveLength(1);
  });

  it('rejects creating a duplicate deck', () => {
    createDeck(db, { name: 'Spanish' });
    expect(() => createDeck(db, { name: 'Spanish' })).toThrow('deck exists');
  });

  it('rejects an invalid deck name', () => {
    expect(() => createDeck(db, { name: 'A::' })).toThrow('invalid deck name');
  });

  it('deletes a deck and its prefix descendants', () => {
    createDeck(db, { name: 'A::B::C' });
    createDeck(db, { name: 'A::X' });
    const ab = listDecks(db).find(d => d.name === 'A::B');
    deleteDeck(db, ab.id);
    expect(listDecks(db).map(d => d.name).sort()).toEqual(['A', 'A::X']);
  });
```

Ensure the import includes `createDeck, listDecks, deleteDeck, setDeckPinned, setDeckArchived, validateDeckPath`. (Remove any `renameDeck` usage from this file — rename is covered in Task 3's own test file. If existing tests reference `parentId`, delete those assertions.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- db/__tests__/decks.test.js`
Expected: FAIL — `createDeck` still uses old `parentId` signature / no auto-ancestors / no dup check.

- [ ] **Step 3: Implement in `db/decks.js`** — replace `createDeck`, `listDecks`, `deleteDeck` (keep `validateDeckPath`, `setDeckPinned`, `setDeckArchived`):

```js
function deckByName(db, name) {
  return db.prepare('SELECT id, name, pinned, archived FROM deck WHERE name = ?').get(name);
}

function ancestorPaths(name) {
  const segs = name.split('::');
  const paths = [];
  for (let i = 1; i < segs.length; i++) paths.push(segs.slice(0, i).join('::'));
  return paths;
}

export function createDeck(db, { name }) {
  const v = validateDeckPath(name);
  if (!v.valid) throw new Error('invalid deck name');
  const path = v.normalized;
  return db.transaction(() => {
    if (deckByName(db, path)) throw new Error('deck exists');
    const ins = db.prepare('INSERT INTO deck (name) VALUES (?)');
    for (const anc of ancestorPaths(path)) {
      if (!deckByName(db, anc)) ins.run(anc);
    }
    const id = ins.run(path).lastInsertRowid;
    return { id, name: path, pinned: false, archived: false };
  })();
}

export function listDecks(db) {
  return db.prepare('SELECT id, name, pinned, archived FROM deck ORDER BY name')
    .all().map(d => ({ ...d, pinned: !!d.pinned, archived: !!d.archived }));
}

export function deleteDeck(db, id) {
  const deck = db.prepare('SELECT name FROM deck WHERE id = ?').get(id);
  if (!deck) return;
  db.transaction(() => {
    db.prepare('DELETE FROM deck WHERE name = ? OR name LIKE ?').run(deck.name, `${deck.name}::%`);
  })();
}
```

(Leave `setDeckPinned`/`setDeckArchived` as they are.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- db/__tests__/decks.test.js`
Expected: PASS (validate + pinned/archived + create/list/delete).

- [ ] **Step 5: Commit**

```bash
git add db/decks.js db/__tests__/decks.test.js
git commit -m "feat: path-based deck create/list/delete with auto-ancestors"
```

---

### Task 3: db rename — prefix rewrite + auto-intermediate + merge

**Files:**
- Modify: `db/decks.js`
- Test: `db/__tests__/deck-rename.test.js` (create)

**Interfaces:**
- Consumes: `validateDeckPath`, `createDeck`, `listDecks`, helpers from Task 2.
- Produces: `renameDeck(db, id, newName) -> void`. Normalizes+validates `newName`. Rejects moving a deck into its own subtree (`newName === oldName` is a no-op; `newName` starting with `oldName + "::"` throws `Error('cannot move into own subtree')`). Rewrites the deck and every `oldName::`-prefixed descendant by prefix; auto-creates missing ancestors of `newName`; on each rewrite target whose new name collides with a *different* existing row, **merges** (re-points that row's notes to the renamed survivor, deletes the duplicate). All in one transaction.

- [ ] **Step 1: Write the failing tests** `db/__tests__/deck-rename.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../connection.js';
import { createDeck, listDecks, renameDeck } from '../decks.js';
import { createNoteType } from '../noteTypes.js';
import { createNote, listNotesInDeck } from '../notes.js';

let db, ntId;
beforeEach(() => {
  db = openDb(':memory:');
  ntId = createNoteType(db, {
    name: 'Basic', css: '',
    fields: [{ name: 'Front' }], templates: [{ name: 'C', frontHtml: '{{Front}}', backHtml: '' }],
  }).id;
});

const names = () => listDecks(db).map(d => d.name).sort();

describe('renameDeck', () => {
  it('rewrites descendants by prefix when a parent is renamed', () => {
    createDeck(db, { name: 'Spanish::Verbs' });
    const spanish = listDecks(db).find(d => d.name === 'Spanish');
    renameDeck(db, spanish.id, 'Language');
    expect(names()).toEqual(['Language', 'Language::Verbs']);
  });

  it('auto-creates intermediates when moving a deck deeper', () => {
    const verbs = createDeck(db, { name: 'Verbs' });
    renameDeck(db, verbs.id, 'Grammar::Verbs');
    expect(names()).toEqual(['Grammar', 'Grammar::Verbs']);
  });

  it('keeps notes with their deck across a rename (stable id)', () => {
    const d = createDeck(db, { name: 'Spanish' });
    createNote(db, { noteTypeId: ntId, deckId: d.id, values: { Front: 'hola' } });
    renameDeck(db, d.id, 'Language');
    expect(listNotesInDeck(db, d.id)).toHaveLength(1);
  });

  it('merges into the renamed survivor when the target name exists', () => {
    const a = createDeck(db, { name: 'A' });
    const b = createDeck(db, { name: 'B' });
    createNote(db, { noteTypeId: ntId, deckId: b.id, values: { Front: 'fromB' } });
    createNote(db, { noteTypeId: ntId, deckId: a.id, values: { Front: 'fromA' } });
    renameDeck(db, a.id, 'B'); // A -> B, collides with existing B => merge into A (survivor)
    expect(names()).toEqual(['B']);
    expect(listNotesInDeck(db, a.id)).toHaveLength(2); // both notes now under survivor (a.id, now named B)
    expect(listDecks(db).find(d => d.name === 'B').id).toBe(a.id);
  });

  it('rejects moving a deck into its own subtree', () => {
    const a = createDeck(db, { name: 'A' });
    expect(() => renameDeck(db, a.id, 'A::B')).toThrow('cannot move into own subtree');
  });

  it('rejects an invalid new name', () => {
    const a = createDeck(db, { name: 'A' });
    expect(() => renameDeck(db, a.id, 'A::')).toThrow('invalid deck name');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- db/__tests__/deck-rename.test.js`
Expected: FAIL — current `renameDeck` only does a flat `UPDATE name` by id (no rewrite/merge/validation).

- [ ] **Step 3: Implement `renameDeck` in `db/decks.js`** — replace the existing `renameDeck`:

```js
export function renameDeck(db, id, newName) {
  const v = validateDeckPath(newName);
  if (!v.valid) throw new Error('invalid deck name');
  const target = v.normalized;
  const row = db.prepare('SELECT id, name FROM deck WHERE id = ?').get(id);
  if (!row) throw new Error('deck not found');
  const oldName = row.name;
  if (target === oldName) return;
  if (target.startsWith(oldName + '::')) throw new Error('cannot move into own subtree');

  db.transaction(() => {
    // Auto-create missing ancestors of the new name.
    const insAnc = db.prepare('INSERT INTO deck (name) VALUES (?)');
    for (const anc of ancestorPaths(target)) {
      if (!deckByName(db, anc)) insAnc.run(anc);
    }
    // Rewrite the deck itself and all its prefix-descendants.
    const affected = db.prepare('SELECT id, name FROM deck WHERE name = ? OR name LIKE ?')
      .all(oldName, `${oldName}::%`);
    for (const a of affected) {
      const rewritten = target + a.name.slice(oldName.length);
      const clash = db.prepare('SELECT id FROM deck WHERE name = ? AND id != ?').get(rewritten, a.id);
      if (clash) {
        // Merge: move the colliding row's notes to the surviving (renamed) row, drop the duplicate.
        db.prepare('UPDATE note SET deck_id = ? WHERE deck_id = ?').run(a.id, clash.id);
        db.prepare('DELETE FROM deck WHERE id = ?').run(clash.id);
      }
      db.prepare('UPDATE deck SET name = ? WHERE id = ?').run(rewritten, a.id);
    }
  })();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- db/__tests__/deck-rename.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add db/decks.js db/__tests__/deck-rename.test.js
git commit -m "feat: rename decks with prefix rewrite, auto-intermediates, and merge"
```

---

### Task 4: API — POST 409 dup, PATCH rename

**Files:**
- Modify: `server/routes/decks.js`
- Test: `server/__tests__/decks.test.js`

**Interfaces:**
- Consumes: `createDeck`, `listDecks`, `deleteDeck`, `renameDeck`, `setDeckPinned`, `setDeckArchived`.
- Produces:
  - `POST /api/decks { name }` → `201 deck`; `400` invalid name; `409 { error: 'deck exists' }` duplicate.
  - `PATCH /api/decks/:id { name?, pinned?, archived? }` → `200 deck` (the row, looked up by id after the change); `400` invalid name / empty body; rename uses `renameDeck`.
  - `DELETE`, `GET` unchanged.

- [ ] **Step 1: Update tests** in `server/__tests__/decks.test.js`. Keep pin/archive/empty-body tests. Replace any nested-create-via-parentId test and add:

```js
  it('409s on creating a duplicate deck', async () => {
    await request(app).post('/api/decks').send({ name: 'Spanish' });
    const res = await request(app).post('/api/decks').send({ name: 'Spanish' });
    expect(res.status).toBe(409);
  });

  it('400s on an invalid deck name', async () => {
    const res = await request(app).post('/api/decks').send({ name: 'A::' });
    expect(res.status).toBe(400);
  });

  it('renames a deck to change its level', async () => {
    await request(app).post('/api/decks').send({ name: 'Spanish::Verbs' });
    const list = (await request(app).get('/api/decks')).body;
    const spanish = list.find(d => d.name === 'Spanish');
    const res = await request(app).patch(`/api/decks/${spanish.id}`).send({ name: 'Language' });
    expect(res.status).toBe(200);
    const after = (await request(app).get('/api/decks')).body.map(d => d.name).sort();
    expect(after).toEqual(['Language', 'Language::Verbs']);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- server/__tests__/decks.test.js`
Expected: FAIL — POST doesn't return 409/400 for these; rename path not wired.

- [ ] **Step 3: Implement — replace `server/routes/decks.js`**:

```js
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
    const id = Number(req.params.id);
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
    deleteDeck(db, Number(req.params.id));
    res.status(204).end();
  });
  return r;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- server/__tests__/decks.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/decks.js server/__tests__/decks.test.js
git commit -m "feat: deck API rename + 409 on duplicate create"
```

---

### Task 5: buildDeckTree pure helper

**Files:**
- Create: `web/src/lib/deckTree.js`, `web/src/lib/deckTree.test.js`

**Interfaces:**
- Produces: `buildDeckTree(decks) -> Array<Node>` where `Node = { segment, path, deck: deck|null, pinned, archived, children: Node[] }`. Splits each deck name on `::`, synthesizes implied intermediate nodes (`deck: null`, flags false), and sorts each sibling group by rank (pinned&!archived=0, neither=1, archived=2; archive wins) then case-insensitive segment.

- [ ] **Step 1: Write the failing test** `web/src/lib/deckTree.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildDeckTree } from './deckTree.js';

const d = (id, name, extra = {}) => ({ id, name, pinned: false, archived: false, ...extra });

describe('buildDeckTree', () => {
  it('nests decks by :: and labels by segment', () => {
    const tree = buildDeckTree([d(1, 'Spanish'), d(2, 'Spanish::Verbs')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].segment).toBe('Spanish');
    expect(tree[0].deck.id).toBe(1);
    expect(tree[0].children[0].segment).toBe('Verbs');
    expect(tree[0].children[0].deck.id).toBe(2);
  });

  it('synthesizes a virtual intermediate when no row exists for it', () => {
    const tree = buildDeckTree([d(2, 'Spanish::Verbs')]);
    expect(tree[0].segment).toBe('Spanish');
    expect(tree[0].deck).toBeNull();
    expect(tree[0].children[0].deck.id).toBe(2);
  });

  it('sorts siblings pinned-first, archived-last, then by name', () => {
    const tree = buildDeckTree([
      d(1, 'Bravo'), d(2, 'Alpha', { archived: true }),
      d(3, 'Charlie', { pinned: true }), d(4, 'Delta'),
    ]);
    expect(tree.map(n => n.segment)).toEqual(['Charlie', 'Bravo', 'Delta', 'Alpha']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `web/`): `npm test -- src/lib/deckTree.test.js`
Expected: FAIL — cannot find `./deckTree.js`.

- [ ] **Step 3: Implement `web/src/lib/deckTree.js`**:

```js
function rank(node) {
  if (node.archived) return 2;
  if (node.pinned) return 0;
  return 1;
}

function sortNodes(nodes) {
  nodes.sort((a, b) => rank(a) - rank(b) || a.segment.localeCompare(b.segment, undefined, { sensitivity: 'base' }));
  for (const n of nodes) sortNodes(n.children);
  return nodes;
}

export function buildDeckTree(decks) {
  const roots = [];
  const byPath = new Map();

  const ensure = (path) => {
    if (byPath.has(path)) return byPath.get(path);
    const segs = path.split('::');
    const segment = segs[segs.length - 1];
    const node = { segment, path, deck: null, pinned: false, archived: false, children: [] };
    byPath.set(path, node);
    if (segs.length === 1) {
      roots.push(node);
    } else {
      ensure(segs.slice(0, -1).join('::')).children.push(node);
    }
    return node;
  };

  for (const deck of decks) {
    const node = ensure(deck.name);
    node.deck = deck;
    node.pinned = deck.pinned;
    node.archived = deck.archived;
  }
  return sortNodes(roots);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `web/`): `npm test -- src/lib/deckTree.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/deckTree.js web/src/lib/deckTree.test.js
git commit -m "feat: add buildDeckTree path-to-tree helper"
```

---

### Task 6: DeckTree refactor (paths, virtual nodes)

**Files:**
- Modify: `web/src/components/DeckTree.jsx`
- Test: `web/src/components/DeckTree.test.jsx`

**Interfaces:**
- Consumes: `buildDeckTree` (Task 5), `DeckMenu`.
- Produces: `<DeckTree decks={[{id,name,pinned,archived}]} activeId onSelect onRename onTogglePin onToggleArchive onDelete />`
  - Builds the tree with `buildDeckTree`; renders each node's **last segment** as label, indented by depth.
  - A node with a real `deck` is selectable (`onSelect(node.deck.id)`) and renders `DeckMenu` wired to the four handlers (the menu receives `node.deck`).
  - A **virtual** node (`deck === null`) is non-selectable (no `onClick` select, or no-op) and renders **no** menu.
  - Archived real-deck nodes carry the `archived` class.

- [ ] **Step 1: Replace `web/src/components/DeckTree.test.jsx`**:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DeckTree from './DeckTree.jsx';

const noop = () => {};
const handlers = { onRename: noop, onTogglePin: noop, onToggleArchive: noop, onDelete: noop };
const d = (id, name, extra = {}) => ({ id, name, pinned: false, archived: false, ...extra });

describe('DeckTree', () => {
  it('renders last-segment labels nested by path', () => {
    render(<DeckTree decks={[d(1, 'Spanish'), d(2, 'Spanish::Verbs')]}
      activeId={null} onSelect={noop} {...handlers} />);
    expect(screen.getByText('Spanish')).toBeTruthy();
    expect(screen.getByText('Verbs')).toBeTruthy();
  });

  it('selects by deck id on click', () => {
    const onSelect = vi.fn();
    render(<DeckTree decks={[d(2, 'Spanish::Verbs'), d(1, 'Spanish')]}
      activeId={null} onSelect={onSelect} {...handlers} />);
    fireEvent.click(screen.getByText('Verbs'));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('renders a virtual intermediate without a menu', () => {
    const { container } = render(<DeckTree decks={[d(2, 'Spanish::Verbs')]}
      activeId={null} onSelect={noop} {...handlers} />);
    // Only the real deck (Verbs) has a menu trigger; the virtual Spanish does not.
    expect(container.querySelectorAll('[aria-label="Deck menu"]')).toHaveLength(1);
  });

  it('marks archived decks with the archived class', () => {
    const { container } = render(<DeckTree decks={[d(1, 'Old', { archived: true })]}
      activeId={null} onSelect={noop} {...handlers} />);
    expect(container.querySelector('.deck-node.archived')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `web/`): `npm test -- src/components/DeckTree.test.jsx`
Expected: FAIL — current DeckTree reads `parentId` and renders full names; virtual-node handling absent.

- [ ] **Step 3: Replace `web/src/components/DeckTree.jsx`**:

```jsx
import React from 'react';
import DeckMenu from './DeckMenu.jsx';
import { buildDeckTree } from '../lib/deckTree.js';

function DeckNode({ node, activeId, onSelect, actions, depth }) {
  const real = node.deck;
  const cls = `deck-node${real && real.id === activeId ? ' active' : ''}${node.archived ? ' archived' : ''}`;
  return (
    <div>
      <div
        className={cls}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => real && onSelect(real.id)}
      >
        <span className="deck-name">{node.segment}</span>
        {real && (
          <DeckMenu
            deck={real}
            onRename={actions.onRename}
            onTogglePin={actions.onTogglePin}
            onToggleArchive={actions.onToggleArchive}
            onDelete={actions.onDelete}
          />
        )}
      </div>
      {node.children.map(c => (
        <DeckNode key={c.path} node={c} activeId={activeId}
          onSelect={onSelect} actions={actions} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function DeckTree({
  decks, activeId, onSelect, onRename, onTogglePin, onToggleArchive, onDelete,
}) {
  const actions = { onRename, onTogglePin, onToggleArchive, onDelete };
  const tree = buildDeckTree(decks);
  return (
    <div>
      {tree.map(n => (
        <DeckNode key={n.path} node={n} activeId={activeId}
          onSelect={onSelect} actions={actions} depth={0} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `web/`): `npm test -- src/components/DeckTree.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/DeckTree.jsx web/src/components/DeckTree.test.jsx
git commit -m "feat: render deck tree from :: paths with virtual intermediates"
```

---

### Task 7: DeckMenu outside-click close

**Files:**
- Modify: `web/src/components/DeckMenu.jsx`
- Test: `web/src/components/DeckMenu.test.jsx`

**Interfaces:**
- Produces: same `DeckMenu` props; additionally, while open, a document `mousedown` outside the menu root closes it. Existing close-after-action and `stopPropagation` behavior retained.

- [ ] **Step 1: Add the failing test** — append inside `describe('DeckMenu', ...)` in `web/src/components/DeckMenu.test.jsx`:

```jsx
  it('closes when clicking outside the menu', () => {
    setup();
    fireEvent.click(screen.getByLabelText('Deck menu'));
    expect(screen.getByText('Rename')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Rename')).toBeNull();
  });

  it('does not close when clicking inside the menu container', () => {
    setup();
    fireEvent.click(screen.getByLabelText('Deck menu'));
    fireEvent.mouseDown(screen.getByText('Rename'));
    // mousedown inside should not close before the click action fires
    expect(screen.getByText('Rename')).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `web/`): `npm test -- src/components/DeckMenu.test.jsx`
Expected: FAIL — outside `mousedown` does not currently close the menu.

- [ ] **Step 3: Update `web/src/components/DeckMenu.jsx`**:

```jsx
import React, { useState, useEffect, useRef } from 'react';

export default function DeckMenu({ deck, onRename, onTogglePin, onToggleArchive, onDelete }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const run = (fn) => (e) => {
    e.stopPropagation();
    setOpen(false);
    fn(deck);
  };

  const toggle = (e) => {
    e.stopPropagation();
    setOpen(v => !v);
  };

  return (
    <span className="deck-menu" ref={rootRef}>
      <button className="deck-menu-trigger" aria-label="Deck menu" onClick={toggle}>⋯</button>
      {open && (
        <div className="deck-menu-list">
          <button onClick={run(onRename)}>Rename</button>
          <button onClick={run(onTogglePin)}>{deck.pinned ? 'Unpin' : 'Pin'}</button>
          <button onClick={run(onToggleArchive)}>{deck.archived ? 'Unarchive' : 'Archive'}</button>
          <button onClick={run(onDelete)}>Delete</button>
        </div>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `web/`): `npm test -- src/components/DeckMenu.test.jsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/DeckMenu.jsx web/src/components/DeckMenu.test.jsx
git commit -m "feat: close deck menu on outside click"
```

---

### Task 8: App wiring + seed (full-path decks)

**Files:**
- Modify: `web/src/App.jsx`
- Modify: `scripts/seed.js`
- Test: full web suite + build.

**Interfaces:**
- Consumes: `api.createDeck({ name })`, `api.renameDeck(id, name)`, `DeckTree` (path-based).
- Produces: `App.addDeck` prompts for a full path and sends `{ name }` only (no `parentId`); `App.renameDeck` prompt pre-fills the deck's full path (`deck.name`). Other handlers unchanged. `seed.js` creates full-path decks.

- [ ] **Step 1: Update `addDeck` in `web/src/App.jsx`** — replace the existing `addDeck`:

```jsx
  const addDeck = async () => {
    const name = prompt('New deck (use :: for sub-decks, e.g. Spanish::Verbs):');
    if (name) { await api.createDeck({ name }); refreshDecks(); }
  };
```

(The existing `renameDeck` already does `prompt('Rename deck:', deck.name)` — since `deck.name` is now the full path, it already pre-fills the path. Leave it as-is. Leave `togglePin`/`toggleArchive`/`removeDeck` and the `<DeckTree .../>` props block unchanged.)

- [ ] **Step 2: Update `scripts/seed.js`** — replace the deck-creation lines:

```js
  const spanish = createDeck(db, { name: 'Spanish' });
  const verbs = createDeck(db, { name: 'Spanish::Verbs' });
  const math = createDeck(db, { name: 'Math' });
  createNote(db, { noteTypeId: basic.id, deckId: spanish.id,
    values: { Front: '**hola**', Back: 'hello' } });
  createNote(db, { noteTypeId: basic.id, deckId: verbs.id,
    values: { Front: 'comer', Back: 'to eat' } });
  createNote(db, { noteTypeId: basic.id, deckId: math.id,
    values: { Front: 'Area of a circle of radius $r$?', Back: '$$A = \\pi r^2$$' } });
```

- [ ] **Step 3: Run the full web suite**

Run (from `web/`): `npm test`
Expected: PASS — render, api, Card, deckTree, DeckTree, DeckMenu, NoteEditor, NoteTypeManager, BrowseView.

- [ ] **Step 4: Run the full db+server suite**

Run (from repo root): `npm test`
Expected: PASS — all db + server suites green (decks, deck-rename, migration, notes, noteTypes, connection, server routes).

- [ ] **Step 5: Build and reseed**

Run (from `web/`): `npm run build` → success.
Run (from repo root): `rm -f ankinote.db && npm run seed` → "Seeded demo data." (ankinote.db is gitignored; do not commit it).

- [ ] **Step 6: Commit**

```bash
git add web/src/App.jsx scripts/seed.js
git commit -m "feat: deck path prompts and full-path seed data"
```

---

## Self-Review Notes

- **Spec coverage:** model change + parent_id→path migration (Task 1); validateDeckPath rules (Task 1); create auto-ancestors + dup reject (Task 2); list without parentId (Task 2); delete prefix cascade (Task 2); rename prefix rewrite + auto-intermediate + merge + own-subtree reject (Task 3); API POST 409 / PATCH rename (Task 4); buildDeckTree with virtual nodes + rank sort (Task 5); DeckTree last-segment labels + virtual no-menu (Task 6); outside-click close (Task 7); rename prefill full path + new-deck full path + seed (Task 8). Non-goals (DnD, separate archived view, case-insensitive) respected.
- **Type consistency:** deck object `{id,name,pinned,archived}` (no parentId) consistent across db→API→client→buildDeckTree→DeckTree. `validateDeckPath` returns `{valid,error?,normalized?}` used the same in Task 1/2/3. `buildDeckTree` Node shape `{segment,path,deck,pinned,archived,children}` matches between Task 5 and Task 6. `renameDeck(db,id,newName)`, `createDeck(db,{name})`, `deleteDeck(db,id)` signatures match across db/API/seed.
- **Placeholder scan:** none — every step has concrete code + commands.
- **Merge tie-break note:** per the approved spec, the renamed deck is the survivor (its `id` persists), the pre-existing collider's notes move into it and the collider row is deleted. Task 3's merge test asserts exactly this (survivor id == renamed deck's id).
- **Migration note:** SQLite cannot DROP COLUMN on a foreign-key column (`parent_id` self-FK), so Task 1 rebuilds the table (create `deck_new`, copy computed paths, drop, rename) with `foreign_keys` toggled off around the rebuild — the documented safe pattern.
