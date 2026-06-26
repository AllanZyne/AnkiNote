# AnkiNote

A standalone, serverless Anki-style note PWA. Your notes live as plain folders
and Markdown files in a **vault** on storage you control (WebDAV today; S3 /
OneDrive / Dropbox are planned via the same provider interface). The app runs
entirely in the browser, caches the vault in IndexedDB for instant edits, and
syncs changes back in the background — similar to Obsidian.

- Each note is a Markdown file (`<!-- field: Front -->` sections) with YAML
  frontmatter; decks are folders; app config + a rebuildable index live under
  `.ankinote/`.

## Requirements

- Node 20.x (for the dev server / build only).
- A WebDAV server reachable from the browser with **CORS enabled for the app
  origin** (e.g. Nextcloud, rclone serve webdav). The app sends
  PROPFIND/GET/PUT/MKCOL/DELETE/MOVE directly from the browser.

## Run

```bash
cd web && npm install && npm run dev   # http://localhost:5173
```

On first load, enter your WebDAV URL + credentials (or click "Try demo
(in-memory)" to explore without a server). Build a deployable PWA with
`npm run build` (output in `web/dist`).

## Test

```bash
cd web && npm test
```

## License

[MIT](LICENSE) © 2026 Yang Zhao
