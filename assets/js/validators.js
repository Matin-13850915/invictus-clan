
export function required(value) {
  return String(value ?? "").trim().length > 0;
}

export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || "").trim()
  );
}

export function validPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

export function validUsername(username) {
  return /^[a-zA-Z0-9_.-]{3,24}$/.test(
    String(username || "").trim()
  );
}

export function validGameName(name) {
  const value = String(name || "").trim();

  return value.length >= 2 && value.length <= 40;
}

export function validGameLevel(level) {
  const number = Number(level);

  return Number.isInteger(number) && number >= 1 && number <= 500;
}

export function validRank(rank, allowedRanks = []) {
  return allowedRanks.includes(rank);
}

export function validSpecialty(specialty) {
  return ["MP", "BR"].includes(specialty);
}

export function validApplicationType(type) {
  return ["MP", "BR", "BOTH"].includes(type);
}

export function validRole(role) {
  return ["admin", "leader", "tester", "member"].includes(role);
}

export function validDate(value) {
  const date = new Date(value);

  return !Number.isNaN(date.getTime());
}

export function validPositiveNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0;
}

export function validNonNegativeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0;
}

export function validTextLength(value, min = 1, max = 1000) {
  const text = String(value ?? "").trim();

  return text.length >= min && text.length <= max;
}

export function validUrl(value) {
  try {
    const url = new URL(value);

    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}
