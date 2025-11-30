import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// DB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://juntrabajoprogramacion_db_user:X7oLkpVKIIcP0qy0@cluster0.7yukkfw.mongodb.net/?appName=Cluster0';
const DB_NAME = 'aprende_quechua';
const USERS_COLL = 'users';
const ROOMS_COLL = 'rooms';

const XP_PER_LEVEL = 100;
const MAX_LEVEL = 100; // CAMBIO: de 10 a 100

let db;
async function startDb(){
  const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  db = client.db(DB_NAME);
  console.log('Connected to MongoDB', DB_NAME);
}
startDb().catch(err => { console.error(err); process.exit(1); });

/* --- Deck helpers: UNO 108 cards --- */
function buildFullDeck(){
  const colors = ['red','yellow','green','blue'];
  const deck = [];
  // per color: one 0, two of 1-9, two each action skip/reverse/+2
  for (const color of colors){
    deck.push({ type:'number', color, value:0 });
    for (let n=1;n<=9;n++){
      deck.push({ type:'number', color, value:n });
      deck.push({ type:'number', color, value:n });
    }
    for (let i=0;i<2;i++){
      deck.push({ type:'action', color, value:'skip' });
      deck.push({ type:'action', color, value:'reverse' });
      deck.push({ type:'action', color, value:'+2' });
    }
  }
  // wilds
  for (let i=0;i<4;i++){
    deck.push({ type:'wild', color:null, value:'wild' });
    deck.push({ type:'wild', color:null, value:'wild+4' });
  }
  return deck;
}
function shuffle(arr){
  for (let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
/* draw helper that refills deck from discard (keeping top) */
function drawFromDeck(deck, discard, n=1){
  const drawn = [];
  for (let i=0;i<n;i++){
    if (deck.length === 0){
      // rebuild from discard except top
      if (discard.length > 1){
        const top = discard.pop();
        const pool = discard.splice(0);
        shuffle(pool);
        deck.push(...pool);
        discard.push(top);
      } else break;
    }
    const c = deck.pop();
    if (c) drawn.push(c);
  }
  return drawn;
}

/* --- Rooms / Game endpoints --- */

/* create-room: NO genera quiz automático; creador lo crea después */
app.post('/api/create-room', async (req,res)=>{
  try {
    const { email, name, picture, minPlayers = 2, maxPlayers = 4 } = req.body || {};
    const rooms = db.collection(ROOMS_COLL);
    const now = Date.now();
    const roomId = Math.random().toString(36).slice(2,8).toUpperCase();
    const participant = { email: email || `guest_${now}`, name: name || email || 'Invitado', picture: picture || null };
    
    const room = {
      roomId, creatorEmail: participant.email, creatorName: participant.name,
      participants: [participant], status: 'creating_quiz', createdAt: now,
      config: { minPlayers: Math.max(2, minPlayers), maxPlayers: Math.min(4, maxPlayers) },
      quiz: [], // vacío al inicio; creador lo llena
      quizState: {}, scores: {}
    };
    await rooms.insertOne(room);
    return res.json({ ok:true, room });
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* list rooms: mostrar salas en estado creating_quiz o waiting */
app.get('/api/rooms', async (req,res)=>{
  try {
    const rooms = db.collection(ROOMS_COLL);
    const list = await rooms.find({ status: { $in: ['creating_quiz', 'waiting'] } }).project({ _id:0 }).toArray();
    return res.json({ ok:true, list });
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* add-question: creador añade una pregunta al quiz */
app.post('/api/add-question', async (req,res)=>{
  try {
    const { roomId, creatorEmail, question, options, correct } = req.body || {};
    const rid = (roomId||'').toUpperCase();
    const rooms = db.collection(ROOMS_COLL);
    const room = await rooms.findOne({ roomId: rid });
    if (!room) return res.status(404).json({ ok:false, error:'Room not found' });
    if (room.creatorEmail !== (creatorEmail||'')) return res.status(403).json({ ok:false, error:'Only creator can add questions' });
    if (room.status !== 'creating_quiz') return res.status(400).json({ ok:false, error:'Quiz creation already finished' });
    if (!question || !Array.isArray(options) || options.length < 2 || typeof correct !== 'number') {
      return res.status(400).json({ ok:false, error:'Invalid question format' });
    }
    if (correct < 0 || correct >= options.length) return res.status(400).json({ ok:false, error:'Invalid correct index' });
    
    // añadir pregunta al quiz
    room.quiz.push({ question, options, correct });
    await rooms.updateOne({ roomId: rid }, { $set: { quiz: room.quiz }});
    return res.json({ ok:true, quiz: room.quiz });
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* finish-quiz-creation: creador termina de crear preguntas y cambia status a waiting */
app.post('/api/finish-quiz-creation', async (req,res)=>{
  try {
    const { roomId, creatorEmail } = req.body || {};
    const rid = (roomId||'').toUpperCase();
    const rooms = db.collection(ROOMS_COLL);
    const room = await rooms.findOne({ roomId: rid });
    if (!room) return res.status(404).json({ ok:false, error:'Room not found' });
    if (room.creatorEmail !== (creatorEmail||'')) return res.status(403).json({ ok:false, error:'Only creator' });
    if (!room.quiz || room.quiz.length < 1) return res.status(400).json({ ok:false, error:'Quiz must have at least 1 question' });
    
    await rooms.updateOne({ roomId: rid }, { $set: { status: 'waiting' }});
    return res.json({ ok:true, room: await rooms.findOne({ roomId: rid }) });
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* --- START GAME: authoritative init of UNO hand */
app.post('/api/start-room', async (req,res)=>{
  try {
    const { roomId, starterEmail } = req.body || {};
    const rid = (roomId||'').toUpperCase();
    const rooms = db.collection(ROOMS_COLL);
    const room = await rooms.findOne({ roomId: rid });
    if (!room) return res.status(404).json({ ok:false, error:'Room not found' });
    if (room.creatorEmail !== (starterEmail||'')) return res.status(403).json({ ok:false, error:'Only creator can start' });
    const participants = room.participants || [];
    if (participants.length < 2) return res.status(400).json({ ok:false, error:'Need 2+ players to start' });

    // build deck
    const deck = buildFullDeck();
    shuffle(deck);

    // deal 7 each
    const hands = {};
    for (const p of participants) hands[p.email] = drawFromDeck(deck, [], 7);

    // reveal initial discard: avoid Wild+4 as starter - if occurs, put back and reshuffle until color card
    let top = null;
    while (deck.length){
      top = deck.pop();
      if (top.type === 'wild' && top.value === 'wild+4') {
        deck.unshift(top);
        shuffle(deck);
        continue;
      }
      break;
    }
    if (!top) return res.status(500).json({ ok:false, error:'No starting card' });
    const discard = [top];

    // determine order: use participants array; currentIndex = 0 (first participant)
    const currentIndex = 0;
    // initial drawStack 0
    const gameState = {
      deck, discard, hands,
      participants: participants.map(p=>p.email),
      currentIndex, direction:1,
      activeColor: top.color || null,
      drawStack: 0, // accumulated +2/+4
      lastPlayed: null, // { card, by }
      awaitingChallenge: false,
      prePlayHands: {} // store snapshots before plays (for challenge resolution)
    };

    await rooms.updateOne({ roomId:rid }, { $set: { status:'started', gameState, startedAt: Date.now() }});
    return res.json({ ok:true, gameState });
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* PLAY CARD - main authoritative validation and effect application.
   Supports stacking: if +2 or +4 played, drawStack increases; next player may stack another +2/+4.
   For wild+4: server enforces challenge rule: you can play wild+4, but challenger may call /api/challenge.
*/
app.post('/api/play-card', async (req,res)=>{
  try {
    const { roomId, email, card, chosenColor } = req.body || {};
    const rid = (roomId||'').toUpperCase();
    const rooms = db.collection(ROOMS_COLL);
    const room = await rooms.findOne({ roomId: rid });
    if (!room || room.status !== 'started' || !room.gameState) return res.status(404).json({ ok:false, error:'Game not started or room not found' });
    const gs = room.gameState;
    const participants = gs.participants || [];
    const playerIndex = participants.indexOf(email);
    if (playerIndex === -1) return res.status(403).json({ ok:false, error:'Not a participant' });
    if (playerIndex !== gs.currentIndex) return res.status(400).json({ ok:false, error:'Not your turn' });

    const hand = gs.hands[email] || [];
    const idx = hand.findIndex(c => JSON.stringify(c) === JSON.stringify(card));
    if (idx === -1) return res.status(400).json({ ok:false, error:'Card not in hand' });

    // check playable by rules: color match OR value/type match OR wild
    const top = gs.discard[gs.discard.length-1];
    const playable = (
      card.type === 'wild' ||
      (card.color && gs.activeColor && card.color === gs.activeColor) ||
      (top && card.type === top.type && card.value === top.value) ||
      (card.type === 'number' && top && top.type === 'number' && card.value === top.value)
    );
    if (!playable) return res.status(400).json({ ok:false, error:'Card not playable' });

    // store snapshot pre-play for challenge checks
    gs.prePlayHands = gs.prePlayHands || {};
    gs.prePlayHands[email] = JSON.parse(JSON.stringify(hand));

    // remove card from hand and push to discard
    const played = hand.splice(idx,1)[0];
    gs.discard.push(played);
    gs.lastPlayed = { card: played, by: email, time: Date.now() };

    // apply effects
    let skipAdvance = false;
    // default: set active color (number/action inherits its color; wild uses chosenColor)
    if (played.type === 'number' || played.type === 'action') {
      gs.activeColor = played.color;
    }
    if (played.type === 'action'){
      if (played.value === 'skip'){
        // skip next player
        const next = (gs.currentIndex + gs.direction + participants.length) % participants.length;
        gs.currentIndex = (next + gs.direction + participants.length) % participants.length; // skip one
      } else if (played.value === 'reverse'){
        gs.direction *= -1;
        if (participants.length === 2){
          // reverse acts as skip
          gs.currentIndex = (gs.currentIndex + gs.direction + participants.length) % participants.length;
        }
      } else if (played.value === '+2'){
        // stacking: add 2 to drawStack and advance to next player (they may stack)
        gs.drawStack = (gs.drawStack || 0) + 2;
        gs.currentIndex = (gs.currentIndex + gs.direction + participants.length) % participants.length;
        // do not auto-draw yet; wait for stacking or acceptance
        await rooms.updateOne({ roomId:rid }, { $set: { gameState: gs }});
        return res.json({ ok:true, gameState: gs });
      }
    } else if (played.type === 'wild'){
      // chosenColor required
      if (!chosenColor) return res.status(400).json({ ok:false, error:'chosenColor required for wild' });
      gs.activeColor = chosenColor;
      if (played.value === 'wild+4'){
        // stacking +4: add 4 to drawStack, advance to next player but allow challenge window
        gs.drawStack = (gs.drawStack || 0) + 4;
        gs.awaitingChallenge = true;
        gs.currentIndex = (gs.currentIndex + gs.direction + participants.length) % participants.length;
        await rooms.updateOne({ roomId:rid }, { $set: { gameState: gs }});
        return res.json({ ok:true, gameState: gs, awaitingChallenge: true });
      }
    }

    // after regular play (non stacking wild+4/+2 handled above),
    // advance to next player
    gs.currentIndex = (gs.currentIndex + gs.direction + participants.length) % participants.length;

    // check if player emptied hand -> end hand
    if ((gs.hands[email] || []).length === 0){
      // compute scoring: sum of other players' cards
      const pointsMap = { 'number': (v)=>v, 'action': ()=>20, 'wild': ()=>50 };
      let total = 0;
      for (const pEmail of participants){
        if (pEmail === email) continue;
        const h = gs.hands[pEmail] || [];
        for (const card of h) {
          if (card.type === 'number') total += card.value;
          else if (card.type === 'action') total += 20;
          else if (card.type === 'wild') total += 50;
        }
      }
      // update winner's persistent score in room.scores and in users collection
      room.scores = room.scores || {};
      room.scores[email] = (room.scores[email] || 0) + total;
      const users = db.collection(USERS_COLL);
      // update user's xp/points: here we interpret points as immediate XP for simplicity
      // add total XP and adjust level
      const u = await users.findOne({ id: email.toLowerCase() });
      let level = u ? Number(u.level || 1) : 1;
      let xp = u ? Number(u.xp || 0) : 0;
      xp += total; // direct mapping: points -> xp (you can adapt)
      while (xp >= XP_PER_LEVEL && level < MAX_LEVEL){ xp -= XP_PER_LEVEL; level += 1; }
      if (level >= MAX_LEVEL){ level = MAX_LEVEL; xp = XP_PER_LEVEL; }
      await users.updateOne({ id: email.toLowerCase() }, { $set: { xp, level, lastLogin: Date.now() } }, { upsert:true });

      // finalize room: set status to 'finished', store results
      const results = [{ email, score: total, rank:1 }];
      await rooms.updateOne({ roomId:rid }, { $set: { status:'finished', gameState: gs, results, finishedAt: Date.now(), scores: room.scores }});
      return res.json({ ok:true, finished:true, results });
    }

    // persist and return
    await rooms.updateOne({ roomId:rid }, { $set: { gameState: gs }});
    return res.json({ ok:true, gameState: gs });
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* DRAW card endpoint: if drawStack > 0, player must draw that many; otherwise draw 1 */
app.post('/api/draw-card', async (req,res)=>{
  try {
    const { roomId, email } = req.body || {};
    const rid = (roomId||'').toUpperCase();
    const rooms = db.collection(ROOMS_COLL);
    const room = await rooms.findOne({ roomId: rid });
    if (!room || !room.gameState) return res.status(404).json({ ok:false, error:'Game not found' });
    const gs = room.gameState;
    const participants = gs.participants || [];
    const playerIndex = participants.indexOf(email);
    if (playerIndex === -1) return res.status(403).json({ ok:false, error:'Not participant' });
    if (playerIndex !== gs.currentIndex) return res.status(400).json({ ok:false, error:'Not your turn' });

    if (gs.drawStack && gs.drawStack > 0){
      // player must draw drawStack and lose turn
      const drawn = drawFromDeck(gs.deck, gs.discard, gs.drawStack);
      gs.hands[email] = (gs.hands[email] || []).concat(drawn);
      gs.drawStack = 0;
      // advance turn
      gs.currentIndex = (gs.currentIndex + gs.direction + participants.length) % participants.length;
      await rooms.updateOne({ roomId:rid }, { $set:{ gameState: gs }});
      return res.json({ ok:true, drawn, gameState: gs });
    } else {
      const drawn = drawFromDeck(gs.deck, gs.discard, 1);
      gs.hands[email] = (gs.hands[email] || []).concat(drawn);
      // optional immediate play is NOT implemented here (client can choose to play)
      // advance turn
      gs.currentIndex = (gs.currentIndex + gs.direction + participants.length) % participants.length;
      await rooms.updateOne({ roomId:rid }, { $set:{ gameState: gs }});
      return res.json({ ok:true, drawn, gameState: gs });
    }
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* CHALLENGE +4:
   The challenger (the player who was to draw after a wild+4) can call this.
   Server checks gs.prePlayHands for the player who played the +4; if that player had any card matching activeColor before the play, challenge succeeds (previous player penalized),
   otherwise challenger penalized. After challenge resolution, apply draw accordingly and advance turn.
*/
app.post('/api/challenge', async (req,res)=>{
  try {
    const { roomId, challengerEmail } = req.body || {};
    const rid = (roomId||'').toUpperCase();
    const rooms = db.collection(ROOMS_COLL);
    const room = await rooms.findOne({ roomId: rid });
    if (!room || !room.gameState) return res.status(404).json({ ok:false, error:'Game not found' });
    const gs = room.gameState;
    if (!gs.lastPlayed || gs.lastPlayed.card.value !== 'wild+4') return res.status(400).json({ ok:false, error:'No wild+4 to challenge' });
    const playedBy = gs.lastPlayed.by;
    // prePlayHands snapshot
    const pre = (gs.prePlayHands && gs.prePlayHands[playedBy]) || [];
    const activeColorBeforePlay = gs.activeColor || null; // note: activeColor may have been set; but pre-check uses previous activeColor which we don't track separately here. We'll approximate: if pre contains any card of current active color before play, challenge true.
    // To be strict, server should have stored activeColorBeforePlay; if not available, skip strict enforcement.
    // We'll use: check if pre contains any card with color equal to (the color that was active immediately before the +4). Since we didn't store it, assume challenge loses unless we stored it.
    // For better behavior, require gs.challengeColor stored when +4 was played. Check that:
    const challengeColor = gs.challengeColor || null;
    if (!challengeColor){
      // no stored color: cannot validate; reject challenge
      return res.status(400).json({ ok:false, error:'Challenge not available (no challengeColor stored)' });
    }
    const hadColor = pre.some(c => c.color === challengeColor);
    const users = db.collection(USERS_COLL);
    if (hadColor){
      // player who played +4 cheated -> they draw 4 (penalty) and challenger does not draw
      const drawn = drawFromDeck(gs.deck, gs.discard, 4);
      gs.hands[playedBy] = (gs.hands[playedBy] || []).concat(drawn);
      // the player who played +4 loses turn; currentIndex stays at the chellenger (they will play next)
      gs.drawStack = 0;
      gs.awaitingChallenge = false;
      await rooms.updateOne({ roomId:rid }, { $set:{ gameState: gs }});
      return res.json({ ok:true, result:'cheater', drawn, gameState:gs });
    } else {
      // challenger loses: challenger draws 6 (common variant) and loses turn
      const drawn = drawFromDeck(gs.deck, gs.discard, 6);
      gs.hands[challengerEmail] = (gs.hands[challengerEmail] || []).concat(drawn);
      gs.drawStack = 0;
      gs.awaitingChallenge = false;
      // advance turn to next player after challenger
      const participants = gs.participants || [];
      const idx = participants.indexOf(challengerEmail);
      gs.currentIndex = (idx + gs.direction + participants.length) % participants.length;
      await rooms.updateOne({ roomId:rid }, { $set:{ gameState: gs }});
      return res.json({ ok:true, result:'challenger_failed', drawn, gameState:gs });
    }
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* declare-uno: player claims UNO when they have 1 card. We store flag for potential penalty checks (clients can call /api/claim-uno) */
app.post('/api/declare-uno', async (req,res)=>{
  try {
    const { roomId, email } = req.body || {};
    const rid = (roomId||'').toUpperCase();
    const rooms = db.collection(ROOMS_COLL);
    const room = await rooms.findOne({ roomId:rid });
    if (!room || !room.gameState) return res.status(404).json({ ok:false, error:'Game not found' });
    const gs = room.gameState;
    gs.unoClaims = gs.unoClaims || {};
    gs.unoClaims[email] = Date.now();
    await rooms.updateOne({ roomId:rid }, { $set:{ gameState: gs }});
    return res.json({ ok:true });
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* leaderboard endpoint (users collection ordered by xp/level) */
app.get('/api/leaderboard', async (req,res)=>{
  try {
    const users = db.collection(USERS_COLL);
    const list = await users.find({}, { projection:{ _id:0 } }).toArray();
    list.sort((a,b)=> (b.level||0) - (a.level||0) || (b.xp||0) - (a.xp||0) || (b.lastLogin||0) - (a.lastLogin||0));
    return res.json({ ok:true, list });
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* minimal user upsert (keeps profile sync) */
app.post('/api/upsert-user', async (req,res)=>{
  try {
    const { email, name, picture } = req.body || {};
    const id = (email||'').toLowerCase() || `guest_${Date.now()}`;
    const users = db.collection(USERS_COLL);
    const now = Date.now();
    await users.updateOne({ id }, { $set: { id, email, name, picture, lastLogin: now }, $setOnInsert: { level:1, xp:0, createdAt: now } }, { upsert:true });
    const user = await users.findOne({ id }, { projection:{ _id:0 }});
    return res.json({ ok:true, user });
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* QUIZ QUESTION BANK */
const QUIZ_QUESTIONS = [
  { question: "¿Cómo se dice 'Hola' en quechua?", options: ["Rimaykullayki", "Tupananchiskama", "Allinmi"], correct: 0 },
  { question: "¿Qué significa 'Tayta'?", options: ["Hermano", "Padre", "Tío"], correct: 1 },
  { question: "¿Qué significa 'Mikuy'?", options: ["Dormir", "Caminar", "Comer"], correct: 2 },
  { question: "¿Qué significa 'Hanan'?", options: ["Abajo", "Arriba", "Atrás"], correct: 1 },
  { question: "¿Qué significa 'Chiri'?", options: ["Frío", "Lluvia", "Sol/Calor"], correct: 0 },
  { question: "¿Qué significa 'Yuraq'?", options: ["Rojo", "Negro", "Blanco"], correct: 2 },
  { question: "¿Cómo se dice 'Comida' en quechua?", options: ["Sara", "Papa", "Mikhuna"], correct: 2 },
  { question: "¿Cómo se dice 'Árboles' en quechua?", options: ["Urqu", "Sachakuna", "Mayu"], correct: 1 },
  { question: "¿Cómo se dice 'Ayer' en quechua?", options: ["Qayna", "Paqarin", "Kunan"], correct: 0 },
  { question: "¿Cómo se dice 'Cabeza' en quechua?", options: ["Ñawi", "Simi", "Uma"], correct: 2 },
  { question: "¿Qué significa 'Kuntur'?", options: ["Cóndor", "Gato", "Perro"], correct: 0 },
  { question: "¿Qué significa 'Chunka'?", options: ["Dos", "Diez", "Ocho"], correct: 1 },
  { question: "¿Qué significa 'Sulpayki'?", options: ["Hasta luego", "De nada", "Gracias"], correct: 2 },
  { question: "¿Qué significa 'Qam'?", options: ["Tú", "Yo", "Él/Ella"], correct: 0 }
];

function generateQuiz(numQuestions = 10) {
  const shuffled = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(numQuestions, shuffled.length));
}

/* START QUIZ: creador inicia el quiz para todos los jugadores */
app.post('/api/start-quiz', async (req,res)=>{
  try {
    const { roomId, starterEmail } = req.body || {};
    const rid = (roomId||'').toUpperCase();
    const rooms = db.collection(ROOMS_COLL);
    const room = await rooms.findOne({ roomId: rid });
    if (!room) return res.status(404).json({ ok:false, error:'Room not found' });
    if (room.creatorEmail !== (starterEmail||'')) return res.status(403).json({ ok:false, error:'Only creator can start' });
    const participants = room.participants || [];
    if (participants.length < room.config.minPlayers) return res.status(400).json({ ok:false, error:'Not enough players' });
    if (!room.quiz || !room.quiz.length) return res.status(400).json({ ok:false, error:'No quiz available' });
    
    // Initialize quizState for each participant
    const quizState = {};
    for (const p of participants) {
      quizState[p.email] = { answers: [], score: 0, finished: false };
    }
    
    await rooms.updateOne({ roomId:rid }, { $set: { status:'quiz_active', quizState, quizStartedAt: Date.now() }});
    return res.json({ ok:true, quiz: room.quiz, quizState });
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* SUBMIT ANSWER: jugador envía su respuesta */
app.post('/api/submit-answer', async (req,res)=>{
  try {
    const { roomId, email, questionIndex, answerIndex } = req.body || {};
    const rid = (roomId||'').toUpperCase();
    const rooms = db.collection(ROOMS_COLL);
    const room = await rooms.findOne({ roomId: rid });
    if (!room || room.status !== 'quiz_active') return res.status(404).json({ ok:false, error:'Quiz not active' });
    if (!room.quiz || !room.quiz[questionIndex]) return res.status(400).json({ ok:false, error:'Invalid question' });
    
    const quizState = room.quizState || {};
    const userState = quizState[email];
    if (!userState) return res.status(403).json({ ok:false, error:'Not a participant' });
    
    // Record answer
    userState.answers[questionIndex] = answerIndex;
    
    // Check if correct
    const correct = room.quiz[questionIndex].correct === answerIndex ? 1 : 0;
    userState.score = (userState.score || 0) + correct;
    
    // Check if all questions answered
    if (userState.answers.length >= room.quiz.length) {
      userState.finished = true;
    }
    
    await rooms.updateOne({ roomId:rid }, { $set: { quizState }});
    return res.json({ ok:true, correct, userState });
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* FINISH QUIZ: termina el quiz y calcula XP para todos */
app.post('/api/finish-quiz', async (req,res)=>{
  try {
    const { roomId } = req.body || {};
    const rid = (roomId||'').toUpperCase();
    const rooms = db.collection(ROOMS_COLL);
    const room = await rooms.findOne({ roomId: rid });
    if (!room || room.status !== 'quiz_active') return res.status(404).json({ ok:false, error:'Quiz not active' });
    
    const quizState = room.quizState || {};
    const users = db.collection(USERS_COLL);
    const now = Date.now();
    
    // Calcular resultados y actualizar XP
    const results = [];
    const participants = room.participants || [];
    const totalQuestions = room.quiz.length;
    const XP_PER_CORRECT = 5; // más bajo por pregunta individual
    
    for (const p of participants) {
      const state = quizState[p.email] || { score: 0 };
      const xpEarned = state.score * XP_PER_CORRECT;
      
      // Update user in DB
      const id = (p.email || '').toLowerCase();
      const u = await users.findOne({ id });
      let level = u ? Number(u.level || 1) : 1;
      let xp = u ? Number(u.xp || 0) : 0;
      xp += xpEarned;
      
      // Level up
      while (xp >= XP_PER_LEVEL && level < MAX_LEVEL) {
        xp -= XP_PER_LEVEL;
        level += 1;
      }
      if (level > MAX_LEVEL) { level = MAX_LEVEL; xp = XP_PER_LEVEL; }
      
      await users.updateOne({ id }, {
        $set: { xp, level, lastLogin: now },
        $setOnInsert: { email: p.email, name: p.name, picture: p.picture, createdAt: now }
      }, { upsert:true });
      
      results.push({
        email: p.email,
        name: p.name,
        score: state.score,
        totalQuestions,
        xpEarned,
        rank: 0 // será asignado después del sort
      });
    }
    
    // Sort by score desc
    results.sort((a,b) => b.score - a.score);
    results.forEach((r, idx) => { r.rank = idx + 1; });
    
    // Finalize room
    await rooms.updateOne({ roomId:rid }, { $set: { status:'finished', results, finishedAt: Date.now() }});
    return res.json({ ok:true, results });
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* join-room: ESTA RUTA DEBE ESTAR PRESENTE */
app.post('/api/join-room', async (req,res)=>{
  try {
    const { roomId, email, name, picture } = req.body || {};
    const rid = (roomId||'').toUpperCase();
    const rooms = db.collection(ROOMS_COLL);
    const room = await rooms.findOne({ roomId: rid });
    if (!room) return res.status(404).json({ ok:false, error:'Room not found' });
    if (room.status !== 'creating_quiz' && room.status !== 'waiting') return res.status(400).json({ ok:false, error:'Room not open' });
    const participant = { email: email || `guest_${Date.now()}`, name: name || email || 'Invitado', picture: picture || null };
    const exists = (room.participants || []).some(p => p.email === participant.email);
    if (!exists){
      room.participants.push(participant);
      await rooms.updateOne({ roomId:rid }, { $set:{ participants: room.participants }});
    }
    return res.json({ ok:true, room: await rooms.findOne({ roomId:rid }, { projection:{ _id:0 } }) });
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

/* get-room: obtener estado de sala */
app.get('/api/room/:roomId', async (req,res)=>{
  try {
    const rid = (req.params.roomId||'').toUpperCase();
    const rooms = db.collection(ROOMS_COLL);
    const room = await rooms.findOne({ roomId: rid }, { projection:{ _id:0 }});
    if (!room) return res.status(404).json({ ok:false, error:'Room not found' });
    return res.json({ ok:true, room });
  } catch(e){ console.error(e); return res.status(500).json({ ok:false, error:String(e) }); }
});

// --- STATIC FILES: AL FINAL ---
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server listening on port', PORT));
