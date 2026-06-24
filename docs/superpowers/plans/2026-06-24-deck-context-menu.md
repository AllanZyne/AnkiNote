# Deck Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-deck `⋯` dropdown menu in the sidebar to rename, delete, pin, and archive decks, with pin/archive persisted in SQLite and reflected in per-sibling sort order.

**Architecture:** Two new boolean columns (`pinned`, `archived`) on the `deck` table, exposed as JS booleans through `listDecks` and toggled via an extended `PATCH /api/decks/:id`. The frontend adds a `DeckMenu` dropdown component; `DeckTree` sorts each sibling group by rank (pinned → normal → archived) and greys archived nodes; `App.jsx` wires the action handlers.

**Tech Stack:** Node 20 (ESM), better-sqlite3, Express 4, Vite + React 18, Vitest (node + jsdom), supertest.

## Global Constraints

- Node 20.x, ESM modules everywhere (`"type": "module"`).
- SQLite via `better-sqlite3` only; synchronous API. SQLite has no boolean type — store 0/1, return JS booleans from the db layer (`!!row.col`).
- `pinned` and `archived` are independent boolean flags; both default to 0 (false).
- Sort rank per sibling group: pinned&!archived = 0 (top), neither = 1, archived = 2 (bottom). Archive wins over pin if both set. Ties broken by case-insensitive name.
- Children always stay nested under their parent; pin/archive only reorders within a sibling group.
- Each db/API/render task is TDD (failing test first). React components ship with complete code plus a test.
- Commit after every task with a `feat:`/`test:` prefixed message. Do not push.
- All paths relative to repo root `/localdisk2/yzhao/work/card_note` (web tests run from `web/`).

---

## File Structure

```
db/schema.sql                          # MODIFY: add pinned/archived columns to deck
db/decks.js                            # MODIFY: listDecks returns booleans; createDeck defaults; add setDeckPinned/setDeckArchived
db/__tests__/decks.test.js             # MODIFY: cover flags + listDecks booleans
server/routes/decks.js                 # MODIFY: PATCH accepts {name?,pinned?,archived?}
server/__tests__/decks.test.js         # MODIFY: cover pin/archive PATCH
web/src/api.js                         # MODIFY: add updateDeck(id, patch)
web/src/api.test.js                    # MODIFY: cover updateDeck
web/src/components/DeckTree.jsx        # MODIFY: sort siblings by rank; archived class; render DeckMenu
web/src/components/DeckTree.test.jsx   # MODIFY: cover sort order + archived class
web/src/components/DeckMenu.jsx        # CREATE: the dropdown
web/src/components/DeckMenu.test.jsx   # CREATE: menu behavior
web/src/App.jsx                        # MODIFY: handlers (rename/pin/archive/delete) wired to DeckTree
web/src/styles.css                     # MODIFY: .deck-menu, .deck-node.archived, hover trigger
```

---

### Task 1: DB — pinned/archived columns + setters

**Files:**
- Modify: `db/schema.sql`
- Modify: `db/decks.js`
- Test: `db/__tests__/decks.test.js`

**Interfaces:**
- Consumes: `openDb` from `db/connection.js`.
- Produces:
  - `createDeck(db, { name, parentId = null }) -> { id, name, parentId, pinned: false, archived: false }`
  - `listDecks(db) -> Array<{ id, name, parentId, pinned: boolean, archived: boolean }>`
  - `setDeckPinned(db, id, pinned) -> void` (coerces boolean → 0/1)
  - `setDeckArchived(db, id, archived) -> void`
  - `renameDeck`, `deleteDeck` unchanged.

- [ ] **Step 1: Add columns to `db/schema.sql`**

Replace the `deck` table definition with:

```sql
CREATE TABLE IF NOT EXISTS deck (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  parent_id INTEGER REFERENCES deck(id) ON DELETE CASCADE,
  pinned    INTEGER NOT NULL DEFAULT 0,
  archived  INTEGER NOT NULL DEFAULT 0
);
```

- [ ] **Step 2: Write the failing tests** — append to `db/__tests__/decks.test.js` inside the `describe('decks', ...)` block:

