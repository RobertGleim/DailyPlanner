// Picks the storage driver: explicit STORAGE_DRIVER env var wins; otherwise
// default to Supabase on Vercel (no writable filesystem there) and local
// disk everywhere else (e.g. `npm start`).
const driver = process.env.STORAGE_DRIVER || (process.env.VERCEL ? 'supabase' : 'local');

module.exports = driver === 'supabase'
  ? require('./supabase')
  : require('./local');
