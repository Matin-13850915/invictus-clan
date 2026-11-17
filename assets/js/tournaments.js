
import {
  createRecord,
  readData,
  updateData,
  deleteData
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "tournaments";

function requireStaff(actor) {
  if (
    !actor?.uid ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت مسابقات را دارند.");
  }
}

function validateTournament(data) {
  const title = normalizeText(data?.title);
  const description = normalizeText(data?.description || "");
  const type = data?.type;
  const startAt = Number(data?.startAt);
  const capacity = Number(data?.capacity);

  if (title.length < 3 || title.length > 80) {
    throw new Error("عنوان مسابقه باید بین ۳ تا ۸۰ حرف باشد.");
  }

  if (description.length > 1000) {
    throw new Error("توضیحات مسابقه حداکثر ۱۰۰۰ حرف است.");
  }

  if (!["MP", "BR"].includes(type)) {
    throw new Error("نوع مسابقه باید MP یا BR باشد.");
  }

  if (!Number.isFinite(startAt) || startAt <= 0) {
    throw new Error("تاریخ مسابقه معتبر نیست.");
  }

  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 256) {
    throw new Error("ظرفیت مسابقه باید بین ۲ تا ۲۵۶ نفر باشد.");
  }

  return { title, description, type, startAt, capacity };
}

export async function createTournament(data, actor) {
  requireStaff(actor);

  const tournament = validateTournament(data);

  return await createRecord(PATH, {
    ...tournament,
    status: "registration",
    participants: {},
    results: {},
    championUid: null,
    createdBy: actor.uid,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

export async function getTournaments(options = {}) {
  const data = await readData(PATH);

  if (!data) return [];

  return Object.entries(data)
    .map(([id, item]) => ({ id, ...item }))
    .filter(item => {
      if (options.status && item.status !== options.status) {
        return false;
      }

      if (options.type && item.type !== options.type) {
        return false;
      }

      if (!options.includeArchived && item.archived === true) {
        return false;
      }

      return true;
    })
    .sort((a, b) => a.startAt - b.startAt);
}

export async function requestTournament(data, requester) {
  if (!requester?.uid || requester.active !== true) {
    throw new Error("فقط اعضای فعال می‌توانند درخواست مسابقه بدهند.");
  }

  const title = normalizeText(data?.title);
  const description = normalizeText(data?.description || "");
  const type = data?.type;

  if (title.length < 3 || title.length > 80) {
    throw new Error("عنوان درخواست باید بین ۳ تا ۸۰ حرف باشد.");
  }

  if (!["MP", "BR"].includes(type)) {
    throw new Error("نوع مسابقه معتبر نیست.");
  }

  return await createRecord("tournamentRequests", {
    title,
    description,
    type,
    requestedBy: requester.uid,
    status: "pending",
    createdAt: Date.now()
  });
}

export async function registerParticipant(
  tournamentId,
  memberUid,
  actor
) {
  if (!actor?.uid || actor.active !== true) {
    throw new Error("فقط اعضای فعال اجازه ثبت‌نام دارند.");
  }

  if (!tournamentId || memberUid !== actor.uid) {
    throw new Error("فقط می‌توانید حساب خودتان را ثبت‌نام کنید.");
  }

  const path = `${PATH}/${tournamentId}`;
  const tournament = await readData(path);

  if (!tournament || tournament.status !== "registration") {
    throw new Error("ثبت‌نام این مسابقه فعال نیست.");
  }

  const participants = tournament.participants || {};

  if (participants[memberUid]) {
    throw new Error("قبلاً در این مسابقه ثبت‌نام کرده‌اید.");
  }

  if (Object.keys(participants).length >= tournament.capacity) {
    throw new Error("ظرفیت مسابقه تکمیل شده است.");
  }

  await updateData(`${path}/participants`, {
    [memberUid]: {
      registeredAt: Date.now(),
      status: "registered"
    }
  });

  return true;
}

export async function setTournamentStatus(
  tournamentId,
  status,
  actor
) {
  requireStaff(actor);

  const allowed = [
    "registration",
    "ongoing",
    "completed",
    "cancelled"
  ];

  if (!tournamentId || !allowed.includes(status)) {
    throw new Error("وضعیت مسابقه معتبر نیست.");
  }

  await updateData(`${PATH}/${tournamentId}`, {
    status,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function recordTournamentResult(
  tournamentId,
  memberUid,
  result,
  actor
) {
  requireStaff(actor);

  if (!tournamentId || !memberUid) {
    throw new Error("اطلاعات نتیجه معتبر نیست.");
  }

  const allowed = ["win", "loss", "draw"];

  if (!allowed.includes(result)) {
    throw new Error("نتیجه معتبر نیست.");
  }

  await updateData(
    `${PATH}/${tournamentId}/results`,
    {
      [memberUid]: {
        result,
        recordedBy: actor.uid,
        recordedAt: Date.now()
      }
    }
  );

  return true;
}

export async function setTournamentChampion(
  tournamentId,
  championUid,
  actor
) {
  requireStaff(actor);

  if (!tournamentId || !championUid) {
    throw new Error("قهرمان مسابقه مشخص نشده است.");
  }

  const tournament = await readData(`${PATH}/${tournamentId}`);

  if (!tournament?.participants?.[championUid]) {
    throw new Error("قهرمان باید از شرکت‌کنندگان مسابقه باشد.");
  }

  await updateData(`${PATH}/${tournamentId}`, {
    championUid,
    status: "completed",
    completedAt: Date.now(),
    completedBy: actor.uid
  });

  return true;
}

export async function deleteTournament(tournamentId, actor) {
  requireStaff(actor);

  if (!tournamentId) {
    throw new Error("شناسه مسابقه معتبر نیست.");
  }

  await deleteData(`${PATH}/${tournamentId}`);

  return true;
    }
