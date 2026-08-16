const app = document.getElementById('app');

let myId = localStorage.getItem('circleMemberId') || generateId();
localStorage.setItem('circleMemberId', myId);

let quizAnswers = {};
let quizIndex = 0;
let dynamicRegionalQuestions = [];
let screen = 'loading';
let pollTimer = null;
let heartbeatTimer = null;
let errMsg = '';
let draft = { name: '', dob: '', gender: '', userState: 'Tamil Nadu' };

function generateId() {
  return 'CIRC_' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

// ---------- 3-SET QUESTION ARCHITECTURE ----------

// SET 1: Full about the User (Self & Complexion/Style)
const SET_1_QUESTIONS = [
  {
    key: 'myLook',
    emoji: '👤',
    title: 'SET 1: All About You — Appearance & Style',
    question: 'How would you best describe your own physical look & skin tone/style?',
    opts: [
      'Dusky / Dark skin tone with sharp features & natural charm.',
      'Fair / Warm tone with a clean, neat & minimalist look.',
      'Medium / Olive skin tone with an expressive smile & eyes.',
      'Traditional aesthetic (Veshti/Saree look carries me best).'
    ]
  },
  {
    key: 'selfVibe',
    emoji: '⚡',
    title: 'SET 1: All About You — Natural Energy',
    question: 'What energy do you naturally bring into a relationship?',
    opts: [
      'Calm, loyal, protective & deeply grounded.',
      'Witty, energetic, talkative & full of humor.',
      'Soft-spoken, attentive listener & empathetic.',
      'Bold, passionate, spontaneous & adventurous.'
    ]
  }
];

// SET 2: What They Expect From Partner
const SET_2_QUESTIONS = [
  {
    key: 'partnerLook',
    emoji: '👁️',
    title: 'SET 2: Partner Expectations — Appearance',
    question: 'What complexion or visual style do you find most attractive in a partner?',
    opts: [
      'Dusky / Dark skin guys or girls with sharp, natural charm.',
      'Fair / Warm tones with a neat & minimalist style.',
      'Complexion doesn’t matter—smile & posture win me over.',
      'Traditional look (Saree / Veshti-Kurta look instantly wins!).'
    ]
  },
  {
    key: 'partnerVibe',
    emoji: '💖',
    title: 'SET 2: Partner Expectations — Personality Vibe',
    question: 'What personality archetype are you looking for?',
    opts: [
      'Best-friend vibe: Fun, teasing & easy to talk to.',
      'Protective & caring: Mature, strong & reliable.',
      'Calm & gentle: Peaceful, quiet & deeply understanding.',
      'High energy: Passionate, ambitious & adventurous.'
    ]
  }
];

// SET 3: How They Behaviorally Act & Trust-Building Deep Questions
const SET_3_QUESTIONS = [
  {
    key: 'conflictStyle',
    emoji: '🕊️',
    title: 'SET 3: How You Act — Conflict Management',
    question: 'When an argument or misunderstanding happens, how do you handle it?',
    opts: [
      'Talk it out immediately with calm honesty—no hiding.',
      'Take a short quiet pause to cool off, then resolve gently.',
      'Use light humor or a hug first to ease the tension.',
      'Write down thoughts to communicate clearly without emotion.'
    ]
  },
  {
    key: 'loveLanguage',
    emoji: '💌',
    title: 'SET 3: How You Act — Love Language',
    question: 'How do you express deep love & trust in daily life?',
    opts: [
      'Quality time & long un-interrupted conversations.',
      'Acts of service (doing thoughtful small things for them).',
      'Words of affirmation (reminding them often how special they are).',
      'Physical touch, warm hugs & hand-holding.'
    ]
  },
  {
    key: 'intention',
    emoji: '💍',
    title: 'SET 3: Deep Goal — Trust & Commitment',
    question: 'What is your genuine goal with this process?',
    opts: [
      'Long-term serious connection leading to marriage.',
      'Meaningful relationship built on mutual respect & trust.',
      'Best-friends first to build strong natural chemistry.',
      'Exploring true compatibility without pressure.'
    ]
  }
];

// ---------- HELPERS & API ----------
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

// ---------- RENDER VIEWS ----------
function render() {
  if (screen === 'loading') renderLoading();
  else if (screen === 'onboarding') renderOnboarding();
  else if (screen === 'quiz') renderQuiz();
  else if (screen === 'lobby') renderLobby();
  else if (screen === 'chat') renderChat();
}

function renderLoading() {
  app.innerHTML = `<div class="card"><div class="sub">Analyzing Compatibility Matrix...</div></div>`;
}

function renderOnboarding() {
  app.innerHTML = `
    <div class="card">
      <div class="save-id-box">
        🔑 <strong>Your Resume ID: <span style="color:var(--gold);">${myId}</span></strong>
        <div style="font-size:11.5px; margin-top:3px; color:var(--muted);">Save this ID to re-login on any tab/device and check matched results!</div>
      </div>

      <div class="honest-banner">
        ✨ <strong>Trust the Process</strong><br>
        Answer genuinely across all 3 question sets. Let's see the magic happen!
      </div>

      <label class="field-label">Your Name or Nickname</label>
      <input type="text" id="inName" value="${esc(draft.name)}" placeholder="e.g. Vikram / Priya">

      <label class="field-label">Date of Birth (For Zodiac Synastry)</label>
      <input type="date" id="inDob" value="${esc(draft.dob)}">

      <label class="field-label">Your State / Region</label>
      <select id="inState">
        <option value="Tamil Nadu" ${draft.userState==='Tamil Nadu'?'selected':''}>Tamil Nadu (Tanglish Scenarios)</option>
        <option value="Karnataka" ${draft.userState==='Karnataka'?'selected':''}>Karnataka</option>
        <option value="Kerala" ${draft.userState==='Kerala'?'selected':''}>Kerala</option>
        <option value="Maharashtra" ${draft.userState==='Maharashtra'?'selected':''}>Maharashtra</option>
        <option value="Delhi / North India" ${draft.userState==='Delhi / North India'?'selected':''}>Delhi / North India</option>
        <option value="Other / International" ${draft.userState==='Other / International'?'selected':''}>Other / International</option>
      </select>

      <label class="field-label">I identify as...</label>
      <div class="gender-row">
        <div class="gender-opt ${draft.gender === 'woman' ? 'sel' : ''}" onclick="selectGender('woman')">Woman</div>
        <div class="gender-opt ${draft.gender === 'man' ? 'sel' : ''}" onclick="selectGender('man')">Man</div>
      </div>

      ${errMsg ? `<div class="err">${esc(errMsg)}</div>` : ''}

      <button class="btn btn-gold" onclick="startFullQuiz()">Begin 3-Stage Compatibility Quiz ✨</button>
      
      <div style="margin-top:16px; text-align:center;">
        <span style="font-size:12px; color:var(--muted); cursor:pointer; text-decoration:underline;" onclick="resumeSession()">Already registered? Check match status</span>
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

async function startFullQuiz() {
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

  quizIndex = 0;
  quizAnswers = {};
  screen = 'quiz';
  render();
}

function getCombinedQuestions() {
  return [...SET_1_QUESTIONS, ...SET_2_QUESTIONS, ...SET_3_QUESTIONS, ...dynamicRegionalQuestions];
}

function renderQuiz() {
  const currentQuestions = getCombinedQuestions();
  const q = currentQuestions[quizIndex];
  const totalQ = currentQuestions.length;
  const progress = Math.round(((quizIndex + 1) / totalQ) * 100);

  app.innerHTML = `
    <div class="card">
      <div class="eyebrow">${q.emoji} Step ${quizIndex + 1} of ${totalQ}</div>
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

async function answerQuestion(key, val) {
  quizAnswers[key] = val;
  quizIndex++;

  const allQ = getCombinedQuestions();
  if (quizIndex < allQ.length) {
    render();
  } else {
    screen = 'loading';
    render();
    try {
      await api('/join', {
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
        alert("ID not found in current active round.");
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
        <h1>Matching Matrix Active</h1>
        <p class="sub">Analyzing 3-set responses across all participants...</p>

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

        <button class="btn btn-gold" onclick="triggerReveal()">Calculate & Reveal Matches ✨</button>
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
      <div class="eyebrow">Match Breakdown • ${myPair.score}% Harmony Score</div>
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
        banner.innerHTML = `⏳ <strong>Waiting for partner to come online...</strong><br><span style="font-size:11.5px; color:var(--muted);">2-minute chat timer starts automatically when BOTH partners are in the room!</span>`;
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
