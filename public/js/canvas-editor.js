// Wraps a Fabric.js canvas: element creation, selection properties, undo/redo, zoom, thumbnails.
const CanvasEditor = {
  canvas: null,
  pageSizeKey: 'letter',
  history: [],
  historyIndex: -1,
  suppressHistory: false,
  bgRemovalInFlight: false,

  init() {
    this.canvas = new fabric.Canvas('pageCanvas', {
      preserveObjectStacking: true,
      backgroundColor: '#ffffff',
    });
    this.setPageSize(this.pageSizeKey);
    this.setZoom(0.7);

    this.canvas.on('object:modified', () => this.pushHistory());
    this.canvas.on('object:added', () => this.pushHistory());
    this.canvas.on('object:removed', () => this.pushHistory());
    this.canvas.on('selection:created', () => this.renderProperties());
    this.canvas.on('selection:updated', () => this.renderProperties());
    this.canvas.on('selection:cleared', () => this.renderProperties());

    document.getElementById('zoomSlider').addEventListener('input', (e) => {
      this.setZoom(Number(e.target.value) / 100);
    });
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

  // -------- element creation --------
  addText(text = 'Edit this text') {
    const obj = new fabric.Textbox(text, {
      left: 80, top: 80, width: 260, fontSize: 22, fontFamily: 'Helvetica', fill: '#1f2430',
    });
    this.canvas.add(obj).setActiveObject(obj);
  },

  addLine() {
    const obj = new fabric.Line([60, 200, 400, 200], { stroke: '#333', strokeWidth: 2 });
    this.canvas.add(obj).setActiveObject(obj);
  },

  addRect() {
    const obj = new fabric.Rect({ left: 80, top: 80, width: 180, height: 120, fill: 'transparent', stroke: '#333', strokeWidth: 2 });
    this.canvas.add(obj).setActiveObject(obj);
  },

  addCircle() {
    const obj = new fabric.Circle({ left: 80, top: 80, radius: 60, fill: 'transparent', stroke: '#333', strokeWidth: 2 });
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
      this.canvas.add(img).setActiveObject(img);
    }, { crossOrigin: 'anonymous' });
  },

  addGroupObject(group) {
    this.canvas.add(group).setActiveObject(group);
  },

  setBackgroundColor(color) {
    this.canvas.setBackgroundColor(color, () => this.canvas.renderAll());
    this.currentBackgroundImage = null;
    this.pushHistory();
  },

  setBackgroundImageFromUrl(url) {
    fabric.Image.fromURL(url, (img) => {
      img.set({
        originX: 'left', originY: 'top',
        scaleX: this.canvas.width / img.width,
        scaleY: this.canvas.height / img.height,
        selectable: false,
        evented: false,
      });
      this.canvas.setBackgroundImage(img, () => this.canvas.renderAll());
      this.currentBackgroundImage = url;
      this.pushHistory();
    }, { crossOrigin: 'anonymous' });
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

  // -------- image-specific editing --------
  setImageSizePx(obj, width, height) {
    if (!obj || obj.type !== 'image') return;
    const newScaleX = width / obj.width;
    const newScaleY = height / obj.height;
    obj.set({ scaleX: newScaleX, scaleY: newScaleY });
    this.canvas.requestRenderAll();
  },

  applyImageTint(obj, color, intensity) {
    if (!obj || obj.type !== 'image') return;
    obj.filters = (obj.filters || []).filter((f) => f.type !== 'BlendColor');
    if (intensity > 0) {
      obj.filters.push(new fabric.Image.filters.BlendColor({
        color, mode: 'tint', alpha: intensity,
      }));
    }
    obj.applyFilters();
    this.canvas.requestRenderAll();
  },

  async removeBackgroundOnSelected(onStatus) {
    const obj = this.canvas.getActiveObject();
    if (!obj || obj.type !== 'image') return;
    if (this.bgRemovalInFlight) return;
    if (!window.BgRemoval) {
      onStatus && onStatus('error', 'Background removal engine not loaded yet — try again in a moment.');
      return;
    }
    this.bgRemovalInFlight = true;
    onStatus && onStatus('start');
    try {
      // Export the object's current pixels (post any tint/filters) as a data URL to feed the model.
      const dataUrl = obj.toDataURL({ format: 'png' });
      const resultUrl = await window.BgRemoval.removeFromDataUrl(dataUrl, (key, current, total) => {
        onStatus && onStatus('progress', { key, current, total });
      });
      const { left, top, scaleX, scaleY, angle, originX, originY, opacity } = obj;
      fabric.Image.fromURL(resultUrl, (newImg) => {
        newImg.set({ left, top, scaleX, scaleY, angle, originX, originY, opacity });
        this.canvas.remove(obj);
        this.canvas.add(newImg).setActiveObject(newImg);
        this.canvas.requestRenderAll();
        this.pushHistory();
        this.bgRemovalInFlight = false;
        onStatus && onStatus('done');
      }, { crossOrigin: 'anonymous' });
    } catch (err) {
      console.error('Background removal failed', err);
      this.bgRemovalInFlight = false;
      onStatus && onStatus('error', err.message || String(err));
    }
  },

  // -------- properties panel --------
  renderProperties() {
    const panel = document.getElementById('propertiesPanel');
    const obj = this.canvas.getActiveObject();
    if (!obj) {
      panel.innerHTML = '<p class="hint">Select an element on the canvas to edit its properties.</p>';
      return;
    }

    let rows = '';
    if (obj.type === 'textbox' || obj.type === 'text' || obj.type === 'i-text') {
      rows += this.propRow('Text', `<input type="text" id="propText" value="${(obj.text || '').replace(/"/g, '&quot;')}" />`);
      rows += this.propRow('Font', `<select id="propFont">${FONT_CHOICES.map((f) => `<option value="${f}" ${obj.fontFamily === f ? 'selected' : ''}>${f}</option>`).join('')}</select>`);
      rows += this.propRow('Size', `<input type="number" id="propFontSize" value="${obj.fontSize || 20}" min="6" max="200" />`);
      rows += this.propRow('Color', `<input type="color" id="propFill" value="${toHex(obj.fill) || '#000000'}" />`);
    } else if (obj.type === 'rect' || obj.type === 'circle') {
      rows += this.propRow('Fill', `<input type="color" id="propFill" value="${toHex(obj.fill) || '#ffffff'}" />`);
      rows += this.propRow('Stroke', `<input type="color" id="propStroke" value="${toHex(obj.stroke) || '#000000'}" />`);
      rows += this.propRow('Stroke width', `<input type="number" id="propStrokeWidth" value="${obj.strokeWidth || 1}" min="0" max="30" />`);
    } else if (obj.type === 'line') {
      rows += this.propRow('Color', `<input type="color" id="propStroke" value="${toHex(obj.stroke) || '#000000'}" />`);
      rows += this.propRow('Thickness', `<input type="number" id="propStrokeWidth" value="${obj.strokeWidth || 1}" min="1" max="30" />`);
    } else if (obj.type === 'image') {
      const existingTint = (obj.filters || []).find((f) => f.type === 'BlendColor');
      const w = Math.round(obj.getScaledWidth());
      const h = Math.round(obj.getScaledHeight());
      rows += this.propRow('Width (px)', `<input type="number" id="propWidth" value="${w}" min="10" max="3000" />`);
      rows += this.propRow('Height (px)', `<input type="number" id="propHeight" value="${h}" min="10" max="3000" />`);
      rows += this.propRow('Tint color', `<input type="color" id="propTintColor" value="${existingTint ? existingTint.color : '#ff0000'}" />`);
      rows += this.propRow('Tint intensity', `<input type="number" id="propTintIntensity" value="${existingTint ? Math.round(existingTint.alpha * 100) : 0}" min="0" max="100" />`);
    }
    rows += this.propRow('Opacity', `<input type="number" id="propOpacity" value="${Math.round((obj.opacity ?? 1) * 100)}" min="0" max="100" />`);

    if (obj.type === 'image') {
      rows += `<button id="removeBgBtn" class="tool-btn btn-accent full-width" style="margin-top:10px;">${icon('scissors')} Remove Background</button>`;
      rows += `<p id="bgStatusMsg" class="hint" style="margin-top:6px;"></p>`;
    }
    rows += `<button id="deletePropBtn" class="tool-btn btn-danger full-width" style="margin-top:6px;">${icon('trash')} Delete Element</button>`;

    panel.innerHTML = rows;

    const bind = (id, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', handler);
    };
    bind('propText', (e) => { obj.set('text', e.target.value); this.canvas.requestRenderAll(); });
    bind('propFont', (e) => { obj.set('fontFamily', e.target.value); this.canvas.requestRenderAll(); });
    bind('propFontSize', (e) => { obj.set('fontSize', Number(e.target.value)); this.canvas.requestRenderAll(); });
    bind('propFill', (e) => { obj.set('fill', e.target.value); this.canvas.requestRenderAll(); });
    bind('propStroke', (e) => { obj.set('stroke', e.target.value); this.canvas.requestRenderAll(); });
    bind('propStrokeWidth', (e) => { obj.set('strokeWidth', Number(e.target.value)); this.canvas.requestRenderAll(); });
    bind('propOpacity', (e) => { obj.set('opacity', Number(e.target.value) / 100); this.canvas.requestRenderAll(); });

    bind('propWidth', (e) => {
      const h = Number(document.getElementById('propHeight').value);
      this.setImageSizePx(obj, Number(e.target.value), h);
    });
    bind('propHeight', (e) => {
      const w = Number(document.getElementById('propWidth').value);
      this.setImageSizePx(obj, w, Number(e.target.value));
    });

    const applyTint = () => {
      const color = document.getElementById('propTintColor').value;
      const intensity = Number(document.getElementById('propTintIntensity').value) / 100;
      this.applyImageTint(obj, color, intensity);
    };
    bind('propTintColor', applyTint);
    bind('propTintIntensity', applyTint);

    const removeBgBtn = document.getElementById('removeBgBtn');
    if (removeBgBtn) {
      removeBgBtn.addEventListener('click', () => {
        const statusMsg = document.getElementById('bgStatusMsg');
        removeBgBtn.disabled = true;
        this.removeBackgroundOnSelected((status, payload) => {
          if (status === 'start') {
            removeBgBtn.innerHTML = `${icon('clock')} Removing background…`;
            if (statusMsg) statusMsg.textContent = 'First use downloads the AI model (one-time, needs internet). This can take up to a minute.';
          } else if (status === 'progress' && payload) {
            if (statusMsg && payload.total) {
              statusMsg.textContent = `${payload.key}: ${Math.round((payload.current / payload.total) * 100)}%`;
            }
          } else if (status === 'done') {
            showToast('Background removed');
            this.renderProperties();
          } else if (status === 'error') {
            removeBgBtn.disabled = false;
            removeBgBtn.innerHTML = `${icon('scissors')} Remove Background`;
            if (statusMsg) statusMsg.textContent = payload || 'Something went wrong.';
            showToast('Background removal failed');
          }
        });
      });
    }

    const deleteBtn = document.getElementById('deletePropBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.deleteSelected());
    }
  },

  propRow(label, inputHtml) {
    return `<div class="prop-row"><label>${label}</label>${inputHtml}</div>`;
  },

  // -------- history --------
  pushHistory() {
    if (this.suppressHistory) return;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(JSON.stringify(this.canvas.toJSON(['selectable', 'evented'])));
    this.historyIndex = this.history.length - 1;
    if (this.onChange) this.onChange();
  },

  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.loadFromHistory();
  },

  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.loadFromHistory();
  },

  loadFromHistory() {
    this.suppressHistory = true;
    const state = this.history[this.historyIndex];
    this.canvas.loadFromJSON(state, () => {
      this.canvas.renderAll();
      this.suppressHistory = false;
    });
  },

  // -------- serialize / load page --------
  loadPage(pageData) {
    this.suppressHistory = true;
    this.canvas.clear();
    this.canvas.setBackgroundColor(pageData?.background || '#ffffff', () => {});
    if (pageData && pageData.json) {
      this.canvas.loadFromJSON(pageData.json, () => {
        this.canvas.renderAll();
        this.suppressHistory = false;
        this.history = [JSON.stringify(this.canvas.toJSON(['selectable', 'evented']))];
        this.historyIndex = 0;
      });
    } else {
      this.canvas.renderAll();
      this.suppressHistory = false;
      this.history = [JSON.stringify(this.canvas.toJSON(['selectable', 'evented']))];
      this.historyIndex = 0;
    }
  },

  serializePage() {
    return {
      json: this.canvas.toJSON(['selectable', 'evented']),
      thumbnail: this.canvas.toDataURL({ format: 'png', multiplier: 0.25 }),
      background: this.currentBackgroundImage ? null : (this.canvas.backgroundColor || '#ffffff'),
    };
  },
};

function toHex(color) {
  if (!color || typeof color !== 'string') return null;
  if (color.startsWith('#')) return color;
  return null;
}
