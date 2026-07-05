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

  // Wires a text input + results container into a searchable combobox over
  // this catalog, with the 6 built-in FONT_CHOICES pinned at the top of the
  // unfiltered list as instant, zero-load defaults. Shared by the
  // properties-panel font field (canvas-editor.js) and every generator
  // box's font picker (generators tab in app.js) so this ~70-line
  // search/render/click behavior only lives in one place.
  //
  // Results are paginated by scroll rather than hard-capped: the catalog has
  // ~1,800 families, so only PAGE_SIZE rows are appended at a time (and only
  // those get their webfont lazily loaded), with more appended as the user
  // scrolls the results container — otherwise the whole catalog would be
  // unreachable past the first alphabetical page.
  attachPicker({ inputEl, resultsEl, initialValue, onSelect }) {
    if (!inputEl || !resultsEl) return;
    inputEl.value = initialValue || '';

    const catalogFamilies = this.catalog
      .map((f) => f.family)
      .filter((f) => !FONT_CHOICES.includes(f));
    const PAGE_SIZE = 50;

    let currentMatches = [];
    let renderedCount = 0;

    const buildRow = (family) => {
      const row = document.createElement('div');
      row.className = 'font-picker-row';
      row.textContent = family;
      row.style.fontFamily = `'${family}'`;
      row.addEventListener('mousedown', (e) => {
        e.preventDefault(); // avoid input blur firing before the click registers
        inputEl.value = family;
        resultsEl.hidden = true;
        onSelect(family);
        this.ensure(family);
      });
      return row;
    };

    // Appends the next page of currentMatches without touching existing rows,
    // so scroll position is preserved as more fonts load in.
    const appendNextPage = () => {
      const next = currentMatches.slice(renderedCount, renderedCount + PAGE_SIZE);
      next.forEach((family) => {
        resultsEl.appendChild(buildRow(family));
        this.ensure(family); // lazily load only the webfonts actually rendered
      });
      renderedCount += next.length;
    };

    const renderResults = (query) => {
      const q = query.trim().toLowerCase();
      currentMatches = q
        ? [...FONT_CHOICES, ...catalogFamilies].filter((f) => f.toLowerCase().includes(q))
        : [...FONT_CHOICES, ...catalogFamilies];
      renderedCount = 0;
      resultsEl.textContent = '';

      if (!currentMatches.length) {
        const empty = document.createElement('div');
        empty.className = 'font-picker-empty';
        empty.textContent = 'No fonts match';
        resultsEl.appendChild(empty);
      } else {
        appendNextPage();
      }
      resultsEl.hidden = false;
    };

    resultsEl.addEventListener('scroll', () => {
      if (renderedCount >= currentMatches.length) return;
      const nearBottom = resultsEl.scrollTop + resultsEl.clientHeight >= resultsEl.scrollHeight - 40;
      if (nearBottom) appendNextPage();
    });

    inputEl.addEventListener('focus', () => renderResults(''));
    inputEl.addEventListener('input', () => renderResults(inputEl.value));
    inputEl.addEventListener('blur', () => {
      setTimeout(() => { resultsEl.hidden = true; }, 150);
    });
  },
};
