const app = document.getElementById('app');

// User State Persistence
let myId = localStorage.getItem('circleMemberId') || generateId();
localStorage.setItem('circleMemberId', myId);

let quizAnswers = {};
let quizIndex = 0;
let quizSet = 1; // 1 = Self & Looks, 2 = Partner Preferences & Intentions
let dynamicRegionalQuestions = [];
let screen = 'loading';
let pollTimer = null;
let heartbeatTimer = null;
let errMsg = '';
let draft = { name: '', dob: '', gender: '', userState: 'Tamil Nadu' };

function generateId() {
  return 'CIRC_' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

// ---------------- QUIZ QUESTION SETS ----------------

// SET 1: Self Taste, Looks & Regional Identity
const SET_1_QUESTIONS = [
  {
    key: 'myLook',
    emoji: '✨',
    title: 'Set 1: Express Your Aesthetic & Style',
    question: 'How would you best describe your personal look and style?',
    opts: [
      'Minimalistic, neat & comfortable modern wear.',
      'Traditional, elegant & classic cultural outfits.',
      'Trendy, bold, stylish & street fashion.',
      'Casual, cozy & effortless everyday look.'
    ]
  },
  {
    key: 'selfVibe',
    emoji: '⚡',
    title: 'Set 1: Your Natural Vibe',
    question: 'How do people usually perceive your energy when they meet you?',
    opts: [
      'Warm, gentle & soft-spoken listener.',
      'Energetic, witty, funny & talkative.',
      'Calm, grounded, intelligent & observant.',
      'Bold, passionate, direct & spontaneous.'
    ]
  }
];

// SET 2: Partner Preferences & Deep Intentions
const SET_2_QUESTIONS = [
  {
    key: 'partnerLook',
    emoji: '👁️',
    title: 'Set 2: What Catches Your Eye in a Partner?',
    question: 'What visual style or vibe do you admire most in a partner?',
    opts: [
      'Simple, clean-cut, genuine & subtle presentation.',
      'Traditional charm, expressive eyes & cultural touch.',
      'Stylish confidence, sharp dressing & strong posture.',
      'Relaxed, cozy, approachable & friendly vibe.'
    ]
  },
  {
    key: 'intention',
    emoji: '💍',
    title: 'Set 2: Deep Intention & Goals',
    question: 'Be honest—what are you looking to build through this connection?',
    opts: [
      'A deep, long-term romantic relationship leading to marriage.',
      'A meaningful connection to see where chemistry takes us.',
      'A best-friend-first relationship built on trust and laughs.',
      'Companionship with someone who shares my core values.'
    ]
  },
  {
    key: 'conflictStyle',
    emoji: '🕊️',
    title: 'Set 2: Emotional Maturity & Conflict',
    question: 'When a misunderstanding happens, what is your approach to healing it?',
    opts: [
      'Talk it out immediately with calm honesty.',
      'Take a short quiet pause, then come together to resolve it.',
      'Use light humor & a gentle hug to ease tension first.',
      'Write down thoughts to communicate without emotion.'
    ]
  }
];

// ---------------- HELPER FUNCTIONS ----------------
function esc(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(path, options = {}) {
  const res = await fetch('/api' + path, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Server error');
  }
  return res.json();
}

function sendHeartbeat() {
  if (myId) {
    api('/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: myId })
    }).catch(() => {});
  }
}

// ---------------- RENDER VIEWS ----------------
function render() {
  if (screen === 'loading') renderLoading();
  else if (screen === 'onboarding') renderOnboarding();
  else if (screen === 'quiz') renderQuiz();
  else if (screen === 'lobby') renderLobby();
  else if (screen === 'chat') renderChat();
}

function renderLoading() {
  app.innerHTML = `<div class="card"><div class="sub">Connecting to The Circle...</div></div>`;
}

function renderOnboarding() {
  app.innerHTML = `
    <div class="card">
      <div class="save-id-box">
        🔑 <strong>Your Resume ID: <span style="color:var(--gold);">${myId}</span></strong>
        <div style="font-size:11.5px; margin-top:3px; color:var(--muted);">Save this ID! You can re-enter anytime to check who matched with you.</div>
      </div>

      <div class="honest-banner">
        ✨ <strong>Welcome to The Circle</strong><br>
        Please be genuine and answer honestly—let's see the magic happen!
      </div>

      <label class="field-label">Your Name or Nickname</label>
      <input type="text" id="inName" value="${esc(draft.name)}" placeholder="e.g. Rahul / Ananya">

      <label class="field-label">Date of Birth (Calculates Sun Sign)</label>
      <input type="date" id="inDob" value="${esc(draft.dob)}">

      <label class="field-label">Where are you from? (State / Region)</label>
      <select id="inState">
        <option value="Tamil Nadu" ${draft.userState==='Tamil Nadu'?'selected':''}>Tamil Nadu (Tanglish Scenarios)</option>
        <option value="Karnataka" ${draft.userState==='Karnataka'?'selected':''}>Karnataka</option>
        <option value="Kerala" ${draft.userState==='Kerala'?'selected':''}>Kerala</option>
        <option value="Maharashtra" ${draft.userState==='Maharashtra'?'selected':''}>Maharashtra</option>
        <option value="Delhi / North India" ${draft.userState==='Delhi / North India'?'selected':''}>Delhi / North India (Hinglish Scenarios)</option>
        <option value="Other / International" ${draft.userState==='Other / International'?'selected':''}>Other / International</option>
      </select>

      <label class="field-label">I identify as...</label>
      <div class="gender-row">
        <div class="gender-opt ${draft.gender === 'woman' ? 'sel' : ''}" onclick="selectGender('woman')">Woman</div>
        <div class="gender-opt ${draft.gender === 'man' ? 'sel' : ''}" onclick="selectGender('man')">Man</div>
      </div>

      ${errMsg ? `<div class="err">${esc(errMsg)}</div>` : ''}

      <button class="btn btn-gold" onclick="startQuizSet1()">Start Set 1: My Style & Vibe ✨</button>
      
      <div style="margin-top:16px; text-align:center;">
        <span style="font-size:12px; color:var(--muted); cursor:pointer; text-decoration:underline;" onclick="resumeSession()">Already joined? Check my match status</span>
      </div>
    </div>
  `;
}

function selectGender(g) {
  draft.gender = g;
  draft.name = document.getElementById('inName').value;
  draft.dob = document.getElementById('inDob').value;
  draft.userState = document.getElementById('inState').value;
  render();
}

async function startQuizSet1() {
  draft.name = document.getElementById('inName').value.trim();
  draft.dob = document.getElementById('inDob').value;
  draft.userState = document.getElementById('inState').value;

  if (!draft.name || !draft.dob || !draft.gender) {
    errMsg = 'Please fill in your name, birthday, and gender.';
    render();
    return;
  }

  errMsg = '';
  screen = 'loading';
  render();

  // Fetch AI Dynamic Regional Questions based on State
  try {
    const aiRes = await api('/ai-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userState: draft.userState })
    });
    dynamicRegionalQuestions = aiRes.questions || [];
  } catch (e) {
    dynamicRegionalQuestions = [];
  }

  quizSet = 1;
  quizIndex = 0;
  quizAnswers = {};
  screen = 'quiz';
  render();
}

