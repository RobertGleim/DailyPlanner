// Manages the in-memory list of pages for the current project + the thumbnail sidebar UI.
const EMPTY_THUMBNAIL_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const PagesManager = {
  pages: [],       // [{ id, json (fabric JSON), thumbnail (dataURL), background, type, coverType, isLandscape }]
  activeIndex: 0,
  draggedIndex: null,

  init({ onSwitchPage, onBeforeDuplicatePage, onBeforeReorder }) {
    this.onSwitchPage = onSwitchPage;
    this.onBeforeDuplicatePage = onBeforeDuplicatePage;
    this.onBeforeReorder = onBeforeReorder;
    this.listEl = document.getElementById('pagesList');
  },

  reset(pages) {
    const source = pages && pages.length ? pages : [this.blankPage()];
    this.pages = source.map((page) => this.normalizePage(page));
    this.activeIndex = Math.max(0, Math.min(this.activeIndex, this.pages.length - 1));
    this.render();
  },

  normalizePage(page) {
    const type = page?.type === 'cover' ? 'cover' : 'page';
    const coverType = type === 'cover' ? (page?.coverType || 'letter') : null;
    return {
      id: page?.id || cryptoRandomId(),
      json: page?.json || null,
      thumbnail: page?.thumbnail || null,
      background: page?.background || '#ffffff',
      type,
      coverType,
      isLandscape: Boolean(page?.isLandscape),
    };
  },

  blankPage() {
    return { id: cryptoRandomId(), json: null, thumbnail: null, background: '#ffffff', type: 'page', coverType: null, isLandscape: false };
  },

  blankCoverPage(coverType = 'letter') {
    return { id: cryptoRandomId(), json: null, thumbnail: null, background: '#ffffff', type: 'cover', coverType, isLandscape: false };
  },

  addPage() {
    this.pages.push(this.blankPage());
    this.activeIndex = this.pages.length - 1;
    this.render();
    this.onSwitchPage(this.activeIndex);
  },

  addCover(coverType = 'letter') {
    this.pages.push(this.blankCoverPage(coverType));
    this.activeIndex = this.pages.length - 1;
    this.render();
    this.onSwitchPage(this.activeIndex);
  },

  duplicatePage(index) {
    if (typeof this.onBeforeDuplicatePage === 'function') {
      this.onBeforeDuplicatePage(index);
    }
    const src = this.pages[index];
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = cryptoRandomId();
    this.pages.splice(index + 1, 0, copy);
    this.activeIndex = index + 1;
    this.render();
    this.onSwitchPage(this.activeIndex);
  },

  rotatePage(index) {
    const page = this.pages[index];
    if (!page) return;
    page.isLandscape = !page.isLandscape;
    if (index === this.activeIndex) {
      this.onSwitchPage(index);
    }
    this.render();
  },

  reorderPages(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    if (typeof this.onBeforeReorder === 'function') {
      this.onBeforeReorder();
    }
    const activePageId = this.pages[this.activeIndex]?.id;
    const [moved] = this.pages.splice(fromIndex, 1);
    this.pages.splice(toIndex, 0, moved);
    this.activeIndex = this.pages.findIndex((page) => page.id === activePageId);
    if (this.activeIndex < 0) this.activeIndex = 0;
    this.render();
  },

  deletePage(index) {
    if (this.pages.length === 1) {
      showToast("Can't delete the only page");
      return;
    }
    this.pages.splice(index, 1);
    this.activeIndex = Math.max(0, Math.min(this.activeIndex, this.pages.length - 1));
    this.render();
    this.onSwitchPage(this.activeIndex);
  },

  switchTo(index) {
    this.activeIndex = index;
    this.render();
    this.onSwitchPage(index);
  },

  updateActivePage(json, thumbnail, background) {
    const page = this.pages[this.activeIndex];
    if (!page) return;
    page.json = json;
    page.thumbnail = thumbnail;
    page.background = background;
    this.renderThumbOnly(this.activeIndex);
  },

  render() {
    this.listEl.innerHTML = '';
    this.pages.forEach((page, i) => {
      const row = document.createElement('div');
      row.className = 'page-thumb' + (i === this.activeIndex ? ' active' : '');
      row.draggable = true;
      row.dataset.index = String(i);
      const pageLabel = page.type === 'cover' ? `Book Cover${page.isLandscape ? ' (Landscape)' : ''}` : `Page ${i + 1}${page.isLandscape ? ' (Landscape)' : ''}`;
      const thumbSrc = page.thumbnail || EMPTY_THUMBNAIL_DATA_URL;
      row.innerHTML = `
        <img src="${thumbSrc}" alt="${pageLabel}" />
        <div class="page-meta">${pageLabel}</div>
        <div class="page-actions">
          <button class="rot-btn" title="Rotate page orientation" aria-label="Rotate ${pageLabel}">${icon('rotate-page', { size: 14 })}</button>
          <button class="dup-btn" title="Duplicate" aria-label="Duplicate ${pageLabel}">${icon('duplicate', { size: 14 })}</button>
          <button class="del-btn" title="Delete" aria-label="Delete ${pageLabel}">${icon('trash', { size: 14 })}</button>
        </div>`;
      row.addEventListener('click', (e) => {
        if (e.target.closest('.page-actions')) return;
        this.switchTo(i);
      });
      row.querySelector('.rot-btn').addEventListener('click', (e) => { e.stopPropagation(); this.rotatePage(i); });
      row.querySelector('.dup-btn').addEventListener('click', (e) => { e.stopPropagation(); this.duplicatePage(i); });
      row.querySelector('.del-btn').addEventListener('click', (e) => { e.stopPropagation(); this.deletePage(i); });

      row.addEventListener('dragstart', (e) => {
        this.draggedIndex = i;
        row.classList.add('dragging');
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over');
      });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        if (this.draggedIndex === null) return;
        this.reorderPages(this.draggedIndex, i);
        this.draggedIndex = null;
      });
      row.addEventListener('dragend', () => {
        this.draggedIndex = null;
        row.classList.remove('dragging');
        this.listEl.querySelectorAll('.page-thumb').forEach((el) => el.classList.remove('drag-over', 'dragging'));
      });

      this.listEl.appendChild(row);
    });
  },

  renderThumbOnly(index) {
    const row = this.listEl.children[index];
    if (row) {
      const img = row.querySelector('img');
      img.src = this.pages[index].thumbnail || EMPTY_THUMBNAIL_DATA_URL;
    }
  },
};

function cryptoRandomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
