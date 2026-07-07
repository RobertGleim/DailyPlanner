// Manages the in-memory list of pages for the current project + the thumbnail sidebar UI.
const PagesManager = {
  pages: [],       // [{ id, json (fabric JSON), thumbnail (dataURL), background }]
  activeIndex: 0,

  init({ onSwitchPage, onBeforeDuplicatePage }) {
    this.onSwitchPage = onSwitchPage;
    this.onBeforeDuplicatePage = onBeforeDuplicatePage;
    this.listEl = document.getElementById('pagesList');
  },

  reset(pages) {
    this.pages = pages && pages.length ? pages : [this.blankPage()];
    this.activeIndex = 0;
    this.render();
  },

  blankPage() {
    return { id: cryptoRandomId(), json: null, thumbnail: null, background: '#ffffff' };
  },

  addPage() {
    this.pages.push(this.blankPage());
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
      row.innerHTML = `
        <img src="${page.thumbnail || ''}" alt="Page ${i + 1}" />
        <div class="page-meta">Page ${i + 1}</div>
        <div class="page-actions">
          <button class="dup-btn" title="Duplicate" aria-label="Duplicate page ${i + 1}">${icon('duplicate', { size: 14 })}</button>
          <button class="del-btn" title="Delete" aria-label="Delete page ${i + 1}">${icon('trash', { size: 14 })}</button>
        </div>`;
      row.addEventListener('click', (e) => {
        if (e.target.closest('.page-actions')) return;
        this.switchTo(i);
      });
      row.querySelector('.dup-btn').addEventListener('click', (e) => { e.stopPropagation(); this.duplicatePage(i); });
      row.querySelector('.del-btn').addEventListener('click', (e) => { e.stopPropagation(); this.deletePage(i); });
      this.listEl.appendChild(row);
    });
  },

  renderThumbOnly(index) {
    const row = this.listEl.children[index];
    if (row) {
      const img = row.querySelector('img');
      img.src = this.pages[index].thumbnail || '';
    }
  },
};

function cryptoRandomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
