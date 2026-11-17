
import { getAllRecords } from "./database.js";

const COLLECTIONS = [
  "users",
  "roles",
  "profiles",
  "applications",
  "wars",
  "announcements",
  "teams",
  "tournaments",
  "rewards"
];

function requireAdmin(actor) {
  if (!actor?.uid || actor.role !== "admin") {
    throw new Error("فقط ادمین اجازه بررسی یکپارچگی اطلاعات را دارد.");
  }
}

function addIssue(issues, collection, recordId, message) {
  issues.push({
    collection,
    recordId: String(recordId || "unknown"),
    message
  });
}

function validateUser(record, issues) {
  if (!record.uid && !record.id) {
    addIssue(issues, "users", record.id, "شناسه کاربر وجود ندارد.");
  }

  if (!record.role) {
    addIssue(issues, "users", record.id, "نقش کاربر مشخص نشده است.");
  }
}

function validateApplication(record, issues) {
  if (!record.uid) {
    addIssue(issues, "applications", record.id, "شناسه متقاضی وجود ندارد.");
  }

  if (!record.status) {
    addIssue(issues, "applications", record.id, "وضعیت درخواست مشخص نیست.");
  }
}

function validateWar(record, issues) {
  if (!record.opponent) {
    addIssue(issues, "wars", record.id, "نام حریف ثبت نشده است.");
  }

  if (!record.date) {
    addIssue(issues, "wars", record.id, "تاریخ مسابقه ثبت نشده است.");
  }
}

function validateRecord(collection, record, issues) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    addIssue(issues, collection, "unknown", "ساختار رکورد معتبر نیست.");
    return;
  }

  switch (collection) {
    case "users":
      validateUser(record, issues);
      break;

    case "applications":
      validateApplication(record, issues);
      break;

    case "wars":
      validateWar(record, issues);
      break;
  }
}

// بررسی اطلاعات کلن بدون تغییر یا حذف داده‌ها
export async function runIntegrityCheck(actor) {
  requireAdmin(actor);

  const results = {};
  const issues = [];

  for (const collection of COLLECTIONS) {
    try {
      const records = await getAllRecords(collection);

      results[collection] = {
        total: records.length,
        checked: records.length,
        status: "checked"
      };

      for (const record of records) {
        validateRecord(collection, record, issues);
      }
    } catch (error) {
      results[collection] = {
        total: null,
        checked: 0,
        status: "failed"
      };

      addIssue(
        issues,
        collection,
        "collection",
        "خواندن این بخش ناموفق بود."
      );
    }
  }

  return {
    generatedAt: Date.now(),
    collections: results,
    totalIssues: issues.length,
    issues
  };
}
