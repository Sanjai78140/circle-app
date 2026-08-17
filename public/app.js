const app = document.getElementById('app');
let myId = localStorage.getItem('circleMemberId') || null;
let quizAnswers = {};
let quizIndex = 0;
let screen = 'landing';
let pollTimer = null;
let fortuneTimer = null;
let fortuneIndex = 0;
let hasNotifiedMatch = false;
let pushAttempted = false;

const FORTUNES = [
  "🌙 The right people are already circling toward you.",
  "✨ Good energy attracts good energy — you're in the right room.",
  "🍀 Someone in this circle is hoping you don't leave before reveal.",
  "💫 Patience now, spark later.",
  "🔥 The best conversations start with the smallest bit of courage.",
  "🌸 You don't need to be everyone's match — just one honest one.",
  "🎲 Every round shuffles the universe a little. This could be yours."
];

const QUOTES = [
  "“A meaningful connection starts with an open heart and a curious mind.”",
  "“Logic helps you navigate the world; intuition leads you to the right person.”",
  "“The right partner doesn’t complete you—they complement your growth.”",
  "“Great conversations are born when two people listen with genuine care.”",
  "“Patience in love always brings clarity.”"
];

const QUESTIONS = [
  { key: 'about_me', title: '1. Core Energy', prompt: 'How would your best friends describe your core energy in one line?', options: [{ text: 'A) Warm, calm, reliable, and deeply grounded.', val: 1 }, { text: 'B) Energetic, witty, hyper, and full of life.', val: 2 }, { text: 'C) Creative, thoughtful, analytical, and reserved.', val: 3 }, { text: 'D) Adaptable, spontaneous, and up for anything!', val: 4 }] },
  { key: 'social_battery', title: '2. Social Battery', prompt: 'After a demanding week, how do you naturally recharge best?', options: [{ text: 'A) Cozy downtime alone at home with movies or music.', val: 1 }, { text: 'B) Catching up with 1 or 2 close friends for deep conversation.', val: 2 }, { text: 'C) Heading out to a lively social gathering or party.', val: 3 }] },
  { key: 'taste_food', title: '3. Food Choice Vibe 🍛', prompt: 'Sunday evening comfort dinner choice: Hot Biriyani or Crispy Parotta?', options: [{ text: 'A) Hot, aromatic Biriyani — Nothing beats it! 🍲', val: 1 }, { text: 'B) Flaky, hot Parotta with rich curry! 🥐', val: 2 }, { text: 'C) Healthy home-cooked comfort meal.', val: 3 }, { text: 'D) Cafe aesthetic burgers & pastas.', val: 4 }] },
  { key: 'music_vibe', title: '4. Musical Soul 🎵', prompt: 'On a late-night drive, which music vibe is playing on your speaker?', options: [{ text: 'A) Soulful & Melodic classics (SaNa / Harris / ARR vibes) ✨', val: 1 }, { text: 'B) Energetic, upbeat beats (Anirudh EDM & party tracks) ⚡', val: 2 }, { text: 'C) Lo-fi beats, indie pop, and chill acoustic jams 🎧', val: 3 }, { text: 'D) Rock, Hip-Hop, and high-energy rap 🎸', val: 4 }] },
  { key: 'ideal_self', title: '5. Personal Nurture', prompt: 'What quality are you actively trying to nurture in your life right now?', options: [{ text: 'A) Inner peace, emotional stability, and mindfulness.', val: 1 }, { text: 'B) Unstoppable ambition, focus, and career growth.', val: 2 }, { text: 'C) Spontaneity, living in the moment, and adventure.', val: 3 }] },
  { key: 'growth_mindset', title: '6. Personal Evolution', prompt: 'When you reflect on yourself over the past 3 years, what changed most?', options: [{ text: 'A) I became much calmer and handle stress with logic.', val: 1 }, { text: 'B) I became more clear on my boundaries and self-worth.', val: 2 }, { text: 'C) I became more open-minded and adventurous.', val: 3 }] },
  { key: 'thought_depth', title: '7. Night Thoughts', prompt: 'What keeps your mind wandering during quiet moments late at night?', options: [{ text: 'A) Analyzing life goals, future security, and career plans.', val: 1 }, { text: 'B) Thinking about human connection, emotions, and memories.', val: 2 }, { text: 'C) Wondering about the universe, philosophy, and big ideas.', val: 3 }] },
  { key: 'conflict_logic', title: '8. Disagreement Logic', prompt: 'If you and a partner hold opposite opinions on a big topic, how do you handle it?', options: [{ text: 'A) Lay out facts logically to find an objective solution.', val: 1 }, { text: 'B) Prioritize emotional harmony over being right.', val: 2 }, { text: 'C) Discuss openly until a 50/50 fair compromise is found.', val: 3 }] },
  { key: 'financial_logic', title: '9. Money Logic', prompt: 'What is your logical approach toward saving vs. enjoying money?', options: [{ text: 'A) Strict budget: Save first, spend what remains.', val: 1 }, { text: 'B) Balanced: Save comfortably while enjoying life today.', val: 2 }, { text: 'C) Experience-driven: Invest heavily in travel and memories.', val: 3 }] },
  { key: 'partner_trait', title: '10. Non-Negotiable', prompt: 'What is the absolute non-negotiable trait you need in a partner?', options: [{ text: 'A) High emotional intelligence, honesty, and empathy.', val: 1 }, { text: 'B) Sharp humor, quick wit, and playful banter.', val: 2 }, { text: 'C) Ambition, independence, and strong drive.', val: 3 }] },
  { key: 'vibe_check', title: '11. Dynamic Vibe', prompt: 'Which partner dynamic excites you most?', options: [{ text: 'A) Best friends who laugh together and banter all day.', val: 1 }, { text: 'B) Power couple who support each other’s huge dreams.', val: 2 }, { text: 'C) Deep soulmates connected by quiet understanding.', val: 3 }] },
  { key: 'love_language', title: '12. Love Language', prompt: 'Which gesture makes you feel most genuinely loved and valued?', options: [{ text: 'A) Meaningful words of appreciation and genuine compliments.', val: 1 }, { text: 'B) Dedicated quality time with zero phone distractions.', val: 2 }, { text: 'C) Thoughtful actions and practical help when needed.', val: 3 }] },
  { key: 'communication_style', title: '13. Texting Pattern', prompt: 'What is your ideal daily communication pattern when apart?', options: [{ text: 'A) Frequent text updates throughout the day.', val: 1 }, { text: 'B) A few meaningful check-ins or an evening phone call.', val: 2 }, { text: 'C) Low texting — saving stories to share in person.', val: 3 }] },
  { key: 'weekend_energy', title: '14. Perfect Weekend', prompt: 'What does your ultimate Saturday look like?', options: [{ text: 'A) Exploring new coffee shops, long drives, and sightseeing.', val: 1 }, { text: 'B) Binge-watching shows, gaming, and relaxing at home.', val: 2 }, { text: 'C) Trying out new dining spots or nightlife with friends.', val: 3 }] },
  { key: 'travel_style', title: '15. Travel Style', prompt: 'When going on a getaway trip, how do you travel?', options: [{ text: 'A) Fully planned itinerary with every spot mapped.', val: 1 }, { text: 'B) Rough outline with plenty of spontaneous choices.', val: 2 }, { text: 'C) Zero planning — figure out everything on arrival!', val: 3 }] },
  { key: 'humor_style', title: '16. Humor Connection', prompt: 'What kind of jokes guaranteed to make you laugh out loud?', options: [{ text: 'A) Witty sarcasm, quick banter, and clever comebacks.', val: 1 }, { text: 'B) Relatable memes, silly stories, and goofy antics.', val: 2 }, { text: 'C) Dark, dry, or observational humor.', val: 3 }] },
  { key: 'trust_pace', title: '17. Opening Up', prompt: 'How quickly do you open up your heart to someone new?', options: [{ text: 'A) Quickly if the energy and vibe feel genuine.', val: 1 }, { text: 'B) Gradually over time as trust is built step-by-step.', val: 2 }, { text: 'C) Very carefully until total safety is established.', val: 3 }] },
  { key: 'spontaneity', title: '18. Late Night Drive', prompt: 'Your partner suggests an unplanned late-night drive right now. You say:', options: [{ text: 'A) "Let’s go right now! Grab your coat!" 🚗', val: 1 }, { text: 'B) "Sounds fun! Give me 10 mins to get ready."', val: 2 }, { text: 'C) "Can we plan it for tomorrow instead?"', val: 3 }] },
  { key: 'future_vision', title: '19. Life Philosophy', prompt: 'Which quote best mirrors your personal life motto?', options: [{ text: 'A) "Work hard, stay humble, and grow every single day."', val: 1 }, { text: 'B) "Prioritize peace, good health, and genuine happiness."', val: 2 }, { text: 'C) "Collect experiences and memories, not things."', val: 3 }] },
  { key: 'relationship_goal', title: '20. Your Intent', prompt: 'What are you primarily looking to find here today?', options: [{ text: 'A) A genuine, meaningful long-term relationship.', val: 1 }, { text: 'B) Authentic dating to see where natural chemistry goes.', val: 2 }, { text: 'C) Connecting with cool, like-minded people first.', val: 3 }] }
];

