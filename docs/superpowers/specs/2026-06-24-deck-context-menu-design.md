# Deck context menu — rename / delete / archive / pin

**Date:** 2026-06-24
**Status:** Approved design

## Overview

Add a per-deck dropdown menu (`⋯`) to the sidebar deck tree, letting the user
rename, delete, pin, or archive any deck. Pin and archive are non-destructive,
persisted deck state:

- **Pin** keeps a deck sticky at the top of its sibling group.
- **Archive** greys a deck out and sorts it to the bottom of its sibling group;
  it stays visible (not hidden) and can be unarchived.

Sorting applies per sibling level only — children always stay nested under
their parent. The nested deck hierarchy is never restructured by pin/archive.

## Data Model

Add two boolean columns to the `deck` table:

```sql
pinned   INTEGER NOT NULL DEFAULT 0   -- 0/1
archived INTEGER NOT NULL DEFAULT 0   -- 0/1
```

`listDecks` returns these as JS booleans (`pinned`, `archived`) on each deck
object, alongside the existing `id`, `name`, `parentId`.

New db functions in `db/decks.js`:

- `setDeckPinned(db, id, pinned)` — set the `pinned` flag (boolean → 0/1).
- `setDeckArchived(db, id, archived)` — set the `archived` flag.

`createDeck` returns `pinned: false, archived: false` for new decks.

## API

Extend `PATCH /api/decks/:id` (currently rename-only) to accept any subset of
`{ name?, pinned?, archived? }`. It updates whichever fields are present and
returns the updated deck. Validation: if `name` is present it must be
non-empty; `pinned`/`archived` must be booleans when present. An empty body is
a 400.

## Sorting (per sibling level)

In `DeckTree`, each sibling group sorts by rank, then name (case-insensitive):

- rank 0 = pinned and not archived (top)
- rank 1 = neither
- rank 2 = archived (bottom) — archive wins over pin if both are set

The sort is a pure function of the two booleans, computed at render time.
Archived deck nodes get an `archived` CSS class (greyed / de-emphasized).

## Components

- **`DeckTree.jsx`** (existing) — owns recursion + rendering. Sorts each
  sibling group by the rank rule. Renders each node's name plus a `DeckMenu`.
  Receives action handlers as props and forwards them.
- **`DeckMenu.jsx`** (new) — a small dropdown for one deck. Shows a `⋯` trigger;
  opens a menu with: Rename, Pin/Unpin (label reflects current state),
  Archive/Unarchive (label reflects state), Delete. Owns its own open/close
  state and closes on outside click or after an action. Calls the handlers
  passed by `DeckTree`.
- **`App.jsx`** — defines the handlers and wires them through `DeckTree`:
  - `renameDeck(id)` — `prompt()` for the new name, then `api.renameDeck`.
  - `togglePin(deck)` — `api.updateDeck(id, { pinned: !deck.pinned })`.
  - `toggleArchive(deck)` — `api.updateDeck(id, { archived: !deck.archived })`.
  - `deleteDeck(deck)` — `confirm()` (delete cascades to sub-decks and their
    notes), then `api.deleteDeck`. If the deleted deck was active, clear the
    active selection.
  - Each handler refreshes the deck list afterward.

## API client (`web/src/api.js`)

- `renameDeck(id, name)` already exists (PATCH with `{ name }`).
- Add `updateDeck(id, patch)` — PATCH with an arbitrary `{ name?, pinned?,
  archived? }` patch, used for pin/archive toggles.

## UX conventions

Match the app's current minimal-UI style:

- Rename uses `prompt()` (consistent with the existing "New deck" flow).
- Delete uses `confirm()` before calling the API.
- The `⋯` trigger is shown on hover/focus of a deck node.

## Error Handling

- API validates field types; bad input returns 400. The existing error
  middleware already maps SQLite constraint errors to 400.
- Deleting a deck cascades (existing schema behavior); confirmed in the UI.

## Testing Strategy

- **db:** `setDeckPinned` / `setDeckArchived` flip the flags; `listDecks`
  returns them as booleans; `createDeck` defaults both to false.
- **API:** `PATCH /api/decks/:id` with `{ pinned: true }`, `{ archived: true }`,
  and `{ name }` each update correctly and return the updated deck; empty body
  is 400.
- **DeckTree:** given mixed flags in a sibling group, renders in order
  pinned → normal → archived, with the archived node carrying the `archived`
  class; children remain nested under their parent.
- **DeckMenu:** clicking each menu item fires the correct callback; Pin/Archive
  labels reflect the deck's current state; Delete triggers confirmation.

## Non-Goals

- No drag-and-drop reordering (sort is rank + name only).
- No separate "Archived" view/panel — archived decks stay in the tree, greyed.
- No bulk actions.
