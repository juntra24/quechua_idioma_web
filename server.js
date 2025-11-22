import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

// Resolver __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- SERVIR ARCHIVOS ESTÁTICOS ----
// Sirve TODO lo que esté en la misma carpeta que server.js
app.use(express.static(__dirname));

// Rutas principales
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'index.html'))
);

app.get('/dashboard', (req, res) =>
  res.sendFile(path.join(__dirname, 'dashboard.html'))
);

app.get('/leaderboard', (req, res) =>
  res.sendFile(path.join(__dirname, 'leaderboard.html'))
);

app.get('/quiz', (req, res) =>
  res.sendFile(path.join(__dirname, 'quiz.html'))
);

app.get('/vocabulario', (req, res) =>
  res.sendFile(path.join(__dirname, 'vocabulario.html'))
);

app.get('/chatbot', (req, res) =>
  res.sendFile(path.join(__dirname, 'chatbot.html'))
);

// ---- CONFIG MONGODB ----
const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://juntrabajoprogramacion_db_user:X7oLkpVKIIcP0qy0@cluster0.7yukkfw.mongodb.net/?appName=Cluster0';

const DB_NAME = 'aprende_quechua';
const USERS_COLL = 'users';

const XP_PER_LEVEL = 100;
const MAX_LEVEL = 10;
const XP_PER_CORRECT = 10;
const XP_PENALTY_PER_WRONG = 5;

let db;

async function connect() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log("Connected to MongoDB:", DB_NAME);
}
connect().catch(err => {
  console.error("MongoDB connection failed:", err);
  process.exit(1);
});

// ---- HELPERS ----
function normalizeId(email) {
  if (!email) return "guest_" + Date.now();
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
      name: name || (email || "Invitado"),
      picture: picture || null,
      lastLogin: now
    },
    $setOnInsert: {
      level: 1,
      xp: 0,
      createdAt: now
    }
  };

  await users.updateOne({ id }, update, { upsert: true });
  return users.findOne({ id }, { projection: { _id: 0 } });
}

// ---- ENDPOINTS ----

// Login / Registro
app.post("/api/upsert-user", async (req, res) => {
  try {
    const { email, name, picture } = req.body || {};
    const user = await upsertUserRecord({ email, name, picture });
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Resultado del quiz
app.post("/api/quiz-result", async (req, res) => {
  try {
    const { email, correct = 0, wrong = 0 } = req.body || {};
    const id = normalizeId(email);
    const users = db.collection(USERS_COLL);

    let user = await users.findOne({ id });
    if (!user) {
      const now = Date.now();
      user = {
        id,
        email: email || id,
        name: email || "Invitado",
        picture: null,
        level: 1,
        xp: 0,
        lastLogin: now,
        createdAt: now
      };
      await users.insertOne(user);
    }

    const delta = (correct * XP_PER_CORRECT) - (wrong * XP_PENALTY_PER_WRONG);
    let xp = user.xp + delta;
    let level = user.level;

    while (xp >= XP_PER_LEVEL && level < MAX_LEVEL) {
      xp -= XP_PER_LEVEL;
      level++;
    }
    while (xp < 0 && level > 1) {
      level--;
      xp += XP_PER_LEVEL;
    }
    if (level <= 1 && xp < 0) { level = 1; xp = 0; }
    if (level >= MAX_LEVEL) { level = MAX_LEVEL; xp = XP_PER_LEVEL; }

    await users.updateOne(
      { id },
      { $set: { xp, level, lastLogin: Date.now() }, $currentDate: { updatedAt: true } },
      { upsert: true }
    );

    const updated = await users.findOne({ id }, { projection: { _id: 0 } });
    res.json({ ok: true, user: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Leaderboard
app.get("/api/leaderboard", async (req, res) => {
  try {
    const users = db.collection(USERS_COLL);
    const list = await users.find({}, { projection: { _id: 0 } }).toArray();

    list.sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      if (b.xp !== a.xp) return b.xp - a.xp;
      return b.lastLogin - a.lastLogin;
    });

    res.json({ ok: true, list });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Obtener un usuario
app.get("/api/user", async (req, res) => {
  try {
    const email = req.query.email || "";
    const id = normalizeId(email);
    const users = db.collection(USERS_COLL);
    const user = await users.findOne({ id }, { projection: { _id: 0 } });
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ---- START SERVER ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server listening on port " + PORT));
