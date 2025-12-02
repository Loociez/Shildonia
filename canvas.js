// canvas.js

// Firebase config & initialization (make sure firebase-app-compat.js and others are loaded in your HTML)
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
const db = firebase.firestore();
const auth = firebase.auth();

const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get("session");
const usernameFromURL = urlParams.get("username");

let currentUsername = usernameFromURL || `Guest${Math.floor(Math.random() * 1000)}`;
let currentUser = null;

// DOM elements
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-text");
const chatSendBtn = document.getElementById("chat-send-btn");

const colorPicker = document.getElementById("color-picker");
const brushSizeInput = document.getElementById("brush-size");
const eraserBtn = document.getElementById("eraser-btn");
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");

const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const logoutBtn = document.getElementById("logout-btn");
const publishBtn = document.getElementById("publish-btn");
const backToLobbyBtn = document.getElementById("back-to-lobby-btn");

const importTextarea = document.getElementById("import-textarea");
const importConfirmBtn = document.getElementById("import-confirm-btn");

// Canvas parameters
const PIXEL_SIZE = 10;
const CANVAS_WIDTH_PX = 1800;  // 1800px width
const CANVAS_HEIGHT_PX = 1200; // 1200px height

canvas.width = CANVAS_WIDTH_PX;
canvas.height = CANVAS_HEIGHT_PX;

let isDrawing = false;
let erasing = false;
let brushSize = parseInt(brushSizeInput.value, 10) || 1;
let currentColor = colorPicker.value;

let sessionDocRef = null;

// Data structures
// pixels: { "x_y": { color: "#xxxxxx", username: "Name" } }
let pixels = {};
// Undo/Redo stacks per user
let undoStack = [];
let redoStack = [];

// Keep track of session creator uid for publish button permission
let sessionCreatorUid = null;

// Helpers
function drawPixel(x, y, color) {
  ctx.fillStyle = color || "#222";
  ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
}

function clearCanvas() {
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGrid() {
  ctx.strokeStyle = "#333";
  for (let x = 0; x <= canvas.width; x += PIXEL_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += PIXEL_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function redrawCanvas() {
  clearCanvas();
  for (const key in pixels) {
    const [xStr, yStr] = key.split("_");
    const x = parseInt(xStr, 10);
    const y = parseInt(yStr, 10);
    const pixelData = pixels[key];
    if (pixelData && pixelData.color) {
      drawPixel(x, y, pixelData.color);
    }
  }
  drawGrid();
}

// Auth and session setup
auth.signInAnonymously().catch(console.error);

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    alert("Failed to authenticate");
    return;
  }
  currentUser = user;

  if (!sessionId) {
    alert("No session ID provided.");
    window.location.href = "lobby.html";
    return;
  }

  sessionDocRef = db.collection("sessions").doc(sessionId);

  // Check session creator uid for publish button control
  const sessionDoc = await sessionDocRef.get();
  if (sessionDoc.exists) {
    sessionCreatorUid = sessionDoc.data().creatorUid;
    if (currentUser.uid === sessionCreatorUid) {
      publishBtn.style.display = "inline-block";
    } else {
      publishBtn.style.display = "none";
    }
  } else {
    alert("Session does not exist.");
    window.location.href = "lobby.html";
    return;
  }

  listenCanvasUpdates();
  listenChat();
});

// Canvas interaction

canvas.addEventListener("mousedown", (e) => {
  isDrawing = true;
  handleDrawing(e);
});

canvas.addEventListener("mousemove", (e) => {
  if (isDrawing) {
    handleDrawing(e);
  }
});

canvas.addEventListener("mouseup", () => {
  isDrawing = false;
  // Clear redo stack on new drawing action
  redoStack = [];
});

canvas.addEventListener("mouseleave", () => {
  isDrawing = false;
});

function handleDrawing(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / PIXEL_SIZE);
  const y = Math.floor((event.clientY - rect.top) / PIXEL_SIZE);

  if (x < 0 || y < 0 || x >= canvas.width / PIXEL_SIZE || y >= canvas.height / PIXEL_SIZE) {
    return; // Outside canvas
  }

  const key = `${x}_${y}`;

  // Save current pixel state for undo
  const previousPixel = pixels[key] ? { ...pixels[key] } : null;

  // Determine new color
  const newColor = erasing ? null : currentColor;

  // If no change, do nothing
  if (previousPixel && previousPixel.color === newColor) {
    return;
  }

  // Update local pixels state
  if (newColor) {
    pixels[key] = { color: newColor, username: currentUsername };
  } else {
    delete pixels[key];
  }

  // Save undo action
  undoStack.push({
    key,
    oldPixel: previousPixel,
    newPixel: newColor ? { color: newColor, username: currentUsername } : null,
  });

  // Push update to Firestore
  sessionDocRef.collection("pixels").doc(key).set(
    newColor
      ? { color: newColor, username: currentUsername, timestamp: firebase.firestore.FieldValue.serverTimestamp() }
      : firebase.firestore.FieldValue.delete(),
    { merge: true }
  ).catch(console.error);

  redrawCanvas();
}

