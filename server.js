const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const CHAT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- persistence ----------
function defaultState() {
  return { round: 1, members: [], locked: false, lockedAt: null, pairs: [], unmatchedIds: [], deadlockAt: null, chats: {} };
}
function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return defaultState();
  }
}
function saveData(state) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

// ---------- matching logic ----------
const DIMS = ['social', 'planning', 'love', 'conflict', 'family', 'adventure'];

function getSunSign(dob) {
  const d = new Date(dob + 'T00:00:00');
  const m = d.getMonth() + 1, day = d.getDate();
  const R = [
    ['Capricorn', 1, 1, 1, 19], ['Aquarius', 1, 20, 2, 18], ['Pisces', 2, 19, 3, 20],
    ['Aries', 3, 21, 4, 19], ['Taurus', 4, 20, 5, 20], ['Gemini', 5, 21, 6, 20],
    ['Cancer', 6, 21, 7, 22], ['Leo', 7, 23, 8, 22], ['Virgo', 8, 23, 9, 22],
    ['Libra', 9, 23, 10, 22], ['Scorpio', 10, 23, 11, 21], ['Sagittarius', 11, 22, 12, 21],
    ['Capricorn', 12, 22, 12, 31]
  ];
  for (const [sign, m1, d1, m2, d2] of R) {
    if ((m === m1 && day >= d1) || (m === m2 && day <= d2)) return sign;
  }
  return 'Capricorn';
}

const ELEMENT = {
  Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire',
  Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth',
  Gemini: 'Air', Libra: 'Air', Aquarius: 'Air',
  Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water'
};
const ELEM_COMPAT = {
  Fire: { Fire: 90, Air: 85, Earth: 45, Water: 40 },
  Earth: { Earth: 88, Water: 82, Fire: 45, Air: 42 },
  Air: { Air: 86, Fire: 85, Water: 44, Earth: 42 },
  Water: { Water: 90, Earth: 82, Air: 44, Fire: 40 }
};

function scorePair(w, m) {
  let diffSum = 0;
  DIMS.forEach(d => { diffSum += Math.abs((w.scores[d] || 0) - (m.scores[d] || 0)); });
  const behavior = Math.max(0, 1 - diffSum / 24) * 100;
  let matches = 0;
  ['smoking', 'drinking', 'diet', 'goal', 'vibeElement'].forEach(f => { if (w[f] === m[f]) matches++; });
  const habits = (matches / 5) * 100;
  const ew = ELEMENT[w.sunSign], em = ELEMENT[m.sunSign];
  const sun = (ELEM_COMPAT[ew] && ELEM_COMPAT[ew][em]) || 50;
  const total = 0.45 * behavior + 0.25 * habits + 0.30 * sun;
  return { total: Math.round(total), behavior: Math.round(behavior), habits: Math.round(habits), sun: Math.round(sun), ew, em };
}

function whyMatch(p, w, m) {
  const closest = DIMS.reduce((best, d) => {
    const diff = Math.abs((w.scores[d] || 0) - (m.scores[d] || 0));
    return diff < best.diff ? { dim: d, diff } : best;
  }, { dim: DIMS[0], diff: 99 }).dim;
  const dimLabel = {
    social: 'social energy', planning: 'planning style', love: 'how you show love',
    conflict: 'conflict style', family: 'closeness to family', adventure: 'sense of adventure'
  }[closest];
  const shared = [];
  if (w.diet === m.diet) shared.push('diet (' + w.diet + ')');
  if (w.goal === m.goal) shared.push('what you both want next');
  if (w.smoking === m.smoking) shared.push('smoking habits');
  if (w.drinking === m.drinking) shared.push('drinking habits');
  if (w.vibeElement === m.vibeElement) shared.push(`a ${w.vibeElement.toLowerCase()} energy`);
  const sharedText = shared.length ? shared.join(', ') : 'a few smaller habits';
  return `${w.sunSign} (${p.ew}) and ${m.sunSign} (${p.em}) tend to move at a similar rhythm. `
    + `You two lined up closest on ${dimLabel}, and you're aligned on ${sharedText}. `
    + `Behavior fit ${p.behavior}%, shared habits ${p.habits}%, sun-sign fit ${p.sun}%.`;
}

