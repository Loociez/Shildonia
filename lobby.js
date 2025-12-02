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
const usernameMessage = document.getElementById("username-message");
const createSessionBtn = document.getElementById("create-session-btn");
const sessionsUl = document.getElementById("sessions-ul");

let currentUser = null;
let currentUsername = localStorage.getItem("pixelArtUsername") || "";

usernameInput.value = currentUsername;

// Save username on button click
saveUsernameBtn.addEventListener("click", () => {
  const newUsername = usernameInput.value.trim();
  if (newUsername.length === 0) {
    alert("Please enter a valid username.");
    return;
  }
  localStorage.setItem("pixelArtUsername", newUsername);
  currentUsername = newUsername;
  usernameMessage.style.display = "block";
  setTimeout(() => {
    usernameMessage.style.display = "none";
  }, 2000);
});

// Auth anonymous sign-in to track user in Firebase
auth.signInAnonymously().catch(console.error);

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    loadSessions();
  } else {
    currentUser = null;
  }
});

function loadSessions() {
  db.collection("sessions")
    .orderBy("createdAt", "desc")
    .limit(10)
    .onSnapshot((snapshot) => {
      sessionsUl.innerHTML = "";
      snapshot.forEach((doc) => {
        const session = doc.data();
        const li = document.createElement("li");
        li.textContent = `${session.name || "Untitled"} (${session.creatorUsername || "Guest"})`;
        li.style.cursor = "pointer";
        li.addEventListener("click", () => {
          joinSession(doc.id);
        });
        sessionsUl.appendChild(li);
      });
    });
}

createSessionBtn.addEventListener("click", async () => {
  if (!currentUsername || currentUsername.trim().length === 0) {
    alert("Please enter and save a username before creating a session.");
    return;
  }

  const newSessionRef = db.collection("sessions").doc();
  await newSessionRef.set({
    name: `Artwork by ${currentUsername}`,
    creatorUid: currentUser.uid,
    creatorUsername: currentUsername,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Redirect to canvas with session id and username
  window.location.href = `canvas.html?session=${newSessionRef.id}&username=${encodeURIComponent(currentUsername)}`;
});

function joinSession(sessionId) {
  if (!currentUsername || currentUsername.trim().length === 0) {
    alert("Please enter and save a username before joining a session.");
    return;
  }

  window.location.href = `canvas.html?session=${sessionId}&username=${encodeURIComponent(currentUsername)}`;
}
