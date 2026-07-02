# server/ — CLAUDE.md

Express backend for Planner Studio. Root `../CLAUDE.md` has the full
storage-architecture explanation (dual local/Supabase drivers) — this file
is just a map of this directory.

```
server/
  server.js         # Local dev launcher: require('./app').listen(PORT)
  app.js             # The actual Express app — routes, CORS, COOP/COEP
                       #  headers, static file serving. No app.listen() here
                       #  so api/index.js (Vercel) can import it directly.
  lib/storage/
    index.js            # Picks local vs supabase driver — see root CLAUDE.md
    local.js             # fs-based (npm start default)
    supabase.js           # Postgres + Storage (Vercel default)
  data/
    projects/         # local driver: saved projects, gitignored (user data)
    library/           # local driver + shipped assets, see index.json
```

**Rule**: route handlers in `app.js` only ever call the `storage` interface
(`listLibrary`, `uploadLibraryAsset`, `createProject`, etc.) — never `fs`
directly. If you add a new persisted field or a new route, implement it in
both `lib/storage/local.js` and `lib/storage/supabase.js`, and update
`../supabase/schema.sql` if the Postgres shape changes.
