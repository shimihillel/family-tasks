// ─── FIREBASE ─────────────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYE80eTuw8xxtCV3canpEH5_DJq0zVDPA",
  authDomain: "family-tasks-9589d.firebaseapp.com",
  databaseURL: "https://family-tasks-9589d-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "family-tasks-9589d",
  storageBucket: "family-tasks-9589d.firebasestorage.app",
  messagingSenderId: "680810585157",
  appId: "1:680810585157:web:141aa57c3d542fc5a6572c"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const DEFAULT_USERS = [
  { id: 'shimi',   name: 'אמא',  emoji: '👩', color: '#a99de8', cardClass: 'admin-card',    barColor: '#7c6fcd', admin: true  },
  { id: 'uri',     name: 'אבא',  emoji: '👨', color: '#ffc07a', cardClass: 'card-uri',      barColor: '#d46a00', admin: false },
  { id: 'shachar', name: 'שחר',  emoji: '🧑', color: '#a8d96f', cardClass: 'card-shachar',  barColor: '#4a9a15', admin: false },
  { id: 'ron',     name: 'רון',  emoji: '👦', color: '#b8b0e8', cardClass: 'card-ron',      barColor: '#6b5fd4', admin: false },
  { id: 'nir',     name: 'ניר',  emoji: '🧒', color: '#7dd4ad', cardClass: 'card-nir',      barColor: '#0f9e5a', admin: false },
];

const EMOJI_OPTIONS = ['👩','👨','🧑','👦','🧒','👧','🧔','👱','🧑‍💻','🧑‍🍳','🧑‍🎨','🧑‍🚀','🦊','🐱','🐶','🦁','🐯','🐻','🌸','⭐'];

// ── שני להחליף לקוד שלך ──
const ADMIN_PIN = '1705';

// ─── RECURRING TASKS ──────────────────────────────────────────────────────────
const DAY_NAMES = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getDayOfWeek() {
  return new Date().getDay();
}

function listenRecurring() {
  onValue(ref(db, 'recurring'), (snap) => {
    const val = snap.val();
    if (!val) { window._rec = {}; renderRecurringIfVisible(); return; }
    // Firebase stores as object — use as-is
    const obj = typeof val === 'object' && !Array.isArray(val) ? val : {};
    // check resets
    let changed = false;
    const today = getTodayStr();
    Object.values(obj).forEach(t => {
      if (!t) return;
      const needsReset = t.status !== 'open' && (
        (t.type === 'daily' && t.lastReset !== today) ||
        (t.type === 'weekly' && getDayOfWeek() === t.dayOfWeek && t.lastReset !== today)
      );
      if (needsReset) { t.status = 'open'; t.lastReset = today; changed = true; }
    });
    window._rec = obj;
    if (changed) set(ref(db, 'recurring'), obj).catch(console.error);
    renderRecurringIfVisible();
  });
}

function saveRec() {
  set(ref(db, 'recurring'), window._rec || {}).catch(console.error);
}

function renderRecurringIfVisible() {
  const s = getCurrentScreen();
  if (s === 'admin') renderAdmin();
  else if (s === 'member' && currentUser) renderMember();
  else renderHome();
}

function getRecurringForUser(uid) {
  return Object.values(window._rec || {}).filter(t => t && t.uid === uid);
}

function addRecurringTask(uid) {
  const textEl = document.getElementById('rec-text-' + uid);
  const typeEl = document.getElementById('rec-type-' + uid);
  const dayEl  = document.getElementById('rec-day-'  + uid);
  const text = textEl ? textEl.value.trim() : '';
  const type = typeEl ? typeEl.value : 'daily';
  if (!text) return;
  const id = 'r_' + Date.now();
  if (!window._rec) window._rec = {};
  window._rec[id] = {
    id, uid, text, type,
    dayOfWeek: type === 'weekly' && dayEl ? parseInt(dayEl.value) : null,
    status: 'open',
    lastReset: getTodayStr(),
  };
  saveRec();
  if (textEl) textEl.value = '';
}

function recApprove(id) {
  console.log('recApprove called, id:', id);
  console.log('_rec keys:', window._rec ? Object.keys(window._rec) : 'null');
  if (!window._rec) { console.log('_rec is null'); return; }
  if (!window._rec[id]) { 
    console.log('id not found in _rec');
    // try to find by t.id field
    const match = Object.values(window._rec).find(t => t && t.id === id);
    if (match) {
      console.log('found by t.id, key is different — fixing');
      const key = Object.keys(window._rec).find(k => window._rec[k] && window._rec[k].id === id);
      window._rec[key].status = 'done';
      window._rec[key].lastReset = getTodayStr();
      saveRec();
      renderAdmin();
    }
    return;
  }
  window._rec[id].status = 'done';
  window._rec[id].lastReset = getTodayStr();
  saveRec();
  renderAdmin();
}

