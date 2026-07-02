const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const storage = require('./lib/storage');

const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Enable cross-origin isolation so the in-browser background-removal engine
// (onnxruntime-web WASM) can use multi-threading instead of falling back to
// single-threaded execution. Safe for this fully self-contained app since all
// assets (fabric.js, jsPDF, onnxruntime-web) are served locally, not from a CDN.
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// Static frontend + local library files only apply when running the Express
// server directly (local dev). On Vercel, `public/` is served by the
// platform itself (see vercel.json) and library files live in Supabase
// Storage, so this module is only reached for /api/* there.
app.use(express.static(path.join(__dirname, '..', 'public')));
if (storage.LIBRARY_DIR) {
  app.use('/library-files', express.static(storage.LIBRARY_DIR));
}

// SVG deliberately excluded: unlike raster formats, an SVG can carry an
// embedded <script> that executes if its storage URL is opened directly —
// a stored-XSS vector. No preloaded or uploaded asset in this app is an SVG.
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Only images are allowed.`));
    }
  },
});

// The upload's declared mimetype is just a client-supplied header field and
// trivially spoofable, so also verify the actual file bytes match a known
// image signature before trusting it (defense in depth alongside fileFilter).
function hasValidImageSignature(buffer, mimetype) {
  if (mimetype === 'image/webp') {
    return buffer.length >= 12
      && buffer.toString('ascii', 0, 4) === 'RIFF'
      && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  const signatures = {
    'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/gif': [0x47, 0x49, 0x46, 0x38],
  };
  const sig = signatures[mimetype];
  if (!sig) return false;
  return sig.every((byte, i) => buffer[i] === byte);
}

// ================= LIBRARY API =================

app.get('/api/library', async (req, res, next) => {
  try {
    const items = await storage.listLibrary(req.query.category || null);
    res.json({ items });
  } catch (e) { next(e); }
});

app.post('/api/library/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!hasValidImageSignature(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ error: 'File content does not match a supported image type' });
    }
    const item = await storage.uploadLibraryAsset({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      contentType: req.file.mimetype,
      category: req.body.category,
      name: req.body.name,
    });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

app.delete('/api/library/:id', async (req, res, next) => {
  try {
    const item = await storage.deleteLibraryAsset(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ================= PROJECT API =================

app.get('/api/projects', async (req, res, next) => {
  try {
    const projects = await storage.listProjects();
    res.json({ projects });
  } catch (e) { next(e); }
});

app.get('/api/projects/:id', async (req, res, next) => {
  try {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  } catch (e) { next(e); }
});

app.post('/api/projects', async (req, res, next) => {
  try {
    const project = await storage.createProject(req.body);
    res.status(201).json(project);
  } catch (e) { next(e); }
});

app.put('/api/projects/:id', async (req, res, next) => {
  try {
    const updated = await storage.updateProject(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { next(e); }
});

app.post('/api/projects/:id/duplicate', async (req, res, next) => {
  try {
    const copy = await storage.duplicateProject(req.params.id);
    if (!copy) return res.status(404).json({ error: 'Not found' });
    res.status(201).json(copy);
  } catch (e) { next(e); }
});

app.delete('/api/projects/:id', async (req, res, next) => {
  try {
    const deleted = await storage.deleteProject(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
