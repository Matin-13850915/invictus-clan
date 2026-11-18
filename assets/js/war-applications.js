
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord,
  findByField
} from "./database.js";

const REQUESTS_PATH = "warApplications";
const WARS_PATH = "wars";

const VALID_STATUSES = [
  "pending",
  "selected",
  "not_selected",
  "withdrawn"
];

function requireUser(actor) {
  if (
    !actor?.uid ||
    actor.active !== true ||
    !["admin", "leader", "tester", "member"].includes(actor.role)
  ) {
    throw new Error("ابتدا با حساب فعال وارد شوید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت درخواست‌ها را دارند.");
  }
}

function validateId(value, label = "شناسه") {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(value)
  ) {
    throw new Error(`${label} معتبر نیست.`);
  }

  return value;
}

function cleanText(value, max = 300, allowEmpty = false) {
  if (typeof value !== "string") {
    throw new Error("متن واردشده معتبر نیست.");
  }

  const result = value.trim();

  if (
    (!allowEmpty && !result) ||
    result.length > max
  ) {
    throw new Error(`متن باید حداکثر ${max} کاراکتر باشد.`);
  }

  return result;
}

function validateStatus(status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("وضعیت درخواست معتبر نیست.");
  }
}

async function getWar(warId) {
  const id = validateId(warId, "شناسه جنگ");
  const war = await getRecord(`${WARS_PATH}/${id}`);

  if (!war || war.archived === true) {
    throw new Error("جنگ موردنظر پیدا نشد یا بایگانی شده است.");
  }

  return { ...war, id };
}

async function getRequest(requestId) {
  const id = validateId(requestId, "شناسه درخواست");
  const request = await getRecord(`${REQUESTS_PATH}/${id}`);

  if (!request) {
    throw new Error("درخواست موردنظر پیدا نشد.");
  }

  return { ...request, id };
}

async function getRequestsForWar(warId) {
  return findByField(REQUESTS_PATH, "warId", warId);
}

// ثبت درخواست حضور در جنگ
export async function applyForWar(warId, note, actor) {
  requireUser(actor);

  if (actor.role !== "member") {
    throw new Error("فقط اعضای کلن می‌توانند درخواست حضور ثبت کنند.");
  }

  const id = validateId(warId, "شناسه جنگ");
  const war = await getWar(id);

  if (war.registrationOpen !== true) {
    throw new Error("ثبت‌نام این جنگ باز نیست.");
  }

  const cleanNote = cleanText(
    note || "",
    300,
    true
  );

  const memberRequests = await findByField(
    REQUESTS_PATH,
    "memberUid",
    actor.uid
  );

  const duplicate = memberRequests.find(request =>
    request.warId === id &&
    ["pending", "selected"].includes(request.status)
  );

  if (duplicate) {
    throw new Error("برای این جنگ قبلاً درخواست فعال ثبت کرده‌اید.");
  }

  const now = Date.now();

  const requestId = await createRecord(REQUESTS_PATH, {
    warId: id,
    memberUid: actor.uid,
    memberName: cleanText(
      actor.displayName || actor.gameName || "عضو کلن",
      60
    ),
    note: cleanNote,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: ""
  });

  return {
    id: requestId,
    warId: id,
    memberUid: actor.uid,
    status: "pending",
    createdAt: now
  };
}

// دریافت درخواست‌های شخصی عضو
export async function getMyWarApplications(actor) {
  requireUser(actor);

  const requests = await findByField(REQUESTS_PATH, "memberUid", actor.uid);

  return requests.sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
}

// دریافت درخواست‌های یک جنگ برای مدیریت
export async function getWarApplications(warId, actor) {
  requireStaff(actor);

  const id = validateId(warId, "شناسه جنگ");

  await getWar(id);

  const requests = await getRequestsForWar(id);

  return requests.sort(
    (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
  );
}

// بررسی و انتخاب درخواست
export async function reviewWarApplication(
  requestId,
  status,
  reviewNote,
  actor
) {
  requireStaff(actor);
  validateStatus(status);

  if (status === "withdrawn") {
    throw new Error("مدیریت نمی‌تواند وضعیت انصراف را ثبت کند.");
  }

  const request = await getRequest(requestId);

  if (request.status !== "pending") {
    throw new Error("این درخواست قبلاً بررسی شده است.");
  }

  const war = await getWar(request.warId);

  if (status === "selected") {
    if (war.registrationOpen !== true) {
      throw new Error("ثبت‌نام این جنگ بسته شده است.");
    }

    const capacity = Number(war.capacity);

    if (
      Number.isInteger(capacity) &&
      capacity > 0
    ) {
      const requests = await getRequestsForWar(request.warId);

      const selectedCount = requests.filter(
        item => item.status === "selected"
      ).length;

      if (selectedCount >= capacity) {
        throw new Error("ظرفیت جنگ تکمیل شده است.");
      }
    }
  }

  const cleanReviewNote = cleanText(
    reviewNote || "",
    500,
    true
  );

  await updateRecord(`${REQUESTS_PATH}/${request.id}`, {
    status,
    reviewNote: cleanReviewNote,
    reviewedBy: actor.uid,
    reviewedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

// انصراف عضو از درخواست
export async function withdrawWarApplication(requestId, actor) {
  requireUser(actor);

  const request = await getRequest(requestId);

  if (request.memberUid !== actor.uid) {
    throw new Error("این درخواست متعلق به شما نیست.");
  }

  if (!["pending", "selected"].includes(request.status)) {
    throw new Error("این درخواست قابل انصراف نیست.");
  }

  await updateRecord(`${REQUESTS_PATH}/${request.id}`, {
    status: "withdrawn",
    updatedAt: Date.now(),
    withdrawnAt: Date.now()
  });

  return true;
}

// تغییر ظرفیت جنگ
export async function updateWarCapacity(warId, capacity, actor) {
  requireStaff(actor);

  const id = validateId(warId, "شناسه جنگ");

  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 100
  ) {
    throw new Error("ظرفیت باید عددی بین ۱ تا ۱۰۰ باشد.");
  }

  const war = await getWar(id);
  const requests = await getRequestsForWar(id);

  const selectedCount = requests.filter(
    request => request.status === "selected"
  ).length;

  if (capacity < selectedCount) {
    throw new Error(
      "ظرفیت جدید از تعداد اعضای انتخاب‌شده کمتر است."
    );
  }

  await updateRecord(`${WARS_PATH}/${id}`, {
    capacity,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });

  return true;
}

// باز و بسته کردن ثبت‌نام جنگ
export async function setWarRegistration(warId, isOpen, actor) {
  requireStaff(actor);

  const id = validateId(warId, "شناسه جنگ");

  if (typeof isOpen !== "boolean") {
    throw new Error("وضعیت ثبت‌نام معتبر نیست.");
  }

  const war = await getWar(id);

  if (isOpen && war.status === "completed") {
    throw new Error("جنگ پایان‌یافته قابل ثبت‌نام مجدد نیست.");
  }

  await updateRecord(`${WARS_PATH}/${id}`, {
    registrationOpen: isOpen,
    registrationUpdatedAt: Date.now(),
    registrationUpdatedBy: actor.uid
  });

  return true;
    }
