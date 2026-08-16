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

// ---------- AI (optional) ----------
// Set ANTHROPIC_API_KEY (paid) or GEMINI_API_KEY (free tier) as an
// environment variable to enable this. If neither is set, or any call
// fails, everything falls back to the static local logic below — the app
// never breaks because of this. If both are set, Anthropic is used first.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || null;
const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function callClaude(system, userPrompt, maxTokens) {
  if (!ANTHROPIC_API_KEY) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens || 300,
      system,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`Claude API error (${res.status}):`, errText);
    return null;
  }
  const data = await res.json();
  const textBlock = data.content && data.content.find(c => c.type === 'text');
  return textBlock ? textBlock.text.trim() : null;
}

async function callGemini(system, userPrompt, maxTokens) {
  if (!GEMINI_API_KEY) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: maxTokens || 300 }
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`Gemini API error (${res.status}):`, errText);
    return null;
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? text.trim() : null;
}

async function callAI(system, userPrompt, maxTokens, jsonMode = false) {
  let prompt = userPrompt;
  if (jsonMode) {
    prompt += '\n\nIMPORTANT: Output strictly raw valid JSON. No markdown code blocks, no trailing commas, no explanatory text outside the JSON.';
  }
  let out = await callClaude(system, prompt, maxTokens);
  if (!out) out = await callGemini(system, prompt, maxTokens);
  if (!out) return null;

  if (jsonMode) {
    out = out.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  return out;
}

// ---------- DATA PERSISTENCE ----------
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load data, starting fresh:', e.message);
  }
  return { round: 1, members: [], locked: false, lockedAt: null, pairs: [], chats: {} };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save data:', e.message);
  }
}

// Auto-loop checking logic
function checkAutoLoop(state) {
  if (state.locked && state.lockedAt) {
    const elapsed = Date.now() - state.lockedAt;
    if (elapsed > CHAT_WINDOW_MS) {
      console.log(`[Auto-Loop] Round ${state.round} ended after 2 mins. Starting Round ${state.round + 1}.`);
      state = {
        round: state.round + 1,
        members: [],
        locked: false,
        lockedAt: null,
        pairs: [],
        chats: {}
      };
      saveData(state);
    }
  }
  return state;
}

// ---------- ZODIAC / SYNASTRY UTILS ----------
function getSunSign(dobStr) {
  if (!dobStr) return 'Aries';
  const d = new Date(dobStr);
  if (isNaN(d.getTime())) return 'Aries';
  const month = d.getMonth() + 1;
  const day = d.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
  return 'Pisces';
}

function getElement(sign) {
  const map = {
    Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire',
    Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth',
    Gemini: 'Air', Libra: 'Air', Aquarius: 'Air',
    Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water'
  };
  return map[sign] || 'Air';
}

function scoreZodiac(sign1, sign2) {
  const e1 = getElement(sign1);
  const e2 = getElement(sign2);
  if (e1 === e2) return 100;
  if ((e1 === 'Fire' && e2 === 'Air') || (e1 === 'Air' && e2 === 'Fire')) return 90;
  if ((e1 === 'Earth' && e2 === 'Water') || (e1 === 'Water' && e2 === 'Earth')) return 90;
  return 70;
}

// ---------- MATCHMAKING MATRIX ENGINE ----------
function scorePair(w, m) {
  const keys = ['myLook', 'selfVibe', 'partnerLook', 'partnerVibe', 'conflictStyle', 'loveLanguage', 'intention'];
  let totalScore = 0;
  let matches = 0;

  keys.forEach(k => {
    if (w.answers && m.answers && w.answers[k] && m.answers[k]) {
      if (w.answers[k] === m.answers[k]) {
        totalScore += 100;
      } else {
        totalScore += 65;
      }
      matches++;
    }
  });

  const ansScore = matches > 0 ? totalScore / matches : 75;
  const zScore = scoreZodiac(w.sunSign, m.sunSign);

  return Math.round(ansScore * 0.7 + zScore * 0.3);
}

async function aiWhyMatch(w, m, score) {
  const prompt = `Write a warm, authentic 2-sentence match breakdown for a couple.
Woman: ${w.name} from ${w.state || 'India'} (Sun Sign: ${w.sunSign}).
Man: ${m.name} from ${m.state || 'India'} (Sun Sign: ${m.sunSign}).
Score: ${score}%.
Explain why their physical preferences, emotional compatibility, and regional energy make them a high-trust match.`;

  const aiText = await callAI("You are a warm, cultural cosmic matchmaker.", prompt, 150, false);
  return aiText || `${w.name} (${w.sunSign}) and ${m.name} (${m.sunSign}) hit a high ${score}% match with strong physical, emotional, and cultural harmony!`;
}

// ---------- API ENDPOINTS ----------

app.get('/api/state', (req, res) => {
  let state = checkAutoLoop(loadData());
  const womenCount = state.members.filter(m => m.gender === 'woman').length;
  const menCount = state.members.filter(m => m.gender === 'man').length;

  res.json({
    round: state.round,
    membersCount: state.members.length,
    womenCount,
    menCount,
    locked: state.locked,
    lockedAt: state.lockedAt,
    pairs: state.pairs,
    members: state.members.map(m => ({ id: m.id, name: m.name, gender: m.gender, sunSign: m.sunSign }))
  });
});