function renderQuiz() {
  const currentQuestions = getCombinedQuestions();
  const q = currentQuestions[quizIndex];
  const totalQ = currentQuestions.length;
  const progress = Math.round(((quizIndex + 1) / totalQ) * 100);

  app.innerHTML = `
    <div class="card">
      <div class="eyebrow">${q.emoji} Question ${quizIndex + 1} of ${totalQ}</div>
      <div class="squad-bar-track" style="margin-bottom:18px;">
        <div class="squad-bar-fill" style="width:${progress}%; background:var(--gold);"></div>
      </div>

      <h2>${esc(q.title)}</h2>
      <p class="sub">${esc(q.question)}</p>

      <div class="q-options">
        ${q.opts.map(opt => `
          <div class="q-opt" onclick="answerQuestion('${q.key}', '${esc(opt)}')">
            ${esc(opt)}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function getCombinedQuestions() {
  return [...SET_1_QUESTIONS, ...dynamicRegionalQuestions, ...SET_2_QUESTIONS];
}

async function answerQuestion(key, val) {
  quizAnswers[key] = val;
  quizIndex++;

  const allQ = getCombinedQuestions();
  if (quizIndex < allQ.length) {
    render();
  } else {
    // Complete Registration
    screen = 'loading';
    render();
    try {
      const res = await api('/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: myId,
          name: draft.name,
          dob: draft.dob,
          gender: draft.gender,
          userState: draft.userState,
          answers: quizAnswers
        })
      });
      screen = 'lobby';
      startPolling();
    } catch (e) {
      errMsg = e.message;
      screen = 'onboarding';
      render();
    }
  }
}

async function resumeSession() {
  const enterId = prompt("Enter your saved Resume ID:", myId);
  if (enterId) {
    myId = enterId.trim();
    localStorage.setItem('circleMemberId', myId);
    screen = 'loading';
    render();
    try {
      const state = await api('/state');
      if (state.members.some(m => m.id === myId)) {
        screen = state.locked ? 'chat' : 'lobby';
        startPolling();
      } else {
        alert("ID not found in current round. You can join fresh!");
        screen = 'onboarding';
      }
    } catch (e) {
      screen = 'onboarding';
    }
    render();
  }
}

