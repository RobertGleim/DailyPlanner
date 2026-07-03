// Grid overlay + snap-to-grid for CanvasEditor — extends the shared object
// defined in canvas-editor.js (must load after it). See public/CLAUDE.md's
// "Grid, snap, and align tools" section for why the grid is a plain DOM
// overlay rather than a Fabric object.
Object.assign(CanvasEditor, {
  // 9/32in college-rule line spacing at this app's 96 screen DPI (see
  // constants.js's SCREEN_DPI) — used for both rows and columns (square
  // cells), since "college rule" only defines row spacing.
  GRID_SIZE_PX: Math.round((9 / 32) * SCREEN_DPI),

  gridVisible: false,
  snapToGridEnabled: false,

  // Creates the grid overlay div once, as a child of Fabric's own
  // wrapperEl (the .canvas-container div around #pageCanvas) so it
  // automatically tracks canvas size and the zoom transform already
  // applied there in applyZoomToCanvasSize() — no separate positioning
  // math needed. Being a plain DOM element (not a fabric.Object), it never
  // appears in canvas.toJSON()/history/PDF export.
  initGrid() {
    const size = this.GRID_SIZE_PX;
    const line = 'rgba(64,140,255,0.35)';
    const el = document.createElement('div');
    el.id = 'gridOverlay';
    el.style.backgroundImage = `repeating-linear-gradient(to bottom, ${line} 0, ${line} 1px, transparent 1px, transparent ${size}px), repeating-linear-gradient(to right, ${line} 0, ${line} 1px, transparent 1px, transparent ${size}px)`;
    el.style.display = 'none';
    this.gridOverlayEl = el;
    this.canvas.wrapperEl.appendChild(el);

    this.canvas.on('object:moving', (e) => this.applyGridSnap(e.target));
    this.canvas.on('object:scaling', (e) => this.applyGridSnap(e.target, { resizing: true }));
  },

  toggleGrid() {
    this.gridVisible = !this.gridVisible;
    this.gridOverlayEl.style.display = this.gridVisible ? 'block' : 'none';
    return this.gridVisible;
  },

  toggleSnapToGrid() {
    this.snapToGridEnabled = !this.snapToGridEnabled;
    return this.snapToGridEnabled;
  },

  // Rounds a moving/resizing object's position (and, while resizing, its
  // scaled size) to the nearest grid multiple. Works the same whether
  // `obj` is a single shape or an ActiveSelection — Fabric reports left/
  // top/scale identically for both (GroupEditor.handleResize relies on the
  // same assumption for object:modified).
  applyGridSnap(obj, { resizing = false } = {}) {
    if (!this.snapToGridEnabled || !obj) return;
    const size = this.GRID_SIZE_PX;
    obj.set({
      left: Math.round(obj.left / size) * size,
      top: Math.round(obj.top / size) * size,
    });
    if (resizing) {
      const w = Math.round((obj.width * obj.scaleX) / size) * size;
      const h = Math.round((obj.height * obj.scaleY) / size) * size;
      obj.set({
        scaleX: w / obj.width,
        scaleY: h / obj.height,
      });
    }
    obj.setCoords();
  },
});