function esc(str) { return str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; }

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  if (!res.ok) throw new Error('API Request Failed');
  return res.json();
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

// Real Web Push — fires even if the tab/browser is closed, unlike the
// foreground-only Notification calls above. Silently no-ops on browsers
// that don't support it, or if the user hasn't granted permission; the
// in-tab fallback (sendMatchNotification) still covers that case.
async function registerPush() {
  if (pushAttempted || !myId) return;
  pushAttempted = true;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const { key } = await api('/push/vapidPublicKey');
    if (!key) return;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });
    }

    await api('/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: myId, subscription: sub })
    });
  } catch (e) {
    // Push isn't critical — the app still works fine without it.
  }
}

function sendMatchNotification(partnerName, score) {
  if (hasNotifiedMatch) return;
  hasNotifiedMatch = true;
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("🔥 BOOM! MATCH CONNECTED! 🎉", {
      body: `You are paired with ${partnerName}! ${score}% Compatibility score! Tap to enter chat now!`,
      icon: 'https://cdn-icons-png.flaticon.com/512/2589/2589175.png'
    });
  }
}

async function checkSession() {
  requestNotificationPermission();
  if (!myId) { screen = 'landing'; render(); return; }
  try {
    const me = await api(`/me/${myId}`);
    const st = await api('/state');
    registerPush();
    if (st.locked) {
      const myPair = st.pairs.find(p => p.womanId === myId || p.manId === myId);
      if (myPair) { screen = 'chat'; render(); startPolling(); return; }
    }
    screen = me.complete ? 'lobby' : 'quiz';
    render();
    startPolling();
  } catch (e) {
    localStorage.removeItem('circleMemberId');
    myId = null;
    screen = 'landing';
    render();
  }
}

