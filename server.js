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

// ---------- AI Setup (Gemini / Claude) ----------
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || null;
const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function callClaude(system, userPrompt, maxTokens) {
  if (!ANTHROPIC_API_KEY) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });
  if (!res.ok) throw new Error('Anthropic API error ' + res.status);
  const data = await res.json();
  const block = (data.content || []).find(b => b.type === 'text');
  return block ? block.text : null;
}

async function callGemini(system, userPrompt, maxTokens, jsonMode) {
  if (!GEMINI_API_KEY) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {})
    }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Gemini API error ' + res.status);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callAI(system, userPrompt, maxTokens, jsonMode) {
  if (ANTHROPIC_API_KEY) {
    try { const r = await callClaude(system, userPrompt, maxTokens); if (r) return r; }
    catch (e) { console.error('callClaude failed:', e.message); }
  }
  if (GEMINI_API_KEY) {
    try { const r = await callGemini(system, userPrompt, maxTokens, jsonMode); if (r) return r; }
    catch (e) { console.error('callGemini failed:', e.message); }
  }
  return null;
}

// ---------- Astrology Helpers ----------
const SIGN_ELEMENTS = {
  Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire',
  Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth',
  Gemini: 'Air', Libra: 'Air', Aquarius: 'Air',
  Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water'
};

function calculateSunSign(dobStr) {
  if (!dobStr) return 'Aries';
  const d = new Date(dobStr);
  if (isNaN(d.getTime())) return 'Aries';
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if ((month == 3 && day >= 21) || (month == 4 && day <= 19)) return 'Aries';
  if ((month == 4 && day >= 20) || (month == 5 && day <= 20)) return 'Taurus';
  if ((month == 5 && day >= 21) || (month == 6 && day <= 20)) return 'Gemini';
  if ((month == 6 && day >= 21) || (month == 7 && day <= 22)) return 'Cancer';
  if ((month == 7 && day >= 23) || (month == 8 && day <= 22)) return 'Leo';
  if ((month == 8 && day >= 23) || (month == 9 && day <= 22)) return 'Virgo';
  if ((month == 9 && day >= 23) || (month == 10 && day <= 22)) return 'Libra';
  if ((month == 10 && day >= 23) || (month == 11 && day <= 21)) return 'Scorpio';
  if ((month == 11 && day >= 22) || (month == 12 && day <= 21)) return 'Sagittarius';
  if ((month == 12 && day >= 22) || (month == 1 && day <= 19)) return 'Capricorn';
  if ((month == 1 && day >= 20) || (month == 2 && day <= 18)) return 'Aquarius';
  return 'Pisces';
}

function computeAstroSynastry(signA, signB) {
  const elemA = SIGN_ELEMENTS[signA] || 'Fire';
  const elemB = SIGN_ELEMENTS[signB] || 'Fire';
  if (elemA === elemB) return { score: 1.0, title: 'Cosmic Soul Elements' };
  if ((elemA === 'Fire' && elemB === 'Air') || (elemA === 'Air' && elemB === 'Fire')) return { score: 0.95, title: 'Dynamic & Inspiring Spark' };
  if ((elemA === 'Earth' && elemB === 'Water') || (elemA === 'Water' && elemB === 'Earth')) return { score: 0.95, title: 'Deep & Grounding Harmony' };
  return { score: 0.75, title: 'Balanced Complementary Energies' };
}

// ---------- Persistence ----------
function defaultState() {
  return { round: 1, members: [], locked: false, pairs: [], chats: {} };
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const init = defaultState();
      fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2));
      return init;
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return defaultState();
  }
}

function saveData(state) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function chatKey(round, wId, mId) {
  return `${round}:${wId}:${mId}`;
}

function checkAutoLoop(state) {
  if (!state.locked || !state.pairs || state.pairs.length === 0) return state;

  const now = Date.now();
  let allFinished = true;

  state.pairs.forEach(pair => {
    const key = chatKey(state.round, pair.womanId, pair.manId);
    const chat = state.chats[key];
    if (chat && chat.startedAt) {
      if (now < chat.startedAt + CHAT_WINDOW_MS) {
        allFinished = false;
      }
    } else {
      allFinished = false;
    }
  });

  if (allFinished && state.pairs.length > 0) {
    console.log(`All active chats finished for Round ${state.round}. Resetting Circle...`);
    state = { round: state.round + 1, members: [], locked: false, pairs: [], chats: {} };
    saveData(state);
  }

  return state;
}

