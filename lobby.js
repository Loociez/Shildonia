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

const createSessionBtn = document.getElementById("create-session-btn");
const sessionList = document.getElementById("session-list");
const galleryList = document.getElementById("gallery-list");

const usernameInput = document.getElementById("username-input");
const usernameSaveBtn = document.getElementById("username-save-btn");

let currentUser = null;
let currentUsername = "Guest";

// Load sessions to join
function loadSessions() {
  db.collection("sessions")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      sessionList.innerHTML = "";

      if (snapshot.empty) {
        sessionList.textContent = "No active sessions.";
        return;
      }

      snapshot.forEach((doc) => {
        const data = doc.data();

        const item = document.createElement("div");
        item.className = "session-item";

        const creatorName = data.creatorName || "Guest";

        item.innerHTML = `
          <span>Created by: ${creatorName}</span>
          <button>Join</button>
        `;

        const joinBtn = item.querySelector("button");
        joinBtn.addEventListener("click", () => {
          window.location.href = `canvas.html?session=${doc.id}`;
        });

        sessionList.appendChild(item);
      });
    });
}

// Load published pixel art gallery
function loadGallery() {
  db.collection("sessions")
    .where("publishedAt", ">", new Date(0))
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

createSessionBtn.addEventListener("click", async () => {
  if (!currentUser) return alert("Please log in.");

  const newSessionRef = db.collection("sessions").doc();
  await newSessionRef.set({
    creatorUid: currentUser.uid,
    creatorName: currentUsername,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    published: null,
    publishedAt: null,
    publishedBy: null,
  });

  window.location.href = `canvas.html?session=${newSessionRef.id}`;
});

usernameSaveBtn.addEventListener("click", async () => {
  const newName = usernameInput.value.trim();
  if (!newName) return alert("Please enter a valid username.");

  if (!currentUser) return alert("Not logged in.");

  try {
    await currentUser.updateProfile({ displayName: newName });
    currentUsername = newName;
    alert("Username updated!");
  } catch (err) {
    alert("Failed to update username: " + err.message);
  }
});

// Auth state change listener
auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
    currentUsername = user.displayName || "Guest";
    usernameInput.value = currentUsername;

    loadSessions();
    loadGallery();
  }
});
