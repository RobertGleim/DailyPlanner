// One-time migration: uploads the preloaded library assets under
// server/data/library/** into Supabase Storage + the library_assets table.
//
// Run this once, after you've created the Supabase project and applied
// supabase/schema.sql + the `library` storage bucket:
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-library.js
//
// (or put those values in .env and run `node --env-file=.env scripts/seed-library.js`)
//
// Safe to re-run: it skips assets whose id already exists in the table.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const LIBRARY_DIR = path.join(__dirname, '..', 'server', 'data', 'library');
const INDEX_FILE = path.join(LIBRARY_DIR, 'index.json');
const BUCKET = process.env.SUPABASE_LIBRARY_BUCKET || 'library';

const CONTENT_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const { items } = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  console.log(`Found ${items.length} preloaded assets to migrate.`);

  const { data: existingRows } = await supabase.from('library_assets').select('id');
  const existingIds = new Set((existingRows || []).map((r) => r.id));

  let uploaded = 0;
  let skipped = 0;
  for (const item of items) {
    if (existingIds.has(item.id)) {
      skipped++;
      continue;
    }
    // item.url looks like /library-files/<category>/<filename>
    const relativePath = item.url.replace('/library-files/', '');
    const filePath = path.join(LIBRARY_DIR, relativePath);
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping ${item.id}: file not found at ${filePath}`);
      continue;
    }
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const storagePath = relativePath; // "<category>/<filename>", same layout as on disk

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: CONTENT_TYPES[ext] || 'application/octet-stream', upsert: true });
    if (uploadError) {
      console.error(`Upload failed for ${item.id} (${storagePath}):`, uploadError.message);
      continue;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const { error: insertError } = await supabase.from('library_assets').insert({
      id: item.id,
      name: item.name,
      category: item.category,
      url: pub.publicUrl,
      created_at: item.createdAt,
    });
    if (insertError) {
      console.error(`Insert failed for ${item.id}:`, insertError.message);
      continue;
    }
    uploaded++;
    if (uploaded % 25 === 0) console.log(`  ${uploaded} uploaded...`);
  }

  console.log(`Done. Uploaded ${uploaded}, skipped ${skipped} (already present).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
