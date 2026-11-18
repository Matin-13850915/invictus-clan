
import {
  auth,
  db,
  ref,
  get,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updateProfile,
  update,
  deleteUser
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


function approvedEmailKey(email) {
  return encodeURIComponent(email.trim().toLowerCase())
    .replace(/\./g, "%2E");
}

export async function createApprovedAccount(email, password) {
  if (!validateEmail(email)) {
    throw new Error("ایمیل معتبر وارد کنید.");
  }

  if (typeof password !== "string" || password.length < 8) {
    throw new Error("رمز عبور باید حداقل ۸ کاراکتر باشد.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const credential = await createUserWithEmailAndPassword(
    auth,
    normalizedEmail,
    password
  );

  const user = credential.user;

  try {
    const key = approvedEmailKey(normalizedEmail);
    const snapshot = await get(ref(db, `approvedApplications/${key}`));

    if (!snapshot.exists()) {
      throw new Error("برای این ایمیل درخواست عضویت تأییدشده‌ای پیدا نشد.");
    }

    const approved = snapshot.val();

    if (
      String(approved.email || "").toLowerCase() !== normalizedEmail ||
      approved.status !== "accepted" ||
      approved.claimedUid
    ) {
      throw new Error("درخواست شما تأیید نشده یا قبلاً برای آن حساب ساخته شده است.");
    }

    const now = Date.now();
    const displayName = String(
      approved.realName || approved.gameName || normalizedEmail.split("@")[0]
    ).trim().slice(0, 50);

    const updates = {
      [`approvedApplications/${key}/claimedUid`]: user.uid,
      [`approvedApplications/${key}/claimedAt`]: now,
      [`roles/${user.uid}`]: {
        role: "member",
        active: true,
        status: "active",
        specialty: null,
        applicationId: approved.applicationId,
        applicationKey: key,
        createdAt: now,
        updatedAt: now
      },
      [`users/${user.uid}`]: {
        uid: user.uid,
        applicationKey: key,
        email: normalizedEmail,
        displayName,
        gameName: String(approved.gameName || "").slice(0, 40),
        gameLevel: Number(approved.gameLevel) || null,
        telegram: String(approved.telegram || "").slice(0, 80),
        rubika: String(approved.rubika || "").slice(0, 80),
        bio: "",
        createdAt: now,
        updatedAt: now
      },
      [`publicProfiles/${user.uid}`]: {
        uid: user.uid,
        applicationKey: key,
        displayName,
        gameName: String(approved.gameName || "").slice(0, 40),
        gameLevel: Number(approved.gameLevel) || null,
        bio: "",
        joinedAt: now,
        createdAt: now,
        updatedAt: now
      }
    };

    await update(ref(db), updates);

    try {
      await updateProfile(user, { displayName });
    } catch (profileError) {
      console.warn("Firebase Auth display name update failed:", profileError);
    }

    return user;
  } catch (error) {
    try {
      if (user && auth.currentUser?.uid === user.uid) {
        await deleteUser(user);
      }
    } catch (cleanupError) {
      console.error("Account activation cleanup failed:", cleanupError);
    } finally {
      if (auth.currentUser?.uid === user?.uid) {
        await signOut(auth);
      }
    }
    throw error;
  }
}
