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

const logoutBtn = document.getElementById("logout-btn");
const createSessionBtn = document.getElementById("create-session-btn");
const sessionsContainer = document.getElementById("sessions-container");

let currentUser = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  listenForSessions();
});

logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

// Listen for active art sessions and update UI
function listenForSessions() {
  db.collection("sessions")
    .where("active", "==", true)
    .onSnapshot((snapshot) => {
      const sessions = [];
      snapshot.forEach((doc) => {
        sessions.push({ id: doc.id, ...doc.data() });
      });
      renderSessions(sessions);
    });
}

function renderSessions(sessions) {
  if (sessions.length === 0) {
    sessionsContainer.innerHTML = "<p>No active art sessions. Start one!</p>";
    return;
  }
  sessionsContainer.innerHTML = "";
  sessions.forEach((session) => {
    const div = document.createElement("div");
    div.className = "session";

    const nameDiv = document.createElement("div");
    nameDiv.textContent = session.name || "Untitled Art Session";

    const infoDiv = document.createElement("div");
    infoDiv.textContent = `Created by: ${session.creatorEmail || "Unknown"}`;

    const joinBtn = document.createElement("button");
    joinBtn.textContent = "Join";
    joinBtn.onclick = () => {
      window.location.href = `canvas.html?session=${session.id}`;
    };

    div.appendChild(nameDiv);
    div.appendChild(infoDiv);
    div.appendChild(joinBtn);

    sessionsContainer.appendChild(div);
  });
}

// Create a new art session document with metadata
createSessionBtn.addEventListener("click", async () => {
  const sessionName = prompt("Enter a name for your art session:", "Untitled Art Session");
  if (!sessionName) return;

  const newSessionRef = db.collection("sessions").doc();
  await newSessionRef.set({
    name: sessionName,
    creatorUid: currentUser.uid,
    creatorEmail: currentUser.email,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    active: true,
    createdAtDate: new Date().toISOString()
  });

  // Redirect user to the new session canvas
  window.location.href = `canvas.html?session=${newSessionRef.id}`;
});
