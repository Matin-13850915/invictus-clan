
import {
  getAllRecords,
  createRecord,
  getRecord
} from "./database.js";

const BACKUPS_PATH = "systemBackups";

const BACKUP_COLLECTIONS = [
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
];

function requireAdmin(actor) {
  if (!actor?.uid || actor.role !== "admin") {
    throw new Error("فقط ادمین اجازه مدیریت پشتیبان‌ها را دارد.");
  }
}

function createBackupId() {
  return `backup_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// تهیه نسخه پشتیبان
export async function createBackup(actor) {
  requireAdmin(actor);

  const snapshot = {
    id: createBackupId(),
    createdAt: Date.now(),
    createdBy: actor.uid,
    status: "completed",
    collections: {}
  };

  for (const collection of BACKUP_COLLECTIONS) {
    try {
      snapshot.collections[collection] =
        await getAllRecords(collection);
    } catch (error) {
      throw new Error(
        `تهیه پشتیبان از بخش ${collection} ناموفق بود.`
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

// مشاهده فهرست نسخه‌های پشتیبان
export async function getBackups(actor) {
  requireAdmin(actor);

  const backups = await getAllRecords(BACKUPS_PATH);

  return backups.sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
}

// دریافت محتوای یک نسخه پشتیبان
export async function getBackup(backupId, actor) {
  requireAdmin(actor);

  if (!backupId) {
    throw new Error("شناسه نسخه پشتیبان معتبر نیست.");
  }

  const backup = await getRecord(
    `${BACKUPS_PATH}/${backupId}`
  );

  if (!backup) {
    throw new Error("نسخه پشتیبان پیدا نشد.");
  }

  return backup;
}

// ساخت فایل JSON قابل ذخیره روی دستگاه
export function exportBackupJSON(backup) {
  if (!backup?.collections || !backup?.id) {
    throw new Error("اطلاعات نسخه پشتیبان معتبر نیست.");
  }

  return JSON.stringify(backup, null, 2);
}

// بررسی ساختار فایل قبل از بازیابی
export function validateBackup(backup) {
  if (
    !backup ||
    typeof backup !== "object" ||
    !backup.collections ||
    typeof backup.collections !== "object"
  ) {
    throw new Error("ساختار نسخه پشتیبان معتبر نیست.");
  }

  for (const collection of BACKUP_COLLECTIONS) {
    if (
      backup.collections[collection] !== undefined &&
      !Array.isArray(backup.collections[collection]) &&
      (
        typeof backup.collections[collection] !== "object" ||
        backup.collections[collection] === null
      )
    ) {
      throw new Error(
        `ساختار بخش ${collection} معتبر نیست.`
      );
    }
  }

  return true;
}

// آماده‌سازی اطلاعات برای بررسی پیش از بازیابی
export function prepareRestorePreview(backup, actor) {
  requireAdmin(actor);
  validateBackup(backup);

  return {
    backupId: backup.id,
    createdAt: backup.createdAt,
    sections: Object.entries(backup.collections).map(
      ([name, data]) => ({
        name,
        count: Array.isArray(data)
          ? data.length
          : Object.keys(data || {}).length
      })
    )
  };
          }
