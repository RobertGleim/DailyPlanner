# public/ — CLAUDE.md

Frontend for Planner Studio: plain HTML/CSS/JS, no build step, no framework.
Served as static files by Express locally (`server/app.js`) and by Vercel
directly in production (see `../vercel.json`). For the overall project
picture, start at the root `../CLAUDE.md`.

## File map

```
public/
  index.html              # App shell — toolbar, both sidebars, canvas, modal
  css/style.css            # All styling — design tokens live in :root
  js/
    constants.js             # PAGE_SIZES, FONT_CHOICES (load first)
    icons.js                  # Self-hosted SVG icon set (see below, load early)
    api.js                     # fetch() wrappers for /api/* (see server/CLAUDE.md)
    library-panel.js            # Library tab: upload/browse/delete assets
    generators.js                # Calendar/checklist/schedule builders
    pages-manager.js              # Multi-page state + thumbnail sidebar
    export-pdf.js                  # jsPDF multi-page export
    canvas-editor.js                # Fabric.js canvas wrapper + properties panel
    app.js                           # Boots everything, wires event handlers
    bg-removal-module.js              # ES-module bridge to the AI bg-removal engine
  vendor/                  # fabric.js, jsPDF, onnxruntime-web, bg-removal engine
                            #  — all bundled locally, see the CDN rule below
```

Scripts load as plain globals (no bundler, no `type="module"` except
`bg-removal-module.js`), in the order listed at the bottom of `index.html`.
Order matters only in that a script must load before anything that *calls*
its functions at runtime — since nothing besides `bg-removal-module.js`
executes at parse time, this is rarely an issue in practice.

## Brand & design system (`css/style.css` `:root`)

Summer palette — coral primary, turquoise accent, sunshine-yellow highlight,
warm cream/sand neutrals (replaced the original cool-gray/indigo palette):

```css
--primary: #FF6B4A;   /* coral — Save, active tab, primary CTAs */
--accent:  #1FBFAE;   /* turquoise — Export PDF, generator "Insert" buttons */
--highlight: #FFC93C; /* sunshine yellow — used sparingly, e.g. .callout */
--danger:  #E23744;   /* raspberry red — delete/destructive actions */
--bg: #FFF8F0; --panel: #FFFFFF; --border: #F0E1D0; --text: #332B22; --muted: #8C7F6E;
```

Typography is the system font stack (no custom font files) — see "No
external CDNs" below for why. Layout pattern: each sidebar tab wraps its
logical groups in `.sidebar-section` cards (`--panel` bg, `--radius-lg`,
`--shadow-sm`) rather than a flat list. `.btn` / `.btn-primary` / `.btn-accent`
/ `.btn-danger` is the button system; `.tool-btn` is the sidebar icon+label
button variant. `:focus-visible` gets a coral outline globally — keep this
when adding new interactive elements, it's the app's only keyboard-focus
indicator.

## Icon system (`js/icons.js`)

Hand-authored inline SVGs (24x24 viewBox, `stroke="currentColor"`), no
icon-font or CDN dependency. Two ways to use it:

- **Dynamic JS**: call `icon('name', { size, className })` — returns an SVG
  string, e.g. `` `${icon('trash', { size: 14 })} Delete` ``.
- **Static HTML**: add `data-icon="name"` to any element; a `DOMContentLoaded`
  listener in `icons.js` hydrates it by prepending the icon's SVG to that
  element's existing content. This is why `index.html` itself contains no
  raw SVG or emoji — see e.g. `<button data-icon="save">Save</button>`.

Add new icons by adding a `name: '<path .../>'` entry to `ICON_PATHS` in
`icons.js`. Icons are decorative (`aria-hidden="true"`) — icon-only buttons
(no visible text label) must carry their own `aria-label`.

## No external CDNs / strict COEP

`server/app.js` sets `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` so the background-removal
engine can use multi-threaded WASM. Every script/asset this app loads is
served from this same origin (`vendor/`, `js/`, `css/`) — **never** add a
`<script src="https://...">`, external stylesheet, or web font pointing at a
third-party CDN without also solving CORS/CORP for it, or the page will
silently fail to load that resource. This is also why the redesign kept the
system font stack instead of adding a Google Fonts (or similar) dependency.

## Security note

`library-panel.js`, `app.js`, and `pages-manager.js` render user-supplied
strings (uploaded asset names, project names) into the DOM. Always build
those nodes with `textContent`/property assignment (`img.alt = name`), never
string-interpolate user data into an `innerHTML` template — two stored-XSS
bugs of exactly that shape were fixed during the 2026-07 redesign. `icon()`
output is safe to interpolate into `innerHTML` since it only ever returns
hardcoded strings from `ICON_PATHS`.
