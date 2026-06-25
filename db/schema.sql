CREATE TABLE IF NOT EXISTS note_type (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  css        TEXT NOT NULL DEFAULT '',
  updated_at TEXT,
  deleted    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS field (
  id           TEXT PRIMARY KEY,
  note_type_id TEXT NOT NULL REFERENCES note_type(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  ord          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS card_template (
  id           TEXT PRIMARY KEY,
  note_type_id TEXT NOT NULL REFERENCES note_type(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  front_html   TEXT NOT NULL DEFAULT '',
  back_html    TEXT NOT NULL DEFAULT '',
  ord          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS deck (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  pinned     INTEGER NOT NULL DEFAULT 0,
  archived   INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  deleted    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS note (
  id           TEXT PRIMARY KEY,
  note_type_id TEXT NOT NULL REFERENCES note_type(id),
  deck_id      TEXT NOT NULL REFERENCES deck(id) ON DELETE CASCADE,
  created      TEXT NOT NULL,
  modified     TEXT NOT NULL,
  updated_at   TEXT,
  deleted      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS field_value (
  id       TEXT PRIMARY KEY,
  note_id  TEXT NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL REFERENCES field(id) ON DELETE CASCADE,
  value_md TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS card (
  id               TEXT PRIMARY KEY,
  note_id          TEXT NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  card_template_id TEXT NOT NULL REFERENCES card_template(id) ON DELETE CASCADE
);
