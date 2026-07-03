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
    font-loader.js              # Loads /api/fonts catalog, lazily registers webfonts via FontFace API
    library-panel.js            # Library tab: upload/browse/delete assets
    generators.js                # Calendar/checklist/schedule builders
    pages-manager.js              # Multi-page state + thumbnail sidebar
    export-pdf.js                  # jsPDF multi-page export
    canvas-editor.js                # CanvasEditor core: state, init/zoom/page-size (see below)
    canvas-elements.js                # + element creation (text/line/rect/circle/image), delete/reorder
    canvas-background.js               # + page background (color/image/gradient/tint)
    canvas-image-tools.js               # + per-image resize/tint/AI background removal
    properties-panel.js                  # + renderProperties() and its per-type editing fields
    canvas-history.js                     # + undo/redo + page load/save serialization
    layers-panel.js                        # Photoshop-style layers list (see below)
    group-editor.js                         # Bulk properties editor for a selected generator group (see below)
    app.js                                   # Boots everything, wires event handlers
    bg-removal-module.js                      # ES-module bridge to the AI bg-removal engine
  vendor/                  # fabric.js, jsPDF, onnxruntime-web, bg-removal engine
                            #  — all bundled locally, see the CDN rule below
```

`CanvasEditor` is one shared object split across six files instead of one
big one — `canvas-editor.js` declares `const CanvasEditor = {...}` with
just its state and the cross-cutting `stampLayerIdentity`/
`notifyLayersChange` helpers; every other `canvas-*.js`/
`properties-panel.js` file extends that *same* object via
`Object.assign(CanvasEditor, {...})`, so every call site elsewhere
(`CanvasEditor.addText()`, `CanvasEditor.pushHistory()`, etc.) works exactly
as if it were still one file. Each extension file must load after
`canvas-editor.js` (see `index.html`'s script order) — `canvas-image-tools.js`
additionally needs `canvas-background.js`'s `tintFabricImage` helper loaded
first. Split this way because the single file had grown past a readable
size mixing six distinct concerns; if you're adding a new CanvasEditor
method, put it in whichever of these files matches its concern (or start a
new `canvas-*.js` file for a genuinely new one) rather than growing one of
these back past ~150 lines.

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
system font stack instead of linking directly to `fonts.googleapis.com`.

The full Google Fonts catalog (`js/font-loader.js`, see `scripts/CLAUDE.md`'s
`seed-fonts.js` entry) sidesteps this without violating the rule above: font
files are self-hosted in our own Supabase Storage bucket (not a third-party
font CDN), and `FontFace` always fetches cross-origin resources in CORS
mode — the same mechanism `canvas-editor.js` already relies on for library
images via `crossOrigin: 'anonymous'`. Supabase's public bucket sends
`Access-Control-Allow-Origin: *`, and a passing CORS response satisfies COEP
`require-corp` on its own (no separate `Cross-Origin-Resource-Policy` header
needed). If you ever swap storage providers, confirm the new one still sends
permissive CORS headers on public asset URLs, or both this and existing
library image loads will start failing under COEP.

## Generator output convention (`js/generators.js`, `js/canvas-editor.js`)

`Generators.buildCalendar`/`buildChecklist`/`buildSchedule` each return a
**plain array of Fabric objects** — never a `fabric.Group`. Text objects
they create must set `lockScalingX: true, lockScalingY: true` (hides that
object's resize handles; its size can only change via the properties
panel's Size field). Insertion goes through
`CanvasEditor.addGeneratedObjects(objects)`, never `canvas.add()` directly —
it adds the whole batch as one undo step and selects everything via a
`fabric.ActiveSelection` with side handles hidden (`setControlsVisibility`),
so the block still moves/resizes as one unit immediately after insert
without distorting.

This exists because wrapping generator output in a `fabric.Group` (the
original implementation) broke two things at once: resizing a Group applies
one affine transform to every child, so a side-handle drag gave
`scaleX !== scaleY` and visibly stretched text glyphs; and
`CanvasEditor.renderProperties()` has no `case` for `obj.type === 'group'`,
so a selected Group only ever showed an Opacity slider — every line, text
label, and border rect a generator produced was completely uneditable after
insert (no way to recolor a divider line or delete a border). Keep future
generators (and the planner-wizard/preset-template work described in the
root `CLAUDE.md`) following this same array-of-plain-objects convention, or
both bugs come back.

Since the array-of-plain-objects convention means nothing keeps a
generator's pieces together beyond the one-shot `ActiveSelection`
`addGeneratedObjects` sets up at insert time, every object in a batch is
also stamped with a shared `generatorGroupId` + `generatorLabel` (the
caller passes the label, e.g. `CanvasEditor.addGeneratedObjects(objects,
'Calendar')` — see `initGenerators()` in `app.js`). The layers panel (below)
uses that to show the whole batch as one collapsible layer and rebuilds a
fresh `ActiveSelection` over every member each time that layer is
selected/dragged, so a calendar's border, grid lines, and labels keep
moving together permanently — not just immediately after insert.

## Layers panel (`js/layers-panel.js`)

A Photoshop-style layers list in the right sidebar, between Properties and
Pages. Every object added to the canvas (via `CanvasEditor.addText`/
`addLine`/`addRect`/`addCircle`/`addImageFromUrl`/`addGeneratedObjects`) is
stamped with a stable `id` and a default `name` by
`CanvasEditor.stampLayerIdentity()`. `LayersPanel` reads
`canvas.getObjects()` directly off `CanvasEditor.canvas` (rather than
`CanvasEditor` growing more methods) to stay within this project's 500-line
file-size guideline — see that file's own top-of-file comment for why.

Rows render top-of-stack first (reversed from Fabric's own bottom-first
array order) with click-to-select, an eye (visibility) toggle, a lock
toggle (`selectable`/`evented`, the same mechanism already used to pin the
background image — see below; for a locked generator group, the group's
lock button also mirrors that state onto the `ActiveSelection` wrapper built
around its members — see "Group (generator) bulk properties editor" below),
a delete button, and native HTML5
drag-and-drop reordering (`canvas.moveTo`, converting the panel's top-first
row order back to Fabric's bottom-first array order). Objects sharing a
`generatorGroupId` collapse into one row, expandable to select/edit
individual pieces without losing the "move as one unit" behavior.

`id`/`name`/`generatorGroupId`/`generatorLabel`/`generatorParams` are custom
(non-default) Fabric properties, so they only survive
`canvas.toJSON()`/`loadFromJSON()` round trips because they're listed in
`CanvasEditor.EXTRA_SERIALIZE_PROPS` (alongside the pre-existing
`selectable`/`evented`) — if you add another custom prop that the layers
panel (or anything else) needs to persist through save/undo/reload, add it
there too, or it'll silently vanish. `visible` needs no such whitelisting —
it's a standard Fabric property that `toJSON`/`loadFromJSON` and the
renderer (live canvas and the offscreen `fabric.StaticCanvas` in
`export-pdf.js`) already handle natively, which is also why hiding a layer
requires zero changes to PDF export: export already rasterizes whatever
`loadFromJSON` renders, in array order, skipping invisible objects.

## Group (generator) bulk properties editor (`js/group-editor.js`)

Selecting a generator's whole layer group (`LayersPanel.selectGroup`, an
`ActiveSelection` over every object sharing one `generatorGroupId`) swaps
`CanvasEditor.renderProperties()` over to `GroupEditor.render()` instead of
the generic Opacity+Delete ActiveSelection fallback —
`GroupEditor.isFullGroupSelection()` gates this to an *exact* full-group
selection so a manual marquee that happens to catch only some of a group's
shapes never triggers it (that would otherwise let a regenerate silently
delete the unselected rest). The gate lives in `canvas-editor.js` itself
(a few lines, checking `obj.type === 'activeSelection'`); all the field
rendering and regeneration logic lives in `group-editor.js` to keep
`canvas-editor.js` under this project's 500-line file-size guideline.

`GroupEditor` renders the *same* fields as that generator's own
`#tab-generators` insert panel (view/month/year/style + font + colors for
Calendar; rows/cols/title + font + colors for Checklist; hours/title + font
+ colors for Schedule — `FIELD_SETS` in `group-editor.js`), pre-filled from
`generatorParams` (the exact params object `Generators.build*()` was
originally called with, stamped on every object in the batch by
`CanvasEditor.addGeneratedObjects(objects, groupLabel, generatorParams)`).
Editing any field **regenerates the whole group in place**: it replays the
updated params through the same `Generators.build*()` function, removes the
old member objects, repositions the fresh batch to the old group's on-page
location, and re-stamps the new objects with the same `generatorGroupId` so
the group's identity persists. This is a deliberate tradeoff — like a
design tool's "smart object," any one-off manual edit previously made to an
individual member (expand the group, click a sub-row, tweak its color) is
lost the next time a bulk field changes. Editing individual members
directly is otherwise unaffected and still goes through the normal
per-type `renderProperties()` branches.

