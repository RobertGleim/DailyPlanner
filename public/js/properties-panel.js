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

    // A manual multi-select (marquee-drag or shift-click) that happens to
    // include text elements — not a GroupEditor generator group above, just
    // an arbitrary mix the user selected. Lets font/size be changed for
    // every text element in the selection at once, instead of needing to
    // click and edit each one individually.
    const textTypes = ['textbox', 'text', 'i-text'];
    const multiTextMembers = obj.type === 'activeSelection' ? obj.getObjects().filter((o) => textTypes.includes(o.type)) : [];

    let rows = '';
    if (textTypes.includes(obj.type)) {
      rows += this.propRow('Text', `<input type="text" id="propText" value="${(obj.text || '').replace(/"/g, '&quot;')}" />`, 'propText');
      rows += this.propRow('Font', `<div class="font-picker">
        <input type="text" id="propFont" autocomplete="off" placeholder="Search fonts…" value="${(obj.fontFamily || '').replace(/"/g, '&quot;')}" />
        <div id="propFontResults" class="font-picker-results" hidden></div>
      </div>`, 'propFont');
      rows += this.propRow('Size', `<input type="number" id="propFontSize" value="${obj.fontSize || 20}" min="6" max="200" />`, 'propFontSize');
      rows += this.propRow('Color', `<input type="color" id="propFill" value="${toHex(obj.fill) || '#000000'}" />`, 'propFill');
    } else if (multiTextMembers.length) {
      const sizes = new Set(multiTextMembers.map((t) => t.fontSize || 20));
      const families = new Set(multiTextMembers.map((t) => t.fontFamily || ''));
      const uniformSize = sizes.size === 1 ? [...sizes][0] : '';
      const uniformFamily = families.size === 1 ? [...families][0] : '';
      rows += `<p class="hint">Editing font for ${multiTextMembers.length} text element${multiTextMembers.length === 1 ? '' : 's'} in this selection.</p>`;
      rows += this.propRow('Font', `<div class="font-picker">
        <input type="text" id="propMultiFont" autocomplete="off" placeholder="Search fonts…" value="${uniformFamily.replace(/"/g, '&quot;')}" />
        <div id="propMultiFontResults" class="font-picker-results" hidden></div>
      </div>`, 'propMultiFont');
      rows += this.propRow('Size', `<input type="number" id="propMultiFontSize" min="6" max="200" value="${uniformSize}" placeholder="Mixed" />`, 'propMultiFontSize');
    } else if (obj.type === 'rect' || obj.type === 'circle') {
      rows += this.propRow('Fill', `<input type="color" id="propFill" value="${toHex(obj.fill) || '#ffffff'}" />`, 'propFill');
      rows += this.propRow('Stroke', `<input type="color" id="propStroke" value="${toHex(obj.stroke) || '#000000'}" />`, 'propStroke');
      rows += this.propRow('Stroke width', `<input type="number" id="propStrokeWidth" value="${obj.strokeWidth || 1}" min="0" max="30" />`, 'propStrokeWidth');
    } else if (obj.type === 'line') {
      rows += this.propRow('Color', `<input type="color" id="propStroke" value="${toHex(obj.stroke) || '#000000'}" />`, 'propStroke');
      rows += this.propRow('Thickness', `<input type="number" id="propStrokeWidth" value="${obj.strokeWidth || 1}" min="1" max="30" />`, 'propStrokeWidth');
    } else if (obj.type === 'image') {
      const existingTint = (obj.filters || []).find((f) => f.type === 'BlendColor');
      const w = Math.round(obj.getScaledWidth());
      const h = Math.round(obj.getScaledHeight());
      rows += this.propRow('Width (px)', `<input type="number" id="propWidth" value="${w}" min="10" max="3000" />`, 'propWidth');
      rows += this.propRow('Height (px)', `<input type="number" id="propHeight" value="${h}" min="10" max="3000" />`, 'propHeight');
      rows += this.propRow('Tint color', `<input type="color" id="propTintColor" value="${existingTint ? existingTint.color : '#ff0000'}" />`, 'propTintColor');
      rows += this.propRow('Tint intensity', `<input type="number" id="propTintIntensity" value="${existingTint ? Math.round(existingTint.alpha * 100) : 0}" min="0" max="100" />`, 'propTintIntensity');
    }
    rows += this.propRow('Opacity', `<input type="number" id="propOpacity" value="${Math.round((obj.opacity ?? 1) * 100)}" min="0" max="100" />`, 'propOpacity');

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

    // Bulk font/size for the multi-text-select branch above — separate
    // ids/handlers from the single-text-object ones so the two paths can't
    // collide (only one branch's fields ever exist in the DOM at a time).
    if (multiTextMembers.length) {
      FontLoader.attachPicker({
        inputEl: document.getElementById('propMultiFont'),
        resultsEl: document.getElementById('propMultiFontResults'),
        initialValue: multiTextMembers[0].fontFamily || '',
        onSelect: (family) => {
          multiTextMembers.forEach((t) => t.set('fontFamily', family));
          FontLoader.ensure(family).then(() => this.canvas.requestRenderAll());
        },
      });
      bind('propMultiFontSize', (e) => {
        const size = Number(e.target.value);
        if (!size) return;
        multiTextMembers.forEach((t) => t.set('fontSize', size));
        this.canvas.requestRenderAll();
      });
    }
  },

  propRow(label, inputHtml, forId) {
    const forAttr = forId ? ` for="${forId}"` : '';
    return `<div class="prop-row"><label${forAttr}>${label}</label>${inputHtml}</div>`;
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
