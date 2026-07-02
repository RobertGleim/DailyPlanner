# Planner Studio

A full-stack app for designing custom **digital daily planners** (or any printable
planner/journal) and exporting them as print-ready, multi-page PDFs you can sell
on Etsy, Amazon, Gumroad, etc.

Built with plain **HTML / CSS / JavaScript** on the frontend and a small
**Node.js + Express** backend. No build step, no framework — open it in VS Code
and it just works.

## Features

- **Drag-and-drop page editor** (powered by Fabric.js) — add text, images, lines,
  rectangles, circles, and reposition/resize/rotate/layer everything.
- **Full image editing** — select any image on the canvas to:
  - resize it precisely (width/height in pixels)
  - adjust opacity
  - apply a color tint (color + intensity)
  - **remove its background** with one click (runs a real AI segmentation model
    entirely in your browser — no API key, no per-image cost, no images ever
    leave your machine)
  - delete it
- **Page backgrounds** — solid colors or full-bleed background images.
- **Page border decorations** — 160 preloaded partial-page decorations (top-only,
  side-only, corner accent, top+side wrap, and full frame) across 8 themes —
  drop one on a page and resize/reposition it like any image. See "What's
  preloaded" below.
- **Calendar generator** — month grid or week strip, 3 visual styles, auto-fills
  the correct days for any month you pick.
- **Checklist / habit-tracker generator** — plain checklist or a multi-column
  habit-tracker grid.
- **Hourly daily schedule generator** — customizable start/end hours.
- **Asset library, preloaded with 381 ready-to-use assets** — upload your own
  images/backgrounds/icons/borders too, and everything is reused across every
  planner you design. Stored locally on your machine via the Node backend, so
  it's fully private and offline. See "What's preloaded" below.
- **Multi-page planners** — add, duplicate, reorder (via drag in the list),
  and delete pages. Each planner is one project with its own page size
  (US Letter or A4).
- **Save / Open projects** — every planner you design is saved as a project
  you can reopen and keep editing later.
- **Export to PDF** — compiles every page into a single print-ready,
  multi-page PDF at 300 DPI, ready to upload to your storefront.

## Getting started

```bash
npm install
npm start
```

Then open **http://localhost:4000** in your browser. Local dev uses on-disk
storage by default (see "Deploying to Vercel" below for the cloud-storage
mode used in production) — no account or setup required.

> **Note on "Remove Background":** the very first time you use it, your browser
> downloads a small AI model (a few MB, one-time, cached afterward) so it needs
> an internet connection once. After that, every background removal runs
> 100% locally in your browser — no images or data are ever sent to any server.

## What's preloaded in the library

The app ships with **381 ready-to-use assets** already in your library
(`server/data/library/`), so you can start designing immediately:

- **100 planner background patterns** — 20 subtle pattern styles (polka dots,
  graph paper, stripes, hexagons, houndstooth, plus signs, topography, zig-zag,
  and more) × 5 popular pastel color palettes (blush pink, sage green,
  lavender, powder blue, warm cream) — the soft, minimalist aesthetic that
  trends across today's best-selling digital planners.
- **121 icons/stickers** — hearts, circles, stars, checkmarks, calendars,
  weather, food & drink, health & fitness, home, work/productivity, money,
  travel, nature, mood faces, and more. All rendered as neutral dark-gray
  line/solid icons so you can recolor them with the image tint tool to match
  any planner's palette.
- **160 page border decorations (AI-generated, transparent PNGs)** — 8 themes ×
  20 designs each, in 5 layout styles per theme so you always have the right
  shape for your layout:
  - **Top border** — decorates only the top strip of the page
  - **Side border** — decorates only the left or right edge
  - **Corner accent** — a cluster in one corner only
  - **Top+side wrap** — flows along the top and down one side (like a vine
    garland wrapping a corner)
  - **Full frame** — decorates all four edges, center left blank

  The 8 themes: **Vines & Botanical**, **Watercolor Florals**,
  **Balloons & Celebration**, **Teacher & School** (apples, pencils, books,
  rulers), **Parent & Family** (hearts, home, love notes), **Kids & Playful**
  (rainbows, animals, doodles), **Baby & Nursery** (clouds, bunnies, moon/stars),
  and **Seasonal** (autumn/winter/spring/summer motifs). Filter to "Page
  Borders" in the Library tab to browse them, or search by theme name.

## Sourcing & licensing

