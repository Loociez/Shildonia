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

const displayUsername = document.getElementById("display-username");
const logoutBtn = document.getElementById("logout-btn");

const usernameInput = document.getElementById("username-input");
const setUsernameBtn = document.getElementById("set-username-btn");

const createSessionBtn = document.getElementById("create-session-btn");

const sessionsList = document.getElementById("sessions-list");
const galleryList = document.getElementById("gallery-list");

const statusMsg = document.getElementById("status-msg");

let currentUser = null;
let currentUsername = "Guest";

function setStatusMessage(msg, isError = false) {
  statusMsg.textContent = msg;
  statusMsg.style.color = isError ? "#f44336" : "#4caf50";
  setTimeout(() => {
    statusMsg.textContent = "";
  }, 4000);
}

// Update displayed username in UI
function updateDisplayedUsername(name) {
  displayUsername.textContent = name || "Guest";
  usernameInput.value = name || "";
}

// Save username (to Firebase Auth profile)
async function saveUsername(name) {
  if (!currentUser) return;

  try {
    await currentUser.updateProfile({
      displayName: name,
    });
    currentUsername = name;
    updateDisplayedUsername(name);
    setStatusMessage("Username saved.");
  } catch (err) {
    setStatusMessage("Failed to save username.", true);
    console.error(err);
  }
}

// Create new art session
async function createSession() {
  if (!currentUser) {
    alert("Please log in first.");
    return;
  }

  try {
    const newSession = await db.collection("sessions").add({
      creatorUid: currentUser.uid,
      creatorName: currentUsername || "Guest",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      published: null,
    });

    // Redirect to canvas with new session ID
    window.location.href = `canvas.html?session=${newSession.id}`;
  } catch (err) {
    setStatusMessage("Failed to create session.", true);
    console.error(err);
  }
}

// List active sessions (not published yet)
function loadActiveSessions() {
  db.collection("sessions")
    .where("published", "==", null)
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      sessionsList.innerHTML = "";

      if (snapshot.empty) {
        sessionsList.textContent = "No active art sessions currently.";
        return;
      }

      snapshot.forEach((doc) => {
        const data = doc.data();
        const item = document.createElement("div");
        item.className = "session-item";

        const creatorName = data.creatorName || "Guest";
        const createdAt = data.createdAt
          ? new Date(data.createdAt.toDate()).toLocaleString()
          : "Unknown date";

        item.innerHTML = `
          <span><strong>${creatorName}</strong> - Created on: ${createdAt}</span>
          <button>Join</button>
        `;

        const joinBtn = item.querySelector("button");
        joinBtn.addEventListener("click", () => {
          window.location.href = `canvas.html?session=${doc.id}`;
        });

        sessionsList.appendChild(item);
      });
    });
}

// Load published pixel art gallery
function loadGallery() {
  db.collection("sessions")
    .where("published", "!=", null)
    .orderBy("publishedAt", "desc")
    .onSnapshot((snapshot) => {
      galleryList.innerHTML = "";

      if (snapshot.empty) {
        galleryList.textContent = "No published pixel art yet.";
        return;
      }

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.published) return;

        const item = document.createElement("div");
        item.className = "gallery-item";

        const creator = data.publishedBy || "Unknown";
        const dateStr = data.publishedAt
          ? new Date(data.publishedAt.toDate()).toLocaleString()
          : "Unknown date";

        item.innerHTML = `
          <span><strong>By: ${creator}</strong> | ${dateStr}</span>
          <button>View Art</button>
        `;

        const viewBtn = item.querySelector("button");
        viewBtn.addEventListener("click", () => {
          window.open(`view.html?session=${doc.id}`, "_blank");
        });

        galleryList.appendChild(item);
      });
    });
}

// Set initial UI state and event listeners
auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html"; // Redirect to login if not logged in
    return;
  }
  currentUser = user;
  currentUsername = user.displayName || "Guest";

  updateDisplayedUsername(currentUsername);

  loadActiveSessions();
  loadGallery();
});

logoutBtn.addEventListener("click", () => {
  auth.signOut();
});

setUsernameBtn.addEventListener("click", () => {
  const newName = usernameInput.value.trim();
  if (!newName) {
    alert("Username cannot be empty.");
    return;
  }
  saveUsername(newName);
});

createSessionBtn.addEventListener("click", createSession);
