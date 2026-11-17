
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord
} from "./database.js";

import { createId } from "./utils.js";

const REPORTS_PATH = "bugReports";

const VALID_CATEGORIES = [
  "login",
  "display",
  "chat",
  "profile",
  "performance",
  "other"
];

const VALID_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "closed"
];

function requireUser(actor) {
  if (
    !actor ||
    typeof actor.uid !== "string" ||
    !actor.uid.trim()
  ) {
    throw new Error("برای انجام این عملیات باید وارد حساب شوید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه بررسی گزارش‌ها را دارند.");
  }
}

function assertId(id, label = "شناسه گزارش") {
  if (
    typeof id !== "string" ||
    !id.trim() ||
    /[.#$/\[\]]/.test(id)
  ) {
    throw new Error(`${label} معتبر نیست.`);
  }
}

function cleanText(value, maxLength, required = true) {
  if (typeof value !== "string") {
    throw new Error("متن واردشده معتبر نیست.");
  }

  const result = value.trim();

  if (
    (required && !result) ||
    result.length > maxLength
  ) {
    throw new Error(
      `متن باید ${required ? "بین ۱ تا" : "حداکثر"} ${maxLength} کاراکتر باشد.`
    );
  }

  return result;
}

function validateReportData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات گزارش معتبر نیست.");
  }

  if (!VALID_CATEGORIES.includes(data.category)) {
    throw new Error("دسته‌بندی گزارش معتبر نیست.");
  }

  return {
    title: cleanText(data.title, 100),
    description: cleanText(data.description, 3000),
    category: data.category,
    page: cleanText(data.page ?? "", 100, false)
  };
}

// ثبت گزارش خطا
export async function createBugReport(data, actor) {
  requireUser(actor);

  const input = validateReportData(data);
  const now = Date.now();

  const report = {
    id: createId(),
    uid: actor.uid,
    reporterName: cleanText(
      actor.displayName || actor.gameName || "عضو کلن",
      80
    ),
    ...input,
    status: "open",
    createdAt: now,
    updatedAt: now,
    assignedTo: null,
    staffReply: ""
  };

  await createRecord(REPORTS_PATH, report);

  return report;
}

// دریافت گزارش‌های شخصی
export async function getMyBugReports(actor) {
  requireUser(actor);

  const reports = await getAllRecords(REPORTS_PATH);

  return reports
    .filter(report => report.uid === actor.uid)
    .sort((a, b) =>
      (b.createdAt || 0) - (a.createdAt || 0)
    );
}

// دریافت تمام گزارش‌ها
export async function getAllBugReports(actor) {
  requireStaff(actor);

  const reports = await getAllRecords(REPORTS_PATH);

  return reports.sort((a, b) =>
    (b.createdAt || 0) - (a.createdAt || 0)
  );
}

// دریافت یک گزارش
export async function getBugReport(reportId, actor) {
  requireUser(actor);
  assertId(reportId);

  const report = await getRecord(
    `${REPORTS_PATH}/${reportId}`
  );

  if (!report) {
    throw new Error("گزارش پیدا نشد.");
  }

  const isOwner = report.uid === actor.uid;
  const isStaff = ["admin", "leader"].includes(actor.role);

  if (!isOwner && !isStaff) {
    throw new Error("اجازه مشاهده این گزارش را ندارید.");
  }

  return report;
}

// تغییر وضعیت گزارش
export async function updateBugReportStatus(
  reportId,
  status,
  actor
) {
  requireStaff(actor);
  assertId(reportId);

  if (!VALID_STATUSES.includes(status)) {
    throw new Error("وضعیت انتخاب‌شده معتبر نیست.");
  }

  const report = await getRecord(
    `${REPORTS_PATH}/${reportId}`
  );

  if (!report) {
    throw new Error("گزارش پیدا نشد.");
  }

  if (report.status === "closed" && status !== "closed") {
    throw new Error("گزارش بسته‌شده قابل بازگشایی از این مسیر نیست.");
  }

  const now = Date.now();

  await updateRecord(`${REPORTS_PATH}/${reportId}`, {
    status,
    updatedAt: now,
    updatedBy: actor.uid
  });

  return true;
}

// پاسخ مدیریت به گزارش
export async function replyToBugReport(
  reportId,
  reply,
  actor
) {
  requireStaff(actor);
  assertId(reportId);

  const text = cleanText(reply, 2000);

  const report = await getRecord(
    `${REPORTS_PATH}/${reportId}`
  );

  if (!report) {
    throw new Error("گزارش پیدا نشد.");
  }

  const now = Date.now();

  await updateRecord(`${REPORTS_PATH}/${reportId}`, {
    staffReply: text,
    repliedBy: actor.uid,
    repliedAt: now,
    updatedAt: now
  });

  return true;
}

// ارجاع گزارش به مسئول
export async function assignBugReport(
  reportId,
  staffUid,
  actor
) {
  requireStaff(actor);
  assertId(reportId);

  if (
    typeof staffUid !== "string" ||
    !staffUid.trim() ||
    /[.#$/\[\]]/.test(staffUid)
  ) {
    throw new Error("شناسه مسئول معتبر نیست.");
  }

  const report = await getRecord(
    `${REPORTS_PATH}/${reportId}`
  );

  if (!report) {
    throw new Error("گزارش پیدا نشد.");
  }

  const now = Date.now();

  await updateRecord(`${REPORTS_PATH}/${reportId}`, {
    assignedTo: staffUid.trim(),
    assignedBy: actor.uid,
    assignedAt: now,
    updatedAt: now
  });

  return true;
}
