// Local-disk storage driver — used for `npm start` local development.
// Behavior is unchanged from the original single-file server.js implementation.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
const LIBRARY_DIR = path.join(DATA_DIR, 'library');
const LIBRARY_INDEX = path.join(LIBRARY_DIR, 'index.json');
const LIBRARY_CATEGORIES = ['images', 'backgrounds', 'icons', 'borders'];

// The ~1,800-family Google Fonts catalog (see scripts/seed-fonts.js) lives in
// Supabase Storage only — too large to ship in this git-tracked local data
// dir. Local dev proxies to Supabase when credentials are configured; with
// no credentials, fall back to the same handful of system fonts the app
// shipped with, so `npm start` still works fully offline.
const FALLBACK_FONTS = [
  'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS',
].map((family) => ({ id: family.toLowerCase().replace(/\s+/g, '-'), family, category: 'system', url: null, weightRange: null }));

[PROJECTS_DIR, LIBRARY_DIR, ...LIBRARY_CATEGORIES.map((c) => path.join(LIBRARY_DIR, c))]
  .forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

if (!fs.existsSync(LIBRARY_INDEX)) {
  fs.writeFileSync(LIBRARY_INDEX, JSON.stringify({ items: [] }, null, 2));
}

function readLibraryIndex() {
  try {
    return JSON.parse(fs.readFileSync(LIBRARY_INDEX, 'utf-8'));
  } catch (e) {
    return { items: [] };
  }
}
function writeLibraryIndex(data) {
  fs.writeFileSync(LIBRARY_INDEX, JSON.stringify(data, null, 2));
}
function safeId() {
  return crypto.randomBytes(8).toString('hex');
}

module.exports = {
  LIBRARY_DIR,
  LIBRARY_CATEGORIES,

  async listLibrary(category) {
    const data = readLibraryIndex();
    return category ? data.items.filter((i) => i.category === category) : data.items;
  },

  async uploadLibraryAsset({ buffer, originalname, category, name }) {
    const cat = LIBRARY_CATEGORIES.includes(category) ? category : 'images';
    const ext = path.extname(originalname) || '.png';
    const filename = `${safeId()}${ext}`;
    fs.writeFileSync(path.join(LIBRARY_DIR, cat, filename), buffer);

    const data = readLibraryIndex();
    const item = {
      id: safeId(),
      name: name || originalname,
      category: cat,
      url: `/library-files/${cat}/${filename}`,
      createdAt: new Date().toISOString(),
    };
    data.items.unshift(item);
    writeLibraryIndex(data);
    return item;
  },

  async deleteLibraryAsset(id) {
    const data = readLibraryIndex();
    const idx = data.items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const [item] = data.items.splice(idx, 1);
    writeLibraryIndex(data);
    try {
      const filePath = path.join(LIBRARY_DIR, item.url.replace('/library-files/', ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) { /* ignore */ }
    return item;
  },

  async listFonts() {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return require('./supabase').listFonts();
    }
    return FALLBACK_FONTS;
  },

  async listProjects() {
    const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.endsWith('.json'));
    const summaries = files.map((f) => {
      try {
        const full = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf-8'));
        return {
          id: full.id,
          name: full.name,
          pageSize: full.pageSize,
          pageCount: (full.pages || []).length,
          updatedAt: full.updatedAt,
          thumbnail: full.pages && full.pages[0] ? full.pages[0].thumbnail : null,
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    summaries.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return summaries;
  },

  async getProject(id) {
    const file = path.join(PROJECTS_DIR, `${id}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  },

  async createProject({ name, pageSize, pages }) {
    const id = safeId();
    const now = new Date().toISOString();
    const project = {
      id,
      name: name || 'Untitled Planner',
      pageSize: pageSize || 'letter',
      pages: pages || [],
      createdAt: now,
      updatedAt: now,
    };
    fs.writeFileSync(path.join(PROJECTS_DIR, `${id}.json`), JSON.stringify(project, null, 2));
    return project;
  },

  async updateProject(id, patch) {
    const file = path.join(PROJECTS_DIR, `${id}.json`);
    if (!fs.existsSync(file)) return null;
    const existing = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const updated = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(file, JSON.stringify(updated, null, 2));
    return updated;
  },

  async duplicateProject(id) {
    const file = path.join(PROJECTS_DIR, `${id}.json`);
    if (!fs.existsSync(file)) return null;
    const original = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const newId = safeId();
    const now = new Date().toISOString();
    const copy = { ...original, id: newId, name: `${original.name} (Copy)`, createdAt: now, updatedAt: now };
    fs.writeFileSync(path.join(PROJECTS_DIR, `${newId}.json`), JSON.stringify(copy, null, 2));
    return copy;
  },

  async deleteProject(id) {
    const file = path.join(PROJECTS_DIR, `${id}.json`);
    if (!fs.existsSync(file)) return false;
    fs.unlinkSync(file);
    return true;
  },
};
