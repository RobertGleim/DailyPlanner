// One-time migration: downloads the regular-weight file of every family in
// the google/fonts repo, converts it to WOFF2, and uploads it to Supabase
// Storage + the `fonts` table. Unlike scripts/seed-library.js, there is no
// local copy of these files to seed from (~1,800 files is too large to
// commit to this repo) — everything is fetched live from GitHub.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-fonts.js
//
// (or put those values in .env and run `node --env-file=.env scripts/seed-fonts.js`)
//
// Flags:
//   --dry-run     Download + convert fonts to measure real sizes, but skip
//                 the Supabase upload/insert (nothing is written).
//   --limit N     Only process the first N families — use this to test
//                 before committing to a multi-hour full run.
//
// Safe to re-run: skips families whose id already exists in the `fonts`
// table, so an interrupted run can just be re-started.
require('dotenv').config();
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const wawoff2 = require('wawoff2');
const { createClient } = require('@supabase/supabase-js');

const REPO_URL = 'https://github.com/google/fonts.git';
const RAW_BASE = 'https://raw.githubusercontent.com/google/fonts/main';
const TOP_DIRS = ['ofl', 'apache', 'ufl'];
const BUCKET = process.env.SUPABASE_LIBRARY_BUCKET || 'library';
const CONCURRENCY = 8;

const CATEGORY_MAP = {
  SANS_SERIF: 'sans-serif',
  SERIF: 'serif',
  DISPLAY: 'display',
  HANDWRITING: 'handwriting',
  MONOSPACE: 'monospace',
};

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const limitFlag = argv.find((a) => a.startsWith('--limit'));
  let limit = null;
  if (limitFlag) {
    const eq = limitFlag.split('=')[1];
    limit = Number(eq || argv[argv.indexOf(limitFlag) + 1]);
  }
  return { dryRun, limit: Number.isFinite(limit) ? limit : null };
}

function slugify(family) {
  return family.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// The METADATA.pb textproto format is stable enough (confirmed against
// several live samples) for a line-based regex parse — no full protobuf
// parser needed for the handful of fields we care about.
function parseMetadata(text) {
  const nameMatch = text.match(/^name:\s*"([^"]*)"/m);
  const categoryMatch = text.match(/^category:\s*"([^"]*)"/m);
  if (!nameMatch) return null;

  const fontBlocks = [...text.matchAll(/fonts\s*\{([^}]*)\}/g)].map((m) => m[1]);
  const parsedFonts = fontBlocks.map((block) => ({
    style: (block.match(/style:\s*"([^"]*)"/) || [])[1],
    weight: Number((block.match(/weight:\s*(\d+)/) || [])[1]),
    filename: (block.match(/filename:\s*"([^"]*)"/) || [])[1],
  })).filter((f) => f.filename);

  const normalFonts = parsedFonts.filter((f) => f.style === 'normal');
  const candidates = normalFonts.length ? normalFonts : parsedFonts;
  if (!candidates.length) return null;
  candidates.sort((a, b) => Math.abs((a.weight || 400) - 400) - Math.abs((b.weight || 400) - 400));
  const chosen = candidates[0];

  const wghtAxis = text.match(/axes\s*\{\s*tag:\s*"wght"\s*min_value:\s*([\d.]+)\s*max_value:\s*([\d.]+)/);
  const weightRange = wghtAxis ? `${Number(wghtAxis[1])}-${Number(wghtAxis[2])}` : String(chosen.weight || 400);

  return {
    family: nameMatch[1],
    category: CATEGORY_MAP[categoryMatch && categoryMatch[1]] || 'sans-serif',
    filename: chosen.filename,
    weightRange,
  };
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Cheap concurrency pool — avoids adding a dependency just for this.
async function runPool(items, worker, concurrency) {
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const i = cursor++;
      await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
}

async function main() {
  const { dryRun, limit } = parseArgs(process.argv.slice(2));
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'google-fonts-'));
  console.log(`Cloning google/fonts (treeless, no blobs) into ${tmpDir} ...`);
  execFileSync('git', ['clone', '--filter=blob:none', '--no-checkout', '--depth', '1', REPO_URL, tmpDir], { stdio: 'inherit' });

  const lsTreeOut = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', ...TOP_DIRS], { cwd: tmpDir, encoding: 'utf-8' });
  let metadataPaths = lsTreeOut.split('\n').filter((p) => p.endsWith('METADATA.pb'));
  if (limit) metadataPaths = metadataPaths.slice(0, limit);
  console.log(`Found ${metadataPaths.length} font families${limit ? ` (limited to ${limit})` : ''}.`);

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) { /* best-effort cleanup */ }

  const { data: existingRows } = await supabase.from('fonts').select('id');
  const existingIds = new Set((existingRows || []).map((r) => r.id));

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let totalBytes = 0;

  await runPool(metadataPaths, async (metaPath) => {
    const id = slugify(path.basename(path.dirname(metaPath)));
    if (existingIds.has(id)) {
      skipped++;
      return;
    }
    try {
      const metaText = await fetchText(`${RAW_BASE}/${metaPath}`);
      const parsed = parseMetadata(metaText);
      if (!parsed) {
        console.warn(`Skipping ${metaPath}: could not parse METADATA.pb`);
        failed++;
        return;
      }

      const folder = path.dirname(metaPath).replace(/\\/g, '/');
      const fontUrl = `${RAW_BASE}/${folder}/${encodeURIComponent(parsed.filename)}`;
      const ttfBuffer = await fetchBuffer(fontUrl);
      const woff2Buffer = Buffer.from(await wawoff2.compress(ttfBuffer));
      totalBytes += woff2Buffer.length;

      if (!dryRun) {
        const storagePath = `fonts/${id}.woff2`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, woff2Buffer, { contentType: 'font/woff2', upsert: true });
        if (uploadError) throw uploadError;

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        const { error: insertError } = await supabase.from('fonts').insert({
          id,
          family: parsed.family,
          category: parsed.category,
          url: pub.publicUrl,
          weight_range: parsed.weightRange,
        });
        if (insertError) throw insertError;
      }

      uploaded++;
      if (uploaded % 25 === 0) {
        console.log(`  ${uploaded} done (${skipped} skipped, ${failed} failed) — ~${(totalBytes / 1024 / 1024).toFixed(1)}MB so far`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed ${metaPath}:`, e.message || e);
    }
  }, CONCURRENCY);

  console.log(`Done${dryRun ? ' (dry run — nothing written)' : ''}. Uploaded ${uploaded}, skipped ${skipped} (already present), failed ${failed}.`);
  console.log(`Total font payload: ~${(totalBytes / 1024 / 1024).toFixed(1)}MB.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
