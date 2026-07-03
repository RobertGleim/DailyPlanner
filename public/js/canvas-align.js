// Align/distribute + snap-to-objects ("smart guides") for CanvasEditor —
// extends the shared object defined in canvas-editor.js (must load after
// it, and after canvas-grid.js for file-grouping consistency though there's
// no code dependency between the two). See public/CLAUDE.md's "Grid, snap,
// and align tools" section.
Object.assign(CanvasEditor, {
  snapToObjectsEnabled: false,

  // Transient guide-line overlay: a plain 2D <canvas>, not a fabric.Object,
  // so it never touches canvas.toJSON()/history/PDF export (same reasoning
  // as the grid overlay div in canvas-grid.js).
  initAlign() {
    const el = document.createElement('canvas');
    el.id = 'alignGuideCanvas';
    el.width = this.canvas.width;
    el.height = this.canvas.height;
    this.alignGuideEl = el;
    this.alignGuideCtx = el.getContext('2d');
    this.canvas.wrapperEl.appendChild(el);

    this.canvas.on('object:moving', (e) => this.applyObjectSnap(e.target));
    this.canvas.on('mouse:up', () => this.clearGuides());
  },

  toggleSnapToObjects() {
    this.snapToObjectsEnabled = !this.snapToObjectsEnabled;
    if (!this.snapToObjectsEnabled) this.clearGuides();
    return this.snapToObjectsEnabled;
  },

  clearGuides() {
    if (!this.alignGuideEl) return;
    // Resetting width/height both resizes and clears the bitmap in one step.
    this.alignGuideEl.width = this.canvas.width;
    this.alignGuideEl.height = this.canvas.height;
  },

  drawGuideLines(lines) {
    const ctx = this.alignGuideCtx;
    ctx.strokeStyle = 'rgba(255,70,120,0.9)';
    ctx.lineWidth = 1;
    lines.forEach((l) => {
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    });
  },

  // On every object:moving tick, compares the dragged object/selection's
  // edges+center against every other object's edges+center; snaps position
  // on the first match per axis (within a small pixel threshold) and draws
  // a full-page guide line through the matched coordinate.
  applyObjectSnap(obj) {
    this.clearGuides();
    if (!this.snapToObjectsEnabled || !obj) return;

    const threshold = 6;
    const active = this.canvas.getActiveObjects();
    const others = this.canvas.getObjects().filter((o) => o !== obj && !active.includes(o));
    const r = obj.getBoundingRect(true, true);
    const targetsX = [r.left, r.left + r.width / 2, r.left + r.width];
    const targetsY = [r.top, r.top + r.height / 2, r.top + r.height];
    const guideLines = [];
    let snappedX = false;
    let snappedY = false;

    others.forEach((other) => {
      const or = other.getBoundingRect(true, true);
      const otherX = [or.left, or.left + or.width / 2, or.left + or.width];
      const otherY = [or.top, or.top + or.height / 2, or.top + or.height];

      if (!snappedX) {
        targetsX.some((tx) => otherX.some((ox) => {
          if (Math.abs(tx - ox) > threshold) return false;
          obj.set('left', obj.left + (ox - tx));
          guideLines.push({ x1: ox, y1: 0, x2: ox, y2: this.canvas.height });
          snappedX = true;
          return true;
        }));
      }
      if (!snappedY) {
        targetsY.some((ty) => otherY.some((oy) => {
          if (Math.abs(ty - oy) > threshold) return false;
          obj.set('top', obj.top + (oy - ty));
          guideLines.push({ x1: 0, y1: oy, x2: this.canvas.width, y2: oy });
          snappedY = true;
          return true;
        }));
      }
    });

    if (guideLines.length) {
      obj.setCoords();
      this.drawGuideLines(guideLines);
    }
  },

  // Absolute (canvas-space) bounding box spanning every object in `objs`.
  boundingBoxOf(objs) {
    const rects = objs.map((o) => o.getBoundingRect(true, true));
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.left + r.width));
    const bottom = Math.max(...rects.map((r) => r.top + r.height));
    return { left, top, width: right - left, height: bottom - top };
  },

  // A single selected object aligns relative to the page; a multi-selection
  // aligns each member relative to the selection's own bounding box (the
  // standard Figma/Illustrator convention). Discards the ActiveSelection
  // before repositioning members and rebuilds it after — same
  // suppress-history-around-a-batch pattern as addGeneratedObjects/
  // GroupEditor.regenerate, needed because Fabric reports a grouped
  // member's left/top relative to the selection's own frame, not the
  // canvas, while it's still part of that selection.
  alignSelection(edge) {
    const objs = this.canvas.getActiveObjects().slice();
    if (!objs.length) return;
    const isMulti = objs.length > 1;

    this.suppressHistory = true;
    if (isMulti) this.canvas.discardActiveObject();

    const bounds = isMulti
      ? this.boundingBoxOf(objs)
      : { left: 0, top: 0, width: this.canvas.width, height: this.canvas.height };

    objs.forEach((obj) => {
      const r = obj.getBoundingRect(true, true);
      if (edge === 'left') obj.set('left', obj.left + (bounds.left - r.left));
      else if (edge === 'right') obj.set('left', obj.left + (bounds.left + bounds.width - (r.left + r.width)));
      else if (edge === 'centerH') obj.set('left', obj.left + (bounds.left + bounds.width / 2 - (r.left + r.width / 2)));
      else if (edge === 'top') obj.set('top', obj.top + (bounds.top - r.top));
      else if (edge === 'bottom') obj.set('top', obj.top + (bounds.top + bounds.height - (r.top + r.height)));
      else if (edge === 'centerV') obj.set('top', obj.top + (bounds.top + bounds.height / 2 - (r.top + r.height / 2)));
      obj.setCoords();
    });

    if (isMulti) {
      const selection = new fabric.ActiveSelection(objs, { canvas: this.canvas });
      selection.setCoords();
      this.canvas.setActiveObject(selection);
    }
    this.suppressHistory = false;
    this.canvas.renderAll();
    this.pushHistory();
    this.notifyLayersChange();
  },

  // Requires 3+ objects — sorts by position along `axis`, keeps the first
  // and last object fixed, and spaces the rest with equal gaps between
  // bounding boxes. Same discard/rebuild-ActiveSelection pattern as
  // alignSelection above.
  distributeSelection(axis) {
    const objs = this.canvas.getActiveObjects().slice();
    if (objs.length < 3) return;

    this.suppressHistory = true;
    this.canvas.discardActiveObject();

    const key = axis === 'horizontal' ? 'left' : 'top';
    const sizeKey = axis === 'horizontal' ? 'width' : 'height';
    const entries = objs.map((obj) => ({ obj, r: obj.getBoundingRect(true, true) }));
    entries.sort((a, b) => a.r[key] - b.r[key]);

    const first = entries[0];
    const last = entries[entries.length - 1];
    const totalSpan = (last.r[key] + last.r[sizeKey]) - first.r[key];
    const totalSize = entries.reduce((sum, e) => sum + e.r[sizeKey], 0);
    const gap = (totalSpan - totalSize) / (entries.length - 1);

    let cursor = first.r[key] + first.r[sizeKey] + gap;
    for (let i = 1; i < entries.length - 1; i++) {
      const { obj, r } = entries[i];
      const delta = cursor - r[key];
      obj.set(key, obj[key] + delta);
      obj.setCoords();
      cursor += r[sizeKey] + gap;
    }

    const selection = new fabric.ActiveSelection(objs, { canvas: this.canvas });
    selection.setCoords();
    this.canvas.setActiveObject(selection);
    this.suppressHistory = false;
    this.canvas.renderAll();
    this.pushHistory();
    this.notifyLayersChange();
  },
});
