
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord
} from "./database.js";

import { createId } from "./utils.js";

const REQUESTS_PATH = "warApplications";
const WARS_PATH = "wars";

const VALID_STATUSES = [
  "pending",
  "selected",
  "not_selected",
  "withdrawn"
];

function requireUser(actor) {
  if (!actor?.uid) {
    throw new Error("ابتدا وارد حساب خود شوید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت درخواست‌ها را دارند.");
  }
}

function cleanText(value, max = 300) {
  if (typeof value !== "string") {
    throw new Error("اطلاعات واردشده معتبر نیست.");
  }

  const result = value.trim();

  if (!result || result.length > max) {
    throw new Error(`متن باید بین ۱ تا ${max} کاراکتر باشد.`);
  }

  return result;
}

function validateStatus(status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("وضعیت درخواست معتبر نیست.");
  }
}

async function getWar(warId) {
  const war = await getRecord(`${WARS_PATH}/${warId}`);

  if (!war || war.archived) {
    throw new Error("جنگ موردنظر پیدا نشد یا بایگانی شده است.");
  }

  return war;
}

// ثبت درخواست حضور در جنگ
export async function applyForWar(warId, note, actor) {
  requireUser(actor);

  if (actor.role !== "member") {
    throw new Error("فقط اعضای کلن می‌توانند درخواست حضور ثبت کنند.");
  }

  const war = await getWar(warId);

  if (war.registrationOpen === false) {
    throw new Error("ثبت‌نام این جنگ بسته شده است.");
  }

  const requests = await getAllRecords(REQUESTS_PATH);

  const duplicate = requests.find(request =>
    request.warId === warId &&
    request.memberUid === actor.uid &&
    ["pending", "selected"].includes(request.status)
  );

  if (duplicate) {
    throw new Error("برای این جنگ قبلاً درخواست ثبت کرده‌اید.");
  }

  const request = {
    id: createId(),
    warId,
    memberUid: actor.uid,
    memberName: actor.displayName || actor.gameName || "عضو کلن",
    note: typeof note === "string" ? note.trim().slice(0, 300) : "",
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: ""
  };

  await createRecord(REQUESTS_PATH, request);

  return request;
}

// دریافت درخواست‌های شخصی عضو
export async function getMyWarApplications(actor) {
  requireUser(actor);

  const requests = await getAllRecords(REQUESTS_PATH);

  return requests
    .filter(request => request.memberUid === actor.uid)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// دریافت درخواست‌های یک جنگ برای مدیریت
export async function getWarApplications(warId, actor) {
  requireStaff(actor);

  const requests = await getAllRecords(REQUESTS_PATH);

  return requests
    .filter(request => request.warId === warId)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

// بررسی ظرفیت و انتخاب اعضا
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

  const request = await getRecord(`${REQUESTS_PATH}/${requestId}`);

  if (!request) {
    throw new Error("درخواست پیدا نشد.");
  }

  if (request.status !== "pending") {
    throw new Error("این درخواست قبلاً بررسی شده است.");
  }

  const war = await getWar(request.warId);

  if (status === "selected") {
    const capacity = Number(war.capacity);

    if (Number.isInteger(capacity) && capacity > 0) {
      const allRequests = await getAllRecords(REQUESTS_PATH);

      const selectedCount = allRequests.filter(item =>
        item.warId === request.warId &&
        item.status === "selected"
      ).length;

      if (selectedCount >= capacity) {
        throw new Error("ظرفیت جنگ تکمیل شده است.");
      }
    }
  }

  const cleanReviewNote =
    typeof reviewNote === "string"
      ? reviewNote.trim().slice(0, 500)
      : "";

  await updateRecord(`${REQUESTS_PATH}/${requestId}`, {
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

  const request = await getRecord(`${REQUESTS_PATH}/${requestId}`);

  if (!request || request.memberUid !== actor.uid) {
    throw new Error("درخواست موردنظر متعلق به شما نیست.");
  }

  if (!["pending", "selected"].includes(request.status)) {
    throw new Error("این درخواست قابل انصراف نیست.");
  }

  await updateRecord(`${REQUESTS_PATH}/${requestId}`, {
    status: "withdrawn",
    updatedAt: Date.now(),
    withdrawnAt: Date.now()
  });

  return true;
}

// تغییر ظرفیت جنگ توسط مدیریت
export async function updateWarCapacity(warId, capacity, actor) {
  requireStaff(actor);

  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 100
  ) {
    throw new Error("ظرفیت باید عددی بین ۱ تا ۱۰۰ باشد.");
  }

  const war = await getWar(warId);

  const requests = await getAllRecords(REQUESTS_PATH);

  const selectedCount = requests.filter(request =>
    request.warId === warId &&
    request.status === "selected"
  ).length;

  if (capacity < selectedCount) {
    throw new Error("ظرفیت جدید از تعداد اعضای انتخاب‌شده کمتر است.");
  }

  await updateRecord(`${WARS_PATH}/${warId}`, {
    capacity,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });

  return true;
}

// باز و بسته کردن ثبت‌نام جنگ
export async function setWarRegistration(warId, isOpen, actor) {
  requireStaff(actor);

  if (typeof isOpen !== "boolean") {
    throw new Error("وضعیت ثبت‌نام معتبر نیست.");
  }

  await getWar(warId);

  await updateRecord(`${WARS_PATH}/${warId}`, {
    registrationOpen: isOpen,
    registrationUpdatedAt: Date.now(),
    registrationUpdatedBy: actor.uid
  });

  return true;
}
