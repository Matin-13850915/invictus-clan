
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord
} from "./database.js";

const REQUESTS_PATH = "accountRequests";

const ALLOWED_FIELDS = [
  "gameName",
  "gameLevel",
  "telegram",
  "rubika",
  "bio"
];

const ALLOWED_STATUSES = [
  "pending",
  "approved",
  "rejected"
];

function requireUser(actor) {
  if (!actor?.uid) {
    throw new Error("ابتدا وارد حساب خود شوید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه بررسی درخواست‌ها را دارند.");
  }
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    throw new Error("اطلاعات واردشده معتبر نیست.");
  }

  const result = value.trim();

  if (!result || result.length > maxLength) {
    throw new Error(`متن باید بین ۱ تا ${maxLength} کاراکتر باشد.`);
  }

  return result;
}

// ثبت درخواست تغییر اطلاعات
export async function createAccountRequest(data, actor) {
  requireUser(actor);

  if (!ALLOWED_FIELDS.includes(data.field)) {
    throw new Error("امکان تغییر این فیلد وجود ندارد.");
  }

  const limits = {
    gameName: 40,
    gameLevel: 3,
    telegram: 100,
    rubika: 100,
    bio: 300
  };

  const request = {
    uid: actor.uid,
    field: data.field,
    oldValue: cleanText(data.oldValue, limits[data.field]),
    requestedValue: cleanText(
      data.requestedValue,
      limits[data.field]
    ),
    reason: typeof data.reason === "string"
      ? data.reason.trim().slice(0, 500)
      : "",
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    reviewedBy: null,
    reviewNote: ""
  };

  if (request.oldValue === request.requestedValue) {
    throw new Error("مقدار جدید با مقدار فعلی یکسان است.");
  }

  const existing = await getAllRecords(REQUESTS_PATH);

  const hasPending = existing.some(item =>
    item.uid === actor.uid &&
    item.field === data.field &&
    item.status === "pending"
  );

  if (hasPending) {
    throw new Error("برای این بخش یک درخواست در انتظار بررسی دارید.");
  }

  const saved = await createRecord(REQUESTS_PATH, request);

  return saved;
}

// مشاهده درخواست‌های شخصی
export async function getMyAccountRequests(actor) {
  requireUser(actor);

  const requests = await getAllRecords(REQUESTS_PATH);

  return requests
    .filter(item => item.uid === actor.uid)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// مشاهده همه درخواست‌ها برای مدیریت
export async function getAllAccountRequests(actor) {
  requireStaff(actor);

  const requests = await getAllRecords(REQUESTS_PATH);

  return requests.sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
}

// بررسی و تأیید یا رد درخواست
export async function reviewAccountRequest(
  requestId,
  decision,
  reviewNote,
  actor
) {
  requireStaff(actor);

  if (!["approved", "rejected"].includes(decision)) {
    throw new Error("تصمیم انتخاب‌شده معتبر نیست.");
  }

  const request = await getRecord(
    `${REQUESTS_PATH}/${requestId}`
  );

  if (!request) {
    throw new Error("درخواست پیدا نشد.");
  }

  if (request.status !== "pending") {
    throw new Error("این درخواست قبلاً بررسی شده است.");
  }

  await updateRecord(`${REQUESTS_PATH}/${requestId}`, {
    status: decision,
    reviewedBy: actor.uid,
    reviewNote: typeof reviewNote === "string"
      ? reviewNote.trim().slice(0, 500)
      : "",
    reviewedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
    }
