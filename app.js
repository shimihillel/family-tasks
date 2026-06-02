// ─── FIREBASE CONFIG ──────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, onValue, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

// ─── STATE ────────────────────────────────────────────────────────────────────
let USERS = JSON.parse(JSON.stringify(DEFAULT_USERS));
let tasks = {};
let currentUser = null;
let activeEmojiUserId = null;
let bulkSelected = [];
let dragSrcIndex = null;
let dragUserId = null;
let isSaving = false;

// ─── FIREBASE SAVE/LOAD ───────────────────────────────────────────────────────
async function saveTasks() {
  if (isSaving) return;
  isSaving = true;
  try { await set(ref(db, 'tasks'), tasks); } catch(e) { console.error(e); }
  isSaving = false;
}

async function saveUsers() {
  try { await set(ref(db, 'users'), USERS); } catch(e) { console.error(e); }
}

function listenToFirebase() {
  // Real-time listener for tasks
  onValue(ref(db, 'tasks'), (snapshot) => {
    const data = snapshot.val();
    tasks = data || {};
    const s = getCurrentScreen();
    if (s === 'admin') renderAdmin();
    else if (s === 'member') renderMember();
    else renderHome();
  });

  // Real-time listener for users (emoji changes)
  onValue(ref(db, 'users'), (snapshot) => {
    const data = snapshot.val();
    if (data && Array.isArray(data)) {
      USERS = data;
      const s = getCurrentScreen();
      if (s === 'home') renderHome();
    }
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getUserTasks(uid) { return tasks[uid] || []; }

function getProgress(uid) {
  const t = getUserTasks(uid);
  if (!t.length) return { done: 0, total: 0, pct: 0 };
  const done = t.filter(x => x.doneByUser).length;
  return { done, total: t.length, pct: Math.round(done / t.length * 100) };
}

function progressColor(pct) {
  if (pct >= 80) return '#1D9E75';
  if (pct >= 40) return '#BA7517';
  return '#E24B4A';
}

function sortedTasks(uid) {
  return getUserTasks(uid)
    .map((t, i) => ({ ...t, _i: i }))
    .sort((a, b) => {
      if (a.doneByUser && !b.doneByUser) return 1;
      if (!a.doneByUser && b.doneByUser) return -1;
      return 0;
    });
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
let particles = [];

function resizeCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function spawnConfetti(x, y) {
  const emojis = ['✨', '⭐', '💫', '🌟', '🎉', '🥳'];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.6;
    const speed = 3 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      life: 1,
      decay: 0.03 + Math.random() * 0.02,
      size: 16 + Math.random() * 8,
    });
  }
  if (particles.length > 0 && !animating) animateConfetti();
}

let animating = false;
function animateConfetti() {
  animating = true;
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.font = p.size + 'px serif';
    ctx.fillText(p.emoji, p.x, p.y);
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2;
    p.life -= p.decay;
  });
  ctx.globalAlpha = 1;
  if (particles.length > 0) {
    requestAnimationFrame(animateConfetti);
  } else {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    animating = false;
  }
}

// ─── EMOJI PICKER ─────────────────────────────────────────────────────────────
function openEmojiPicker(uid, e) {
  e.stopPropagation();
  if (activeEmojiUserId && activeEmojiUserId !== uid) closeEmojiPicker();
  const picker = document.getElementById('emoji-picker-' + uid);
  activeEmojiUserId = uid;
  picker.classList.toggle('open');
  document.getElementById('emoji-overlay').style.display =
    picker.classList.contains('open') ? 'block' : 'none';
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
  saveUsers();
  closeEmojiPicker();
  renderHome();
}

