
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord
} from "./database.js";

import { createId } from "./utils.js";

const BADGES_PATH = "badges";
const MEMBER_BADGES_PATH = "memberBadges";
const HISTORY_PATH = "badgeHistory";

function requireUser(actor) {
  if (
    !actor ||
    typeof actor.uid !== "string" ||
    !actor.uid.trim()
  ) {
    throw new Error("ابتدا وارد حساب خود شوید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت نشان‌ها را دارند.");
  }
}

function assertId(value, label = "شناسه") {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    /[.#$/\[\]]/.test(value)
  ) {
    throw new Error(`${label} معتبر نیست.`);
  }
}

function cleanText(value, maxLength, required = true) {
  if (typeof value !== "string") {
    throw new Error("متن واردشده معتبر نیست.");
  }

  const result = value.trim();

  if (
    (required && !result) ||
    result.length > maxLength
  ) {
    throw new Error(
      `متن باید ${required ? "بین ۱ تا" : "حداکثر"} ${maxLength} کاراکتر باشد.`
    );
  }

  return result;
}

function cleanIcon(value) {
  if (typeof value !== "string" || value.length > 20) {
    throw new Error("آیکون نشان معتبر نیست.");
  }

  return value.trim() || "🏅";
}

// ایجاد نشان
export async function createBadge(data, actor) {
  requireStaff(actor);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات نشان معتبر نیست.");
  }

  const name = cleanText(data.name, 60);
  const description = cleanText(data.description, 300);
  const icon = cleanIcon(data.icon ?? "🏅");

  const badge = {
    id: createId(),
    name,
    description,
    icon,
    active: true,
    createdAt: Date.now(),
    createdBy: actor.uid
  };

  await createRecord(BADGES_PATH, badge);

  return badge;
}

// دریافت نشان‌های فعال
export async function getActiveBadges() {
  const badges = await getAllRecords(BADGES_PATH);

  return badges
    .filter(badge => badge.active !== false)
    .sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );
}

// دریافت همه نشان‌ها برای مدیریت
export async function getAllBadges(actor) {
  requireStaff(actor);

  return getAllRecords(BADGES_PATH);
}

// ویرایش نشان
export async function updateBadge(badgeId, changes, actor) {
  requireStaff(actor);
  assertId(badgeId, "شناسه نشان");

  if (
    !changes ||
    typeof changes !== "object" ||
    Array.isArray(changes)
  ) {
    throw new Error("اطلاعات ویرایش معتبر نیست.");
  }

  const badge = await getRecord(`${BADGES_PATH}/${badgeId}`);

  if (!badge) {
    throw new Error("نشان موردنظر پیدا نشد.");
  }

  const updates = {
    updatedAt: Date.now(),
    updatedBy: actor.uid
  };

  if (changes.name !== undefined) {
    updates.name = cleanText(changes.name, 60);
  }

  if (changes.description !== undefined) {
    updates.description = cleanText(changes.description, 300);
  }

  if (changes.icon !== undefined) {
    updates.icon = cleanIcon(changes.icon);
  }

  if (changes.active !== undefined) {
    if (typeof changes.active !== "boolean") {
      throw new Error("وضعیت نشان معتبر نیست.");
    }

    updates.active = changes.active;
  }

  await updateRecord(`${BADGES_PATH}/${badgeId}`, updates);

  return { ...badge, ...updates };
}

// اعطای نشان به عضو
export async function awardBadge(uid, badgeId, reason, actor) {
  requireStaff(actor);
  assertId(uid, "شناسه عضو");
  assertId(badgeId, "شناسه نشان");

  const cleanReason = cleanText(reason, 500);

  const [badge, existingAwards] = await Promise.all([
    getRecord(`${BADGES_PATH}/${badgeId}`),
    getAllRecords(MEMBER_BADGES_PATH)
  ]);

  if (!badge || badge.active === false) {
    throw new Error("این نشان فعال یا موجود نیست.");
  }

  const duplicate = existingAwards.some(item =>
    item.uid === uid &&
    item.badgeId === badgeId &&
    item.active !== false
  );

  if (duplicate) {
    throw new Error("این عضو قبلاً این نشان را دریافت کرده است.");
  }

  const now = Date.now();

  const award = {
    id: createId(),
    uid,
    badgeId,
    badgeName: badge.name,
    badgeIcon: badge.icon || "🏅",
    reason: cleanReason,
    active: true,
    awardedAt: now,
    awardedBy: actor.uid
  };

  await createRecord(MEMBER_BADGES_PATH, award);

  await createRecord(HISTORY_PATH, {
    action: "award",
    uid,
    badgeId,
    awardId: award.id,
    actorUid: actor.uid,
    createdAt: now,
    reason: cleanReason
  });

  return award;
}

// دریافت نشان‌های یک عضو
export async function getMemberBadges(uid, actor) {
  requireUser(actor);
  assertId(uid, "شناسه عضو");

  const isOwner = actor.uid === uid;
  const isStaff = ["admin", "leader"].includes(actor.role);

  if (!isOwner && !isStaff) {
    throw new Error("اجازه مشاهده سوابق نشان این عضو را ندارید.");
  }

  const awards = await getAllRecords(MEMBER_BADGES_PATH);

  return awards
    .filter(item =>
      item.uid === uid &&
      item.active !== false
    )
    .sort((a, b) =>
      (b.awardedAt || 0) - (a.awardedAt || 0)
    );
}

// لغو نشان اعطاشده
export async function revokeBadge(awardId, reason, actor) {
  requireStaff(actor);
  assertId(awardId, "شناسه نشان اعطاشده");

  const award = await getRecord(
    `${MEMBER_BADGES_PATH}/${awardId}`
  );

  if (!award || award.active === false) {
    throw new Error("نشان اعطاشده پیدا نشد.");
  }

  const cleanReason = cleanText(reason, 500);
  const now = Date.now();

  await updateRecord(`${MEMBER_BADGES_PATH}/${awardId}`, {
    active: false,
    revokedAt: now,
    revokedBy: actor.uid,
    revokeReason: cleanReason
  });

  await createRecord(HISTORY_PATH, {
    action: "revoke",
    uid: award.uid,
    badgeId: award.badgeId,
    awardId,
    actorUid: actor.uid,
    createdAt: now,
    reason: cleanReason
  });

  return true;
}

// تاریخچه مدیریت نشان‌ها
export async function getBadgeHistory(actor) {
  requireStaff(actor);

  const history = await getAllRecords(HISTORY_PATH);

  return history.sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
}