async function renderLobby() {
  try {
    const state = await api('/state');
    if (state.locked) {
      screen = 'chat';
      renderChat();
      return;
    }

    app.innerHTML = `
      <div class="card">
        <div class="save-id-box" style="margin-bottom:14px;">
          🔑 Resume ID: <strong>${myId}</strong>
        </div>

        <div class="eyebrow">Round ${state.round} • Synchronized Lobby</div>
        <h1>The Circle is Filling</h1>
        <p class="sub">Once men and women join, pairings will trigger automatically.</p>

        <div style="margin:20px 0;">
          <div class="squad-bar-row">
            <div class="squad-bar-label"><span>Women Joined</span><span>${state.womenCount} / 5</span></div>
            <div class="squad-bar-track"><div class="squad-bar-fill" style="width:${(state.womenCount/5)*100}%; background:var(--woman);"></div></div>
          </div>
          <div class="squad-bar-row">
            <div class="squad-bar-label"><span>Men Joined</span><span>${state.menCount} / 5</span></div>
            <div class="squad-bar-track"><div class="squad-bar-fill" style="width:${(state.menCount/5)*100}%; background:var(--man);"></div></div>
          </div>
        </div>

        <button class="btn btn-gold" onclick="triggerReveal()">Reveal Cosmic Matches ✨</button>
      </div>
    `;
  } catch (e) {}
}

async function triggerReveal() {
  try {
    await api('/reveal', { method: 'POST' });
    screen = 'chat';
    render();
  } catch (e) {
    alert(e.message);
  }
}

async function renderChat() {
  const state = await api('/state');
  const myPair = state.pairs.find(p => p.womanId === myId || p.manId === myId);

  if (!myPair) {
    app.innerHTML = `
      <div class="card">
        <h2>Circle Unmatched This Round</h2>
        <p class="sub">The circle will auto-loop into the next round shortly!</p>
      </div>
    `;
    return;
  }

  app.innerHTML = `
    <div class="card">
      <div class="eyebrow">Cosmic Synergy • ${myPair.score}% Match</div>
      <h2>${esc(myPair.astroTitle)}</h2>
      <p class="sub" style="font-style:italic;">"${esc(myPair.why)}"</p>
      
      <div id="statusBanner" style="background:var(--surface-2); padding:10px 14px; border-radius:10px; font-size:13px; margin-bottom:14px; border:1px solid var(--line);">
        Checking presence...
      </div>

      <div class="chat-box" id="chatBox" style="height:230px; overflow-y:auto; border:1px solid var(--line); border-radius:10px; padding:12px; margin-bottom:12px;"></div>

      <div style="display:flex; gap:8px;">
        <input type="text" id="chatInput" placeholder="Send a genuine message..." onkeypress="if(event.key==='Enter') sendChat('${myPair.womanId}', '${myPair.manId}')">
        <button class="btn btn-gold" style="width:auto;" onclick="sendChat('${myPair.womanId}', '${myPair.manId}')">Send</button>
      </div>
    </div>
  `;

  loadChat(myPair.womanId, myPair.manId);
}

async function loadChat(wId, mId) {
  try {
    const res = await api(`/chat/${wId}/${mId}`);
    const banner = document.getElementById('statusBanner');
    
    if (banner) {
      if (!res.started) {
        banner.innerHTML = `⏳ <strong>Waiting for partner to come online...</strong><br><span style="font-size:11.5px; color:var(--muted);">Timer will start automatically as soon as BOTH of you are in the chat room!</span>`;
      } else {
        banner.innerHTML = `🔥 <strong>Both Online! 2-Min Live Chat active: <span style="color:var(--gold);">${res.secsLeft}s remaining</span></strong>`;
      }
    }

    const box = document.getElementById('chatBox');
    if (!box) return;
    box.innerHTML = res.messages.map(m => `
      <div style="margin-bottom:8px; text-align:${m.sender === myId ? 'right' : 'left'};">
        <span style="font-size:11px; color:var(--muted);">${esc(m.senderName)} • ${m.time}</span>
        <div style="background:${m.sender === myId ? 'var(--gold)' : 'var(--surface-2)'}; color:${m.sender === myId ? '#1a1330' : 'var(--text)'}; display:inline-block; padding:8px 12px; border-radius:12px; max-width:80%; font-size:14px;">
          ${esc(m.text)}
        </div>
      </div>
    `).join('') || '<div style="color:var(--muted); font-size:13px;">No messages yet. Say hello! 👋</div>';
    box.scrollTop = box.scrollHeight;
  } catch (e) {}
}

async function sendChat(wId, mId) {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  try {
    await api(`/chat/${wId}/${mId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: myId, senderName: draft.name || 'You', text })
    });
    input.value = '';
    loadChat(wId, mId);
  } catch (e) {}
}

function startPolling() {
  stopPolling();
  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, 5000);

  pollTimer = setInterval(() => {
    if (screen === 'lobby') renderLobby();
    if (screen === 'chat') {
      api('/state').then(st => {
        const myPair = st.pairs.find(p => p.womanId === myId || p.manId === myId);
        if (myPair) loadChat(myPair.womanId, myPair.manId);
      });
    }
  }, 2500);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
}

// Boot up
(async function init() {
  try {
    const st = await api('/state');
    if (myId && st.members.some(m => m.id === myId)) {
      screen = st.locked ? 'chat' : 'lobby';
      startPolling();
    } else {
      screen = 'onboarding';
    }
  } catch (e) {
    screen = 'onboarding';
  }
  render();
})();
