const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const CHAT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
// How many people fill a round before it auto-locks. 10 was the original
// default but tends to take a while to fill in a small friend group — 6
// (e.g. 2 women + 4 men, or any mix) fills faster while still leaving room
// for more than one match per round. Override with CIRCLE_SIZE env var.
const CIRCLE_SIZE = parseInt(process.env.CIRCLE_SIZE || '6', 10);

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
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error('Anthropic API ' + res.status + ': ' + t.slice(0, 200));
  }
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
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error('Gemini API ' + res.status + ': ' + t.slice(0, 200));
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || null;
}

// Tries Anthropic first (if configured), then Gemini (if configured),
// then gives up and returns null so the caller can use its local fallback.
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

// ---------- trait dimensions (psychology-flavored, multiple choice) ----------
const DIMS = ['social', 'planning', 'love', 'conflict', 'family', 'adventure', 'trust', 'independence', 'humor'];
const DIM_LABELS = {
  social: 'social energy', planning: 'planning style', love: 'how they show love',
  conflict: 'conflict style', family: 'closeness to family', adventure: 'sense of adventure',
  trust: 'trust & openness', independence: 'independence vs. closeness', humor: 'humor style'
};

function answerSummary(a) {
  const lines = [];
  DIMS.forEach(d => { if (a[d] !== undefined) lines.push(`${DIM_LABELS[d]}: ${a[d]} (scale -2 to +2)`); });
  if (a.vibeElement) lines.push(`self-described element: ${a.vibeElement}`);
  if (a.partnerVibe) lines.push(`what they need from a partner when they're upset: ${a.partnerVibe}`);
  if (a.selfCharacter) lines.push(`self-described character: ${a.selfCharacter}`);
  if (a.height) lines.push(`height bracket: ${a.height}`);
  if (a.build) lines.push(`build: ${a.build}`);
  if (a.prefCharacter) lines.push(`character they're drawn to in a partner: ${a.prefCharacter}`);
  if (a.prefHairStyle) lines.push(`hair style they're drawn to in a partner: ${a.prefHairStyle}`);
  if (a.smoking) lines.push(`smoking: ${a.smoking}${a.smokingFollow ? ' (' + a.smokingFollow + ')' : ''}`);
  if (a.drinking) lines.push(`drinking: ${a.drinking}${a.drinkingFollow ? ' (' + a.drinkingFollow + ')' : ''}`);
  if (a.diet) lines.push(`diet: ${a.diet}`);
  if (a.goal) lines.push(`relationship goal: ${a.goal}`);
  return lines.join('\n');
}

const AI_QUESTION_SYSTEM = `You write ONE short multiple-choice question for a casual, lighthearted matchmaking quiz app used by adults.
Strict rules:
- This is entertainment/compatibility matching only — NOT a clinical, diagnostic, or therapeutic tool. Never reference mental health conditions, trauma, medical history, therapy, or anything invasive or sensitive.
- You will be given a list of everything this person has already answered. Your question must NOT restate, rephrase, or lightly reskin any trait already covered in that list (e.g. if "conflict style" is covered, do not ask another conflict-adjacent question). Pick a genuinely uncovered angle: emotional availability, independence vs closeness, ambition, jealousy, how they handle a partner's bad mood, money attitudes, how they apologize, what makes them feel taken for granted, how they handle boredom in a relationship, their non-negotiables.
- Ground it in a real, slightly funny, specific everyday scenario a person would actually recognize themselves in — not an abstract trait label. Think "perceptive, slightly nosy friend at brunch," not "personality test."
- Provide exactly 4 short first-person answer options, spanning a natural spectrum on that trait, written with personality (not flat/clinical phrasing).
- Respond with ONLY valid JSON, no markdown fences, no preamble: {"title": "...", "options": ["...", "...", "...", "..."]}`;

