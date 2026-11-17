
import {
  getRecord,
  updateRecord
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

function requireUser(actor) {
  if (!actor?.uid) {
    throw new Error("ابتدا وارد حساب خود شوید.");
  }
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

  for (const key of [
    "compactMode",
    "showOnlineStatus",
    "showProfileToMembers"
  ]) {
    if (changes[key] !== undefined) {
      if (typeof changes[key] !== "boolean") {
        throw new Error(`مقدار ${key} باید روشن یا خاموش باشد.`);
      }

      result[key] = changes[key];
    }
  }

  if (changes.notifications !== undefined) {
    if (
      !changes.notifications ||
      typeof changes.notifications !== "object" ||
      Array.isArray(changes.notifications)
    ) {
      throw new Error("تنظیمات اعلان معتبر نیست.");
    }

    const allowed = Object.keys(DEFAULT_PREFERENCES.notifications);
    result.notifications = {};

    for (const key of allowed) {
      if (changes.notifications[key] !== undefined) {
        if (typeof changes.notifications[key] !== "boolean") {
          throw new Error(`تنظیم اعلان ${key} معتبر نیست.`);
        }

        result.notifications[key] = changes.notifications[key];
      }
    }

    const unknownKeys = Object.keys(changes.notifications)
      .filter(key => !allowed.includes(key));

    if (unknownKeys.length > 0) {
      throw new Error("یکی از تنظیمات اعلان ناشناخته است.");
    }
  }

  return result;
}

// دریافت تنظیمات شخصی
export async function getUserPreferences(actor) {
  requireUser(actor);

  const saved = await getRecord(
    `${PREFERENCES_PATH}/${actor.uid}`
  );

  return {
    ...DEFAULT_PREFERENCES,
    ...(saved || {}),
    notifications: {
      ...DEFAULT_PREFERENCES.notifications,
      ...(saved?.notifications || {})
    }
  };
}

// ذخیره تنظیمات شخصی
export async function updateUserPreferences(changes, actor) {
  requireUser(actor);

  const validated = validatePreferences(changes);

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

  await updateRecord(
    `${PREFERENCES_PATH}/${actor.uid}`,
    updated
  );

  return updated;
}

// تغییر قالب نمایش
export async function setUserTheme(theme, actor) {
  return updateUserPreferences({ theme }, actor);
}

// روشن یا خاموش کردن یک نوع اعلان
export async function setNotificationPreference(
  type,
  enabled,
  actor
) {
  if (typeof enabled !== "boolean") {
    throw new Error("وضعیت اعلان معتبر نیست.");
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      DEFAULT_PREFERENCES.notifications,
      type
    )
  ) {
    throw new Error("نوع اعلان معتبر نیست.");
  }

  return updateUserPreferences({
    notifications: {
      [type]: enabled
    }
  }, actor);
}

// بازگردانی تنظیمات به حالت پیش‌فرض
export async function resetUserPreferences(actor) {
  requireUser(actor);

  const defaults = {
    ...DEFAULT_PREFERENCES,
    notifications: {
      ...DEFAULT_PREFERENCES.notifications
    },
    updatedAt: Date.now()
  };

  await updateRecord(
    `${PREFERENCES_PATH}/${actor.uid}`,
    defaults
  );

  return defaults;
}
