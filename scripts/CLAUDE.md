# scripts/ — CLAUDE.md

Standalone Node scripts, run manually (not part of the app's request path).

- `seed-library.js` — one-time migration that uploads everything under
  `../server/data/library/**` into Supabase (Storage + the `library_assets`
  table). Idempotent — skips assets whose `id` already exists, so it's safe
  to re-run after adding new preloaded assets locally. Needs `SUPABASE_URL`
  and `SUPABASE_SERVICE_ROLE_KEY` (reads `.env` via `dotenv`, or pass them
  inline). Run via `npm run seed:library`.

- `seed-fonts.js` — one-time migration that downloads the regular-weight
  file of every family in the `google/fonts` GitHub repo (no API key —
  enumerates family folders via a treeless `git clone` + `git ls-tree`
  instead of the GitHub REST API, which rate-limits unauthenticated calls
  at 60/hr), converts each to WOFF2 (`wawoff2`, WASM — no native build
  step), and uploads it to the same Supabase `library` bucket (at
  `fonts/<slug>.woff2`) + the `fonts` table. Unlike `seed-library.js`,
  there's no local copy of these files to seed from — the ~1,800-family
  catalog is too large to commit to this repo, so it's fetched live from
  GitHub every run. Idempotent (skips ids already in the `fonts` table) and
  resumable. Supports `--dry-run` (download/convert to measure real sizes,
  write nothing) and `--limit N` (test on a small batch first — recommended
  before committing to the multi-hour full run). Run via `npm run
  seed:fonts`. Watch the logged running byte total against Supabase's 1GB
  free storage tier.

If you add a new script here, follow the same pattern: standalone, reads
credentials from `.env`/env vars via `dotenv`, safe to re-run, and add an
`npm run` alias in the root `package.json`.
