# Planner Studio — CLAUDE.md

This file is the living architecture/feature doc for this project. **Update
it whenever you ship a feature, change the data model, or change how the app
is deployed.** A git pre-commit hook (`.husky/pre-commit`) blocks commits
that touch `server/`, `public/`, `api/`, `supabase/`, or `scripts/` without
also touching that directory's own `CLAUDE.md` (or this root one) — bypass
with `git commit --no-verify` only when a change genuinely doesn't need a
doc update (e.g. a pure typo fix).

## Per-path docs

Each top-level directory has its own `CLAUDE.md` with path-local detail —
Claude Code loads the nearest one automatically when working inside that
directory, so this root file stays a high-level index instead of growing
unbounded:

- [`public/CLAUDE.md`](public/CLAUDE.md) — frontend file map, design tokens/
  brand palette, the self-hosted icon system, the no-external-CDN/COEP rule.
- [`server/CLAUDE.md`](server/CLAUDE.md) — Express app structure, the
  storage-driver interface contract.
- [`api/CLAUDE.md`](api/CLAUDE.md) — the Vercel serverless entry point.
- [`supabase/CLAUDE.md`](supabase/CLAUDE.md) — schema/bucket notes, where
  credentials live.
- [`scripts/CLAUDE.md`](scripts/CLAUDE.md) — standalone script conventions.

## Agent/subagent rule

**Never spawn an Agent (subagent) or invoke a Skill in this repo without
asking the user first.** Before using the Agent tool or Skill tool, state
what you want to run and why, and wait for explicit approval. No exceptions.

## What this app is

A full-stack app for designing custom printable/digital daily, weekly, and
monthly planners, exported as print-ready multi-page PDFs to sell on Etsy,
Amazon, Gumroad, etc. Plain HTML/CSS/JS frontend (no build step), Express
backend.

## Tech stack

- **Frontend**: plain HTML/CSS/JS in `public/`, Fabric.js for the canvas
  editor, jsPDF for export, an in-browser ONNX background-removal model.
  No framework, no bundler.
- **Backend**: Express (`server/app.js`), deployed two ways:
  - Local dev: `server/server.js` runs `app.listen()` directly (`npm start`).
  - Vercel: `api/index.js` exports the same Express app as a serverless
    function; `vercel.json` rewrites all `/api/*` requests to it and serves
    `public/` as static output.
- **Storage**: dual-mode via `server/lib/storage/` (see below).

## Storage architecture (important)

Vercel serverless functions have no writable/persistent filesystem, so the
app cannot always use local disk. `server/lib/storage/index.js` picks a
driver:

```js
const driver = process.env.STORAGE_DRIVER || (process.env.VERCEL ? 'supabase' : 'local');
```

- **`local` driver** (`server/lib/storage/local.js`) — default for
  `npm start`. Saved projects go to `server/data/projects/*.json`; library
  assets go to `server/data/library/<category>/`, indexed in
  `server/data/library/index.json`. Fully offline, no cloud account needed.
- **`supabase` driver** (`server/lib/storage/supabase.js`) — used on Vercel
  (auto-selected) or anywhere `STORAGE_DRIVER=supabase` is set. Projects and
  library metadata live in Postgres tables (`supabase/schema.sql`); asset
  files live in a public Supabase Storage bucket (`SUPABASE_LIBRARY_BUCKET`,
  default `library`).

Both drivers implement the same interface: `listLibrary`,
`uploadLibraryAsset`, `deleteLibraryAsset`, `listProjects`, `getProject`,
`createProject`, `updateProject`, `duplicateProject`, `deleteProject`. Routes
in `server/app.js` only ever call this interface — never `fs` directly.

**If you add a new persisted field or endpoint**: implement it in both
`local.js` and `supabase.js`, and update `supabase/schema.sql` if it changes
the Postgres shape.

## Folder map

```
planner-studio/
  api/index.js              # Vercel serverless entry (exports server/app.js)
  vercel.json                # outputDirectory=public + /api/* rewrite
  server/
    server.js                 # local dev launcher (app.listen)
    app.js                     # the actual Express app + routes
    lib/storage/
      index.js                  # driver picker
      local.js                   # disk-based driver (npm start default)
      supabase.js                 # Supabase-based driver (Vercel default)
    data/
      projects/                   # local driver: saved projects (gitignored, user data)
      library/                     # local driver + shipped preloaded assets
        index.json                  # library metadata (id, name, category, url)
        backgrounds/ icons/ borders/  # 381 preloaded assets (tracked in git)
  supabase/
    schema.sql                # Postgres schema for the supabase driver
  scripts/
    seed-library.js            # one-time: uploads preloaded assets to Supabase
  public/
    index.html                # app shell
    css/style.css
    js/                       # app.js, canvas-editor.js, generators.js,
                                #  library-panel.js, pages-manager.js,
                                #  export-pdf.js, api.js, constants.js,
                                #  bg-removal-module.js
    vendor/                   # fabric.min.js, jspdf.umd.min.js, onnxruntime-web,
                                #  bg-removal engine (all bundled, work offline)
```

