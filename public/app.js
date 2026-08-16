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
const SCALE_Q = {
  social: { title: 'Where do you get your energy?', opts: ['Deeply introverted', 'Lean introverted', 'A balance of both', 'Lean extroverted', 'Deeply extroverted'] },
  planning: { title: 'How do you like to move through life?', opts: ['Fully spontaneous', 'Mostly spontaneous', 'A balance of both', 'Mostly a planner', 'Fully a planner'] },
  love: { title: 'How do you show love best?', opts: ['Words of affirmation', 'Acts of service', 'A mix of both', 'Quality time', 'Physical closeness'] },
  conflict: { title: 'When something bothers you in a relationship...', opts: ['I avoid it', 'I need space before I can talk', 'I talk it out calmly', 'I address it head-on', 'I confront it immediately'] },
  family: { title: 'How close are you with family?', opts: ['Very independent', 'Somewhat independent', 'A balance of both', 'Close with family', 'Family comes first'] },
  adventure: { title: 'How do you feel about new things?', opts: ['Firm homebody', 'Prefer routine', 'A balance of both', 'Enjoy new things', 'Full thrill-seeker'] }
};
const CHOICE_Q = {
  smoking: { title: 'Do you smoke?', opts: ['Never', 'Socially', 'Regularly'] },
  smokingFollow: { title: 'Roughly how often, socially?', opts: ['Rarely', 'Weekends only', 'A few times a week'] },
  drinking: { title: 'Do you drink?', opts: ['Never', 'Socially', 'Regularly'] },
  drinkingFollow: { title: 'Roughly how often, socially?', opts: ['Rarely', 'Weekends only', 'A few times a week'] },
  diet: { title: 'How would you describe your diet?', opts: ['Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian', 'Other'] },
  goal: { title: 'What are you looking for?', opts: ['Long-term relationship', 'Marriage-minded', 'Something casual first', 'Not sure yet'] }
};
function getSteps(ans) {
  let steps = [...DIMS, 'smoking'];
  if (ans.smoking === 'Socially') steps.push('smokingFollow');
  steps.push('drinking');
  if (ans.drinking === 'Socially') steps.push('drinkingFollow');
  steps.push('diet', 'goal', 'idealPartner');
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
    render(`
      <div class="eyebrow">Your code</div>
      <h1>Save this</h1>
      <p class="sub">This device will auto-resume. If you switch devices, this code brings you back.</p>
      <div class="code-box">${res.id}</div>
      <button class="btn btn-gold" onclick="renderQuiz()">Start the quiz</button>
    `);
  } catch (e) {
    errMsg = e.message; renderOnboarding();
  }
}

function renderQuiz() {
  const steps = getSteps(quizAnswers);
  if (quizIndex >= steps.length) { finalizeQuiz(); return; }
  const key = steps[quizIndex];
  const def = SCALE_Q[key] || CHOICE_Q[key];
  const pct = Math.round((quizIndex / steps.length) * 100);

  if (key === 'idealPartner') {
    render(`
      <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="eyebrow">Last one</div>
      <h1 style="font-size:26px;">In a sentence or two, describe your ideal partner.</h1>
      <div class="card">
        <textarea id="f_ideal" placeholder="What matters most to you..."></textarea>
        <button class="btn btn-gold" onclick="answerIdeal()">Finish quiz</button>
      </div>
    `);
    return;
  }

  render(`
    <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="eyebrow">Question ${quizIndex + 1}</div>
    <h1 style="font-size:26px;">${esc(def.title)}</h1>
    <div class="q-options">
      ${def.opts.map((o, i) => `<div class="q-opt" onclick='answerQuiz("${key}", ${SCALE_Q[key] ? i - 2 : JSON.stringify(o)})'>${esc(o)}</div>`).join('')}
    </div>
  `);
}
function answerQuiz(key, value) { quizAnswers[key] = value; quizIndex++; renderQuiz(); }
function answerIdeal() { quizAnswers.idealPartner = document.getElementById('f_ideal').value.trim(); quizIndex++; finalizeQuiz(); }

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

function wheelSVG(members) {
  const slots = 10, cx = 110, cy = 110, r = 82;
  let circles = '';
  for (let i = 0; i < slots; i++) {
    const angle = (i / slots) * 2 * Math.PI - Math.PI / 2;
    const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
    const mem = members[i];
    let fill = 'rgba(255,255,255,0.06)', stroke = 'var(--line)', glyph = '', color = '';
    if (mem) {
      if (mem.gender === 'Woman') { fill = 'rgba(201,107,143,0.25)'; stroke = 'var(--woman)'; glyph = '♀'; color = 'var(--woman)'; }
      else { fill = 'rgba(107,155,201,0.25)'; stroke = 'var(--man)'; glyph = '♂'; color = 'var(--man)'; }
    }
    circles += `<circle cx="${x}" cy="${y}" r="16" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    if (glyph) circles += `<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="14" fill="${color}">${glyph}</text>`;
  }
  return `<svg width="220" height="220" viewBox="0 0 220 220">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line)" stroke-dasharray="2 4"/>
    ${circles}
  </svg>`;
}

async function renderLobby() {
  const state = await api('/state');
  if (state.locked) { stopPolling(); screen = 'results'; renderResults(state); return; }
  const complete = state.members.filter(m => m.status === 'complete');
  const women = complete.filter(m => m.gender === 'Woman').length;
  const men = complete.filter(m => m.gender === 'Man').length;
  let status;
  if (women === 0 && men === 0) status = 'Waiting for the first people to finish the quiz.';
  else if (women === 0) status = 'Waiting on at least one woman to join.';
  else if (men === 0) status = 'Waiting on at least one man to join.';
  else status = "Ready — anyone can reveal matches. It's permanent for this round.";
  const canReveal = women >= 1 && men >= 1;

  render(`
    <div class="eyebrow">Round ${state.round} · Lobby</div>
    <h1>Filling up</h1>
    <p class="sub">Everyone here has finished the quiz. Grid refreshes on its own.</p>
    <div class="wheel-wrap">${wheelSVG(complete)}</div>
    <div class="counts">
      <div class="count-pill"><div class="n">${women}</div><div class="l">Women</div></div>
      <div class="count-pill"><div class="n">${men}</div><div class="l">Men</div></div>
      <div class="count-pill"><div class="n">${complete.length}/10</div><div class="l">Total</div></div>
    </div>
    <div class="status-text">${status}</div>
    <button class="btn btn-gold" ${canReveal ? '' : 'disabled'} onclick="confirmReveal()">Reveal matches</button>
    <div class="link-row"><a onclick="leaveCircle()">Leave &amp; start over</a></div>
  `);
}

async function confirmReveal() {
  if (!confirm('This locks matches for everyone in this round — permanently, until the circle loops. Continue?')) return;
  try {
    const state = await api('/reveal', { method: 'POST' });
    stopPolling();
    screen = 'results';
    renderResults(state);
  } catch (e) {
    alert(e.message);
  }
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
    personalBlock = `
      <div class="tarot ${tarotFlipped ? 'flipped' : ''}" onclick="toggleTarot()">
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
        <div class="why-box">${esc(myPair.why)}</div>
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

function toggleTarot() { tarotFlipped = !tarotFlipped; document.querySelector('.tarot').classList.toggle('flipped'); }

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
  pollTimer = setInterval(async () => {
    const state = await api('/state');
    if (screen === 'lobby') renderLobby();
    else if (screen === 'results') renderResults(state);
  }, 4000);
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

init();
