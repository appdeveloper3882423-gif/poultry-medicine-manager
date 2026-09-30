// ============================================================
// POULTRY MEDICINE MANAGER
// Firebase Configuration
// Version 1.0.1
// ============================================================

import { initializeApp } from "firebase/app";

import {
  getAuth
} from "firebase/auth";

import {
  getFirestore
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCkyj91iDkxfyFq3ErGucMykxB6h0trplM",
  authDomain: "poultry-medicine-manager-93b79.firebaseapp.com",
  projectId: "poultry-medicine-manager-93b79",
  storageBucket: "poultry-medicine-manager-93b79.firebasestorage.app",
  messagingSenderId: "623127969077",
  appId: "1:623127969077:web:e7e4b8a2e25fc4e249607c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Authentication
const auth = getAuth(app);

// Firestore Database
const db = getFirestore(app);

// Export
export {
  app,
  auth,
  db
};
