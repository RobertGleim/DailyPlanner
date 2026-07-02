// Handles the "Library" tab: uploading, browsing, deleting, and inserting assets
const LibraryPanel = {
  currentCategory: 'all',

  async init(onInsertAsset) {
    this.onInsertAsset = onInsertAsset;
    this.grid = document.getElementById('libraryGrid');

    document.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentCategory = chip.dataset.cat;
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
    this.grid.innerHTML = '';
    if (!items.length) {
      this.grid.innerHTML = '<div class="library-empty">No assets yet. Upload images, backgrounds, or icons to reuse them across every planner you design.</div>';
      return;
    }
    items.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'library-item';
      el.title = item.name;
      el.innerHTML = `<img src="${item.url}" alt="${item.name}" draggable="false" />
        <button class="del-btn" data-id="${item.id}">✕</button>`;
      el.querySelector('img').addEventListener('click', () => this.onInsertAsset(item));
      el.querySelector('.del-btn').addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await Api.deleteLibraryAsset(item.id);
        await this.refresh();
      });
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
