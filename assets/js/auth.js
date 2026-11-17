
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

const ALLOWED_ROLES = Object.freeze([
  "admin",
  "leader",
  "tester",
  "member"
]);

function validateEmail(email) {
  return (
    typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}

async function readRoleData(uid) {
  if (typeof uid !== "string" || !uid.trim()) {
    throw new Error("شناسه کاربر معتبر نیست.");
  }

  const snapshot = await get(ref(db, `roles/${uid}`));

  if (!snapshot.exists()) return null;

  const data = snapshot.val();

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  if (data.active !== true) return null;

  if (
    data.status === "banned" ||
    data.status === "suspended"
  ) {
    return null;
  }

  if (!ALLOWED_ROLES.includes(data.role)) {
    return null;
  }

  if (uid === ADMIN_UID && data.role !== "admin") {
    return null;
  }

  if (uid !== ADMIN_UID && data.role === "admin") {
    return null;
  }

  return data;
}

export async function login(email, password) {
  if (!validateEmail(email)) {
    throw new Error("ایمیل معتبر وارد کنید.");
  }

  if (typeof password !== "string" || !password) {
    throw new Error("رمز عبور را وارد کنید.");
  }

  const result = await signInWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password
  );

  try {
    const roleData = await readRoleData(result.user.uid);

    if (!roleData) {
      throw new Error(
        "حساب شما فعال نیست یا دسترسی معتبر ندارد."
      );
    }

    return result.user;
  } catch (error) {
    if (auth.currentUser?.uid === result.user.uid) {
      await signOut(auth);
    }

    throw error;
  }
}

export async function logout() {
  await signOut(auth);
  return true;
}

export async function resetPassword(email) {
  if (!validateEmail(email)) {
    throw new Error("ایمیل معتبر وارد کنید.");
  }

  await sendPasswordResetEmail(
    auth,
    email.trim().toLowerCase()
  );

  return true;
}

export async function getCurrentUser() {
  return auth.currentUser;
}

export function observeAuth(callback) {
  if (typeof callback !== "function") {
    throw new Error("تابع بررسی وضعیت ورود معتبر نیست.");
  }

  return onAuthStateChanged(auth, callback);
}

export async function getUserRole(uid) {
  const roleData = await readRoleData(uid);
  return roleData?.role || null;
}

export async function verifyCurrentSession() {
  const user = auth.currentUser;

  if (!user) return null;

  const roleData = await readRoleData(user.uid);

  if (!roleData) {
    await logout();
    return null;
  }

  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    role: roleData.role,
    specialty: roleData.specialty || null,
    active: roleData.active === true,
    status: roleData.status || "active"
  };
}

export function getAdminUid() {
  return ADMIN_UID;
  }