function emojiPickerHTML(uid) {
  return `<div id="emoji-picker-${uid}" class="emoji-picker">
    ${EMOJI_OPTIONS.map(e =>
      `<span class="emoji-opt" onclick="event.stopPropagation();pickEmoji('${uid}','${e}')">${e}</span>`
    ).join('')}
  </div>`;
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function selectUser(id) {
  currentUser = USERS.find(u => u.id === id);
  if (currentUser.admin) renderAdmin();
  else renderMember();
}

function goHome() {
  currentUser = null;
  showScreen('home');
  renderHome();
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function renderHome() {
  const grid = document.getElementById('user-grid');
  const members = USERS.filter(u => !u.admin);
  const adm = USERS.find(u => u.admin);
  const totalPending = members.reduce((s, u) =>
    s + getUserTasks(u.id).filter(t => t.doneByUser).length, 0);

  const adminCard = `
    <div class="home-card admin-card" onclick="selectUser('${adm.id}')">
      ${totalPending ? '<div class="notif-dot"></div>' : ''}
      <div class="avatar-wrap">
        <div class="avatar-circle" style="background:${adm.color};border-color:${adm.border}"
          onclick="event.stopPropagation();openEmojiPicker('${adm.id}',event)">${adm.emoji}</div>
        ${emojiPickerHTML(adm.id)}
      </div>
      <div class="card-text">
        <div class="card-name">${adm.name} ⭐</div>
        <div class="card-meta">ניהול משפחה</div>
        <div class="card-info" style="color:${totalPending ? '#BA7517' : '#888'}">
          ${totalPending ? `${totalPending} ממתינות לאישור` : 'הכל מאושר ✓'}
        </div>
      </div>
      <i class="ti ti-chevron-left card-chevron"></i>
    </div>`;

  const memberCards = members.map(u => {
    const p = getProgress(u.id);
    const col = progressColor(p.pct);
    const hasPending = getUserTasks(u.id).some(t => t.doneByUser);
    return `
      <div class="home-card" onclick="selectUser('${u.id}')">
        ${hasPending ? '<div class="notif-dot"></div>' : ''}
        <div class="avatar-wrap">
          <div class="avatar-circle" style="background:${u.color};border-color:${u.border}"
            onclick="event.stopPropagation();openEmojiPicker('${u.id}',event)">${u.emoji}</div>
          ${emojiPickerHTML(u.id)}
        </div>
        <div class="card-name">${u.name}</div>
        <div class="card-meta">${p.total ? `${p.done}/${p.total} משימות` : 'אין משימות'}</div>
        ${p.total ? `
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width:${p.pct}%;background:${col}"></div>
          </div>` : ''}
      </div>`;
  }).join('');

  grid.innerHTML = adminCard + memberCards;
}

// ─── MEMBER VIEW ──────────────────────────────────────────────────────────────
function renderMember() {
  showScreen('member');
  document.getElementById('member-title').textContent = 'שלום ' + currentUser.name + ' 👋';
  const container = document.getElementById('member-tasks');
  const empty = document.getElementById('member-empty');
  const userTasks = getUserTasks(currentUser.id);

  if (!userTasks.length) { container.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  const p = getProgress(currentUser.id);
  const col = progressColor(p.pct);
  const sorted = sortedTasks(currentUser.id);

  container.innerHTML = `
    <div style="margin-bottom:1.25rem;">
      <div class="progress-row"><span>${p.done} מתוך ${p.total} בוצעו</span><span>${p.pct}%</span></div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${p.pct}%;background:${col}"></div>
      </div>
    </div>
    ${sorted.map(t => taskCardHTML(t, currentUser.id, false)).join('')}`;
}

// ─── ADMIN VIEW ───────────────────────────────────────────────────────────────
function renderAdmin() {
  showScreen('admin');
  const container = document.getElementById('admin-content');
  const members = USERS.filter(u => !u.admin);

  const bulkHtml = `
    <div class="bulk-add-box">
      <p>הוסיפי משימה לכמה בני משפחה בבת אחת:</p>
      <div class="bulk-checkboxes">
        ${members.map(u => `
          <div class="bulk-cb ${bulkSelected.includes(u.id) ? 'selected' : ''}"
            onclick="toggleBulk('${u.id}')">${u.emoji} ${u.name}</div>`).join('')}
      </div>
      <div class="bulk-input-row">
        <input type="text" id="bulk-input" placeholder="שם המשימה..."
          onkeydown="if(event.key==='Enter')addBulkTask()">
        <button onclick="addBulkTask()">הוסיפי לכולם</button>
      </div>
    </div>`;

  const membersHtml = members.map((u, idx) => {
    const userTasks = getUserTasks(u.id);
    const pendingCount = userTasks.filter(t => t.doneByUser).length;
    const p = getProgress(u.id);
    const col = progressColor(p.pct);
    const sorted = sortedTasks(u.id);
    const tasksHtml = sorted.length
      ? sorted.map(t => taskCardHTML(t, u.id, true)).join('')
      : '<div class="empty-state" style="padding:0.75rem 0;font-size:13px;">אין משימות</div>';

    return `
      <div class="member-section">
        <div class="member-header">
          <div class="mini-avatar" style="background:${u.color}">${u.emoji}</div>
          <span class="member-name">${u.name}</span>
          ${pendingCount ? `
            <span class="badge badge-pending">
              <i class="ti ti-clock" style="font-size:11px"></i> ${pendingCount} ממתינות
            </span>` : ''}
        </div>
        ${p.total ? `
          <div class="member-progress">
            <div class="member-progress-bar">
              <div class="member-progress-fill" style="width:${p.pct}%;background:${col}"></div>
            </div>
            <span class="member-progress-label">${p.done}/${p.total}</span>
          </div>` : ''}
        ${tasksHtml}
        <div class="add-for-member">
          <input type="text" id="new-task-${u.id}" placeholder="הוסיפי משימה ל${u.name}..."
            onkeydown="if(event.key==='Enter')addTask('${u.id}')">
          <button onclick="addTask('${u.id}')"><i class="ti ti-plus"></i></button>
        </div>
      </div>
      ${idx < members.length - 1 ? '<hr class="section-divider">' : ''}`;
  }).join('');

  container.innerHTML = bulkHtml + membersHtml;
}

// ─── TASK CARD HTML ───────────────────────────────────────────────────────────
function taskCardHTML(t, uid, isAdmin) {
  return `
    <div class="task-card ${t.doneByUser ? 'pending-approval' : ''}" id="task-${uid}-${t._i}"
      draggable="true"
      ondragstart="onDragStart(event,'${uid}',${t._i})"
      ondragover="onDragOver(event)"
      ondrop="onDrop(event,'${uid}',${t._i})"
      ondragend="onDragEnd(event)">
      <i class="ti ti-grip-vertical drag-handle" aria-hidden="true"></i>
      <div class="burst-wrap">
        <button class="task-check ${t.doneByUser ? 'checked' : ''}" id="chk-${uid}-${t._i}"
          onclick="handleCheck('${uid}',${t._i},${isAdmin})" aria-label="סמן כבוצע">
          ${t.doneByUser ? '<i class="ti ti-check"></i>' : ''}
        </button>
      </div>
      <div class="task-text-wrap" id="textwrap-${uid}-${t._i}">
        <div class="task-text ${t.doneByUser ? 'done' : ''}">${t.text}</div>
        ${t.doneByUser
          ? `<div class="task-status" style="${isAdmin ? 'color:#BA7517' : ''}">ממתין לאישור אמא...</div>`
          : ''}
      </div>
      <div class="task-actions">
        ${isAdmin && !t.doneByUser
          ? `<button class="task-edit-btn" onclick="startEdit('${uid}',${t._i})" aria-label="ערוך">
               <i class="ti ti-pencil"></i></button>` : ''}
        ${isAdmin && t.doneByUser
          ? `<button class="btn-approve" onclick="approveTask('${uid}',${t._i})">אשרי</button>` : ''}
        ${isAdmin && !t.doneByUser
          ? `<button class="task-delete" onclick="deleteTask('${uid}',${t._i})" aria-label="מחק">
               <i class="ti ti-trash"></i></button>` : ''}
      </div>
    </div>`;
}

// ─── TASK ACTIONS ─────────────────────────────────────────────────────────────
function handleCheck(uid, index, isAdmin) {
  if (!tasks[uid]) return;
  const wasDone = tasks[uid][index].doneByUser;
  tasks[uid][index].doneByUser = !wasDone;
  saveTasks();

  if (!wasDone) {
    const btn = document.getElementById(`chk-${uid}-${index}`);
    if (btn) {
      btn.classList.add('checked', 'pop');
      btn.innerHTML = '<i class="ti ti-check"></i>';
      const rect = btn.getBoundingClientRect();
      spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    setTimeout(() => { isAdmin ? renderAdmin() : renderMember(); }, 700);
  } else {
    isAdmin ? renderAdmin() : renderMember();
  }
}

function approveTask(userId, index) {
  const el = document.getElementById(`task-${userId}-${index}`);
  if (el) el.classList.add('removing');
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
  tasks[userId].push({ text, doneByUser: false });
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
  wrap.innerHTML = `<input class="task-edit-input" value="${current}"
    onkeydown="if(event.key==='Enter')saveEdit('${uid}',${index},this.value);if(event.key==='Escape')renderAdmin()"
    onblur="saveEdit('${uid}',${index},this.value)">`;
  wrap.querySelector('input').focus();
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
  setTimeout(() => { const el = document.getElementById('bulk-input'); if (el) el.focus(); }, 50);
}

function addBulkTask() {
  const input = document.getElementById('bulk-input');
  const text = input.value.trim();
  if (!text || !bulkSelected.length) return;
  for (const uid of bulkSelected) {
    if (!tasks[uid]) tasks[uid] = [];
    tasks[uid].push({ text, doneByUser: false });
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
  document.querySelectorAll('.task-card').forEach(c => {
    c.classList.remove('dragging'); c.classList.remove('drag-over');
  });
}

function onDrop(e, uid, targetIdx) {
  e.preventDefault();
  if (dragUserId !== uid || dragSrcIndex === null || dragSrcIndex === targetIdx) return;
  const [moved] = tasks[uid].splice(dragSrcIndex, 1);
  tasks[uid].splice(targetIdx, 0, moved);
  dragSrcIndex = null;
  saveTasks();
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
// expose functions globally (needed because app.js is type=module)
window.selectUser = selectUser;
window.goHome = goHome;
window.openEmojiPicker = openEmojiPicker;
window.closeEmojiPicker = closeEmojiPicker;
window.pickEmoji = pickEmoji;
window.handleCheck = handleCheck;
window.approveTask = approveTask;
window.addTask = addTask;
window.deleteTask = deleteTask;
window.startEdit = startEdit;
window.saveEdit = saveEdit;
window.toggleBulk = toggleBulk;
window.addBulkTask = addBulkTask;
window.onDragStart = onDragStart;
window.onDragOver = onDragOver;
window.onDragEnd = onDragEnd;
window.onDrop = onDrop;

listenToFirebase();
renderHome();
