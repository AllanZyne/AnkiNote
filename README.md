# AnkiNote

An Anki-style note app: each note is a flippable card (front/back) rendered from
a user-defined note type (named fields + HTML templates + CSS). Markdown field
content, nested boxes, content search. Web app first; SQLite storage.

## Requirements

- Node 20.x (installed at `~/.local/bin`).

## Setup

```bash
npm install
(cd web && npm install)
npm run seed        # optional demo data
```

## Run (two terminals)

```bash
npm run server      # API on http://localhost:3001
cd web && npm run dev   # UI on http://localhost:5173
```

Open http://localhost:5173.

## Test

```bash
npm test            # db + server
cd web && npm test  # web
```

## License

[MIT](LICENSE) © 2026 Yang Zhao
