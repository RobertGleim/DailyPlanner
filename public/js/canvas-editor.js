// Core Fabric.js canvas wrapper: state, init/zoom/page-size, and the
// cross-cutting stampLayerIdentity/notifyLayersChange helpers. Everything
// else CanvasEditor does (element creation, background, image tools,
// properties panel, history/persistence) is added onto this same object by
// the other canvas-*.js / properties-panel.js files, each loaded right
// after this one — see public/CLAUDE.md's file map.
const CanvasEditor = {
  canvas: null,
  pageSizeKey: 'letter',
  history: [],
  historyIndex: -1,
  bgRemovalInFlight: false,

  // Custom Fabric props that must survive toJSON/loadFromJSON (history,
  // page save/load all use this). selectable/evented back the layer lock
  // toggle; id/name back the layers panel; generatorGroupId/generatorLabel/
  // generatorParams back the generator group layer + its bulk editor.
  EXTRA_SERIALIZE_PROPS: ['selectable', 'evented', 'id', 'name', 'generatorGroupId', 'generatorLabel', 'generatorParams'],

  // Set true around a multi-step canvas mutation (adding/removing a whole
  // generator batch, regenerating a group in place) so the per-object
  // add/remove/selection events that fire mid-batch don't each independently
  // trigger a history push, a layers-panel rebuild, or (critically) a
  // Properties-panel re-render — a discardActiveObject() mid-batch fires
  // 'selection:cleared', and without this guard that wipes the panel's
  // <input> the user may be actively dragging/typing in. Callers flip it
  // back off and fire the suppressed side effects once, after the whole
  // batch settles.
  suppressHistory: false,

  init() {
    this.canvas = new fabric.Canvas('pageCanvas', {
      preserveObjectStacking: true,
      backgroundColor: '#ffffff',
    });
    this.setPageSize(this.pageSizeKey);
    this.setZoom(0.7);

    const onObjectsChanged = () => { if (this.suppressHistory) return; this.pushHistory(); this.notifyLayersChange(); };
    const onSelectionChanged = () => { if (this.suppressHistory) return; this.renderProperties(); this.notifyLayersChange(); };
    ['object:modified', 'object:added', 'object:removed'].forEach((evt) => this.canvas.on(evt, onObjectsChanged));
    ['selection:created', 'selection:updated', 'selection:cleared'].forEach((evt) => this.canvas.on(evt, onSelectionChanged));
    // A generator group's side-handle drag ends here — snap it into a clean regenerated layout.
    this.canvas.on('object:modified', (e) => { if (typeof GroupEditor !== 'undefined') GroupEditor.handleResize(e.target); });

    document.getElementById('zoomSlider').addEventListener('input', (e) => {
      this.setZoom(Number(e.target.value) / 100);
    });

    // Grid overlay/snap-to-grid (canvas-grid.js) and align/distribute/
    // snap-to-objects (canvas-align.js) — both load after this file, so
    // both methods already exist by the time boot() calls init().
    this.initGrid();
    this.initAlign();
  },

  notifyLayersChange() {
    if (this.onLayersChange) this.onLayersChange();
  },

  setPageSize(key) {
    this.pageSizeKey = key;
    const { width, height } = pageDimsPx(key);
    this.canvas.setWidth(width);
    this.canvas.setHeight(height);
    this.baseWidth = width;
    this.baseHeight = height;
    this.applyZoomToCanvasSize();
  },

  setZoom(zoom) {
    this.zoom = zoom;
    this.applyZoomToCanvasSize();
    // Regenerate the grid pattern for the new zoom (canvas-grid.js) — a
    // no-op via its own guard until initGrid() has run (setZoom() also
    // fires once earlier, during init(), before the grid overlay exists).
    if (this.updateGridPattern) this.updateGridPattern();
  },

  applyZoomToCanvasSize() {
    if (!this.canvas) return;
    const el = this.canvas.wrapperEl;
    if (el) {
      el.style.transform = `scale(${this.zoom})`;
      el.style.transformOrigin = 'top center';
    }
  },

  // Stamps a stable id + default display name onto a newly-created object
  // for the layers panel. Called at every insertion point (single-element
  // add, generator batches, background removal's replacement image) so
  // every object on the canvas always has both.
  stampLayerIdentity(obj, name) {
    obj.set({ id: obj.id || cryptoRandomId(), name: obj.name || name });
  },
};
