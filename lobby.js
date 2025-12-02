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
const sessionListDiv = document.getElementById("session-list");

let currentUser = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  loadSessions();
});

async function loadSessions() {
  sessionListDiv.innerHTML = "Loading sessions...";
  const snapshot = await db.collection("sessions").orderBy("createdAt", "desc").get();
  sessionListDiv.innerHTML = "";

  if (snapshot.empty) {
    sessionListDiv.innerHTML = "<p>No active sessions.</p>";
  } else {
    snapshot.forEach((doc) => {
      const data = doc.data();
      const sessionId = doc.id;
      const creator = data.creatorUsername || "Unknown";

      const btn = document.createElement("button");
      btn.textContent = `Join Session by ${creator}`;
      btn.addEventListener("click", () => {
        window.location.href = `canvas.html?session=${sessionId}`;
      });
      sessionListDiv.appendChild(btn);
    });
  }
}

createSessionBtn.addEventListener("click", async () => {
  if (!currentUser) return alert("Not logged in");

  const newSessionRef = db.collection("sessions").doc();

  await newSessionRef.set({
    creatorUid: currentUser.uid,
    creatorUsername: currentUser.email || "Guest",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    published: null,
  });

  window.location.href = `canvas.html?session=${newSessionRef.id}`;
});
