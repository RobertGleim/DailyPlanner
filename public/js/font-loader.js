// Loads the Google Fonts catalog (server-preloaded, see scripts/seed-fonts.js)
// and lazily registers individual families with the browser via the CSS Font
// Loading API. Fabric.js reads `document.fonts` to render text, so a family
// must be loaded here before it will draw correctly on any canvas — the live
// editor, a reopened project, or the offscreen export canvas.
const FontLoader = {
  catalog: [], // [{ id, family, category, url, weightRange }]
  _loading: new Map(), // family -> Promise

  async init() {
    try {
      const { items } = await Api.listFonts();
      this.catalog = items || [];
    } catch (e) {
      this.catalog = [];
    }
    return this.catalog;
  },

  urlFor(family) {
    const entry = this.catalog.find((f) => f.family === family);
    return entry ? entry.url : null;
  },

  // Loads a family's webfont (no-op for system fonts / already-loaded /
  // in-flight families). Returns a promise that resolves once the family is
  // safe to use in canvas.renderAll() / toDataURL().
  ensure(family) {
    if (!family) return Promise.resolve();
    if (this._loading.has(family)) return this._loading.get(family);

    const url = this.urlFor(family);
    if (!url) return Promise.resolve(); // system font, nothing to load

    const promise = (async () => {
      try {
        const face = new FontFace(family, `url(${url})`);
        await face.load();
        document.fonts.add(face);
      } catch (e) {
        // Leave the family unregistered; Fabric will fall back silently.
      }
    })();
    this._loading.set(family, promise);
    return promise;
  },

  // Walks a project's saved page JSON and ensures every distinct fontFamily
  // used anywhere in it is loaded. Call before rendering a reopened project
  // or before PDF export, since those fonts may not have been touched by the
  // font picker this session.
  async ensureAllInJSON(pages) {
    const families = new Set();
    (pages || []).forEach((page) => {
      const objects = (page.json && page.json.objects) || [];
      objects.forEach((obj) => {
        if (obj.fontFamily) families.add(obj.fontFamily);
      });
    });
    await Promise.all(Array.from(families).map((f) => this.ensure(f)));
  },
};
