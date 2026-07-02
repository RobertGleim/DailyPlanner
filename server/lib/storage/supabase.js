// Supabase storage driver — used on Vercel (and anywhere else STORAGE_DRIVER=supabase
// is set), since serverless functions have no writable/persistent filesystem.
// Postgres holds the `library_assets` and `projects` tables (see supabase/schema.sql);
// Storage holds the actual asset files in one public bucket.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const LIBRARY_CATEGORIES = ['images', 'backgrounds', 'icons', 'borders'];
const BUCKET = process.env.SUPABASE_LIBRARY_BUCKET || 'library';

let _client;
function client() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'STORAGE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set'
    );
  }
  _client = createClient(url, key);
  return _client;
}
function safeId() {
  return crypto.randomBytes(8).toString('hex');
}

function toLibraryItem(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    url: row.url,
    createdAt: row.created_at,
  };
}
function toProject(row) {
  return {
    id: row.id,
    name: row.name,
    pageSize: row.page_size,
    pages: row.pages || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function toProjectSummary(row) {
  const pages = row.pages || [];
  return {
    id: row.id,
    name: row.name,
    pageSize: row.page_size,
    pageCount: pages.length,
    updatedAt: row.updated_at,
    thumbnail: pages[0] ? pages[0].thumbnail : null,
  };
}

module.exports = {
  LIBRARY_CATEGORIES,

  async listLibrary(category) {
    let query = client().from('library_assets').select('*').order('created_at', { ascending: false });
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) throw error;
    return data.map(toLibraryItem);
  },

  async uploadLibraryAsset({ buffer, originalname, category, name, contentType }) {
    const cat = LIBRARY_CATEGORIES.includes(category) ? category : 'images';
    const ext = (originalname.match(/\.[^.]+$/) || ['.png'])[0];
    const filename = `${safeId()}${ext}`;
    const storagePath = `${cat}/${filename}`;

    const { error: uploadError } = await client()
      .storage.from(BUCKET)
      .upload(storagePath, buffer, { contentType: contentType || 'application/octet-stream' });
    if (uploadError) throw uploadError;

    const { data: pub } = client().storage.from(BUCKET).getPublicUrl(storagePath);

    const row = {
      id: safeId(),
      name: name || originalname,
      category: cat,
      url: pub.publicUrl,
      created_at: new Date().toISOString(),
    };
    const { error: insertError } = await client().from('library_assets').insert(row);
    if (insertError) throw insertError;
    return toLibraryItem(row);
  },

  async deleteLibraryAsset(id) {
    const { data: row, error: fetchError } = await client()
      .from('library_assets')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!row) return null;

    const storagePath = row.url.split(`/${BUCKET}/`).pop();
    if (storagePath) {
      await client().storage.from(BUCKET).remove([storagePath]);
    }
    const { error: deleteError } = await client().from('library_assets').delete().eq('id', id);
    if (deleteError) throw deleteError;
    return toLibraryItem(row);
  },

  async listProjects() {
    const { data, error } = await client()
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data.map(toProjectSummary);
  },

  async getProject(id) {
    const { data, error } = await client().from('projects').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? toProject(data) : null;
  },

  async createProject({ name, pageSize, pages }) {
    const now = new Date().toISOString();
    const row = {
      id: safeId(),
      name: name || 'Untitled Planner',
      page_size: pageSize || 'letter',
      pages: pages || [],
      created_at: now,
      updated_at: now,
    };
    const { error } = await client().from('projects').insert(row);
    if (error) throw error;
    return toProject(row);
  },

  async updateProject(id, patch) {
    const { data: existing, error: fetchError } = await client()
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return null;

    const updates = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.pageSize !== undefined) updates.page_size = patch.pageSize;
    if (patch.pages !== undefined) updates.pages = patch.pages;

    const { data, error } = await client()
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return toProject(data);
  },

  async duplicateProject(id) {
    const { data: original, error: fetchError } = await client()
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!original) return null;

    const now = new Date().toISOString();
    const row = {
      ...original,
      id: safeId(),
      name: `${original.name} (Copy)`,
      created_at: now,
      updated_at: now,
    };
    const { error: insertError } = await client().from('projects').insert(row);
    if (insertError) throw insertError;
    return toProject(row);
  },

  async deleteProject(id) {
    const { error, count } = await client().from('projects').delete({ count: 'exact' }).eq('id', id);
    if (error) throw error;
    return (count || 0) > 0;
  },
};
