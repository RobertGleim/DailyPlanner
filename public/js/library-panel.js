// Handles the "Library" tab: uploading, browsing, deleting, and inserting
// assets. Backgrounds/Icons/Page Borders drill down through folder levels
// (see library-categories.js for the theme/style/motif/icon-category
// taxonomy each is grouped by) before reaching the final insertable grid;
// Images and "All" stay a flat grid since uploads have no taxonomy.
const LibraryPanel = {
  currentCategory: 'all',
  drillPath: [], // [{ slug, label }] — folder levels chosen so far

  async init(onInsertAsset) {
    this.onInsertAsset = onInsertAsset;
    this.grid = document.getElementById('libraryGrid');
    this.breadcrumbEl = document.getElementById('libraryBreadcrumb');
    this.borderTipEl = document.getElementById('libraryBorderTip');

    document.querySelectorAll('.library-filter .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.library-filter .chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentCategory = chip.dataset.cat;
        this.drillPath = [];
        this.refresh();
      });
    });

    document.getElementById('libraryUploadInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const category = document.getElementById('libraryUploadCategory').value;
      try {
        await Api.uploadLibraryAsset(file, category, file.name);
        showToast('Added to library');
        await this.refresh();
      } catch (err) {
        showToast('Upload failed: ' + err.message);
      }
      e.target.value = '';
    });

    await this.refresh();
  },

  async refresh() {
    const { items } = await Api.listLibrary(this.currentCategory);
    if (this.borderTipEl) this.borderTipEl.hidden = this.currentCategory !== 'borders';
    this.renderBreadcrumb();

    if (this.currentCategory === 'borders') return this.renderBorders(items);
    if (this.currentCategory === 'backgrounds') return this.renderBackgrounds(items);
    if (this.currentCategory === 'icons') return this.renderIcons(items);
    this.renderLeafGrid(items);
  },

  // Groups an item list by `keyFn(item)`, preserving first-seen order.
  groupBy(items, keyFn) {
    const groups = new Map();
    items.forEach((item) => {
      const key = keyFn(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return groups;
  },

  renderBorders(items) {
    if (this.drillPath.length === 0) {
      const groups = this.groupBy(items, (item) => parseBorderUrl(item.url).themeSlug);
      const folders = [...groups.entries()].map(([slug, groupItems]) => ({
        slug, label: BORDER_THEMES[slug] || slug, items: groupItems,
      }));
      this.renderFolderGrid(folders, (folder) => this.openFolder(folder));
      return;
    }
    if (this.drillPath.length === 1) {
      const themeSlug = this.drillPath[0].slug;
      const themeItems = items.filter((item) => parseBorderUrl(item.url).themeSlug === themeSlug);
      const groups = this.groupBy(themeItems, (item) => parseBorderUrl(item.url).styleSlug);
      const folders = [...groups.entries()].map(([slug, groupItems]) => ({
        slug, label: BORDER_STYLES[slug] || slug, items: groupItems,
      }));
      this.renderFolderGrid(folders, (folder) => this.openFolder(folder));
      return;
    }
    const [themeSeg, styleSeg] = this.drillPath;
    const leaves = items.filter((item) => {
      const parsed = parseBorderUrl(item.url);
      return parsed.themeSlug === themeSeg.slug && parsed.styleSlug === styleSeg.slug;
    });
    this.renderLeafGrid(leaves);
  },

  renderBackgrounds(items) {
    if (this.drillPath.length === 0) {
      const groups = this.groupBy(items, (item) => parseBackgroundUrl(item.url).motifSlug);
      const folders = [...groups.entries()].map(([slug, groupItems]) => ({
        slug, label: BACKGROUND_MOTIF_LABELS[slug] || slug, items: groupItems,
      }));
      this.renderFolderGrid(folders, (folder) => this.openFolder(folder));
      return;
    }
    const motifSlug = this.drillPath[0].slug;
    const leaves = items.filter((item) => parseBackgroundUrl(item.url).motifSlug === motifSlug);
    this.renderLeafGrid(leaves);
  },

  renderIcons(items) {
    if (this.drillPath.length === 0) {
      const groups = this.groupBy(items, (item) => iconCategoryOf(item.name));
      const folders = [...groups.entries()].map(([label, groupItems]) => ({
        slug: label, label, items: groupItems,
      }));
      this.renderFolderGrid(folders, (folder) => this.openFolder(folder));
      return;
    }
    const category = this.drillPath[0].slug;
    const leaves = items.filter((item) => iconCategoryOf(item.name) === category);
    this.renderLeafGrid(leaves);
  },

  openFolder(folder) {
    this.drillPath = [...this.drillPath, { slug: folder.slug, label: folder.label }];
    this.refresh();
  },

  renderBreadcrumb() {
    const el = this.breadcrumbEl;
    if (!el) return;
    if (!this.drillPath.length) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = '';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'library-breadcrumb-back';
    back.innerHTML = icon('chevron', { size: 12 });
    back.setAttribute('aria-label', 'Back');
    back.addEventListener('click', () => {
      this.drillPath = this.drillPath.slice(0, -1);
      this.refresh();
    });
    el.appendChild(back);

    const rootChip = document.querySelector(`.library-filter .chip[data-cat="${this.currentCategory}"]`);
    const segments = [
      { label: rootChip ? rootChip.textContent : '', depth: 0 },
      ...this.drillPath.map((p, i) => ({ label: p.label, depth: i + 1 })),
    ];

    segments.forEach((seg, i) => {
      if (i > 0) el.appendChild(document.createTextNode(' › '));
      if (i === segments.length - 1) {
        const span = document.createElement('span');
        span.textContent = seg.label;
        el.appendChild(span);
      } else {
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'library-breadcrumb-link';
        link.textContent = seg.label;
        link.addEventListener('click', () => {
          this.drillPath = this.drillPath.slice(0, seg.depth);
          this.refresh();
        });
        el.appendChild(link);
      }
    });
  },

  renderFolderGrid(folders, onOpen) {
    this.grid.innerHTML = '';
    if (!folders.length) {
      this.grid.innerHTML = '<div class="library-empty">No assets in this category yet.</div>';
      return;
    }
    folders.forEach((folder) => {
      const el = document.createElement('div');
      el.className = 'library-folder';
      el.title = folder.label;

      const img = document.createElement('img');
      img.src = folder.items[0].url;
      img.alt = folder.label;
      img.draggable = false;

      const caption = document.createElement('div');
      caption.className = 'library-folder-caption';
      caption.textContent = `${folder.label} (${folder.items.length})`;

      el.appendChild(img);
      el.appendChild(caption);
      el.addEventListener('click', () => onOpen(folder));
      this.grid.appendChild(el);
    });
  },

  renderLeafGrid(items) {
    this.grid.innerHTML = '';
    if (!items.length) {
      this.grid.innerHTML = '<div class="library-empty">No assets yet. Upload images, backgrounds, or icons to reuse them across every planner you design.</div>';
      return;
    }
    items.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'library-item';
      el.title = item.name;

      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.name;
      img.draggable = false;
      img.addEventListener('click', () => this.onInsertAsset(item));

      const delBtn = document.createElement('button');
      delBtn.className = 'del-btn';
      delBtn.dataset.id = item.id;
      delBtn.setAttribute('aria-label', `Delete ${item.name}`);
      delBtn.innerHTML = icon('close', { size: 11 });
      delBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await Api.deleteLibraryAsset(item.id);
        await this.refresh();
      });

      el.appendChild(img);
      el.appendChild(delBtn);
      this.grid.appendChild(el);
    });
  },
};

function showToast(msg, duration = 2200) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), duration);
}
