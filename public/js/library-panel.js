// Handles the "Library" tab: uploading, browsing, deleting, and inserting assets
const LibraryPanel = {
  currentCategory: 'all',

  async init(onInsertAsset) {
    this.onInsertAsset = onInsertAsset;
    this.grid = document.getElementById('libraryGrid');

    document.querySelectorAll('.library-filter .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.library-filter .chip').forEach((c) => c.classList.remove('active'));
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
