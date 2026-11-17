
import { createRecord, readData, listenToData, updateData } from "./database.js";

export async function sendNotification(uid, notification) {
  if (!uid || !notification?.title || !notification?.message) {
    throw new Error("اطلاعات اعلان کامل نیست.");
  }

  return createRecord(`notifications/${uid}`, {
    title: String(notification.title),
    message: String(notification.message),
    type: notification.type || "info",
    read: false,
    createdAt: Date.now()
  });
}

export async function getNotifications(uid) {
  if (!uid) throw new Error("شناسه کاربر معتبر نیست.");

  return (await readData(`notifications/${uid}`)) || {};
}

export function watchNotifications(uid, callback, onError) {
  if (!uid) throw new Error("شناسه کاربر معتبر نیست.");

  return listenToData(
    `notifications/${uid}`,
    callback,
    onError
  );
}

export async function markNotificationRead(uid, notificationId) {
  if (!uid || !notificationId) {
    throw new Error("اطلاعات اعلان معتبر نیست.");
  }

  await updateData(
    `notifications/${uid}/${notificationId}`,
    { read: true }
  );
}

export async function markAllNotificationsRead(uid) {
  const notifications = await getNotifications(uid);

  const updates = {};

  for (const [id, notification] of Object.entries(notifications)) {
    if (notification && notification.read !== true) {
      updates[`${id}/read`] = true;
    }
  }

  if (Object.keys(updates).length > 0) {
    await updateData(`notifications/${uid}`, updates);
  }
}

export function countUnreadNotifications(notifications = {}) {
  return Object.values(notifications).filter(
    item => item && item.read !== true
  ).length;
}
notification.read