async function aiGenerateQuestion(answers) {
  if (!ANTHROPIC_API_KEY && !GEMINI_API_KEY) return null;
  try {
    const prompt = `Here's everything this person has already answered in this compatibility quiz — treat every trait below as COVERED, do not ask about any of them again in a new outfit:\n${answerSummary(answers)}\n\nWrite the next question now, on a genuinely new angle.`;
    const raw = await callAI(AI_QUESTION_SYSTEM, prompt, 300, true);
    if (!raw) return null;
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (!parsed.title || !Array.isArray(parsed.options) || parsed.options.length < 3) return null;
    return { title: String(parsed.title).slice(0, 200), options: parsed.options.slice(0, 5).map(o => String(o).slice(0, 120)) };
  } catch (e) {
    console.error('aiGenerateQuestion failed:', e.message);
    return null;
  }
}

const AI_WHY_SYSTEM = `You write a short, warm, genuinely insightful "why you might click" note for two people just matched in a casual astrology-flavored matchmaking app.
Strict rules:
- Entertainment framing only — never use clinical or diagnostic language, never mention mental health, therapy, or pathology of any kind.
- Do real astrological reasoning, not just naming the signs: say something specific about how THEIR two sun signs and elements interact (their classic dynamic, friction points, what makes it work), not a generic "you both vibe" line.
- Weave in one real psychological/behavioral observation from their scenario answer (what they need from a partner when upset) and how the other person's style does or doesn't naturally meet that.
- Reference at least one concrete shared trait or answer, not just categories.
- 3-5 sentences, second person ("you two..."), warm, a little funny, specific — never generic filler that could apply to any pair.
- Respond with ONLY the note text. No JSON, no preamble, no surrounding quotation marks.`;

async function aiWhyMatch(p, w, m) {
  if (!ANTHROPIC_API_KEY && !GEMINI_API_KEY) return null;
  try {
    let prompt = `Person A (${w.gender}): sun sign ${w.sunSign} (${p.ew}), element self-description ${w.vibeElement || 'n/a'}, character ${w.selfCharacter || 'n/a'}, relationship goal ${w.goal}, diet ${w.diet}.\n`;
    if (w.partnerVibe) prompt += `When upset, they need a partner to: "${w.partnerVibe}".\n`;
    if (w.aiFollowupQuestion) prompt += `They were asked: "${w.aiFollowupQuestion}" and answered: "${w.aiFollowupAnswer}".\n`;
    prompt += `Person B (${m.gender}): sun sign ${m.sunSign} (${p.em}), element self-description ${m.vibeElement || 'n/a'}, character ${m.selfCharacter || 'n/a'}, relationship goal ${m.goal}, diet ${m.diet}.\n`;
    if (m.partnerVibe) prompt += `When upset, they need a partner to: "${m.partnerVibe}".\n`;
    if (m.aiFollowupQuestion) prompt += `They were asked: "${m.aiFollowupQuestion}" and answered: "${m.aiFollowupAnswer}".\n`;
    prompt += `Compatibility breakdown: behavior fit ${p.behavior}%, shared habits ${p.habits}%, sun-sign fit ${p.sun}%, preference fit ${p.pref}%, overall ${p.total}%.\nWrite the note now.`;
    const raw = await callAI(AI_WHY_SYSTEM, prompt, 220, false);
    return raw ? raw.trim().slice(0, 600) : null;
  } catch (e) {
    console.error('aiWhyMatch failed:', e.message);
    return null;
  }
}

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

// A "no preference" answer still gets partial credit (someone who says they
// don't mind shouldn't be treated as a mismatch), an exact match gets full
// credit, anything else gets none.
function prefCredit(pref, actual) {
  if (!pref || pref === 'No preference') return 0.75;
  if (!actual) return 0.5;
  return pref === actual ? 1 : 0;
}
function oneWayPrefScore(pref, actual) {
  const items = [
    prefCredit(pref.prefHeight, actual.height),
    prefCredit(pref.prefBuild, actual.build),
    prefCredit(pref.prefHairStyle, actual.hairStyle),
    prefCredit(pref.prefCharacter, actual.selfCharacter)
  ];
  return (items.reduce((a, b) => a + b, 0) / items.length) * 100;
}

