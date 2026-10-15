require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ─── MongoDB Connection ───────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ─── Patient Schema ───────────────────────────────────────────────────────────
const patientSchema = new mongoose.Schema({
  name: String,
  age: Number,
  gender: String,
  location: String,
  bloodGroup: String,
  weight: Number,
  height: Number,
  allergies: String,
  smoking: String,
  alcohol: String,
  underlyingDiseases: [String],
  medications: [String],
  emergencyContact: String,
  createdAt: { type: Date, default: Date.now },
  sessions: [{
    type: { type: String }, // 'diagnosis', 'analysis', 'report'
    data: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
  }]
});

const Patient = mongoose.model('Patient', patientSchema);

// ─── Multer (file uploads) ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'public/uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Register / Update Patient
app.post('/api/patients', async (req, res) => {
  try {
    const body = req.body;

    const patient = new Patient({
      ...body,
      underlyingDiseases: Array.isArray(body.underlyingDiseases) ? body.underlyingDiseases : [],
      medications: Array.isArray(body.medications) ? body.medications : []
    });

    await patient.save();
    res.json({ success: true, patient });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Get all patients (for history)
app.get('/api/patients', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) query = { name: { $regex: search, $options: 'i' } };
    const patients = await Patient.find(query).sort({ createdAt: -1 });
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single patient
app.get('/api/patients/:id', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save session (diagnosis/analysis result) to patient
app.post('/api/patients/:id/session', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    patient.sessions.push(req.body);
    await patient.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI ROUTE ─────────────────────────────────────────────────────────────────
app.post('/api/ai', async (req, res) => {
  try {
    console.log("🔥 /api/ai HIT");
    console.log("📦 BODY:", req.body);

    const { messages, systemPrompt } = req.body;

    // ✅ Safety fallback
    const finalPrompt = systemPrompt || "You are a helpful AI assistant.";
    const finalMessages = Array.isArray(messages) ? messages : [];

    console.log("🧠 System Prompt:", finalPrompt.slice(0, 100));
    console.log("💬 Messages Count:", finalMessages.length);

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-4o-mini',
        max_tokens: 1000,
        messages: [
          { role: 'system', content: finalPrompt },
          ...finalMessages
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'MediAI'
        }
      }
    );

    console.log("✅ AI RESPONSE RECEIVED");

    const reply = response.data?.choices?.[0]?.message?.content || "No response";

    res.json({ reply });

  } catch (err) {
    console.error("❌ AI ERROR:");
    console.error("STATUS:", err.response?.status);
    console.error("DATA:", err.response?.data);
    console.error("MESSAGE:", err.message);

    res.status(500).json({
      error: 'AI request failed',
      detail: err.response?.data || err.message
    });
  }
});

// Upload report file
app.post('/api/upload', upload.single('report'), (req, res) => {
  res.json({ filename: req.file.filename, path: `/uploads/${req.file.filename}` });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));