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
  { id: 'shimi',   name: 'אמא',  emoji: '👩', color: '#9FE1CB', border: '#1D9E75', admin: true  },
  { id: 'uri',     name: 'אבא',  emoji: '👨', color: '#B5D4F4', border: '#378ADD', admin: false },
  { id: 'shachar', name: 'שחר',  emoji: '🧑', color: '#F5C4B3', border: '#D85A30', admin: false },
  { id: 'ron',     name: 'רון',  emoji: '👦', color: '#FAC775', border: '#BA7517', admin: false },
  { id: 'nir',     name: 'ניר',  emoji: '🧒', color: '#C0DD97', border: '#639922', admin: false },
];

const EMOJI_OPTIONS = ['👩','👨','🧑','👦','🧒','👧','🧔','👱','🧑‍💻','🧑‍🍳','🧑‍🎨','🧑‍🚀','🦊','🐱','🐶','🦁','🐯','🐻','🌸','⭐'];

/*
  TASK STATUS FLOW:
  
  'open'          → משימה פתוחה, לא טופלה
  'done'          → הילד סימן + הוסיף הערה (אופציונלי). ממתין לאמא
  'returned'      → אמא החזירה עם הערה. הילד צריך לראות ולסמן שוב
  'resubmitted'   → הילד סימן שוב אחרי ההחזרה. ממתין לאמא שוב
  (approved)      → אמא אישרה → המשימה נמחקת
*/

// ─── STATE ────────────────────────────────────────────────────────────────────
let USERS = JSON.parse(JSON.stringify(DEFAULT_USERS));
let tasks = {};
let currentUser = null;
let activeEmojiUserId = null;
let bulkSelected = [];
let dragSrcIndex = null;
let dragUserId = null;
let pendingCheckTask = null; // { uid, index } — waiting for note input before submitting

// ─── FIREBASE ─────────────────────────────────────────────────────────────────
function saveTasks() { set(ref(db, 'tasks'), tasks).catch(console.error); }
function saveUsers() { set(ref(db, 'users'), USERS).catch(console.error); }

