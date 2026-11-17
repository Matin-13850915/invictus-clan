
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
  if (!actor?.uid) {
    throw new Error("برای ثبت گزارش باید وارد حساب شوید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه بررسی گزارش‌ها را دارند.");
  }
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    throw new Error("متن گزارش معتبر نیست.");
  }

  const result = value.trim();

  if (!result || result.length > maxLength) {
    throw new Error(`متن باید بین ۱ تا ${maxLength} کاراکتر باشد.`);
  }

  return result;
}

// ثبت گزارش خطا
export async function createBugReport(data, actor) {
  requireUser(actor);

  if (!VALID_CATEGORIES.includes(data.category)) {
    throw new Error("دسته‌بندی گزارش معتبر نیست.");
  }

  const report = {
    id: createId(),
    uid: actor.uid,
    reporterName: actor.displayName || actor.gameName || "عضو کلن",
    title: cleanText(data.title, 100),
    description: cleanText(data.description, 3000),
    category: data.category,
    page: typeof data.page === "string"
      ? data.page.slice(0, 100)
      : "",
    status: "open",
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// دریافت همه گزارش‌ها برای مدیریت
export async function getAllBugReports(actor) {
  requireStaff(actor);

  const reports = await getAllRecords(REPORTS_PATH);

  return reports.sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
}

// دریافت یک گزارش
export async function getBugReport(reportId, actor) {
  requireUser(actor);

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

  if (!VALID_STATUSES.includes(status)) {
    throw new Error("وضعیت انتخاب‌شده معتبر نیست.");
  }

  const report = await getRecord(
    `${REPORTS_PATH}/${reportId}`
  );

  if (!report) {
    throw new Error("گزارش پیدا نشد.");
  }

  await updateRecord(`${REPORTS_PATH}/${reportId}`, {
    status,
    updatedAt: Date.now(),
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

  const text = cleanText(reply, 2000);

  const report = await getRecord(
    `${REPORTS_PATH}/${reportId}`
  );

  if (!report) {
    throw new Error("گزارش پیدا نشد.");
  }

  await updateRecord(`${REPORTS_PATH}/${reportId}`, {
    staffReply: text,
    repliedBy: actor.uid,
    repliedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

// ارجاع گزارش به یک مسئول
export async function assignBugReport(
  reportId,
  staffUid,
  actor
) {
  requireStaff(actor);

  if (typeof staffUid !== "string" || !staffUid.trim()) {
    throw new Error("شناسه مسئول معتبر نیست.");
  }

  const report = await getRecord(
    `${REPORTS_PATH}/${reportId}`
  );

  if (!report) {
    throw new Error("گزارش پیدا نشد.");
  }

  await updateRecord(`${REPORTS_PATH}/${reportId}`, {
    assignedTo: staffUid,
    assignedBy: actor.uid,
    assignedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}
