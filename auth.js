// auth.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";

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

const formTitle = document.getElementById("form-title");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submit-btn");
const toggleAuth = document.getElementById("toggle-auth");
const errorMsg = document.getElementById("error-msg");

let isLogin = true;

toggleAuth.addEventListener("click", () => {
  isLogin = !isLogin;
  if (isLogin) {
    formTitle.textContent = "Login";
    submitBtn.textContent = "Login";
    toggleAuth.textContent = "Don't have an account? Register";
  } else {
    formTitle.textContent = "Register";
    submitBtn.textContent = "Register";
    toggleAuth.textContent = "Already have an account? Login";
  }
  errorMsg.textContent = "";
});

submitBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    errorMsg.textContent = "Please enter email and password.";
    return;
  }

  try {
    if (isLogin) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
    // On success, redirect to lobby
    window.location.href = "lobby.html";
  } catch (err) {
    errorMsg.textContent = err.message;
  }
});

// Redirect to lobby if already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "lobby.html";
  }
});
