# CardNote — an Anki-style note app

**Date:** 2026-06-23
**Status:** Approved design

## Overview

CardNote is a note-taking app modeled closely on Anki's data design, but
without spaced-repetition review. Each note is a card with a front and a back;
only the front shows by default, and clicking reveals the back. Notes are
authored against a **note type** (template) that defines named fields and the
HTML/CSS that renders them, so the author focuses on content while styling is
template-driven. Cards are organized into nested **boxes**.

Web app first (React SPA + Node API + SQLite); a desktop wrapper (Tauri/Electron)
is a likely follow-up, so the frontend and server are kept reusable.

## Goals

- Anki-faithful note model: note types with named fields + HTML card templates
  using `{{Field}}` substitution + editable raw CSS per note type.
- Markdown field content, rendered to HTML inside the card.
- Click-to-flip cards, front visible by default.
- Nested boxes (Anki-style decks): each card lives in exactly one box.
- Search/filter across card content.
- SQLite storage.

## Non-Goals (deferred to v2)

- Spaced-repetition review / scheduling.
- Tags.
- Images / media handling.
- Rich-text (WYSIWYG) field editing.

## Architecture

Three well-bounded units:

- **`db/`** — SQLite access layer using `better-sqlite3`. Owns the schema and all
  queries as pure functions. No HTTP knowledge.
- **`server/`** — Node/Express REST API. Translates HTTP ↔ db calls; input
  validation only, no business logic beyond that.
- **`web/`** — React SPA. All UI. Communicates with the API via `fetch`.

Desktop later = wrap `web/` + `server/` in Tauri/Electron, reusing both.

### Key concept: note vs. card

Borrowed from Anki — a **note** (the data you author) and a **card** (the
rendered view) are separate. You enter content once into a note's fields; the
note type's card template projects that content into a visual card. This keeps
content and styling decoupled.

## Data Model (SQLite)

```
note_type        (id, name, css)
field            (id, note_type_id, name, ord)          -- ordered named fields
card_template    (id, note_type_id, name, front_html, back_html, ord)
box              (id, name, parent_id)                  -- nested decks
note             (id, note_type_id, box_id, created, modified)
field_value      (id, note_id, field_id, value_md)      -- Markdown content per field
card             (id, note_id, card_template_id)         -- a renderable card
```

- A **note** has one note type, lives in one box, and holds Markdown values for
  that type's fields.
- Each note generates one **card** per card template (Anki-faithful: a note type
  can define multiple card layouts). MVP note types typically have a single
  template, but the schema supports many.
- `box.parent_id` is nullable; null = top-level box.

## Card Rendering Pipeline

1. Take a card → its note's field values (Markdown).
2. Render each field's Markdown → HTML.
3. Substitute `{{FieldName}}` in the template's `front_html` / `back_html`.
4. Inject the result + the note type's `css` into a sandboxed `<iframe srcdoc>`.
5. Front shows by default; clicking flips to back (iframe ↔ parent via
   `postMessage`).

Sandboxed iframes give full style isolation (a template's CSS cannot bleed into
the app chrome) and prevent malformed template HTML from breaking the page —
the same approach Anki uses for card preview.

## Core Screens

- **Boxes sidebar** — nested tree; click a box to browse its cards.
- **Browse view** — cards in the selected box, each a flippable iframe; a search
  bar filters by field content.
- **Note editor** — pick note type → form of Markdown fields → pick box → save,
  with a live card preview.
- **Note type manager** — edit fields, edit `front_html` / `back_html` / `css`
  in code editors, with a live preview.

## Error Handling

- DB layer validated with unit tests (in-memory SQLite).
- API: input validation; 4xx on bad references. Deleting a note type still in
  use is blocked/warned rather than silently cascading.
- Template rendering tested in isolation (Markdown → HTML → substitution).
- Malformed template HTML cannot break the app — it is sandboxed in the iframe.

## Testing Strategy

- Unit tests for the db layer against in-memory SQLite.
- Unit tests for the rendering pipeline (Markdown render + `{{Field}}`
  substitution).
- API endpoint tests for validation and reference-integrity rules.

## Tech Stack

- **Frontend:** React SPA.
- **Backend:** Node + Express REST API.
- **DB:** SQLite via `better-sqlite3`.
- **Markdown:** a standard renderer (e.g. `markdown-it`).
- Version controlled with git from the start.
