// canvas.js

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

const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get("session");

if (!sessionId) {
  alert("No session ID provided.");
  window.location.href = "lobby.html";
}

const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

const colorPicker = document.getElementById("color-picker");
const brushSizeInput = document.getElementById("brush-size");
const eraserBtn = document.getElementById("eraser-btn");
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");

const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const logoutBtn = document.getElementById("logout-btn");
const publishBtn = document.getElementById("publish-btn");

const chatMessages = document.getElementById("chat-messages");
const chatText = document.getElementById("chat-text");
const chatSendBtn = document.getElementById("chat-send-btn");

const importAreaContainer = document.getElementById("export-import");
const importTextarea = document.getElementById("import-textarea");
const importConfirmBtn = document.getElementById("import-confirm-btn");

const PIXEL_SIZE = 10;
const GRID_WIDTH = 192;  // 3x wider
const GRID_HEIGHT = 128; // 2x taller
const CANVAS_WIDTH = PIXEL_SIZE * GRID_WIDTH;
const CANVAS_HEIGHT = PIXEL_SIZE * GRID_HEIGHT;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let pixelData = {};
let isEraserActive = false;
let currentUser = null;
let currentUsername = "Guest";
let zoomLevel = 1;

const sessionDocRef = db.collection("sessions").doc(sessionId);
const pixelsDocRef = sessionDocRef.collection("pixels").doc("data");
const chatCollectionRef = sessionDocRef.collection("chat");

let userUndoStack = [];
let userRedoStack = [];

let sessionCreatorUid = null;

function drawGrid() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.save();
  ctx.scale(zoomLevel, zoomLevel);

  for (const key in pixelData) {
    const { color, owner } = pixelData[key];
    const [x, y] = key.split("_").map(Number);
    ctx.fillStyle = color || "#000000";
    ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);

    if (owner && owner !== currentUser.uid) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(x * PIXEL_SIZE + PIXEL_SIZE - 3, y * PIXEL_SIZE, 3, 3);
    }
  }

  ctx.strokeStyle = "#444";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID_WIDTH; i++) {
    ctx.beginPath();
    ctx.moveTo(i * PIXEL_SIZE, 0);
    ctx.lineTo(i * PIXEL_SIZE, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let i = 0; i <= GRID_HEIGHT; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * PIXEL_SIZE);
    ctx.lineTo(CANVAS_WIDTH, i * PIXEL_SIZE);
    ctx.stroke();
  }

  ctx.restore();
}

function getMousePos(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((evt.clientX - rect.left) / (PIXEL_SIZE * zoomLevel));
  const y = Math.floor((evt.clientY - rect.top) / (PIXEL_SIZE * zoomLevel));
  return { x, y };
}

canvas.addEventListener("click", (evt) => {
  if (!currentUser) return;

  const { x, y } = getMousePos(evt);
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return;

  const brushSize = Math.min(Math.max(parseInt(brushSizeInput.value, 10), 1), 10);

  let changes = [];

  for (let dx = 0; dx < brushSize; dx++) {
    for (let dy = 0; dy < brushSize; dy++) {
      const px = x + dx;
      const py = y + dy;
      if (px >= GRID_WIDTH || py >= GRID_HEIGHT) continue;

      const pixelId = `${px}_${py}`;
      const oldPixel = pixelData[pixelId] || { color: null, owner: null };
      const oldColor = oldPixel.color;

      const newColor = isEraserActive ? null : colorPicker.value;

      if (oldColor !== newColor) {
        changes.push({
          pixelId,
          oldColor,
          newColor,
        });

        pixelData[pixelId] = {
          color: newColor,
          owner: currentUser.uid,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        };
      }
    }
  }

  if (changes.length > 0) {
    userUndoStack.push(changes);
    userRedoStack.length = 0;
    pixelsDocRef.set(pixelData);
    drawGrid();
  }
});

