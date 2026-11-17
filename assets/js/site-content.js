
import {
  createRecord,
  getRecord,
  updateRecord
} from "./database.js";

import { createId } from "./utils.js";

const CONTENT_PATH = "siteContent";
const HISTORY_PATH = "siteContentHistory";

const MAX_TEXT_LENGTH = 10000;

function requireAdmin(actor) {
  if (!actor?.uid || actor.role !== "admin") {
    throw new Error("فقط ادمین اجازه ویرایش محتوای سایت را دارد.");
  }
}

function validateKey(key) {
  if (
    typeof key !== "string" ||
    !/^[a-zA-Z0-9_-]{2,100}$/.test(key)
  ) {
    throw new Error("شناسه محتوای سایت معتبر نیست.");
  }

  return key;
}

function validateText(value) {
  if (typeof value !== "string") {
    throw new Error("محتوا باید متن باشد.");
  }

  if (value.length > MAX_TEXT_LENGTH) {
    throw new Error("طول محتوا بیش از حد مجاز است.");
  }

  return value;
}

// دریافت یک محتوای مشخص
export async function getSiteContent(key) {
  validateKey(key);

  const item = await getRecord(`${CONTENT_PATH}/${key}`);

  return item || null;
}

// دریافت چند محتوای مشخص
export async function getSiteContents(keys = []) {
  if (!Array.isArray(keys)) {
    throw new Error("فهرست شناسه‌ها معتبر نیست.");
  }

  const result = {};

  for (const key of keys) {
    validateKey(key);
    result[key] = await getSiteContent(key);
  }

  return result;
}

// ثبت محتوای جدید یا ویرایش محتوای قبلی
export async function saveSiteContent(key, value, actor) {
  requireAdmin(actor);

  validateKey(key);
  const content = validateText(value);

  const previous = await getSiteContent(key);
  const now = Date.now();

  const record = {
    key,
    value: content,
    updatedAt: now,
    updatedBy: actor.uid,
    version: (previous?.version || 0) + 1
  };

  if (!previous) {
    record.createdAt = now;
    record.createdBy = actor.uid;
  }

  await updateRecord(`${CONTENT_PATH}/${key}`, record);

  const history = {
    id: createId(),
    contentKey: key,
    previousValue: previous?.value ?? null,
    newValue: content,
    changedBy: actor.uid,
    changedAt: now,
    version: record.version
  };

  await createRecord(HISTORY_PATH, history);

  return record;
}

// بازگردانی نسخه قبلی محتوا
export async function restoreSiteContent(
  key,
  historyId,
  actor
) {
  requireAdmin(actor);

  validateKey(key);

  const history = await getRecord(
    `${HISTORY_PATH}/${historyId}`
  );

  if (!history || history.contentKey !== key) {
    throw new Error("نسخه موردنظر پیدا نشد.");
  }

  if (typeof history.previousValue !== "string") {
    throw new Error("این نسخه محتوای قبلی قابل‌بازگردانی ندارد.");
  }

  return saveSiteContent(
    key,
    history.previousValue,
    actor
  );
}

// دریافت نسخه‌های قبلی یک محتوا
export async function getSiteContentHistory(key, actor) {
  requireAdmin(actor);

  validateKey(key);

  const { getAllRecords } = await import("./database.js");
  const records = await getAllRecords(HISTORY_PATH);

  return records
    .filter(item => item.contentKey === key)
    .sort((a, b) => (b.changedAt || 0) - (a.changedAt || 0));
}

// حذف محتوای ثبت‌شده
export async function deleteSiteContent(key, actor) {
  requireAdmin(actor);

  validateKey(key);

  const previous = await getSiteContent(key);

  if (!previous) {
    return false;
  }

  const now = Date.now();

  await updateRecord(`${CONTENT_PATH}/${key}`, {
    value: "",
    deleted: true,
    updatedAt: now,
    updatedBy: actor.uid,
    version: (previous.version || 0) + 1
  });

  await createRecord(HISTORY_PATH, {
    id: createId(),
    contentKey: key,
    previousValue: previous.value ?? "",
    newValue: "",
    changedBy: actor.uid,
    changedAt: now,
    action: "delete",
    version: (previous.version || 0) + 1
  });

  return true;
}

// فهرست شناسه‌های پیشنهادی برای بخش‌های سایت
export const SITE_CONTENT_KEYS = Object.freeze([
  "home_title",
  "home_description",
  "home_welcome",
  "clan_motto",
  "about_title",
  "about_description",
  "footer_text",
  "rules_title",
  "rules_content",
  "recruitment_title",
  "recruitment_description",
  "announcements_title",
  "wars_title",
  "rankings_title",
  "forum_title",
  "support_title",
  "contact_text",
  "maintenance_message"
]);
