// Page background methods for CanvasEditor — extends the shared object
// defined in canvas-editor.js (must load after it). tintFabricImage is also
// used by canvas-image-tools.js's applyImageTint, which must load after
// this file.
Object.assign(CanvasEditor, {
  setBackgroundColor(color) {
    this.canvas.setBackgroundColor(color, () => this.canvas.renderAll());
    this.currentBackgroundImage = null;
    this.currentBackgroundTiled = false;
    this.pushHistory();
  },

  // { tile: true } sets the image as a repeating fabric.Pattern (via
  // backgroundColor) instead of a single full-bleed backgroundImage.
  setBackgroundImageFromUrl(url, { tile = false } = {}) {
    this.currentBackgroundImage = url;
    this.currentBackgroundTiled = tile;

    if (tile) {
      const imgEl = new Image();
      imgEl.crossOrigin = 'anonymous';
      imgEl.onload = () => {
        const pattern = new fabric.Pattern({ source: imgEl, repeat: 'repeat' });
        this.canvas.setBackgroundImage(null, () => {});
        this.canvas.setBackgroundColor(pattern, () => this.canvas.renderAll());
        this.pushHistory();
      };
      imgEl.src = url;
      return;
    }

    fabric.Image.fromURL(url, (img) => {
      img.set({
        originX: 'left', originY: 'top',
        scaleX: this.canvas.width / img.width,
        scaleY: this.canvas.height / img.height,
        selectable: false,
        evented: false,
      });
      this.canvas.setBackgroundImage(img, () => this.canvas.renderAll());
      this.pushHistory();
    }, { crossOrigin: 'anonymous' });
  },

  setBackgroundImageOpacity(opacity) {
    if (!this.canvas.backgroundImage) return;
    this.canvas.backgroundImage.opacity = opacity;
    this.canvas.requestRenderAll();
  },

  setBackgroundImageTint(color, intensity) {
    if (!this.canvas.backgroundImage) return;
    tintFabricImage(this.canvas.backgroundImage, color, intensity);
    this.canvas.requestRenderAll();
  },

  removeBackgroundImage() {
    this.canvas.setBackgroundImage(null, () => {});
    this.canvas.setBackgroundColor('#ffffff', () => this.canvas.renderAll());
    this.currentBackgroundImage = null;
    this.currentBackgroundTiled = false;
    this.pushHistory();
  },

  setBackgroundGradient(color1, color2, angle) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const coordsByAngle = {
      vertical: { x1: 0, y1: 0, x2: 0, y2: h },
      horizontal: { x1: 0, y1: 0, x2: w, y2: 0 },
      diagonal: { x1: 0, y1: 0, x2: w, y2: h },
    };
    const gradient = new fabric.Gradient({
      type: 'linear',
      coords: coordsByAngle[angle] || coordsByAngle.vertical,
      colorStops: [{ offset: 0, color: color1 }, { offset: 1, color: color2 }],
    });
    this.canvas.setBackgroundImage(null, () => {});
    this.canvas.setBackgroundColor(gradient, () => this.canvas.renderAll());
    this.currentBackgroundImage = null;
    this.currentBackgroundTiled = false;
    this.pushHistory();
  },
});

// Shared by per-image tinting (canvas-image-tools.js) and background-image
// tinting above — applies/clears a BlendColor filter on any fabric.Image.
function tintFabricImage(img, color, intensity) {
  img.filters = (img.filters || []).filter((f) => f.type !== 'BlendColor');
  if (intensity > 0) {
    img.filters.push(new fabric.Image.filters.BlendColor({
      color, mode: 'tint', alpha: intensity,
    }));
  }
  img.applyFilters();
}
