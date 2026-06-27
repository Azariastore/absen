// firebase.js
// Konfigurasi & inisialisasi Firebase terpusat untuk Absen Shalat.
// Semua halaman (index, daftar, laporan-guru, admin) import dari sini
// supaya config tidak terduplikasi di 4 tempat berbeda.
//
// PENTING: file ini pakai ES module, jadi HARUS dibuka lewat server
// (localhost / Netlify), tidak bisa dobel-klik file:// langsung.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField,
  collection, getDocs, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCRICm5o4hHug4E_CmzY_iW35yiiLohz2Q",
  authDomain: "kas-tkja.firebaseapp.com",
  projectId: "kas-tkja",
  storageBucket: "kas-tkja.firebasestorage.app",
  messagingSenderId: "1050709855814",
  appId: "1:1050709855814:web:7332b2972ce337172c8447"
};

const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);
const auth  = getAuth(fbApp);

// Re-export semuanya supaya tiap halaman cukup 1 baris import dari sini,
// tidak perlu lagi import langsung dari CDN gstatic di tiap file.
export {
  fbApp, db, auth,
  // firestore
  doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField,
  collection, getDocs, query, where, serverTimestamp,
  // auth
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  reauthenticateWithCredential, EmailAuthProvider
};
