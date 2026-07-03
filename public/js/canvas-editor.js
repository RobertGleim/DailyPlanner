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
  suppressHistory: false,
  bgRemovalInFlight: false,

  // Custom Fabric props that must survive toJSON/loadFromJSON (history,
  // page save/load all use this). selectable/evented back the layer lock
  // toggle; id/name back the layers panel; generatorGroupId/generatorLabel/
  // generatorParams back the generator group layer + its bulk editor.
  EXTRA_SERIALIZE_PROPS: ['selectable', 'evented', 'id', 'name', 'generatorGroupId', 'generatorLabel', 'generatorParams'],

  init() {
    this.canvas = new fabric.Canvas('pageCanvas', {
      preserveObjectStacking: true,
      backgroundColor: '#ffffff',
    });
    this.setPageSize(this.pageSizeKey);
    this.setZoom(0.7);

    const onObjectsChanged = () => { this.pushHistory(); this.notifyLayersChange(); };
    const onSelectionChanged = () => { this.renderProperties(); this.notifyLayersChange(); };
    ['object:modified', 'object:added', 'object:removed'].forEach((evt) => this.canvas.on(evt, onObjectsChanged));
    ['selection:created', 'selection:updated', 'selection:cleared'].forEach((evt) => this.canvas.on(evt, onSelectionChanged));
    // A generator group's side-handle drag ends here — snap it into a clean regenerated layout.
    this.canvas.on('object:modified', (e) => { if (typeof GroupEditor !== 'undefined') GroupEditor.handleResize(e.target); });

    document.getElementById('zoomSlider').addEventListener('input', (e) => {
      this.setZoom(Number(e.target.value) / 100);
    });
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
