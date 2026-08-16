const app = document.getElementById('app');
let myId = localStorage.getItem('circleMemberId') || null;
let quizAnswers = {};
let quizIndex = 0;
let screen = 'loading';
let pollTimer = null;

const QUOTES = [
  "“A meaningful connection starts with an open heart and a curious mind.”",
  "“Logic helps you navigate the world; intuition leads you to the right person.”",
  "“The right partner doesn’t complete you—they complement your growth.”",
  "“Great conversations are born when two people listen with genuine care.”",
  "“Patience in love always brings clarity.”"
];

const QUESTIONS = [
  // Logical & Reasoning Scenarios
  {
    key: 'logic_decision',
    title: 'Logical Decision Making',
    prompt: 'When facing an unexpected sudden change in weekend plans, what is your immediate natural reaction?',
    options: [
      { text: 'A) Quickly analyze alternative solutions and re-structure logically.', val: 1 },
      { text: 'B) Go with the flow spontaneously without overthinking.', val: 2 },
      { text: 'C) Feel slightly irritated first, then slowly adapt step-by-step.', val: 3 },
      { text: 'D) Pause and consult with my partner/friends before deciding.', val: 4 }
    ]
  },
  {
    key: 'logic_conflict',
    title: 'Reasoning Under Disagreement',
    prompt: 'If you and your partner hold completely opposite opinions on a major topic, how do you logically resolve it?',
    options: [
      { text: 'A) Lay down facts and logical pros/cons to reach a objective solution.', val: 1 },
      { text: 'B) Value emotional harmony over being right—agree to disagree gracefully.', val: 2 },
      { text: 'C) Discuss deeply until a balanced 50/50 compromise is found.', val: 3 },
      { text: 'D) Take some space to process independently before talking it out.', val: 4 }
    ]
  },
  // Behavioral & Personality Dimensions
  {
    key: 'social',
    title: 'Social Energy',
    prompt: 'After a long, demanding week, how do you recharge best?',
    options: [
      { text: 'A) Unwind peacefully alone at home with quiet comfort.', val: 1 },
      { text: 'B) Catch up with a close friend or two over deep conversation.', val: 2 },
      { text: 'C) Go out to a lively social gathering, party, or event.', val: 3 },
      { text: 'D) Explore a completely new place or outdoor activity.', val: 4 }
    ]
  },
  {
    key: 'planning',
    title: 'Life & Travel Style',
    prompt: 'How do you approach planning vacations or long trips?',
    options: [
      { text: 'A) Detailed step-by-step itinerary planned weeks in advance.', val: 1 },
      { text: 'B) Rough outline with plenty of open room for spontaneous choices.', val: 2 },
      { text: 'C) Purely zero planning—figure out everything on the spot.', val: 3 }
    ]
  },
  {
    key: 'love',
    title: 'Love Expression',
    prompt: 'Which gesture makes you feel most genuinely valued in a relationship?',
    options: [
      { text: 'A) Meaningful words of encouragement and appreciative compliments.', val: 1 },
      { text: 'B) Dedicated quality time with zero phone distractions.', val: 2 },
      { text: 'C) Thoughtful actions and practical help when you need it.', val: 3 },
      { text: 'D) Warm physical presence and affectionate contact.', val: 4 }
    ]
  },
  {
    key: 'goal',
    title: 'Relationship Intentions',
    prompt: 'What are you primarily looking for on The Circle right now?',
    options: [
      { text: 'A) A deep, long-term meaningful partnership leading to commitment.', val: 1 },
      { text: 'B) Genuine dating to see where natural chemistry takes us.', val: 2 },
      { text: 'C) Expanding my circle with like-minded friends first.', val: 3 }
    ]
  }
];

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Server request failed');
  }
  return res.json();
}

// Check existing session
async function checkSession() {
  if (!myId) {
    screen = 'landing';
    render();
    return;
  }
  try {
    const me = await api(`/me/${myId}`);
    const st = await api('/state');
    
    if (st.locked) {
      const myPair = st.pairs.find(p => p.womanId === myId || p.manId === myId);
      if (myPair) {
        screen = 'chat';
        render();
        startPolling();
        return;
      }
    }
    
    if (me.complete) {
      screen = 'lobby';
    } else {
      screen = 'quiz';
    }
    render();
    startPolling();
  } catch (e) {
    localStorage.removeItem('circleMemberId');
    myId = null;
    screen = 'landing';
    render();
  }
}

// Directly enter ID on Landing Box
async function resumeByID() {
  const idInput = document.getElementById('inputMemberId');
  const val = idInput ? idInput.value.trim() : '';
  if (!val) return alert('Please enter your valid ID');

  try {
    const me = await api(`/me/${val}`);
    myId = val;
    localStorage.setItem('circleMemberId', myId);
    
    const st = await api('/state');
    if (st.locked) {
      const myPair = st.pairs.find(p => p.womanId === myId || p.manId === myId);
      if (myPair) {
        screen = 'chat';
        render();
        startPolling();
        return;
      }
    }
    
    screen = me.complete ? 'lobby' : 'quiz';
    render();
    startPolling();
  } catch (e) {
    alert('Member ID not found. Please register or re-check your ID.');
  }
}

