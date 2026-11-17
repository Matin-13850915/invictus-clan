
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateData,
  deleteData
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "announcements";

function requireStaff(actor) {
  if (
    !actor?.uid ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت اطلاعیه‌ها را دارند.");
  }
}

function validateId(id) {
  if (
    typeof id !== "string" ||
    !id.trim() ||
    /[.#$/[\]]/.test(id)
  ) {
    throw new Error("شناسه اطلاعیه معتبر نیست.");
  }
}

function cleanText(value, maxLength) {
  return normalizeText(String(value ?? "").trim()).slice(0, maxLength);
}

function validateAnnouncement(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات اطلاعیه معتبر نیست.");
  }

  const title = cleanText(data.title, 100);
  const body = cleanText(data.body, 5000);

  if (title.length < 3) {
    throw new Error("عنوان باید حداقل ۳ حرف باشد.");
  }

  if (body.length < 5) {
    throw new Error("متن اطلاعیه باید حداقل ۵ حرف باشد.");
  }

  return { title, body };
}

function normalizeAnnouncement(item) {
  return {
    id: item.id,
    title: item.title || "",
    body: item.body || "",
    pinned: item.pinned === true,
    archived: item.archived === true,
    authorUid: item.authorUid || "",
    createdAt: Number(item.createdAt) || 0,
    updatedAt: Number(item.updatedAt) || 0
  };
}

export async function createAnnouncement(data, actor) {
  requireStaff(actor);

  const content = validateAnnouncement(data);
  const now = Date.now();

  return await createRecord(PATH, {
    ...content,
    pinned: false,
    archived: false,
    authorUid: actor.uid,
    createdAt: now,
    updatedAt: now
  });
}

export async function getAnnouncements(options = {}) {
  const announcements = await getAllRecords(PATH);

  return announcements
    .filter(item => options.includeArchived || item.archived !== true)
    .map(normalizeAnnouncement)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return Number(b.pinned) - Number(a.pinned);
      }

      return b.createdAt - a.createdAt;
    });
}

export async function getAnnouncement(id) {
  validateId(id);

  const item = await getRecord(`${PATH}/${id}`);

  return item ? normalizeAnnouncement(item) : null;
}

export async function editAnnouncement(id, data, actor) {
  requireStaff(actor);
  validateId(id);

  const existing = await getRecord(`${PATH}/${id}`);

  if (!existing) {
    throw new Error("اطلاعیه پیدا نشد.");
  }

  if (existing.archived === true) {
    throw new Error("اطلاعیه آرشیوشده قابل ویرایش نیست.");
  }

  const content = validateAnnouncement(data);

  await updateData(`${PATH}/${id}`, {
    ...content,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function pinAnnouncement(id, pinned, actor) {
  requireStaff(actor);
  validateId(id);

  if (typeof pinned !== "boolean") {
    throw new Error("وضعیت سنجاق معتبر نیست.");
  }

  const existing = await getRecord(`${PATH}/${id}`);

  if (!existing || existing.archived === true) {
    throw new Error("اطلاعیه پیدا نشد یا آرشیو شده است.");
  }

  await updateData(`${PATH}/${id}`, {
    pinned,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function archiveAnnouncement(id, actor) {
  requireStaff(actor);
  validateId(id);

  const existing = await getRecord(`${PATH}/${id}`);

  if (!existing) {
    throw new Error("اطلاعیه پیدا نشد.");
  }

  await updateData(`${PATH}/${id}`, {
    archived: true,
    pinned: false,
    archivedBy: actor.uid,
    archivedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

export async function restoreAnnouncement(id, actor) {
  requireStaff(actor);
  validateId(id);

  const existing = await getRecord(`${PATH}/${id}`);

  if (!existing) {
    throw new Error("اطلاعیه پیدا نشد.");
  }

  await updateData(`${PATH}/${id}`, {
    archived: false,
    restoredBy: actor.uid,
    restoredAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

export async function removeAnnouncement(id, actor) {
  requireStaff(actor);
  validateId(id);

  const existing = await getRecord(`${PATH}/${id}`);

  if (!existing) {
    throw new Error("اطلاعیه پیدا نشد.");
  }

  await deleteData(`${PATH}/${id}`);

  return true;
      }
