
import {
  getAllRecords,
  createRecord,
  getRecord
} from "./database.js";

const BACKUPS_PATH = "systemBackups";

const BACKUP_COLLECTIONS = Object.freeze([
  "users",
  "roles",
  "profiles",
  "announcements",
  "wars",
  "teams",
  "seasons",
  "tournaments",
  "rewards",
  "badges",
  "siteContent",
  "siteSettings"
]);

function requireAdmin(actor) {
  if (
    !actor ||
    typeof actor.uid !== "string" ||
    !actor.uid.trim() ||
    actor.role !== "admin"
  ) {
    throw new Error("فقط ادمین اجازه مدیریت پشتیبان‌ها را دارد.");
  }
}

function assertBackupId(id) {
  if (
    typeof id !== "string" ||
    !/^backup_[0-9]+_[a-z0-9]+$/.test(id)
  ) {
    throw new Error("شناسه نسخه پشتیبان معتبر نیست.");
  }
}

function createBackupId() {
  return `backup_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function validateCollectionData(data, collection) {
  if (
    data === null ||
    typeof data !== "object"
  ) {
    throw new Error(
      `ساختار بخش ${collection} معتبر نیست.`
    );
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item)
      ) {
        throw new Error(
          `رکورد نامعتبر در بخش ${collection} وجود دارد.`
        );
      }
    }

    return true;
  }

  for (const [key, item] of Object.entries(data)) {
    if (
      !key ||
      /[.#$/\[\]]/.test(key) ||
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      throw new Error(
        `رکورد نامعتبر در بخش ${collection} وجود دارد.`
      );
    }
  }

  return true;
}

// تهیه نسخه پشتیبان کامل
export async function createBackup(actor) {
  requireAdmin(actor);

  const snapshot = {
    id: createBackupId(),
    createdAt: Date.now(),
    createdBy: actor.uid,
    status: "completed",
    formatVersion: 1,
    collections: {}
  };

  for (const collection of BACKUP_COLLECTIONS) {
    try {
      snapshot.collections[collection] =
        await getAllRecords(collection);
    } catch (error) {
      throw new Error(
        `تهیه پشتیبان از بخش ${collection} ناموفق بود: ${
          error?.message || "خطای ناشناخته"
        }`
      );
    }
  }

  const record = {
    ...snapshot,
    description: "نسخه پشتیبان اطلاعات کلن"
  };

  await createRecord(BACKUPS_PATH, record);

  return record;
}

// دریافت فهرست پشتیبان‌ها
export async function getBackups(actor) {
  requireAdmin(actor);

  const backups = await getAllRecords(BACKUPS_PATH);

  return backups
    .filter(item =>
      item &&
      typeof item === "object" &&
      item.status === "completed" &&
      item.id
    )
    .sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    )
    .map(item => ({
      id: item.id,
      createdAt: item.createdAt || null,
      createdBy: item.createdBy || null,
      status: item.status,
      description: item.description || ""
    }));
}

// دریافت محتوای پشتیبان
export async function getBackup(backupId, actor) {
  requireAdmin(actor);
  assertBackupId(backupId);

  const backup = await getRecord(
    `${BACKUPS_PATH}/${backupId}`
  );

  if (!backup || backup.status !== "completed") {
    throw new Error("نسخه پشتیبان پیدا نشد یا معتبر نیست.");
  }

  validateBackup(backup);

  return backup;
}

// تبدیل پشتیبان به JSON
export function exportBackupJSON(backup) {
  validateBackup(backup);

  if (
    typeof backup.id !== "string" ||
    !backup.id.trim()
  ) {
    throw new Error("شناسه نسخه پشتیبان موجود نیست.");
  }

  return JSON.stringify(backup, null, 2);
}

// اعتبارسنجی ساختار پشتیبان
export function validateBackup(backup) {
  if (
    !backup ||
    typeof backup !== "object" ||
    Array.isArray(backup) ||
    !backup.collections ||
    typeof backup.collections !== "object" ||
    Array.isArray(backup.collections)
  ) {
    throw new Error("ساختار نسخه پشتیبان معتبر نیست.");
  }

  if (
    backup.formatVersion !== undefined &&
    backup.formatVersion !== 1
  ) {
    throw new Error("نسخه قالب پشتیبان پشتیبانی نمی‌شود.");
  }

  for (const collection of BACKUP_COLLECTIONS) {
    const data = backup.collections[collection];

    if (data === undefined) continue;

    validateCollectionData(data, collection);
  }

  return true;
}

// پیش‌نمایش قبل از بازیابی
export function prepareRestorePreview(backup, actor) {
  requireAdmin(actor);
  validateBackup(backup);

  return {
    backupId: backup.id,
    createdAt: backup.createdAt || null,
    createdBy: backup.createdBy || null,
    sections: Object.entries(backup.collections).map(
      ([name, data]) => ({
        name,
        count: Array.isArray(data)
          ? data.length
          : Object.keys(data).length
      })
    )
  };
}
