const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize default data file if not present
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultData = { round: 1, locked: false, members: [], pairs: [], chats: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return { round: 1, locked: false, members: [], pairs: [], chats: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Zodiac Mapping to Elements
const ZODIAC_ELEMENTS = {
  Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire',
  Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth',
  Gemini: 'Air', Libra: 'Air', Aquarius: 'Air',
  Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water'
};

// Calculate Astrological Compatibility (25% Weight)
function getAstroScore(signA, signB) {
  const elemA = ZODIAC_ELEMENTS[signA] || 'Fire';
  const elemB = ZODIAC_ELEMENTS[signB] || 'Fire';

  if (elemA === elemB) return 90;
  if ((elemA === 'Fire' && elemB === 'Air') || (elemA === 'Air' && elemB === 'Fire')) return 95;
  if ((elemA === 'Earth' && elemB === 'Water') || (elemA === 'Water' && elemB === 'Earth')) return 95;
  return 40;
}

// Calculate Behavioral Difference Score (75% Weight)
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

// Generates an emotional summary explaining the connection
function generateEmotionalSummary(userA, userB, score) {
  const ansA = userA.answers || {};
  const ansB = userB.answers || {};
  const shared = [];

  if (ansA.love_language && ansA.love_language === ansB.love_language) {
    shared.push("express love in the exact same emotional language");
  }
  if (ansA.weekend_energy && ansA.weekend_energy === ansB.weekend_energy) {
    shared.push("share the same weekend pace and comfort energy");
  }
  if (ansA.conflict_logic && ansA.conflict_logic === ansB.conflict_logic) {
    shared.push("handle life’s choices with aligned logic");
  }
  if (ansA.music_vibe && ansA.music_vibe === ansB.music_vibe) {
    shared.push("vibe to the same inner musical rhythm");
  }

  if (shared.length > 0) {
    return `✨ You connected at a remarkable ${score}% score! The stars aligned because you both ${shared.join(" and ")}, bringing rare harmony to this circle.`;
  }
  return `✨ Higher than a ${score}% deep resonance! Your mindsets and life visions complement each other beautifully, paving the way for an effortless conversation.`;
}

// Core Matchmaking Routine (75% Threshold Cutoff)
function runMatchmaking(data) {
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

      // Cutoff Rule: Must be >= 75%
      if (totalScore >= 75 && totalScore > highestScore) {
        highestScore = totalScore;
        bestMatch = m;
      }
    }

    if (bestMatch) {
      matchedIds.add(w.id);
      matchedIds.add(bestMatch.id);

      const summary = generateEmotionalSummary(w, bestMatch, highestScore);
      const pairKey = `${w.id}_${bestMatch.id}`;

      pairs.push({
        womanId: w.id,
        womanName: w.name,
        manId: bestMatch.id,
        manName: bestMatch.name,
        score: highestScore,
        summary: summary
      });

      if (!data.chats[pairKey]) {
        data.chats[pairKey] = [
          {
            sender: 'system',
            senderName: 'The Circle',
            text: summary,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];
      }
    }
  }

  data.pairs = pairs;
  data.locked = pairs.length > 0;
  return data;
}

// --- API ENDPOINTS ---

app.get('/api/state', (req, res) => {
  const data = loadData();
  res.json({ round: data.round, locked: data.locked, members: data.members, pairs: data.pairs });
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

app.post('/api/reveal', (req, res) => {
  let data = loadData();
  data = runMatchmaking(data);
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

app.listen(PORT, () => {
  console.log(`The Circle server running on port ${PORT}`);
});
