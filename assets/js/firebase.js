
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  set,
  update,
  push,
  remove,
  query,
  orderByChild,
  equalTo,
  onValue,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB4BgxZj4TYgMcz3hmRYBVMN8aaK3v_ywk",
  authDomain: "invictus-eec12.firebaseapp.com",
  databaseURL: "https://invictus-eec12-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "invictus-eec12",
  storageBucket: "invictus-eec12.firebasestorage.app",
  messagingSenderId: "77082463349",
  appId: "1:77082463349:web:c7c00e659351701693fc3c",
  measurementId: "G-LE9Y124DSY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

await setPersistence(auth, browserLocalPersistence);

export {
  app,
  auth,
  db,
  ref,
  get,
  set,
  update,
  push,
  remove,
  query,
  orderByChild,
  equalTo,
  onValue,
  runTransaction,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
};
