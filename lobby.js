// lobby.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDXRSt2pmgqChOGJr4gr9e2Z_tZaGxBpoo",
  authDomain: "shildonia-38aab.firebaseapp.com",
  projectId: "shildonia-38aab",
  storageBucket: "shildonia-38aab.firebasestorage.app",
  messagingSenderId: "963502122644",
  appId: "1:963502122644:web:adbd0976dab04f25f07681",
  measurementId: "G-MQJ2D3SPTS",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
  // Add user presence doc with lastActive timestamp
  presenceDocRef = doc(db, "presence", user.uid);
  await setDoc(presenceDocRef, {
    email: user.email,
    lastActive: serverTimestamp(),
  });

  // Update presence timestamp every 30 seconds
  const presenceInterval = setInterval(() => {
    setDoc(presenceDocRef, {
      email: user.email,
      lastActive: serverTimestamp(),
    });
  }, 30000);

  // Remove presence on disconnect
  window.addEventListener("beforeunload", async () => {
    await deleteDoc(presenceDocRef);
  });

  // Listen to presence updates (users active within last 1 minute)
  const presenceCol = collection(db, "presence");
  onSnapshot(presenceCol, (snapshot) => {
    const now = Date.now();
    const onlineUsers = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.lastActive && data.lastActive.seconds * 1000 > now - 60000) {
        onlineUsers.push(data);
      }
    });
    updateOnlineUsers(onlineUsers);
  });
});

logoutBtn.addEventListener("click", async () => {
  if (presenceDocRef) {
    await deleteDoc(presenceDocRef);
  }
  await signOut(auth);
  window.location.href = "index.html";
});

enterCanvasBtn.addEventListener("click", () => {
  window.location.href = "canvas.html";
});
