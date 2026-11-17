
import {
  createRecord,
  getRecord,
  getAllRecords
} from "./database.js";

import { createId } from "./utils.js";

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
  if (!actor?.uid) {
    throw new Error("ابتدا وارد حساب خود شوید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه ثبت فعالیت اعضا را دارند.");
  }
}

function validateType(type) {
  if (!VALID_ACTIVITY_TYPES.includes(type)) {
    throw new Error("نوع فعالیت معتبر نیست.");
  }
}

// ثبت فعالیت یک عضو
export async function recordMemberActivity(
  uid,
  type,
  description,
  referenceId,
  actor
) {
  requireStaff(actor);
  validateType(type);

  if (typeof uid !== "string" || !uid.trim()) {
    throw new Error("شناسه عضو معتبر نیست.");
  }

  if (
    typeof description !== "string" ||
    description.trim().length > 500
  ) {
    throw new Error("توضیحات فعالیت معتبر نیست.");
  }

  const activity = {
    id: createId(),
    uid,
    type,
    description: description.trim(),
    referenceId: referenceId || null,
    createdAt: Date.now(),
    createdBy: actor.uid
  };

  await createRecord(ACTIVITY_PATH, activity);

  return activity;
}

// دریافت فعالیت‌های یک عضو
export async function getMemberActivity(uid, actor) {
  requireUser(actor);

  const isOwner = actor.uid === uid;
  const isStaff = ["admin", "leader"].includes(actor.role);

  if (!isOwner && !isStaff) {
    throw new Error("اجازه مشاهده سوابق این عضو را ندارید.");
  }

  const activities = await getAllRecords(ACTIVITY_PATH);

  return activities
    .filter(item => item.uid === uid)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// دریافت آمار کلی اعضا
export async function getMemberActivityStats(actor) {
  requireStaff(actor);

  const activities = await getAllRecords(ACTIVITY_PATH);

  const stats = {};

  for (const activity of activities) {
    if (!stats[activity.uid]) {
      stats[activity.uid] = {
        uid: activity.uid,
        totalActivities: 0,
        wars: 0,
        wins: 0,
        losses: 0,
        tournaments: 0,
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

// دریافت فعالیت‌های اخیر کلن
export async function getRecentClanActivity(actor, limit = 30) {
  requireStaff(actor);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("تعداد نتایج معتبر نیست.");
  }

  const activities = await getAllRecords(ACTIVITY_PATH);

  return activities
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);
}

// دریافت فعالیت‌های یک نوع مشخص
export async function getActivitiesByType(type, actor) {
  requireStaff(actor);
  validateType(type);

  const activities = await getAllRecords(ACTIVITY_PATH);

  return activities
    .filter(item => item.type === type)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// دریافت تعداد مشارکت جنگی یک عضو
export async function getMemberWarParticipation(uid, actor) {
  requireUser(actor);

  const isOwner = actor.uid === uid;
  const isStaff = ["admin", "leader"].includes(actor.role);

  if (!isOwner && !isStaff) {
    throw new Error("اجازه مشاهده این آمار را ندارید.");
  }

  const activities = await getAllRecords(ACTIVITY_PATH);

  const memberActivities = activities.filter(item =>
    item.uid === uid &&
    ["war_participation", "war_win", "war_loss"].includes(item.type)
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