```js
  it('defaults pinned and archived to false on create', () => {
    const deck = createDeck(db, { name: 'New' });
    expect(deck.pinned).toBe(false);
    expect(deck.archived).toBe(false);
    expect(listDecks(db)[0]).toMatchObject({ pinned: false, archived: false });
  });

  it('sets and clears the pinned flag', () => {
    const deck = createDeck(db, { name: 'D' });
    setDeckPinned(db, deck.id, true);
    expect(listDecks(db)[0].pinned).toBe(true);
    setDeckPinned(db, deck.id, false);
    expect(listDecks(db)[0].pinned).toBe(false);
  });

  it('sets and clears the archived flag', () => {
    const deck = createDeck(db, { name: 'D' });
    setDeckArchived(db, deck.id, true);
    expect(listDecks(db)[0].archived).toBe(true);
    setDeckArchived(db, deck.id, false);
    expect(listDecks(db)[0].archived).toBe(false);
  });
```

Also update the import line at the top of the file:

```js
import {
  createDeck, listDecks, renameDeck, deleteDeck, setDeckPinned, setDeckArchived
} from '../decks.js';
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- db/__tests__/decks.test.js`
Expected: FAIL — `setDeckPinned is not a function` (and pinned/archived undefined).

- [ ] **Step 4: Implement in `db/decks.js`**

Replace the whole file with:

```js
export function createDeck(db, { name, parentId = null }) {
  const info = db.prepare(
    'INSERT INTO deck (name, parent_id) VALUES (?, ?)'
  ).run(name, parentId);
  return { id: info.lastInsertRowid, name, parentId, pinned: false, archived: false };
}

export function listDecks(db) {
  return db.prepare(
    'SELECT id, name, parent_id AS parentId, pinned, archived FROM deck ORDER BY name'
  ).all().map(d => ({ ...d, pinned: !!d.pinned, archived: !!d.archived }));
}

export function renameDeck(db, id, name) {
  db.prepare('UPDATE deck SET name = ? WHERE id = ?').run(name, id);
}

export function setDeckPinned(db, id, pinned) {
  db.prepare('UPDATE deck SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id);
}

export function setDeckArchived(db, id, archived) {
  db.prepare('UPDATE deck SET archived = ? WHERE id = ?').run(archived ? 1 : 0, id);
}

export function deleteDeck(db, id) {
  db.prepare('DELETE FROM deck WHERE id = ?').run(id);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- db/__tests__/decks.test.js`
Expected: PASS (existing 4 + new 3 = 7).

- [ ] **Step 6: Commit**

```bash
git add db/schema.sql db/decks.js db/__tests__/decks.test.js
git commit -m "feat: add pinned/archived flags to decks"
```

---

### Task 2: API — PATCH accepts name/pinned/archived

**Files:**
- Modify: `server/routes/decks.js`
- Test: `server/__tests__/decks.test.js`

**Interfaces:**
- Consumes: `setDeckPinned`, `setDeckArchived`, `renameDeck`, `listDecks` from `db/decks.js`.
- Produces: `PATCH /api/decks/:id` accepts `{ name?, pinned?, archived? }`; applies each present field; returns the updated deck (200). Empty body or invalid types → 400.

- [ ] **Step 1: Write the failing tests** — append to `server/__tests__/decks.test.js` inside the `describe('deck routes', ...)` block:

```js
  it('pins a deck via PATCH', async () => {
    const { body } = await request(app).post('/api/decks').send({ name: 'D' });
    const res = await request(app).patch(`/api/decks/${body.id}`).send({ pinned: true });
    expect(res.status).toBe(200);
    expect(res.body.pinned).toBe(true);
  });

  it('archives a deck via PATCH', async () => {
    const { body } = await request(app).post('/api/decks').send({ name: 'D' });
    const res = await request(app).patch(`/api/decks/${body.id}`).send({ archived: true });
    expect(res.body.archived).toBe(true);
  });

  it('400s on an empty PATCH body', async () => {
    const { body } = await request(app).post('/api/decks').send({ name: 'D' });
    const res = await request(app).patch(`/api/decks/${body.id}`).send({});
    expect(res.status).toBe(400);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- server/__tests__/decks.test.js`