Field inputs bind on `input` for a live preview as the user types/drags. A
regenerate destroys and recreates every object in the group and briefly
discards the active selection along the way — both are the kind of
mid-batch canvas mutation that fires Fabric events (`object:added`/
`object:removed`/`selection:cleared`) on every intermediate step. Left
unguarded, `selection:cleared` alone is enough to break this: it's wired to
`CanvasEditor.renderProperties()`, which sees no active object and wipes
the whole Properties panel to its placeholder — destroying the very
`<input>` the user is mid-drag/mid-type in and force-closing any open
native color-picker popup (this was a real, live-confirmed bug: color edits
looked non-live, and dragging a color swatch appeared to "select" and stop
responding instantly). `regenerate()` avoids this by wrapping its entire
discard-through-reselect body in `CanvasEditor.suppressHistory = true`,
which `canvas-editor.js`'s `onObjectsChanged`/`onSelectionChanged`
listeners check before calling `pushHistory()`/`notifyLayersChange()`/
`renderProperties()` — see that flag's doc comment in `canvas-editor.js`.
The panel's own `<input>` DOM nodes are therefore never destroyed mid-edit;
`render()`'s separate `panelEl.dataset.geGroupId` skip-rebuild guard (skips
`innerHTML` rebuild when re-entered for the *same* group it's already
showing) then keeps the panel from replacing itself even on the one
`selection:updated` that fires after `suppressHistory` is turned back off.
`renderProperties()`'s non-`GroupEditor` branches still clear that marker so
switching to a different object/group forces a fresh render.

