// Vercel serverless entry point. All /api/* requests are rewritten here
// (see vercel.json), and the Express app's own router handles the sub-path
// matching (e.g. /api/library, /api/projects/:id) from req.url.
module.exports = require('../server/app');
