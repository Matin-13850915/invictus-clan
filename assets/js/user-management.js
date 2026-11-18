
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord
} from "./database.js";

import { getAdminUid } from "./auth.js";
import { normalizeText } from "./utils.js";

const USERS_PATH = "users";
const ROLES_PATH = "roles";
const HISTORY_PATH = "userManagementHistory";

const VALID_ROLES = ["admin", "leader", "tester", "member"];
const TESTER_SPECIALTIES = ["MP", "BR"];

function requireAdmin(actor) {
  if (
    !actor?.uid ||
    actor.role !== "admin" ||
    actor.active !== true ||
    actor.uid !== getAdminUid()
  ) {
    throw new Error("فقط ادمین اصلی اجازه مدیریت حساب‌ها را دارد.");
  }
}

function validateUid(uid) {
  if (
    typeof uid !== "string" ||
    !/^[A-Za-z0-9_-]{10,128}$/.test(uid)
  ) {
    throw new Error("شناسه کاربر معتبر نیست.");
  }

  return uid;
}

function validateRole(role) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error("نقش انتخاب‌شده معتبر نیست.");
  }
}

function validateDisplayName(value, label) {
  const clean = normalizeText(value || "");

  if (clean.length > 60) {
    throw new Error(`${label} نمی‌تواند بیشتر از ۶۰ کاراکتر باشد.`);
  }

  return clean;
}

function validateSpecialty(role, specialty) {
  if (
    role === "tester" &&
    !TESTER_SPECIALTIES.includes(specialty)
  ) {
    throw new Error("تستر باید تخصص MP یا BR داشته باشد.");
  }

  return role === "tester" ? specialty : null;
}

async function writeHistory(actor, action, targetUid, details = {}) {
  return createRecord(HISTORY_PATH, {
    action,
    targetUid,
    actorUid: actor.uid,
    details,
    createdAt: Date.now()
  });
}

async function getRole(uid) {
  return getRecord(`${ROLES_PATH}/${uid}`);
}

// دریافت اطلاعات یک حساب
export async function getManagedUser(uid, actor) {
  requireAdmin(actor);
  validateUid(uid);

  const [user, role] = await Promise.all([
    getRecord(`${USERS_PATH}/${uid}`),
    getRole(uid)
  ]);

  if (!user && !role) return null;

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
    const uid = user.uid || user.id;

    if (!uid) continue;

    userMap.set(uid, {
      ...user,
      uid
    });
  }

  for (const role of roles) {
    const uid = role.uid || role.id;

    if (!uid) continue;

    userMap.set(uid, {
      ...(userMap.get(uid) || {}),
      ...role,
      uid
    });
  }

  return [...userMap.values()].sort((a, b) =>
    String(a.displayName || "").localeCompare(
      String(b.displayName || ""),
      "fa"
    )
  );
}

// ساخت پروفایل مدیریتی برای حساب احراز هویت‌شده موجود
export async function createManagedUserProfile(uid, data, actor) {
  requireAdmin(actor);
  validateUid(uid);

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
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

  const specialty = validateSpecialty(
    data.role,
    data.specialty
  );

  const displayName = validateDisplayName(
    data.displayName,
    "نام نمایشی"
  );

  const gameName = validateDisplayName(
    data.gameName,
    "نام بازی"
  );

  if (!displayName || !gameName) {
    throw new Error("نام نمایشی و نام بازی الزامی هستند.");
  }

  const now = Date.now();

  const user = {
    uid,
    displayName,
    gameName,
    createdAt: now,
    createdBy: actor.uid
  };

  const role = {
    uid,
    role: data.role,
    active: true,
    status: "active",
    specialty,
    updatedAt: now,
    updatedBy: actor.uid
  };

  await Promise.all([
    updateRecord(`${USERS_PATH}/${uid}`, user),
    updateRecord(`${ROLES_PATH}/${uid}`, role),
    updateRecord(`publicProfiles/${uid}`, {
      uid,
      displayName,
      gameName,
      joinedAt: now,
      createdAt: now,
      updatedAt: now
    })
  ]);

  await writeHistory(actor, "create_profile", uid, {
    role: data.role,
    specialty
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

  if (uid === getAdminUid() || newRole === "admin") {
    throw new Error("نقش ادمین اصلی قابل تغییر نیست.");
  }

  const cleanSpecialty = validateSpecialty(
    newRole,
    specialty
  );

  const current = await getRole(uid);

  if (!current) {
    throw new Error("نقش این حساب ثبت نشده است.");
  }

  const previousRole = current.role;

  if (previousRole === "admin") {
    throw new Error("تغییر نقش ادمین اصلی مجاز نیست.");
  }

  await updateRecord(`${ROLES_PATH}/${uid}`, {
    role: newRole,
    specialty: cleanSpecialty,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });

  await writeHistory(actor, "change_role", uid, {
    previousRole,
    newRole,
    specialty: cleanSpecialty
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

  if (uid === actor.uid || uid === getAdminUid()) {
    throw new Error("تغییر وضعیت ادمین اصلی مجاز نیست.");
  }

  if (typeof active !== "boolean") {
    throw new Error("وضعیت حساب معتبر نیست.");
  }

  const current = await getRole(uid);

  if (!current) {
    throw new Error("حساب موردنظر پیدا نشد.");
  }

  if (current.role === "admin") {
    throw new Error("تغییر وضعیت ادمین اصلی مجاز نیست.");
  }

  const cleanReason = normalizeText(reason || "");

  if (cleanReason.length > 500) {
    throw new Error("دلیل تغییر وضعیت حداکثر ۵۰۰ حرف است.");
  }

  if (!active && !cleanReason) {
    throw new Error("برای تعلیق حساب باید دلیل ثبت شود.");
  }

  await updateRecord(`${ROLES_PATH}/${uid}`, {
    active,
    status: active ? "active" : "suspended",
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

  if (
    !changes ||
    typeof changes !== "object" ||
    Array.isArray(changes)
  ) {
    throw new Error("اطلاعات ویرایش معتبر نیست.");
  }

  const allowedFields = ["displayName", "gameName"];
  const unknownFields = Object.keys(changes).filter(
    key => !allowedFields.includes(key)
  );

  if (unknownFields.length) {
    throw new Error("فقط نام نمایشی و نام بازی قابل ویرایش هستند.");
  }

  const current = await getRecord(`${USERS_PATH}/${uid}`);

  if (!current) {
    throw new Error("پروفایل کاربر پیدا نشد.");
  }

  const updates = {};
  const changedFields = [];

  for (const field of allowedFields) {
    if (changes[field] === undefined) continue;

    const value = validateDisplayName(
      changes[field],
      field === "displayName" ? "نام نمایشی" : "نام بازی"
    );

    updates[field] = value;
    changedFields.push(field);
  }

  if (!changedFields.length) {
    throw new Error("تغییری برای ذخیره وجود ندارد.");
  }

  updates.updatedAt = Date.now();
  updates.updatedBy = actor.uid;

  await Promise.all([
    updateRecord(`${USERS_PATH}/${uid}`, updates),
    updateRecord(`publicProfiles/${uid}`, {
      ...Object.fromEntries(
        Object.entries(updates).filter(([key]) =>
          ["displayName", "gameName", "updatedAt"].includes(key)
        )
      )
    })
  ]);

  await writeHistory(actor, "edit_user", uid, {
    changedFields
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
  
