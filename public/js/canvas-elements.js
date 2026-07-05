// Element creation/manipulation methods for CanvasEditor — extends the
// shared object defined in canvas-editor.js (must load after it). See
// public/CLAUDE.md's file map for why CanvasEditor is split across files.

// A straight fabric.Line's bounding-box height is ~0 (just strokeWidth),
// which puts Fabric's default corner controls (tl/tr/bl/br) almost exactly
// on top of the ml/mr edge controls at both ends — a live-confirmed bug
// where dragging to extend the line, or drag the vertical handle, would
// unpredictably grab a corner instead and collapse/flip the near-zero
// height, making the line appear to vanish. Fix: drop the corner controls
// (a line has no meaningful diagonal-resize concept anyway) and replace
// mt/mb with a dedicated thickness control that adjusts strokeWidth
// directly, instead of the default scaleY bounding-box stretch. ml/mr/mtr
// keep Fabric's own defaults by reference — same reuse pattern Fabric
// itself uses internally for fabric.Textbox's custom control set — since
// scalingX (extend/shorten from whichever end, anchoring the other) and
// rotate already work correctly once the corner controls stop interfering.
// This must be a prototype-level override (not per-instance) to also apply
// to a line reloaded from a saved project, since `controls` isn't
// serialized by toJSON/loadFromJSON.
function makeLineThicknessHandler(direction) {
  return function (eventData, transform, x, y) {
    const target = transform.target;
    if (target.lockScalingY) return false;
    const delta = (y - transform.lastY) * direction;
    const current = target.strokeWidth || 1;
    const next = Math.min(30, Math.max(1, Math.round(current + delta)));
    if (next === current) return false;
    target.set('strokeWidth', next);
    target.setCoords();
    return true;
  };
}

fabric.Line.prototype.controls = {
  ml: fabric.Object.prototype.controls.ml,
  mr: fabric.Object.prototype.controls.mr,
  mtr: fabric.Object.prototype.controls.mtr,
  // Dragging away from the line's body (up on mt, down on mb) always
  // thickens it; dragging toward it thins it — symmetric regardless of
  // which handle you grab.
  mt: new fabric.Control({
    x: 0,
    y: -0.5,
    cursorStyleHandler: () => 'ns-resize',
    actionHandler: makeLineThicknessHandler(-1),
    actionName: 'changeThickness',
  }),
  mb: new fabric.Control({
    x: 0,
    y: 0.5,
    cursorStyleHandler: () => 'ns-resize',
    actionHandler: makeLineThicknessHandler(1),
    actionName: 'changeThickness',
  }),
};

