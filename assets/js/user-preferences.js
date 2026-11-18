
import {
  db,
  ref,
  get,
  runTransaction
} from "./firebase.js";

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
    !/^[A-Za-z0-9_-]{1,128}$/.test(actor.uid)
  ) {
    throw new Error("ابتدا وارد حساب معتبر خود شوید.");
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

  if (
    Object.keys(changes).some(
      key => !allowedKeys.includes(key)
    )
  ) {
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

  const savedNotifications =
    saved.notifications &&
    typeof saved.notifications === "object" &&
    !Array.isArray(saved.notifications)
      ? saved.notifications
      : {};

  const notifications = {
    ...defaults.notifications
  };

  for (const key of NOTIFICATION_KEYS) {
    if (typeof savedNotifications[key] === "boolean") {
      notifications[key] = savedNotifications[key];
    }
  }

  return {
    ...defaults,
    theme: ["dark", "light", "system"].includes(saved.theme)
      ? saved.theme
      : defaults.theme,
    compactMode:
      typeof saved.compactMode === "boolean"
        ? saved.compactMode
        : defaults.compactMode,
    showOnlineStatus:
      typeof saved.showOnlineStatus === "boolean"
        ? saved.showOnlineStatus
        : defaults.showOnlineStatus,
    showProfileToMembers:
      typeof saved.showProfileToMembers === "boolean"
        ? saved.showProfileToMembers
        : defaults.showProfileToMembers,
    notifications
  };
}

export async function getUserPreferences(actor) {
  requireUser(actor);

  const snapshot = await get(
    ref(db, `${PREFERENCES_PATH}/${actor.uid}`)
  );

  return mergePreferences(
    snapshot.exists() ? snapshot.val() : null
  );
}

export async function updateUserPreferences(changes, actor) {
  requireUser(actor);

  const validated = validatePreferences(changes);

  if (!Object.keys(validated).length) {
    throw new Error("تغییری برای ذخیره وجود ندارد.");
  }

  const preferencesRef = ref(
    db,
    `${PREFERENCES_PATH}/${actor.uid}`
  );

  const result = await runTransaction(
    preferencesRef,
    currentValue => {
      const current = mergePreferences(currentValue);

      return {
        ...current,
        ...validated,
        notifications: {
          ...current.notifications,
          ...(validated.notifications || {})
        },
        updatedAt: Date.now()
      };
    }
  );

  if (!result.committed) {
    throw new Error("ذخیره تنظیمات انجام نشد.");
  }

  return mergePreferences(result.snapshot.val());
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

  const preferencesRef = ref(
    db,
    `${PREFERENCES_PATH}/${actor.uid}`
  );

  const defaults = cloneDefaults();

  const result = await runTransaction(
    preferencesRef,
    () => ({
      ...defaults,
      updatedAt: Date.now()
    })
  );

  if (!result.committed) {
    throw new Error("بازنشانی تنظیمات انجام نشد.");
  }

  return mergePreferences(result.snapshot.val());
    }
  
