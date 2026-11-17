
import {
  createRecord,
  readData,
  updateData,
  deleteData
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "announcements";

function validateAnnouncement(data) {
  if (!data || typeof data !== "object") {
    throw new Error("اطلاعات اطلاعیه معتبر نیست.");
  }

  const title = normalizeText(data.title);
  const body = normalizeText(data.body);

  if (title.length < 3 || title.length > 100) {
    throw new Error("عنوان اطلاعیه باید بین ۳ تا ۱۰۰ حرف باشد.");
  }

  if (body.length < 5 || body.length > 5000) {
    throw new Error("متن اطلاعیه باید بین ۵ تا ۵۰۰۰ حرف باشد.");
  }

  return { title, body };
}

function requireStaff(actor) {
  if (
    !actor ||
    !actor.uid ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت اطلاعیه را دارند.");
  }
}

export async function createAnnouncement(data, actor) {
  requireStaff(actor);

  const content = validateAnnouncement(data);

  return await createRecord(PATH, {
    ...content,
    pinned: false,
    archived: false,
    authorUid: actor.uid,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

export async function getAnnouncements(options = {}) {
  const data = await readData(PATH);

  if (!data) return [];

  return Object.entries(data)
    .map(([id, item]) => ({ id, ...item }))
    .filter(item => {
      if (options.includeArchived) return true;
      return item.archived !== true;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      return (b.createdAt || 0) - (a.createdAt || 0);
    });
}

export async function editAnnouncement(
  announcementId,
  data,
  actor
) {
  requireStaff(actor);

  if (!announcementId) {
    throw new Error("شناسه اطلاعیه معتبر نیست.");
  }

  const content = validateAnnouncement(data);

  await updateData(`${PATH}/${announcementId}`, {
    ...content,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });

  return true;
}

export async function pinAnnouncement(
  announcementId,
  pinned,
  actor
) {
  requireStaff(actor);

  if (!announcementId || typeof pinned !== "boolean") {
    throw new Error("اطلاعات سنجاق‌کردن معتبر نیست.");
  }

  await updateData(`${PATH}/${announcementId}`, {
    pinned,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });

  return true;
}

export async function archiveAnnouncement(
  announcementId,
  archived,
  actor
) {
  requireStaff(actor);

  if (!announcementId || typeof archived !== "boolean") {
    throw new Error("اطلاعات آرشیو معتبر نیست.");
  }

  await updateData(`${PATH}/${announcementId}`, {
    archived,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });

  return true;
}

export async function removeAnnouncement(
  announcementId,
  actor
) {
  requireStaff(actor);

  if (!announcementId) {
    throw new Error("شناسه اطلاعیه معتبر نیست.");
  }

  await deleteData(`${PATH}/${announcementId}`);

  return true;
}