Object.assign(CanvasEditor, {
  // -------- element creation --------
  addText(text = 'Edit this text') {
    const obj = new fabric.Textbox(text, {
      left: 80, top: 80, width: 260, fontSize: 22, fontFamily: 'Helvetica', fill: '#1f2430',
    });
    this.stampLayerIdentity(obj, `Text: ${text.slice(0, 24)}`);
    this.canvas.add(obj).setActiveObject(obj);
  },

  addLine() {
    const obj = new fabric.Line([60, 200, 400, 200], { stroke: '#333', strokeWidth: 2 });
    this.stampLayerIdentity(obj, 'Line');
    this.canvas.add(obj).setActiveObject(obj);
  },

  addRect() {
    const obj = new fabric.Rect({ left: 80, top: 80, width: 180, height: 120, fill: 'transparent', stroke: '#333', strokeWidth: 2 });
    this.stampLayerIdentity(obj, 'Rectangle');
    this.canvas.add(obj).setActiveObject(obj);
  },

  addCircle() {
    const obj = new fabric.Circle({ left: 80, top: 80, radius: 60, fill: 'transparent', stroke: '#333', strokeWidth: 2 });
    this.stampLayerIdentity(obj, 'Circle');
    this.canvas.add(obj).setActiveObject(obj);
  },

  addImageFromUrl(url, opts = {}) {
    fabric.Image.fromURL(url, (img) => {
      const maxDim = 300;
      if (img.width > maxDim || img.height > maxDim) {
        const scale = maxDim / Math.max(img.width, img.height);
        img.scale(scale);
      }
      img.set({ left: 100, top: 100, ...opts });
      this.stampLayerIdentity(img, 'Image');
      this.canvas.add(img).setActiveObject(img);
    }, { crossOrigin: 'anonymous' });
  },

  // Adds generator output (plain objects, not a fabric.Group — see
  // generators.js) and selects them all together via an ActiveSelection so
  // the whole block can still be moved as one unit right after insert.
  // Side handles are hidden on that initial selection so even a resize
  // right after insert stays proportional (corner handles only) instead of
  // distorting text. Fabric's ActiveSelection is transient — it dissolves
  // as soon as the user clicks away — so every object in the batch is also
  // stamped with a shared `generatorGroupId`/`generatorLabel`. The layers
  // panel uses that to show the batch as one collapsible layer and to
  // rebuild a fresh ActiveSelection over all its members on demand, so the
  // whole thing (e.g. a calendar's border + grid + labels) keeps moving
  // together permanently, not just immediately after insert. `generatorParams`
  // is the exact params object the caller passed into the matching
  // Generators.build*() call — group-editor.js replays it through that same
  // function to regenerate the group in place when its fields are edited.
  addGeneratedObjects(objects, groupLabel, generatorParams) {
    if (!objects || !objects.length) return;
    const generatorGroupId = cryptoRandomId();
    objects.forEach((o) => {
      this.stampLayerIdentity(o, groupLabel || 'Group');
      o.set({ generatorGroupId, generatorLabel: groupLabel || 'Group', generatorParams: generatorParams || null });
    });
    // Suppress history/layers-refresh/Properties-panel side effects for the
    // whole add-through-reselect sequence — discardActiveObject() below
    // fires 'selection:cleared' mid-batch, which would otherwise wipe the
    // Properties panel (see the suppressHistory doc comment above).
    this.suppressHistory = true;
    objects.forEach((o) => this.canvas.add(o));
    // Guards a stale/duplicate selection outline (see GroupEditor.regenerate).
    this.canvas.discardActiveObject();
    const selection = new fabric.ActiveSelection(objects, { canvas: this.canvas });
    selection.setCoords();
    this.canvas.setActiveObject(selection);
    this.suppressHistory = false;
    // selection:updated fired above while suppressHistory was still true, so
    // onSelectionChanged's renderProperties() call was a no-op — re-fire it
    // manually so the Properties panel switches to GroupEditor's bulk-edit
    // fields for the new group immediately, instead of only updating on the
    // user's next click.
    this.renderProperties();
    // Synchronous, unconditional repaint right after adding a whole batch —
    // requestRenderAll() only schedules a paint on the next animation frame,
    // which leaves a brief async gap after a multi-object insert.
    this.canvas.renderAll();
    // Belt-and-suspenders follow-up repaint one frame later — a
    // live-confirmed bug had the synchronous renderAll() above still leave
    // a freshly-inserted generator batch unpainted until some later
    // interaction (e.g. clicking its own layer row) forced a render, same
    // symptom/class as the "Guaranteed immediate paint" fix elsewhere in
    // this method; the exact Fabric-internal trigger wasn't pinned down, so
    // this second, next-frame render guards against it unconditionally.
    requestAnimationFrame(() => this.canvas.renderAll());
    this.pushHistory();
    this.notifyLayersChange();
  },

  deleteSelected() {
    const objs = this.canvas.getActiveObjects();
    objs.forEach((o) => this.canvas.remove(o));
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
  },

  // Clones the single active object (skips multi-select — same scope as
  // bringForward/sendBackward below) and offsets it so the copy is visibly
  // distinct from the original. Fabric v5's clone() is callback-based, same
  // style as fabric.Image.fromURL in canvas-image-tools.js.
  duplicateSelected() {
    const obj = this.canvas.getActiveObject();
    if (!obj || obj.type === 'activeSelection') return;
    obj.clone((cloned) => {
      cloned.set({
        left: (obj.left || 0) + 20,
        top: (obj.top || 0) + 20,
        id: cryptoRandomId(),
        name: obj.name ? `${obj.name} copy` : 'Copy',
      });
      this.canvas.add(cloned).setActiveObject(cloned);
      // Synchronous repaint + next-frame follow-up — requestRenderAll()
      // alone left button-triggered changes unpainted until some later
      // canvas interaction forced a render; same fix as addGeneratedObjects
      // above, same unpinned-down Fabric-internal cause.
      this.canvas.renderAll();
      requestAnimationFrame(() => this.canvas.renderAll());
      this.pushHistory();
      this.notifyLayersChange();
    }, this.EXTRA_SERIALIZE_PROPS);
  },

  // Fabric's flipX/flipY are generic object properties — these work the
  // same for images, text, and shapes alike, no per-type handling needed.
  flipHorizontal() {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    obj.set('flipX', !obj.flipX);
    // See the render-timing comment in duplicateSelected() above.
    this.canvas.renderAll();
    requestAnimationFrame(() => this.canvas.renderAll());
    this.pushHistory();
  },

  flipVertical() {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    obj.set('flipY', !obj.flipY);
    this.canvas.renderAll();
    requestAnimationFrame(() => this.canvas.renderAll());
    this.pushHistory();
  },

  // Recovers an element dragged/resized out of view — canvas.centerObject
  // is a Fabric built-in, and the canvas's own width/height are the page's
  // pixel dimensions (setPageSize sets them directly; zoom is a CSS
  // transform on the wrapper, not a canvas resize), so this needs no manual
  // math against baseWidth/baseHeight. Works the same for a single object
  // or a multi-select ActiveSelection, unlike duplicateSelected above.
  centerSelected() {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    this.canvas.centerObject(obj);
    obj.setCoords();
    this.canvas.renderAll();
    requestAnimationFrame(() => this.canvas.renderAll());
    this.pushHistory();
  },

  bringForward() {
    const obj = this.canvas.getActiveObject();
    if (obj) { this.canvas.bringForward(obj); this.pushHistory(); }
  },

  sendBackward() {
    const obj = this.canvas.getActiveObject();
    if (obj) { this.canvas.sendBackwards(obj); this.pushHistory(); }
  },
});
