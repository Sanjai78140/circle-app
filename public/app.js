const app = document.getElementById('app');
let myId = localStorage.getItem('circleMemberId') || null;
let quizAnswers = {};
let quizIndex = 0;
let screen = 'loading';
let pollTimer = null;
let chatTimerInt = null;
let errMsg = '';
let draft = { name: '', age: '', dob: '', gender: '' };

const DIMS = ['social', 'planning', 'love', 'conflict', 'family', 'adventure'];

const SIGN_GLYPH = { Aries:'♈', Taurus:'♉', Gemini:'♊', Cancer:'♋', Leo:'♌', Virgo:'♍', Libra:'♎', Scorpio:'♏', Sagittarius:'♐', Capricorn:'♑', Aquarius:'♒', Pisces:'♓' };
const SIGN_ELEMENT = { Aries:'Fire', Leo:'Fire', Sagittarius:'Fire', Taurus:'Earth', Virgo:'Earth', Capricorn:'Earth', Gemini:'Air', Libra:'Air', Aquarius:'Air', Cancer:'Water', Scorpio:'Water', Pisces:'Water' };
const SIGN_BLURB = {
  Aries: "First to jump in, first to say what they're thinking. You bring the spark the circle needs.",
  Taurus: "Steady, warm, a little stubborn in the best way. People trust you almost instantly.",
  Gemini: "Quick wit, quicker questions. You keep conversations from ever going flat.",
  Cancer: "You feel a room before you speak in it. Loyal once someone's earned it.",
  Leo: "Bold, warm, made for center stage — but you make sure everyone else shines too.",
  Virgo: "You notice the details nobody else does, and somehow that's exactly what people need.",
  Libra: "Natural peacemaker with real taste. You make people feel chosen.",
  Scorpio: "Intense in the quiet way. Once you're in, you're all the way in.",
  Sagittarius: "Restless in a good way — always chasing the next real thing.",
  Capricorn: "Ambitious, a little guarded at first, deeply loyal once the walls come down.",
  Aquarius: "You love people in your own unconventional way, and it works.",
  Pisces: "Dreamer, feeler, the one who remembers what everyone else forgot."
};

const SCALE_Q = {
  social: { emoji:'⚡', title: 'Friday night, no plans yet. What actually sounds good?', opts: ['A quiet night in, just me', 'One close friend, low-key', 'Depends on my mood', 'A small group, some energy', 'Wherever the biggest crowd is'] },
  planning: { emoji:'🗓️', title: "It's Saturday morning. Do you already know what today looks like?", opts: ['Zero plan, I\'ll see where the day takes me', 'Loose idea, nothing fixed', 'A bit of both', 'I\'ve got a rough plan going', 'There\'s a list and I\'m following it'] },
  love: { emoji:'💛', title: 'Someone you\'re into does something small and thoughtful. What lands hardest?', opts: ['They tell me exactly what they\'re thinking', 'They just handle something for me, no fuss', 'Honestly, either works', 'They clear their whole evening for me', 'They just sit close, no need to talk'] },
  conflict: { emoji:'⚔️', title: 'You and your partner disagree about something real. What\'s your first move?', opts: ['I go quiet and need time', 'I need space before I can talk', 'I try to talk it through calmly', 'I bring it up right away', 'I want it resolved before we sleep on it'] },
  family: { emoji:'🏠', title: 'How much say does your family have in your relationship choices?', opts: ['None — this is my call, always', 'A little, but I don\'t need approval', 'Somewhere in the middle', 'Their opinion genuinely matters to me', 'If they don\'t like it, that\'s a real problem'] },
  adventure: { emoji:'🧭', title: 'A friend says "let\'s do something completely random this weekend." Your gut reaction?', opts: ['Hard pass, I like my routine', 'Maybe, depends what it is', 'Cautiously curious', 'I\'m already grabbing my shoes', 'I\'m the one who texted that first'] }
};
const CHOICE_Q = {
  smoking: { emoji:'🚬', title: 'Do you smoke?', opts: ['Never', 'Socially', 'Regularly'] },
  smokingFollow: { emoji:'🚬', title: 'Roughly how often, socially?', opts: ['Rarely', 'Weekends only', 'A few times a week'] },
  drinking: { emoji:'🍷', title: 'Do you drink?', opts: ['Never', 'Socially', 'Regularly'] },
  drinkingFollow: { emoji:'🍷', title: 'Roughly how often, socially?', opts: ['Rarely', 'Weekends only', 'A few times a week'] },
  diet: { emoji:'🍽️', title: 'How would you describe your diet?', opts: ['Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian', 'Other'] },
  goal: { emoji:'🎯', title: "Be honest — what are you actually here for?", opts: ['Long-term relationship', 'Marriage-minded', 'Something casual first', 'Not sure yet, figuring it out'] },
  vibeElement: { emoji:'✨', title: 'Forget your sun sign for a second — which element feels most like you?', opts: ['🔥 Fire — bold, fast, all in', '🌍 Earth — grounded, steady, dependable', '💨 Air — curious, social, always talking', '🌊 Water — deep, intuitive, feels everything'] }
};
const VIBE_VALUE = ['Fire', 'Earth', 'Air', 'Water'];