// ---------- Multi-Factor Matchmaking Scoring ----------
function scorePair(w, m) {
  let sc = 0;
  const wAns = w.answers || {};
  const mAns = m.answers || {};

  // 1. Cross Match: Self vs Partner Expectations (35%)
  if (wAns.myLook === mAns.partnerLook) sc += 8.75;
  if (mAns.myLook === wAns.partnerLook) sc += 8.75;
  if (wAns.selfVibe === mAns.partnerVibe) sc += 8.75;
  if (mAns.selfVibe === wAns.partnerVibe) sc += 8.75;

  // 2. Behavioral & Emotional Alignment (30%)
  if (wAns.conflictStyle === mAns.conflictStyle) sc += 10;
  if (wAns.loveLanguage === mAns.loveLanguage) sc += 10;
  if (wAns.intention === mAns.intention) sc += 10;

  // 3. Cultural & Regional Scenario Alignment (20%)
  if (w.state && m.state && w.state.toLowerCase() === m.state.toLowerCase()) sc += 10;
  if (wAns.foodPreference === mAns.foodPreference) sc += 5;
  if (wAns.cinemaVibe === mAns.cinemaVibe) sc += 5;

  // 4. Zodiac Synastry (15%)
  const astro = computeAstroSynastry(w.sunSign, m.sunSign);
  sc += astro.score * 15;

  return Math.min(99, Math.round(sc));
}

async function aiWhyMatch(w, m, score) {
  const prompt = `Write a warm, authentic 2-sentence match breakdown for a couple.
Woman: ${w.name} from ${w.state \vert{}\vert{} 'India'} (Sun Sign:${w.sunSign}).
Man: ${m.name} from ${m.state \vert{}\vert{} 'India'} (Sun Sign:${m.sunSign}).
Score: ${score}%.
Explain why their physical preferences, emotional compatibility, and regional energy make them a high-trust match.`;

  const aiText = await callAI("You are a warm, cultural cosmic matchmaker.", prompt, 150, false);
  return aiText || `${w.name} (${w.sunSign}) and${m.name} (${m.sunSign}) hit a high${score}% match with strong physical, emotional, and cultural harmony!`;
}

// ---------- Routes ----------
app.post('/api/ai-questions', async (req, res) => {
  const { userState } = req.body;
  const prompt = `Generate 2 Tanglish/Tamil-vibe real-world scenario questions for someone in "${userState || 'Tamil Nadu'}".
Focus on food debates (Biriyani vs Parotta), monsoon coffee/bajjis, or long ECR drives.
Return JSON array format:
[
  {
    "key": "dynamicTanglishScenario",
    "emoji": "☕",
    "title": "Local Vibe Check",
    "question": "Scenario text...",
    "opts": ["Option A", "Option B", "Option C", "Option D"]
  }
]`;

  try {
    const raw = await callAI("You are a dynamic prompt generator. Return JSON array only.", prompt, 350, true);
    if (raw) {
      const parsed = JSON.parse(raw.trim());
      return res.json({ questions: parsed });
    }
  } catch (e) {}

  // Fallback static Tanglish questions
  res.json({
    questions: [
      {
        key: 'foodPreference',
        emoji: '🍛',
        title: 'Foodie Connection',
        question: 'Namma ooroda classic weekend food debate! What is your absolute non-negotiable favorite?',
        opts: [
          'ECR Parotta & Pepper Chicken gravy!',
          'Authentic Ambur / Dindigul Biriyani.',
          'Simple Home-cooked Sambar & Potato fry.',
          'Modern Café food (Burgers & Pasta).'
        ]
      }
    ]
  });
});

app.get('/api/state', (req, res) => {
  let state = checkAutoLoop(loadData());
  res.json({
    round: state.round,
    count: state.members.length,
    womenCount: state.members.filter(m => m.gender === 'woman').length,
    menCount: state.members.filter(m => m.gender === 'man').length,
    locked: state.locked,
    members: state.members.map(m => ({ id: m.id, name: m.name, gender: m.gender, sunSign: m.sunSign, state: m.state, lastSeen: m.lastSeen })),
    pairs: state.pairs.map(p => ({ womanId: p.womanId, manId: p.manId, score: p.score, why: p.why, astroTitle: p.astroTitle }))
  });
});