// Undo only your own pixels
undoBtn.addEventListener("click", () => {
  if (undoStack.length === 0) return;

  // Find last pixel changed by current user
  for (let i = undoStack.length - 1; i >= 0; i--) {
    const action = undoStack[i];
    if (action.newPixel && action.newPixel.username === currentUsername) {
      // Undo this action
      const key = action.key;
      const oldPixel = action.oldPixel;

      if (oldPixel) {
        pixels[key] = oldPixel;
        // Update Firestore
        sessionDocRef.collection("pixels").doc(key).set({
          color: oldPixel.color,
          username: oldPixel.username,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        delete pixels[key];
        // Update Firestore - delete pixel
        sessionDocRef.collection("pixels").doc(key).delete();
      }

      redoStack.push(action);
      undoStack.splice(i, 1);
      redrawCanvas();
      break;
    }
  }
});

// Redo your own pixels
redoBtn.addEventListener("click", () => {
  if (redoStack.length === 0) return;

  // Find next redo action for current user
  for (let i = redoStack.length - 1; i >= 0; i--) {
    const action = redoStack[i];
    if (action.newPixel && action.newPixel.username === currentUsername) {
      const key = action.key;
      const newPixel = action.newPixel;

      pixels[key] = newPixel;
      sessionDocRef.collection("pixels").doc(key).set({
        color: newPixel.color,
        username: newPixel.username,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      undoStack.push(action);
      redoStack.splice(i, 1);
      redrawCanvas();
      break;
    }
  }
});

// Tool controls

colorPicker.addEventListener("change", () => {
  currentColor = colorPicker.value;
  erasing = false;
});

brushSizeInput.addEventListener("change", () => {
  let size = parseInt(brushSizeInput.value, 10);
  if (isNaN(size) || size < 1) size = 1;
  if (size > 10) size = 10;
  brushSize = size;
  brushSizeInput.value = brushSize;
});

eraserBtn.addEventListener("click", () => {
  erasing = !erasing;
  eraserBtn.style.backgroundColor = erasing ? "#d32f2f" : "";
});

// Export/Import

exportBtn.addEventListener("click", () => {
  const exportData = {
    pixels,
  };
  const dataStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pixel-art-session-${sessionId}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => {
  importTextarea.style.display = importTextarea.style.display === "block" ? "none" : "block";
});

importConfirmBtn.addEventListener("click", () => {
  if (!importTextarea.value.trim()) {
    alert("Paste JSON data to import.");
    return;
  }
  try {
    const importData = JSON.parse(importTextarea.value);
    if (!importData.pixels) throw new Error("Invalid data");
    // Update local pixels & Firestore
    const batch = db.batch();
    Object.entries(importData.pixels).forEach(([key, pixel]) => {
      const pixelDocRef = sessionDocRef.collection("pixels").doc(key);
      batch.set(pixelDocRef, pixel);
    });
    // Optionally clear pixels that are not in importData here if needed
    batch.commit().then(() => {
      alert("Import successful!");
      importTextarea.value = "";
      importTextarea.style.display = "none";
    });
  } catch (err) {
    alert("Failed to import JSON: " + err.message);
  }
});

// Logout goes back to lobby and clears session info
logoutBtn.addEventListener("click", () => {
  window.location.href = "lobby.html";
});

// Publish button saves snapshot JSON to session doc
publishBtn.addEventListener("click", async () => {
  try {
    await sessionDocRef.update({
      publishedPixels: pixels,
      publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    alert("Artwork published!");
  } catch (err) {
    alert("Failed to publish artwork: " + err.message);
  }
});

// Back to lobby button
backToLobbyBtn.addEventListener("click", () => {
  window.location.href = "lobby.html";
});

// Listen for canvas pixels changes in Firestore
function listenCanvasUpdates() {
  sessionDocRef.collection("pixels").onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const key = change.doc.id;
      const data = change.doc.data();

      if (change.type === "removed") {
        delete pixels[key];
      } else {
        pixels[key] = {
          color: data.color,
          username: data.username,
        };
      }
    });
    redrawCanvas();
  });
}

// Chat logic

function listenChat() {
  sessionDocRef.collection("chat").orderBy("timestamp").onSnapshot((snapshot) => {
    chatMessages.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const username = data.username || "Guest";
      const msg = data.message;
      const time = data.timestamp ? data.timestamp.toDate().toLocaleTimeString() : "";

      const div = document.createElement("div");
      div.textContent = `[${time}] ${username}: ${msg}`;
      chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

chatSendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const message = chatInput.value.trim();
  if (message.length === 0) return;

  sessionDocRef.collection("chat").add({
    username: currentUsername,
    message,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });

  chatInput.value = "";
}

// Initial draw
clearCanvas();
drawGrid();
