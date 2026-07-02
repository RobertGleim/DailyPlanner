# Planner Studio — CLAUDE.md

This file is the living architecture/feature doc for this project. **Update
it whenever you ship a feature, change the data model, or change how the app
is deployed.** A git pre-commit hook (`.husky/pre-commit`) blocks commits
that touch `server/`, `public/`, `api/`, or `supabase/` without also touching
this file — bypass with `git commit --no-verify` only when a change genuinely
doesn't need a doc update (e.g. a pure typo fix).

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

## Notes

- All frontend API calls (`public/js/api.js`) use relative `/api/...` paths,
  so no frontend changes are needed between local Express and Vercel.
- The server sets `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy`
  headers so the background-removal engine can use multi-threaded WASM. Every
  script the app loads is served locally (no third-party CDNs) — keep it
  that way, or these headers will block the page from loading external assets.
