
import {
  auth,
  db,
  ref,
  get,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "./firebase.js";

const ADMIN_UID = "kxaAoKgm5WUxqsV9hoAk75XQuL43";

export async function login(email, password) {
  if (!email || !password) {
    throw new Error("ایمیل و رمز عبور را وارد کنید.");
  }

  const result = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );

  return result.user;
}

export async function logout() {
  await signOut(auth);
}

export async function resetPassword(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ایمیل معتبر وارد کنید.");
  }

  await sendPasswordResetEmail(auth, email.trim());

  return true;
}

export async function getCurrentUser() {
  return auth.currentUser;
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getUserRole(uid) {
  if (!uid) {
    throw new Error("شناسه کاربر معتبر نیست.");
  }

  const snapshot = await get(ref(db, `roles/${uid}`));

  if (!snapshot.exists()) {
    return null;
  }

  const roleData = snapshot.val();

  if (roleData.active !== true) {
    return null;
  }

  const allowedRoles = ["admin", "leader", "tester", "member"];

  if (!allowedRoles.includes(roleData.role)) {
    return null;
  }

  if (uid === ADMIN_UID && roleData.role !== "admin") {
    return null;
  }

  if (uid !== ADMIN_UID && roleData.role === "admin") {
    return null;
  }

  return roleData.role;
}

export async function verifyCurrentSession() {
  const user = auth.currentUser;

  if (!user) {
    return null;
  }

  const role = await getUserRole(user.uid);

  if (!role) {
    await logout();
    return null;
  }

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || "",
    role
  };
}
