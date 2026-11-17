
import {
  getRecord,
  updateRecord,
  createRecord,
  getAllRecords
} from "./database.js";

const VERSION_PATH = "system/version";
const HISTORY_PATH = "system/versionHistory";

function requireAdmin(actor) {
  if (
    !actor?.uid ||
    actor.role !== "admin" ||
    actor.active !== true
  ) {
    throw new Error("فقط ادمین فعال اجازه مدیریت نسخه سایت را دارد.");
  }
}

function cleanText(value, maxLength, field) {
  if (typeof value !== "string") {
    throw new Error(`${field} معتبر نیست.`);
  }

  const result = value.trim();

  if (!result || result.length > maxLength) {
    throw new Error(
      `${field} باید بین ۱ تا ${maxLength} کاراکتر باشد.`
    );
  }

  return result;
}

export function validateVersion(version) {
  if (
    typeof version !== "string" ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(
      version.trim()
    )
  ) {
    throw new Error("نسخه باید به شکل 1.0.0 باشد.");
  }

  const parts = version.trim().split(".");

  if (parts.some(part => !Number.isSafeInteger(Number(part)))) {
    throw new Error("شماره نسخه بیش از محدوده مجاز است.");
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

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
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

  // ابتدا رکورد تاریخچه با شناسه واقعی Firebase ساخته می‌شود.
  const historyId = await createRecord(HISTORY_PATH, release);

  // سپس نسخه جاری به‌روزرسانی می‌شود.
  await updateRecord(VERSION_PATH, {
    ...release,
    historyId
  });

  return {
    ...release,
    historyId
  };
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
