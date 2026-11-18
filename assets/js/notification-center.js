
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord
} from "./database.js";

import { normalizeText } from "./utils.js";

const NOTIFICATIONS_PATH = "notifications";

const VALID_TYPES = [
  "announcement",
  "war",
  "application",
  "tournament",
  "team",
  "reward",
  "message",
  "support",
  "system"
];

function requireUser(actor) {
  if (!actor?.uid || actor.active !== true) {
    throw new Error("برای استفاده از اعلان‌ها باید عضو فعال باشید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه ارسال اعلان مستقیم دارند.");
  }
}

function validateUid(uid) {
  if (
    typeof uid !== "string" ||
    !uid.trim() ||
    uid.length > 128 ||
    /[.#$/\[\]]/.test(uid)
  ) {
    throw new Error("شناسه دریافت‌کننده معتبر نیست.");
  }
}

function validateId(id) {
  if (
    typeof id !== "string" ||
    !id.trim() ||
    /[.#$/\[\]]/.test(id)
  ) {
    throw new Error("شناسه اعلان معتبر نیست.");
  }
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    throw new Error("متن اعلان معتبر نیست.");
  }

  const text = normalizeText(value).trim();

  if (!text || text.length > maxLength) {
    throw new Error(`متن باید بین ۱ تا ${maxLength} کاراکتر باشد.`);
  }

  return text;
}

function validateLink(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || value.length > 300) {
    throw new Error("لینک اعلان معتبر نیست.");
  }

  const link = value.trim();

  if (
    !link.startsWith("/") &&
    !/^https:\/\/[^\s]+$/i.test(link)
  ) {
    throw new Error("لینک باید مسیر داخلی یا آدرس HTTPS باشد.");
  }

  if (link.startsWith("//")) {
    throw new Error("لینک نامعتبر است.");
  }

  return link;
}

function safeArray(value) {
  if (Array.isArray(value)) return value;

  if (value && typeof value === "object") {
    return Object.entries(value).map(([id, item]) => ({
      id,
      ...item
    }));
  }

  return [];
}

function sortNewest(items) {
  return [...items].sort(
    (a, b) =>
      (Number(b.createdAt) || 0) -
      (Number(a.createdAt) || 0)
  );
}

export async function createUserNotification(data, actor) {
  requireStaff(actor);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات اعلان معتبر نیست.");
  }

  validateUid(data.uid);

  if (!VALID_TYPES.includes(data.type)) {
    throw new Error("نوع اعلان معتبر نیست.");
  }

  const notification = {
    uid: data.uid,
    type: data.type,
    title: cleanText(data.title, 100),
    message: cleanText(data.message, 1000),
    link: validateLink(data.link),
    read: false,
    deleted: false,
    archived: false,
    createdAt: Date.now(),
    createdBy: actor.uid
  };

  const id = await createRecord(
    `${NOTIFICATIONS_PATH}/${data.uid}`,
    notification
  );

  return {
    id,
    ...notification
  };
}

export async function getMyNotifications(actor, limit = 50) {
  requireUser(actor);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("تعداد اعلان‌ها باید بین ۱ تا ۱۰۰ باشد.");
  }

  const all = safeArray(
    await getAllRecords(`${NOTIFICATIONS_PATH}/${actor.uid}`)
  );

  return sortNewest(
    all.filter(item =>
      item &&
      item.uid === actor.uid &&
      item.deleted !== true &&
      item.archived !== true
    )
  ).slice(0, limit);
}

export async function getUnreadNotificationCount(actor) {
  const notifications = await getMyNotifications(actor, 100);

  return notifications.filter(
    item => item.read !== true
  ).length;
}

export async function markNotificationAsRead(id, actor) {
  requireUser(actor);
  validateId(id);

  const path = `${NOTIFICATIONS_PATH}/${actor.uid}/${id}`;
  const notification = await getRecord(path);

  if (
    !notification ||
    notification.uid !== actor.uid ||
    notification.deleted === true
  ) {
    throw new Error("اعلان موردنظر پیدا نشد.");
  }

  if (notification.read === true) {
    return true;
  }

  await updateRecord(path, {
    read: true,
    readAt: Date.now()
  });

  return true;
}

export async function markAllNotificationsAsRead(actor) {
  requireUser(actor);

  const notifications = await getMyNotifications(actor, 100);
  const unread = notifications.filter(
    item => item.read !== true
  );

  for (const notification of unread) {
    await updateRecord(
      `${NOTIFICATIONS_PATH}/${actor.uid}/${notification.id}`,
      {
        read: true,
        readAt: Date.now()
      }
    );
  }

  return unread.length;
}

export async function deleteMyNotification(id, actor) {
  requireUser(actor);
  validateId(id);

  const path = `${NOTIFICATIONS_PATH}/${actor.uid}/${id}`;
  const notification = await getRecord(path);

  if (
    !notification ||
    notification.uid !== actor.uid ||
    notification.deleted === true
  ) {
    throw new Error("اعلان موردنظر پیدا نشد.");
  }

  await updateRecord(path, {
    deleted: true,
    deletedAt: Date.now(),
    deletedBy: actor.uid
  });

  return true;
}

export async function archiveOldNotifications(days, actor) {
  requireUser(actor);

  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > 365
  ) {
    throw new Error("بازه زمانی باید بین ۱ تا ۳۶۵ روز باشد.");
  }

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const notifications = await getMyNotifications(actor, 100);

  const oldItems = notifications.filter(item =>
    item.archived !== true &&
    Number(item.createdAt) > 0 &&
    Number(item.createdAt) < cutoff
  );

  for (const item of oldItems) {
    await updateRecord(
      `${NOTIFICATIONS_PATH}/${actor.uid}/${item.id}`,
      {
        archived: true,
        archivedAt: Date.now()
      }
    );
  }

  return oldItems.length;
}

export async function getVisibleNotifications(actor) {
  return getMyNotifications(actor, 100);
      }
    
