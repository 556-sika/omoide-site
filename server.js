require('dotenv').config();

const express    = require('express');
const mongoose   = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer     = require('multer');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// --- Cloudinary ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- MongoDB ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB 接続成功'))
  .catch(e  => console.error('❌ MongoDB 接続失敗:', e.message));

const memorySchema = new mongoose.Schema({
  title:       { type: String, required: true },
  date:        { type: String, required: true },
  location:    { type: String, default: '' },
  description: { type: String, default: '' },
  photos:      { type: [String], default: [] },
}, { timestamps: true });

const Memory = mongoose.model('Memory', memorySchema);

// --- Multer + Cloudinary storage ---
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'omoide',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'],
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function fmt(m) {
  return {
    id:          m._id,
    title:       m.title,
    date:        m.date,
    location:    m.location,
    description: m.description,
    photos:      m.photos,
    created_at:  m.createdAt,
  };
}

// --- API ---
app.get('/api/memories', async (req, res) => {
  try {
    const list = await Memory.find().sort({ date: -1 });
    res.json(list.map(fmt));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/memories/:id', async (req, res) => {
  try {
    const m = await Memory.findById(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    res.json(fmt(m));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/memories', async (req, res) => {
  try {
    const m = await Memory.create(req.body);
    res.json(fmt(m));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/memories/:id', async (req, res) => {
  try {
    const m = await Memory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!m) return res.status(404).json({ error: 'Not found' });
    res.json(fmt(m));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/memories/:id', async (req, res) => {
  try {
    await Memory.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/upload', upload.array('photos', 20), (req, res) => {
  const urls = req.files.map(f => f.path);
  res.json({ urls });
});

app.listen(PORT, () => {
  console.log(`✨ おもいでサイト起動中！ → http://localhost:${PORT}`);
});
