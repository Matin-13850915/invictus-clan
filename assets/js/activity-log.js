
import {
  createRecord,
  getAllRecords
} from "./database.js";

const LOG_PATH = "activityLogs";

const ALLOWED_EVENTS = [
  "member_approved",
  "member_rejected",
  "member_suspended",
  "member_activated",
  "role_changed",
  "war_created",
  "war_updated",
  "war_result_recorded",
  "announcement_created",
  "announcement_deleted",
  "points_added",
  "points_removed",
  "reward_approved",
  "reward_rejected",
  "team_created",
  "team_updated",
  "team_deleted",
  "tournament_created",
  "tournament_completed",
  "rules_updated",
  "settings_updated"
];

function requireUser(actor) {
  if (!actor?.uid) {
    throw new Error("کاربر معتبر نیست.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("دسترسی به تاریخچه مدیریتی ندارید.");
  }
}

function clean(value, max = 300) {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, max);
}

// ثبت یک رویداد مدیریتی
export async function recordActivity(event, details, actor) {
  requireStaff(actor);

  if (!ALLOWED_EVENTS.includes(event)) {
    throw new Error("نوع رویداد معتبر نیست.");
  }

  const log = {
    event,
    actorUid: actor.uid,
    actorName: clean(actor.displayName || actor.gameName || "مدیریت", 80),
    targetUid: clean(details?.targetUid, 128),
    targetName: clean(details?.targetName, 80),
    description: clean(details?.description, 500),
    createdAt: Date.now()
  };

  return await createRecord(LOG_PATH, log);
}

// دریافت تاریخچه مدیریتی
export async function getActivityLogs(actor, options = {}) {
  requireStaff(actor);

  const logs = await getAllRecords(LOG_PATH);

  const limit = Number.isInteger(options.limit)
    ? Math.min(Math.max(options.limit, 1), 500)
    : 100;

  let filtered = logs;

  if (options.event) {
    filtered = filtered.filter(
      item => item.event === options.event
    );
  }

  if (options.targetUid) {
    filtered = filtered.filter(
      item => item.targetUid === options.targetUid
    );
  }

  if (options.actorUid) {
    filtered = filtered.filter(
      item => item.actorUid === options.actorUid
    );
  }

  return filtered
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);
}

// شمارش رویدادها
export async function getActivitySummary(actor) {
  const logs = await getActivityLogs(actor, { limit: 500 });

  const summary = {
    total: logs.length,
    byEvent: {},
    byActor: {}
  };

  for (const log of logs) {
    summary.byEvent[log.event] =
      (summary.byEvent[log.event] || 0) + 1;

    summary.byActor[log.actorUid] =
      (summary.byActor[log.actorUid] || 0) + 1;
  }

  return summary;
    }
  
