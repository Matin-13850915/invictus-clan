
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateData,
  deleteData
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "wars";

const WAR_TYPES = ["MP", "BR"];
const WAR_RESULTS = ["pending", "win", "loss", "draw", "cancelled"];

function requireStaff(actor) {
  if (!actor?.uid || !["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت جنگ‌ها را دارند.");
  }
}

function validateId(id, label = "شناسه جنگ") {
  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(id)
  ) {
    throw new Error(`${label} معتبر نیست.`);
  }

  return id;
}

function cleanText(value, maxLength, field = "متن", allowEmpty = false) {
  if (typeof value !== "string") {
    throw new Error(`${field} معتبر نیست.`);
  }

  const result = normalizeText(value.trim());

  if (
    (!allowEmpty && !result) ||
    result.length > maxLength
  ) {
    throw new Error(`${field} نمی‌تواند خالی یا بیشتر از ${maxLength} کاراکتر باشد.`);
  }

  return result;
}

function validateWar(data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error("اطلاعات جنگ معتبر نیست.");
  }

  const opponent = cleanText(data.opponent, 60, "نام حریف");
  const type = String(data.type || "").toUpperCase();
  const date = Number(data.date);
  const description = cleanText(
    data.description || "",
    1000,
    "توضیحات",
    true
  );

  if (opponent.length < 2) {
    throw new Error("نام کلن حریف باید حداقل ۲ کاراکتر باشد.");
  }

  if (!WAR_TYPES.includes(type)) {
    throw new Error("نوع جنگ باید MP یا BR باشد.");
  }

  if (
    !Number.isSafeInteger(date) ||
    date <= 0
  ) {
    throw new Error("تاریخ جنگ معتبر نیست.");
  }

  return {
    opponent,
    type,
    date,
    description
  };
}

function normalizeWar(item) {
  return {
    id: item.id,
    opponent: item.opponent || "",
    type: item.type || "",
    date: Number(item.date) || 0,
    description: item.description || "",
    result: WAR_RESULTS.includes(item.result)
      ? item.result
      : "pending",
    winner: item.winner || null,
    participants:
      item.participants &&
      typeof item.participants === "object" &&
      !Array.isArray(item.participants)
        ? item.participants
        : {},
    archived: item.archived === true,
    capacity: Number(item.capacity) || null,
    registrationOpen: item.registrationOpen === true,
    createdBy: item.createdBy || "",
    createdAt: Number(item.createdAt) || 0,
    updatedAt: Number(item.updatedAt) || 0
  };
}

async function getExistingWar(warId) {
  const id = validateId(warId);
  const war = await getRecord(`${PATH}/${id}`);

  if (!war) {
    throw new Error("جنگ موردنظر پیدا نشد.");
  }

  return { ...war, id };
}

// ایجاد جنگ جدید
export async function createWar(data, actor) {
  requireStaff(actor);

  const war = validateWar(data);
  const now = Date.now();

  const id = await createRecord(PATH, {
    ...war,
    result: "pending",
    participants: {},
    winner: null,
    archived: false,
    capacity: null,
    registrationOpen: false,
    createdBy: actor.uid,
    createdAt: now,
    updatedAt: now
  });

  return id;
}

// دریافت فهرست جنگ‌ها
export async function getWars(options = {}) {
  if (
    !options ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new Error("فیلترهای جنگ معتبر نیستند.");
  }

  if (
    options.type &&
    !WAR_TYPES.includes(options.type)
  ) {
    throw new Error("فیلتر نوع جنگ معتبر نیست.");
  }

  if (
    options.result &&
    !WAR_RESULTS.includes(options.result)
  ) {
    throw new Error("فیلتر نتیجه جنگ معتبر نیست.");
  }

  const wars = await getAllRecords(PATH);

  return wars
    .filter(war =>
      options.includeArchived === true ||
      war.archived !== true
    )
    .filter(war =>
      !options.type || war.type === options.type
    )
    .filter(war =>
      !options.result || war.result === options.result
    )
    .filter(war =>
      options.fromDate == null ||
      Number(war.date) >= Number(options.fromDate)
    )
    .filter(war =>
      options.toDate == null ||
      Number(war.date) <= Number(options.toDate)
    )
    .map(normalizeWar)
    .sort((a, b) => b.date - a.date);
}

