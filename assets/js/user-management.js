
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord
} from "./database.js";

import { createId } from "./utils.js";

const USERS_PATH = "users";
const ROLES_PATH = "roles";
const HISTORY_PATH = "userManagementHistory";

const VALID_ROLES = ["admin", "leader", "tester", "member"];
const TESTER_SPECIALTIES = ["MP", "BR"];

function requireAdmin(actor) {
  if (!actor?.uid || actor.role !== "admin") {
    throw new Error("فقط ادمین اجازه مدیریت حساب‌ها را دارد.");
  }
}

function validateUid(uid) {
  if (
    typeof uid !== "string" ||
    uid.length < 10 ||
    uid.length > 128
  ) {
    throw new Error("شناسه کاربر معتبر نیست.");
  }
}

function validateRole(role) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error("نقش انتخاب‌شده معتبر نیست.");
  }
}

async function writeHistory(actor, action, targetUid, details = {}) {
  await createRecord(HISTORY_PATH, {
    id: createId(),
    action,
    targetUid,
    actorUid: actor.uid,
    details,
    createdAt: Date.now()
  });
}

// دریافت اطلاعات حساب
export async function getManagedUser(uid, actor) {
  requireAdmin(actor);
  validateUid(uid);

  const [user, role] = await Promise.all([
    getRecord(`${USERS_PATH}/${uid}`),
    getRecord(`${ROLES_PATH}/${uid}`)
  ]);

  if (!user && !role) {
    return null;
  }

  return {
    uid,
    ...(user || {}),
    ...(role || {})
  };
}

// دریافت فهرست حساب‌ها
export async function getAllManagedUsers(actor) {
  requireAdmin(actor);

  const [users, roles] = await Promise.all([
    getAllRecords(USERS_PATH),
    getAllRecords(ROLES_PATH)
  ]);

  const userMap = new Map();

  for (const user of users) {
    if (user.uid) {
      userMap.set(user.uid, user);
    }
  }

  for (const role of roles) {
    if (!role.uid) continue;

    userMap.set(role.uid, {
      ...(userMap.get(role.uid) || {}),
      ...role,
      uid: role.uid
    });
  }

  return [...userMap.values()];
}

// ساخت پروفایل مدیریتی برای حساب موجود
export async function createManagedUserProfile(
  uid,
  data,
  actor
) {
  requireAdmin(actor);
  validateUid(uid);

  if (!data || typeof data !== "object") {
    throw new Error("اطلاعات حساب معتبر نیست.");
  }

  const existing = await getManagedUser(uid, actor);

  if (existing) {
    throw new Error("برای این حساب قبلاً اطلاعات ثبت شده است.");
  }

  validateRole(data.role);

  if (data.role === "admin") {
    throw new Error("ایجاد ادمین دوم از این بخش مجاز نیست.");
  }

  if (
    data.role === "tester" &&
    !TESTER_SPECIALTIES.includes(data.specialty)
  ) {
    throw new Error("تستر باید تخصص MP یا BR داشته باشد.");
  }

  const now = Date.now();

  const user = {
    uid,
    displayName: String(data.displayName || "").trim(),
    gameName: String(data.gameName || "").trim(),
    createdAt: now,
    createdBy: actor.uid
  };

  const role = {
    uid,
    role: data.role,
    active: true,
    specialty: data.role === "tester" ? data.specialty : null,
    updatedAt: now,
    updatedBy: actor.uid
  };

  await updateRecord(`${USERS_PATH}/${uid}`, user);
  await updateRecord(`${ROLES_PATH}/${uid}`, role);

  await writeHistory(actor, "create_profile", uid, {
    role: data.role
  });

  return { ...user, ...role };
}

// تغییر نقش حساب
export async function changeUserRole(
  uid,
  newRole,
  specialty,
  actor
) {
  requireAdmin(actor);
  validateUid(uid);
  validateRole(newRole);

  if (uid === actor.uid) {
    throw new Error("ادمین نمی‌تواند نقش حساب خودش را تغییر دهد.");
  }

  if (newRole === "admin") {
    throw new Error("این سیستم فقط یک ادمین اصلی دارد.");
  }

  if (
    newRole === "tester" &&
    !TESTER_SPECIALTIES.includes(specialty)
  ) {
    throw new Error("تخصص تستر باید MP یا BR باشد.");
  }

  const current = await getRecord(`${ROLES_PATH}/${uid}`);

  if (!current) {
    throw new Error("نقش این حساب ثبت نشده است.");
  }

  const previousRole = current.role;

  await updateRecord(`${ROLES_PATH}/${uid}`, {
    role: newRole,
    specialty: newRole === "tester" ? specialty : null,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });

  await writeHistory(actor, "change_role", uid, {
    previousRole,
    newRole,
    specialty: newRole === "tester" ? specialty : null
  });

  return true;
}

// فعال یا غیرفعال کردن حساب
export async function setUserActiveStatus(
  uid,
  active,
  reason,
  actor
) {
  requireAdmin(actor);
  validateUid(uid);

  if (uid === actor.uid) {
    throw new Error("ادمین نمی‌تواند حساب خودش را تعلیق کند.");
  }

  if (typeof active !== "boolean") {
    throw new Error("وضعیت حساب معتبر نیست.");
  }

  const current = await getRecord(`${ROLES_PATH}/${uid}`);

  if (!current) {
    throw new Error("حساب موردنظر پیدا نشد.");
  }

  const cleanReason = String(reason || "").trim();

  if (!active && !cleanReason) {
    throw new Error("برای تعلیق حساب باید دلیل ثبت شود.");
  }

  await updateRecord(`${ROLES_PATH}/${uid}`, {
    active,
    statusReason: active ? "" : cleanReason,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });

  await writeHistory(
    actor,
    active ? "activate_user" : "suspend_user",
    uid,
    { reason: cleanReason }
  );

  return true;
}

// ویرایش اطلاعات عمومی حساب
export async function updateManagedUser(
  uid,
  changes,
  actor
) {
  requireAdmin(actor);
  validateUid(uid);

  if (!changes || typeof changes !== "object") {
    throw new Error("اطلاعات ویرایش معتبر نیست.");
  }

  const current = await getRecord(`${USERS_PATH}/${uid}`);

  if (!current) {
    throw new Error("پروفایل کاربر پیدا نشد.");
  }

  const updates = {};

  for (const field of ["displayName", "gameName"]) {
    if (changes[field] !== undefined) {
      if (typeof changes[field] !== "string") {
        throw new Error(`مقدار ${field} معتبر نیست.`);
      }

      const value = changes[field].trim();

      if (value.length > 60) {
        throw new Error("طول نام نمی‌تواند بیشتر از ۶۰ کاراکتر باشد.");
      }

      updates[field] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("تغییری برای ذخیره وجود ندارد.");
  }

  updates.updatedAt = Date.now();
  updates.updatedBy = actor.uid;

  await updateRecord(`${USERS_PATH}/${uid}`, updates);

  await writeHistory(actor, "edit_user", uid, {
    changedFields: Object.keys(updates)
  });

  return true;
}

// تاریخچه مدیریت حساب‌ها
export async function getUserManagementHistory(actor) {
  requireAdmin(actor);

  const history = await getAllRecords(HISTORY_PATH);

  return history.sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
        }
