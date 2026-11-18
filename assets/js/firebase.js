
import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updatePassword,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  sendEmailVerification
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
  orderByKey,
  orderByValue,
  equalTo,
  startAt,
  endAt,
  limitToFirst,
  limitToLast,
  onValue,
  off,
  runTransaction,
  child,
  serverTimestamp,
  increment,
  onDisconnect
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

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getDatabase(app);

let persistenceReady = false;

try {
  await setPersistence(auth, browserLocalPersistence);
  persistenceReady = true;
} catch (error) {
  console.error("Firebase persistence error:", error);
}

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
  child,

  orderByChild,
  orderByKey,
  orderByValue,
  equalTo,
  startAt,
  endAt,
  limitToFirst,
  limitToLast,

  onValue,
  off,
  runTransaction,
  serverTimestamp,
  increment,
  onDisconnect,

  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updatePassword,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  sendEmailVerification,

  persistenceReady
};
