// canvas.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  collection,
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

const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");
const colorPicker = document.getElementById("color-picker");
const logoutBtn = document.getElementById("logout-btn");

const PIXEL_SIZE = 10;
const GRID_SIZE = 32; // 32x32 pixels
const CANVAS_SIZE = PIXEL_SIZE * GRID_SIZE;

canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

let pixelData = {}; // will store pixels as {"x_y": "#rrggbb"}

function drawGrid() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Draw pixels
  for (const key in pixelData) {
    const color = pixelData[key];
    const [x, y] = key.split("_").map(Number);
    ctx.fillStyle = color;
    ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
  }

  // Draw grid lines
  ctx.strokeStyle = "#444";
  for (let i = 0; i <= GRID_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * PIXEL_SIZE, 0);
    ctx.lineTo(i * PIXEL_SIZE, CANVAS_SIZE);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * PIXEL_SIZE);
    ctx.lineTo(CANVAS_SIZE, i * PIXEL_SIZE);
    ctx.stroke();
  }
}

function getMousePos(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((evt.clientX - rect.left) / PIXEL_SIZE);
  const y = Math.floor((evt.clientY - rect.top) / PIXEL_SIZE);
  return { x, y };
}

async function updatePixel(x, y, color) {
  const pixelId = `${x}_${y}`;
  const canvasDoc = doc(db, "canvas", "pixels");

  // Update Firestore document atomically
  await updateDoc(canvasDoc, {
    [pixelId]: color,
  });
}

async function loadCanvas() {
  const canvasDoc = doc(db, "canvas", "pixels");
  const snap = await getDoc(canvasDoc);

  if (snap.exists()) {
    pixelData = snap.data();
  } else {
    // Init empty canvas (optional)
    pixelData = {};
    await setDoc(canvasDoc, pixelData);
  }
  drawGrid();
}

// Listen to real-time updates on canvas pixels
function listenCanvasUpdates() {
  const canvasDoc = doc(db, "canvas", "pixels");
  onSnapshot(canvasDoc, (docSnap) => {
    if (docSnap.exists()) {
      pixelData = docSnap.data();
      drawGrid();
    }
  });
}

canvas.addEventListener("click", async (evt) => {
  const { x, y } = getMousePos(evt);
  const color = colorPicker.value;

  // Update local data and Firestore
  pixelData[`${x}_${y}`] = color;
  drawGrid();

  try {
    await updatePixel(x, y, color);
  } catch (err) {
    console.error("Error updating pixel:", err);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

// Only allow access if logged in
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    loadCanvas();
    listenCanvasUpdates();
  }
});
