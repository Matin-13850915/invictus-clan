
import {
  createRecord,
  getAllRecords
} from "./database.js";

import { createId, normalizeText } from "./utils.js";

const ACTIVITY_PATH = "memberActivity";

const VALID_ACTIVITY_TYPES = [
  "war_participation",
  "war_win",
  "war_loss",
  "tournament_participation",
  "tournament_win",
  "team_activity",
  "badge_received"
];

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
    throw new Error("فقط لیدر و ادمین اجازه ثبت فعالیت اعضا را دارند.");
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

function validateType(type) {
  if (!VALID_ACTIVITY_TYPES.includes(type)) {
    throw new Error("نوع فعالیت معتبر نیست.");
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sortNewest(items) {
  return [...items].sort(
    (a, b) => (Number(b.createdAt) || 0) -
      (Number(a.createdAt) || 0)
  );
}

// ثبت فعالیت عضو
export async function recordMemberActivity(
  uid,
  type,
  description,
  referenceId,
  actor
) {
  requireStaff(actor);
  validateUid(uid);
  validateType(type);

  if (typeof description !== "string") {
    throw new Error("توضیحات فعالیت معتبر نیست.");
  }

  const cleanDescription = normalizeText(description).trim();

  if (
    !cleanDescription ||
    cleanDescription.length > 500
  ) {
    throw new Error("توضیحات باید بین ۱ تا ۵۰۰ کاراکتر باشد.");
  }

  if (
    referenceId !== undefined &&
    referenceId !== null &&
    (
      typeof referenceId !== "string" ||
      referenceId.length > 128 ||
      /[.#$/\[\]]/.test(referenceId)
    )
  ) {
    throw new Error("شناسه مرجع معتبر نیست.");
  }

  const activity = {
    id: createId(),
    uid,
    type,
    description: cleanDescription,
    referenceId: referenceId || null,
    createdAt: Date.now(),
    createdBy: actor.uid
  };

  const recordId = await createRecord(ACTIVITY_PATH, activity);

  return {
    ...activity,
    recordId
  };
}

// فعالیت‌های یک عضو؛ فقط خود عضو یا مدیریت
export async function getMemberActivity(uid, actor) {
  requireUser(actor);
  validateUid(uid);

  const isOwner = actor.uid === uid;
  const isStaff = ["admin", "leader"].includes(actor.role);

  if (!isOwner && !isStaff) {
    throw new Error("اجازه مشاهده سوابق این عضو را ندارید.");
  }

  const activities = safeArray(
    await getAllRecords(ACTIVITY_PATH)
  );

  return sortNewest(
    activities.filter(item => item?.uid === uid)
  );
}

// آمار کلی فعالیت اعضا
export async function getMemberActivityStats(actor) {
  requireStaff(actor);

  const activities = safeArray(
    await getAllRecords(ACTIVITY_PATH)
  );

  const stats = {};

  for (const activity of activities) {
    if (!activity || typeof activity.uid !== "string") {
      continue;
    }

    if (!stats[activity.uid]) {
      stats[activity.uid] = {
        uid: activity.uid,
        totalActivities: 0,
        wars: 0,
        wins: 0,
        losses: 0,
        tournaments: 0,
        tournamentWins: 0,
        teamActivities: 0,
        badges: 0
      };
    }

    const item = stats[activity.uid];

    item.totalActivities++;

    switch (activity.type) {
      case "war_participation":
        item.wars++;
        break;

      case "war_win":
        item.wins++;
        break;

      case "war_loss":
        item.losses++;
        break;

      case "tournament_participation":
        item.tournaments++;
        break;

      case "tournament_win":
        item.tournamentWins++;
        break;

      case "team_activity":
        item.teamActivities++;
        break;

      case "badge_received":
        item.badges++;
        break;
    }
  }

  return Object.values(stats).sort(
    (a, b) => b.totalActivities - a.totalActivities
  );
}

// فعالیت‌های اخیر کلن
export async function getRecentClanActivity(actor, limit = 30) {
  requireStaff(actor);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("تعداد نتایج باید بین ۱ تا ۱۰۰ باشد.");
  }

  const activities = safeArray(
    await getAllRecords(ACTIVITY_PATH)
  );

  return sortNewest(activities).slice(0, limit);
}

// فعالیت‌ها بر اساس نوع
export async function getActivitiesByType(type, actor) {
  requireStaff(actor);
  validateType(type);

  const activities = safeArray(
    await getAllRecords(ACTIVITY_PATH)
  );

  return sortNewest(
    activities.filter(item => item?.type === type)
  );
}

// آمار مشارکت جنگی عضو
export async function getMemberWarParticipation(uid, actor) {
  requireUser(actor);
  validateUid(uid);

  const isOwner = actor.uid === uid;
  const isStaff = ["admin", "leader"].includes(actor.role);

  if (!isOwner && !isStaff) {
    throw new Error("اجازه مشاهده این آمار را ندارید.");
  }

  const activities = safeArray(
    await getAllRecords(ACTIVITY_PATH)
  );

  const memberActivities = activities.filter(item =>
    item?.uid === uid &&
    [
      "war_participation",
      "war_win",
      "war_loss"
    ].includes(item.type)
  );

  return {
    total: memberActivities.filter(
      item => item.type === "war_participation"
    ).length,

    wins: memberActivities.filter(
      item => item.type === "war_win"
    ).length,

    losses: memberActivities.filter(
      item => item.type === "war_loss"
    ).length
  };
    }
