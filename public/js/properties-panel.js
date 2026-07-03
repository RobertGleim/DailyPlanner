// Properties-panel rendering for CanvasEditor — extends the shared object
// defined in canvas-editor.js. Renders per-type editing fields for
// whatever's selected; delegates to GroupEditor (group-editor.js) for a
// fully-selected generator group instead of the generic fallback here.
Object.assign(CanvasEditor, {
  renderProperties() {
    const panel = document.getElementById('propertiesPanel');
    const obj = this.canvas.getActiveObject();
    if (!obj) {
      delete panel.dataset.geGroupId;
      panel.innerHTML = '<p class="hint">Select an element on the canvas to edit its properties.</p>';
      return;
    }

    // A generator group gets the bulk editor instead of the fallback below.
    if (obj.type === 'activeSelection' && typeof GroupEditor !== 'undefined' && GroupEditor.isFullGroupSelection(obj)) {
      GroupEditor.render(obj, panel);
      return;
    }
    delete panel.dataset.geGroupId;

    let rows = '';
    if (obj.type === 'textbox' || obj.type === 'text' || obj.type === 'i-text') {
      rows += this.propRow('Text', `<input type="text" id="propText" value="${(obj.text || '').replace(/"/g, '&quot;')}" />`);
      rows += this.propRow('Font', `<div class="font-picker">
        <input type="text" id="propFont" autocomplete="off" placeholder="Search fonts…" value="${(obj.fontFamily || '').replace(/"/g, '&quot;')}" />
        <div id="propFontResults" class="font-picker-results" hidden></div>
      </div>`);
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
    this.bindFontPicker(obj);
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

  // Searchable combobox over the preloaded Google Fonts catalog — see
  // FontLoader.attachPicker (shared with every generator box's font picker).
  bindFontPicker(obj) {
    if (typeof FontLoader === 'undefined') return;
    FontLoader.attachPicker({
      inputEl: document.getElementById('propFont'),
      resultsEl: document.getElementById('propFontResults'),
      initialValue: obj.fontFamily || '',
      onSelect: (family) => {
        obj.set('fontFamily', family);
        FontLoader.ensure(family).then(() => this.canvas.requestRenderAll());
      },
    });
  },
});

function toHex(color) {
  if (!color || typeof color !== 'string') return null;
  if (color.startsWith('#')) return color;
  return null;
}
