
const PREFIX = "invictus_";

function validateKey(key) {
  if (
    typeof key !== "string" ||
    !/^[a-zA-Z0-9_.-]{1,100}$/.test(key)
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

export function saveLocal(key, value) {
  const storageKey = validateKey(key);
  const storage = getStorage();

  try {
    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
      throw new Error("اطلاعات قابل ذخیره‌سازی نیست.");
    }

    storage.setItem(storageKey, serialized);
    return true;
  } catch (error) {
    if (error?.name === "QuotaExceededError") {
      throw new Error("فضای ذخیره‌سازی دستگاه پر شده است.");
    }

    throw new Error(
      error?.message || "ذخیره‌سازی محلی انجام نشد."
    );
  }
}

export function readLocal(key, fallback = null) {
  if (
    typeof key !== "string" ||
    !/^[a-zA-Z0-9_.-]{1,100}$/.test(key)
  ) {
    return fallback;
  }

  try {
    const value = getStorage().getItem(PREFIX + key);

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
  const storageKey = validateKey(key);

  try {
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
  if (typeof updater !== "function") {
    throw new Error("تابع به‌روزرسانی معتبر نیست.");
  }

  const current = readLocal(key, fallback);
  const updated = updater(current);

  saveLocal(key, updated);

  return updated;
}
  
