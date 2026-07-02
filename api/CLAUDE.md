# api/ — CLAUDE.md

Vercel serverless entry point. `index.js` is a one-liner:
`module.exports = require('../server/app')` — it exports the same Express
app that `server/server.js` runs locally, just without calling `.listen()`
(Vercel handles invocation itself).

`../vercel.json`'s `rewrites` sends every `/api/*` request here; Express's
own router then matches the sub-path (`/api/library`, `/api/projects/:id`,
etc.) from `req.url`, exactly like it does locally. Because of this, **no
route logic belongs in this directory** — all routes live in
`../server/app.js` (see `../server/CLAUDE.md`). Don't add new files here
unless you're intentionally adding a second serverless function; a single
catch-all Express function is what makes local dev and Vercel behave
identically without duplicating route code.
