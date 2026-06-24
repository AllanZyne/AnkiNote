# Anki-style `::` deck paths + outside-click menu close

**Date:** 2026-06-24
**Status:** Approved design

## Overview

Adopt Anki's deck-naming model: a deck **is** its full path string (e.g.
`"Spanish::Verbs"`), and the hierarchy is *derived* by splitting the name on
`::`. Renaming a deck changes its level (e.g. `"Spanish::Verbs"` →
`"Language::Verbs"` or `"Verbs"`); descendants follow by prefix rewrite, missing
intermediate decks auto-materialize, and a rename onto an existing deck merges.

Also: the per-deck `⋯` dropdown menu must close when the user clicks outside it.

This replaces the current `parent_id` model (a deck was `{ name, parent_id }`).

## Data Model

The `deck` table drops `parent_id`. A deck row is `{ id, name, pinned, archived }`
where `name` is the full `::`-delimited path. The tree is reconstructed from
path strings; there is no parent pointer.

`notes.deck_id` still references a deck row by `id`. Because a row's `id` is
stable across renames (only its `name` changes), notes follow their deck through
any rename automatically. The only case that re-points `deck_id` is a merge.

### Migration (in `openDb`, after schema exec)

Run on existing databases, idempotent:

1. If the `deck` table has a `parent_id` column:
   - For each deck row, compute its full `::` path by walking the `parent_id`
     chain to the root, joining segment names with `::`.
   - `UPDATE` each row's `name` to its full path.
   - Drop the `parent_id` column (rebuild table without it).
2. If `parent_id` is already gone, do nothing.

The existing `pinned`/`archived` ADD COLUMN migration stays.

## Deck path rules

`validateDeckPath(name) -> { valid, error }` (pure helper):

- Split on `::`. Trim each segment.
- Reject if any segment is empty (`"Spanish::"`, `"::Verbs"`, `"A::::B"`) or the
  whole name is empty/whitespace.
- The normalized name is the trimmed segments rejoined with `::`.
- Names are **case-sensitive** (`"Spanish"` ≠ `"spanish"`).
- Uniqueness: no two deck rows may have the same normalized name.

## db layer (`db/decks.js`)

- `createDeck(db, { name }) -> deck` — normalize + validate; reject duplicate
  (throw `Error('deck exists')`); **auto-create missing ancestor rows** (creating
  `"Grammar::Verbs"` also creates `"Grammar"` if absent). Returns the created
  leaf deck `{ id, name, pinned: false, archived: false }`.
