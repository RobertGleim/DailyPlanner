// Undo/redo history + page load/save serialization for CanvasEditor —
// extends the shared object defined in canvas-editor.js.
Object.assign(CanvasEditor, {
  pushHistory() {
    if (this.suppressHistory) return;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(JSON.stringify(this.canvas.toJSON(this.EXTRA_SERIALIZE_PROPS)));
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
        this.history = [JSON.stringify(this.canvas.toJSON(this.EXTRA_SERIALIZE_PROPS))];
        this.historyIndex = 0;
      });
    } else {
      this.canvas.renderAll();
      this.suppressHistory = false;
      this.history = [JSON.stringify(this.canvas.toJSON(this.EXTRA_SERIALIZE_PROPS))];
      this.historyIndex = 0;
    }
  },

  serializePage() {
    return {
      json: this.canvas.toJSON(this.EXTRA_SERIALIZE_PROPS),
      thumbnail: this.canvas.toDataURL({ format: 'png', multiplier: 0.25 }),
      background: this.currentBackgroundImage ? null : (this.canvas.backgroundColor || '#ffffff'),
    };
  },
});
