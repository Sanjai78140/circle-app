const express = require('express');
const fs = require('fs');
const path = require('path');
let webpush = null;
try { webpush = require('web-push'); } catch (e) { /* optional dep missing — push just stays disabled */ }

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_MEMBERS = 10;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultData = { round: 1, locked: false, members: [], pairs: [], chats: {}, subscriptions: {}, vapid: null };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!data.subscriptions) data.subscriptions = {};
    if (data.vapid === undefined) data.vapid = null;
    return data;
  } catch (e) {
    return { round: 1, locked: false, members: [], pairs: [], chats: {}, subscriptions: {}, vapid: null };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Web Push setup (real push — fires even if the browser tab/app is closed,
// as long as the OS/browser keeps the push service worker registered)
// ---------------------------------------------------------------------------
let VAPID_PUBLIC_KEY = null;

function initPush() {
  if (!webpush) {
    console.log('[push] "web-push" package not installed — run `npm install` to enable push notifications.');
    return;
  }
  const data = loadData();
  let pub = process.env.VAPID_PUBLIC_KEY;
  let priv = process.env.VAPID_PRIVATE_KEY;

  if (!pub || !priv) {
    // Fall back to keys generated + persisted in data.json so they survive
    // server restarts (but NOT a fresh redeploy on Render's free tier,
    // since the filesystem is ephemeral there). For real production use,
    // set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_EMAIL as env vars —
    // generate a fixed pair once with: npx web-push generate-vapid-keys
    if (data.vapid && data.vapid.publicKey && data.vapid.privateKey) {
      pub = data.vapid.publicKey;
      priv = data.vapid.privateKey;
    } else {
      const generated = webpush.generateVAPIDKeys();
      pub = generated.publicKey;
      priv = generated.privateKey;
      data.vapid = generated;
      saveData(data);
      console.log('[push] Generated new VAPID keys (persisted to data.json). Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars on Render for stable production keys.');
    }
  }

  const email = process.env.VAPID_EMAIL || 'admin@example.com';
  webpush.setVapidDetails(`mailto:${email}`, pub, priv);
  VAPID_PUBLIC_KEY = pub;
  console.log('[push] Web Push is enabled.');
}
initPush();

async function sendPush(data, memberId, payload) {
  if (!webpush || !VAPID_PUBLIC_KEY) return;
  const sub = data.subscriptions[memberId];
  if (!sub) return;
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (e) {
    // Subscription expired/revoked — drop it so we stop retrying
    if (e.statusCode === 404 || e.statusCode === 410) {
      delete data.subscriptions[memberId];
    } else {
      console.log('[push] send failed:', e.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Zodiac compatibility
// ---------------------------------------------------------------------------
const ZODIAC_ELEMENTS = {
  Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire',
  Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth',
  Gemini: 'Air', Libra: 'Air', Aquarius: 'Air',
  Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water'
};

function getAstroScore(signA, signB) {
  const elemA = ZODIAC_ELEMENTS[signA] || 'Fire';
  const elemB = ZODIAC_ELEMENTS[signB] || 'Fire';

  if (elemA === elemB) return 90;
  if ((elemA === 'Fire' && elemB === 'Air') || (elemA === 'Air' && elemB === 'Fire')) return 95;
  if ((elemA === 'Earth' && elemB === 'Water') || (elemA === 'Water' && elemB === 'Earth')) return 95;
  return 40;
}

function getBehaviorScore(ansA = {}, ansB = {}) {
  const keys = Object.keys(ansA);
  if (keys.length === 0) return 50;

  let totalDiff = 0;
  let count = 0;

  for (const k of keys) {
    if (ansB[k] !== undefined) {
      totalDiff += Math.abs(Number(ansA[k]) - Number(ansB[k]));
      count++;
    }
  }

  if (count === 0) return 50;
  const avgDiff = totalDiff / count;
  return Math.max(0, 100 - (avgDiff * 25));
}

// ---------------------------------------------------------------------------
// Compatibility badges — 7 quiz categories mapped to answer keys
// ---------------------------------------------------------------------------
const CATEGORY_KEYS = {
  'Food': ['taste_food'],
  'Music': ['music_vibe'],
  'Values': ['about_me', 'ideal_self', 'growth_mindset', 'financial_logic', 'future_vision'],
  'Logic': ['thought_depth', 'conflict_logic'],
  'Lifestyle': ['social_battery', 'weekend_energy', 'travel_style', 'spontaneity', 'humor_style'],
  'Partner Traits': ['partner_trait', 'vibe_check', 'love_language', 'communication_style', 'trust_pace'],
  'Intent': ['relationship_goal']
};

const CATEGORY_BADGES = {
  'Food': '🍛 Food Twins',
  'Music': '🎵 Music Soulmates',
  'Values': '💫 Aligned Values',
  'Logic': '🧠 Mind Sync',
  'Lifestyle': '🌙 Lifestyle Match',
  'Partner Traits': '💞 Dream Team',
  'Intent': '🎯 Same Page'
};

function computeBadges(ansA = {}, ansB = {}) {
  const badges = [];
  for (const [cat, keys] of Object.entries(CATEGORY_KEYS)) {
    const relevant = keys.filter(k => ansA[k] !== undefined && ansB[k] !== undefined);
    if (!relevant.length) continue;
    const matches = relevant.filter(k => ansA[k] === ansB[k]).length;
    if (matches / relevant.length >= 0.6) badges.push(CATEGORY_BADGES[cat]);
  }
  return badges;
}

// ---------------------------------------------------------------------------
// Static fallback summary + icebreaker (used when no AI key is set, or the
// AI call fails/times out — the app must never break because of this)
// ---------------------------------------------------------------------------
function generateStaticSummary(userA, userB, score, badges) {
  if (badges.length > 0) {
    return `✨ You connected at a remarkable ${score}% score! You're both showing up as ${badges.join(' + ')} — a genuinely rare kind of harmony for this circle.`;
  }
  return `✨ A ${score}% deep resonance! Your mindsets and life visions complement each other beautifully, paving the way for an effortless conversation.`;
}

const STATIC_ICEBREAKERS = [
  "If today had a theme song, what would it be?",
  "What's a small thing that made you smile this week?",
  "Biryani or parotta — settle it right now. 😄",
  "What's one place you've been dying to visit?",
  "Tell me about a moment you felt genuinely proud of yourself.",
  "What's your go-to comfort show or movie?"
];

function pickStaticIcebreaker() {
  return STATIC_ICEBREAKERS[Math.floor(Math.random() * STATIC_ICEBREAKERS.length)];
}

// ---------------------------------------------------------------------------
// AI-generated summary + icebreaker (optional — Gemini first choice for
// free tier, Anthropic as a higher-quality paid alternative; README covers
// both). Every call is timeboxed and wrapped so a failure never blocks
// matchmaking — it just silently falls back to the static version above.
// ---------------------------------------------------------------------------
async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

async function callAnthropic(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const block = (data?.content || []).find(c => c.type === 'text');
    return block ? block.text : null;
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

function safeParseJSON(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

async function generateAIExtras(userA, userB, score, badges) {
  const prompt = `You are the warm, upbeat host of "The Circle," a lighthearted social matchmaking mixer.
Two members just matched.

Name A: ${userA.name}
Name B: ${userB.name}
Compatibility score: ${score}%
Zodiac signs: ${userA.zodiac || 'Unknown'} and ${userB.zodiac || 'Unknown'}
Categories where they aligned: ${badges.length ? badges.join(', ') : 'a mix of complementary traits rather than identical ones'}

Respond with ONLY valid JSON, no markdown fences, no extra commentary, in exactly this shape:
{"summary": "one warm, playful 2-sentence line (under 40 words) about why they matched, written so both of them can read it together", "icebreaker": "one fun, low-pressure opening chat line one of them could send first, under 20 words"}

Keep it purely lighthearted and entertaining — this is a casual social matchmaking app, not a psychological or clinical assessment. No therapy language, no diagnostic framing, nothing invasive or presumptive about their private lives.`;

  let raw = await callAnthropic(prompt);
  if (!raw) raw = await callGemini(prompt);
  if (!raw) return null;

  const parsed = safeParseJSON(raw);
  if (!parsed || !parsed.summary) return null;
  return parsed;
}

async function getMatchExtras(userA, userB, score) {
  const badges = computeBadges(userA.answers, userB.answers);
  const ai = await generateAIExtras(userA, userB, score, badges);
  return {
    badges,
    summary: (ai && ai.summary) ? ai.summary : generateStaticSummary(userA, userB, score, badges),
    icebreaker: (ai && ai.icebreaker) ? ai.icebreaker : pickStaticIcebreaker(),
    aiGenerated: !!(ai && ai.summary)
  };
}

// ---------------------------------------------------------------------------
// Matchmaking (75% threshold cutoff, greedy best-match, no double-matching)
// ---------------------------------------------------------------------------
async function runMatchmaking(data) {
  const women = data.members.filter(m => m.gender === 'woman' && m.complete);
  const men = data.members.filter(m => m.gender === 'man' && m.complete);
  const pairs = [];
  const matchedIds = new Set();

  for (const w of women) {
    if (matchedIds.has(w.id)) continue;
    let bestMatch = null;
    let highestScore = 0;

    for (const m of men) {
      if (matchedIds.has(m.id)) continue;

      const behScore = getBehaviorScore(w.answers, m.answers);
      const astroScore = getAstroScore(w.zodiac, m.zodiac);
      const totalScore = Math.round((behScore * 0.75) + (astroScore * 0.25));

      if (totalScore >= 75 && totalScore > highestScore) {
        highestScore = totalScore;
        bestMatch = m;
      }
    }

    if (bestMatch) {
      matchedIds.add(w.id);
      matchedIds.add(bestMatch.id);

      const extras = await getMatchExtras(w, bestMatch, highestScore);
      const pairKey = `${w.id}_${bestMatch.id}`;

      pairs.push({
        womanId: w.id,
        womanName: w.name,
        manId: bestMatch.id,
        manName: bestMatch.name,
        score: highestScore,
        summary: extras.summary,
        icebreaker: extras.icebreaker,
        badges: extras.badges,
        aiGenerated: extras.aiGenerated
      });

      if (!data.chats[pairKey]) {
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        data.chats[pairKey] = [
          { sender: 'system', senderName: 'The Circle', text: extras.summary, time: now },
          { sender: 'system', senderName: 'The Circle', text: `💡 Icebreaker: ${extras.icebreaker}`, time: now }
        ];
      }

      await sendPush(data, w.id, {
        title: '🔥 BOOM! MATCH CONNECTED!',
        body: `You're paired with ${bestMatch.name} — ${highestScore}% compatibility! Tap to chat.`
      });
      await sendPush(data, bestMatch.id, {
        title: '🔥 BOOM! MATCH CONNECTED!',
        body: `You're paired with ${w.name} — ${highestScore}% compatibility! Tap to chat.`
      });
    }
  }

  data.pairs = pairs;
  data.locked = pairs.length > 0;
  return data;
}

// ---------------------------------------------------------------------------
// API endpoints
// ---------------------------------------------------------------------------
app.get('/api/state', (req, res) => {
  const data = loadData();
  const completeCount = data.members.filter(m => m.complete).length;
  res.json({
    round: data.round,
    locked: data.locked,
    members: data.members,
    pairs: data.pairs,
    count: data.members.length,
    completeCount,
    capacity: MAX_MEMBERS
  });
});

app.get('/api/me/:id', (req, res) => {
  const data = loadData();
  const user = data.members.find(m => m.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/api/join', (req, res) => {
  const { name, gender, zodiac } = req.body;
  if (!name || !gender) return res.status(400).json({ error: 'Name and gender required' });

  const data = loadData();
  if (data.members.length >= MAX_MEMBERS) {
    return res.status(409).json({ error: 'This circle is full — please wait for the next round.' });
  }

  const id = 'circle_' + Math.random().toString(36).substring(2, 7);
  const newMember = { id, name, gender, zodiac: zodiac || 'Aries', complete: false, answers: {} };

  data.members.push(newMember);
  saveData(data);
  res.json({ id });
});

app.post('/api/answers', (req, res) => {
  const { id, answers } = req.body;
  const data = loadData();
  const user = data.members.find(m => m.id === id);

  if (!user) return res.status(404).json({ error: 'User not found' });
  user.answers = answers;
  user.complete = true;

  saveData(data);
  res.json({ success: true });
});

app.post('/api/reveal', async (req, res) => {
  let data = loadData();
  data = await runMatchmaking(data);
  saveData(data);
  res.json({ locked: data.locked, pairs: data.pairs });
});

app.get('/api/chat/:wId/:mId', (req, res) => {
  const data = loadData();
  const pairKey = `${req.params.wId}_${req.params.mId}`;
  res.json({ messages: data.chats[pairKey] || [] });
});

app.post('/api/chat/:wId/:mId', (req, res) => {
  const { sender, senderName, text } = req.body;
  const data = loadData();
  const pairKey = `${req.params.wId}_${req.params.mId}`;

  if (!data.chats[pairKey]) data.chats[pairKey] = [];
  data.chats[pairKey].push({
    sender,
    senderName,
    text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  saveData(data);
  res.json({ success: true });
});

// --- Web Push subscription endpoints ---
app.get('/api/push/vapidPublicKey', (req, res) => {
  res.json({ key: VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', (req, res) => {
  const { id, subscription } = req.body;
  if (!id || !subscription) return res.status(400).json({ error: 'id and subscription required' });

  const data = loadData();
  data.subscriptions[id] = subscription;
  saveData(data);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`The Circle server running on port ${PORT}`);
});
