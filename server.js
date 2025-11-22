import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import { MongoClient } from "mongodb";

const app = express();

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://juntra24.github.io';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true);
    if (origin === FRONTEND_URL || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return cb(null, true);
    }
    return cb(null, false);
  }
}));
app.use(express.json());

app.get("/chat", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.options("/chat", cors(), (req, res) => {
  res.sendStatus(204);
});

function tryExtractTextFromObject(obj) {
  if (!obj) return null;
  if (typeof obj.reply === 'string') return obj.reply;
  if (typeof obj.text === 'string') return obj.text;
  if (typeof obj.response === 'string') return obj.response;
  if (Array.isArray(obj.choices) && obj.choices[0]) {
    const c = obj.choices[0];
    if (c.message && c.message.content) return c.message.content;
    if (c.text) return c.text;
  }
  if (Array.isArray(obj.output)) {
    return obj.output.map(o => o.content || o.text || (typeof o === 'string' ? o : JSON.stringify(o))).join(' ');
  }
  if (Array.isArray(obj.results)) {
    return obj.results.map(r => r.response || r.output || JSON.stringify(r)).join(' ');
  }
  return JSON.stringify(obj);
}

async function parseNdjsonToText(nd) {
  const lines = nd.split(/\r?\n/);
  let out = '';
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t);
      const txt = tryExtractTextFromObject(o);
      out += (txt ? txt : ' ');
    } catch (e) {
      out += t + ' ';
    }
  }
  return out.trim();
}

app.post("/chat", async (req, res) => {
  try {
    const prompt = req.body.prompt || req.body.message || "";
    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    const ollamaBody = {
      model: "llama3",
      prompt: `Eres un asistente amigable para aprender quechua. Responde: ${prompt}`,
      stream: false
    };

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(ollamaBody),
     });

    if (!response.ok) {
      const errText = await response.text().catch(()=>`Status ${response.status}`);
      return res.status(502).json({ error: 'Error conectando con Ollama', details: errText });
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    let finalText = "";

    if (contentType.includes('application/json')) {
      const data = await response.json().catch(()=>null);
      finalText = tryExtractTextFromObject(data) || '';
    } else {
      const bodyText = await response.text();
      if (bodyText.trim().startsWith('{') === false && bodyText.includes('\n')) {
        finalText = await parseNdjsonToText(bodyText);
      } else {
        try {
          const maybeObj = JSON.parse(bodyText);
          finalText = tryExtractTextFromObject(maybeObj);
        } catch (e) {
          finalText = bodyText;
        }
      }
    }

    finalText = (finalText || '').toString().trim();
    return res.json({ reply: finalText });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno', details: String(error) });
  }
});

app.all("/chat", (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'OPTIONS') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  next();
});

app.use(express.static('.'));

// MongoDB Atlas connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://juntrabajoprogramacion_db_user:X7oLkpVKIIcP0qy0@cluster0.7yukkfw.mongodb.net/?appName=Cluster0';
const DB_NAME = 'aprende_quechua';
const USERS_COLL = 'users';

const XP_PER_LEVEL = 100;
const MAX_LEVEL = 10;
const XP_PER_CORRECT = 10;
const XP_PENALTY_PER_WRONG = 5;

let dbClient, db;

async function start() {
  dbClient = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await dbClient.connect();
  db = dbClient.db(DB_NAME);
  console.log('Connected to MongoDB Atlas:', DB_NAME);
}
start().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

// Helper: normaliza email/id
function userIdFromEmail(email) {
  return email ? email.toLowerCase() : ('guest_' + Date.now());
}

// Upsert user profile and return updated document
app.post('/api/upsert-user', async (req, res) => {
  try {
    const { email, name, picture } = req.body;
    const id = userIdFromEmail(email || '');
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
    const doc = await users.findOne({ id });
    res.json({ ok: true, user: doc });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Process quiz result and adjust xp/level server-side
app.post('/api/quiz-result', async (req, res) => {
  try {
    const { email, correct = 0, wrong = 0, xpSession = 0 } = req.body;
    const id = userIdFromEmail(email || '');
    const users = db.collection(USERS_COLL);

    // Compute deltaXP same logic as client
    const delta = (Number(correct) * XP_PER_CORRECT) - (Number(wrong) * XP_PENALTY_PER_WRONG);

    // Load existing user or create default
    let user = await users.findOne({ id });
    if (!user) {
      const now = Date.now();
      user = { id, email: email || id, name: email || 'Invitado', picture: null, level: 1, xp: 0, lastLogin: now, createdAt: now };
      await users.insertOne(user);
    }

    let xp = Number(user.xp || 0) + Math.round(delta);
    let level = Number(user.level || 1);

    // level up
    while (xp >= XP_PER_LEVEL && level < MAX_LEVEL) {
      xp -= XP_PER_LEVEL;
      level += 1;
    }
    // level down
    while (xp < 0 && level > 1) {
      level -= 1;
      xp += XP_PER_LEVEL;
    }
    if (level <= 1 && xp < 0) { level = 1; xp = 0; }
    if (level >= MAX_LEVEL) { level = MAX_LEVEL; xp = XP_PER_LEVEL; }

    const now = Date.now();
    await users.updateOne({ id }, { $set: { xp, level, lastLogin: now }, $currentDate: { updatedAt: true } }, { upsert: true });
    const updated = await users.findOne({ id });
    res.json({ ok: true, user: { id: updated.id, name: updated.name, email: updated.email, picture: updated.picture, level: updated.level, xp: updated.xp, lastLogin: updated.lastLogin } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Leaderboard: returns sorted users
app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = db.collection(USERS_COLL);
    const list = await users.find({}).project({ _id: 0 }).toArray();
    list.sort((a, b) => {
      if ((b.level||0) !== (a.level||0)) return (b.level||0) - (a.level||0);
      if ((b.xp||0) !== (a.xp||0)) return (b.xp||0) - (a.xp||0);
      return (b.lastLogin||0) - (a.lastLogin||0);
    });
    res.json({ ok: true, list });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Optional: get single user
app.get('/api/user', async (req, res) => {
  try {
    const email = req.query.email || '';
    const id = userIdFromEmail(email);
    const users = db.collection(USERS_COLL);
    const u = await users.findOne({ id }, { projection: { _id: 0 } });
    res.json({ ok: true, user: u || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => console.log('Server listening on port', PORT));