// دریافت یک جنگ
export async function getWar(warId) {
  validateId(warId);

  const war = await getRecord(`${PATH}/${warId}`);

  return war ? normalizeWar(war) : null;
}

// ویرایش جنگ
export async function updateWar(warId, data, actor) {
  requireStaff(actor);

  const id = validateId(warId);
  const existing = await getExistingWar(id);

  if (existing.archived === true) {
    throw new Error("جنگ بایگانی‌شده قابل ویرایش نیست.");
  }

  const war = validateWar(data);

  await updateData(`${PATH}/${id}`, {
    ...war,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

// ثبت نتیجه جنگ
export async function setWarResult(warId, result, winner, actor) {
  requireStaff(actor);

  const id = validateId(warId);

  if (!WAR_RESULTS.includes(result)) {
    throw new Error("نتیجه جنگ معتبر نیست.");
  }

  const existing = await getExistingWar(id);

  if (existing.archived === true) {
    throw new Error("نتیجه جنگ بایگانی‌شده قابل تغییر نیست.");
  }

  if (result === "pending") {
    throw new Error("برای بازگرداندن نتیجه به حالت انتظار، از مدیریت جنگ استفاده کنید.");
  }

  const cleanWinner = result === "win"
    ? cleanText(winner, 80, "نام برنده")
    : null;

  const now = Date.now();

  await updateData(`${PATH}/${id}`, {
    result,
    winner: cleanWinner,
    resultRecordedBy: actor.uid,
    resultRecordedAt: now,
    updatedBy: actor.uid,
    updatedAt: now
  });

  return true;
}

// تعیین شرکت‌کنندگان جنگ
export async function setWarParticipants(
  warId,
  participantUids,
  actor
) {
  requireStaff(actor);

  const id = validateId(warId);

  if (!Array.isArray(participantUids)) {
    throw new Error("فهرست بازیکنان معتبر نیست.");
  }

  const existing = await getExistingWar(id);

  if (existing.archived === true) {
    throw new Error("شرکت‌کنندگان جنگ بایگانی‌شده قابل تغییر نیستند.");
  }

  const uniqueUids = [...new Set(participantUids)];

  if (uniqueUids.length > 100) {
    throw new Error("تعداد شرکت‌کنندگان نمی‌تواند بیشتر از ۱۰۰ نفر باشد.");
  }

  const participants = {};

  for (const uid of uniqueUids) {
    if (
      typeof uid !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(uid)
    ) {
      throw new Error("شناسه یکی از بازیکنان معتبر نیست.");
    }

    participants[uid] = true;
  }

  await updateData(`${PATH}/${id}`, {
    participants,
    participantsUpdatedBy: actor.uid,
    participantsUpdatedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

// بایگانی جنگ
export async function archiveWar(warId, actor) {
  requireStaff(actor);

  const id = validateId(warId);
  const existing = await getExistingWar(id);

  if (existing.archived === true) {
    throw new Error("این جنگ قبلاً بایگانی شده است.");
  }

  const now = Date.now();

  await updateData(`${PATH}/${id}`, {
    archived: true,
    registrationOpen: false,
    archivedBy: actor.uid,
    archivedAt: now,
    updatedAt: now
  });

  return true;
}

// بازگرداندن جنگ از بایگانی
export async function restoreWar(warId, actor) {
  requireStaff(actor);

  const id = validateId(warId);
  const existing = await getExistingWar(id);

  if (existing.archived !== true) {
    throw new Error("این جنگ در بایگانی نیست.");
  }

  await updateData(`${PATH}/${id}`, {
    archived: false,
    registrationOpen: false,
    restoredBy: actor.uid,
    restoredAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

// حذف دائمی جنگ
export async function deleteWar(warId, actor) {
  requireStaff(actor);

  if (actor.role !== "admin") {
    throw new Error("حذف دائمی جنگ فقط با اجازه ادمین امکان‌پذیر است.");
  }

  const id = validateId(warId);
  await getExistingWar(id);

  await deleteData(`${PATH}/${id}`);

  return true;
    }
  
