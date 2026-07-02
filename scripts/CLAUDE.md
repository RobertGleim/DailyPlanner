# scripts/ — CLAUDE.md

Standalone Node scripts, run manually (not part of the app's request path).

- `seed-library.js` — one-time migration that uploads everything under
  `../server/data/library/**` into Supabase (Storage + the `library_assets`
  table). Idempotent — skips assets whose `id` already exists, so it's safe
  to re-run after adding new preloaded assets locally. Needs `SUPABASE_URL`
  and `SUPABASE_SERVICE_ROLE_KEY` (reads `.env` via `dotenv`, or pass them
  inline). Run via `npm run seed:library`.

If you add a new script here, follow the same pattern: standalone, reads
credentials from `.env`/env vars via `dotenv`, safe to re-run, and add an
`npm run` alias in the root `package.json`.
