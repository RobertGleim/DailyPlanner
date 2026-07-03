// Element creation/manipulation methods for CanvasEditor — extends the
// shared object defined in canvas-editor.js (must load after it). See
// public/CLAUDE.md's file map for why CanvasEditor is split across files.
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
    this.canvas.requestRenderAll();
    this.pushHistory();
    this.notifyLayersChange();
  },

  deleteSelected() {
    const objs = this.canvas.getActiveObjects();
    objs.forEach((o) => this.canvas.remove(o));
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
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
