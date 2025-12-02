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

const onlineUsersList = document.getElementById("online-users");
const logoutBtn = document.getElementById("logout-btn");
const enterCanvasBtn = document.getElementById("enter-canvas-btn");

let currentUser = null;
let presenceDocRef = null;

function updateOnlineUsers(users) {
  onlineUsersList.innerHTML = "";
  users.forEach((user) => {
    const li = document.createElement("li");
    li.textContent = user.email;
    onlineUsersList.appendChild(li);
  });
}

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
  presenceDocRef = db.collection("presence").doc(user.uid);
  await presenceDocRef.set({
    email: user.email,
    lastActive: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Update presence timestamp every 30 seconds
  setInterval(() => {
    presenceDocRef.set({
      email: user.email,
      lastActive: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }, 30000);

  window.addEventListener("beforeunload", async () => {
    try {
      await presenceDocRef.delete();
    } catch {}
  });

  db.collection("presence").onSnapshot((snapshot) => {
    const now = Date.now();
    const onlineUsers = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (
        data.lastActive &&
        data.lastActive.toMillis() > now - 60000
      ) {
        onlineUsers.push(data);
      }
    });
    updateOnlineUsers(onlineUsers);
  });
});

logoutBtn.addEventListener("click", async () => {
  if (presenceDocRef) {
    try {
      await presenceDocRef.delete();
    } catch {}
  }
  await auth.signOut();
  window.location.href = "index.html";
});

enterCanvasBtn.addEventListener("click", () => {
  window.location.href = "canvas.html";
});
