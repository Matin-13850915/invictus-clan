
import {
  createRecord,
  getRecord,
  updateRecord
} from "./database.js";

import { createId } from "./utils.js";

const SETTINGS_PATH = "siteSettings";
const HISTORY_PATH = "siteSettingsHistory";

const DEFAULT_SETTINGS = Object.freeze({
  maintenanceMode: false,
  maintenanceMessage: "سایت موقتاً در دست تعمیر است.",
  applicationsEnabled: true,
  announcementsEnabled: true,
  warsEnabled: true,
  rankingsEnabled: true,
  forumEnabled: true,
  generalChatEnabled: true,
  peivastChatEnabled: true,
  customRoomsEnabled: true,
  privateMessagesEnabled: true,
  supportEnabled: true,
  rewardsShopEnabled: true,
  tournamentsEnabled: true,
  teamsEnabled: true,
  notificationsEnabled: true,
  memberApplicationsEnabled: true,
  maxChatMessageLength: 1000,
  maxForumPostLength: 5000,
  messageEditWindowMinutes: 15
});

const BOOLEAN_SETTINGS = [
  "maintenanceMode",
  "applicationsEnabled",
  "announcementsEnabled",
  "warsEnabled",
  "rankingsEnabled",
  "forumEnabled",
  "generalChatEnabled",
  "peivastChatEnabled",
  "customRoomsEnabled",
  "privateMessagesEnabled",
  "supportEnabled",
  "rewardsShopEnabled",
  "tournamentsEnabled",
  "teamsEnabled",
  "notificationsEnabled",
  "memberApplicationsEnabled"
];

const NUMBER_SETTINGS = {
  maxChatMessageLength: { min: 100, max: 5000 },
  maxForumPostLength: { min: 100, max: 10000 },
  messageEditWindowMinutes: { min: 1, max: 60 }
};

function requireAdmin(actor) {
  if (!actor?.uid || actor.role !== "admin") {
    throw new Error("فقط ادمین اجازه تغییر تنظیمات سایت را دارد.");
  }
}

function validateSetting(key, value) {
  if (BOOLEAN_SETTINGS.includes(key)) {
    if (typeof value !== "boolean") {
      throw new Error(`مقدار تنظیم ${key} باید روشن یا خاموش باشد.`);
    }

    return value;
  }

  if (NUMBER_SETTINGS[key]) {
    const { min, max } = NUMBER_SETTINGS[key];

    if (
      !Number.isInteger(value) ||
      value < min ||
      value > max
    ) {
      throw new Error(`مقدار تنظیم ${key} خارج از محدوده مجاز است.`);
    }

    return value;
  }

  if (key === "maintenanceMessage") {
    if (typeof value !== "string" || value.length > 1000) {
      throw new Error("متن پیام تعمیرات معتبر نیست.");
    }

    return value.trim();
  }

  throw new Error("این تنظیم قابل ویرایش نیست.");
}

// دریافت تنظیمات
export async function getSiteSettings() {
  const saved = await getRecord(SETTINGS_PATH);

  return {
    ...DEFAULT_SETTINGS,
    ...(saved || {})
  };
}

// دریافت مقدار یک تنظیم
export async function getSiteSetting(key) {
  const settings = await getSiteSettings();

  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
    throw new Error("تنظیم موردنظر وجود ندارد.");
  }

  return settings[key];
}

// تغییر یک تنظیم
export async function updateSiteSetting(key, value, actor) {
  requireAdmin(actor);

  const validatedValue = validateSetting(key, value);
  const previous = await getSiteSetting(key);
  const now = Date.now();

  await updateRecord(SETTINGS_PATH, {
    [key]: validatedValue,
    updatedAt: now,
    updatedBy: actor.uid
  });

  await createRecord(HISTORY_PATH, {
    id: createId(),
    key,
    previousValue: previous,
    newValue: validatedValue,
    changedBy: actor.uid,
    changedAt: now
  });

  return validatedValue;
}

// تغییر چند تنظیم با هم
export async function updateMultipleSiteSettings(changes, actor) {
  requireAdmin(actor);

  if (
    !changes ||
    typeof changes !== "object" ||
    Array.isArray(changes)
  ) {
    throw new Error("اطلاعات تنظیمات معتبر نیست.");
  }

  const validated = {};

  for (const [key, value] of Object.entries(changes)) {
    validated[key] = validateSetting(key, value);
  }

  const previous = await getSiteSettings();
  const now = Date.now();

  await updateRecord(SETTINGS_PATH, {
    ...validated,
    updatedAt: now,
    updatedBy: actor.uid
  });

  for (const [key, value] of Object.entries(validated)) {
    await createRecord(HISTORY_PATH, {
      id: createId(),
      key,
      previousValue: previous[key],
      newValue: value,
      changedBy: actor.uid,
      changedAt: now
    });
  }

  return {
    ...previous,
    ...validated,
    updatedAt: now,
    updatedBy: actor.uid
  };
}

// دریافت تاریخچه تنظیمات
export async function getSiteSettingsHistory(actor) {
  requireAdmin(actor);

  const { getAllRecords } = await import("./database.js");
  const history = await getAllRecords(HISTORY_PATH);

  return history.sort(
    (a, b) => (b.changedAt || 0) - (a.changedAt || 0)
  );
}

// بازگردانی تنظیم به مقدار قبلی
export async function restoreSiteSetting(historyId, actor) {
  requireAdmin(actor);

  const history = await getRecord(`${HISTORY_PATH}/${historyId}`);

  if (!history) {
    throw new Error("نسخه موردنظر پیدا نشد.");
  }

  return updateSiteSetting(
    history.key,
    history.previousValue,
    actor
  );
}

export { DEFAULT_SETTINGS };
        
