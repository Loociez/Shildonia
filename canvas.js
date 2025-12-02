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

const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");
const colorPicker = document.getElementById("color-picker");
const logoutBtn = document.getElementById("logout-btn");

const PIXEL_SIZE = 10;
const GRID_SIZE = 32;
const CANVAS_SIZE = PIXEL_SIZE * GRID_SIZE;

canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

let pixelData = {};

function drawGrid() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  for (const key in pixelData) {
    const color = pixelData[key];
    const [x, y] = key.split("_").map(Number);
    ctx.fillStyle = color;
    ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
  }

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

function updatePixel(x, y, color) {
  const pixelId = `${x}_${y}`;
  const canvasDoc = db.collection("canvas").doc("pixels");

  return canvasDoc.update({
    [pixelId]: color,
  }).catch(async (err) => {
    if (err.code === 'not-found') {
      await canvasDoc.set({
        [pixelId]: color,
      });
    } else {
      console.error(err);
    }
  });
}

async function loadCanvas() {
  const canvasDoc = await db.collection("canvas").doc("pixels").get();
  if (canvasDoc.exists) {
    pixelData = canvasDoc.data();
  } else {
    pixelData = {};
    await db.collection("canvas").doc("pixels").set(pixelData);
  }
  drawGrid();
}

function listenCanvasUpdates() {
  db.collection("canvas").doc("pixels").onSnapshot((docSnap) => {
    if (docSnap.exists) {
      pixelData = docSnap.data();
      drawGrid();
    }
  });
}

canvas.addEventListener("click", (evt) => {
  const { x, y } = getMousePos(evt);
  const color = colorPicker.value;
  pixelData[`${x}_${y}`] = color;
  drawGrid();
  updatePixel(x, y, color);
});

logoutBtn.addEventListener("click", () => {
  auth.signOut().then(() => {
    window.location.href = "index.html";
  });
});

auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    loadCanvas();
    listenCanvasUpdates();
  }
});
