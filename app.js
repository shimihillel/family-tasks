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

// ─── STATE ────────────────────────────────────────────────────────────────────
let USERS = JSON.parse(JSON.stringify(DEFAULT_USERS));
let tasks = {};
let currentUser = null;
let activeEmojiUserId = null;
let bulkSelected = [];
let dragSrcIndex = null;
let dragUserId = null;
// track which task is waiting for a note before confirming
let pendingNoteTask = null; // { uid, index }

// ─── FIREBASE ─────────────────────────────────────────────────────────────────
function saveTasks() { set(ref(db, 'tasks'), tasks).catch(console.error); }
function saveUsers() { set(ref(db, 'users'), USERS).catch(console.error); }

function listenToFirebase() {
  onValue(ref(db, 'tasks'), (snap) => {
    tasks = snap.val() || {};
    if (pendingNoteTask) return;
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
let animating = false;

function resizeCanvas() { confettiCanvas.width = window.innerWidth; confettiCanvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function spawnConfetti(x, y) {
  const emojis = ['✨','⭐','💫','🌟','🎉','🥳'];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.6;
    const speed = 3 + Math.random() * 5;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      life: 1, decay: 0.025 + Math.random() * 0.02, size: 16 + Math.random() * 10 });
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
  } else {
    activeEmojiUserId = null;
  }

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

function goHome() { currentUser = null; showScreen('home'); renderHome(); }

// ─── HOME ─────────────────────────────────────────────────────────────────────
function renderHome() {
  const grid = document.getElementById('user-grid');
  const members = USERS.filter(u => !u.admin);
  const adm = USERS.find(u => u.admin);

  // pending = tasks marked done waiting for approval, including admin's own tasks
  const allPending = USERS.reduce((s, u) =>
    s + getUserTasks(u.id).filter(t => t.doneByUser).length, 0);

  const adminCard = `
    <div class="home-card admin-card" onclick="selectUser('${adm.id}')">
      ${allPending ? '<div class="notif-dot"></div>' : ''}
      <div class="avatar-wrap">
        <div class="avatar-circle" style="background:${adm.color};border-color:${adm.border}"
          onclick="event.stopPropagation();openEmojiPicker('${adm.id}',event)">${adm.emoji}</div>
        ${emojiPickerHTML(adm.id)}
      </div>
      <div class="card-text">
        <div class="card-name">${adm.name} ⭐</div>
        <div class="card-meta">ניהול משפחה</div>
        <div class="card-info" style="color:${allPending ? '#BA7517' : '#888'}">
          ${allPending ? `${allPending} ממתינות לאישור` : 'הכל מאושר ✓'}
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
        ${p.total ? `<div class="progress-bar-wrap">
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

  if (!userTasks.length) { container.innerHTML = ''; empty.style.display = 'block'; }
  else {
    empty.style.display = 'none';
    const p = getProgress(currentUser.id);
    const col = progressColor(p.pct);
    container.innerHTML = `
      <div style="margin-bottom:1.25rem;">
        <div class="progress-row"><span>${p.done} מתוך ${p.total} בוצעו</span><span>${p.pct}%</span></div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${p.pct}%;background:${col}"></div>
        </div>
      </div>
      ${sortedTasks(currentUser.id).map(t => taskCardHTML(t, currentUser.id, false)).join('')}`;
  }

  // add task box — add to self or to mom
  const adm = USERS.find(u => u.admin);
  const isSelf = currentUser.admin;
  container.innerHTML += `
    <div class="member-add-box">
      <p>הוסיפי משימה:</p>
      <div class="add-task-row" style="margin-bottom:8px">
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

function addSelfTask() {
  const input = document.getElementById('self-task-input');
  const text = input.value.trim();
  if (!text) return;
  const uid = currentUser.id;
  if (!tasks[uid]) tasks[uid] = [];
  tasks[uid].push({ text, doneByUser: false, note: '' });
  input.value = '';
  saveTasks();
}

function addTaskToMom() {
  const input = document.getElementById('mom-task-input');
  const text = input.value.trim();
  if (!text) return;
  const adm = USERS.find(u => u.admin);
  if (!tasks[adm.id]) tasks[adm.id] = [];
  tasks[adm.id].push({ text, doneByUser: false, note: '', addedBy: currentUser.name });
  input.value = '';
  saveTasks();
}

// ─── ADMIN VIEW ───────────────────────────────────────────────────────────────
function renderAdmin() {
  showScreen('admin');
  const container = document.getElementById('admin-content');
  const allUsers = USERS; // admin sees everyone including herself

  const bulkHtml = `
    <div class="bulk-add-box">
      <p>הוסיפי משימה לכמה בני משפחה בבת אחת:</p>
      <div class="bulk-checkboxes">
        ${allUsers.map(u => `
          <div class="bulk-cb ${bulkSelected.includes(u.id) ? 'selected' : ''}"
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
    const pendingCount = userTasks.filter(t => t.doneByUser).length;
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
          <div class="member-progress-bar">
            <div class="member-progress-fill" style="width:${p.pct}%;background:${col}"></div>
          </div>
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

// ─── TASK CARD HTML ───────────────────────────────────────────────────────────
function taskCardHTML(t, uid, isAdmin) {
  const isPendingNote = pendingNoteTask && pendingNoteTask.uid === uid && pendingNoteTask.index === t._i;
  const msgs = t.messages || []; // array of {from, text, ts}

  const messagesHTML = msgs.map(m => {
    const isAdminMsg = m.from === 'admin';
    return `<div class="thread-bubble ${isAdminMsg ? 'thread-admin' : 'thread-member'}">
      ${!isAdminMsg ? `<span class="thread-sender">${m.from}</span>` : ''}
      ${m.text}
    </div>`;
  }).join('');

  return `
    <div class="task-card ${t.doneByUser ? 'pending-approval' : ''}" id="task-${uid}-${t._i}"
      draggable="true"
      ondragstart="onDragStart(event,'${uid}',${t._i})"
      ondragover="onDragOver(event)"
      ondrop="onDrop(event,'${uid}',${t._i})"
      ondragend="onDragEnd(event)">
      <i class="ti ti-grip-vertical drag-handle"></i>
      <div class="burst-wrap">
        <button class="task-check ${t.doneByUser ? 'checked' : ''}" id="chk-${uid}-${t._i}"
          onclick="handleCheck('${uid}',${t._i},${isAdmin})" aria-label="סמן">
          ${t.doneByUser ? '<i class="ti ti-check"></i>' : ''}
        </button>
      </div>
      <div class="task-text-wrap" id="textwrap-${uid}-${t._i}">
        <div class="task-text ${t.doneByUser ? 'done' : ''}">${t.text}</div>
        ${t.addedBy ? `<div class="task-note-display">➕ נוסף על ידי ${t.addedBy}</div>` : ''}

        ${isPendingNote ? `
          <div class="task-note-wrap">
            <input class="task-note-input" id="note-input-${uid}-${t._i}"
              placeholder="הוסיפי הערה (אופציונלי)..."
              onkeydown="if(event.key==='Enter')confirmCheck('${uid}',${t._i},${isAdmin})">
            <button class="task-note-confirm"
              onclick="confirmCheck('${uid}',${t._i},${isAdmin})">אישור ✓</button>
          </div>` : ''}

        ${t.doneByUser && !isPendingNote ? `
          <div class="task-thread" id="thread-${uid}-${t._i}">
            ${messagesHTML}
            <div class="thread-input-row">
              <input class="task-note-input" id="msg-input-${uid}-${t._i}"
                placeholder="${isAdmin ? 'כתבי הודעה...' : 'כתבי הודעה לאמא...'}"
                onkeydown="if(event.key==='Enter')sendMessage('${uid}',${t._i},${isAdmin})">
              <button class="task-note-confirm" onclick="sendMessage('${uid}',${t._i},${isAdmin})">
                <i class="ti ti-send"></i>
              </button>
            </div>
            ${isAdmin ? `
              <button class="btn-approve-full" onclick="approveTask('${uid}',${t._i})">
                <i class="ti ti-circle-check"></i> סיום ואישור
              </button>` : ''}
          </div>` : ''}
      </div>
      <div class="task-actions">
        ${isAdmin && !t.doneByUser ? `<button class="task-edit-btn" onclick="startEdit('${uid}',${t._i})"><i class="ti ti-pencil"></i></button>` : ''}
        ${isAdmin && !t.doneByUser ? `<button class="task-delete" onclick="deleteTask('${uid}',${t._i})"><i class="ti ti-trash"></i></button>` : ''}
      </div>
    </div>`;
}

// ─── TASK ACTIONS ─────────────────────────────────────────────────────────────
function handleCheck(uid, index, isAdmin) {
  if (!tasks[uid]) return;
  const wasDone = tasks[uid][index].doneByUser;

  if (wasDone) {
    // uncheck
    tasks[uid][index].doneByUser = false;
    tasks[uid][index].note = '';
    pendingNoteTask = null;
    saveTasks();
    isAdmin ? renderAdmin() : renderMember();
    return;
  }

  // checking — show note input first
  pendingNoteTask = { uid, index };
  isAdmin ? renderAdmin() : renderMember();

  // focus the note input
  setTimeout(() => {
    const inp = document.getElementById(`note-input-${uid}-${index}`);
    if (inp) inp.focus();
  }, 50);
}

function confirmCheck(uid, index, isAdmin) {
  const inp = document.getElementById(`note-input-${uid}-${index}`);
  const note = inp ? inp.value.trim() : '';

  tasks[uid][index].doneByUser = true;
  tasks[uid][index].messages = note ? [{ from: currentUser.name, text: note, ts: Date.now() }] : [];
  pendingNoteTask = null;
  saveTasks();

  // confetti!
  const btn = document.getElementById(`chk-${uid}-${index}`);
  if (btn) {
    btn.classList.add('checked', 'pop');
    btn.innerHTML = '<i class="ti ti-check"></i>';
    const rect = btn.getBoundingClientRect();
    spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  setTimeout(() => { isAdmin ? renderAdmin() : renderMember(); }, 700);
}

function sendMessage(uid, index, isAdmin) {
  const inp = document.getElementById(`msg-input-${uid}-${index}`);
  const text = inp ? inp.value.trim() : '';
  if (!text || !tasks[uid] || !tasks[uid][index]) return;
  if (!tasks[uid][index].messages) tasks[uid][index].messages = [];
  const from = isAdmin ? 'admin' : currentUser.name;
  tasks[uid][index].messages.push({ from, text, ts: Date.now() });
  inp.value = '';
  saveTasks();
  // append message to thread without full re-render
  const thread = document.getElementById(`thread-${uid}-${index}`);
  if (thread) {
    const bubble = document.createElement('div');
    bubble.className = `thread-bubble ${isAdmin ? 'thread-admin' : 'thread-member'}`;
    bubble.innerHTML = (!isAdmin ? `<span class="thread-sender">${currentUser.name}</span>` : '') + text;
    const inputRow = thread.querySelector('.thread-input-row');
    thread.insertBefore(bubble, inputRow);
    thread.scrollTop = thread.scrollHeight;
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
  tasks[userId].push({ text, doneByUser: false, note: '' });
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
  wrap.innerHTML = `<input class="task-edit-input" value="${tasks[uid][index].text}"
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
    tasks[uid].push({ text, doneByUser: false, note: '' });
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
window.confirmCheck = confirmCheck;
window.sendMessage = sendMessage;
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