function listenToFirebase() {
  onValue(ref(db, 'tasks'), (snap) => {
    tasks = snap.val() || {};
    if (pendingCheckTask) return; // don't interrupt note input
    // don't interrupt open return-input fields
    if (document.querySelector('[id^="return-input-"]')) return;
    const s = getCurrentScreen();
    if (s === 'admin') renderAdmin();
    else if (s === 'member') renderMember();
    else renderHome();
  });
  onValue(ref(db, 'users'), (snap) => {
    const data = snap.val();
    if (data && Array.isArray(data)) {
      USERS = data;
      if (getCurrentScreen() === 'home') renderHome();
    }
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getUserTasks(uid) { return tasks[uid] || []; }

function getProgress(uid) {
  const t = getUserTasks(uid);
  if (!t.length) return { done: 0, total: 0, pct: 0 };
  const done = t.filter(x => x.status && x.status !== 'open').length;
  return { done, total: t.length, pct: Math.round(done / t.length * 100) };
}

function progressColor(pct) {
  if (pct >= 80) return '#1D9E75';
  if (pct >= 40) return '#BA7517';
  return '#E24B4A';
}

function sortedTasks(uid) {
  const order = { 'resubmitted': 0, 'done': 1, 'returned': 2, 'open': 3 };
  return getUserTasks(uid)
    .map((t, i) => ({ ...t, _i: i }))
    .sort((a, b) => (order[a.status||'open']||3) - (order[b.status||'open']||3));
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
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
  e.stopPropagation();
  if (activeEmojiUserId && activeEmojiUserId !== uid) closeEmojiPicker();
  const picker = document.getElementById('emoji-picker-' + uid);
  const alreadyOpen = picker.classList.contains('open');
  picker.classList.toggle('open');
  if (!alreadyOpen) {
    const rect = e.currentTarget.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - 110;
    if (left < 8) left = 8;
    if (left + 220 > window.innerWidth - 8) left = window.innerWidth - 228;
    if (top + 200 > window.innerHeight) top = rect.top - 206;
    picker.style.top = top + 'px';
    picker.style.left = left + 'px';
    activeEmojiUserId = uid;
  } else { activeEmojiUserId = null; }
  document.getElementById('emoji-overlay').style.display = picker.classList.contains('open') ? 'block' : 'none';
}

function closeEmojiPicker() {
  if (activeEmojiUserId) {
    const p = document.getElementById('emoji-picker-' + activeEmojiUserId);
    if (p) p.classList.remove('open');
    activeEmojiUserId = null;
  }
  document.getElementById('emoji-overlay').style.display = 'none';
}

function pickEmoji(uid, emoji) {
  const u = USERS.find(x => x.id === uid);
  if (u) u.emoji = emoji;
  saveUsers(); closeEmojiPicker(); renderHome();
}

function emojiPickerHTML(uid) {
  return `<div id="emoji-picker-${uid}" class="emoji-picker">
    ${EMOJI_OPTIONS.map(e => `<span class="emoji-opt" onclick="event.stopPropagation();pickEmoji('${uid}','${e}')">${e}</span>`).join('')}
  </div>`;
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function selectUser(id) {
  currentUser = USERS.find(u => u.id === id);
  if (currentUser.admin) renderAdmin(); else renderMember();
}
function goHome() { currentUser = null; showScreen('home'); renderHome(); }

// ─── HOME ─────────────────────────────────────────────────────────────────────
function renderHome() {
  const grid = document.getElementById('user-grid');
  const members = USERS.filter(u => !u.admin);
  const adm = USERS.find(u => u.admin);
  const needsAttention = USERS.reduce((s, u) =>
    s + getUserTasks(u.id).filter(t => t.status === 'done' || t.status === 'resubmitted').length, 0);

  const adminCard = `
    <div class="home-card admin-card" onclick="selectUser('${adm.id}')">
      ${needsAttention ? '<div class="notif-dot"></div>' : ''}
      <div class="avatar-wrap">
        <div class="avatar-circle" style="background:${adm.color};border-color:${adm.border}"
          onclick="event.stopPropagation();openEmojiPicker('${adm.id}',event)">${adm.emoji}</div>
        ${emojiPickerHTML(adm.id)}
      </div>
      <div class="card-text">
        <div class="card-name">${adm.name} ⭐</div>
        <div class="card-meta">ניהול משפחה</div>
        <div class="card-info" style="color:${needsAttention ? '#BA7517' : '#888'}">
          ${needsAttention ? `${needsAttention} ממתינות לאישור` : 'הכל מאושר ✓'}
        </div>
      </div>
      <i class="ti ti-chevron-left card-chevron"></i>
    </div>`;

  const memberCards = members.map(u => {
    const p = getProgress(u.id);
    const col = progressColor(p.pct);
    const hasReturned = getUserTasks(u.id).some(t => t.status === 'returned');
    return `
      <div class="home-card" onclick="selectUser('${u.id}')">
        ${hasReturned ? '<div class="notif-dot" style="background:#BA7517"></div>' : ''}
        <div class="avatar-wrap">
          <div class="avatar-circle" style="background:${u.color};border-color:${u.border}"
            onclick="event.stopPropagation();openEmojiPicker('${u.id}',event)">${u.emoji}</div>
          ${emojiPickerHTML(u.id)}
        </div>
        <div class="card-name">${u.name}</div>
        <div class="card-meta">${p.total ? `${p.done}/${p.total} משימות` : 'אין משימות'}</div>
        ${p.total ? `<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${p.pct}%;background:${col}"></div></div>` : ''}
      </div>`;
  }).join('');

  grid.innerHTML = adminCard + memberCards;
}

// ─── TASK CARD HTML ───────────────────────────────────────────────────────────
function taskCardHTML(t, uid, isAdmin) {
  const status = t.status || 'open';
  const isPendingCheck = pendingCheckTask && pendingCheckTask.uid === uid && pendingCheckTask.index === t._i;
  const u = USERS.find(x => x.id === uid);

  // colors per status
  const statusColors = { open: '', done: '#FAC775', returned: '#F5C4B3', resubmitted: '#B5D4F4' };
  const borderColor = statusColors[status] || '';

  // status label for admin
  const statusLabels = {
    done: `✅ ${u.name} סימן/ה כבוצע`,
    returned: '↩️ הוחזר לילד',
    resubmitted: `🔄 ${u.name} סימן/ה שוב`,
  };

  return `
    <div class="task-card" id="task-${uid}-${t._i}"
      style="${borderColor ? `border-color:${borderColor}` : ''}"
      draggable="${status === 'open' ? 'true' : 'false'}"
      ondragstart="onDragStart(event,'${uid}',${t._i})"
      ondragover="onDragOver(event)"
      ondrop="onDrop(event,'${uid}',${t._i})"
      ondragend="onDragEnd(event)">

      ${status === 'open' ? '<i class="ti ti-grip-vertical drag-handle"></i>' : '<div style="width:20px"></div>'}

      <div class="burst-wrap">
        <button class="task-check ${status !== 'open' ? 'checked' : ''}"
          id="chk-${uid}-${t._i}"
          onclick="${status === 'open' || status === 'returned' ? `handleCheck('${uid}',${t._i},${isAdmin})` : ''}"
          style="${status !== 'open' && status !== 'returned' ? 'cursor:default;opacity:0.7' : ''}"
          aria-label="סמן">
          ${status !== 'open' ? '<i class="ti ti-check"></i>' : ''}
        </button>
      </div>

      <div class="task-text-wrap">
        <div class="task-text ${status !== 'open' ? 'done' : ''}">${t.text}</div>
        ${t.addedBy ? `<div class="task-note-display">➕ נוסף על ידי ${t.addedBy}</div>` : ''}

        ${isAdmin && status !== 'open' ? `<div class="task-status-label">${statusLabels[status] || ''}</div>` : ''}

        ${isPendingCheck ? `
          <div class="task-note-wrap" style="margin-top:8px">
            <input class="task-note-input" id="note-input-${uid}-${t._i}"
              placeholder="מה עשית? (אופציונלי)"
              onkeydown="if(event.key==='Enter')submitDone('${uid}',${t._i},${isAdmin})">
            <button class="task-note-confirm" onclick="submitDone('${uid}',${t._i},${isAdmin})">שלחי ✓</button>
          </div>` : ''}

        ${!isPendingCheck && (status === 'done' || status === 'resubmitted') ? `
          <div class="pingpong-thread">
            ${t.memberNote ? `<div class="pp-bubble pp-member"><span class="pp-name">${u.name}</span>${t.memberNote}</div>` : `<div class="pp-empty">${u.name} לא הוסיף/ה הערה</div>`}
            ${t.adminNote ? `<div class="pp-bubble pp-admin"><span class="pp-name">אמא</span>${t.adminNote}</div>` : ''}
            ${t.memberNote2 ? `<div class="pp-bubble pp-member"><span class="pp-name">${u.name}</span>${t.memberNote2}</div>` : ''}
            ${isAdmin ? `
              <div class="pp-actions">
                <button class="btn-return" onclick="showReturnInput('${uid}',${t._i})">
                  <i class="ti ti-corner-down-left"></i> החזירי עם הערה
                </button>
                <button class="btn-approve-full" onclick="approveTask('${uid}',${t._i})">
                  <i class="ti ti-circle-check"></i> אשרי
                </button>
              </div>
` : ''}
          </div>` : ''}

        ${!isPendingCheck && status === 'returned' && !isAdmin ? `
          <div class="pingpong-thread">
            ${t.memberNote ? `<div class="pp-bubble pp-member"><span class="pp-name">${u.name}</span>${t.memberNote}</div>` : ''}
            ${t.adminNote ? `<div class="pp-bubble pp-admin"><span class="pp-name">אמא</span>${t.adminNote}</div>` : ''}
            <div class="pp-hint">אמא החזירה את המשימה — סמן/י שוב כשתסיים/י</div>
          </div>` : ''}

        ${!isAdmin && status === 'open' ? '' : ''}
      </div>

      <div class="task-actions">
        ${isAdmin && status === 'open' ? `<button class="task-edit-btn" onclick="startEdit('${uid}',${t._i})"><i class="ti ti-pencil"></i></button>` : ''}
        ${isAdmin && status === 'open' ? `<button class="task-delete" onclick="deleteTask('${uid}',${t._i})"><i class="ti ti-trash"></i></button>` : ''}
      </div>
    </div>`;
}

// ─── MEMBER VIEW ──────────────────────────────────────────────────────────────
function renderMember() {
  showScreen('member');
  document.getElementById('member-title').textContent = 'שלום ' + currentUser.name + ' 👋';
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

  const adm = USERS.find(u => u.admin);
  const isSelf = currentUser.admin;
  container.innerHTML += `
    <div class="member-add-box">
      <p>הוסיפי משימה:</p>
      <div class="add-task-row" style="margin-bottom:${isSelf ? '0' : '8px'}">
        <input type="text" id="self-task-input" placeholder="משימה לעצמי..."
          onkeydown="if(event.key==='Enter')addSelfTask()">
        <button onclick="addSelfTask()">לי</button>
      </div>
      ${!isSelf ? `
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
  const allUsers = USERS;

  const bulkHtml = `
    <div class="bulk-add-box">
      <p>הוסיפי משימה לכמה בני משפחה בבת אחת:</p>
      <div class="bulk-checkboxes">
        ${allUsers.map(u => `<div class="bulk-cb ${bulkSelected.includes(u.id) ? 'selected' : ''}"
          onclick="toggleBulk('${u.id}')">${u.emoji} ${u.name}</div>`).join('')}
      </div>
      <div class="bulk-input-row">
        <input type="text" id="bulk-input" placeholder="שם המשימה..."
          onkeydown="if(event.key==='Enter')addBulkTask()">
        <button onclick="addBulkTask()">הוסיפי לכולם</button>
      </div>
    </div>`;

  const membersHtml = allUsers.map((u, idx) => {
    const userTasks = getUserTasks(u.id);
    const pendingCount = userTasks.filter(t => t.status === 'done' || t.status === 'resubmitted').length;
    const p = getProgress(u.id);
    const col = progressColor(p.pct);
    const sorted = sortedTasks(u.id);
    const tasksHtml = sorted.length
      ? sorted.map(t => taskCardHTML(t, u.id, true)).join('')
      : '<div class="empty-state" style="padding:0.5rem 0;font-size:13px;">אין משימות</div>';

    return `
      <div class="member-section">
        <div class="member-header">
          <div class="mini-avatar" style="background:${u.color}">${u.emoji}</div>
          <span class="member-name">${u.name}${u.admin ? ' ⭐' : ''}</span>
          ${pendingCount ? `<span class="badge badge-pending">
            <i class="ti ti-clock" style="font-size:11px"></i> ${pendingCount} ממתינות</span>` : ''}
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
      </div>
      ${idx < allUsers.length - 1 ? '<hr class="section-divider">' : ''}`;
  }).join('');

  container.innerHTML = bulkHtml + membersHtml;
}

// ─── TASK ACTIONS ─────────────────────────────────────────────────────────────

// Step 1: member clicks check → show note input
function handleCheck(uid, index, isAdmin) {
  if (!tasks[uid] || !tasks[uid][index]) return;
  const status = tasks[uid][index].status || 'open';
  if (status !== 'open' && status !== 'returned') return;

  pendingCheckTask = { uid, index };
  isAdmin ? renderAdmin() : renderMember();
  setTimeout(() => {
    const inp = document.getElementById(`note-input-${uid}-${index}`);
    if (inp) inp.focus();
  }, 50);
}

// Step 2: member submits done with optional note
function submitDone(uid, index, isAdmin) {
  const inp = document.getElementById(`note-input-${uid}-${index}`);
  const note = inp ? inp.value.trim() : '';
  if (!tasks[uid] || !tasks[uid][index]) return;

  const prevStatus = tasks[uid][index].status || 'open';
  const noteField = prevStatus === 'returned' ? 'memberNote2' : 'memberNote';
  tasks[uid][index][noteField] = note;
  tasks[uid][index].status = prevStatus === 'returned' ? 'resubmitted' : 'done';

  pendingCheckTask = null;
  saveTasks();

  const btn = document.getElementById(`chk-${uid}-${index}`);
  if (btn) {
    btn.classList.add('pop');
    btn.innerHTML = '<i class="ti ti-check"></i>';
    const rect = btn.getBoundingClientRect();
    spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  setTimeout(() => { isAdmin ? renderAdmin() : renderMember(); }, 700);
}

// Admin: show return input — pause Firebase re-renders while typing
function showReturnInput(uid, index) {
  // hide actions, show input inline without re-render
  const ppActions = document.querySelector(`#task-${uid}-${index} .pp-actions`);
  const existingWrap = document.getElementById(`return-wrap-${uid}-${index}`);
  if (ppActions) ppActions.style.display = 'none';
  if (existingWrap) {
    existingWrap.style.display = 'flex';
    existingWrap.querySelector('input')?.focus();
    return;
  }
  // inject input after pp-actions
  const thread = document.querySelector(`#task-${uid}-${index} .pingpong-thread`);
  if (!thread) return;
  const wrap = document.createElement('div');
  wrap.id = `return-wrap-${uid}-${index}`;
  wrap.className = 'task-note-wrap';
  wrap.style.marginTop = '6px';
  wrap.innerHTML = `
    <input class="task-note-input" id="return-input-${uid}-${index}"
      placeholder="כתבי הערה לילד..."
      onkeydown="if(event.key==='Enter')submitReturn('${uid}',${index})">
    <button class="task-note-confirm" onclick="submitReturn('${uid}',${index})">שלחי</button>`;
  thread.appendChild(wrap);
  setTimeout(() => document.getElementById(`return-input-${uid}-${index}`)?.focus(), 30);
}

// Admin: submit return with note
function submitReturn(uid, index) {
  const inp = document.getElementById(`return-input-${uid}-${index}`);
  const note = inp ? inp.value.trim() : '';
  if (!tasks[uid] || !tasks[uid][index]) return;
  tasks[uid][index].adminNote = note;
  tasks[uid][index].status = 'returned';
  saveTasks();
  renderAdmin();
}

// Admin: approve → task disappears
function approveTask(userId, index) {
  const el = document.getElementById(`task-${userId}-${index}`);
  if (el) { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }
  setTimeout(() => {
    if (tasks[userId]) tasks[userId].splice(index, 1);
    saveTasks();
  }, 300);
}

function addTask(userId) {
  const input = document.getElementById('new-task-' + userId);
  const text = input.value.trim();
  if (!text) return;
  if (!tasks[userId]) tasks[userId] = [];
  tasks[userId].push({ text, status: 'open', memberNote: '', adminNote: '', memberNote2: '' });
  input.value = '';
  saveTasks();
}

function addSelfTask() {
  const input = document.getElementById('self-task-input');
  const text = input.value.trim();
  if (!text) return;
  const uid = currentUser.id;
  if (!tasks[uid]) tasks[uid] = [];
  tasks[uid].push({ text, status: 'open', memberNote: '', adminNote: '', memberNote2: '' });
  input.value = '';
  saveTasks();
}

function addTaskToMom() {
  const input = document.getElementById('mom-task-input');
  const text = input.value.trim();
  if (!text) return;
  const adm = USERS.find(u => u.admin);
  if (!tasks[adm.id]) tasks[adm.id] = [];
  tasks[adm.id].push({ text, status: 'open', addedBy: currentUser.name, memberNote: '', adminNote: '', memberNote2: '' });
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
  const current = tasks[uid][index].text;
  // replace just the text div
  const textDiv = wrap.querySelector('.task-text');
  if (!textDiv) return;
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
  setTimeout(() => { document.getElementById('bulk-input')?.focus(); }, 50);
}

function addBulkTask() {
  const input = document.getElementById('bulk-input');
  const text = input.value.trim();
  if (!text || !bulkSelected.length) return;
  for (const uid of bulkSelected) {
    if (!tasks[uid]) tasks[uid] = [];
    tasks[uid].push({ text, status: 'open', memberNote: '', adminNote: '', memberNote2: '' });
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
window.closeEmojiPicker = closeEmojiPicker;
window.pickEmoji = pickEmoji;
window.handleCheck = handleCheck;
window.submitDone = submitDone;
window.showReturnInput = showReturnInput;
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

// ─── INIT ─────────────────────────────────────────────────────────────────────
listenToFirebase();
renderHome();
