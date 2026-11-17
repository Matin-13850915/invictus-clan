
import {
  createRecord,
  readData,
  updateData,
  deleteData
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "wars";

const WAR_TYPES = ["MP", "BR"];
const WAR_RESULTS = ["pending", "win", "loss", "draw", "cancelled"];

function requireStaff(actor) {
  if (
    !actor?.uid ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت جنگ‌ها را دارند.");
  }
}

function validateWar(data) {
  if (!data || typeof data !== "object") {
    throw new Error("اطلاعات جنگ معتبر نیست.");
  }

  const opponent = normalizeText(data.opponent);
  const type = data.type;
  const date = Number(data.date);
  const description = normalizeText(data.description || "");

  if (opponent.length < 2 || opponent.length > 60) {
    throw new Error("نام کلن حریف باید بین ۲ تا ۶۰ حرف باشد.");
  }

  if (!WAR_TYPES.includes(type)) {
    throw new Error("نوع جنگ باید MP یا BR باشد.");
  }

  if (!Number.isFinite(date) || date <= 0) {
    throw new Error("تاریخ جنگ معتبر نیست.");
  }

  if (description.length > 1000) {
    throw new Error("توضیحات جنگ حداکثر ۱۰۰۰ حرف است.");
  }

  return {
    opponent,
    type,
    date,
    description
  };
}

export async function createWar(data, actor) {
  requireStaff(actor);

  const war = validateWar(data);

  return await createRecord(PATH, {
    ...war,
    result: "pending",
    participants: {},
    winner: null,
    createdBy: actor.uid,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

export async function getWars(options = {}) {
  const data = await readData(PATH);

  if (!data) return [];

  return Object.entries(data)
    .map(([id, war]) => ({ id, ...war }))
    .filter(war => {
      if (options.type && war.type !== options.type) {
        return false;
      }

      if (
        options.result &&
        war.result !== options.result
      ) {
        return false;
      }

      if (
        options.fromDate &&
        war.date < options.fromDate
      ) {
        return false;
      }

      if (
        options.toDate &&
        war.date > options.toDate
      ) {
        return false;
      }

      if (
        !options.includeArchived &&
        war.archived === true
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => b.date - a.date);
}

export async function updateWar(warId, data, actor) {
  requireStaff(actor);

  if (!warId) {
    throw new Error("شناسه جنگ معتبر نیست.");
  }

  const war = validateWar(data);

  await updateData(`${PATH}/${warId}`, {
    ...war,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function setWarResult(
  warId,
  result,
  winner,
  actor
) {
  requireStaff(actor);

  if (!warId || !WAR_RESULTS.includes(result)) {
    throw new Error("اطلاعات نتیجه جنگ معتبر نیست.");
  }

  if (result === "win" && !winner) {
    throw new Error("نام برنده را مشخص کنید.");
  }

  await updateData(`${PATH}/${warId}`, {
    result,
    winner: result === "win"
      ? normalizeText(winner)
      : null,
    resultRecordedBy: actor.uid,
    resultRecordedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

export async function setWarParticipants(
  warId,
  participantUids,
  actor
) {
  requireStaff(actor);

  if (!warId || !Array.isArray(participantUids)) {
    throw new Error("فهرست بازیکنان معتبر نیست.");
  }

  const participants = {};

  for (const uid of participantUids) {
    if (typeof uid !== "string" || !uid.trim()) {
      throw new Error("شناسه یکی از بازیکنان معتبر نیست.");
    }

    participants[uid] = true;
  }

  await updateData(`${PATH}/${warId}`, {
    participants,
    participantsUpdatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function archiveWar(warId, actor) {
  requireStaff(actor);

  if (!warId) {
    throw new Error("شناسه جنگ معتبر نیست.");
  }

  await updateData(`${PATH}/${warId}`, {
    archived: true,
    archivedBy: actor.uid,
    archivedAt: Date.now()
  });

  return true;
}

export async function deleteWar(warId, actor) {
  requireStaff(actor);

  if (!warId) {
    throw new Error("شناسه جنگ معتبر نیست.");
  }

  await deleteData(`${PATH}/${warId}`);

  return true;
}
