
import {
  createRecord,
  readData,
  updateData
} from "./database.js";

import { normalizeText } from "./utils.js";

const RESTRICTIONS_PATH = "restrictions";
const HISTORY_PATH = "moderationHistory";

const MAX_DURATION = 30 * 24 * 60 * 60 * 1000;
const MAX_REASON_LENGTH = 300;

function requireUser(actor) {
  if (
    !actor?.uid ||
    actor.active !== true
  ) {
    throw new Error("برای این عملیات باید عضو فعال باشید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت اعضا را دارند.");
  }
}

function validateUid(uid) {
  if (
    typeof uid !== "string" ||
    !uid.trim() ||
    uid.length > 128 ||
    /[.#$/\[\]]/.test(uid)
  ) {
    throw new Error("شناسه عضو معتبر نیست.");
  }
}

function validateReason(reason) {
  if (typeof reason !== "string") {
    throw new Error("دلیل اقدام معتبر نیست.");
  }

  const clean = normalizeText(reason).trim();

  if (
    clean.length < 3 ||
    clean.length > MAX_REASON_LENGTH
  ) {
    throw new Error("دلیل اقدام باید بین ۳ تا ۳۰۰ کاراکتر باشد.");
  }

  return clean;
}

function validateDuration(duration) {
  const value = Number(duration);

  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > MAX_DURATION
  ) {
    throw new Error("مدت محدودیت باید بین ۱ دقیقه تا ۳۰ روز باشد.");
  }

  return value;
}

function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

// ثبت اخطار
export async function issueWarning(
  targetUid,
  reason,
  actor
) {
  requireStaff(actor);
  validateUid(targetUid);

  const cleanReason = validateReason(reason);

  return createRecord(
    `${HISTORY_PATH}/${targetUid}/warnings`,
    {
      reason: cleanReason,
      issuedBy: actor.uid,
      issuedAt: Date.now(),
      active: true
    }
  );
}

// اعمال محدودیت زمانی
export async function restrictMember(
  targetUid,
  duration,
  reason,
  actor
) {
  requireStaff(actor);
  validateUid(targetUid);

  const durationMs = validateDuration(duration);
  const cleanReason = validateReason(reason);

  const now = Date.now();
  const expiresAt = now + durationMs;

  const restrictionId = await createRecord(
    `${RESTRICTIONS_PATH}/${targetUid}`,
    {
      reason: cleanReason,
      issuedBy: actor.uid,
      issuedAt: now,
      expiresAt,
      active: true
    }
  );

  await createRecord(
    `${HISTORY_PATH}/${targetUid}/restrictions`,
    {
      restrictionId,
      reason: cleanReason,
      duration: durationMs,
      issuedBy: actor.uid,
      issuedAt: now,
      expiresAt
    }
  );

  return restrictionId;
}

// مشاهده محدودیت فعال؛ توسط خود عضو یا مدیریت
export async function getActiveRestriction(targetUid, actor) {
  requireUser(actor);
  validateUid(targetUid);

  const isOwner = actor.uid === targetUid;
  const isStaff = ["admin", "leader"].includes(actor.role);

  if (!isOwner && !isStaff) {
    throw new Error("اجازه مشاهده محدودیت این عضو را ندارید.");
  }

  const data = await readData(
    `${RESTRICTIONS_PATH}/${targetUid}`
  );

  if (!isObject(data)) {
    return null;
  }

  const now = Date.now();

  const active = Object.entries(data)
    .filter(([, item]) =>
      isObject(item) &&
      item.active === true &&
      Number(item.expiresAt) > now
    )
    .map(([id, item]) => ({
      id,
      ...item
    }))
    .sort(
      (a, b) => Number(b.expiresAt) - Number(a.expiresAt)
    );

  return active[0] || null;
}

// رفع محدودیت
export async function releaseRestriction(
  targetUid,
  restrictionId,
  actor
) {
  requireStaff(actor);
  validateUid(targetUid);

  if (
    typeof restrictionId !== "string" ||
    !restrictionId.trim() ||
    /[.#$/\[\]]/.test(restrictionId)
  ) {
    throw new Error("شناسه محدودیت معتبر نیست.");
  }

  const path = `${RESTRICTIONS_PATH}/${targetUid}/${restrictionId}`;
  const restriction = await readData(path);

  if (!isObject(restriction)) {
    throw new Error("محدودیت موردنظر پیدا نشد.");
  }

  if (restriction.active !== true) {
    throw new Error("این محدودیت قبلاً رفع شده است.");
  }

  await updateData(path, {
    active: false,
    releasedBy: actor.uid,
    releasedAt: Date.now()
  });

  return true;
}

// مشاهده سابقه مدیریت؛ فقط مدیریت
export async function getModerationHistory(targetUid, actor) {
  requireStaff(actor);
  validateUid(targetUid);

  const data = await readData(
    `${HISTORY_PATH}/${targetUid}`
  );

  if (!isObject(data)) {
    return {
      warnings: {},
      restrictions: {}
    };
  }

  return {
    warnings: isObject(data.warnings) ? data.warnings : {},
    restrictions: isObject(data.restrictions)
      ? data.restrictions
      : {}
  };
}
