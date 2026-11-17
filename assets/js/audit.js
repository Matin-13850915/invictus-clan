
import { createRecord, readData } from "./database.js";

export async function recordAudit({
  actorUid,
  actorRole,
  action,
  targetUid = null,
  details = {},
  reason = ""
}) {
  if (!actorUid || !actorRole || !action) {
    throw new Error("اطلاعات ثبت رویداد کامل نیست.");
  }

  return createRecord("auditLogs", {
    actorUid,
    actorRole,
    action,
    targetUid,
    details,
    reason,
    createdAt: Date.now()
  });
}

export async function getAuditHistory(limit = 100) {
  const logs = await readData("auditLogs");

  if (!logs) return [];

  return Object.entries(logs)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, Math.max(1, Math.min(Number(limit) || 100, 500)));
}

export async function getUserAuditHistory(uid, limit = 100) {
  if (!uid) throw new Error("شناسه کاربر معتبر نیست.");

  const logs = await getAuditHistory(500);

  return logs
    .filter(item =>
      item.actorUid === uid ||
      item.targetUid === uid
    )
    .slice(0, Math.max(1, Math.min(Number(limit) || 100, 500)));
      }
