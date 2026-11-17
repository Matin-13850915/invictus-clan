
import {
  createRecord,
  readData,
  updateData
} from "./database.js";

import { normalizeText } from "./utils.js";

const RESTRICTIONS_PATH = "restrictions";
const HISTORY_PATH = "moderationHistory";

const ALLOWED_DURATIONS = [
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000
];

function requireStaff(actor) {
  if (
    !actor?.uid ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت محدودیت‌ها را دارند.");
  }
}

function validateTarget(uid, reason) {
  if (typeof uid !== "string" || !uid.trim()) {
    throw new Error("شناسه عضو معتبر نیست.");
  }

  const cleanReason = normalizeText(reason);

  if (cleanReason.length < 3 || cleanReason.length > 300) {
    throw new Error("دلیل اقدام باید بین ۳ تا ۳۰۰ حرف باشد.");
  }

  return cleanReason;
}

export async function issueWarning(
  targetUid,
  reason,
  actor
) {
  requireStaff(actor);

  const cleanReason = validateTarget(targetUid, reason);

  const warningId = await createRecord(
    `${HISTORY_PATH}/${targetUid}/warnings`,
    {
      reason: cleanReason,
      issuedBy: actor.uid,
      issuedAt: Date.now(),
      active: true
    }
  );

  return warningId;
}

export async function restrictMember(
  targetUid,
  duration,
  reason,
  actor
) {
  requireStaff(actor);

  const cleanReason = validateTarget(targetUid, reason);

  const durationMs = Number(duration);

  if (
    !ALLOWED_DURATIONS.includes(durationMs) &&
    (!Number.isInteger(durationMs) || durationMs <= 0)
  ) {
    throw new Error("مدت محدودیت معتبر نیست.");
  }

  if (durationMs > 30 * 24 * 60 * 60 * 1000) {
    throw new Error("مدت محدودیت نمی‌تواند بیشتر از ۳۰ روز باشد.");
  }

  const now = Date.now();

  const restrictionId = await createRecord(
    `${RESTRICTIONS_PATH}/${targetUid}`,
    {
      reason: cleanReason,
      issuedBy: actor.uid,
      issuedAt: now,
      expiresAt: now + durationMs,
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
      expiresAt: now + durationMs
    }
  );

  return restrictionId;
}

export async function getActiveRestriction(targetUid) {
  if (!targetUid) {
    throw new Error("شناسه عضو معتبر نیست.");
  }

  const data = await readData(`${RESTRICTIONS_PATH}/${targetUid}`);

  if (!data) return null;

  const now = Date.now();

  const active = Object.entries(data)
    .map(([id, item]) => ({ id, ...item }))
    .filter(item => {
      return item.active === true && item.expiresAt > now;
    })
    .sort((a, b) => b.expiresAt - a.expiresAt);

  return active[0] || null;
}

export async function releaseRestriction(
  targetUid,
  restrictionId,
  actor
) {
  requireStaff(actor);

  if (!targetUid || !restrictionId) {
    throw new Error("اطلاعات رفع محدودیت معتبر نیست.");
  }

  await updateData(
    `${RESTRICTIONS_PATH}/${targetUid}/${restrictionId}`,
    {
      active: false,
      releasedBy: actor.uid,
      releasedAt: Date.now()
    }
  );

  return true;
}

export async function getModerationHistory(targetUid, actor) {
  requireStaff(actor);

  if (!targetUid) {
    throw new Error("شناسه عضو معتبر نیست.");
  }

  const data = await readData(`${HISTORY_PATH}/${targetUid}`);

  return data || {
    warnings: {},
    restrictions: {}
  };
}
