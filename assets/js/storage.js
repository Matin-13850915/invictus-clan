
const PREFIX = "invictus_";

export function saveLocal(key, value) {
  if (!key) throw new Error("کلید ذخیره‌سازی معتبر نیست.");

  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify(value)
    );

    return true;
  } catch {
    throw new Error("ذخیره‌سازی محلی انجام نشد.");
  }
}

export function readLocal(key, fallback = null) {
  if (!key) return fallback;

  try {
    const value = localStorage.getItem(PREFIX + key);

    if (value === null) return fallback;

    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function removeLocal(key) {
  if (!key) return;

  localStorage.removeItem(PREFIX + key);
}

export function clearInvictusLocal() {
  const keys = [];

  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);

    if (key && key.startsWith(PREFIX)) {
      keys.push(key);
    }
  }

  keys.forEach(key => localStorage.removeItem(key));
}

export function hasLocal(key) {
  return localStorage.getItem(PREFIX + key) !== null;
}
