
export function escapeHTML(value = "") {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };

  return String(value).replace(/[&<>"']/g, char => entities[char]);
}

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function isValidEmail(value) {
  return (
    typeof value === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  );
}

export function formatDate(value, options = {}) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  try {
    return new Intl.DateTimeFormat("fa-IR", {
      calendar: "persian",
      dateStyle: "medium",
      timeStyle: "short",
      ...options
    }).format(date);
  } catch {
    return "—";
  }
}

export function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return new Intl.NumberFormat("fa-IR").format(number);
}

export function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);

    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  throw new Error("مرورگر از تولید شناسه امن پشتیبانی نمی‌کند.");
}

function getDocument() {
  return typeof document !== "undefined" ? document : null;
}

export function setElementText(selector, value) {
  const element = getDocument()?.querySelector(selector);

  if (!element) return false;

  element.textContent = String(value ?? "");
  return true;
}

export function showElement(selector) {
  const element = getDocument()?.querySelector(selector);

  if (!element) return false;

  element.hidden = false;
  return true;
}

export function hideElement(selector) {
  const element = getDocument()?.querySelector(selector);

  if (!element) return false;

  element.hidden = true;
  return true;
}

export function toggleElement(selector, visible) {
  const element = getDocument()?.querySelector(selector);

  if (!element) return false;

  element.hidden = !Boolean(visible);
  return true;
}

export function getElement(selector) {
  return getDocument()?.querySelector(selector) || null;
}

export function getElements(selector) {
  return Array.from(
    getDocument()?.querySelectorAll(selector) || []
  );
}

export function debounce(callback, delay = 300) {
  if (typeof callback !== "function") {
    throw new Error("تابع معتبر نیست.");
  }

  let timeout;

  return (...args) => {
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      callback(...args);
    }, Math.max(0, Number(delay) || 0));
  };
}

export function truncateText(value, maxLength = 100) {
  const text = String(value ?? "");
  const limit = Math.max(0, Number(maxLength) || 0);

  if (text.length <= limit) return text;

  if (limit === 0) return "";

  return text.slice(0, limit).trimEnd() + "…";
}

export function getInitials(value) {
  const words = normalizeText(value).split(" ").filter(Boolean);

  if (!words.length) return "?";

  return words
    .slice(0, 2)
    .map(word => word[0])
    .join("");
}

export function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

export function cloneData(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  if (value === undefined) return undefined;

  return JSON.parse(JSON.stringify(value));
}

export function safeJsonParse(value, fallback = null) {
  if (typeof value !== "string") return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function getErrorMessage(error, fallback = "خطایی رخ داد.") {
  if (
    typeof error?.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

export function sleep(milliseconds = 0) {
  const delay = Math.max(0, Number(milliseconds) || 0);

  return new Promise(resolve => {
    setTimeout(resolve, delay);
  });
                 }