function getSteps(ans) {
  let steps = [...DIMS, 'vibeElement', 'smoking'];
  if (ans.smoking === 'Socially') steps.push('smokingFollow');
  steps.push('drinking');
  if (ans.drinking === 'Socially') steps.push('drinkingFollow');
  steps.push('diet', 'goal', 'aiFollowup', 'idealPartner');
  return steps;
}

function esc(s) { return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function render(html) { app.innerHTML = html; }

async function api(path, opts) {
  const res = await fetch('/api' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// ---------- boot ----------
async function init() {
  stopPolling();
  const state = await api('/state');
  if (state.locked) {
    screen = 'results';
    renderResults(state);
    return;
  }
  if (myId) {
    const mem = state.members.find(m => m.id === myId);
    if (mem) {
      if (mem.status === 'complete') { screen = 'lobby'; renderLobby(); return; }
      else { quizAnswers = {}; quizIndex = 0; screen = 'quiz'; renderQuiz(); return; }
    } else {
      localStorage.removeItem('circleMemberId');
      myId = null;
    }
  }
  screen = 'landing';
  renderLanding(state);
}

function renderLanding(state) {
  render(`
    <div class="eyebrow">Round ${state.round}</div>
    <h1>The Circle</h1>
    <p class="sub">Ten people, one round. Answer honestly, wait for the circle to fill, and reveal locks in your matches for good — this round, anyway.</p>
    <p class="note" style="margin-top:-16px;margin-bottom:20px;">For fun — a compatibility quiz, not a clinical or psychological assessment.</p>
    <div class="card">
      ${errMsg ? `<div class="err">${esc(errMsg)}</div>` : ''}
      <button class="btn btn-gold" onclick="startJoin()">Join this round</button>
      <div style="height:10px"></div>
      <label class="field-label">Already joined on another device? Enter your code</label>
      <input id="resumeCode" placeholder="e.g. QK3F9M" style="text-transform:uppercase" maxlength="6">
      <button class="btn btn-ghost" onclick="resume()">Resume</button>
    </div>
    <div class="note">${state.members.length}/10 in the circle right now.</div>
  `);
}

async function startJoin() {
  errMsg = '';
  const state = await api('/state');
  if (state.locked) { screen = 'results'; renderResults(state); return; }
  if (state.members.length >= 10) { errMsg = 'This round is full. Wait for it to loop.'; renderLanding(state); return; }
  screen = 'onboarding';
  renderOnboarding();
}

async function resume() {
  const code = document.getElementById('resumeCode').value.trim().toUpperCase();
  const state = await api('/state');
  const mem = state.members.find(m => m.id === code);
  if (!mem) { errMsg = 'Code not found in this round.'; renderLanding(state); return; }
  myId = mem.id;
  localStorage.setItem('circleMemberId', myId);
  if (state.locked) { screen = 'results'; renderResults(state); return; }
  if (mem.status === 'complete') { screen = 'lobby'; renderLobby(); }
  else { quizAnswers = {}; quizIndex = 0; screen = 'quiz'; renderQuiz(); }
}

function renderOnboarding() {
  render(`
    <div class="eyebrow">Step 1</div>
    <h1>Who's joining?</h1>
    <p class="sub">Just the basics — this builds your profile and calculates your sun sign.</p>
    <div class="card">
      ${errMsg ? `<div class="err">${esc(errMsg)}</div>` : ''}
      <label class="field-label">Name</label>
      <input id="f_name" value="${esc(draft.name)}" placeholder="Your name">
      <label class="field-label">Age</label>
      <input id="f_age" type="number" min="18" value="${draft.age}" placeholder="18+">
      <label class="field-label">Date of birth</label>
      <input id="f_dob" type="date" value="${draft.dob}">
      <label class="field-label">Gender</label>
      <div class="gender-row">
        <div class="gender-opt ${draft.gender === 'Woman' ? 'sel' : ''}" onclick="setGender('Woman')">Woman</div>
        <div class="gender-opt ${draft.gender === 'Man' ? 'sel' : ''}" onclick="setGender('Man')">Man</div>
      </div>
      <button class="btn btn-gold" onclick="submitOnboarding()">Continue to quiz</button>
    </div>
  `);
}
function setGender(g) { draft.gender = g; renderOnboarding(); }

async function submitOnboarding() {
  draft.name = document.getElementById('f_name').value.trim();
  draft.age = document.getElementById('f_age').value;
  draft.dob = document.getElementById('f_dob').value;
  if (!draft.name || !draft.age || !draft.dob || !draft.gender) { errMsg = 'Fill in every field.'; renderOnboarding(); return; }
  if (parseInt(draft.age) < 18) { errMsg = 'Must be 18 or older.'; renderOnboarding(); return; }

  try {
    const res = await api('/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
    myId = res.id;
    localStorage.setItem('circleMemberId', myId);
    quizAnswers = {}; quizIndex = 0;
    renderSignReveal(res.sunSign, res.id);
  } catch (e) {
    errMsg = e.message; renderOnboarding();
  }
}

function renderSignReveal(sign, code) {
  const glyph = SIGN_GLYPH[sign] || '✦';
  const element = SIGN_ELEMENT[sign] || '';
  const blurb = SIGN_BLURB[sign] || '';
  const stars = [
    { top: '4%', left: '50%' }, { top: '20%', left: '88%' }, { top: '50%', left: '96%' },
    { top: '80%', left: '85%' }, { top: '96%', left: '50%' }, { top: '80%', left: '15%' },
    { top: '50%', left: '4%' }, { top: '20%', left: '12%' }
  ];
  render(`
    <div class="eyebrow">Your chart says...</div>
    <h1>Reading the stars</h1>
    <div class="card sign-reveal">
      <div class="sign-orbit">
        ${stars.map((s,i)=>`<span class="star" style="top:${s.top};left:${s.left};animation-delay:${(i*0.25).toFixed(2)}s">✦</span>`).join('')}
        <div class="sign-glyph">${glyph}</div>
      </div>
      <div class="sign-name">${esc(sign)}</div>
      <div class="sign-element">${esc(element)} sign</div>
      <div class="sign-blurb">${esc(blurb)}</div>
    </div>
    <div class="code-box">${esc(code)}</div>
    <p class="note" style="margin-top:0;">That's your code — this device will auto-resume, but save it in case you switch devices.</p>
    <button class="btn btn-gold" onclick="renderQuiz()">Start the quiz</button>
  `);
}

function renderQuiz() {
  const steps = getSteps(quizAnswers);
  if (quizIndex >= steps.length) { finalizeQuiz(); return; }
  const key = steps[quizIndex];
  if (key === 'aiFollowup') { renderAiFollowup(steps); return; }
  const def = SCALE_Q[key] || CHOICE_Q[key];
  const pct = Math.round((quizIndex / steps.length) * 100);

  if (key === 'idealPartner') {
    render(`
      <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="eyebrow">Last one 💬</div>
      <h1 class="q-anim" style="font-size:26px;">In a sentence or two, describe your ideal partner.</h1>
      <div class="card q-anim">
        <textarea id="f_ideal" placeholder="What matters most to you..."></textarea>
        <button class="btn btn-gold" onclick="answerIdeal()">Finish quiz</button>
      </div>
    `);
    return;
  }

  render(`
    <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="q-timer-track"><div class="q-timer-fill" style="animation-name:shrinkBar;"></div></div>
    <div class="eyebrow">Question ${quizIndex + 1} of ${steps.length}</div>
    <h1 class="q-anim" style="font-size:24px;">${def.emoji ? def.emoji + ' ' : ''}${esc(def.title)}</h1>
    <div class="q-options q-anim">
      ${def.opts.map((o, i) => `<div class="q-opt" onclick='answerQuiz("${key}", ${SCALE_Q[key] ? i - 2 : JSON.stringify(key === 'vibeElement' ? VIBE_VALUE[i] : o)})'>${esc(o)}</div>`).join('')}
    </div>
  `);
}
function answerQuiz(key, value) { quizAnswers[key] = value; quizIndex++; renderQuiz(); }
function answerIdeal() { quizAnswers.idealPartner = document.getElementById('f_ideal').value.trim(); quizIndex++; finalizeQuiz(); }

async function renderAiFollowup(steps) {
  const pct = Math.round((quizIndex / steps.length) * 100);
  render(`
    <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="eyebrow">One more, just for you 🧠</div>
    <h1 class="q-anim" style="font-size:24px;">Reading your answers...</h1>
    <div class="q-anim note" style="text-align:center;padding:30px 0;">Thinking of a good follow-up question...</div>
  `);
  let q = null;
  try {
    q = await api('/ai-question', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: quizAnswers }) });
  } catch (e) { q = null; }
  if (quizIndex >= getSteps(quizAnswers).length || getSteps(quizAnswers)[quizIndex] !== 'aiFollowup') return; // user navigated away
  if (!q || q.available === false) {
    // no AI configured, or it failed — skip forward invisibly, no error shown
    quizIndex++;
    renderQuiz();
    return;
  }
  quizAnswers._aiTitle = q.title;
  render(`
    <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="eyebrow">One more, just for you 🧠</div>
    <h1 class="q-anim" style="font-size:24px;">${esc(q.title)}</h1>
    <div class="q-options q-anim">
      ${q.options.map(o => `<div class="q-opt" onclick='answerAiFollowup(${JSON.stringify(o)})'>${esc(o)}</div>`).join('')}
    </div>
  `);
}
function answerAiFollowup(value) {
  quizAnswers.aiFollowupQuestion = quizAnswers._aiTitle || '';
  quizAnswers.aiFollowupAnswer = value;
  quizIndex++;
  renderQuiz();
}

async function finalizeQuiz() {
  try {
    await api('/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: myId, answers: quizAnswers }) });
    screen = 'lobby';
    renderLobby();
    startPolling();
  } catch (e) {
    errMsg = e.message;
    screen = 'landing';
    const state = await api('/state');
    renderLanding(state);
  }
}

function slotGrid(members) {
  let html = '<div class="slot-grid">';
  for (let i = 0; i < 10; i++) {
    const mem = members[i];
    if (!mem) { html += `<div class="slot"><div class="glyph" style="opacity:0.25">?</div></div>`; continue; }
    const isW = mem.gender === 'Woman';
    const ready = mem.status === 'complete';
    html += `<div class="slot ${ready ? (isW ? 'filled-w' : 'filled-m') : 'pending'}">
      <div class="glyph">${ready ? (isW ? '♀' : '♂') : '…'}</div>
      <div class="nm">${esc(mem.name.split(' ')[0])}</div>
    </div>`;
  }
  html += '</div>';
  return html;
}

async function renderLobby() {
  const state = await api('/state');
  if (state.locked) { stopPolling(); screen = 'results'; renderResults(state); return; }

  const members = [...state.members].sort((a, b) => a.joinedAt - b.joinedAt);
  const complete = members.filter(m => m.status === 'complete');
  const total = members.length;

  const latest = [...members].sort((a, b) => b.joinedAt - a.joinedAt)[0];
  const ticker = latest ? `✨ ${esc(latest.name.split(' ')[0])} just joined the circle` : '';

  let banner = '';
  if (total === 10 && complete.length === 10 && !state.deadlockAt) {
    banner = `<div class="locking-banner pop">🔒 Lobby full — locking in matches<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>`;
  } else if (state.deadlockAt) {
    banner = `<div class="locking-banner pop" style="border-color:var(--rose);color:var(--rose)">This round couldn't pair up (needs at least one woman and one man). Resetting shortly...</div>`;
  }

  render(`
    <div class="match-eyebrow-row"><span class="pulse-dot"></span> MATCHMAKING · ROUND ${state.round}</div>
    <h1 style="text-align:center;">Filling the circle</h1>
    <p class="sub" style="text-align:center;">Auto-starts the second all 10 seats are ready — no button to press.</p>
    <div class="big-counter"><div class="n">${total}/10</div><div class="l">players joined</div></div>
    <div class="ticker">${ticker}</div>
    ${banner}
    <div class="card">
      ${slotGrid(members)}
      <div class="counts">
        <div class="count-pill"><div class="n">${complete.filter(m=>m.gender==='Woman').length}</div><div class="l">Women ready</div></div>
        <div class="count-pill"><div class="n">${complete.filter(m=>m.gender==='Man').length}</div><div class="l">Men ready</div></div>
        <div class="count-pill"><div class="n">${complete.length}</div><div class="l">Total ready</div></div>
      </div>
    </div>
    <div class="link-row"><a onclick="leaveCircle()">Leave &amp; start over</a></div>
  `);
}

async function leaveCircle() {
  await api('/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: myId }) });
  localStorage.removeItem('circleMemberId');
  myId = null;
  stopPolling();
  const state = await api('/state');
  screen = 'landing';
  renderLanding(state);
}

// ---------- results / chat ----------
let tarotFlipped = false;

async function renderResults(state) {
  if (!state.locked) {
    // circle already looped server-side
    localStorage.removeItem('circleMemberId');
    myId = null;
    screen = 'landing';
    renderLanding(state);
    return;
  }

  const myPair = state.pairs.find(p => p.womanId === myId || p.manId === myId);
  const iAmUnmatched = state.unmatchedIds.includes(myId);
  const membersById = {}; state.members.forEach(m => membersById[m.id] = m);

  let personalBlock = '';
  if (myPair) {
    const partnerName = myPair.womanId === myId ? myPair.manName : myPair.womanName;
    const partnerId = myPair.womanId === myId ? myPair.manId : myPair.womanId;
    const partner = membersById[partnerId];
    personalBlock = `
      <div class="tarot ${tarotFlipped ? 'flipped' : ''}" id="tarotEl" onclick="toggleTarot()">
        <div class="tarot-inner">
          <div class="tarot-face tarot-front">
            <div class="glyph">✦</div>
            <div style="font-family:'Fraunces',serif;font-size:18px;color:var(--gold-soft)">Your match</div>
            <div class="note" style="margin-top:6px">tap to flip</div>
          </div>
          <div class="tarot-face tarot-back">
            <div class="compat-num">${myPair.total}%</div>
            <div class="compat-label">compatibility</div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="eyebrow">Matched with</div>
        <h1 style="font-size:22px;">${esc(partnerName)}</h1>
        <div style="margin-bottom:10px;">
          <span class="badge">${esc(partner?.sunSign || '')} ${SIGN_GLYPH[partner?.sunSign] || ''}</span>
          <span class="badge" style="margin-left:6px;">${esc(partner?.vibeElement || '')} energy</span>
        </div>
        <div class="why-box">${esc(myPair.why)}</div>
        ${partner?.aiFollowupAnswer ? `<div class="note" style="text-align:left;margin-top:10px;">Asked "${esc(partner.aiFollowupQuestion)}" — they said: <i>"${esc(partner.aiFollowupAnswer)}"</i></div>` : ''}
      </div>
      <div class="timer" id="chatTimer"></div>
      <div class="chat-box" id="chatBox"></div>
      <div class="chat-input-row">
        <input id="chatInput" placeholder="Say hello...">
        <button class="btn btn-gold" style="width:auto;padding:12px 18px" onclick="sendChat()">Send</button>
      </div>
    `;
  } else if (myId && iAmUnmatched) {
    personalBlock = `
      <div class="card" style="text-align:center;">
        <div style="font-size:32px;margin-bottom:8px;">☾</div>
        <div class="why-box">No one scored high enough this round. Sometimes the circle just doesn't line up — worth another round.</div>
      </div>
    `;
  } else if (!myId) {
    personalBlock = `
      <div class="card" style="text-align:center;">
        <div class="why-box">Matches for this round are already locked. Enter your code on the home screen to see your personal result, or just watch the board below.</div>
      </div>
    `;
  }

  render(`
    <div class="eyebrow">Round ${state.round} · Revealed</div>
    <h1>Results</h1>
    ${personalBlock}
    <div class="card">
      <div class="eyebrow">All pairs, transparently</div>
      <div class="pair-list">
        ${state.pairs.map(p => `<div class="pair-row"><span><b>${esc(p.womanName)}</b> &amp; <b>${esc(p.manName)}</b></span><span>${p.total}%</span></div>`).join('') || '<div class="pair-row">No pairs formed this round.</div>'}
      </div>
    </div>
    <div class="note">Circle loops automatically when the chat window closes — no need to do anything.</div>
    <div class="link-row"><a onclick="hardReset()">Back to home</a></div>
  `);

  if (myPair) {
    tickChatTimer(state.lockedAt);
    loadAndRenderChat(myPair.womanId, myPair.manId);
  }
  startPolling();
}

function toggleTarot() {
  tarotFlipped = !tarotFlipped;
  const el = document.getElementById('tarotEl');
  if (el) el.classList.toggle('flipped');
  if (tarotFlipped) burstConfetti();
}
function burstConfetti() {
  const el = document.getElementById('tarotEl');
  if (!el) return;
  const wrap = document.createElement('div');
  wrap.style.position = 'absolute';
  wrap.style.left = '50%';
  wrap.style.top = '0';
  wrap.style.width = '0'; wrap.style.height = '0';
  const colors = ['#d9b46a', '#eecd8f', '#c96b6b', '#c96b8f'];
  for (let i = 0; i < 14; i++) {
    const dot = document.createElement('div');
    dot.className = 'confetti-dot';
    const angle = (i / 14) * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    dot.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
    dot.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
    dot.style.background = colors[i % colors.length];
    wrap.appendChild(dot);
  }
  el.style.position = 'relative';
  el.appendChild(wrap);
  setTimeout(() => wrap.remove(), 1000);
}

function hardReset() {
  localStorage.removeItem('circleMemberId');
  myId = null;
  window.location.reload();
}

function tickChatTimer(lockedAt) {
  if (chatTimerInt) clearInterval(chatTimerInt);
  const chatEnd = lockedAt + 2 * 60 * 1000;
  const upd = () => {
    const left = Math.max(0, Math.round((chatEnd - Date.now()) / 1000));
    const el = document.getElementById('chatTimer');
    if (el) el.textContent = left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left to chat` : 'Chat closed — circle looping...';
    if (left <= 0) clearInterval(chatTimerInt);
  };
  upd();
  chatTimerInt = setInterval(upd, 1000);
}

async function loadAndRenderChat(womanId, manId) {
  try {
    const data = await api(`/chat/${womanId}/${manId}`);
    const box = document.getElementById('chatBox');
    if (!box) return;
    box.innerHTML = data.messages.map(m => `
      <div class="msg ${m.sender === myId ? 'mine' : ''}">
        <div class="who">${esc(m.senderName)}</div>
        <div class="bubble">${esc(m.text)}</div>
      </div>`).join('') || '<div class="note">No messages yet.</div>';
    box.scrollTop = box.scrollHeight;
  } catch (e) { /* ignore */ }
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  const state = await api('/state');
  const myPair = state.pairs.find(p => p.womanId === myId || p.manId === myId);
  if (!myPair) return;
  const me = state.members.find(m => m.id === myId);
  try {
    await api(`/chat/${myPair.womanId}/${myPair.manId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: myId, senderName: me?.name || 'You', text })
    });
    input.value = '';
    loadAndRenderChat(myPair.womanId, myPair.manId);
  } catch (e) { /* chat window likely closed */ }
}

// ---------- polling ----------
function startPolling() {
  stopPolling();
  const interval = screen === 'lobby' ? 2000 : 4000;
  pollTimer = setInterval(async () => {
    const state = await api('/state');
    if (screen === 'lobby') renderLobby();
    else if (screen === 'results') renderResults(state);
  }, interval);
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

init();
