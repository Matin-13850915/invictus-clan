
import {
  getRecord,
  updateRecord,
  createRecord,
  getAllRecords
} from "./database.js";

const VERSION_PATH = "system/version";
const HISTORY_PATH = "system/versionHistory";

function requireAdmin(actor) {
  if (!actor?.uid || actor.role !== "admin") {
    throw new Error("فقط ادمین اجازه مدیریت نسخه سایت را دارد.");
  }
}

function cleanText(value, maxLength, field) {
  if (typeof value !== "string") {
    throw new Error(`${field} معتبر نیست.`);
  }

  const result = value.trim();

  if (!result || result.length > maxLength) {
    throw new Error(`${field} باید بین ۱ تا ${maxLength} کاراکتر باشد.`);
  }

  return result;
}

export function validateVersion(version) {
  if (
    typeof version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(version.trim())
  ) {
    throw new Error("نسخه باید به شکل 1.0.0 باشد.");
  }

  return version.trim();
}

export function compareVersions(first, second) {
  const a = validateVersion(first).split(".").map(Number);
  const b = validateVersion(second).split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }

  return 0;
}

export async function getCurrentVersion() {
  return await getRecord(VERSION_PATH);
}

export async function publishVersion(data, actor) {
  requireAdmin(actor);

  if (!data || typeof data !== "object") {
    throw new Error("اطلاعات انتشار معتبر نیست.");
  }

  const version = validateVersion(data.version);
  const title = cleanText(data.title, 100, "عنوان");
  const notes = cleanText(data.notes, 3000, "توضیحات");

  const current = await getCurrentVersion();

  if (current?.version === version) {
    throw new Error("این نسخه قبلاً منتشر شده است.");
  }

  if (
    current?.version &&
    compareVersions(version, current.version) <= 0
  ) {
    throw new Error("شماره نسخه جدید باید از نسخه فعلی بالاتر باشد.");
  }

  const release = {
    version,
    title,
    notes,
    publishedAt: Date.now(),
    publishedBy: actor.uid
  };

  const historyId = `release_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  await createRecord(`${HISTORY_PATH}/${historyId}`, {
    ...release,
    id: historyId
  });

  await updateRecord(VERSION_PATH, release);

  return release;
}

export async function getVersionHistory(actor) {
  requireAdmin(actor);

  const history = await getAllRecords(HISTORY_PATH);

  return (Array.isArray(history) ? history : [])
    .sort(
      (a, b) =>
        (b.publishedAt || 0) - (a.publishedAt || 0)
    );
}

export async function getPublicVersionInfo() {
  const current = await getCurrentVersion();

  if (!current || typeof current !== "object") {
    return null;
  }

  return {
    version: current.version || null,
    title: current.title || "",
    notes: current.notes || "",
    publishedAt: current.publishedAt || null
  };
    }
