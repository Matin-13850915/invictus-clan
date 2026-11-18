
import {
  createRecord,
  getAllRecords,
  updateRecord,
  listenToData
} from "./database.js";

const NOTIFICATIONS_PATH = "notifications";

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
    throw new Error("شناسه کاربر معتبر نیست.");
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

  const result = value.trim();

  if (!result || result.length > maxLength) {
    throw new Error(`متن باید بین ۱ تا ${maxLength} کاراکتر باشد.`);
  }

  return result;
}

function getOwnedNotification(uid, id, notifications) {
  return notifications.find(item =>
    item.id === id && item.uid === uid
  );
}

// ارسال اعلان مستقیم؛ فقط مدیریت
export async function sendNotification(uid, notification, actor) {
  requireStaff(actor);
  validateUid(uid);

  if (
    !notification ||
    typeof notification !== "object" ||
    Array.isArray(notification)
  ) {
    throw new Error("اطلاعات اعلان معتبر نیست.");
  }

  const record = {
    uid,
    title: cleanText(notification.title, 100),
    message: cleanText(notification.message, 1000),
    type: notification.type || "system",
    read: false,
    deleted: false,
    archived: false,
    createdAt: Date.now(),
    createdBy: actor.uid
  };

  const id = await createRecord(`${NOTIFICATIONS_PATH}/${uid}`, record);

  return {
    id,
    ...record
  };
}

// دریافت اعلان‌های خود عضو
export async function getNotifications(uid, actor) {
  requireUser(actor);
  validateUid(uid);

  if (actor.uid !== uid) {
    throw new Error("اجازه مشاهده اعلان‌های این کاربر را ندارید.");
  }

  const records = await getAllRecords(`${NOTIFICATIONS_PATH}/${uid}`);

  if (!Array.isArray(records)) {
    return [];
  }

  return records
    .filter(item =>
      item &&
      item.uid === uid &&
      item.deleted !== true &&
      item.archived !== true
    )
    .sort(
      (a, b) => (Number(b.createdAt) || 0) -
        (Number(a.createdAt) || 0)
    );
}

// دریافت زنده اعلان‌های خود عضو
export function watchNotifications(uid, callback, onError, actor) {
  requireUser(actor);
  validateUid(uid);

  if (actor.uid !== uid) {
    throw new Error("اجازه مشاهده اعلان‌های این کاربر را ندارید.");
  }

  if (typeof callback !== "function") {
    throw new Error("تابع دریافت اعلان معتبر نیست.");
  }

  return listenToData(
    `${NOTIFICATIONS_PATH}/${uid}`,
    data => {
      const records = data && typeof data === "object"
        ? Object.entries(data).map(([id, item]) => ({
            id,
            ...item
          }))
        : [];

      const visible = records
        .filter(item =>
          item &&
          item.uid === uid &&
          item.deleted !== true &&
          item.archived !== true
        )
        .sort(
          (a, b) => (Number(b.createdAt) || 0) -
            (Number(a.createdAt) || 0)
        );

      callback(visible);
    },
    onError
  );
}

// خوانده‌شده کردن یک اعلان
export async function markNotificationRead(uid, notificationId, actor) {
  requireUser(actor);
  validateUid(uid);
  validateId(notificationId);

  if (actor.uid !== uid) {
    throw new Error("اجازه تغییر اعلان این کاربر را ندارید.");
  }

  const notifications = await getNotifications(uid, actor);
  const notification = getOwnedNotification(
    uid,
    notificationId,
    notifications
  );

  if (!notification) {
    throw new Error("اعلان موردنظر پیدا نشد.");
  }

  if (notification.read === true) {
    return true;
  }

  await updateRecord(
    `${NOTIFICATIONS_PATH}/${uid}/${notificationId}`,
    {
      read: true,
      readAt: Date.now()
    }
  );

  return true;
}

// خوانده‌شده کردن همه اعلان‌ها
export async function markAllNotificationsRead(uid, actor) {
  requireUser(actor);
  validateUid(uid);

  if (actor.uid !== uid) {
    throw new Error("اجازه تغییر اعلان‌های این کاربر را ندارید.");
  }

  const notifications = await getNotifications(uid, actor);
  const unread = notifications.filter(
    item => item.read !== true
  );

  for (const notification of unread) {
    await updateRecord(
      `${NOTIFICATIONS_PATH}/${uid}/${notification.id}`,
      {
        read: true,
        readAt: Date.now()
      }
    );
  }

  return unread.length;
}

// شمارش اعلان‌های خوانده‌نشده
export function countUnreadNotifications(notifications = []) {
  const items = Array.isArray(notifications)
    ? notifications
    : Object.values(notifications || {});

  return items.filter(item =>
    item &&
    item.read !== true &&
    item.deleted !== true &&
    item.archived !== true
  ).length;
                       }
    