function undo() {
  if (userUndoStack.length === 0) return;
  const changes = userUndoStack.pop();
  if (!changes) return;

  changes.forEach(({ pixelId, oldColor }) => {
    if (oldColor === null) {
      delete pixelData[pixelId];
    } else {
      pixelData[pixelId].color = oldColor;
      if (oldColor === null) {
        delete pixelData[pixelId].owner;
      } else {
        pixelData[pixelId].owner = currentUser.uid;
      }
    }
  });

  userRedoStack.push(changes);
  pixelsDocRef.set(pixelData);
  drawGrid();
}

function redo() {
  if (userRedoStack.length === 0) return;
  const changes = userRedoStack.pop();
  if (!changes) return;

  changes.forEach(({ pixelId, newColor }) => {
    if (newColor === null) {
      delete pixelData[pixelId];
    } else {
      pixelData[pixelId] = {
        color: newColor,
        owner: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      };
    }
  });

  userUndoStack.push(changes);
  pixelsDocRef.set(pixelData);
  drawGrid();
}

eraserBtn.addEventListener("click", () => {
  isEraserActive = !isEraserActive;
  eraserBtn.style.background = isEraserActive ? "#d32f2f" : "";
});

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

exportBtn.addEventListener("click", () => {
  const exportData = JSON.stringify(pixelData, null, 2);
  const blob = new Blob([exportData], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `pixel-art-session-${sessionId}.json`;
  a.click();

  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => {
  importAreaContainer.style.display = "block";
});

importConfirmBtn.addEventListener("click", () => {
  try {
    const importedData = JSON.parse(importTextarea.value);
    pixelData = importedData;
    pixelsDocRef.set(pixelData);
    importAreaContainer.style.display = "none";
    importTextarea.value = "";
    userUndoStack = [];
    userRedoStack = [];
  } catch (err) {
    alert("Invalid JSON");
  }
});

chatSendBtn.addEventListener("click", async () => {
  const text = chatText.value.trim();
  if (!text) return;

  await chatCollectionRef.add({
    uid: currentUser.uid,
    username: currentUsername || "Guest",
    text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });

  chatText.value = "";
});

publishBtn.addEventListener("click", async () => {
  if (currentUser.uid !== sessionCreatorUid) {
    alert("Only the creator can publish this artwork.");
    return;
  }
  try {
    await sessionDocRef.update({
      published: pixelData,
      publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      publishedBy: currentUser.uid,
    });
    alert("Pixel art published!");
  } catch (err) {
    console.error("Publish failed:", err);
    alert("Failed to publish pixel art.");
  }
});

function listenCanvasUpdates() {
  pixelsDocRef.onSnapshot((docSnap) => {
    if (docSnap.exists) {
      pixelData = docSnap.data();
      drawGrid();
    }
  });
}

function listenChat() {
  chatCollectionRef.orderBy("timestamp", "asc").onSnapshot((snapshot) => {
    chatMessages.innerHTML = "";
    snapshot.forEach((doc) => {
      const msg = doc.data();
      const div = document.createElement("div");
      const timeStr = msg.timestamp
        ? new Date(msg.timestamp.toDate()).toLocaleTimeString()
        : "";

      div.textContent = `[${timeStr}] ${msg.username || "Guest"}: ${msg.text}`;
      chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

logoutBtn.addEventListener("click", () => {
  auth.signOut();
});

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    alert("Not logged in");
    window.location.href = "index.html";
  } else {
    currentUser = user;
    const userDoc = await db.collection("users").doc(user.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      currentUsername = data.username || "Guest";
    }
    await loadSession();
    await loadCanvas();
    listenCanvasUpdates();
    listenChat();
  }
});

async function loadSession() {
  const sessionDoc = await sessionDocRef.get();
  if (sessionDoc.exists) {
    const sessionData = sessionDoc.data();
    sessionCreatorUid = sessionData.creatorUid || null;

    if (currentUser.uid === sessionCreatorUid) {
      publishBtn.style.display = "inline-block";
    } else {
      publishBtn.style.display = "none";
    }
  }
}

async function loadCanvas() {
  const docSnap = await pixelsDocRef.get();
  if (docSnap.exists) {
    pixelData = docSnap.data() || {};
  } else {
    pixelData = {};
    await pixelsDocRef.set(pixelData);
  }
  drawGrid();
}
