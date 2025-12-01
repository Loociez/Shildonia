// index.js — client side for GitHub Pages (uses compat SDK already loaded in index.html)

// --- CONFIG: replace with the Cloud Function URL you deploy to:
const FUNCTION_BASE_URL = "FUNCTION_BASE_URL_REPLACE_ME"; // e.g. https://europe-west1-shildonia-38aab.cloudfunctions.net/rconApi

// HTML elements
const regUsername = document.getElementById('reg-username');
const regEmail = document.getElementById('reg-email');
const regPassword = document.getElementById('reg-password');
const btnRegister = document.getElementById('btn-register');

const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const loginStatus = document.getElementById('login-status');

const consoleCard = document.getElementById('console-card');
const adminCard = document.getElementById('admin-card');
const cmdInput = document.getElementById('cmd-input');
const btnSend = document.getElementById('btn-send');
const btnClear = document.getElementById('btn-clear');
const outputEl = document.getElementById('output');
const pendingList = document.getElementById('pending-list');

function showStatus(txt){ loginStatus.textContent = txt; }

// REGISTER
btnRegister.addEventListener('click', async () => {
  const username = (regUsername.value || '').trim();
  const email = (regEmail.value || '').trim();
  const pw = regPassword.value || '';
  if (!username || !email || !pw) return alert('Fill username, email and password.');

  try {
    // create auth user
    const cred = await firebase.auth().createUserWithEmailAndPassword(email, pw);
    const uid = cred.user.uid;

    // create Firestore user doc (client can create its own doc per rules)
    await firebase.firestore().collection('users').doc(uid).set({
      username,
      email,
      isApproved: false,
      isMaster: false,
      createdAt: Date.now()
    });

    alert('Registered. Wait for master to approve your account.');
    regUsername.value = regEmail.value = regPassword.value = '';
  } catch (err) {
    console.error('Register error', err);
    alert('Register error: ' + (err && err.message ? err.message : String(err)));
  }
});

// LOGIN by username: look up the user's email by username then sign in
async function signInByUsername(username, password){
  try {
    const q = firebase.firestore().collection('users').where('username', '==', username).orderBy('createdAt').limit(1);
    const snap = await q.get();
    if (snap.empty) throw new Error('No user with that username.');
    const docu = snap.docs[0];
    const email = docu.data().email;
    await firebase.auth().signInWithEmailAndPassword(email, password);
  } catch (err) {
    throw err;
  }
}

btnLogin.addEventListener('click', async () => {
  const u = (loginUsername.value || '').trim();
  const p = loginPassword.value || '';
  if (!u || !p) return alert('Enter username and password.');
  try {
    await signInByUsername(u, p);
    loginPassword.value = '';
  } catch (err) {
    console.error('Login failed', err);
    alert('Login failed: ' + (err && err.message ? err.message : String(err)));
  }
});

btnLogout.addEventListener('click', async () => {
  await firebase.auth().signOut();
});

// auth state handling
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    btnLogout.classList.add('hidden');
    btnLogin.classList.remove('hidden');
    consoleCard.classList.add('hidden');
    adminCard.classList.add('hidden');
    showStatus('Not logged in');
    return;
  }
  btnLogin.classList.add('hidden');
  btnLogout.classList.remove('hidden');
  showStatus('Logged in: ' + (user.email || user.uid));

  try {
    const snap = await firebase.firestore().collection('users').doc(user.uid).get();
    if (!snap.exists) {
      showStatus('User record missing. Contact admin.');
      return;
    }
    const data = snap.data();
    const approved = !!data.isApproved;
    const isMaster = !!data.isMaster || (data.username === 'Lambertio');

    if (approved) {
      consoleCard.classList.remove('hidden');
    } else {
      consoleCard.classList.add('hidden');
      showStatus('Account not yet approved by master.');
    }

    if (isMaster) {
      adminCard.classList.remove('hidden');
      loadPendingUsers();
    } else {
      adminCard.classList.add('hidden');
    }
  } catch (err) {
    console.error('Auth state handling error', err);
    showStatus('Auth error: ' + (err && err.message ? err.message : String(err)));
  }
});

// load pending users for admin
async function loadPendingUsers(){
  pendingList.innerHTML = '<div class="muted">Loading...</div>';
  try {
    const q = firebase.firestore().collection('users').where('isApproved', '==', false).orderBy('createdAt');
    const snap = await q.get();
    if (snap.empty) {
      pendingList.innerHTML = '<div class="muted">No pending users.</div>';
      return;
    }
    pendingList.innerHTML = '';
    snap.docs.forEach(d => {
      const data = d.data();
      const uid = d.id;
      const div = document.createElement('div');
      div.className = 'card';
      div.style.marginBottom = '8px';
      div.innerHTML = `
        <div><strong>${escapeHtml(data.username)}</strong> — ${escapeHtml(data.email)}</div>
        <div class="muted">Created: ${new Date(data.createdAt).toLocaleString()}</div>
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button data-uid="${uid}" class="approve-btn">Approve</button>
          <button data-uid="${uid}" class="deny-btn">Deny</button>
        </div>
      `;
      pendingList.appendChild(div);
    });
    pendingList.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', () => adminApprove(btn.dataset.uid, true));
    });
    pendingList.querySelectorAll('.deny-btn').forEach(btn => {
      btn.addEventListener('click', () => adminApprove(btn.dataset.uid, false));
    });
  } catch (err) {
    console.error('loadPendingUsers error', err);
    pendingList.innerHTML = '<div class="muted">Failed loading users.</div>';
  }
}

// Admin approve: call Cloud Function
async function adminApprove(uid, allow){
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) throw new Error('Not signed in');
    const token = await currentUser.getIdToken();
    const res = await fetch(`${FUNCTION_BASE_URL}/admin/approve`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetUid: uid, approve: allow })
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || JSON.stringify(j));
    alert('Done: ' + j.message);
    loadPendingUsers();
  } catch (err) {
    console.error('Admin action error', err);
    alert('Admin action error: ' + (err && err.message ? err.message : String(err)));
  }
}

// Send RCON command via Cloud Function
btnSend.addEventListener('click', async () => {
  const cmd = (cmdInput.value || '').trim();
  if (!cmd) return alert('Enter a command.');
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) throw new Error('Not signed in');
    const token = await currentUser.getIdToken();
    const res = await fetch(`${FUNCTION_BASE_URL}/exec`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ command: cmd })
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || JSON.stringify(j));
    outputEl.value = (j.output || j.result || '') + "\n\n" + outputEl.value;
  } catch (err) {
    console.error('Error sending command', err);
    alert('Error sending command: ' + (err && err.message ? err.message : String(err)));
  }
});

btnClear.addEventListener('click', () => { outputEl.value = ''; });

// Small helper to prevent XSS when showing usernames/emails
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"'`=\/]/g, function(s) {
    return {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
    }[s];
  });
}