## Features

- Drag-and-drop page editor (Fabric.js): text, images, lines, rectangles,
  circles; resize/rotate/reposition/layer.
- Image editing: precise resize, opacity, color tint, one-click AI
  background removal (runs entirely in-browser), delete.
- Page backgrounds (solid color or full-bleed image) and page border
  decorations (160 preloaded, 8 themes x 5 layout styles).
- Calendar generator (month grid / week strip, 3 styles), checklist /
  habit-tracker generator, hourly daily-schedule generator.
- Asset library — 381 preloaded assets (100 backgrounds, 121 icons, 160
  border decorations) plus user uploads, shared across all planners.
- Multi-page planners: add/duplicate/reorder/delete pages; US Letter or A4.
- Save/Open projects; Export to a single print-ready multi-page PDF (300 DPI).
- Summer-branded UI (coral/turquoise/sunshine-yellow on warm cream) with a
  self-hosted SVG icon system — see `public/CLAUDE.md`.

## Live deployment

- Production: https://daily-planner-umber.vercel.app (Vercel project
  `daily-planner`, team `robert-gleims-projects`)
- Source: https://github.com/RobertGleim/DailyPlanner (`main` branch,
  auto-deploys on push via Vercel's GitHub integration)
- Data: Supabase project created 2026-07-02 (see `supabase/CLAUDE.md`)

## Local development

```bash
npm install
npm start
```
Open http://localhost:4000. Uses the `local` storage driver by default — no
Supabase account needed.

## Deploying to Vercel

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Create a public Storage bucket named `library` (Storage -> New bucket).
4. In the Vercel project's Environment Variables, set:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (from Supabase Settings -> API)
   - `SUPABASE_LIBRARY_BUCKET=library` (or your bucket name)
   - `STORAGE_DRIVER=supabase` (optional — auto-selected on Vercel anyway)
5. Migrate the 381 preloaded assets once:
   `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-library.js`
   (or `npm run seed:library` with those vars in `.env`).
6. Connect the GitHub repo to a new Vercel project (Vercel auto-detects
   `vercel.json`) and deploy.

## Security posture (audited 2026-07-02)

**No authentication exists on any `/api/*` route.** Anyone with the deployed
URL can read/create/update/delete any project or library asset — there's no
per-user scoping at all. The intended fix is **Vercel Deployment Protection**
(Settings → Deployment Protection in the Vercel dashboard — a Pro-plan
feature, gates the whole app including `/api/*` behind a password before any
request reaches the code). This is a dashboard setting, not something in
this repo — confirm it's actually enabled before treating this app as
private. If you're on the Hobby plan, this protection is not active and the
live URL should be treated as fully public.

Library uploads are restricted to image MIME types
(`png`/`jpeg`/`gif`/`webp`/`svg`) at up to 8MB via a multer `fileFilter` in
`server/app.js` — this closes the "anonymous open file host" version of the
no-auth risk, but doesn't address the underlying missing-auth issue above.

Known, accepted-for-now gaps (low severity, not fixed):
- Error responses return raw `err.message` to the client (`server/app.js`'s
  final error-handling middleware) — no credential leakage, but does expose
  backend implementation details.
- No rate limiting on any route — repeated calls could run up Supabase usage
  with nothing in the way.

Confirmed clean as of this audit: no secrets in git history or any tracked
file (verified via full `git log --all -p` scan), `.env`/`.vercel` correctly
gitignored, `npm audit` reports 0 known vulnerabilities, no path traversal
in the upload/delete code paths.

## Notes

- All frontend API calls (`public/js/api.js`) use relative `/api/...` paths,
  so no frontend changes are needed between local Express and Vercel.
- The server sets `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy`
  headers so the background-removal engine can use multi-threaded WASM. Every
  script the app loads is served locally (no third-party CDNs) — keep it
  that way, or these headers will block the page from loading external assets.
