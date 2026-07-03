// Snap-to-objects ("smart guides") for CanvasEditor — extends the shared
// object defined in canvas-editor.js (must load after it). See
// public/CLAUDE.md's "Grid and snap tools" section.
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
});