async function resumeByID() {
  const input = document.getElementById('inputMemberId');
  const val = input ? input.value.trim() : '';
  if (!val) return alert('Enter a valid Member ID');

  try {
    const me = await api(`/me/${val}`);
    myId = val;
    localStorage.setItem('circleMemberId', myId);
    const st = await api('/state');
    registerPush();
    if (st.locked) {
      const myPair = st.pairs.find(p => p.womanId === myId || p.manId === myId);
      if (myPair) { screen = 'chat'; render(); startPolling(); return; }
    }
    screen = me.complete ? 'lobby' : 'quiz';
    render();
    startPolling();
  } catch (e) {
    alert('Member ID not found.');
  }
}

function render() {
  if (!app) return;

  if (screen === 'landing') {
    app.innerHTML = `
      <div class="card">
        <div class="eyebrow">✨ Synchronized Squad Matching</div>
        <h1 style="margin-top:0;">The Circle</h1>
        <p style="color:var(--muted); font-size:14px;">Answer 20 scenario questions to get paired at a guaranteed minimum 75% compatibility threshold.</p>
        
        <form onsubmit="event.preventDefault(); submitLanding();">
          <div style="margin-bottom:12px;">
            <label style="font-size:12px; color:var(--muted);">Full Name</label>
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
              <option value="Aries">Aries ♈</option><option value="Taurus">Taurus ♉</option>
              <option value="Gemini">Gemini ♊</option><option value="Cancer">Cancer ♋</option>
              <option value="Leo">Leo ♌</option><option value="Virgo">Virgo ♍</option>
              <option value="Libra">Libra ♎</option><option value="Scorpio">Scorpio ♏</option>
              <option value="Sagittarius">Sagittarius ♐</option><option value="Capricorn">Capricorn ♑</option>
              <option value="Aquarius">Aquarius ♒</option><option value="Pisces">Pisces ♓</option>
            </select>
          </div>
          <button type="submit" style="width:100%; padding:12px; border-radius:8px; background:var(--gold); color:#120f26; font-weight:600; border:none; cursor:pointer;">Begin 20 Scenarios →</button>
        </form>

        <hr style="border:0; border-top:1px solid var(--line); margin:20px 0;">

        <div style="text-align:center;">
          <p style="font-size:12px; color:var(--muted); margin-bottom:8px;">Have an active Member ID? Enter here:</p>
          <div style="display:flex; gap:8px;">
            <input id="inputMemberId" type="text" placeholder="e.g. circle_x89a" style="flex:1; padding:8px; border-radius:8px; border:1px solid var(--line); background:var(--bg-2); color:#fff;" />
            <button onclick="resumeByID()" style="padding:8px 16px; border-radius:8px; background:var(--surface-2); color:var(--gold); border:1px solid var(--gold); cursor:pointer;">Direct Chat</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (screen === 'quiz') {
    const q = QUESTIONS[quizIndex];
    app.innerHTML = `
      <div class="card">
        <div style="background:rgba(217,180,106,0.1); border-left:3px solid var(--gold); padding:10px 14px; border-radius:6px; font-style:italic; font-size:13px; color:var(--gold-soft); margin-bottom:20px;">
          ${QUOTES[quizIndex % QUOTES.length]}
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
          <span class="eyebrow">${q.title}</span>
          <span style="font-size:12px; color:var(--muted);">${quizIndex + 1} / ${QUESTIONS.length}</span>
        </div>
        <h3 style="margin:0 0 16px 0;">${q.prompt}</h3>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${q.options.map(opt => `
            <button onclick="answerQuiz('${q.key}', ${opt.val})" style="text-align:left; padding:12px 16px; border-radius:10px; border:1px solid var(--line); background:var(--surface); color:var(--text); cursor:pointer;">
              ${esc(opt.text)}
            </button>
          `).join('')}
        </div>
      </div>
    `;
    return;
  }

  if (screen === 'lobby') {
    api('/state').then(st => {
      if (st.locked) {
        const myPair = st.pairs.find(p => p.womanId === myId || p.manId === myId);
        if (myPair) {
          sendMatchNotification(myPair.womanId === myId ? myPair.manName : myPair.womanName, myPair.score);
          screen = 'chat';
          render();
          return;
        }
      }

      const count = st.count || 0;
      const capacity = st.capacity || 10;
      const pct = Math.min(100, Math.round((count / capacity) * 100));

      app.innerHTML = `
        <div class="card" style="text-align:center;">
          <div class="eyebrow">Circle Lobby • Round ${st.round}</div>
          <h2 style="margin-top:4px;">Waiting for Synchronized Match</h2>
          <p style="color:var(--muted); font-size:14px;">Your responses are stored! Matches require a strict <strong>75% compatibility cutoff</strong>.</p>

          <div style="margin:18px 0;">
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--muted); margin-bottom:6px;">
              <span>Squad Capacity</span>
              <span style="color:var(--gold); font-weight:700;">${count} / ${capacity} Joined</span>
            </div>
            <div style="width:100%; height:10px; background:var(--bg-2); border-radius:20px; overflow:hidden; border:1px solid var(--line);">
              <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, var(--gold), var(--gold-soft)); transition:width 0.6s ease;"></div>
            </div>
          </div>

          <div id="fortuneBox" style="background:rgba(217,180,106,0.1); border-left:3px solid var(--gold); padding:10px 14px; border-radius:6px; font-style:italic; font-size:13px; color:var(--gold-soft); margin-bottom:18px; min-height:20px; transition:opacity 0.25s ease;">
            ${FORTUNES[fortuneIndex % FORTUNES.length]}
          </div>

          <div style="background:var(--bg-2); padding:12px; border-radius:8px; margin:20px 0;">
            <span style="font-size:11px; color:var(--muted); display:block;">YOUR MEMBER ID</span>
            <strong style="color:var(--gold); font-size:18px;">${myId}</strong>
            <span style="font-size:11px; color:var(--muted); display:block; margin-top:4px;">Save this — use it to jump straight back into your chat later.</span>
          </div>

          <button onclick="triggerReveal()" style="width:100%; padding:14px; border-radius:8px; background:var(--gold); color:#120f26; font-weight:600; border:none; cursor:pointer;">Reveal Squad Matches Now →</button>
        </div>
      `;
      startFortuneRotation();
    });
    return;
  }

  if (screen === 'chat') {
    api('/state').then(st => {
      const myPair = st.pairs.find(p => p.womanId === myId || p.manId === myId);
      const partnerName = myPair ? (myPair.womanId === myId ? myPair.manName : myPair.womanName) : 'Match';
      const score = myPair ? myPair.score : 75;
      const summary = myPair ? myPair.summary : '✨ Match created with strong harmony!';
      const badges = myPair && myPair.badges ? myPair.badges : [];
      const icebreaker = myPair ? myPair.icebreaker : null;

      const badgeHtml = badges.length ? `
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">
          ${badges.map(b => `<span style="background:rgba(255,255,255,0.08); border:1px solid var(--line); border-radius:20px; padding:3px 10px; font-size:11px;">${esc(b)}</span>`).join('')}
        </div>
      ` : '';

      const icebreakerHtml = icebreaker ? `
        <button onclick="useIcebreaker(this)" data-text="${esc(icebreaker)}" style="width:100%; text-align:left; margin-bottom:12px; padding:10px 14px; border-radius:10px; background:rgba(217,180,106,0.08); border:1px dashed var(--gold); color:var(--gold-soft); font-size:12px; cursor:pointer;">
          💡 <strong>Icebreaker:</strong> ${esc(icebreaker)} <span style="color:var(--muted); float:right;">tap to use</span>
        </button>
      ` : '';

      app.innerHTML = `
        <div class="card">
          <div style="background: linear-gradient(135deg, rgba(217,180,106,0.18), rgba(120,60,180,0.18)); border:1px solid var(--gold); padding:16px; border-radius:12px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <strong style="color:var(--gold); font-size:16px;">💖 Connected with ${esc(partnerName)}</strong>
              <span style="background:var(--gold); color:#120f26; font-weight:700; font-size:12px; padding:3px 10px; border-radius:20px;">${score}% Match</span>
            </div>
            <p style="font-size:13px; color:#e2d9f3; margin:0; line-height:1.4; font-style:italic;">"${esc(summary)}"</p>
            ${badgeHtml}
          </div>

          ${icebreakerHtml}

          <div id="chatBox" style="height:320px; overflow-y:auto; background:var(--bg-2); border:1px solid var(--line); border-radius:10px; padding:12px; margin-bottom:12px;"></div>

          <div style="display:flex; gap:8px;">
            <input id="chatInput" type="text" placeholder="Say hello..." style="flex:1; padding:10px; border-radius:8px; border:1px solid var(--line); background:var(--bg-2); color:#fff;" onkeypress="if(event.key==='Enter') sendChat();" />
            <button onclick="sendChat()" style="padding:10px 18px; border-radius:8px; background:var(--gold); color:#120f26; font-weight:600; border:none; cursor:pointer;">Send</button>
          </div>
        </div>
      `;
      loadChat();
    });
    return;
  }
}

async function submitLanding() {
  const name = document.getElementById('inName').value;
  const gender = document.getElementById('inGender').value;
  const zodiac = document.getElementById('inZodiac').value;

  const res = await api('/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, gender, zodiac }) });
  myId = res.id;
  localStorage.setItem('circleMemberId', myId);
  screen = 'quiz';
  render();
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

async function finishQuiz() {
  await api('/answers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: myId, answers: quizAnswers }) });
  screen = 'lobby';
  render();
  startPolling();
}

async function triggerReveal() {
  const st = await api('/reveal', { method: 'POST' });
  const myPair = st.pairs.find(p => p.womanId === myId || p.manId === myId);
  if (myPair) {
    sendMatchNotification(myPair.womanId === myId ? myPair.manName : myPair.womanName, myPair.score);
    screen = 'chat';
  } else {
    alert('No match reached the 75% threshold in this round yet. You will stay safely in the lobby for incoming members!');
    screen = 'lobby';
  }
  render();
}

async function loadChat() {
  const st = await api('/state');
  const myPair = st.pairs.find(p => p.womanId === myId || p.manId === myId);
  if (!myPair) return;

  const res = await api(`/chat/${myPair.womanId}/${myPair.manId}`);
  const box = document.getElementById('chatBox');
  if (!box) return;

  box.innerHTML = res.messages.map(m => `
    <div style="margin-bottom:10px; text-align:${m.sender === myId ? 'right' : m.sender === 'system' ? 'center' : 'left'};">
      <span style="font-size:10px; color:var(--muted);">${esc(m.senderName)} • ${m.time}</span>
      <div style="background:${m.sender === myId ? 'var(--gold)' : m.sender === 'system' ? 'rgba(217,180,106,0.15)' : 'var(--surface-2)'}; 
                  color:${m.sender === myId ? '#120f26' : 'var(--text)'}; 
                  display:inline-block; padding:8px 12px; border-radius:10px; max-width:85%; font-size:13px;
                  border:${m.sender === 'system' ? '1px dashed var(--gold)' : 'none'};">
        ${esc(m.text)}
      </div>
    </div>
  `).join('');
  box.scrollTop = box.scrollHeight;
}

function useIcebreaker(btn) {
  const input = document.getElementById('chatInput');
  if (!input) return;
  input.value = btn.getAttribute('data-text') || '';
  input.focus();
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input ? input.value.trim() : '';
  if (!text) return;

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
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (screen === 'lobby') render();
    if (screen === 'chat') loadChat();
  }, 2500);
}

function startFortuneRotation() {
  if (fortuneTimer) clearInterval(fortuneTimer);
  fortuneTimer = setInterval(() => {
    if (screen !== 'lobby') { clearInterval(fortuneTimer); return; }
    fortuneIndex++;
    const box = document.getElementById('fortuneBox');
    if (box) {
      box.style.opacity = '0';
      setTimeout(() => {
        box.textContent = FORTUNES[fortuneIndex % FORTUNES.length];
        box.style.opacity = '1';
      }, 250);
    }
  }, 4000);
}

window.addEventListener('DOMContentLoaded', () => { checkSession(); });
