
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

function validateId(id) {
  if (
    typeof id !== "string" ||
    !id.trim() ||
    /[.#$/[\]]/.test(id)
  ) {
    throw new Error("شناسه جنگ معتبر نیست.");
  }
}

function cleanText(value, maxLength) {
  return normalizeText(String(value ?? "").trim()).slice(0, maxLength);
}

function validateWar(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات جنگ معتبر نیست.");
  }

  const opponent = cleanText(data.opponent, 60);
  const type = String(data.type || "").toUpperCase();
  const date = Number(data.date);
  const description = cleanText(data.description, 1000);

  if (opponent.length < 2) {
    throw new Error("نام کلن حریف باید حداقل ۲ حرف باشد.");
  }

  if (!WAR_TYPES.includes(type)) {
    throw new Error("نوع جنگ باید MP یا BR باشد.");
  }

  if (!Number.isFinite(date) || date <= 0) {
    throw new Error("تاریخ جنگ معتبر نیست.");
  }

  return { opponent, type, date, description };
}

function normalizeWar(item) {
  return {
    id: item.id,
    opponent: item.opponent || "",
    type: item.type || "",
    date: Number(item.date) || 0,
    description: item.description || "",
    result: item.result || "pending",
    winner: item.winner || null,
    participants:
      item.participants &&
      typeof item.participants === "object" &&
      !Array.isArray(item.participants)
        ? item.participants
        : {},
    archived: item.archived === true,
    createdBy: item.createdBy || "",
    createdAt: Number(item.createdAt) || 0,
    updatedAt: Number(item.updatedAt) || 0
  };
}

export async function createWar(data, actor) {
  requireStaff(actor);

  const war = validateWar(data);
  const now = Date.now();

  return createRecord(PATH, {
    ...war,
    result: "pending",
    participants: {},
    winner: null,
    archived: false,
    createdBy: actor.uid,
    createdAt: now,
    updatedAt: now
  });
}

export async function getWars(options = {}) {
  const wars = await getAllRecords(PATH);

  return wars
    .filter(war => options.includeArchived || war.archived !== true)
    .filter(war => !options.type || war.type === options.type)
    .filter(war => !options.result || war.result === options.result)
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

export async function getWar(warId) {
  validateId(warId);

  const war = await getRecord(`${PATH}/${warId}`);

  return war ? normalizeWar(war) : null;
}

export async function updateWar(warId, data, actor) {
  requireStaff(actor);
  validateId(warId);

  const existing = await getRecord(`${PATH}/${warId}`);

  if (!existing) {
    throw new Error("جنگ موردنظر پیدا نشد.");
  }

  if (existing.archived === true) {
    throw new Error("جنگ آرشیوشده قابل ویرایش نیست.");
  }

  const war = validateWar(data);

  await updateData(`${PATH}/${warId}`, {
    ...war,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function setWarResult(warId, result, winner, actor) {
  requireStaff(actor);
  validateId(warId);

  if (!WAR_RESULTS.includes(result)) {
    throw new Error("نتیجه جنگ معتبر نیست.");
  }

  const existing = await getRecord(`${PATH}/${warId}`);

  if (!existing) {
    throw new Error("جنگ موردنظر پیدا نشد.");
  }

  if (existing.archived === true) {
    throw new Error("نتیجه جنگ آرشیوشده قابل تغییر نیست.");
  }

  const cleanWinner = result === "win"
    ? cleanText(winner, 80)
    : null;

  if (result === "win" && !cleanWinner) {
    throw new Error("نام برنده را مشخص کنید.");
  }

  const now = Date.now();

  await updateData(`${PATH}/${warId}`, {
    result,
    winner: cleanWinner,
    resultRecordedBy: actor.uid,
    resultRecordedAt: now,
    updatedAt: now
  });

  return true;
}

export async function setWarParticipants(
  warId,
  participantUids,
  actor
) {
  requireStaff(actor);
  validateId(warId);

  if (!Array.isArray(participantUids)) {
    throw new Error("فهرست بازیکنان معتبر نیست.");
  }

  const existing = await getRecord(`${PATH}/${warId}`);

  if (!existing) {
    throw new Error("جنگ موردنظر پیدا نشد.");
  }

  if (existing.archived === true) {
    throw new Error("شرکت‌کنندگان جنگ آرشیوشده قابل تغییر نیستند.");
  }

  const uniqueUids = [...new Set(participantUids)];

  if (uniqueUids.length > 100) {
    throw new Error("تعداد شرکت‌کنندگان نمی‌تواند بیشتر از ۱۰۰ نفر باشد.");
  }

  const participants = {};

  for (const uid of uniqueUids) {
    if (
      typeof uid !== "string" ||
      !uid.trim() ||
      /[.#$/[\]]/.test(uid)
    ) {
      throw new Error("شناسه یکی از بازیکنان معتبر نیست.");
    }

    participants[uid] = true;
  }

  await updateData(`${PATH}/${warId}`, {
    participants,
    participantsUpdatedBy: actor.uid,
    participantsUpdatedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

export async function archiveWar(warId, actor) {
  requireStaff(actor);
  validateId(warId);

  const existing = await getRecord(`${PATH}/${warId}`);

  if (!existing) {
    throw new Error("جنگ موردنظر پیدا نشد.");
  }

  await updateData(`${PATH}/${warId}`, {
    archived: true,
    archivedBy: actor.uid,
    archivedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

export async function restoreWar(warId, actor) {
  requireStaff(actor);
  validateId(warId);

  const existing = await getRecord(`${PATH}/${warId}`);

  if (!existing) {
    throw new Error("جنگ موردنظر پیدا نشد.");
  }

  await updateData(`${PATH}/${warId}`, {
    archived: false,
    restoredBy: actor.uid,
    restoredAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

export async function deleteWar(warId, actor) {
  requireStaff(actor);
  validateId(warId);

  const existing = await getRecord(`${PATH}/${warId}`);

  if (!existing) {
    throw new Error("جنگ موردنظر پیدا نشد.");
  }

  await deleteData(`${PATH}/${warId}`);

  return true;
    }
      