function recReturn(id) {
  if (!window._rec || !window._rec[id]) return;
  window._rec[id].status = 'returned';
  saveRec();
  renderAdmin();
}

function recDelete(id) {
  if (!window._rec) return;
  delete window._rec[id];
  saveRec();
  const s = getCurrentScreen();
  if (s === 'admin') renderAdmin(); else renderMember();
}

function recCheck(id, isAdmin) {
  if (!window._rec || !window._rec[id]) return;
  if (window._rec[id].status === 'done') return;
  window._rec[id].status = 'done';
  saveRec();
  const btn = document.querySelector(`[data-rid="${id}"].rec-chk`);
  if (btn) {
    btn.classList.add('pop', 'checked');
    btn.innerHTML = '<i class="ti ti-check"></i>';
    const rect = btn.getBoundingClientRect();
    spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  setTimeout(() => { if (isAdmin) renderAdmin(); else renderMember(); }, 700);
}

function recurringCardHTML(t, isAdmin) {
  const status = t.status || 'open';
  const typeLabel = t.type === 'daily' ? '🔄 יומי' : `📅 שבועי — ${DAY_NAMES[t.dayOfWeek] || ''}`;
  const border = status === 'done' ? '#FAC775' : status === 'returned' ? '#F5C4B3' : 'rgba(124,111,205,0.3)';
  return `<div class="task-card recurring-card" style="border-color:${border}">
    <div class="burst-wrap">
      <button class="task-check ${status !== 'open' ? 'checked' : ''} rec-chk"
        data-rid="${t.id}" data-admin="${isAdmin}"
        style="${status === 'done' ? 'cursor:default;opacity:0.7' : ''}">
        ${status !== 'open' ? '<i class="ti ti-check"></i>' : ''}
      </button>
    </div>
    <div class="task-text-wrap">
      <div class="task-text ${status !== 'open' ? 'done' : ''}">${t.text}</div>
      <div class="recurring-label">${typeLabel}</div>
      ${status === 'done' && isAdmin ? `
        <div class="task-admin-actions">
          <button class="btn-return rec-ret" data-rid="${t.id}">↩ החזירי</button>
          <button class="btn-approve-task rec-app" data-rid="${t.id}">✓ אשרי</button>
        </div>` : ''}
      ${status === 'returned' && !isAdmin ? `<div class="returned-banner"><i class="ti ti-corner-down-left"></i> אמא החזירה</div>` : ''}
      ${status === 'done' && !isAdmin ? `<div class="task-small-label">ממתין לאישור אמא...</div>` : ''}
    </div>
    ${isAdmin ? `<button class="task-delete rec-del" data-rid="${t.id}"><i class="ti ti-trash"></i></button>` : ''}
  </div>`;
}

// single event delegation for all recurring buttons
document.addEventListener('click', e => {
  const app  = e.target.closest('.rec-app');
  const ret  = e.target.closest('.rec-ret');
  const del  = e.target.closest('.rec-del');
  const chk  = e.target.closest('.rec-chk');
  if (app) { e.stopPropagation(); recApprove(app.dataset.rid); }
  else if (ret) { e.stopPropagation(); recReturn(ret.dataset.rid); }
  else if (del) { e.stopPropagation(); recDelete(del.dataset.rid); }
  else if (chk) { e.stopPropagation(); recCheck(chk.dataset.rid, chk.dataset.admin === 'true'); }
});


/*
  TASK STATUS:
  'open'     — פתוחה
  'done'     — סומנה ע"י הילד, ממתינה לאמא
  'returned' — הוחזרה ע"י אמא, מופיעה שוב אצל הילד
*/

// ─── DARK MODE ───────────────────────────────────────────────────────────────
function initDarkMode() {
  const hour = new Date().getHours();
  const isNight = hour >= 20 || hour < 7;
  const saved = localStorage.getItem('darkMode');
  const dark = saved !== null ? saved === 'true' : isNight;
  setDarkMode(dark);
}

function setDarkMode(dark) {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('darkMode', dark);
  const btn = document.getElementById('dark-toggle');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.contains('dark');
  setDarkMode(!isDark);
}

// ─── STATE ────────────────────────────────────────────────────────────────────
let USERS = JSON.parse(JSON.stringify(DEFAULT_USERS));
let tasks = {};
let currentUser = null;
let activeEmojiUserId = null;
let bulkSelected = [];
let dragSrcIndex = null;
let dragUserId = null;
let returningTask = null; // { uid, index } — admin typing return message

// ─── FIREBASE ─────────────────────────────────────────────────────────────────
function saveTasks() { set(ref(db, 'tasks'), tasks).catch(console.error); }
function saveUsers() {
  // save as object {id: userData} to avoid Firebase array issues
  const usersObj = {};
  USERS.forEach(u => { usersObj[u.id] = u; });
  set(ref(db, 'users'), usersObj).catch(console.error);
}

function listenToFirebase() {
  onValue(ref(db, 'tasks'), (snap) => {
    tasks = snap.val() || {};
    if (returningTask) return;
    const s = getCurrentScreen();
    if (s === 'admin') renderAdmin();
    else if (s === 'member' && currentUser) renderMember();
    else renderHome();
  });
  onValue(ref(db, 'users'), (snap) => {
    const data = snap.val();
    if (data) {
      // handle both object format {id: user} and legacy array format
      const arr = Array.isArray(data) ? data : Object.values(data);
      if (arr.length) {
        // merge emoji changes only, keep local defaults for missing fields
        arr.forEach(u => {
          const local = USERS.find(x => x.id === u.id);
          if (local && u.emoji) local.emoji = u.emoji;
        });
        if (getCurrentScreen() === 'home') renderHome();
      }
    }
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getUserTasks(uid) { return tasks[uid] || []; }

function getProgress(uid) {
  const t = getUserTasks(uid);
  if (!t.length) return { done: 0, total: 0, pct: 0 };
  const done = t.filter(x => x.status === 'done').length;
  return { done, total: t.length, pct: Math.round(done / t.length * 100) };
}

function progressColor(pct) {
  if (pct >= 80) return '#1D9E75';
  if (pct >= 40) return '#BA7517';
  return '#E24B4A';
}

function sortedTasks(uid) {
  const order = { done: 0, returned: 1, open: 2 };
  return getUserTasks(uid)
    .map((t, i) => ({ ...t, _i: i }))
    .sort((a, b) => (order[a.status||'open']||2) - (order[b.status||'open']||2));
}

function showScreen(name) {
  const current = document.querySelector('.screen.active');
  const next = document.getElementById('screen-' + name);
  if (current === next) return;
  if (current) {
    current.classList.add('slide-out');
    setTimeout(() => { current.classList.remove('active', 'slide-out'); }, 200);
  }
  setTimeout(() => {
    next.classList.add('active', 'slide-in');
    setTimeout(() => next.classList.remove('slide-in'), 300);
  }, current ? 80 : 0);
}

function getCurrentScreen() {
  if (document.getElementById('screen-admin').classList.contains('active')) return 'admin';
  if (document.getElementById('screen-member').classList.contains('active')) return 'member';
  return 'home';
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────────
const confettiCanvas = document.getElementById('confetti-canvas');
const ctx = confettiCanvas.getContext('2d');
let particles = [], animating = false;

function resizeCanvas() { confettiCanvas.width = window.innerWidth; confettiCanvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function spawnConfetti(x, y) {
  const emojis = ['✨','⭐','💫','🌟','🎉','🥳'];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.6;
    const speed = 3 + Math.random() * 5;
    particles.push({ x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed-3,
      emoji: emojis[Math.floor(Math.random()*emojis.length)],
      life: 1, decay: 0.025+Math.random()*0.02, size: 16+Math.random()*10 });
  }
  if (!animating) animateConfetti();
}

function animateConfetti() {
  animating = true;
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.font = p.size + 'px serif';
    ctx.fillText(p.emoji, p.x, p.y);
    p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= p.decay;
  });
  ctx.globalAlpha = 1;
  if (particles.length > 0) requestAnimationFrame(animateConfetti);
  else { ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); animating = false; }
}

// ─── EMOJI PICKER ─────────────────────────────────────────────────────────────
function openEmojiPicker(uid, e) {
  if (e) e.stopPropagation();
  const u = USERS.find(x => x.id === uid);
  if (!u) return;
  showEmojiModal(uid, u.name);
}

function showEmojiModal(uid, name) {
  // remove existing modal if any
  const existing = document.getElementById('emoji-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'emoji-modal';
  modal.innerHTML = `
    <div class="emoji-modal-inner">
      <div class="emoji-modal-header">
        <span class="emoji-modal-title">בחר/י אמוג'י, ${name}</span>
        <button class="emoji-modal-close" id="emoji-close-btn">✕</button>
      </div>
      <div class="emoji-modal-grid" id="emoji-grid-${uid}"></div>
    </div>`;
  document.body.appendChild(modal);

  // populate grid
  const grid = document.getElementById('emoji-grid-' + uid);
  const u = USERS.find(x => x.id === uid);
  EMOJI_OPTIONS.forEach(em => {
    const btn = document.createElement('button');
    btn.className = 'emoji-modal-opt' + (u && u.emoji === em ? ' selected' : '');
    btn.textContent = em;
    btn.addEventListener('click', () => { pickEmoji(uid, em); });
    grid.appendChild(btn);
  });

  // close handlers
  document.getElementById('emoji-close-btn').addEventListener('click', closeEmojiPicker);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeEmojiPicker(); });
}

function closeEmojiPicker() {
  const modal = document.getElementById('emoji-modal');
  if (modal) {
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 150);
  }
}

