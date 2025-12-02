// lobby.js

const firebaseConfig = {
  apiKey: "AIzaSyDXRSt2pmgqChOGJr4gr9e2Z_tZaGxBpoo",
  authDomain: "shildonia-38aab.firebaseapp.com",
  projectId: "shildonia-38aab",
  storageBucket: "shildonia-38aab.firebasestorage.app",
  messagingSenderId: "963502122644",
  appId: "1:963502122644:web:adbd0976dab04f25f07681",
  measurementId: "G-MQJ2D3SPTS",
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

const usernameInput = document.getElementById("username-input");
const saveUsernameBtn = document.getElementById("save-username-btn");
const sessionList = document.getElementById("session-list");
const startSessionBtn = document.getElementById("start-session-btn");
const userEmailDiv = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");

let currentUser = null;
let currentUsername = null;

// Helper to generate guest username if none saved
function generateGuestName() {
  const randNum = Math.floor(100 + Math.random() * 900);
  return `Guest${randNum}`;
}

// Save username in Firestore under user profile
async function saveUsername(name) {
  if (!currentUser) return;
  const uid = currentUser.uid;
  await db.collection("users").doc(uid).set(
    {
      username: name,
    },
    { merge: true }
  );
  currentUsername = name;
  usernameInput.value = name;
  renderSessionList(lastSessions);
}

// Load username from Firestore
async function loadUsername() {
  if (!currentUser) return null;
  const userDoc = await db.collection("users").doc(currentUser.uid).get();
  if (userDoc.exists) {
    const data = userDoc.data();
    if (data.username) {
      return data.username;
    }
  }
  return null;
}

saveUsernameBtn.addEventListener("click", () => {
  let name = usernameInput.value.trim();
  if (!name) {
    alert("Username cannot be empty");
    return;
  }
  if (name.length > 20) {
    alert("Username max length is 20");
    return;
  }
  saveUsername(name);
});

// Show sessions in the list
let lastSessions = [];

function renderSessionList(sessions) {
  sessionList.innerHTML = "";
  if (sessions.length === 0) {
    sessionList.textContent = "No active sessions.";
    return;
  }
  sessions.forEach((doc) => {
    const data = doc.data();
    const id = doc.id;
    const ownerUid = data.ownerUid || "";
    const ownerName = data.ownerName || "Unknown";

    const div = document.createElement("div");
    div.className = "session-item";

    const info = document.createElement("div");
    info.className = "session-info";
    info.textContent = `Session: ${id} | Created by: ${ownerName}`;

    const joinBtn = document.createElement("button");
    joinBtn.textContent = "Join";
    joinBtn.className = "join-btn";
    joinBtn.addEventListener("click", () => {
      window.location.href = `canvas.html?session=${id}`;
    });

    div.appendChild(info);
    div.appendChild(joinBtn);
    sessionList.appendChild(div);
  });
}

// Listen for active sessions in Firestore
function listenSessions() {
  db.collection("sessions")
    .orderBy("createdAt", "desc")
    .limit(20)
    .onSnapshot(async (snapshot) => {
      lastSessions = snapshot.docs;

      // For each session, get owner's username from users collection
      const ownerUids = [...new Set(lastSessions.map((doc) => doc.data().ownerUid))].filter(Boolean);

      // Fetch usernames in batch
      const usersSnapshot = await db
        .collection("users")
        .where(firebase.firestore.FieldPath.documentId(), "in", ownerUids)
        .get();

      const userMap = {};
      usersSnapshot.forEach((userDoc) => {
        userMap[userDoc.id] = userDoc.data().username || "Guest";
      });

      // Attach ownerName to session docs
      lastSessions.forEach((doc) => {
        const data = doc.data();
        data.ownerName = userMap[data.ownerUid] || "Guest";
      });

      renderSessionList(lastSessions);
    });
}

startSessionBtn.addEventListener("click", async () => {
  if (!currentUser) return alert("User not logged in");
  const sessionDoc = await db.collection("sessions").add({
    ownerUid: currentUser.uid,
    ownerName: currentUsername || generateGuestName(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Redirect to canvas with session ID
  window.location.href = `canvas.html?session=${sessionDoc.id}`;
});

logoutBtn.addEventListener("click", () => {
  auth.signOut();
});

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
    userEmailDiv.textContent = user.email || "";

    // Load username or assign Guest
    let username = await loadUsername();
    if (!username) {
      username = generateGuestName();
      await saveUsername(username);
    } else {
      currentUsername = username;
      usernameInput.value = username;
    }

    listenSessions();
  }
});
