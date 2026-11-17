
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord
} from "./database.js";

import { canEditSiteContent } from "./permissions.js";

const CONTENT_PATH = "siteContent";
const HISTORY_PATH = "siteContentHistory";
const MAX_TEXT_LENGTH = 10000;

function requireAdmin(actor) {
  if (!canEditSiteContent(actor)) {
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
  if (
    typeof value !== "string" ||
    value.length > MAX_TEXT_LENGTH
  ) {
    throw new Error("محتوا باید متن معتبر و حداکثر ۱۰۰۰۰ کاراکتر باشد.");
  }

  return value;
}

function validateHistoryId(id) {
  if (
    typeof id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,150}$/.test(id)
  ) {
    throw new Error("شناسه تاریخچه معتبر نیست.");
  }

  return id;
}

export async function getSiteContent(key) {
  validateKey(key);

  const item = await getRecord(`${CONTENT_PATH}/${key}`);

  if (!item || item.deleted === true) {
    return null;
  }

  return item;
}

export async function getSiteContents(keys = []) {
  if (!Array.isArray(keys) || keys.length > 100) {
    throw new Error("فهرست شناسه‌ها معتبر نیست.");
  }

  const result = {};

  for (const key of [...new Set(keys)]) {
    validateKey(key);
    result[key] = await getSiteContent(key);
  }

  return result;
}

async function writeHistory(history) {
  return createRecord(HISTORY_PATH, {
    ...history,
    createdAt: Date.now()
  });
}

export async function saveSiteContent(key, value, actor) {
  requireAdmin(actor);

  validateKey(key);
  const content = validateText(value);

  const path = `${CONTENT_PATH}/${key}`;
  const previous = await getRecord(path);

  const now = Date.now();
  const version = Number(previous?.version || 0) + 1;

  if (!Number.isSafeInteger(version)) {
    throw new Error("شماره نسخه محتوا معتبر نیست.");
  }

  const record = {
    key,
    value: content,
    deleted: false,
    updatedAt: now,
    updatedBy: actor.uid,
    version,
    createdAt: previous?.createdAt || now,
    createdBy: previous?.createdBy || actor.uid
  };

  const history = {
    contentKey: key,
    previousValue: previous?.deleted
      ? ""
      : previous?.value ?? null,
    newValue: content,
    changedBy: actor.uid,
    changedAt: now,
    action: previous ? "update" : "create",
    version
  };

  await updateRecord(path, record);

  try {
    await writeHistory(history);
  } catch (error) {
    throw new Error(
      "محتوا ذخیره شد، اما ثبت تاریخچه ناموفق بود. قبل از تلاش مجدد وضعیت محتوا را بررسی کنید."
    );
  }

  return record;
}

export async function restoreSiteContent(key, historyId, actor) {
  requireAdmin(actor);

  validateKey(key);
  validateHistoryId(historyId);

  const history = await getRecord(
    `${HISTORY_PATH}/${historyId}`
  );

  if (!history || history.contentKey !== key) {
    throw new Error("نسخه موردنظر پیدا نشد.");
  }

  if (typeof history.previousValue !== "string") {
    throw new Error("محتوای قبلی برای بازگردانی موجود نیست.");
  }

  return saveSiteContent(
    key,
    history.previousValue,
    actor
  );
}

export async function getSiteContentHistory(key, actor) {
  requireAdmin(actor);
  validateKey(key);

  const records = await getAllRecords(HISTORY_PATH);

  return (Array.isArray(records) ? records : [])
    .filter(item => item?.contentKey === key)
    .sort(
      (a, b) =>
        Number(b.changedAt || 0) -
        Number(a.changedAt || 0)
    );
}

export async function deleteSiteContent(key, actor) {
  requireAdmin(actor);
  validateKey(key);

  const path = `${CONTENT_PATH}/${key}`;
  const previous = await getRecord(path);

  if (!previous || previous.deleted === true) {
    return false;
  }

  const now = Date.now();
  const version = Number(previous.version || 0) + 1;

  const history = {
    contentKey: key,
    previousValue: previous.value ?? "",
    newValue: "",
    changedBy: actor.uid,
    changedAt: now,
    action: "delete",
    version
  };

  await updateRecord(path, {
    ...previous,
    value: "",
    deleted: true,
    updatedAt: now,
    updatedBy: actor.uid,
    version
  });

  try {
    await writeHistory(history);
  } catch (error) {
    throw new Error(
      "محتوا حذف شد، اما ثبت تاریخچه ناموفق بود."
    );
  }

  return true;
}

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