function scorePair(w, m) {
  let diffSum = 0;
  DIMS.forEach(d => { diffSum += Math.abs((w.scores[d] || 0) - (m.scores[d] || 0)); });
  const behavior = Math.max(0, 1 - diffSum / (DIMS.length * 4)) * 100;

  let matches = 0;
  ['smoking', 'drinking', 'diet', 'goal', 'vibeElement'].forEach(f => { if (w[f] === m[f]) matches++; });
  const habits = (matches / 5) * 100;

  const ew = ELEMENT[w.sunSign], em = ELEMENT[m.sunSign];
  const sun = (ELEM_COMPAT[ew] && ELEM_COMPAT[ew][em]) || 50;

  const prefWtoM = oneWayPrefScore(w, m);
  const prefMtoW = oneWayPrefScore(m, w);
  const pref = (prefWtoM + prefMtoW) / 2;

  const total = 0.35 * behavior + 0.20 * habits + 0.25 * sun + 0.20 * pref;
  return {
    total: Math.round(total), behavior: Math.round(behavior), habits: Math.round(habits),
    sun: Math.round(sun), pref: Math.round(pref), ew, em
  };
}

// Real (if simplified) astrological reasoning by element pair — used any
// time there's no AI key configured, so the "analysis" never degrades into
// generic filler just because the optional AI call isn't available.
const ELEMENT_PAIR_BLURB = {
  'Fire-Fire': 'Two Fire signs together is a lot of momentum in one room — you\'ll rarely run out of things to do, just watch that you\'re not both too stubborn to go first and apologize.',
  'Fire-Air': 'A classic pairing — Air feeds Fire\'s flame instead of smothering it. Expect fast chemistry and a relationship that rarely goes quiet.',
  'Fire-Earth': 'Fire brings the momentum, Earth brings the follow-through. It works when Fire slows down enough for Earth to catch up, and Earth loosens up enough to keep pace.',
  'Fire-Water': 'Passionate, but it takes real care — Fire can overwhelm Water, and Water can put Fire out if either one stops paying attention to the other\'s pace.',
  'Earth-Earth': 'Two Earth signs is about as steady as it gets — loyal, low-drama, building something real. The risk is getting so comfortable that spontaneity quietly disappears.',
  'Earth-Water': 'One of astrology\'s more naturally nurturing combinations — Earth gives Water a bank to flow inside of, Water keeps Earth from getting too rigid.',
  'Earth-Air': 'Grounded meets breezy. Earth wants a plan, Air wants to see where the day goes — genuinely good if both sides bend a little instead of digging in.',
  'Water-Water': 'Deep emotional current between you two — very intuitive, but also capable of spiraling together if neither one plays anchor on a hard day.',
  'Water-Air': 'Feeling meets thinking. Air can help Water name what they\'re feeling instead of drowning in it; Water can help Air actually sit with a feeling instead of just discussing it.',
  'Air-Air': 'Great conversation, easy chemistry, never a dull exchange — just keep an eye on whether talking about plans quietly replaces actually making them.'
};
function elementPairBlurb(ew, em) {
  const key = ew < em ? `${ew}-${em}` : `${em}-${ew}`;
  return ELEMENT_PAIR_BLURB[key] || `${ew} and ${em} energy meeting is its own kind of interesting.`;
}

function whyMatch(p, w, m) {
  const closest = DIMS.reduce((best, d) => {
    const diff = Math.abs((w.scores[d] || 0) - (m.scores[d] || 0));
    return diff < best.diff ? { dim: d, diff } : best;
  }, { dim: DIMS[0], diff: 99 }).dim;
  const dimLabel = DIM_LABELS[closest];
  const shared = [];
  if (w.diet === m.diet) shared.push('diet (' + w.diet + ')');
  if (w.goal === m.goal) shared.push('what you both want next');
  if (w.smoking === m.smoking) shared.push('smoking habits');
  if (w.drinking === m.drinking) shared.push('drinking habits');
  if (w.vibeElement === m.vibeElement) shared.push(`a ${w.vibeElement.toLowerCase()} energy`);
  const sharedText = shared.length ? shared.join(', ') : 'a few smaller habits';

  let scenarioLine = '';
  if (w.partnerVibe && m.partnerVibe) {
    scenarioLine = w.partnerVibe === m.partnerVibe
      ? ` When either of you is having a bad day, you actually want the same thing from a partner — that's a rarer overlap than it sounds.`
      : ` Worth knowing early: when ${w.name} is upset they want "${w.partnerVibe.toLowerCase()}", while ${m.name} tends to reach for "${m.partnerVibe.toLowerCase()}" — not a dealbreaker, just worth naming out loud.`;
  }

  return `${w.sunSign} (${p.ew}) meets ${m.sunSign} (${p.em}): ${elementPairBlurb(p.ew, p.em)} `
    + `Beyond the stars, you two lined up closest on ${dimLabel}, and you're aligned on ${sharedText}.${scenarioLine} `
    + `Behavior fit ${p.behavior}%, shared habits ${p.habits}%, sun-sign fit ${p.sun}%, preference fit ${p.pref}%.`;
}

