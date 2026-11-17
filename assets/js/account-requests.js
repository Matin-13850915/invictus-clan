
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord,
  updateData
} from "./database.js";

const REQUESTS_PATH = "accountRequests";
const PROFILES_PATH = "profiles";

const ALLOWED_FIELDS = [
  "gameName",
  "gameLevel",
  "telegram",
  "rubika",
  "bio"
];

const LIMITS = {
  gameName: 40,
  gameLevel: 3,
  telegram: 100,
  rubika: 100,
  bio: 300
};

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

function validateRequestId(id) {
  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(id)
  ) {
    throw new Error("شناسه درخواست معتبر نیست.");
  }
}

function cleanText(value, maxLength, allowEmpty = false) {
  if (typeof value !== "string") {
    throw new Error("اطلاعات واردشده معتبر نیست.");
  }

  const result = value.trim();

  if (
    (!allowEmpty && !result) ||
    result.length > maxLength
  ) {
    throw new Error(
      `متن باید حداکثر ${maxLength} کاراکتر باشد.`
    );
  }

  return result;
}

function normalizeFieldValue(field, value) {
  const result = cleanText(value, LIMITS[field]);

  if (field === "gameLevel") {
    const level = Number(result);

    if (
      !Number.isInteger(level) ||
      level < 1 ||
      level > 500
    ) {
      throw new Error("لول بازی باید عددی بین ۱ تا ۵۰۰ باشد.");
    }

    return level;
  }

  return result;
}

// ثبت درخواست تغییر اطلاعات
export async function createAccountRequest(data, actor) {
  requireUser(actor);

  if (!data || typeof data !== "object") {
    throw new Error("اطلاعات درخواست معتبر نیست.");
  }

  if (!ALLOWED_FIELDS.includes(data.field)) {
    throw new Error("امکان تغییر این فیلد وجود ندارد.");
  }

  const field = data.field;

  const oldValue = cleanText(
    String(data.oldValue ?? ""),
    LIMITS[field],
    true
  );

  const requestedValue = normalizeFieldValue(
    field,
    data.requestedValue
  );

  if (
    String(oldValue) === String(requestedValue)
  ) {
    throw new Error("مقدار جدید با مقدار فعلی یکسان است.");
  }

  const profile = await getRecord(
    `${PROFILES_PATH}/${actor.uid}`
  );

  if (!profile) {
    throw new Error("پروفایل شما پیدا نشد.");
  }

  const actualValue = String(profile[field] ?? "");

  if (actualValue !== oldValue) {
    throw new Error(
      "اطلاعات فعلی پروفایل تغییر کرده است. صفحه را تازه‌سازی کنید."
    );
  }

  const existing = await getAllRecords(REQUESTS_PATH);

  const hasPending = existing.some(item =>
    item.uid === actor.uid &&
    item.field === field &&
    item.status === "pending"
  );

  if (hasPending) {
    throw new Error(
      "برای این بخش یک درخواست در انتظار بررسی دارید."
    );
  }

  const now = Date.now();

  return await createRecord(REQUESTS_PATH, {
    uid: actor.uid,
    field,
    oldValue,
    requestedValue,
    reason: typeof data.reason === "string"
      ? data.reason.trim().slice(0, 500)
      : "",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    reviewedBy: null,
    reviewNote: ""
  });
}

// مشاهده درخواست‌های شخصی
export async function getMyAccountRequests(actor) {
  requireUser(actor);

  const requests = await getAllRecords(REQUESTS_PATH);

  return requests
    .filter(item => item.uid === actor.uid)
    .sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
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
  validateRequestId(requestId);

  if (!["approved", "rejected"].includes(decision)) {
    throw new Error("تصمیم انتخاب‌شده معتبر نیست.");
  }

  const requestPath = `${REQUESTS_PATH}/${requestId}`;

  const request = await getRecord(requestPath);

  if (!request) {
    throw new Error("درخواست پیدا نشد.");
  }

  if (request.status !== "pending") {
    throw new Error("این درخواست قبلاً بررسی شده است.");
  }

  if (!ALLOWED_FIELDS.includes(request.field)) {
    throw new Error("فیلد درخواست معتبر نیست.");
  }

  if (decision === "approved") {
    const profilePath = `${PROFILES_PATH}/${request.uid}`;
    const profile = await getRecord(profilePath);

    if (!profile) {
      throw new Error("پروفایل عضو پیدا نشد.");
    }

    const currentValue = String(
      profile[request.field] ?? ""
    );

    if (currentValue !== String(request.oldValue ?? "")) {
      throw new Error(
        "اطلاعات پروفایل از زمان ثبت درخواست تغییر کرده است؛ درخواست را بررسی مجدد کنید."
      );
    }

    const newValue = normalizeFieldValue(
      request.field,
      String(request.requestedValue)
    );

    await updateData(profilePath, {
      [request.field]: newValue,
      updatedAt: Date.now(),
      updatedBy: actor.uid
    });
  }

  await updateRecord(requestPath, {
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
