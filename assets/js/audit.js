
import {
  createRecord,
  readData
} from "./database.js";

const PATH = "auditLogs";

function requireUser(actor) {
  if (!actor?.uid || typeof actor.uid !== "string") {
    throw new Error("برای این عملیات باید وارد حساب شوید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط ادمین و لیدر اجازه مشاهده گزارش‌ها را دارند.");
  }
}

function cleanText(value, max = 300) {
  return String(value ?? "")
    .trim()
    .replace(/[<>]/g, "")
    .slice(0, max);
}

function safeLimit(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 100;

  return Math.max(1, Math.min(Math.floor(number), 500));
}

export async function recordAudit({
  actorUid,
  actorRole,
  action,
  targetUid = null,
  details = {},
  reason = ""
}) {
  if (
    typeof actorUid !== "string" ||
    !actorUid.trim() ||
    !["admin", "leader", "tester", "member"].includes(actorRole)
  ) {
    throw new Error("مشخصات ثبت‌کننده معتبر نیست.");
  }

  const safeAction = cleanText(action, 80);

  if (!safeAction) {
    throw new Error("نوع رویداد مشخص نشده است.");
  }

  if (
    targetUid !== null &&
    (typeof targetUid !== "string" || !targetUid.trim())
  ) {
    throw new Error("شناسه کاربر هدف معتبر نیست.");
  }

  if (
    details === null ||
    typeof details !== "object" ||
    Array.isArray(details)
  ) {
    throw new Error("جزئیات رویداد معتبر نیست.");
  }

  const safeDetails = {};

  for (const [key, value] of Object.entries(details)) {
    const safeKey = cleanText(key, 50);

    if (!safeKey) continue;

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      safeDetails[safeKey] =
        typeof value === "string"
          ? cleanText(value, 300)
          : value;
    }
  }

  return createRecord(PATH, {
    actorUid: actorUid.trim(),
    actorRole,
    action: safeAction,
    targetUid: targetUid?.trim() || null,
    details: safeDetails,
    reason: cleanText(reason, 1000),
    createdAt: Date.now()
  });
}

export async function getAuditHistory(actor, limit = 100) {
  requireStaff(actor);

  const logs = await readData(PATH);

  if (!logs || typeof logs !== "object") {
    return [];
  }

  return Object.entries(logs)
    .filter(([, item]) => item && typeof item === "object")
    .map(([id, item]) => ({
      id,
      ...item
    }))
    .sort((a, b) =>
      (b.createdAt || 0) - (a.createdAt || 0)
    )
    .slice(0, safeLimit(limit));
}

export async function getUserAuditHistory(
  uid,
  actor,
  limit = 100
) {
  requireUser(actor);

  if (typeof uid !== "string" || !uid.trim()) {
    throw new Error("شناسه کاربر معتبر نیست.");
  }

  if (actor.role !== "admin" && actor.uid !== uid) {
    throw new Error("فقط می‌توانید تاریخچه خودتان را مشاهده کنید.");
  }

  const logs = await readData(PATH);

  if (!logs || typeof logs !== "object") {
    return [];
  }

  return Object.entries(logs)
    .filter(([, item]) =>
      item &&
      typeof item === "object" &&
      (
        item.actorUid === uid ||
        item.targetUid === uid
      )
    )
    .map(([id, item]) => ({
      id,
      ...item
    }))
    .sort((a, b) =>
      (b.createdAt || 0) - (a.createdAt || 0)
    )
    .slice(0, safeLimit(limit));
    }
