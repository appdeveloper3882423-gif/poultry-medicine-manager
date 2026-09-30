// ============================================================
// POULTRY MEDICINE MANAGER
// Firebase Configuration
// Version 1.0.3
// ============================================================

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import { getAuth } from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import { getFirestore } from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyCkyj91iDkxfyF3qErGucMykxB6h0trplM",
  authDomain: "poultry-medicine-manager-93b79.firebaseapp.com",
  projectId: "poultry-medicine-manager-93b79",
  storageBucket: "poultry-medicine-manager-93b79.firebasestorage.app",
  messagingSenderId: "623127969077",
  appId: "1:623127969077:web:e7e4a8a2e25fc4e249607c"
};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


export {
  app,
  auth,
  db
};