- `listDecks(db) -> Array<{ id, name, pinned, archived }>` — full paths, booleans.
- `renameDeck(db, id, newPath)` — in one transaction:
  1. Normalize + validate `newPath`.
  2. Let `P` = the deck's current name. Compute, for the deck itself and every
     row whose name equals `P` or starts with `P + "::"`, the rewritten name
     (replace the `P` prefix with `newPath`).
  3. Auto-create any missing ancestors of `newPath`.
  4. For each rewrite target: if a *different* existing row already has that
     name, **merge** — re-point that other row's notes (`UPDATE note SET
     deck_id = survivor_id`) into the rewritten row, then delete the duplicate
     row. The rewritten (renamed) row is the survivor.
  5. Apply the name rewrites.
- `deleteDeck(db, id)` — delete the deck and every row whose name starts with
  `P + "::"` (notes cascade via existing FK). 
- `setDeckPinned(db, id, pinned)` / `setDeckArchived(db, id, archived)` — unchanged.
- `validateDeckPath(name)` — exported pure helper (also used by API/tests).

## API (`server/routes/decks.js`)

- `GET /api/decks` → `200 [deck]`.
- `POST /api/decks { name }` → `201 deck`; `400` invalid path; `409 { error:
  'deck exists' }` on duplicate.
- `PATCH /api/decks/:id { name?, pinned?, archived? }` → `200 deck`. A `name`
  triggers the rename/rewrite/merge logic. `400` on invalid path. (Collisions
  resolve as merges, so they succeed rather than 409.) `pinned`/`archived`
  unchanged from current behavior. Empty body → `400`.
- `DELETE /api/decks/:id` → `204`.

The existing error middleware maps SQLite constraint errors to 400.

## Frontend

### `buildDeckTree(decks)` — pure helper (`web/src/lib/deckTree.js`)

Input: flat `[{ id, name, pinned, archived }]`. Output: nested nodes:

```
{ segment, path, deck|null, pinned, archived, children: [...] }
```

- Split each deck name on `::`. Walk/create nodes per segment.
- A node backed by a real deck row carries `deck` (and its `id`, `pinned`,
  `archived`); a **synthesized intermediate** (implied parent with no row) has
  `deck: null` and `pinned/archived = false`.
- Each sibling group is sorted by rank (pinned&!archived=0, neither=1,
  archived=2; archive wins; ties by case-insensitive segment name) — same rule
  as today, applied to real-or-virtual nodes (virtual nodes rank as normal).

### `DeckTree.jsx`

- Calls `buildDeckTree(decks)` instead of reading `parentId`.
- Renders each node's **last segment** as its label, indented by depth.
- Selecting a node calls `onSelect(node.deck.id)` only when it has a real deck;
  a virtual node's row is non-selectable (no-op) and shows no `⋯` menu.
- Real-deck nodes render the `DeckMenu` wired to the existing handlers.

### `App.jsx`

- `onSelect` unchanged (deck id).
- Rename prompt pre-fills the deck's **full path** (`deck.name`), so editing the
  path changes the deck's level. New-deck prompt accepts a full path.
- Pin/archive/delete handlers unchanged (operate by id).
- Deleting the active deck clears the active selection (existing behavior).

### `DeckMenu.jsx` — outside-click close

While `open`, attach a document `mousedown` listener; if the event target is
outside the menu's root element, set `open = false`. Remove the listener on
close/unmount. The existing close-after-action and `stopPropagation` behavior
stays.

## Error Handling

- Invalid paths and duplicates rejected with clear messages.
- Rename/merge runs in a transaction; failure rolls back.
- Virtual intermediate nodes can't be selected, renamed, or deleted (no row).

## Testing Strategy

- **db:**
  - `validateDeckPath`: rejects empty segments / empty name; trims; accepts valid
    nested paths.
  - `createDeck` auto-creates missing ancestors; rejects duplicate.
  - `renameDeck` rewrites descendants by prefix (`Spanish` → `Language` makes
    `Spanish::Verbs` → `Language::Verbs`).
  - `renameDeck` to a deeper path auto-creates intermediates.
  - `renameDeck` onto an existing deck **merges**: the colliding deck's notes
    move to the survivor and the duplicate row is removed.
  - `deleteDeck` removes the deck and its `::`-prefixed descendants.
- **API:** rename that reparents; rename that merges (notes preserved under
  survivor); `400` invalid path; `409` duplicate create.
- **`buildDeckTree`:** paths → nested nodes; synthesizes virtual intermediates;
  sorts siblings by rank; labels are last segments.
- **DeckTree:** renders last-segment labels at correct depth; virtual node has no
  menu and is non-selectable.
- **DeckMenu:** outside `mousedown` closes the menu; inside click does not;
  click-action still closes.

## Migration of existing dev data

The seed already uses nested decks (Spanish ▸ Verbs, Math). After the model
change, the seed is updated to create full-path decks directly (e.g.
`createDeck({ name: 'Spanish' })`, `createDeck({ name: 'Spanish::Verbs' })`,
`createDeck({ name: 'Math' })`). The `openDb` migration converts any pre-existing
`parent_id`-based DB.

## Non-Goals

- No drag-and-drop reordering.
- No separate archived view; archived decks stay greyed in the tree.
- Case-insensitive name matching (names are case-sensitive).
