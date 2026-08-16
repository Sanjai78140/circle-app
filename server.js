const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const init = { round: 1, members: [], locked: false, lockedAt: null, pairs: [], unmatched: [], chats: {} };
      fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2));
      return init;
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return { round: 1, members: [], locked: false, lockedAt: null, pairs: [], unmatched: [], chats: {} };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {}
}

const ZODIAC_ELEMENTS = {
  Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire',
  Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth',
  Gemini: 'Air', Libra: 'Air', Aquarius: 'Air',
  Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water'
};

const COMPAT = {
  Fire: { Fire: 0.85, Air: 0.95, Earth: 0.4, Water: 0.3 },
  Air: { Fire: 0.95, Air: 0.8, Earth: 0.5, Water: 0.4 },
  Earth: { Earth: 0.85, Water: 0.95, Fire: 0.4, Air: 0.5 },
  Water: { Water: 0.9, Earth: 0.95, Fire: 0.3, Air: 0.4 }
};

function scorePair(w, m) {
  const wAns = w.answers || {};
  const mAns = m.answers || {};
  
  let totalDiff = 0;
  let count = 0;
  const dims = ['social', 'planning', 'love', 'conflict', 'family', 'adventure', 'trust', 'independence', 'humor', 'logic_decision', 'logic_conflict'];
  
  dims.forEach(d => {
    if (wAns[d] !== undefined && mAns[d] !== undefined) {
      totalDiff += Math.abs(wAns[d] - mAns[d]);
      count++;
    }
  });

  const avgDiff = count > 0 ? totalDiff / count : 2;
  const behaviorScore = Math.max(0, 100 - (avgDiff * 25));

  let habitBonus = 0;
  if (wAns.smoking && mAns.smoking && wAns.smoking === mAns.smoking) habitBonus += 10;
  if (wAns.drinking && mAns.drinking && wAns.drinking === mAns.drinking) habitBonus += 10;
  if (wAns.goal && mAns.goal && wAns.goal === mAns.goal) habitBonus += 10;

  const wEl = ZODIAC_ELEMENTS[w.zodiac] || 'Air';
  const mEl = ZODIAC_ELEMENTS[m.zodiac] || 'Air';
  const astroRatio = (COMPAT[wEl] && COMPAT[wEl][mEl]) ? COMPAT[wEl][mEl] : 0.7;
  const astroScore = astroRatio * 100;

  const finalScore = Math.round((behaviorScore * 0.45) + (habitBonus) + (astroScore * 0.25));
  return Math.min(99, Math.max(45, finalScore));
}

function chatKey(round, wId, mId) {
  return `r${round}_${wId}_${mId}`;
}

// REST Endpoints
app.get('/api/state', (req, res) => {
  res.json(loadData());
});

app.post('/api/join', (req, res) => {
  let state = loadData();
  const { name, age, dob, gender, zodiac, location } = req.body;
  
  if (!name || !gender) return res.status(400).json({ error: 'Missing basic details' });
  
  const existing = state.members.find(m => m.id === req.body.id);
  if (existing) return res.json({ id: existing.id, member: existing });

  const id = 'circle_' + Math.random().toString(36).substring(2, 9);
  const newMember = {
    id, name, age, dob, gender, zodiac, location,
    answers: {}, complete: false, joinedAt: Date.now()
  };
  
  state.members.push(newMember);
  saveData(state);
  res.json({ id, member: newMember });
});

app.post('/api/answers', (req, res) => {
  let state = loadData();
  const { id, answers } = req.body;
  const m = state.members.find(x => x.id === id);
  if (!m) return res.status(404).json({ error: 'Member not found' });
  
  m.answers = answers;
  m.complete = true;
  saveData(state);
  res.json({ success: true });
});

app.get('/api/me/:id', (req, res) => {
  let state = loadData();
  const m = state.members.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  res.json(m);
});

app.post('/api/reveal', (req, res) => {
  let state = loadData();
  if (state.locked) return res.json(state);

  const women = state.members.filter(m => m.gender === 'woman' && m.complete);
  const men = state.members.filter(m => m.gender === 'man' && m.complete);

  if (women.length === 0 || men.length === 0) {
    return res.status(400).json({ error: 'Need at least one woman and one man.' });
  }

  let candidates = [];
  women.forEach(w => {
    men.forEach(m => {
      candidates.push({ woman: w, man: m, score: scorePair(w, m) });
    });
  });

  candidates.sort((a, b) => b.score - a.score);

  const matchedW = new Set();
  const matchedM = new Set();
  const pairs = [];

  candidates.forEach(c => {
    if (!matchedW.has(c.woman.id) && !matchedM.has(c.man.id)) {
      matchedW.add(c.woman.id);
      matchedM.add(c.man.id);
      pairs.push({
        womanId: c.woman.id,
        manId: c.man.id,
        womanName: c.woman.name,
        manName: c.man.name,
        score: c.score,
        reason: `Matched with ${c.score}% overall harmony across personality, mindset logic, and astrological vibes.`
      });
      
      // Auto-inject initial welcome message for each pair
      const key = chatKey(state.round, c.woman.id, c.man.id);
      state.chats[key] = {
        messages: [{
          sender: 'system',
          senderName: '✨ Circle System',
          text: '🎉 Match Connected! Feel free to chat here, or take your good time and move over to another platform (WhatsApp / Instagram / Call). All the best! 💖',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]
      };
    }
  });

  const unmatched = state.members.filter(m => !matchedW.has(m.id) && !matchedM.has(m.id));

  state.locked = true;
  state.lockedAt = Date.now();
  state.pairs = pairs;
  state.unmatched = unmatched.map(u => ({ id: u.id, name: u.name }));

  saveData(state);
  res.json(state);
});

app.get('/api/chat/:woman/:man', (req, res) => {
  let state = loadData();
  const key = chatKey(state.round, req.params.woman, req.params.man);
  const chat = state.chats[key] || { messages: [] };
  res.json({ messages: chat.messages });
});

app.post('/api/chat/:woman/:man', (req, res) => {
  let state = loadData();
  const { sender, senderName, text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty message.' });

  const key = chatKey(state.round, req.params.woman, req.params.man);
  if (!state.chats[key]) state.chats[key] = { messages: [] };

  const msg = {
    sender,
    senderName: senderName || 'Anonymous',
    text: text.trim(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  state.chats[key].messages.push(msg);
  saveData(state);
  res.json({ success: true, message: msg });
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
