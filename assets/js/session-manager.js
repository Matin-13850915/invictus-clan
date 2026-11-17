
import {
  createRecord,
  getAllRecords,
  updateRecord
} from "./database.js";

const SESSIONS_PATH = "userSessions";

function requireUser(actor) {
  if (!actor?.uid) {
    throw new Error("ابتدا وارد حساب خود شوید.");
  }
}

function createSessionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return [
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2)
  ].join("-");
}

// ثبت ورود جدید
export async function registerSession(actor, metadata = {}) {
  requireUser(actor);

  const sessionId = createSessionId();
  const now = Date.now();

  const session = {
    sessionId,
    uid: actor.uid,
    createdAt: now,
    lastActivityAt: now,
    status: "active",
    device: typeof metadata.device === "string"
      ? metadata.device.slice(0, 120)
      : "دستگاه ناشناس",
    browser: typeof metadata.browser === "string"
      ? metadata.browser.slice(0, 120)
      : "مرورگر ناشناس"
  };

  await createRecord(
    `${SESSIONS_PATH}/${actor.uid}`,
    session
  );

  return session;
}

// دریافت نشست‌های حساب
export async function getMySessions(actor) {
  requireUser(actor);

  const sessions = await getAllRecords(
    `${SESSIONS_PATH}/${actor.uid}`
  );

  return sessions
    .filter(session => session.uid === actor.uid)
    .sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
}

// ثبت فعالیت نشست
export async function updateSessionActivity(
  sessionId,
  actor
) {
  requireUser(actor);

  if (!sessionId) {
    throw new Error("شناسه نشست معتبر نیست.");
  }

  const sessions = await getMySessions(actor);
  const session = sessions.find(
    item => item.sessionId === sessionId
  );

  if (!session || session.status !== "active") {
    throw new Error("نشست فعال پیدا نشد.");
  }

  await updateRecord(
    `${SESSIONS_PATH}/${actor.uid}/${session.id}`,
    {
      lastActivityAt: Date.now()
    }
  );

  return true;
}

// خروج از یک نشست ثبت‌شده
export async function closeSession(
  sessionId,
  actor
) {
  requireUser(actor);

  const sessions = await getMySessions(actor);
  const session = sessions.find(
    item => item.sessionId === sessionId
  );

  if (!session || session.status !== "active") {
    throw new Error("نشست فعال پیدا نشد.");
  }

  await updateRecord(
    `${SESSIONS_PATH}/${actor.uid}/${session.id}`,
    {
      status: "closed",
      closedAt: Date.now()
    }
  );

  return true;
}

// خروج از تمام نشست‌های ثبت‌شده
export async function closeAllSessions(actor) {
  requireUser(actor);

  const sessions = await getMySessions(actor);

  const activeSessions = sessions.filter(
    session => session.status === "active"
  );

  for (const session of activeSessions) {
    await updateRecord(
      `${SESSIONS_PATH}/${actor.uid}/${session.id}`,
      {
        status: "closed",
        closedAt: Date.now()
      }
    );
  }

  return activeSessions.length;
      }