function computeMatches(members) {
  const women = members.filter(x => x.gender === 'Woman' && x.status === 'complete');
  const men = members.filter(x => x.gender === 'Man' && x.status === 'complete');
  const membersById = {};
  members.forEach(m => membersById[m.id] = m);

  const all = [];
  women.forEach(w => men.forEach(m => {
    all.push({ womanId: w.id, manId: m.id, ...scorePair(w, m) });
  }));
  all.sort((a, b) => b.total - a.total);

  const claimed = new Set();
  const locked = [];
  all.forEach(p => {
    if (!claimed.has(p.womanId) && !claimed.has(p.manId)) {
      claimed.add(p.womanId); claimed.add(p.manId);
      const w = membersById[p.womanId], m = membersById[p.manId];
      locked.push({ ...p, why: whyMatch(p, w, m), womanName: w.name, manName: m.name });
    }
  });
  const unmatched = members.filter(x => x.status === 'complete' && !claimed.has(x.id)).map(x => x.id);
  return { pairs: locked, unmatched };
}

// ---------- auto-loop: reset if chat window has expired ----------
const DEADLOCK_GRACE_MS = 20 * 1000; // 20s to notice a full-but-unpairable lobby before wiping it

function checkAutoLoop(state) {
  if (state.locked && state.lockedAt && Date.now() > state.lockedAt + CHAT_WINDOW_MS) {
    const fresh = defaultState();
    fresh.round = (state.round || 1) + 1;
    saveData(fresh);
    return fresh;
  }
  if (state.deadlockAt && Date.now() > state.deadlockAt + DEADLOCK_GRACE_MS) {
    const fresh = defaultState();
    fresh.round = (state.round || 1) + 1;
    saveData(fresh);
    return fresh;
  }
  return state;
}

// ---------- auto-reveal: fires the instant the lobby has 10 finished profiles ----------
function checkAutoReveal(state) {
  if (state.locked) return state;
  const complete = state.members.filter(m => m.status === 'complete');
  if (state.members.length < 10 || complete.length < 10) {
    if (state.deadlockAt) { state.deadlockAt = null; saveData(state); }
    return state;
  }
  const women = complete.filter(m => m.gender === 'Woman').length;
  const men = complete.filter(m => m.gender === 'Man').length;
  if (women < 1 || men < 1) {
    if (!state.deadlockAt) { state.deadlockAt = Date.now(); saveData(state); }
    return state;
  }
  const { pairs, unmatched } = computeMatches(state.members);
  state.locked = true;
  state.lockedAt = Date.now();
  state.pairs = pairs;
  state.unmatchedIds = unmatched;
  state.deadlockAt = null;
  saveData(state);
  return state;
}

function genId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function chatKey(round, womanId, manId) {
  return 'r' + round + '_' + [womanId, manId].sort().join('_');
}

// ---------- routes ----------
app.get('/api/state', (req, res) => {
  let state = checkAutoReveal(checkAutoLoop(loadData()));
  res.json(publicState(state));
});

function publicState(state) {
  // don't leak internal chat storage in the general state payload
  const { chats, ...rest } = state;
  return rest;
}

