
const PREFIX = "invictus_";
const MAX_KEY_LENGTH = 100;
const MAX_VALUE_SIZE = 2 * 1024 * 1024;

function validateKey(key) {
  if (
    typeof key !== "string" ||
    key.length < 1 ||
    key.length > MAX_KEY_LENGTH ||
    !/^[a-zA-Z0-9_.-]+$/.test(key)
  ) {
    throw new Error("کلید ذخیره‌سازی معتبر نیست.");
  }

  return PREFIX + key;
}

function getStorage() {
  try {
    if (typeof localStorage === "undefined") {
      throw new Error("LocalStorage در دسترس نیست.");
    }

    return localStorage;
  } catch {
    throw new Error("ذخیره‌سازی محلی در دسترس نیست.");
  }
}

function serialize(value) {
  let serialized;

  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error("اطلاعات قابل تبدیل به JSON نیست.");
  }

  if (serialized === undefined) {
    throw new Error("اطلاعات قابل ذخیره‌سازی نیست.");
  }

  if (serialized.length > MAX_VALUE_SIZE) {
    throw new Error("حجم اطلاعات برای ذخیره‌سازی محلی بیش از حد مجاز است.");
  }

  return serialized;
}

export function saveLocal(key, value) {
  const storageKey = validateKey(key);
  const storage = getStorage();
  const serialized = serialize(value);

  try {
    storage.setItem(storageKey, serialized);
    return true;
  } catch (error) {
    if (
      error?.name === "QuotaExceededError" ||
      error?.name === "NS_ERROR_DOM_QUOTA_REACHED"
    ) {
      throw new Error("فضای ذخیره‌سازی دستگاه پر شده است.");
    }

    throw new Error("ذخیره‌سازی محلی انجام نشد.");
  }
}

export function readLocal(key, fallback = null) {
  let storageKey;

  try {
    storageKey = validateKey(key);
  } catch {
    return fallback;
  }

  try {
    const value = getStorage().getItem(storageKey);

    if (value === null) return fallback;

    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function removeLocal(key) {
  const storageKey = validateKey(key);
  getStorage().removeItem(storageKey);
  return true;
}

export function hasLocal(key) {
  let storageKey;

  try {
    storageKey = validateKey(key);
    return getStorage().getItem(storageKey) !== null;
  } catch {
    return false;
  }
}

export function clearInvictusLocal() {
  const storage = getStorage();
  const keys = [];

  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);

    if (key?.startsWith(PREFIX)) {
      keys.push(key);
    }
  }

  for (const key of keys) {
    storage.removeItem(key);
  }

  return keys.length;
}

export function getLocalKeys() {
  const storage = getStorage();
  const keys = [];

  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);

    if (key?.startsWith(PREFIX)) {
      keys.push(key.slice(PREFIX.length));
    }
  }

  return keys;
}

export function getLocalSize() {
  const storage = getStorage();
  let total = 0;

  for (const key of getLocalKeys()) {
    const value = storage.getItem(PREFIX + key);
    total += (key.length + (value || "").length) * 2;
  }

  return total;
}

export function updateLocal(key, updater, fallback = null) {
  validateKey(key);

  if (typeof updater !== "function") {
    throw new Error("تابع به‌روزرسانی معتبر نیست.");
  }

  const current = readLocal(key, fallback);
  const updated = updater(current);

  saveLocal(key, updated);

  return updated;
}
