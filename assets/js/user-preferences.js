
import {
  getRecord,
  updateRecord,
  writeData
} from "./database.js";

const PREFERENCES_PATH = "userPreferences";

export const DEFAULT_PREFERENCES = Object.freeze({
  theme: "dark",
  compactMode: false,
  showOnlineStatus: true,
  showProfileToMembers: true,
  notifications: {
    announcements: true,
    wars: true,
    applications: true,
    messages: true,
    rewards: true,
    tournaments: true,
    support: true
  }
});

const BOOLEAN_KEYS = Object.freeze([
  "compactMode",
  "showOnlineStatus",
  "showProfileToMembers"
]);

const NOTIFICATION_KEYS = Object.freeze(
  Object.keys(DEFAULT_PREFERENCES.notifications)
);

function requireUser(actor) {
  if (
    !actor ||
    typeof actor.uid !== "string" ||
    !actor.uid.trim()
  ) {
    throw new Error("ابتدا وارد حساب خود شوید.");
  }
}

function cloneDefaults() {
  return {
    ...DEFAULT_PREFERENCES,
    notifications: {
      ...DEFAULT_PREFERENCES.notifications
    }
  };
}

function validatePreferences(changes) {
  if (
    !changes ||
    typeof changes !== "object" ||
    Array.isArray(changes)
  ) {
    throw new Error("تنظیمات واردشده معتبر نیست.");
  }

  const result = {};

  if (changes.theme !== undefined) {
    if (!["dark", "light", "system"].includes(changes.theme)) {
      throw new Error("قالب انتخاب‌شده معتبر نیست.");
    }

    result.theme = changes.theme;
  }

  for (const key of BOOLEAN_KEYS) {
    if (changes[key] !== undefined) {
      if (typeof changes[key] !== "boolean") {
        throw new Error(`مقدار ${key} معتبر نیست.`);
      }

      result[key] = changes[key];
    }
  }

  if (changes.notifications !== undefined) {
    const notifications = changes.notifications;

    if (
      !notifications ||
      typeof notifications !== "object" ||
      Array.isArray(notifications)
    ) {
      throw new Error("تنظیمات اعلان معتبر نیست.");
    }

    const unknownKeys = Object.keys(notifications)
      .filter(key => !NOTIFICATION_KEYS.includes(key));

    if (unknownKeys.length) {
      throw new Error("نوع اعلان ناشناخته است.");
    }

    result.notifications = {};

    for (const key of NOTIFICATION_KEYS) {
      if (notifications[key] !== undefined) {
        if (typeof notifications[key] !== "boolean") {
          throw new Error(`وضعیت اعلان ${key} معتبر نیست.`);
        }

        result.notifications[key] = notifications[key];
      }
    }
  }

  const allowedKeys = [
    "theme",
    ...BOOLEAN_KEYS,
    "notifications"
  ];

  const unknownChanges = Object.keys(changes)
    .filter(key => !allowedKeys.includes(key));

  if (unknownChanges.length) {
    throw new Error("یکی از تنظیمات ناشناخته است.");
  }

  return result;
}

function mergePreferences(saved) {
  const defaults = cloneDefaults();

  if (
    !saved ||
    typeof saved !== "object" ||
    Array.isArray(saved)
  ) {
    return defaults;
  }

  return {
    ...defaults,
    ...saved,
    notifications: {
      ...defaults.notifications,
      ...(saved.notifications &&
      typeof saved.notifications === "object" &&
      !Array.isArray(saved.notifications)
        ? saved.notifications
        : {})
    }
  };
}

export async function getUserPreferences(actor) {
  requireUser(actor);

  const saved = await getRecord(
    `${PREFERENCES_PATH}/${actor.uid}`
  );

  return mergePreferences(saved);
}

export async function updateUserPreferences(changes, actor) {
  requireUser(actor);

  const validated = validatePreferences(changes);

  if (!Object.keys(validated).length) {
    throw new Error("تغییری برای ذخیره وجود ندارد.");
  }

  const current = await getUserPreferences(actor);

  const updated = {
    ...current,
    ...validated,
    notifications: {
      ...current.notifications,
      ...(validated.notifications || {})
    },
    updatedAt: Date.now()
  };

  await writeData(
    `${PREFERENCES_PATH}/${actor.uid}`,
    updated
  );

  return updated;
}

export async function setUserTheme(theme, actor) {
  return updateUserPreferences({ theme }, actor);
}

export async function setNotificationPreference(
  type,
  enabled,
  actor
) {
  if (!NOTIFICATION_KEYS.includes(type)) {
    throw new Error("نوع اعلان معتبر نیست.");
  }

  if (typeof enabled !== "boolean") {
    throw new Error("وضعیت اعلان معتبر نیست.");
  }

  return updateUserPreferences({
    notifications: {
      [type]: enabled
    }
  }, actor);
}

export async function resetUserPreferences(actor) {
  requireUser(actor);

  const defaults = {
    ...cloneDefaults(),
    updatedAt: Date.now()
  };

  await writeData(
    `${PREFERENCES_PATH}/${actor.uid}`,
    defaults
  );

  return defaults;
  }
