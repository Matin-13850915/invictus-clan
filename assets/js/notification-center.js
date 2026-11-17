
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord
} from "./database.js";

import { createId } from "./utils.js";

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
  if (!actor?.uid) {
    throw new Error("ابتدا وارد حساب خود شوید.");
  }
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    throw new Error("متن اعلان معتبر نیست.");
  }

  const text = value.trim();

  if (!text || text.length > maxLength) {
    throw new Error(`متن باید بین ۱ تا ${maxLength} کاراکتر باشد.`);
  }

  return text;
}

// ایجاد اعلان برای یک عضو
export async function createUserNotification(data, actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط مدیریت اجازه ارسال اعلان مستقیم دارد.");
  }

  if (typeof data.uid !== "string" || !data.uid.trim()) {
    throw new Error("شناسه دریافت‌کننده معتبر نیست.");
  }

  if (!VALID_TYPES.includes(data.type)) {
    throw new Error("نوع اعلان معتبر نیست.");
  }

  const notification = {
    id: createId(),
    uid: data.uid,
    type: data.type,
    title: cleanText(data.title, 100),
    message: cleanText(data.message, 1000),
    link: typeof data.link === "string"
      ? data.link.slice(0, 300)
      : null,
    read: false,
    createdAt: Date.now(),
    createdBy: actor.uid
  };

  await createRecord(NOTIFICATIONS_PATH, notification);

  return notification;
}

// دریافت اعلان‌های خود کاربر
export async function getMyNotifications(actor, limit = 50) {
  requireUser(actor);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("تعداد اعلان‌ها معتبر نیست.");
  }

  const all = await getAllRecords(NOTIFICATIONS_PATH);

  return all
    .filter(item => item.uid === actor.uid)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);
}

// تعداد اعلان‌های خوانده‌نشده
export async function getUnreadNotificationCount(actor) {
  requireUser(actor);

  const notifications = await getMyNotifications(actor, 100);

  return notifications.filter(item => !item.read).length;
}

// علامت‌گذاری یک اعلان به‌عنوان خوانده‌شده
export async function markNotificationAsRead(id, actor) {
  requireUser(actor);

  const notification = await getRecord(
    `${NOTIFICATIONS_PATH}/${id}`
  );

  if (!notification || notification.uid !== actor.uid) {
    throw new Error("اعلان موردنظر پیدا نشد.");
  }

  if (notification.read) {
    return true;
  }

  await updateRecord(`${NOTIFICATIONS_PATH}/${id}`, {
    read: true,
    readAt: Date.now()
  });

  return true;
}

// خوانده‌شده کردن همه اعلان‌های کاربر
export async function markAllNotificationsAsRead(actor) {
  requireUser(actor);

  const notifications = await getMyNotifications(actor, 100);

  const unread = notifications.filter(item => !item.read);

  for (const notification of unread) {
    await updateRecord(
      `${NOTIFICATIONS_PATH}/${notification.id}`,
      {
        read: true,
        readAt: Date.now()
      }
    );
  }

  return unread.length;
}

// حذف یک اعلان توسط صاحب آن
export async function deleteMyNotification(id, actor) {
  requireUser(actor);

  const notification = await getRecord(
    `${NOTIFICATIONS_PATH}/${id}`
  );

  if (!notification || notification.uid !== actor.uid) {
    throw new Error("اعلان موردنظر پیدا نشد.");
  }

  await updateRecord(`${NOTIFICATIONS_PATH}/${id}`, {
    deleted: true,
    deletedAt: Date.now()
  });

  return true;
}

// حذف اعلان‌های قدیمی کاربر از نمایش
export async function archiveOldNotifications(
  days,
  actor
) {
  requireUser(actor);

  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > 365
  ) {
    throw new Error("بازه زمانی معتبر نیست.");
  }

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const notifications = await getMyNotifications(actor, 100);

  const oldItems = notifications.filter(item =>
    !item.archived &&
    item.createdAt < cutoff
  );

  for (const item of oldItems) {
    await updateRecord(
      `${NOTIFICATIONS_PATH}/${item.id}`,
      {
        archived: true,
        archivedAt: Date.now()
      }
    );
  }

  return oldItems.length;
}

// دریافت اعلان‌های بایگانی‌نشده
export async function getVisibleNotifications(actor) {
  requireUser(actor);

  const notifications = await getMyNotifications(actor, 100);

  return notifications.filter(item =>
    !item.deleted && !item.archived
  );
}
