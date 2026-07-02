// Thin wrapper around the backend REST API
const Api = {
  async listLibrary(category) {
    const q = category && category !== 'all' ? `?category=${category}` : '';
    const res = await fetch(`/api/library${q}`);
    return res.json();
  },
  async uploadLibraryAsset(file, category, name) {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    if (name) form.append('name', name);
    const res = await fetch('/api/library/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
  async deleteLibraryAsset(id) {
    const res = await fetch(`/api/library/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async listFonts() {
    const res = await fetch('/api/fonts');
    return res.json();
  },

  async listProjects() {
    const res = await fetch('/api/projects');
    return res.json();
  },
  async getProject(id) {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) throw new Error('Project not found');
    return res.json();
  },
  async createProject(payload) {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  async updateProject(id, payload) {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  async duplicateProject(id) {
    const res = await fetch(`/api/projects/${id}/duplicate`, { method: 'POST' });
    return res.json();
  },
  async deleteProject(id) {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    return res.json();
  },
};
