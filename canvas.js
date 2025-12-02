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

const chatMessages = document.getElementById("chat-messages");
const chatText = document.getElementById("chat-text");
const chatSendBtn = document.getElementById("chat-send-btn");

const importAreaContainer = document.getElementById("export-import");
const importTextarea = document.getElementById("import-textarea");
const importConfirmBtn = document.getElementById("import-confirm-btn");

const PIXEL_SIZE = 10;
const GRID_SIZE = 64;
const CANVAS_SIZE = PIXEL_SIZE * GRID_SIZE;

canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

let pixelData = {};
let undoStack = [];
let redoStack = [];
let isEraserActive = false;
let currentUser = null;
let zoomLevel = 1;

const sessionDocRef = db.collection("sessions").doc(sessionId);
const pixelsDocRef = sessionDocRef.collection("pixels").doc("data");
const chatCollectionRef = sessionDocRef.collection("chat");

function drawGrid() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Apply zoom scale
  ctx.save();
  ctx.scale(zoomLevel, zoomLevel);

  // Draw colored pixels
  for (const key in pixelData) {
    const { color, owner } = pixelData[key];
    const [x, y] = key.split("_").map(Number);
    ctx.fillStyle = color || "#000000";
    ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);

    // Optional: draw pixel owner indicator (small corner dot)
    if (owner && owner !== currentUser.uid) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(x * PIXEL_SIZE + PIXEL_SIZE - 3, y * PIXEL_SIZE, 3, 3);
    }
  }

  // Draw grid lines
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID_SIZE; i++) {
    // vertical lines
    ctx.beginPath();
    ctx.moveTo(i * PIXEL_SIZE, 0);
    ctx.lineTo(i * PIXEL_SIZE, CANVAS_SIZE);
    ctx.stroke();

    // horizontal lines
    ctx.beginPath();
    ctx.moveTo(0, i * PIXEL_SIZE);
    ctx.lineTo(CANVAS_SIZE, i * PIXEL_SIZE);
    ctx.stroke();
  }

  ctx.restore();
}

function getMousePos(evt) {
  const rect = canvas.getBoundingClientRect();
  // Adjust for zoom level
  const x = Math.floor((evt.clientX - rect.left) / (PIXEL_SIZE * zoomLevel));
  const y = Math.floor((evt.clientY - rect.top) / (PIXEL_SIZE * zoomLevel));
  return { x, y };
}

function updatePixel(x, y, color) {
  const pixelId = `${x}_${y}`;
  const newPixel = {
    color: color || null,
    owner: currentUser.uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  };
  pixelData[pixelId] = newPixel;

  return pixelsDocRef.set(pixelData);
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

function listenCanvasUpdates() {
  pixelsDocRef.onSnapshot((docSnap) => {
    if (docSnap.exists) {
      pixelData = docSnap.data();
      drawGrid();
    }
  });
}

// Undo/Redo helpers
function pushUndo(state) {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 50) undoStack.shift(); // limit undo size
}

function undo() {
  if (undoStack.length === 0) return;
  const lastState = undoStack.pop();
  if (!lastState) return;
  redoStack.push(JSON.stringify(pixelData));
  pixelData = JSON.parse(lastState);
  pixelsDocRef.set(pixelData);
  drawGrid();
}

function redo() {
  if (redoStack.length === 0) return;
  const nextState = redoStack.pop();
  if (!nextState) return;
  pushUndo(pixelData);
  pixelData = JSON.parse(nextState);
  pixelsDocRef.set(pixelData);
  drawGrid();
}

canvas.addEventListener("click", (evt) => {
  const { x, y } = getMousePos(evt);
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;

  const brushSize = Math.min(Math.max(parseInt(brushSizeInput.value, 10), 1), 10);

  pushUndo(pixelData);

  for (let dx = 0; dx < brushSize; dx++) {
    for (let dy = 0; dy < brushSize; dy++) {
      const px = x + dx;
      const py = y + dy;
      if (px >= GRID_SIZE || py >= GRID_SIZE) continue;
      const color = isEraserActive ? null : colorPicker.value;
      const pixelId = `${px}_${py}`;
      pixelData[pixelId] = {
        color: color,
        owner: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      };
    }
  }

  pixelsDocRef.set(pixelData);
  drawGrid();
  redoStack.length = 0; // Clear redo stack on new change
});

// Tools handlers
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
  importAreaContainer.style.display = importAreaContainer.style.display === "none" ? "block" : "none";
});

importConfirmBtn.addEventListener("click", () => {
  try {
    const importData = JSON.parse(importTextarea.value);
    if (typeof importData !== "object") throw new Error("Invalid JSON format.");
    pixelData = importData;
    pixelsDocRef.set(pixelData);
    drawGrid();
    importTextarea.value = "";
    importAreaContainer.style.display = "none";
    undoStack.length = 0;
    redoStack.length = 0;
    alert("Canvas imported successfully.");
  } catch (err) {
    alert("Failed to import canvas JSON: " + err.message);
  }
});

logoutBtn.addEventListener("click", () => {
  auth.signOut().then(() => {
    window.location.href = "index.html";
  });
});

// Chat system
function addChatMessage(msg) {
  const div = document.createElement("div");
  const time = msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString() : "";
  div.textContent = `[${time}] ${msg.senderEmail}: ${msg.text}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatSendBtn.addEventListener("click", async () => {
  const text = chatText.value.trim();
  if (!text) return;
  chatText.value = "";

  await chatCollectionRef.add({
    senderUid: currentUser.uid,
    senderEmail: currentUser.email,
    text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });
});

chatText.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    chatSendBtn.click();
  }
});

function listenChat() {
  chatCollectionRef
    .orderBy("timestamp")
    .limit(100)
    .onSnapshot((snapshot) => {
      chatMessages.innerHTML = "";
      snapshot.forEach((doc) => {
        addChatMessage(doc.data());
      });
    });
}

// Zoom controls
const zoomInBtn = document.getElementById("zoom-in-btn");
const zoomOutBtn = document.getElementById("zoom-out-btn");
const resetZoomBtn = document.getElementById("reset-zoom-btn");

zoomInBtn.addEventListener("click", () => {
  zoomLevel = Math.min(zoomLevel + 0.1, 3);
  drawGrid();
});
zoomOutBtn.addEventListener("click", () => {
  zoomLevel = Math.max(zoomLevel - 0.1, 0.5);
  drawGrid();
});
resetZoomBtn.addEventListener("click", () => {
  zoomLevel = 1;
  drawGrid();
});

// Initialization
auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
    loadCanvas();
    listenCanvasUpdates();
    listenChat();
  }
});
