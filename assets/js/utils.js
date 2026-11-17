
export function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[char];
  });
}

export function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function createId() {
  return crypto.randomUUID();
}

export function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || "").trim()
  );
}

export function setElementText(selector, value) {
  const element = document.querySelector(selector);

  if (element) {
    element.textContent = String(value ?? "");
  }
}

export function showElement(selector) {
  const element = document.querySelector(selector);

  if (element) {
    element.hidden = false;
  }
}

export function hideElement(selector) {
  const element = document.querySelector(selector);

  if (element) {
    element.hidden = true;
  }
}
