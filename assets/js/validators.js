
const ROLES = ["admin", "leader", "tester", "member"];
const SPECIALTIES = ["MP", "BR"];
const APPLICATION_TYPES = ["MP", "BR", "BOTH"];

export function required(value) {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim().length > 0
  );
}

export function validEmail(email) {
  return (
    typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}

export function validPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128
  );
}

export function validUsername(username) {
  return /^[a-zA-Z0-9_.-]{3,24}$/.test(
    String(username ?? "").trim()
  );
}

export function validGameName(name) {
  const value = String(name ?? "").trim();
  return value.length >= 2 && value.length <= 40;
}

export function validGameUid(uid) {
  return /^[0-9]{5,30}$/.test(
    String(uid ?? "").trim()
  );
}

export function validGameLevel(level) {
  const number = Number(level);

  return (
    level !== "" &&
    level !== null &&
    level !== undefined &&
    Number.isInteger(number) &&
    number >= 1 &&
    number <= 500
  );
}

export function validRank(rank, allowedRanks = []) {
  return (
    Array.isArray(allowedRanks) &&
    typeof rank === "string" &&
    allowedRanks.includes(rank)
  );
}

export function validSpecialty(specialty) {
  return SPECIALTIES.includes(specialty);
}

export function validApplicationType(type) {
  return APPLICATION_TYPES.includes(type);
}

export function validRole(role) {
  return ROLES.includes(role);
}

export function validDate(value) {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime());
}

export function validPositiveNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return false;
  }

  const number = Number(value);

  return Number.isFinite(number) && number > 0;
}

export function validNonNegativeNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return false;
  }

  const number = Number(value);

  return Number.isFinite(number) && number >= 0;
}

export function validNumberRange(value, min, max) {
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(min)) ||
    !Number.isFinite(Number(max)) ||
    Number(min) > Number(max)
  ) {
    return false;
  }

  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= Number(min) &&
    number <= Number(max)
  );
}

export function validTextLength(value, min = 1, max = 1000) {
  if (
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min < 0 ||
    max < min
  ) {
    return false;
  }

  const text = String(value ?? "").trim();

  return text.length >= min && text.length <= max;
}

export function validUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value.trim());

    return (
      ["http:", "https:"].includes(url.protocol) &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function validPhone(value) {
  const phone = String(value ?? "").replace(/[\s-]/g, "");

  return /^\+?[0-9]{8,15}$/.test(phone);
}

export function validTelegramUsername(value) {
  return /^@?[a-zA-Z0-9_]{5,32}$/.test(
    String(value ?? "").trim()
  );
}

export function validChatMessage(value) {
  const text = String(value ?? "").trim();

  return (
    text.length >= 1 &&
    text.length <= 2000 &&
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)
  );
}

export function validId(value) {
  return (
    typeof value === "string" &&
    /^[a-zA-Z0-9_-]{1,128}$/.test(value)
  );
}

export function validTimestamp(value) {
  const number = Number(value);

  return (
    Number.isSafeInteger(number) &&
    number > 0
  );
}

export function validApplicationStatus(status) {
  return [
    "pending",
    "awaiting_tester",
    "awaiting_test",
    "testing",
    "test_completed",
    "awaiting_leader",
    "retest_requested",
    "accepted",
    "rejected",
    "withdrawn",
    "expired"
  ].includes(status);
}

export function validChatRoomType(type) {
  return [
    "general",
    "attachment",
    "custom",
    "staff"
  ].includes(type);
    }