- **Background patterns**: built from [Hero Patterns](https://heropatterns.com)
  tile designs (MIT-licensed, free for commercial use) recolored into a
  curated palette.
- **Icons**: sourced from [Tabler Icons](https://tabler.io/icons)
  (MIT-licensed, 6,000+ free icons, explicitly free for commercial/resale use).
- **Page border decorations**: AI-generated original artwork (via GPT Image 2),
  giving you clear ownership with no third-party licensing concerns.

None of the above legally require attribution, but crediting the open-source
projects is good practice. If you want more variety later, Hero Patterns and
Tabler Icons both have thousands more you can pull in the same way — see
`server/data/library/index.json` for the exact entry format.

## Project structure

```
planner-studio/
  api/
    index.js            # Vercel serverless entry (exports server/app.js)
  vercel.json            # Vercel config: serves public/, routes /api/* to api/index.js
  supabase/
    schema.sql            # Postgres schema used in production (see "Deploying to Vercel")
  scripts/
    seed-library.js        # One-time: migrates preloaded assets into Supabase
  server/
    server.js          # Local dev launcher (npm start) — just calls app.listen()
    app.js              # The actual Express app: REST API + static file serving
    lib/storage/         # Storage adapter — local disk (dev) vs Supabase (Vercel)
    data/
      projects/         # Saved planner projects (JSON) — local driver only
      library/           # Asset library — 381 preloaded assets + anything you upload
        index.json         # Library metadata (id, name, category, url)
        backgrounds/         # 100 preloaded background patterns
        icons/                # 121 preloaded icons/stickers
        borders/               # 160 preloaded page border decorations
  public/
    index.html          # App shell (also sets up the import map for the
                          #  in-browser background-removal engine)
    css/style.css        # All styling
    js/
      app.js             # Main controller — wires everything together
      canvas-editor.js    # Fabric.js canvas wrapper (elements, image editing,
                            #  undo/redo, zoom, properties panel)
      generators.js        # Calendar / checklist / schedule builders
      library-panel.js      # Asset library UI + upload/delete
      pages-manager.js       # Multi-page state + thumbnail sidebar
      export-pdf.js            # Multi-page PDF export (jsPDF)
      api.js                    # Backend REST calls
      constants.js                # Page size + font definitions
      bg-removal-module.js         # Thin ES-module bridge to the background-
                                     #  removal engine (see vendor/ below)
    vendor/
      fabric.min.js        # Canvas engine (bundled — works fully offline)
      jspdf.umd.min.js      # PDF export (bundled — works fully offline)
      bg-removal/            # In-browser AI background-removal engine
        background-removal.mjs
      onnxruntime-web/         # WASM runtime the background-removal engine
                                 #  runs on (bundled — works fully offline once
                                 #  the AI model itself has been cached once)
```

## Deploying to Vercel

The app runs on Vercel as a static frontend (`public/`) plus a serverless
Express function (`api/index.js`). Vercel functions have no writable
filesystem, so production storage uses Supabase (Postgres + Storage) instead
of local disk — this only affects the deployed app; local dev is unaffected.

1. Create a [Supabase](https://supabase.com) project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. In Supabase Storage, create a **public** bucket named `library`.
4. In your Vercel project's Settings -> Environment Variables, set:
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Supabase Settings -> API)
   - `SUPABASE_LIBRARY_BUCKET=library`
5. Migrate the 381 preloaded assets into Supabase once, from your machine:
   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:library
   ```
6. In Vercel, import the GitHub repo as a new project — `vercel.json` is
   picked up automatically, no build command needed. Deploy.

See `CLAUDE.md` for the full storage architecture (`server/lib/storage/`).

## How selling your planners works

1. Design your planner pages in the app (backgrounds, text, images, calendars,
   checklists, border decorations, etc.). Browse the preloaded library for a
   quick start.
2. Click **Save** to keep the project in your local library so you can keep
   editing it later.
3. Click **Export PDF** to generate the final, print-ready multi-page PDF.
4. Upload that PDF file to your Etsy/Amazon/Gumroad listing as your digital
   product.

## Editing an image on the canvas

Click any image (or border decoration) on the page, and the right-hand
**Properties** panel shows:

- **Width / Height (px)** — type exact pixel dimensions to resize it (e.g. set
  a border decoration to your page's full width/height).
- **Tint color + intensity** — colorize the image (set intensity to 0 to remove).
  Great for recoloring the preloaded icons to match your planner's palette.
- **Opacity** — fade the image.
- **✂️ Remove Background** — cuts the subject out onto a transparent background,
  replacing the image in place (same position, size, and rotation).
- **🗑 Delete Element** — removes it from the page (also available via the
  "Delete Selected" button in the canvas toolbar for any element type).

## Notes on customizing

- Page sizes are defined in `public/js/constants.js` (`PAGE_SIZES`) — add more
  sizes (e.g. Half Letter, A5) by adding entries there.
- All fonts available in the text properties panel are listed in
  `FONT_CHOICES` in `constants.js`. Add any web-safe font name there to make
  it selectable.
- Library assets are stored under `server/data/library/<category>/` with an
  index at `server/data/library/index.json` — back this folder up if you
  build a large asset collection (your own uploads are stored alongside the
  preloaded ones, same format).
- Saved planner projects live under `server/data/projects/*.json` — back these
  up too; each file is a complete, human-readable project.
- The server sets `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy`
  headers so the background-removal engine can use faster multi-threaded WASM.
  This is safe because every script the app loads is served locally from this
  same app — don't add `<script src="https://...">` tags pointing at
  third-party CDNs without also giving them CORS/CORP headers, or the page
  may fail to load those resources.
