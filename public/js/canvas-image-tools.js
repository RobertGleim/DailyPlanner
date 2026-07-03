// Image-specific editing methods for CanvasEditor — extends the shared
// object defined in canvas-editor.js. Uses tintFabricImage from
// canvas-background.js, so this file must load after that one.
Object.assign(CanvasEditor, {
  setImageSizePx(obj, width, height) {
    if (!obj || obj.type !== 'image') return;
    const newScaleX = width / obj.width;
    const newScaleY = height / obj.height;
    obj.set({ scaleX: newScaleX, scaleY: newScaleY });
    this.canvas.requestRenderAll();
  },

  applyImageTint(obj, color, intensity) {
    if (!obj || obj.type !== 'image') return;
    tintFabricImage(obj, color, intensity);
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
        newImg.set({ id: obj.id, name: obj.name, generatorGroupId: obj.generatorGroupId, generatorLabel: obj.generatorLabel });
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
});
