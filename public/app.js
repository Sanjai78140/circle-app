const app = document.getElementById('app');
let myId = localStorage.getItem('circleMemberId') || null;
let quizAnswers = {};
let quizIndex = 0;
let screen = 'loading';
let pollTimer = null;
let hasNotifiedMatch = false;

const QUOTES = [
  "“A meaningful connection starts with an open heart and a curious mind.”",
  "“Logic helps you navigate the world; intuition leads you to the right person.”",
  "“The right partner doesn’t complete you—they complement your growth.”",
  "“Great conversations are born when two people listen with genuine care.”",
  "“Patience in love always brings clarity.”",
  "“Food tastes better, songs hit deeper, and life feels brighter with the right vibe.”",
  "“Chemistry is equal parts mindset, shared laughter, and mutual respect.”"
];

// 20 ALL-INCLUSIVE QUESTIONS
const QUESTIONS = [
  // SECTION 1: ABOUT THEMSELVES
  {
    key: 'about_me',
    title: '1. About You',
    prompt: 'How would your best friends describe your core energy in one line?',
    options: [
      { text: 'A) Warm, calm, reliable, and deeply grounded.', val: 1 },
      { text: 'B) Energetic, witty, hyper, and full of life.', val: 2 },
      { text: 'C) Creative, thoughtful, analytical, and reserved.', val: 3 },
      { text: 'D) Adaptable, spontaneous, and up for anything!', val: 4 }
    ]
  },
  {
    key: 'social_battery',
    title: '2. Your Social Battery',
    prompt: 'After a demanding week, how do you naturally recharge best?',
    options: [
      { text: 'A) Cozy downtime alone at home with movies or music.', val: 1 },
      { text: 'B) Catching up with 1 or 2 close friends for deep conversation.', val: 2 },
      { text: 'C) Heading out to a lively social gathering or party.', val: 3 }
    ]
  },

  // SECTION 2: FOOD & MUSIC TASTES
  {
    key: 'taste_food',
    title: '3. Food Choice Vibe 🍛',
    prompt: 'Sunday evening comfort dinner choice: Hot Biriyani or Crispy Parotta?',
    options: [
      { text: 'A) Hot, aromatic Biriyani — Nothing beats it! 🍲', val: 1 },
      { text: 'B) Flaky, hot Parotta with rich curry! 🥐', val: 2 },
      { text: 'C) Healthy home-cooked comfort meal.', val: 3 },
      { text: 'D) Cafe aesthetic burgers & pastas.', val: 4 }
    ]
  },
  {
    key: 'music_vibe',
    title: '4. Musical Soul 🎵',
    prompt: 'On a late-night drive, which music vibe is playing on your speaker?',
    options: [
      { text: 'A) Soulful & Melodic classics (SaNa / Harris / ARR vibes) ✨', val: 1 },
      { text: 'B) Energetic, upbeat beats (Anirudh EDM & party tracks) ⚡', val: 2 },
      { text: 'C) Lo-fi beats, indie pop, and chill acoustic jams 🎧', val: 3 },
      { text: 'D) Rock, Hip-Hop, and high-energy rap 🎸', val: 4 }
    ]
  },

  // SECTION 3: IDEAL SELF & HOW THEY WANT TO BE
  {
    key: 'ideal_self',
    title: '5. How You Want To Be',
    prompt: 'What quality are you actively trying to nurture in your life right now?',
    options: [
      { text: 'A) Inner peace, emotional stability, and mindfulness.', val: 1 },
      { text: 'B) Unstoppable ambition, focus, and career growth.', val: 2 },
      { text: 'C) Spontaneity, living in the moment, and adventure.', val: 3 },
      { text: 'D) Deeper empathy, warmth, and strong relationships.', val: 4 }
    ]
  },
  {
    key: 'growth_mindset',
    title: '6. Personal Evolution',
    prompt: 'When you reflect on yourself over the past 3 years, what changed most?',
    options: [
      { text: 'A) I became much calmer and handle stress with logic.', val: 1 },
      { text: 'B) I became more clear on my boundaries and self-worth.', val: 2 },
      { text: 'C) I became more open-minded and adventurous.', val: 3 }
    ]
  },

  // SECTION 4: DEEP THOUGHTS & LOGIC
  {
    key: 'thought_depth',
    title: '7. Deep Thought Perspective',
    prompt: 'What keeps your mind wandering during quiet moments late at night?',
    options: [
      { text: 'A) Analyzing life goals, future security, and career plans.', val: 1 },
      { text: 'B) Thinking about human connection, emotions, and memories.', val: 2 },
      { text: 'C) Wondering about the universe, philosophy, and big ideas.', val: 3 }
    ]
  },
  {
    key: 'conflict_logic',
    title: '8. Logic Under Disagreement',
    prompt: 'If you and a partner hold opposite opinions on a big topic, how do you handle it?',
    options: [
      { text: 'A) Lay out facts logically to find an objective solution.', val: 1 },
      { text: 'B) Prioritize emotional harmony over being right.', val: 2 },
      { text: 'C) Discuss openly until a 50/50 fair compromise is found.', val: 3 },
      { text: 'D) Take personal space first, then process calmly together.', val: 4 }
    ]
  },
  {
    key: 'financial_logic',
    title: '9. Money & Life Logic',
    prompt: 'What is your logical approach toward saving vs. enjoying money?',
    options: [
      { text: 'A) Strict budget: Save first, spend what remains.', val: 1 },
      { text: 'B) Balanced: Save comfortably while enjoying life today.', val: 2 },
      { text: 'C) Experience-driven: Invest heavily in travel and memories.', val: 3 }
    ]
  },

  // SECTION 5: ABOUT THEIR PARTNER PREFERENCES
  {
    key: 'partner_trait',
    title: '10. What You Look For',
    prompt: 'What is the absolute non-negotiable trait you need in a partner?',
    options: [
      { text: 'A) High emotional intelligence, honesty, and empathy.', val: 1 },
      { text: 'B) Sharp humor, quick wit, and playful banter.', val: 2 },
      { text: 'C) Ambition, independence, and strong drive.', val: 3 },
      { text: 'D) Calm, stable, and reassuring presence.', val: 4 }
    ]
  },
  {
    key: 'vibe_check',
    title: '11. Ideal Partner Vibe',
    prompt: 'Which partner dynamic excites you most?',
    options: [
      { text: 'A) Best friends who laugh together and banter all day.', val: 1 },
      { text: 'B) Power couple who support each other’s huge dreams.', val: 2 },
      { text: 'C) Deep soulmates connected by quiet understanding.', val: 3 }
    ]
  },
  {
    key: 'love_language',
    title: '12. Love Expression',
    prompt: 'Which gesture makes you feel most genuinely loved and valued?',
    options: [
      { text: 'A) Meaningful words of appreciation and genuine compliments.', val: 1 },
      { text: 'B) Dedicated quality time with zero phone distractions.', val: 2 },
      { text: 'C) Thoughtful actions and practical help when needed.', val: 3 },
      { text: 'D) Warm physical proximity and comforting hugs.', val: 4 }
    ]
  },

  // SECTION 6: LIFESTYLE & COMMUNICATION
  {
    key: 'communication_style',
    title: '13. Texting & Calls',
    prompt: 'What is your ideal daily communication pattern when apart?',
    options: [
      { text: 'A) Frequent text updates throughout the day.', val: 1 },
      { text: 'B) A few meaningful check-ins or an evening phone call.', val: 2 },
      { text: 'C) Low texting — saving stories to share in person.', val: 3 }
    ]
  },
  {
    key: 'weekend_energy',
    title: '14. Perfect Saturday',
    prompt: 'What does your ultimate Saturday look like?',
    options: [
      { text: 'A) Exploring new coffee shops, long drives, and sightseeing.', val: 1 },
      { text: 'B) Binge-watching shows, gaming, and relaxing at home.', val: 2 },
      { text: 'C) Trying out new dining spots or nightlife with friends.', val: 3 }
    ]
  },
  {
    key: 'travel_style',
    title: '15. Travel Style',
    prompt: 'When going on a getaway trip, how do you travel?',
    options: [
      { text: 'A) Fully planned itinerary with every spot mapped.', val: 1 },
      { text: 'B) Rough outline with plenty of spontaneous choices.', val: 2 },
      { text: 'C) Zero planning — figure out everything on arrival!', val: 3 }
    ]
  },
  {
    key: 'humor_style',
    title: '16. Humor Connection',
    prompt: 'What kind of jokes guaranteed to make you laugh out loud?',
    options: [
      { text: 'A) Witty sarcasm, quick banter, and clever comebacks.', val: 1 },
      { text: 'B) Relatable memes, silly stories, and goofy antics.', val: 2 },
      { text: 'C) Dark, dry, or observational humor.', val: 3 }
    ]
  },

  // SECTION 7: VALUES & RELATIONSHIP VISION
  {
    key: 'trust_pace',
    title: '17. Opening Up',
    prompt: 'How quickly do you open up your heart to someone new?',
    options: [
      { text: 'A) Quickly if the energy and vibe feel genuine.', val: 1 },
      { text: 'B) Gradually over time as trust is built step-by-step.', val: 2 },
      { text: 'C) Very carefully until total safety is established.', val: 3 }
    ]
  },
  {
    key: 'spontaneity',
    title: '18. Spontaneity Factor',
    prompt: 'Your partner suggests taking an unplanned 2-hour late-night drive right now. You say:',
    options: [
      { text: 'A) "Let’s go right now! Grab your coat!" 🚗', val: 1 },
      { text: 'B) "Sounds fun! Give me 10 mins to get ready."', val: 2 },
      { text: 'C) "Can we plan it for tomorrow instead?"', val: 3 }
    ]
  },
  {
    key: 'future_vision',
    title: '19. Life Philosophy',
    prompt: 'Which quote best mirrors your personal life motto?',
    options: [
      { text: 'A) "Work hard, stay humble, and grow every single day."', val: 1 },
      { text: 'B) "Prioritize peace, good health, and genuine happiness."', val: 2 },
      { text: 'C) "Collect experiences and memories, not things."', val: 3 }
    ]
  },
  {
    key: 'relationship_goal',
    title: '20. Your Intent on The Circle',
    prompt: 'What are you primarily looking to find here today?',
    options: [
      { text: 'A) A genuine, meaningful long-term relationship.', val: 1 },
      { text: 'B) Authentic dating to see where natural chemistry goes.', val: 2 },
      { text: 'C) Connecting with cool, like-minded people first.', val: 3 }
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

// Request Desktop Notifications
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// Send Energetic Notification
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

// Session check with Direct Chat Routing
async function checkSession() {
  requestNotificationPermission();

  if (!myId) {
    screen = 'landing';
    render();
    return;
  }
  try {
    const me = await api(`/me/${myId}`);
    const st = await api('/state');
    
    // DIRECT MATCH ACCESS (No Lobby access once matched)
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
    localStorage.removeItem('circleMemberId');
    myId = null;
    screen = 'landing';
    render();
  }
}

// Direct ID check from Landing page
async function resumeByID() {
  const idInput = document.getElementById('inputMemberId');
  const val = idInput ? idInput.value.trim() : '';
  if (!val) return alert('Please enter your valid Member ID');

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
        <div class="eyebrow">✨ Dynamic Matchmaking</div>
        <h1 style="margin-top:0;">The Circle</h1>
        <p style="color:var(--muted); font-size:14px;">Answer 20 fun & deep scenarios to connect with compatible partners in our live 10-person synchronized squad.</p>
        
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
          <button type="submit" style="width:100%; padding:12px; border-radius:8px; background:var(--gold); color:#120f26; font-weight:600; border:none; cursor:pointer;">Begin 20 Scenarios →</button>
        </form>

        <hr style="border:0; border-top:1px solid var(--line); margin:24px 0;">

        <div style="text-align:center;">
          <p style="font-size:13px; color:var(--muted); margin-bottom:8px;">Have an active Member ID? Enter here to jump straight to chat:</p>
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
    const quote = QUOTES[quizIndex % QUOTES.length];

    app.innerHTML = `
      <div class="card">
        <div style="background:rgba(217,180,106,0.1); border-left:3px solid var(--gold); padding:10px 14px; border-radius:6px; font-style:italic; font-size:13px; color:var(--gold-soft); margin-bottom:20px;">
          ${quote}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
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

        <div style="display:flex; justify-content:space-between; margin-top:20px;">
          ${quizIndex > 0 ? `<button onclick="prevQuiz()" style="padding:8px 16px; background:none; border:1px solid var(--line); color:var(--muted); border-radius:6px; cursor:pointer;">← Previous</button>` : `<div></div>`}
        </div>
      </div>
    `;
    return;
  }

  // LIVE LOBBY SCREEN (Wholesome, Live readout, Squad progress)
  if (screen === 'lobby') {
    api('/state').then(st => {
      // If locked while in lobby, notify and redirect directly to chat
      if (st.locked) {
        const myPair = st.pairs.find(p => p.womanId === myId || p.manId === myId);
        if (myPair) {
          const partnerName = myPair.womanId === myId ? myPair.manName : myPair.womanName;
          sendMatchNotification(partnerName, myPair.score);
          screen = 'chat';
          render();
          return;
        }
      }

      const count = st.members.length;
      const readyCount = st.members.filter(m => m.complete).length;
      
      app.innerHTML = `
        <div class="card" style="text-align:center;">
          <div class="eyebrow">Circle Squad Lobby • Round ${st.round}</div>
          <h2 style="margin-top:4px;">Waiting for Synchronized Match</h2>
          <p style="color:var(--muted); font-size:14px;">Your 20 responses are registered! Grab a coffee while the squad fills up. ☕</p>
          
          <div style="margin:20px 0;">
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--muted); margin-bottom:6px;">
              <span>Live Squad Capacity</span>
              <span><strong>${count} / 10 Joined</strong> (${readyCount} Ready)</span>
            </div>
            <div style="height:12px; border-radius:6px; background:var(--bg-2); border:1px solid var(--line); overflow:hidden;">
              <div style="height:100%; width:${(count / 10) * 100}%; background:var(--gold); transition:width .4s ease;"></div>
            </div>
          </div>

          <div style="background:rgba(217,180,106,0.08); padding:14px; border-radius:10px; border:1px dashed var(--gold); margin-bottom:20px; text-align:left;">
            <div style="font-size:12px; color:var(--gold); font-weight:600; margin-bottom:4px;">✨ Good Vibes Fortune</div>
            <p style="font-size:13px; color:var(--text); margin:0;">"Great things take time. The right person will appreciate your authenticity and unique choices."</p>
          </div>

          <div style="background:var(--bg-2); padding:10px; border-radius:8px; margin-bottom:20px;">
            <span style="font-size:11px; color:var(--muted); display:block;">YOUR MEMBER ID (Save this to resume anytime)</span>
            <strong style="color:var(--gold); font-size:17px;">${myId}</strong>
          </div>

          <button onclick="triggerReveal()" style="width:100%; padding:14px; border-radius:8px; background:var(--gold); color:#120f26; font-weight:600; border:none; cursor:pointer;">Reveal Matches Now →</button>
        </div>
      `;
    });
    return;
  }

  // CHAT SCREEN (Timer-less, Direct single access)
  if (screen === 'chat') {
    app.innerHTML = `
      <div class="card">
        <div id="statusBanner" style="background:rgba(217,180,106,0.12); border:1px solid var(--gold); padding:10px 14px; border-radius:8px; margin-bottom:16px;">
          🔥 <strong>Match Connected!</strong><br>
          <span style="font-size:12px; color:var(--muted);">Feel free to chat here at your own pace! You can exchange numbers or socials whenever you're ready.</span>
        </div>

        <div id="chatBox" style="height:350px; overflow-y:auto; background:var(--bg-2); border:1px solid var(--line); border-radius:10px; padding:12px; margin-bottom:12px;">
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
    startPolling();
  } catch (e) {
    alert(e.message);
  }
}

async function triggerReveal() {
  try {
    const st = await api('/reveal', { method: 'POST' });
    const myPair = st.pairs.find(p => p.womanId === myId || p.manId === myId);
    if (myPair) {
      const partnerName = myPair.womanId === myId ? myPair.manName : myPair.womanName;
      sendMatchNotification(partnerName, myPair.score);
      screen = 'chat';
    } else {
      alert('Matches locked! Refreshing your pair status...');
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
    if (screen === 'lobby') render();
    if (screen === 'chat') loadChat();
  }, 2500);
}

// Check session on launch
checkSession();const app = document.getElementById('app');
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
