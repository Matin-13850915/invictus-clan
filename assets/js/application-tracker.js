
import {
  getRecord,
  getAllRecords
} from "./database.js";

const APPLICATIONS_PATH = "applications";

const STATUS_LABELS = {
  pending: "در انتظار بررسی",
  awaiting_tester: "در انتظار تستر",
  awaiting_test: "در انتظار انجام تست",
  test_completed: "تست انجام شده",
  awaiting_leader: "در انتظار تصمیم لیدر",
  retest_requested: "درخواست تست مجدد",
  accepted: "پذیرفته شده",
  rejected: "رد شده",
  withdrawn: "انصراف داده شده",
  expired: "منقضی شده"
};

function requireUser(actor) {
  if (!actor?.uid) {
    throw new Error("برای پیگیری درخواست وارد حساب شوید.");
  }
}

// دریافت وضعیت درخواست‌های خود کاربر
export async function getMyApplicationStatus(actor) {
  requireUser(actor);

  const applications = await getAllRecords(APPLICATIONS_PATH);

  return applications
    .filter(item => item.uid === actor.uid)
    .map(item => ({
      id: item.id,
      gameName: item.gameName || "",
      applicationType: item.applicationType || "",
      status: item.status || "pending",
      statusLabel: STATUS_LABELS[item.status] || "وضعیت نامشخص",
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null
    }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// دریافت جزئیات یک درخواست متعلق به کاربر
export async function getMyApplicationDetails(applicationId, actor) {
  requireUser(actor);

  if (!applicationId) {
    throw new Error("شناسه درخواست معتبر نیست.");
  }

  const application = await getRecord(
    `${APPLICATIONS_PATH}/${applicationId}`
  );

  if (!application || application.uid !== actor.uid) {
    throw new Error("درخواست پیدا نشد یا اجازه مشاهده آن را ندارید.");
  }

  return {
    id: application.id,
    gameName: application.gameName || "",
    applicationType: application.applicationType || "",
    status: application.status || "pending",
    statusLabel: STATUS_LABELS[application.status] || "وضعیت نامشخص",
    createdAt: application.createdAt || null,
    updatedAt: application.updatedAt || null
  };
}

// دریافت عنوان فارسی وضعیت
export function getApplicationStatusLabel(status) {
  return STATUS_LABELS[status] || "وضعیت نامشخص";
}
