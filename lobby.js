document.addEventListener("DOMContentLoaded", () => {
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
  const usernameSaveBtn = document.getElementById("username-save-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const newSessionNameInput = document.getElementById("new-session-name");
  const createSessionBtn = document.getElementById("create-session-btn");
  const sessionsList = document.getElementById("sessions-list");
  const galleryList = document.getElementById("gallery-list");

  let currentUser = null;
  let currentUsername = null;

  // Load saved username from localStorage if any
  function loadUsername() {
    const stored = localStorage.getItem("username");
    if (stored) {
      usernameInput.value = stored;
      currentUsername = stored;
    }
  }

  // Save username both locally and to Firebase user profile
  async function saveUsername() {
    const name = usernameInput.value.trim();
    if (!name) {
      alert("Username cannot be empty");
      return;
    }
    try {
      if (currentUser) {
        await currentUser.updateProfile({ displayName: name });
      }
      localStorage.setItem("username", name);
      currentUsername = name;
      alert("Username saved!");
    } catch (err) {
      console.error("Failed to save username:", err);
      alert("Failed to save username.");
    }
  }

  usernameSaveBtn.addEventListener("click", saveUsername);

  logoutBtn.addEventListener("click", () => {
    auth.signOut();
  });

  createSessionBtn.addEventListener("click", async () => {
    const sessionName = newSessionNameInput.value.trim();
    if (!sessionName) {
      alert("Please enter a session name.");
      return;
    }
    try {
      const newSessionRef = await db.collection("sessions").add({
        name: sessionName,
        creatorUid: currentUser.uid,
        creatorName: currentUsername || "Guest",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        published: null,
      });
      newSessionNameInput.value = "";
      alert(`Session "${sessionName}" created!`);
      loadSessions(); // refresh session list
    } catch (err) {
      console.error("Error creating session:", err);
      alert("Failed to create session.");
    }
  });

  async function loadSessions() {
    if (!sessionsList) return;
    sessionsList.innerHTML = "";
    try {
      const snapshot = await db.collection("sessions").orderBy("createdAt", "desc").limit(10).get();
      snapshot.forEach((doc) => {
        const data = doc.data();
        const btn = document.createElement("button");
        btn.textContent = data.name || "Unnamed Session";
        btn.title = `Created by: ${data.creatorName || "Guest"}`;
        btn.addEventListener("click", () => {
          window.location.href = `canvas.html?session=${doc.id}`;
        });
        sessionsList.appendChild(btn);
      });
      if (snapshot.empty) {
        sessionsList.textContent = "No sessions available.";
      }
    } catch (err) {
      console.error("Error loading sessions:", err);
      sessionsList.textContent = "Failed to load sessions.";
    }
  }

  async function loadPublishedGallery() {
    if (!galleryList) return;
    galleryList.innerHTML = "";
    try {
      const snapshot = await db.collection("sessions")
        .where("published", "!=", null)
        .orderBy("publishedAt", "desc")
        .limit(20)
        .get();

      if (snapshot.empty) {
        galleryList.textContent = "No published artworks yet.";
        return;
      }

      snapshot.forEach((doc) => {
        const data = doc.data();
        const published = data.published;
        if (!published) return; // skip if no published data

        // Create gallery item container
        const itemDiv = document.createElement("div");
        itemDiv.classList.add("gallery-item");

        // Create small canvas to render published pixel art
        const miniCanvas = document.createElement("canvas");
        miniCanvas.classList.add("gallery-canvas");
        const ctx = miniCanvas.getContext("2d");

        // Assuming published object keys like "x_y": {color: "#hex", ...}
        const PIXEL_SIZE = 2; // small pixel size for gallery preview
        const gridPoints = Object.keys(published).map(key => key.split("_").map(Number));
        const xs = gridPoints.map(p => p[0]);
        const ys = gridPoints.map(p => p[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const width = maxX - minX + 1;
        const height = maxY - minY + 1;

        miniCanvas.width = width * PIXEL_SIZE;
        miniCanvas.height = height * PIXEL_SIZE;

        // Clear canvas
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);

        // Draw pixels
        for (const key in published) {
          const pixel = published[key];
          if (pixel && pixel.color) {
            const [x, y] = key.split("_").map(Number);
            ctx.fillStyle = pixel.color;
            ctx.fillRect((x - minX) * PIXEL_SIZE, (y - minY) * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
          }
        }

        // Username label
        const usernameDiv = document.createElement("div");
        usernameDiv.classList.add("gallery-username");
        usernameDiv.textContent = data.creatorName || "Guest";

        itemDiv.appendChild(miniCanvas);
        itemDiv.appendChild(usernameDiv);

        // Clicking loads the published art in view-only mode
        itemDiv.addEventListener("click", () => {
          // Open canvas.html with session id + readonly param
          window.location.href = `canvas.html?session=${doc.id}&readonly=1`;
        });

        galleryList.appendChild(itemDiv);
      });
    } catch (err) {
      console.error("Error loading published gallery:", err);
      galleryList.textContent = "Failed to load published artworks.";
    }
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    currentUser = user;
    currentUsername = user.displayName || localStorage.getItem("username") || "Guest";
    usernameInput.value = currentUsername;

    loadSessions();
    loadPublishedGallery();
  });

  loadUsername();
});
