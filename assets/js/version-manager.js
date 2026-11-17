
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

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    throw new Error("مقدار واردشده معتبر نیست.");
  }

  const result = value.trim();

  if (!result || result.length > maxLength) {
    throw new Error(`متن باید بین ۱ تا ${maxLength} کاراکتر باشد.`);
  }

  return result;
}

function validateVersion(version) {
  if (
    typeof version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(version)
  ) {
    throw new Error("نسخه باید به شکل 1.0.0 باشد.");
  }

  return version;
}

// دریافت نسخه فعلی
export async function getCurrentVersion() {
  return await getRecord(VERSION_PATH);
}

// انتشار نسخه جدید
export async function publishVersion(data, actor) {
  requireAdmin(actor);

  const version = validateVersion(data.version);
  const title = cleanText(data.title, 100);
  const notes = cleanText(data.notes, 3000);

  const current = await getCurrentVersion();

  if (current?.version === version) {
    throw new Error("این نسخه قبلاً منتشر شده است.");
  }

  const release = {
    version,
    title,
    notes,
    publishedAt: Date.now(),
    publishedBy: actor.uid
  };

  await createRecord(HISTORY_PATH, release);
  await updateRecord(VERSION_PATH, release);

  return release;
}

// مشاهده تاریخچه انتشار
export async function getVersionHistory(actor) {
  requireAdmin(actor);

  const history = await getAllRecords(HISTORY_PATH);

  return history.sort(
    (a, b) => (b.publishedAt || 0) - (a.publishedAt || 0)
  );
}

// مقایسه دو نسخه
export function compareVersions(first, second) {
  const a = validateVersion(first).split(".").map(Number);
  const b = validateVersion(second).split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }

  return 0;
}