`regenerate()` also fixed a related, previously-persistent off-page-snap bug
in its position-preserving step: it now calls `canvas.discardActiveObject()`
*before* reading the old group's members' `left`/`top`
(`boundingTopLeft(members)`), not after. While those members are still part
of the `ActiveSelection` that triggered the edit, Fabric reports their
`left`/`top` relative to that selection's own coordinate frame, not the
canvas — discarding first restores their absolute canvas coordinates, which
the position-preserving shift depends on. (Reading the *fresh*, not-yet-
canvas-attached batch's `left`/`top` via plain properties rather than
`getBoundingRect(true, true)` was already correct from an earlier fix, since
every object generators.js produces is axis-aligned/unrotated and Fabric's
absolute-bounding-rect calculation on a canvas-less object returns `NaN`.)

**Lock-all**: `LayersPanel.buildGroupRow()`'s header carries a lock button
(`LayersPanel.setGroupLocked`) alongside the expand toggle and delete
button, matching the per-object lock button every row already has — sets
`selectable`/`evented` on every member in one batch (same
suppress-history-around-a-batch pattern as `deleteGroup`). That alone only
blocks direct clicks on individual members, though — the `ActiveSelection`
wrapper built around a group's members (`LayersPanel.selectGroup`,
`GroupEditor.regenerate`) has its own independent `selectable`/`evented`
state, so both call sites separately check whether every member is locked
and mirror that onto the wrapper's own constructor options. Without this, a
locked group's members were individually unclickable but the group-as-a-unit
selection was still fully draggable — a real, reported gap.