app.post('/api/heartbeat', (req, res) => {
  let state = checkAutoLoop(loadData());
  const { memberId } = req.body;
  if (memberId) {
    const m = state.members.find(mem => mem.id === memberId);
    if (m) {
      m.lastSeen = Date.now();
      saveData(state);
    }
  }
  res.json({ status: 'ok' });
});

app.post('/api/join', (req, res) => {
  let state = checkAutoLoop(loadData());
  if (state.locked) {
    return res.status(409).json({ error: 'This round is currently locked in 2-min chat mode. Please wait for auto-loop.' });
  }

  const { id, name, dob, gender, userState, answers } = req.body;
  if (!name || !dob || !gender) {
    return res.status(400).json({ error: 'Missing required profile fields.' });
  }

  const existingIdx = state.members.findIndex(m => m.id === id);
  const sunSign = getSunSign(dob);
  const memberData = {
    id: id || 'CIRC_' + Math.random().toString(36).substring(2, 7).toUpperCase(),
    name,
    dob,
    gender,
    state: userState || 'Tamil Nadu',
    sunSign,
    answers: answers || {},
    joinedAt: Date.now(),
    lastSeen: Date.now()
  };

  if (existingIdx >= 0) {
    state.members[existingIdx] = memberData;
  } else {
    state.members.push(memberData);
  }

  saveData(state);
  res.json({ success: true, member: memberData });
});

app.post('/api/ai-questions', async (req, res) => {
  const { userState } = req.body;
  const prompt = `Generate 2 unique cultural/relationship scenario questions customized for someone living in ${userState || 'India'}. Return a JSON array of objects with keys: key, emoji, title, question, opts (array of 4 options).`;

  const rawJson = await callAI("You are a localized relationship expert.", prompt, 500, true);
  let questions = null;

  if (rawJson) {
    try {
      questions = JSON.parse(rawJson);
    } catch (e) {
      console.error("AI Question parse error:", e);
    }
  }

  if (!questions || !Array.isArray(questions)) {
    questions = [
      {
        key: 'regionalVibe',
        emoji: '🌆',
        title: 'SET 4: Regional Connection',
        question: `How do you best connect with someone in ${userState || 'your state'}?`,
        opts: [
          'Shared local food dates & street food hunts.',
          'Long evening talks on life & future plans.',
          'Spontaneous weekend trips around the state.',
          'Quiet home-cooked meals & late-night chill.'
        ]
      }
    ];
  }

  res.json({ questions });
});

app.post('/api/reveal', async (req, res) => {
  let state = checkAutoLoop(loadData());
  if (state.locked) return res.json({ locked: true, pairs: state.pairs });

  const women = state.members.filter(m => m.gender === 'woman');
  const men = state.members.filter(m => m.gender === 'man');

  if (women.length === 0 || men.length === 0) {
    return res.status(400).json({ error: 'Need at least 1 woman and 1 man to reveal matches!' });
  }

  const candidates = [];
  for (const w of women) {
    for (const m of men) {
      candidates.push({ woman: w, man: m, score: scorePair(w, m) });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const matchedW = new Set();
  const matchedM = new Set();
  const pairs = [];

  for (const c of candidates) {
    if (!matchedW.has(c.woman.id) && !matchedM.has(c.man.id)) {
      matchedW.add(c.woman.id);
      matchedM.add(c.man.id);
      const why = await aiWhyMatch(c.woman, c.man, c.score);
      pairs.push({
        womanId: c.woman.id,
        manId: c.man.id,
        score: c.score,
        why,
        astroTitle: `${c.woman.name} (${c.woman.sunSign}) & ${c.man.name} (${c.man.sunSign})`
      });
    }
  }

  state.locked = true;
  state.lockedAt = Date.now();
  state.pairs = pairs;
  saveData(state);

  res.json({ locked: true, pairs });
});

function chatKey(round, wId, mId) {
  return `${round}_${wId}_${mId}`;
}

app.get('/api/chat/:woman/:man', (req, res) => {
  let state = checkAutoLoop(loadData());
  const wId = req.params.woman;
  const mId = req.params.man;
  const key = chatKey(state.round, wId, mId);
  const chat = state.chats[key] || { messages: [] };

  const w = state.members.find(m => m.id === wId);
  const m = state.members.find(m => m.id === mId);

  const now = Date.now();
  const wOnline = w && w.lastSeen && (now - w.lastSeen < 12000);
  const mOnline = m && m.lastSeen && (now - m.lastSeen < 12000);
  const started = !!(wOnline && mOnline);

  const secsLeft = state.lockedAt ? Math.max(0, Math.round((state.lockedAt + CHAT_WINDOW_MS - Date.now()) / 1000)) : 0;
  res.json({ messages: chat.messages, secsLeft, started });
});

app.post('/api/chat/:woman/:man', (req, res) => {
  let state = checkAutoLoop(loadData());
  if (!state.locked) return res.status(409).json({ error: 'No active match.' });
  if (Date.now() > state.lockedAt + CHAT_WINDOW_MS) return res.status(409).json({ error: 'Chat window closed.' });

  const { sender, senderName, text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty message.' });

  const key = chatKey(state.round, req.params.woman, req.params.man);
  if (!state.chats[key]) state.chats[key] = { messages: [] };

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  state.chats[key].messages.push({
    sender,
    senderName: senderName || 'User',
    text: text.trim(),
    time: timeStr,
    timestamp: Date.now()
  });

  saveData(state);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`The Circle engine listening at http://localhost:${PORT}`);
});