async function computeMatches(members) {
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
      locked.push({ ...p, womanName: w.name, manName: m.name, _w: w, _m: m });
    }
  });

  // AI narrative per locked pair (max 5 pairs in a 10-person round), with a
  // local-template fallback if no key is set or the call fails.
  for (const p of locked) {
    let why = null;
    try { why = await aiWhyMatch(p, p._w, p._m); } catch (e) { /* fall through */ }
    p.why = why || whyMatch(p, p._w, p._m);
    delete p._w; delete p._m;
  }

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
async function checkAutoReveal(state) {
  if (state.locked) return state;
  const complete = state.members.filter(m => m.status === 'complete');
  if (state.members.length < CIRCLE_SIZE || complete.length < CIRCLE_SIZE) {
    if (state.deadlockAt) { state.deadlockAt = null; saveData(state); }
    return state;
  }
  const women = complete.filter(m => m.gender === 'Woman').length;
  const men = complete.filter(m => m.gender === 'Man').length;
  if (women < 1 || men < 1) {
    if (!state.deadlockAt) { state.deadlockAt = Date.now(); saveData(state); }
    return state;
  }
  const { pairs, unmatched } = await computeMatches(state.members);
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
app.get('/api/state', async (req, res) => {
  let state = await checkAutoReveal(checkAutoLoop(loadData()));
  res.json(publicState(state));
});

// Before results are locked, other members' quiz answers stay private —
// the lobby only needs to know who's joined, their gender, and whether
// they've finished the quiz, not their actual answers. Sun sign is shown
// because the lobby ticker/slot grid references it.
function publicState(state) {
  const { chats, ...rest } = state;
  rest.members = state.members.map(m => ({
    id: m.id, name: m.name, gender: m.gender, status: m.status,
    sunSign: m.sunSign, joinedAt: m.joinedAt
  }));
  rest.circleSize = CIRCLE_SIZE;
  return rest;
}

app.post('/api/join', (req, res) => {
  let state = checkAutoLoop(loadData());
  if (state.locked) return res.status(409).json({ error: 'Round is locked. Wait for it to loop.' });
  if (state.members.length >= CIRCLE_SIZE) return res.status(409).json({ error: 'This round is full.' });

  const { name, age, dob, gender } = req.body;
  if (!name || !age || !dob || !gender) return res.status(400).json({ error: 'Missing fields.' });
  if (parseInt(age) < 18) return res.status(400).json({ error: 'Must be 18 or older.' });
  if (!['Woman', 'Man'].includes(gender)) return res.status(400).json({ error: 'Invalid gender.' });

  const id = genId();
  const member = {
    id, name: String(name).slice(0, 60), age: parseInt(age), dob, gender,
    sunSign: getSunSign(dob), status: 'quiz', scores: {},
    height: null, build: null, hairStyle: null, complexion: null, selfCharacter: null,
    prefHeight: null, prefBuild: null, prefHairStyle: null, prefCharacter: null,
    smoking: null, drinking: null, diet: null, goal: null, vibeElement: null, partnerVibe: null, idealPartner: '',
    aiFollowupQuestion: '', aiFollowupAnswer: '',
    joinedAt: Date.now()
  };
  state.members.push(member);
  saveData(state);
  res.json({ id, sunSign: member.sunSign, round: state.round });
});

app.post('/api/ai-question', async (req, res) => {
  const { answers } = req.body || {};
  const q = await aiGenerateQuestion(answers || {});
  if (!q) return res.json({ available: false });
  res.json({ available: true, ...q });
});

app.post('/api/quiz', async (req, res) => {
  let state = checkAutoLoop(loadData());
  if (state.locked) return res.status(409).json({ error: 'Round is locked.' });
  const { id, answers } = req.body;
  const member = state.members.find(m => m.id === id);
  if (!member) return res.status(404).json({ error: 'Member not found in this round.' });

  DIMS.forEach(d => { member.scores[d] = answers[d] ?? 0; });
  member.height = answers.height || null;
  member.build = answers.build || null;
  member.hairStyle = answers.hairStyle || null;
  member.complexion = answers.complexion || null;
  member.selfCharacter = answers.selfCharacter || null;
  member.prefHeight = answers.prefHeight || null;
  member.prefBuild = answers.prefBuild || null;
  member.prefHairStyle = answers.prefHairStyle || null;
  member.prefCharacter = answers.prefCharacter || null;
  member.smoking = answers.smoking || null;
  member.drinking = answers.drinking || null;
  member.diet = answers.diet || null;
  member.goal = answers.goal || null;
  member.vibeElement = answers.vibeElement || null;
  member.partnerVibe = answers.partnerVibe || null;
  member.idealPartner = (answers.idealPartner || '').slice(0, 500);
  member.aiFollowupQuestion = (answers.aiFollowupQuestion || '').slice(0, 200);
  member.aiFollowupAnswer = (answers.aiFollowupAnswer || '').slice(0, 200);
  member.status = 'complete';
  saveData(state);
  state = await checkAutoReveal(state);
  res.json({ ok: true });
});

// Manual reveal is kept only as a fallback (e.g. testing with fewer than 10) —
// the normal path is checkAutoReveal firing on its own once the lobby is full.
app.post('/api/reveal', async (req, res) => {
  let state = await checkAutoReveal(checkAutoLoop(loadData()));
  if (state.locked) return res.json(publicState(state));
  const complete = state.members.filter(m => m.status === 'complete');
  const women = complete.filter(m => m.gender === 'Woman').length;
  const men = complete.filter(m => m.gender === 'Man').length;
  if (women < 1 || men < 1) return res.status(409).json({ error: 'Need at least one woman and one man.' });

  const { pairs, unmatched } = await computeMatches(state.members);
  state.locked = true;
  state.lockedAt = Date.now();
  state.pairs = pairs;
  state.unmatchedIds = unmatched;
  saveData(state);
  res.json(publicState(state));
});

// Returns the caller's own full profile (needed for results screen partner
// lookups and self-checks) — separate from the redacted public member list.
app.get('/api/me/:id', (req, res) => {
  let state = checkAutoLoop(loadData());
  const member = state.members.find(m => m.id === req.params.id);
  if (!member) return res.status(404).json({ error: 'Not found in this round.' });
  res.json(member);
});

app.post('/api/leave', (req, res) => {
  let state = checkAutoLoop(loadData());
  if (state.locked) return res.status(409).json({ error: 'Round already locked.' });
  const { id } = req.body;
  state.members = state.members.filter(m => m.id !== id);
  saveData(state);
  res.json({ ok: true });
});

// Full member records (including quiz answers) are only exposed once a
// round is locked, and only for the two members involved in a given pair —
// used by the results screen to show partner details after reveal.
app.get('/api/pair-detail/:round/:woman/:man', (req, res) => {
  let state = checkAutoLoop(loadData());
  if (!state.locked || String(state.round) !== req.params.round) return res.status(404).json({ error: 'No such locked pair.' });
  const isRealPair = state.pairs.some(p => p.womanId === req.params.woman && p.manId === req.params.man);
  if (!isRealPair) return res.status(404).json({ error: 'No such locked pair.' });
  const w = state.members.find(m => m.id === req.params.woman);
  const m = state.members.find(m => m.id === req.params.man);
  res.json({ woman: w, man: m });
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