app.post('/api/join', (req, res) => {
  let state = checkAutoLoop(loadData());
  if (state.locked) return res.status(409).json({ error: 'Round is locked. Wait for it to loop.' });
  if (state.members.length >= 10) return res.status(409).json({ error: 'This round is full.' });

  const { name, age, dob, gender } = req.body;
  if (!name || !age || !dob || !gender) return res.status(400).json({ error: 'Missing fields.' });
  if (parseInt(age) < 18) return res.status(400).json({ error: 'Must be 18 or older.' });
  if (!['Woman', 'Man'].includes(gender)) return res.status(400).json({ error: 'Invalid gender.' });

  const id = genId();
  const member = {
    id, name: String(name).slice(0, 60), age: parseInt(age), dob, gender,
    sunSign: getSunSign(dob), status: 'quiz', scores: {},
    smoking: null, drinking: null, diet: null, goal: null, vibeElement: null, idealPartner: '',
    joinedAt: Date.now()
  };
  state.members.push(member);
  saveData(state);
  res.json({ id, sunSign: member.sunSign, round: state.round });
});

app.post('/api/quiz', (req, res) => {
  let state = checkAutoLoop(loadData());
  if (state.locked) return res.status(409).json({ error: 'Round is locked.' });
  const { id, answers } = req.body;
  const member = state.members.find(m => m.id === id);
  if (!member) return res.status(404).json({ error: 'Member not found in this round.' });

  DIMS.forEach(d => { member.scores[d] = answers[d] ?? 0; });
  member.smoking = answers.smoking || null;
  member.drinking = answers.drinking || null;
  member.diet = answers.diet || null;
  member.goal = answers.goal || null;
  member.vibeElement = answers.vibeElement || null;
  member.idealPartner = (answers.idealPartner || '').slice(0, 500);
  member.status = 'complete';
  saveData(state);
  state = checkAutoReveal(state);
  res.json({ ok: true });
});

// Manual reveal is kept only as a fallback (e.g. testing with fewer than 10) —
// the normal path is checkAutoReveal firing on its own once the lobby is full.
app.post('/api/reveal', (req, res) => {
  let state = checkAutoReveal(checkAutoLoop(loadData()));
  if (state.locked) return res.json(publicState(state));
  const complete = state.members.filter(m => m.status === 'complete');
  const women = complete.filter(m => m.gender === 'Woman').length;
  const men = complete.filter(m => m.gender === 'Man').length;
  if (women < 1 || men < 1) return res.status(409).json({ error: 'Need at least one woman and one man.' });

  const { pairs, unmatched } = computeMatches(state.members);
  state.locked = true;
  state.lockedAt = Date.now();
  state.pairs = pairs;
  state.unmatchedIds = unmatched;
  saveData(state);
  res.json(publicState(state));
});

app.post('/api/leave', (req, res) => {
  let state = checkAutoLoop(loadData());
  if (state.locked) return res.status(409).json({ error: 'Round already locked.' });
  const { id } = req.body;
  state.members = state.members.filter(m => m.id !== id);
  saveData(state);
  res.json({ ok: true });
});

app.get('/api/chat/:woman/:man', (req, res) => {
  let state = checkAutoLoop(loadData());
  const key = chatKey(state.round, req.params.woman, req.params.man);
  const chat = state.chats[key] || { messages: [] };
  const secsLeft = state.lockedAt ? Math.max(0, Math.round((state.lockedAt + CHAT_WINDOW_MS - Date.now()) / 1000)) : 0;
  res.json({ messages: chat.messages, secsLeft });
});

app.post('/api/chat/:woman/:man', (req, res) => {
  let state = checkAutoLoop(loadData());
  if (!state.locked) return res.status(409).json({ error: 'No active match.' });
  if (Date.now() > state.lockedAt + CHAT_WINDOW_MS) return res.status(409).json({ error: 'Chat window closed.' });

  const { sender, senderName, text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty message.' });
  const key = chatKey(state.round, req.params.woman, req.params.man);
  if (!state.chats[key]) state.chats[key] = { messages: [] };
  state.chats[key].messages.push({ sender, senderName: String(senderName || 'Someone').slice(0, 40), text: String(text).slice(0, 500), ts: Date.now() });
  saveData(state);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Circle running at http://localhost:${PORT}`);
});
