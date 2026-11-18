
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateData,
  deleteData
} from "./database.js";

import { normalizeText } from "./utils.js";
import { getAdminUid } from "./auth.js";

const PATH = "announcements";

function requireUser(actor) {
  if (
    !actor?.uid ||
    typeof actor.uid !== "string" ||
    actor.active !== true
  ) {
    throw new Error("حساب کاربری فعال و معتبر نیست.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت اطلاعیه‌ها را دارند.");
  }

  if (
    actor.role === "admin" &&
    actor.uid !== getAdminUid()
  ) {
    throw new Error("دسترسی ادمین اصلی معتبر نیست.");
  }
}

function requireAdmin(actor) {
  requireUser(actor);

  if (
    actor.role !== "admin" ||
    actor.uid !== getAdminUid()
  ) {
    throw new Error("این عملیات فقط برای ادمین اصلی مجاز است.");
  }
}

function validateId(id) {
  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(id)
  ) {
    throw new Error("شناسه اطلاعیه معتبر نیست.");
  }
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    throw new Error("متن واردشده معتبر نیست.");
  }

  return normalizeText(value.trim()).slice(0, maxLength);
}

function validateAnnouncement(data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
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
    authorName: item.authorName || "",
    createdAt: Number(item.createdAt) || 0,
    updatedAt: Number(item.updatedAt) || 0,
    updatedBy: item.updatedBy || "",
    archivedAt: Number(item.archivedAt) || null
  };
}

// ایجاد اطلاعیه
export async function createAnnouncement(data, actor) {
  requireStaff(actor);

  const content = validateAnnouncement(data);
  const now = Date.now();

  return createRecord(PATH, {
    ...content,
    pinned: false,
    archived: false,
    authorUid: actor.uid,
    authorName: cleanText(
      actor.displayName || actor.gameName || "مدیریت",
      80
    ),
    createdAt: now,
    updatedAt: now
  });
}

// دریافت اطلاعیه‌ها
export async function getAnnouncements(options = {}) {
  if (
    !options ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new Error("تنظیمات دریافت اطلاعیه معتبر نیست.");
  }

  const includeArchived = options.includeArchived === true;
  const announcements = await getAllRecords(PATH);

  return announcements
    .filter(item =>
      item &&
      typeof item === "object" &&
      (includeArchived || item.archived !== true)
    )
    .map(normalizeAnnouncement)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return Number(b.pinned) - Number(a.pinned);
      }

      return b.createdAt - a.createdAt;
    });
}

// دریافت یک اطلاعیه
export async function getAnnouncement(id) {
  validateId(id);

  const item = await getRecord(`${PATH}/${id}`);

  return item ? normalizeAnnouncement(item) : null;
}

// ویرایش اطلاعیه
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
  const now = Date.now();

  await updateData(`${PATH}/${id}`, {
    ...content,
    updatedBy: actor.uid,
    updatedAt: now
  });

  return true;
}

// سنجاق کردن اطلاعیه
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

// انتقال به آرشیو
export async function archiveAnnouncement(id, actor) {
  requireStaff(actor);
  validateId(id);

  const existing = await getRecord(`${PATH}/${id}`);

  if (!existing) {
    throw new Error("اطلاعیه پیدا نشد.");
  }

  if (existing.archived === true) {
    throw new Error("این اطلاعیه قبلاً آرشیو شده است.");
  }

  const now = Date.now();

  await updateData(`${PATH}/${id}`, {
    archived: true,
    pinned: false,
    archivedBy: actor.uid,
    archivedAt: now,
    updatedBy: actor.uid,
    updatedAt: now
  });

  return true;
}

// بازگردانی از آرشیو
export async function restoreAnnouncement(id, actor) {
  requireStaff(actor);
  validateId(id);

  const existing = await getRecord(`${PATH}/${id}`);

  if (!existing) {
    throw new Error("اطلاعیه پیدا نشد.");
  }

  if (existing.archived !== true) {
    throw new Error("این اطلاعیه در آرشیو نیست.");
  }

  const now = Date.now();

  await updateData(`${PATH}/${id}`, {
    archived: false,
    restoredBy: actor.uid,
    restoredAt: now,
    updatedBy: actor.uid,
    updatedAt: now
  });

  return true;
}

// حذف دائمی اطلاعیه - فقط ادمین اصلی
export async function removeAnnouncement(id, actor) {
  requireAdmin(actor);
  validateId(id);

  const existing = await getRecord(`${PATH}/${id}`);

  if (!existing) {
    throw new Error("اطلاعیه پیدا نشد.");
  }

  if (existing.archived !== true) {
    throw new Error(
      "برای حذف دائمی، ابتدا اطلاعیه را به آرشیو منتقل کنید."
    );
  }

  await deleteData(`${PATH}/${id}`);

  return true;
    }
                                          