**Duplicate/stale selection outline**: every place that builds a fresh
`fabric.ActiveSelection` over a generator group's members
(`CanvasEditor.addGeneratedObjects`, `GroupEditor.regenerate`,
`LayersPanel.selectGroup`) calls `canvas.discardActiveObject()`
immediately before construction and `selection.setCoords()` immediately
after — a defensive fix for a known Fabric.js footgun where a freshly
built `ActiveSelection`, activated in the same tick, can render a
mismatched/duplicate selection outline alongside the real one. Keep this
pattern at any future `new fabric.ActiveSelection(...)` call site.

**Resize (drag handles + Width/Height fields)**: a generator group's
`ActiveSelection` resize handles (`ml`/`mr`/`mt`/`mb`, previously hidden to
avoid Fabric's default non-uniform-scale text distortion) are enabled
again. `Generators.buildCalendar`/`buildChecklist`/`buildSchedule` each
accept optional `width`/`rowHeight` params (defaulting to their original
hardcoded layout constants) that resize only grid/line geometry — every
text object's `fontSize` is already an independent hardcoded constant per
role, never derived from `width`/cell dimensions, so parameterizing just
the layout constants leaves text sizing untouched with no extra "don't
touch text" logic needed. `GroupEditor.FIELD_SETS` exposes these as
Width(px)/Height(px) fields (same pattern as an Image element's own
Width/Height fields), and `GroupEditor.handleResize()` (wired to
`object:modified` in `canvas-editor.js`) converts a finished drag's
`getScaledWidth()`/`getScaledHeight()` into the same params via each
generator's own height formula inverted (`inverseRowHeight()` —
best-effort, not pixel-exact for the habit-tracker header offset) and
regenerates through the same in-place path `GroupEditor.render()`'s fields
use. Calendar's `year` view has a fixed mini-grid layout that ignores both
params — `handleResize`/the Height field explicitly no-op with a toast/hint
rather than silently doing nothing.

Every `buildCalendar`/`buildChecklist`/`buildSchedule` call also takes
`fontFamily` + a set of colors (`headerColor`/`textColor`/`accentColor`,
plus `weekendColor` and/or `highlightColor` where semantically meaningful —
see the field table in this project's font/generator planning history)
instead of hardcoding fonts/hex colors — each generator box in
`index.html`'s `#tab-generators` carries its own font picker and color
inputs, read at insert time in `app.js`'s `initGenerators()`. `buildSchedule`
returns `[]` if `endHour <= startHour` — callers must check for that (see
`CanvasEditor.addGeneratedObjects`'s own empty-array guard) instead of
assuming a non-empty result. Calendar month/year always take plain numbers
(`month` 1-12, `year`) from `<select>`/`<input type="number">` — never a
parsed date string. An earlier version used a free-text "MM-YYYY" field
whose label didn't match its actual parse order (year-then-month), silently
producing garbage dates; don't reintroduce a string-format date field here.

## Shared font-picker (`FontLoader.attachPicker`, `js/font-loader.js`)

The searchable font combobox (used by the properties panel's Font field and
every generator box's font picker) lives in one place:
`FontLoader.attachPicker({ inputEl, resultsEl, initialValue, onSelect })`.
It wires search-filter/render/click behavior against `FontLoader.catalog`
with `FONT_CHOICES` pinned at the top of the unfiltered list. Callers only
supply the two DOM elements (matching the `.font-picker`/`.font-picker-results`
markup pattern — copy an existing usage in `index.html` rather than
hand-rolling new combobox HTML) and an `onSelect(family)` callback; don't
duplicate the search/render logic inline elsewhere.

## Security note

`library-panel.js`, `app.js`, and `pages-manager.js` render user-supplied
strings (uploaded asset names, project names) into the DOM. Always build
those nodes with `textContent`/property assignment (`img.alt = name`), never
string-interpolate user data into an `innerHTML` template — two stored-XSS
bugs of exactly that shape were fixed during the 2026-07 redesign. `icon()`
output is safe to interpolate into `innerHTML` since it only ever returns
hardcoded strings from `ICON_PATHS`.