function pickEmoji(uid, emoji) {
  const u = USERS.find(x => x.id === uid);
  if (!u) return;
  u.emoji = emoji;
  localStorage.setItem('emoji_' + uid, emoji); // save locally too
  closeEmojiPicker();
  saveUsers();
  const s = getCurrentScreen();
  if (s === 'home') renderHome();
  else if (s === 'member') renderMember();
  else if (s === 'admin') renderAdmin();
}

function emojiPickerHTML(uid) { return ''; }

// Check on first entry if user needs to pick emoji
function checkFirstEmoji(uid) {
  const u = USERS.find(x => x.id === uid);
  if (!u) return;
  // load saved emoji from localStorage
  const saved = localStorage.getItem('emoji_' + uid);
  if (saved) { u.emoji = saved; return; }
  // first time — show picker after short delay
  setTimeout(() => showEmojiModal(uid, u.name), 400);
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function selectUser(id) {
  const u = USERS.find(x => x.id === id);
  if (u && u.admin) {
    showPinModal();
    return;
  }
  currentUser = u;
  checkFirstEmoji(id);
  renderMember();
}

function showPinModal() {
  const existing = document.getElementById('pin-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'pin-modal';
  modal.innerHTML = `
    <div class="pin-modal-inner">
      <div class="pin-modal-emoji">👩⭐</div>
      <div class="pin-modal-title">פאנל ניהול</div>
      <div class="pin-modal-sub">הכניסי קוד כניסה</div>
      <div class="pin-dots" id="pin-dots">
        <span class="pin-dot"></span>
        <span class="pin-dot"></span>
        <span class="pin-dot"></span>
        <span class="pin-dot"></span>
      </div>
      <div class="pin-error" id="pin-error"></div>
      <div class="pin-keypad">
        ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(k => `
          <button class="pin-key ${k==='' ? 'pin-key-empty' : ''}"
            onclick="pinKeyPress('${k}')">${k}</button>`).join('')}
      </div>
      <button class="pin-cancel" onclick="closePinModal()">ביטול</button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closePinModal(); });
}

let pinValue = '';

function pinKeyPress(key) {
  if (key === '⌫') {
    pinValue = pinValue.slice(0, -1);
  } else if (key === '' || pinValue.length >= 4) {
    return;
  } else {
    pinValue += key;
  }

  // update dots
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((d, i) => d.classList.toggle('filled', i < pinValue.length));

  // check pin when 4 digits entered
  if (pinValue.length === 4) {
    setTimeout(() => {
      if (pinValue === ADMIN_PIN) {
        currentUser = USERS.find(u => u.admin);
        closePinModal();
        renderAdmin();
      } else {
        pinValue = '';
        dots.forEach(d => d.classList.remove('filled'));
        const err = document.getElementById('pin-error');
        if (err) {
          err.textContent = 'קוד שגוי, נסי שוב';
          setTimeout(() => { if (err) err.textContent = ''; }, 1500);
        }
      }
    }, 100);
  }
}

function closePinModal() {
  pinValue = '';
  const modal = document.getElementById('pin-modal');
  if (modal) {
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 150);
  }
}
function goHome() { currentUser = null; showScreen('home'); renderHome(); }

// ─── HOME ─────────────────────────────────────────────────────────────────────
function renderHome() {
  const grid = document.getElementById('user-grid');
  const members = USERS.filter(u => !u.admin);
  const adm = USERS.find(u => u.admin);
  const needsAttention = USERS.reduce((s, u) =>
    s + getUserTasks(u.id).filter(t => t.status === 'done' && !t.selfAdded).length, 0);

  const adminCard = `
    <div class="home-card admin-card" onclick="selectUser('${adm.id}')">
      ${needsAttention ? '<div class="notif-dot"></div>' : ''}
      <div class="avatar-wrap" style="position:relative">
        <div class="avatar-circle" style="background:${adm.color}"
          onclick="event.stopPropagation();openEmojiPicker('${adm.id}',event)">${adm.emoji}</div>
        ${emojiPickerHTML(adm.id)}
      </div>
      <div class="card-text">
        <div class="card-name">${adm.name} ⭐</div>
        <div class="card-meta">ניהול משפחה</div>
        <div class="card-info" style="color:${needsAttention ? '#fff3aa' : 'rgba(255,255,255,0.7)'}">
          ${needsAttention ? `${needsAttention} ממתינות לאישור` : 'הכל מאושר ✓'}
        </div>
      </div>
      <i class="ti ti-chevron-left card-chevron"></i>
    </div>`;

  const memberCards = members.map(u => {
    const p = getProgress(u.id);
    const hasReturned = getUserTasks(u.id).some(t => t.status === 'returned');
    return `
      <div class="home-card ${u.cardClass}" onclick="selectUser('${u.id}')">
        ${hasReturned ? '<div class="notif-dot"></div>' : ''}
        <div class="avatar-wrap" style="position:relative">
          <div class="avatar-circle"
            onclick="event.stopPropagation();openEmojiPicker('${u.id}',event)">${u.emoji}</div>
          ${emojiPickerHTML(u.id)}
        </div>
        <div class="card-name">${u.name}</div>
        <div class="card-meta">${p.total ? `${p.done}/${p.total} משימות` : 'אין משימות'}</div>
        ${p.total ? `<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${p.pct}%"></div></div>` : ''}
      </div>`;
  }).join('');

  grid.innerHTML = adminCard + memberCards;
}

// ─── TASK CARD HTML ───────────────────────────────────────────────────────────
function taskCardHTML(t, uid, isAdmin) {
  const status = t.status || 'open';
  const u = USERS.find(x => x.id === uid);
  const isReturning = returningTask && returningTask.uid === uid && returningTask.index === t._i;

  const borderStyle = status === 'done' ? 'border-color:#FAC775'
    : status === 'returned' ? 'border-color:#F5C4B3' : '';

  return `
    <div class="task-card" id="task-${uid}-${t._i}"
      style="${borderStyle}"
      draggable="${status === 'open' ? 'true' : 'false'}"
      ondragstart="onDragStart(event,'${uid}',${t._i})"
      ondragover="onDragOver(event)"
      ondrop="onDrop(event,'${uid}',${t._i})"
      ondragend="onDragEnd(event)">

      ${status === 'open' ? '<i class="ti ti-grip-vertical drag-handle"></i>' : '<div style="width:20px;flex-shrink:0"></div>'}

      <div class="burst-wrap">
        <button class="task-check ${status !== 'open' ? 'checked' : ''}"
          id="chk-${uid}-${t._i}"
          onclick="handleCheck('${uid}',${t._i},${isAdmin})"
          style="${status === 'done' ? 'cursor:default;opacity:0.7' : ''}"
          aria-label="סמן">
          ${status !== 'open' ? '<i class="ti ti-check"></i>' : ''}
        </button>
      </div>

      <div class="task-text-wrap">
        <div class="task-text ${status !== 'open' ? 'done' : ''}">${t.text}</div>
        ${t.addedBy ? `<div class="task-small-label">➕ נוסף על ידי ${t.addedBy}</div>` : ''}

        ${status === 'done' && isAdmin ? `
          <div class="task-small-label amber">✅ ${u.name} סימן/ה כבוצע — ממתין לאישורך</div>
          ${!isReturning ? `
            <div class="task-admin-actions">
              <button class="btn-return" onclick="startReturn('${uid}',${t._i})">
                <i class="ti ti-corner-down-left"></i> החזירי
              </button>
              <button class="btn-approve-task" onclick="approveTask('${uid}',${t._i})">
                <i class="ti ti-circle-check"></i> אשרי
              </button>
            </div>` : `
            <div class="task-note-wrap" style="margin-top:8px">
              <input class="task-note-input" id="return-input-${uid}-${t._i}"
                placeholder="כתבי לו/ה הערה קצרה..."
                onkeydown="if(event.key==='Enter')submitReturn('${uid}',${t._i})">
              <button class="task-note-confirm" onclick="submitReturn('${uid}',${t._i})">שלחי</button>
            </div>`}` : ''}

        ${status === 'returned' && !isAdmin ? `
          <div class="returned-banner">
            <i class="ti ti-corner-down-left"></i>
            ${t.returnNote ? `אמא כתבה: "${t.returnNote}"` : 'אמא החזירה את המשימה'}
          </div>` : ''}

        ${status === 'returned' && isAdmin ? `
          <div class="task-small-label" style="color:#888">↩️ הוחזר לילד</div>` : ''}

        ${!isAdmin && status === 'open' ? '' : ''}
        ${!isAdmin && status === 'done' && !t.selfAdded ? `<div class="task-small-label">ממתין לאישור אמא...</div>` : ''}
      </div>

      <div class="task-actions">
        ${isAdmin && status === 'open' ? `<button class="task-edit-btn" onclick="startEdit('${uid}',${t._i})"><i class="ti ti-pencil"></i></button>` : ''}
        ${isAdmin && status === 'open' ? `<button class="task-delete" onclick="deleteTask('${uid}',${t._i})"><i class="ti ti-trash"></i></button>` : ''}
      </div>
    </div>`;
}

// ─── MEMBER VIEW ──────────────────────────────────────────────────────────────
function renderMember() {
  if (!currentUser) return;
  showScreen('member');
  const u2 = currentUser;
  document.getElementById('member-title').innerHTML =
    `<span style="cursor:pointer" onclick="openEmojiPicker('${u2.id}',null)" title="שנה אמוג'י">${u2.emoji}</span> שלום ${u2.name}!`;
  const container = document.getElementById('member-tasks');
  const empty = document.getElementById('member-empty');
  const userTasks = getUserTasks(currentUser.id);

  if (!userTasks.length) { container.innerHTML = ''; empty.style.display = 'block'; }
  else {
    empty.style.display = 'none';
    const p = getProgress(currentUser.id);
    const col = progressColor(p.pct);
    container.innerHTML = `
      <div style="margin-bottom:1.25rem;">
        <div class="progress-row"><span>${p.done} מתוך ${p.total} בוצעו</span><span>${p.pct}%</span></div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${p.pct}%;background:${col}"></div></div>
      </div>
      ${sortedTasks(currentUser.id).map(t => taskCardHTML(t, currentUser.id, false)).join('')}`;
  }

  // add recurring tasks section
  const recTasks = getRecurringForUser(currentUser.id);
  if (recTasks.length) {
    const recHTML = `<div class="recurring-section">
      <div class="recurring-section-title">📌 משימות קבועות</div>
      ${recTasks.map(t => recurringCardHTML(t, false)).join('')}
    </div>`;
    container.innerHTML += recHTML;
  }

  const adm = USERS.find(u => u.admin);
  container.innerHTML += `
    <div class="member-add-box">
      <p>הוסיפי משימה:</p>
      <div class="add-task-row" style="margin-bottom:${currentUser.admin ? '0' : '8px'}">
        <input type="text" id="self-task-input" placeholder="משימה לעצמי..."
          onkeydown="if(event.key==='Enter')addSelfTask()">
        <button onclick="addSelfTask()">לי</button>
      </div>
      ${!currentUser.admin ? `
      <div class="add-task-row">
        <input type="text" id="mom-task-input" placeholder="משימה לאמא..."
          onkeydown="if(event.key==='Enter')addTaskToMom()">
        <button onclick="addTaskToMom()" style="background:#1D9E75">${adm.emoji} לאמא</button>
      </div>` : ''}
    </div>`;
}

// ─── ADMIN VIEW ───────────────────────────────────────────────────────────────
function renderAdmin() {
  showScreen('admin');
  const container = document.getElementById('admin-content');

  const collectiveMsg = `
    <div class="collective-box">
      <p>📢 הודעה לכל המשפחה:</p>
      <div class="add-task-row">
        <input type="text" id="collective-input" placeholder="כתבי הודעה לכולם..."
          onkeydown="if(event.key==='Enter')sendCollectiveMessage()">
        <button onclick="sendCollectiveMessage()">שלחי</button>
      </div>
      <button class="clear-msg-btn" onclick="clearCollectiveMessage()">מחקי הודעה</button>
    </div>`;

  const bulkHtml = `
    <div class="bulk-add-box">
      <p>הוסיפי משימה לכמה בני משפחה בבת אחת:</p>
      <div class="bulk-checkboxes">
        ${USERS.map(u => `<div class="bulk-cb ${bulkSelected.includes(u.id) ? 'selected' : ''}"
          onclick="toggleBulk('${u.id}')">${u.emoji} ${u.name}</div>`).join('')}
      </div>
      <div class="bulk-input-row">
        <input type="text" id="bulk-input" placeholder="שם המשימה..."
          onkeydown="if(event.key==='Enter')addBulkTask()">
        <button onclick="addBulkTask()">הוסיפי לכולם</button>
      </div>
    </div>`;

  const membersHtml = USERS.map((u, idx) => {
    const userTasks = getUserTasks(u.id).filter(t => !t.selfAdded);
    const doneCount = userTasks.filter(t => t.status === 'done').length;
    const p = getProgress(u.id);
    const col = progressColor(p.pct);
    const sorted = sortedTasks(u.id).filter(t => !t.selfAdded);
    const tasksHtml = sorted.length
      ? sorted.map(t => taskCardHTML(t, u.id, true)).join('')
      : '<div class="empty-state" style="padding:0.5rem 0;font-size:13px;">אין משימות</div>';

    return `
      <div class="member-section">
        <div class="member-header">
          <div class="mini-avatar" style="background:${u.color};border:2px solid rgba(255,255,255,0.7)">${u.emoji}</div>
          <span class="member-name">${u.name}${u.admin ? ' ⭐' : ''}</span>
          ${doneCount ? `<span class="badge badge-pending">
            <i class="ti ti-clock" style="font-size:11px"></i> ${doneCount} ממתינות</span>` : ''}
        </div>
        ${p.total ? `<div class="member-progress">
          <div class="member-progress-bar"><div class="member-progress-fill" style="width:${p.pct}%;background:${col}"></div></div>
          <span class="member-progress-label">${p.done}/${p.total}</span>
        </div>` : ''}
        ${tasksHtml}
        <div class="add-task-row" style="margin-top:10px">
          <input type="text" id="new-task-${u.id}" placeholder="הוסיפי משימה ל${u.name}..."
            onkeydown="if(event.key==='Enter')addTask('${u.id}')">
          <button onclick="addTask('${u.id}')"><i class="ti ti-plus"></i></button>
        </div>

        ${(() => {
          const recTasks = getRecurringForUser(u.id);
          return `<div class="recurring-section">
            <div class="recurring-section-title">📌 משימות קבועות</div>
            ${recTasks.map(t => recurringCardHTML(t, true)).join('')}
            <div class="rec-add-row">
              <input type="text" id="rec-text-${u.id}" placeholder="משימה קבועה ל${u.name}...">
              <select id="rec-type-${u.id}" class="rec-select" onchange="document.getElementById('rec-day-wrap-${u.id}').style.display=this.value==='weekly'?'flex':'none'">
                <option value="daily">כל יום</option>
                <option value="weekly">שבועי</option>
              </select>
            </div>
            <div id="rec-day-wrap-${u.id}" style="display:none;gap:8px;margin-top:6px;align-items:center">
              <span style="font-size:13px;color:var(--text-muted);font-weight:700">יום:</span>
              <select id="rec-day-${u.id}" class="rec-select">
                ${DAY_NAMES.map((d,i) => `<option value="${i}">${d}</option>`).join('')}
              </select>
            </div>
            <button class="rec-add-btn" onclick="addRecurringTask('${u.id}')">+ הוסיפי משימה קבועה</button>
          </div>`;
        })()}
      </div>
      ${idx < USERS.length - 1 ? '<hr class="section-divider">' : ''}`;
  }).join('');

  container.innerHTML = collectiveMsg + bulkHtml + membersHtml;

  // restore return input if in progress
  if (returningTask) {
    const { uid, index } = returningTask;
    const inp = document.getElementById(`return-input-${uid}-${index}`);
    if (inp) inp.focus();
  }
}

// ─── TASK ACTIONS ─────────────────────────────────────────────────────────────
function handleCheck(uid, index, isAdmin) {
  if (!tasks[uid] || !tasks[uid][index]) return;
  const status = tasks[uid][index].status || 'open';
  const isSelf = tasks[uid][index].selfAdded;
  
  if (status === 'done') {
    if (isSelf) { tasks[uid][index].status = 'open'; saveTasks(); isAdmin ? renderAdmin() : renderMember(); }
    return;
  }
  
  // mark as done
  tasks[uid][index].status = 'done';
  tasks[uid][index].returnNote = '';
  saveTasks();

  // confetti
  const btn = document.getElementById(`chk-${uid}-${index}`);
  if (btn) {
    btn.classList.add('pop');
    btn.innerHTML = '<i class="ti ti-check"></i>';
    const rect = btn.getBoundingClientRect();
    spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  setTimeout(() => {
    if (isSelf) {
      // self-task: just disappear after done
      const el = document.getElementById(`task-${uid}-${index}`);
      if (el) { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }
      setTimeout(() => {
        if (tasks[uid]) tasks[uid].splice(index, 1);
        saveTasks();
      }, 300);
    } else {
      isAdmin ? renderAdmin() : renderMember();
    }
  }, 700);
}

function startReturn(uid, index) {
  returningTask = { uid, index };
  renderAdmin();
  setTimeout(() => {
    document.getElementById(`return-input-${uid}-${index}`)?.focus();
  }, 50);
}

function submitReturn(uid, index) {
  const inp = document.getElementById(`return-input-${uid}-${index}`);
  const note = inp ? inp.value.trim() : '';
  if (!tasks[uid] || !tasks[uid][index]) return;
  tasks[uid][index].status = 'returned';
  tasks[uid][index].returnNote = note;
  returningTask = null;
  saveTasks();
}

function approveTask(uid, index) {
  const el = document.getElementById(`task-${uid}-${index}`);
  if (el) { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }
  setTimeout(() => {
    if (tasks[uid]) tasks[uid].splice(index, 1);
    saveTasks();
  }, 300);
}

function addTask(userId) {
  const input = document.getElementById('new-task-' + userId);
  const text = input.value.trim();
  if (!text) return;
  if (!tasks[userId]) tasks[userId] = [];
  tasks[userId].push({ text, status: 'open' });
  input.value = '';
  saveTasks();
}

function addSelfTask() {
  const input = document.getElementById('self-task-input');
  const text = input.value.trim();
  if (!text) return;
  const uid = currentUser.id;
  if (!tasks[uid]) tasks[uid] = [];
  tasks[uid].push({ text, status: 'open', selfAdded: true });
  input.value = '';
  saveTasks();
}

function addTaskToMom() {
  const input = document.getElementById('mom-task-input');
  const text = input.value.trim();
  if (!text) return;
  const adm = USERS.find(u => u.admin);
  if (!tasks[adm.id]) tasks[adm.id] = [];
  tasks[adm.id].push({ text, status: 'open', addedBy: currentUser.name });
  input.value = '';
  saveTasks();
}

function deleteTask(userId, index) {
  tasks[userId].splice(index, 1);
  saveTasks();
}

function startEdit(uid, index) {
  const wrap = document.getElementById(`textwrap-${uid}-${index}`);
  if (!wrap) return;
  const textDiv = wrap.querySelector('.task-text');
  if (!textDiv) return;
  const current = tasks[uid][index].text;
  textDiv.outerHTML = `<input class="task-edit-input" id="edit-${uid}-${index}" value="${current}"
    onkeydown="if(event.key==='Enter')saveEdit('${uid}',${index},this.value);if(event.key==='Escape')renderAdmin()"
    onblur="saveEdit('${uid}',${index},this.value)">`;
  document.getElementById(`edit-${uid}-${index}`)?.focus();
}

function saveEdit(uid, index, newText) {
  const text = newText.trim();
  if (text && tasks[uid] && tasks[uid][index]) tasks[uid][index].text = text;
  saveTasks();
}

// ─── BULK ADD ─────────────────────────────────────────────────────────────────
function toggleBulk(uid) {
  const i = bulkSelected.indexOf(uid);
  if (i > -1) bulkSelected.splice(i, 1); else bulkSelected.push(uid);
  renderAdmin();
  setTimeout(() => document.getElementById('bulk-input')?.focus(), 50);
}

function addBulkTask() {
  const input = document.getElementById('bulk-input');
  const text = input.value.trim();
  if (!text || !bulkSelected.length) return;
  for (const uid of bulkSelected) {
    if (!tasks[uid]) tasks[uid] = [];
    tasks[uid].push({ text, status: 'open' });
  }
  input.value = '';
  saveTasks();
}

// ─── DRAG & DROP ──────────────────────────────────────────────────────────────
function onDragStart(e, uid, idx) {
  dragSrcIndex = idx; dragUserId = uid;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onDragOver(e) {
  e.preventDefault();
  document.querySelectorAll('.task-card').forEach(c => c.classList.remove('drag-over'));
  e.currentTarget.classList.add('drag-over');
}
function onDragEnd() {
  document.querySelectorAll('.task-card').forEach(c => { c.classList.remove('dragging'); c.classList.remove('drag-over'); });
}
function onDrop(e, uid, targetIdx) {
  e.preventDefault();
  if (dragUserId !== uid || dragSrcIndex === null || dragSrcIndex === targetIdx) return;
  const [moved] = tasks[uid].splice(dragSrcIndex, 1);
  tasks[uid].splice(targetIdx, 0, moved);
  dragSrcIndex = null;
  saveTasks();
}

// ─── EXPOSE GLOBALS ───────────────────────────────────────────────────────────
window.selectUser = selectUser;
window.goHome = goHome;
window.openEmojiPicker = openEmojiPicker;
window.pinKeyPress = pinKeyPress;
window.closePinModal = closePinModal;
window.addRecurringTask = addRecurringTask;
window.closeEmojiPicker = closeEmojiPicker;
window.pickEmoji = pickEmoji;
window.handleCheck = handleCheck;
window.startReturn = startReturn;
window.submitReturn = submitReturn;
window.approveTask = approveTask;
window.addTask = addTask;
window.addSelfTask = addSelfTask;
window.addTaskToMom = addTaskToMom;
window.deleteTask = deleteTask;
window.startEdit = startEdit;
window.saveEdit = saveEdit;
window.toggleBulk = toggleBulk;
window.addBulkTask = addBulkTask;
window.onDragStart = onDragStart;
window.onDragOver = onDragOver;
window.onDragEnd = onDragEnd;
window.onDrop = onDrop;
window.toggleDarkMode = toggleDarkMode;
window.openEmojiPicker = openEmojiPicker;
window.pinKeyPress = pinKeyPress;
window.closePinModal = closePinModal;
window.addRecurringTask = addRecurringTask;
window.closeEmojiPicker = closeEmojiPicker;
window.pickEmoji = pickEmoji;
window.sendCollectiveMessage = sendCollectiveMessage;
window.clearCollectiveMessage = clearCollectiveMessage;

// ─── COLLECTIVE MESSAGE ──────────────────────────────────────────────────────
function sendCollectiveMessage() {
  const input = document.getElementById('collective-input');
  const text = input ? input.value.trim() : '';
  if (!text) return;
  set(ref(db, 'collectiveMessage'), { text, ts: Date.now() }).catch(console.error);
  input.value = '';
}

function listenCollectiveMessage() {
  onValue(ref(db, 'collectiveMessage'), (snap) => {
    const data = snap.val();
    const banner = document.getElementById('collective-banner');
    if (!banner) return;
    if (data && data.text) {
      banner.textContent = '📢 ' + data.text;
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  });
}

function clearCollectiveMessage() {
  set(ref(db, 'collectiveMessage'), null).catch(console.error);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
initDarkMode();
window._rec = {};
listenToFirebase();
listenCollectiveMessage();
listenRecurring();
renderHome();
