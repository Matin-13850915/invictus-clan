
import {
  createRecord,
  getAllRecords,
  updateRecord
} from "./database.js";

const SESSIONS_PATH = "userSessions";

function requireUser(actor) {
  if (
    !actor ||
    typeof actor.uid !== "string" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(actor.uid)
  ) {
    throw new Error("ابتدا وارد حساب معتبر خود شوید.");
  }
}

function createSessionId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("مرورگر از تولید شناسه امن پشتیبانی نمی‌کند.");
  }

  return globalThis.crypto.randomUUID();
}

function safeMetadata(value, fallback) {
  if (typeof value !== "string") return fallback;

  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 120) || fallback;
}

function sessionPath(uid, recordId) {
  if (
    typeof recordId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(recordId)
  ) {
    throw new Error("شناسه نشست معتبر نیست.");
  }

  return `${SESSIONS_PATH}/${uid}/${recordId}`;
}

export async function registerSession(actor, metadata = {}) {
  requireUser(actor);

  const now = Date.now();
  const sessionId = createSessionId();

  const session = {
    sessionId,
    uid: actor.uid,
    createdAt: now,
    lastActivityAt: now,
    status: "active",
    device: safeMetadata(metadata.device, "دستگاه ناشناس"),
    browser: safeMetadata(metadata.browser, "مرورگر ناشناس")
  };

  const recordId = await createRecord(
    `${SESSIONS_PATH}/${actor.uid}`,
    session
  );

  return {
    ...session,
    id: recordId
  };
}

export async function getMySessions(actor) {
  requireUser(actor);

  const sessions = await getAllRecords(
    `${SESSIONS_PATH}/${actor.uid}`
  );

  return sessions
    .filter(session =>
      session &&
      session.uid === actor.uid &&
      typeof session.sessionId === "string"
    )
    .sort(
      (a, b) =>
        Number(b.createdAt || 0) -
        Number(a.createdAt || 0)
    );
}

async function findMySession(actor, sessionId) {
  requireUser(actor);

  if (
    typeof sessionId !== "string" ||
    !sessionId.trim() ||
    sessionId.length > 128
  ) {
    throw new Error("شناسه نشست معتبر نیست.");
  }

  const sessions = await getMySessions(actor);

  const session = sessions.find(
    item => item.sessionId === sessionId
  );

  if (!session) {
    throw new Error("نشست موردنظر پیدا نشد.");
  }

  return session;
}

export async function updateSessionActivity(sessionId, actor) {
  const session = await findMySession(actor, sessionId);

  if (session.status !== "active") {
    throw new Error("این نشست فعال نیست.");
  }

  await updateRecord(
    sessionPath(actor.uid, session.id),
    {
      lastActivityAt: Date.now()
    }
  );

  return true;
}

export async function closeSession(sessionId, actor) {
  const session = await findMySession(actor, sessionId);

  if (session.status !== "active") {
    return false;
  }

  const now = Date.now();

  await updateRecord(
    sessionPath(actor.uid, session.id),
    {
      status: "closed",
      closedAt: now,
      lastActivityAt: now
    }
  );

  return true;
}

export async function closeAllSessions(actor) {
  const sessions = await getMySessions(actor);

  const activeSessions = sessions.filter(
    session => session.status === "active"
  );

  const now = Date.now();

  const results = await Promise.allSettled(
    activeSessions.map(session =>
      updateRecord(
        sessionPath(actor.uid, session.id),
        {
          status: "closed",
          closedAt: now,
          lastActivityAt: now
        }
      )
    )
  );

  const failed = results.filter(
    result => result.status === "rejected"
  );

  if (failed.length > 0) {
    throw new Error(
      `بستن ${failed.length} نشست ناموفق بود. دوباره تلاش کنید.`
    );
  }

  return activeSessions.length;
}

export async function getActiveSessions(actor) {
  const sessions = await getMySessions(actor);

  return sessions.filter(
    session => session.status === "active"
  );
      }