function render() {
  if (screen === 'landing') {
    app.innerHTML = `
      <div class="card">
        <div class="eyebrow">Matchmaking Circle</div>
        <h1 style="margin-top:0;">Find Your Match</h1>
        <p style="color:var(--muted); font-size:14px;">Answer a few logical and personality scenarios to connect with compatible partners.</p>
        
        <form onsubmit="event.preventDefault(); submitLanding();">
          <div style="margin-bottom:12px;">
            <label style="font-size:12px; color:var(--muted);">Your Full Name</label>
            <input id="inName" type="text" placeholder="e.g. Priya or Rahul" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--line); background:var(--bg-2); color:#fff;" required />
          </div>
          <div style="margin-bottom:12px;">
            <label style="font-size:12px; color:var(--muted);">Gender</label>
            <select id="inGender" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--line); background:var(--bg-2); color:#fff;" required>
              <option value="">Select Gender</option>
              <option value="woman">Woman</option>
              <option value="man">Man</option>
            </select>
          </div>
          <div style="margin-bottom:16px;">
            <label style="font-size:12px; color:var(--muted);">Zodiac Sign</label>
            <select id="inZodiac" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--line); background:var(--bg-2); color:#fff;">
              <option value="Aries">Aries ♈</option>
              <option value="Taurus">Taurus ♉</option>
              <option value="Gemini">Gemini ♊</option>
              <option value="Cancer">Cancer ♋</option>
              <option value="Leo">Leo ♌</option>
              <option value="Virgo">Virgo ♍</option>
              <option value="Libra">Libra ♎</option>
              <option value="Scorpio">Scorpio ♏</option>
              <option value="Sagittarius">Sagittarius ♐</option>
              <option value="Capricorn">Capricorn ♑</option>
              <option value="Aquarius">Aquarius ♒</option>
              <option value="Pisces">Pisces ♓</option>
            </select>
          </div>
          <button type="submit" style="width:100%; padding:12px; border-radius:8px; background:var(--gold); color:#120f26; font-weight:600; border:none; cursor:pointer;">Begin Scenarios →</button>
        </form>

        <hr style="border:0; border-top:1px solid var(--line); margin:24px 0;">

        <div style="text-align:center;">
          <p style="font-size:13px; color:var(--muted); margin-bottom:8px;">Already registered? Enter your Member ID to jump straight back in:</p>
          <div style="display:flex; gap:8px;">
            <input id="inputMemberId" type="text" placeholder="e.g. circle_x89a" style="flex:1; padding:8px; border-radius:8px; border:1px solid var(--line); background:var(--bg-2); color:#fff;" />
            <button onclick="resumeByID()" style="padding:8px 16px; border-radius:8px; background:var(--surface-2); color:var(--gold); border:1px solid var(--gold); cursor:pointer;">Enter Chat</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (screen === 'quiz') {
    const q = QUESTIONS[quizIndex];
    const quote = QUOTES[quizIndex % QUOTES.length];

    app.innerHTML = `
      <div class="card">
        <div style="background:rgba(217,180,106,0.1); border-left:3px solid var(--gold); padding:10px 14px; border-radius:6px; font-style:italic; font-size:13px; color:var(--gold-soft); margin-bottom:20px;">
          ${quote}
        </div>

        <div style="display:flex; justify-space-between; align-items:center; margin-bottom:12px;">
          <span class="eyebrow">${q.title}</span>
          <span style="font-size:12px; color:var(--muted);">Question ${quizIndex + 1} of ${QUESTIONS.length}</span>
        </div>
        
        <h3 style="margin:0 0 16px 0;">${q.prompt}</h3>

        <div style="display:flex; flex-direction:column; gap:10px;">
          ${q.options.map(opt => `
            <button onclick="answerQuiz('${q.key}', ${opt.val})" style="text-align:left; padding:12px 16px; border-radius:10px; border:1px solid var(--line); background:var(--surface); color:var(--text); cursor:pointer;">
              ${esc(opt.text)}
            </button>
          `).join('')}
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:20px;">
          ${quizIndex > 0 ? `<button onclick="prevQuiz()" style="padding:8px 16px; background:none; border:1px solid var(--line); color:var(--muted); border-radius:6px; cursor:pointer;">← Previous</button>` : `<div></div>`}
        </div>
      </div>
    `;
    return;
  }

  if (screen === 'lobby') {
    app.innerHTML = `
      <div class="card" style="text-align:center;">
        <div class="eyebrow">Circle Lobby</div>
        <h2>Waiting for Matches</h2>
        <p style="color:var(--muted); font-size:14px;">Your profile and logical scenario responses are active. Click below to reveal your compatibility match!</p>
        
        <div style="background:var(--bg-2); padding:12px; border-radius:8px; border:1px dashed var(--gold); margin:20px 0; word-break:break-all;">
          <span style="font-size:11px; color:var(--muted); display:block;">YOUR MEMBER ID (Save this to return anytime)</span>
          <strong style="color:var(--gold); font-size:18px;">${myId}</strong>
        </div>

        <button onclick="triggerReveal()" style="width:100%; padding:14px; border-radius:8px; background:var(--gold); color:#120f26; font-weight:600; border:none; cursor:pointer;">Reveal Matches & Enter Chat →</button>
      </div>
    `;
    return;
  }

  if (screen === 'chat') {
    app.innerHTML = `
      <div class="card">
        <div id="statusBanner" style="background:rgba(217,180,106,0.12); border:1px solid var(--gold); padding:10px 14px; border-radius:8px; margin-bottom:16px;">
          💬 <strong>Match Connected!</strong><br>
          <span style="font-size:12px; color:var(--muted);">Take your time to chat here or exchange socials/numbers to move to another platform!</span>
        </div>

        <div id="chatBox" style="height:320px; overflow-y:auto; background:var(--bg-2); border:1px solid var(--line); border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="color:var(--muted); font-size:13px; text-align:center;">Loading conversation...</div>
        </div>

        <div style="display:flex; gap:8px;">
          <input id="chatInput" type="text" placeholder="Type a message..." style="flex:1; padding:10px; border-radius:8px; border:1px solid var(--line); background:var(--bg-2); color:#fff;" onkeypress="if(event.key==='Enter') sendChat();" />
          <button onclick="sendChat()" style="padding:10px 20px; border-radius:8px; background:var(--gold); color:#120f26; font-weight:600; border:none; cursor:pointer;">Send</button>
        </div>
      </div>
    `;
    loadChat();
    return;
  }
}

async function submitLanding() {
  const name = document.getElementById('inName').value;
  const gender = document.getElementById('inGender').value;
  const zodiac = document.getElementById('inZodiac').value;

  try {
    const res = await api('/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, gender, zodiac })
    });
    myId = res.id;
    localStorage.setItem('circleMemberId', myId);
    screen = 'quiz';
    render();
  } catch (e) {
    alert(e.message);
  }
}

function answerQuiz(key, val) {
  quizAnswers[key] = val;
  if (quizIndex < QUESTIONS.length - 1) {
    quizIndex++;
    render();
  } else {
    finishQuiz();
  }
}

function prevQuiz() {
  if (quizIndex > 0) {
    quizIndex--;
    render();
  }
}

async function finishQuiz() {
  try {
    await api('/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: myId, answers: quizAnswers })
    });
    screen = 'lobby';
    render();
  } catch (e) {
    alert(e.message);
  }
}

async function triggerReveal() {
  try {
    const st = await api('/reveal', { method: 'POST' });
    const myPair = st.pairs.find(p => p.womanId === myId || p.manId === myId);
    if (myPair) {
      screen = 'chat';
    } else {
      alert('Matches revealed! Checking your pair status...');
      screen = 'lobby';
    }
    render();
    startPolling();
  } catch (e) {
    alert(e.message);
  }
}

async function loadChat() {
  try {
    const st = await api('/state');
    const myPair = st.pairs.find(p => p.womanId === myId || p.manId === myId);
    if (!myPair) return;

    const res = await api(`/chat/${myPair.womanId}/${myPair.manId}`);
    const box = document.getElementById('chatBox');
    if (!box) return;

    box.innerHTML = res.messages.map(m => `
      <div style="margin-bottom:10px; text-align:${m.sender === myId ? 'right' : m.sender === 'system' ? 'center' : 'left'};">
        <span style="font-size:10.5px; color:var(--muted);">${esc(m.senderName)} • ${m.time}</span>
        <div style="background:${m.sender === myId ? 'var(--gold)' : m.sender === 'system' ? 'rgba(217,180,106,0.15)' : 'var(--surface-2)'}; 
                    color:${m.sender === myId ? '#120f26' : 'var(--text)'}; 
                    display:inline-block; padding:8px 12px; border-radius:10px; max-width:85%; font-size:13.5px;
                    border:${m.sender === 'system' ? '1px dashed var(--gold)' : 'none'}; margin-top:2px;">
          ${esc(m.text)}
        </div>
      </div>
    `).join('') || '<div style="color:var(--muted); font-size:13px;">No messages yet.</div>';

    box.scrollTop = box.scrollHeight;
  } catch (e) {}
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input ? input.value.trim() : '';
  if (!text) return;

  try {
    const st = await api('/state');
    const myPair = st.pairs.find(p => p.womanId === myId || p.manId === myId);
    if (!myPair) return;

    const me = await api(`/me/${myId}`);
    await api(`/chat/${myPair.womanId}/${myPair.manId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: myId, senderName: me.name || 'You', text })
    });

    input.value = '';
    loadChat();
  } catch (e) {}
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (screen === 'chat') loadChat();
  }, 2500);
}

// Start app
checkSession();
