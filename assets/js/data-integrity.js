
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
  "rewards",
  "badges",
  "tickets",
  "seasons",
  "siteContent",
  "siteSettings"
];

function requireAdmin(actor) {
  if (
    !actor?.uid ||
    actor.active !== true ||
    actor.role !== "admin"
  ) {
    throw new Error("فقط ادمین اجازه بررسی یکپارچگی اطلاعات را دارد.");
  }
}

function addIssue(issues, collection, recordId, code, message) {
  issues.push({
    collection,
    recordId: String(recordId || "unknown"),
    code,
    message
  });
}

function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function validateUser(record, issues) {
  if (!record.uid && !record.id) {
    addIssue(
      issues,
      "users",
      record.id,
      "MISSING_UID",
      "شناسه کاربر وجود ندارد."
    );
  }

  if (
    record.role &&
    !["admin", "leader", "tester", "member"].includes(record.role)
  ) {
    addIssue(
      issues,
      "users",
      record.id,
      "INVALID_ROLE",
      "نقش کاربر معتبر نیست."
    );
  }

  if (
    record.active !== undefined &&
    typeof record.active !== "boolean"
  ) {
    addIssue(
      issues,
      "users",
      record.id,
      "INVALID_ACTIVE",
      "مقدار فعال بودن کاربر باید true یا false باشد."
    );
  }
}

function validateRole(record, issues) {
  if (
    record.role &&
    !["admin", "leader", "tester", "member"].includes(record.role)
  ) {
    addIssue(
      issues,
      "roles",
      record.id,
      "INVALID_ROLE",
      "نقش ثبت‌شده معتبر نیست."
    );
  }

  if (
    record.active !== undefined &&
    typeof record.active !== "boolean"
  ) {
    addIssue(
      issues,
      "roles",
      record.id,
      "INVALID_ACTIVE",
      "وضعیت فعال بودن نقش معتبر نیست."
    );
  }
}

function validateApplication(record, issues) {
  if (
    !record.uid &&
    !record.applicantUid &&
    !record.id
  ) {
    addIssue(
      issues,
      "applications",
      record.id,
      "MISSING_APPLICANT",
      "شناسه متقاضی وجود ندارد."
    );
  }

  const validStatuses = [
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
  ];

  if (
    record.status &&
    !validStatuses.includes(record.status)
  ) {
    addIssue(
      issues,
      "applications",
      record.id,
      "UNKNOWN_STATUS",
      "وضعیت درخواست در فهرست وضعیت‌های شناخته‌شده نیست."
    );
  }

  if (
    record.type &&
    !["MP", "BR", "BOTH", "mp", "br", "both"].includes(record.type)
  ) {
    addIssue(
      issues,
      "applications",
      record.id,
      "INVALID_TYPE",
      "نوع درخواست باید MP، BR یا BOTH باشد."
    );
  }
}

function validateWar(record, issues) {
  if (!record.opponent) {
    addIssue(
      issues,
      "wars",
      record.id,
      "MISSING_OPPONENT",
      "نام حریف ثبت نشده است."
    );
  }

  if (!record.date) {
    addIssue(
      issues,
      "wars",
      record.id,
      "MISSING_DATE",
      "تاریخ مسابقه ثبت نشده است."
    );
  }
}

function validateTicket(record, issues) {
  if (!record.ownerUid && !record.uid) {
    addIssue(
      issues,
      "tickets",
      record.id,
      "MISSING_OWNER",
      "شناسه صاحب تیکت ثبت نشده است."
    );
  }

  if (!record.status) {
    addIssue(
      issues,
      "tickets",
      record.id,
      "MISSING_STATUS",
      "وضعیت تیکت ثبت نشده است."
    );
  }
}

function validateRecord(collection, record, issues) {
  if (!isObject(record)) {
    addIssue(
      issues,
      collection,
      record?.id,
      "INVALID_RECORD",
      "ساختار رکورد معتبر نیست."
    );
    return;
  }

  switch (collection) {
    case "users":
      validateUser(record, issues);
      break;

    case "roles":
      validateRole(record, issues);
      break;

    case "applications":
      validateApplication(record, issues);
      break;

    case "wars":
      validateWar(record, issues);
      break;

    case "tickets":
      validateTicket(record, issues);
      break;
  }

  if (
    record.createdAt !== undefined &&
    !Number.isFinite(Number(record.createdAt))
  ) {
    addIssue(
      issues,
      collection,
      record.id,
      "INVALID_CREATED_AT",
      "زمان ایجاد رکورد معتبر نیست."
    );
  }
}

export async function runIntegrityCheck(actor) {
  requireAdmin(actor);

  const collections = {};
  const issues = [];

  for (const collection of COLLECTIONS) {
    try {
      const records = await getAllRecords(collection);
      const list = Array.isArray(records) ? records : [];

      collections[collection] = {
        total: list.length,
        checked: list.length,
        status: "checked"
      };

      for (const record of list) {
        validateRecord(collection, record, issues);
      }
    } catch {
      collections[collection] = {
        total: null,
        checked: 0,
        status: "failed"
      };

      addIssue(
        issues,
        collection,
        "collection",
        "READ_FAILED",
        "خواندن این بخش ناموفق بود."
      );
    }
  }

  const failedCollections = Object.values(collections)
    .filter(item => item.status === "failed").length;

  return {
    generatedAt: Date.now(),
    collections,
    totalCollections: COLLECTIONS.length,
    failedCollections,
    totalIssues: issues.length,
    issues,
    success: failedCollections === 0 && issues.length === 0
  };
    }
    
