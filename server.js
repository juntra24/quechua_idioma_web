/**
 * server.js
 * Simple Express + MongoDB backend para almacenar inicios de sesión, niveles y leaderboard.
 *
 * Instalación:
 *  - npm init -y
 *  - npm install express mongodb cors
 *
 * Ejecutar:
 *  - node server.js
 *
 * Nota: define MONGODB_URI en el entorno para seguridad; si no, se usa la cadena incluida.
 */
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

// --- START: static file handlers for apps where files are in project root ---
// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve main pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/leaderboard', (req, res) => res.sendFile(path.join(__dirname, 'leaderboard.html')));
app.get('/quiz', (req, res) => res.sendFile(path.join(__dirname, 'quiz.html')));
app.get('/vocabulario', (req, res) => res.sendFile(path.join(__dirname, 'vocabulario.html')));
app.get('/chatbot', (req, res) => res.sendFile(path.join(__dirname, 'chatbot.html')));

// Serve CSS/JS and images that are located at project root
app.use('/chat.css', (req, res) => res.sendFile(path.join(__dirname, 'chat.css')));
app.use('/styles.css', (req, res) => res.sendFile(path.join(__dirname, 'styles.css')));
app.use('/quiz.js', (req, res) => res.sendFile(path.join(__dirname, 'quiz.js')));

// images
app.use('/icon.png', (req, res) => res.sendFile(path.join(__dirname, 'icon.png')));
app.use('/fondo.png', (req, res) => res.sendFile(path.join(__dirname, 'fondo.png')));
app.use('/fondo2.png', (req, res) => res.sendFile(path.join(__dirname, 'fondo2.png')));
app.use('/fondo3.png', (req, res) => res.sendFile(path.join(__dirname, 'fondo3.png')));

// --- END: static file handlers ---

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://juntrabajoprogramacion_db_user:X7oLkpVKIIcP0qy0@cluster0.7yukkfw.mongodb.net/?appName=Cluster0';
const DB_NAME = 'aprende_quechua';
const USERS_COLL = 'users';

const XP_PER_LEVEL = 100;
const MAX_LEVEL = 10;
const XP_PER_CORRECT = 10;
const XP_PENALTY_PER_WRONG = 5;

let db;

async function connect() {
  const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  db = client.db(DB_NAME);
  console.log('Connected to MongoDB:', DB_NAME);
}
connect().catch(err => {
  console.error('MongoDB connection failed:', err);
  process.exit(1);
});

// Helpers
function normalizeId(email) {
  if (!email) return 'guest_' + Date.now();
  return email.toLowerCase();
}

async function upsertUserRecord({ email, name, picture }) {
  const id = normalizeId(email);
  const users = db.collection(USERS_COLL);
  const now = Date.now();
  const update = {
    $set: {
      id,
      email: email || id,
      name: name || (email || 'Invitado'),
      picture: picture || null,
      lastLogin: now
    },
    $setOnInsert: { level: 1, xp: 0, createdAt: now }
  };
  await users.updateOne({ id }, update, { upsert: true });
  return await users.findOne({ id }, { projection: { _id: 0 } });
}

// Endpoints

// Registra/upserta usuario al iniciar sesión
app.post('/api/upsert-user', async (req, res) => {
  try {
    const { email, name, picture } = req.body || {};
    const user = await upsertUserRecord({ email, name, picture });
    res.json({ ok: true, user });
  } catch (err) {
    console.error('upsert-user error', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Procesa resultado de quiz y ajusta nivel/xp
app.post('/api/quiz-result', async (req, res) => {
  try {
    const { email, correct = 0, wrong = 0 } = req.body || {};
    const id = normalizeId(email);
    const users = db.collection(USERS_COLL);

    // asegurar existencia
    let user = await users.findOne({ id });
    if (!user) {
      const now = Date.now();
      user = { id, email: email || id, name: email || 'Invitado', picture: null, level: 1, xp: 0, lastLogin: now, createdAt: now };
      await users.insertOne(user);
    }

    const delta = (Number(correct) * XP_PER_CORRECT) - (Number(wrong) * XP_PENALTY_PER_WRONG);
    let xp = Number(user.xp || 0) + Math.round(delta);
    let level = Number(user.level || 1);

    // Subir niveles
    while (xp >= XP_PER_LEVEL && level < MAX_LEVEL) {
      xp -= XP_PER_LEVEL;
      level += 1;
    }
    // Bajar niveles
    while (xp < 0 && level > 1) {
      level -= 1;
      xp += XP_PER_LEVEL;
    }
    if (level <= 1 && xp < 0) { level = 1; xp = 0; }
    if (level >= MAX_LEVEL) { level = MAX_LEVEL; xp = XP_PER_LEVEL; }

    const now = Date.now();
    await users.updateOne({ id }, { $set: { xp, level, lastLogin: now }, $currentDate: { updatedAt: true } }, { upsert: true });
    const updated = await users.findOne({ id }, { projection: { _id: 0 } });
    res.json({ ok: true, user: updated });
  } catch (err) {
    console.error('quiz-result error', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Devuelve leaderboard ordenado
app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = db.collection(USERS_COLL);
    const list = await users.find({}, { projection: { _id: 0 } }).toArray();
    list.sort((a, b) => {
      if ((b.level || 0) !== (a.level || 0)) return (b.level || 0) - (a.level || 0);
      if ((b.xp || 0) !== (a.xp || 0)) return (b.xp || 0) - (a.xp || 0);
      return (b.lastLogin || 0) - (a.lastLogin || 0);
    });
    res.json({ ok: true, list });
  } catch (err) {
    console.error('leaderboard error', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Opcional: obtener usuario
app.get('/api/user', async (req, res) => {
  try {
    const email = req.query.email || '';
    const id = normalizeId(email);
    const users = db.collection(USERS_COLL);
    const u = await users.findOne({ id }, { projection: { _id: 0 } });
    res.json({ ok: true, user: u || null });
  } catch (err) {
    console.error('user error', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
