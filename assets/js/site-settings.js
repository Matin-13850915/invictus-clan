
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord
} from "./database.js";

import { createId } from "./utils.js";

const SETTINGS_PATH = "siteSettings";
const HISTORY_PATH = "siteSettingsHistory";

export const DEFAULT_SETTINGS = Object.freeze({
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

const BOOLEAN_SETTINGS = new Set([
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
]);

const NUMBER_SETTINGS = Object.freeze({
  maxChatMessageLength: { min: 100, max: 5000 },
  maxForumPostLength: { min: 100, max: 10000 },
  messageEditWindowMinutes: { min: 1, max: 60 }
});

function requireAdmin(actor) {
  if (!actor?.uid || actor.role !== "admin") {
    throw new Error("فقط ادمین اجازه تغییر تنظیمات سایت را دارد.");
  }
}

function validateSetting(key, value) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
    throw new Error("این تنظیم قابل ویرایش نیست.");
  }

  if (BOOLEAN_SETTINGS.has(key)) {
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
    if (typeof value !== "string" || value.trim().length > 1000) {
      throw new Error("متن پیام تعمیرات معتبر نیست.");
    }

    return value.trim();
  }

  throw new Error("این تنظیم قابل ویرایش نیست.");
}

function cleanSavedSettings(saved) {
  const result = { ...DEFAULT_SETTINGS };

  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    return result;
  }

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    try {
      if (saved[key] !== undefined) {
        result[key] = validateSetting(key, saved[key]);
      }
    } catch {
      // مقدار خراب یا قدیمی نادیده گرفته می‌شود.
    }
  }

  return result;
}

export async function getSiteSettings() {
  const saved = await getRecord(SETTINGS_PATH);
  return cleanSavedSettings(saved);
}

export async function getSiteSetting(key) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
    throw new Error("تنظیم موردنظر وجود ندارد.");
  }

  const settings = await getSiteSettings();
  return settings[key];
}

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
    changedAt: now,
    action: "update"
  });

  return validatedValue;
}

export async function updateMultipleSiteSettings(changes, actor) {
  requireAdmin(actor);

  if (
    !changes ||
    typeof changes !== "object" ||
    Array.isArray(changes)
  ) {
    throw new Error("اطلاعات تنظیمات معتبر نیست.");
  }

  const entries = Object.entries(changes);

  if (!entries.length) {
    throw new Error("هیچ تنظیمی برای تغییر ارسال نشده است.");
  }

  const validated = {};

  for (const [key, value] of entries) {
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
      changedAt: now,
      action: "update"
    });
  }

  return {
    ...previous,
    ...validated
  };
}

export async function getSiteSettingsHistory(actor) {
  requireAdmin(actor);

  const history = await getAllRecords(HISTORY_PATH);

  return (Array.isArray(history) ? history : [])
    .sort((a, b) => (b.changedAt || 0) - (a.changedAt || 0));
}

export async function restoreSiteSetting(historyId, actor) {
  requireAdmin(actor);

  if (
    typeof historyId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,150}$/.test(historyId)
  ) {
    throw new Error("شناسه تاریخچه معتبر نیست.");
  }

  const history = await getRecord(`${HISTORY_PATH}/${historyId}`);

  if (!history || typeof history.key !== "string") {
    throw new Error("نسخه موردنظر پیدا نشد.");
  }

  return updateSiteSetting(
    history.key,
    history.previousValue,
    actor
  );
        }
  
