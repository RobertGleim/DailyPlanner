# supabase/ — CLAUDE.md

Schema for the production (Vercel) storage driver. See
`../server/lib/storage/supabase.js` for the code that reads/writes this
schema, and root `../CLAUDE.md` for the local-vs-Supabase architecture.

- `schema.sql` — `library_assets`, `fonts`, and `projects` tables. Run
  manually in the Supabase SQL editor (not an automated migration tool) — if
  you change the Postgres shape, update this file **and**
  `server/lib/storage/supabase.js` **and** the relevant seed script
  (`../scripts/seed-library.js` or `../scripts/seed-fonts.js`) together,
  since all three assume the same column names.
- Storage: one public bucket, name configurable via `SUPABASE_LIBRARY_BUCKET`
  (default `library`), holding library asset files at
  `<category>/<filename>` — mirrors the local driver's
  `server/data/library/<category>/<filename>` layout — and preloaded Google
  Fonts at `fonts/<slug>.woff2` (no local-disk equivalent; see
  `../scripts/CLAUDE.md`'s `seed-fonts.js` entry). Public bucket access
  matters beyond convenience here: it's what lets `Access-Control-Allow-Origin: *`
  satisfy the frontend's strict `Cross-Origin-Embedder-Policy` (see
  `../public/CLAUDE.md`) when loading both library images and webfonts.

Currently live project: created 2026-07-02, region set at creation time in
the Supabase dashboard (not tracked in this repo). Credentials
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) live in the Vercel project's
environment variables and in the local `.env` (gitignored) — never in this
repo's tracked files.