app.post('/api/heartbeat', (req, res) => {
  let state = loadData();
  const { memberId } = req.body;
  const mem = state.members.find(m => m.id === memberId);
  if (mem) {
    mem.lastSeen = Date.now();
    saveData(state);
  }
  res.json({ success: true });
});

app.post('/api/join', (req, res) => {
  let state = checkAutoLoop(loadData());
  if (state.locked) return res.status(409).json({ error: 'Circle is locked.' });

  const { id, name, dob, gender, userState, answers } = req.body;
  if (!name || !dob || !gender) return res.status(400).json({ error: 'Missing core details.' });

  const memberId = id || ('mem_' + Math.random().toString(36).slice(2, 9));
  const sunSign = calculateSunSign(dob);

  const existingIdx = state.members.findIndex(m => m.id === memberId);
  const memberObj = { id: memberId, name, dob, gender, state: userState || 'Tamil Nadu', sunSign, answers: answers || {}, lastSeen: Date.now() };

  if (existingIdx >= 0) {
    state.members[existingIdx] = memberObj;
  } else {
    state.members.push(memberObj);
  }

  saveData(state);
  res.json({ success: true, memberId, sunSign });
});

app.post('/api/reveal', async (req, res) => {
  let state = checkAutoLoop(loadData());
  if (state.locked) return res.json({ success: true, alreadyLocked: true });

  const women = state.members.filter(m => m.gender === 'woman');
  const men = state.members.filter(m => m.gender === 'man');

  if (women.length === 0 || men.length === 0) {
    return res.status(400).json({ error: 'Need at least one woman and one man.' });
  }

  const candidates = [];
  women.forEach(w => {
    men.forEach(m => {
      candidates.push({ woman: w, man: m, score: scorePair(w, m) });
    });
  });

  candidates.sort((a, b) => b.score - a.score);

  const matchedW = new Set();
  const matchedM = new Set();
  const pairs = [];

  for (const c of candidates) {
    if (!matchedW.has(c.woman.id) && !matchedM.has(c.man.id)) {
      matchedW.add(c.woman.id);
      matchedM.add(c.man.id);
      const astroInfo = computeAstroSynastry(c.woman.sunSign, c.man.sunSign);
      const why = await aiWhyMatch(c.woman, c.man, c.score);
      pairs.push({
        womanId: c.woman.id,
        manId: c.man.id,
        score: c.score,
        astroTitle: astroInfo.title,
        why
      });
    }
  }

  state.pairs = pairs;
  state.locked = true;
  saveData(state);

  res.json({ success: true, count: pairs.length });
});

app.get('/api/chat/:woman/:man', (req, res) => {
  let state = checkAutoLoop(loadData());
  const key = chatKey(state.round, req.params.woman, req.params.man);
  const chat = state.chats[key] || { messages: [], startedAt: null };

  const wMem = state.members.find(m => m.id === req.params.woman);
  const mMem = state.members.find(m => m.id === req.params.man);
  const now = Date.now();

  const wOnline = wMem && wMem.lastSeen && (now - wMem.lastSeen < 12000);
  const mOnline = mMem && mMem.lastSeen && (now - mMem.lastSeen < 12000);
  const bothOnline = wOnline && mOnline;

  if (bothOnline && !chat.startedAt) {
    chat.startedAt = now;
    state.chats[key] = chat;
    saveData(state);
  }

  let secsLeft = CHAT_WINDOW_MS / 1000;
  if (chat.startedAt) {
    secsLeft = Math.max(0, Math.round((chat.startedAt + CHAT_WINDOW_MS - now) / 1000));
  }

  res.json({ messages: chat.messages, bothOnline, wOnline, mOnline, started: !!chat.startedAt, secsLeft });
});

app.post('/api/chat/:woman/:man', (req, res) => {
  let state = checkAutoLoop(loadData());
  if (!state.locked) return res.status(409).json({ error: 'No active match.' });

  const { sender, senderName, text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty message.' });

  const key = chatKey(state.round, req.params.woman, req.params.man);
  if (!state.chats[key]) state.chats[key] = { messages: [], startedAt: null };

  state.chats[key].messages.push({
    sender,
    senderName,
    text: text.trim(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  saveData(state);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`The Circle backend running on port ${PORT}`));
