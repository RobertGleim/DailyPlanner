-- Planner Studio — Supabase schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`) for
-- the project the Vercel deployment will use. Local dev (npm start) does
-- not need this — it uses local-disk storage by default.

create table if not exists library_assets (
  id text primary key,
  name text not null,
  category text not null check (category in ('images', 'backgrounds', 'icons', 'borders')),
  url text not null,
  created_at timestamptz not null default now()
);
create index if not exists library_assets_category_idx on library_assets (category);

create table if not exists projects (
  id text primary key,
  name text not null default 'Untitled Planner',
  page_size text not null default 'letter',
  pages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- After running this file, also create a public Storage bucket named
-- `library` (Storage -> New bucket -> "Public bucket" on) in the Supabase
-- dashboard, or via the CLI:
--   supabase storage buckets create library --public
-- The bucket name is configurable via the SUPABASE_LIBRARY_BUCKET env var
-- if you'd rather name it something else.