Expected: FAIL — `pinned`/`archived` not applied (body.pinned undefined); empty body currently 400 only via missing name, but the new field logic does not exist yet.

- [ ] **Step 3: Implement — replace `server/routes/decks.js`**

```js
import { Router } from 'express';
import {
  createDeck, listDecks, renameDeck, deleteDeck, setDeckPinned, setDeckArchived
} from '../../db/decks.js';

export function decksRouter(db) {
  const r = Router();
  r.get('/', (_req, res) => res.json(listDecks(db)));
  r.post('/', (req, res) => {
    const { name, parentId = null } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    res.status(201).json(createDeck(db, { name, parentId }));
  });
  r.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const { name, pinned, archived } = req.body;
    const has = (v) => v !== undefined;
    if (!has(name) && !has(pinned) && !has(archived)) {
      return res.status(400).json({ error: 'name, pinned, or archived required' });
    }
    if (has(name) && !name) return res.status(400).json({ error: 'name required' });
    if (has(pinned) && typeof pinned !== 'boolean') {
      return res.status(400).json({ error: 'pinned must be boolean' });
    }
    if (has(archived) && typeof archived !== 'boolean') {
      return res.status(400).json({ error: 'archived must be boolean' });
    }
    if (has(name)) renameDeck(db, id, name);
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
Expected: PASS (existing 3 + new 3 = 6). The existing "renames a deck" test still passes (name path unchanged).

- [ ] **Step 5: Commit**

```bash
git add server/routes/decks.js server/__tests__/decks.test.js
git commit -m "feat: PATCH decks accepts name/pinned/archived"
```

---

### Task 3: API client — updateDeck

**Files:**
- Modify: `web/src/api.js`
- Test: `web/src/api.test.js`

**Interfaces:**
- Produces: `api.updateDeck(id, patch) -> Promise<deck>` — PATCH `/api/decks/:id` with the given patch object. `api.renameDeck` stays as-is.

- [ ] **Step 1: Write the failing test** — append inside the `describe('api client', ...)` block in `web/src/api.test.js`:

```js
  it('updates a deck via PATCH with a patch body', async () => {
    await api.updateDeck(7, { pinned: true });
    const call = global.fetch.mock.calls[0];
    expect(call[0]).toBe('/api/decks/7');
    expect(call[1].method).toBe('PATCH');
    expect(JSON.parse(call[1].body)).toEqual({ pinned: true });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `web/`): `npm test -- src/api.test.js`
Expected: FAIL — `api.updateDeck is not a function`.

- [ ] **Step 3: Implement — add to the `api` object in `web/src/api.js`**, directly after the `renameDeck` line:

```js
  updateDeck: (id, patch) => req(`/api/decks/${id}`, json('PATCH', patch)),
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `web/`): `npm test -- src/api.test.js`
Expected: PASS (existing 3 + new 1 = 4).

- [ ] **Step 5: Commit**

```bash
git add web/src/api.js web/src/api.test.js
git commit -m "feat: add updateDeck api client method"
```

---

### Task 4: DeckMenu component

**Files:**
- Create: `web/src/components/DeckMenu.jsx`
- Test: `web/src/components/DeckMenu.test.jsx`

**Interfaces:**
- Produces: `<DeckMenu deck={{id,name,pinned,archived}} onRename={fn} onTogglePin={fn} onToggleArchive={fn} onDelete={fn} />`
  - Renders a `⋯` trigger button (aria-label "Deck menu"). Clicking it toggles a dropdown.
  - Dropdown items: **Rename** → `onRename(deck)`; **Pin**/**Unpin** (label = `deck.pinned ? 'Unpin' : 'Pin'`) → `onTogglePin(deck)`; **Archive**/**Unarchive** (label = `deck.archived ? 'Unarchive' : 'Archive'`) → `onToggleArchive(deck)`; **Delete** → `onDelete(deck)`.
  - After any item is clicked, the dropdown closes.

- [ ] **Step 1: Write the failing test** — `web/src/components/DeckMenu.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DeckMenu from './DeckMenu.jsx';

const base = { id: 1, name: 'D', pinned: false, archived: false };

function setup(deck = base) {
  const handlers = {
    onRename: vi.fn(), onTogglePin: vi.fn(),
    onToggleArchive: vi.fn(), onDelete: vi.fn(),
  };
  render(<DeckMenu deck={deck} {...handlers} />);
  return handlers;
}

describe('DeckMenu', () => {
  it('opens on trigger click and shows items', () => {
    setup();
    expect(screen.queryByText('Rename')).toBeNull();
    fireEvent.click(screen.getByLabelText('Deck menu'));
    expect(screen.getByText('Rename')).toBeTruthy();
    expect(screen.getByText('Pin')).toBeTruthy();
    expect(screen.getByText('Archive')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('reflects pinned/archived state in labels', () => {
    setup({ ...base, pinned: true, archived: true });
    fireEvent.click(screen.getByLabelText('Deck menu'));
    expect(screen.getByText('Unpin')).toBeTruthy();
    expect(screen.getByText('Unarchive')).toBeTruthy();
  });

  it('fires callbacks and closes after click', () => {
    const h = setup();
    fireEvent.click(screen.getByLabelText('Deck menu'));
    fireEvent.click(screen.getByText('Rename'));
    expect(h.onRename).toHaveBeenCalledWith(base);
    expect(screen.queryByText('Rename')).toBeNull();
  });

  it('fires pin, archive, and delete callbacks', () => {
    const h = setup();
    fireEvent.click(screen.getByLabelText('Deck menu'));
    fireEvent.click(screen.getByText('Pin'));
    expect(h.onTogglePin).toHaveBeenCalledWith(base);
    fireEvent.click(screen.getByLabelText('Deck menu'));
    fireEvent.click(screen.getByText('Archive'));
    expect(h.onToggleArchive).toHaveBeenCalledWith(base);
    fireEvent.click(screen.getByLabelText('Deck menu'));
    fireEvent.click(screen.getByText('Delete'));
    expect(h.onDelete).toHaveBeenCalledWith(base);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `web/`): `npm test -- src/components/DeckMenu.test.jsx`
Expected: FAIL — cannot find `./DeckMenu.jsx`.

- [ ] **Step 3: Implement `web/src/components/DeckMenu.jsx`**

```jsx
import React, { useState } from 'react';

export default function DeckMenu({ deck, onRename, onTogglePin, onToggleArchive, onDelete }) {
  const [open, setOpen] = useState(false);

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
    <span className="deck-menu">
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
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/DeckMenu.jsx web/src/components/DeckMenu.test.jsx
git commit -m "feat: add DeckMenu dropdown component"
```

---

### Task 5: DeckTree — sibling sort + archived class + menu

**Files:**
- Modify: `web/src/components/DeckTree.jsx`
- Test: `web/src/components/DeckTree.test.jsx`

**Interfaces:**
- Consumes: `DeckMenu` from Task 4.
- Produces: `<DeckTree decks={[{id,name,parentId,pinned,archived}]} activeId onSelect onRename onTogglePin onToggleArchive onDelete />`
  - Each sibling group renders sorted by rank (pinned&!archived=0, neither=1, archived=2), ties by case-insensitive name.
  - Archived nodes carry the `archived` class (in addition to `deck-node`/`active`).
  - Each node renders its name plus a `DeckMenu` wired to the four action handlers.
  - Children remain nested under their parent (recursion unchanged).

- [ ] **Step 1: Replace `web/src/components/DeckTree.test.jsx`**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DeckTree from './DeckTree.jsx';

const noop = () => {};
const handlers = {
  onSelect: vi.fn(), onRename: noop, onTogglePin: noop,
  onToggleArchive: noop, onDelete: noop,
};

function deck(id, name, extra = {}) {
  return { id, name, parentId: null, pinned: false, archived: false, ...extra };
}

describe('DeckTree', () => {
  it('renders nested decks and fires onSelect', () => {
    const onSelect = vi.fn();
    const decks = [
      deck(1, 'Lang'),
      { ...deck(2, 'Verbs'), parentId: 1 },
      deck(3, 'Misc'),
    ];
    render(<DeckTree decks={decks} activeId={2} {...handlers} onSelect={onSelect} />);
    expect(screen.getByText('Lang')).toBeTruthy();
    expect(screen.getByText('Verbs')).toBeTruthy();
    fireEvent.click(screen.getByText('Misc'));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('sorts siblings pinned-first, archived-last, then by name', () => {
    const decks = [
      deck(1, 'Bravo'),
      deck(2, 'Alpha', { archived: true }),
      deck(3, 'Charlie', { pinned: true }),
      deck(4, 'Delta'),
    ];
    const { container } = render(<DeckTree decks={decks} activeId={null} {...handlers} />);
    const names = [...container.querySelectorAll('.deck-node')].map(n => n.textContent.replace('⋯', '').trim());
    // pinned (Charlie) -> normal by name (Bravo, Delta) -> archived (Alpha)
    expect(names).toEqual(['Charlie', 'Bravo', 'Delta', 'Alpha']);
  });

  it('marks archived decks with the archived class', () => {
    const decks = [deck(1, 'Old', { archived: true })];
    const { container } = render(<DeckTree decks={decks} activeId={null} {...handlers} />);
    expect(container.querySelector('.deck-node.archived')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `web/`): `npm test -- src/components/DeckTree.test.jsx`
Expected: FAIL — sort test fails (current code renders in input order; no `archived` class; `.deck-node` textContent has no `⋯` yet so the new assertions differ).

- [ ] **Step 3: Replace `web/src/components/DeckTree.jsx`**

```jsx
import React from 'react';
import DeckMenu from './DeckMenu.jsx';

function rank(deck) {
  if (deck.archived) return 2;
  if (deck.pinned) return 0;
  return 1;
}

function sortedChildren(decks, parentId) {
  return decks
    .filter(d => d.parentId === parentId)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function DeckNode({ deck, decks, activeId, onSelect, actions, depth }) {
  const children = sortedChildren(decks, deck.id);
  const cls = `deck-node${deck.id === activeId ? ' active' : ''}${deck.archived ? ' archived' : ''}`;
  return (
    <div>
      <div
        className={cls}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => onSelect(deck.id)}
      >
        <span className="deck-name">{deck.name}</span>
        <DeckMenu
          deck={deck}
          onRename={actions.onRename}
          onTogglePin={actions.onTogglePin}
          onToggleArchive={actions.onToggleArchive}
          onDelete={actions.onDelete}
        />
      </div>
      {children.map(c => (
        <DeckNode key={c.id} deck={c} decks={decks}
          activeId={activeId} onSelect={onSelect} actions={actions} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function DeckTree({
  decks, activeId, onSelect, onRename, onTogglePin, onToggleArchive, onDelete,
}) {
  const actions = { onRename, onTogglePin, onToggleArchive, onDelete };
  return (
    <div>
      {sortedChildren(decks, null).map(d => (
        <DeckNode key={d.id} deck={d} decks={decks}
          activeId={activeId} onSelect={onSelect} actions={actions} depth={0} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `web/`): `npm test -- src/components/DeckTree.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/DeckTree.jsx web/src/components/DeckTree.test.jsx
git commit -m "feat: sort decks by pin/archive rank and add per-deck menu"
```

---

### Task 6: App wiring + styles

**Files:**
- Modify: `web/src/App.jsx`
- Modify: `web/src/styles.css`
- Test: full web suite (no new unit test; `App.jsx` is integration-wired and verified by the suite + manual smoke).

**Interfaces:**
- Consumes: `DeckTree` (Task 5) action-handler props; `api.updateDeck`, `api.renameDeck`, `api.deleteDeck`.
- Produces: `App.jsx` defines and passes `onRename`, `onTogglePin`, `onToggleArchive`, `onDelete` to `DeckTree`; each calls the API then `refreshDecks()`. Deleting the active deck clears `activeDeck`.

- [ ] **Step 1: Replace the deck-handler section in `web/src/App.jsx`**

Find the existing `addDeck` function and add the four handlers right after it:

```jsx
  const addDeck = async () => {
    const name = prompt('Deck name:');
    if (name) { await api.createDeck({ name, parentId: activeDeck }); refreshDecks(); }
  };

  const renameDeck = async (deck) => {
    const name = prompt('Rename deck:', deck.name);
    if (name && name !== deck.name) { await api.renameDeck(deck.id, name); refreshDecks(); }
  };

  const togglePin = async (deck) => {
    await api.updateDeck(deck.id, { pinned: !deck.pinned });
    refreshDecks();
  };

  const toggleArchive = async (deck) => {
    await api.updateDeck(deck.id, { archived: !deck.archived });
    refreshDecks();
  };

  const removeDeck = async (deck) => {
    if (!confirm(`Delete deck "${deck.name}" and all its sub-decks and notes?`)) return;
    await api.deleteDeck(deck.id);
    if (activeDeck === deck.id) setActiveDeck(null);
    refreshDecks();
  };
```

- [ ] **Step 2: Pass the handlers to `DeckTree` in `App.jsx`**

Replace the existing `<DeckTree ... />` line with:

```jsx
        <DeckTree
          decks={decks}
          activeId={activeDeck}
          onSelect={setActiveDeck}
          onRename={renameDeck}
          onTogglePin={togglePin}
          onToggleArchive={toggleArchive}
          onDelete={removeDeck}
        />
```

- [ ] **Step 3: Add styles to `web/src/styles.css`**

Replace the two `.deck-node` lines with the following block:

```css
.deck-node { padding: 4px 6px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; }
.deck-node.active { background: #d8e6ff; }
.deck-node.archived { opacity: 0.5; }
.deck-node .deck-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.deck-menu { position: relative; }
.deck-menu-trigger { visibility: hidden; padding: 0 6px; border: none; background: transparent; font-size: 16px; line-height: 1; }
.deck-node:hover .deck-menu-trigger, .deck-menu-trigger:focus { visibility: visible; }
.deck-menu-list { position: absolute; right: 0; top: 100%; z-index: 10; background: #fff; border: 1px solid #ccc; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,.15); display: flex; flex-direction: column; min-width: 120px; }
.deck-menu-list button { text-align: left; border: none; background: transparent; padding: 7px 12px; }
.deck-menu-list button:hover { background: #f0f3f7; }
```

- [ ] **Step 4: Run the full web suite**

Run (from `web/`): `npm test`
Expected: PASS — render, api (4), Card, DeckTree (3), DeckMenu (4), NoteEditor, NoteTypeManager, BrowseView.

- [ ] **Step 5: Build to confirm no breakage**

Run (from `web/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add web/src/App.jsx web/src/styles.css
git commit -m "feat: wire deck menu actions and styling"
```

---

## Self-Review Notes

- **Spec coverage:** pinned/archived columns + setters + boolean listDecks (Task 1); PATCH name/pinned/archived (Task 2); `updateDeck` client (Task 3); DeckMenu rename/pin/archive/delete with state-reflecting labels (Task 4); DeckTree per-sibling rank sort + archived greying + nested children intact (Task 5); App handlers with confirm-on-delete, prompt-on-rename, clear-active-on-delete, and styling (Task 6). Non-goals (no DnD, no separate archived view, no bulk) respected.
- **Type consistency:** `setDeckPinned`/`setDeckArchived`/`updateDeck`/`renameDeck`/`deleteDeck` names match across db → API → client → App. Deck object shape `{id,name,parentId,pinned,archived}` consistent from `listDecks` through `DeckTree`/`DeckMenu`. Rank rule (pinned 0 / neither 1 / archived 2, archive-wins) identical in spec and Task 5 code.
- **Placeholder scan:** none — every step has concrete code/commands.
- **Note on DeckMenu outside-click close:** the spec mentions closing on outside click; the implementation closes after any action and on re-trigger (YAGNI for a document-level listener in this minimal app). The Task 4 tests assert close-after-action, which is the behavior that matters for the actions. If desired later, a document mousedown listener can be added without interface change.
