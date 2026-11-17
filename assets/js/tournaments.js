
import {
  createRecord,
  readData,
  updateData,
  deleteData
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "tournaments";
const REQUESTS_PATH = "tournamentRequests";

const STAFF_ROLES = ["admin", "leader"];

function requireActiveUser(actor) {
  if (!actor?.uid || actor.active !== true) {
    throw new Error("فقط کاربران فعال اجازه انجام این عملیات را دارند.");
  }
}

function requireStaff(actor) {
  requireActiveUser(actor);

  if (!STAFF_ROLES.includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت مسابقات را دارند.");
  }
}

function requireAdmin(actor) {
  requireActiveUser(actor);

  if (actor.role !== "admin") {
    throw new Error("این عملیات فقط برای ادمین مجاز است.");
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

function validateTournament(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات مسابقه معتبر نیست.");
  }

  const title = normalizeText(data.title || "");
  const description = normalizeText(data.description || "");
  const type = data.type;
  const startAt = Number(data.startAt);
  const capacity = Number(data.capacity);

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

  if (
    !Number.isInteger(capacity) ||
    capacity < 2 ||
    capacity > 256
  ) {
    throw new Error("ظرفیت مسابقه باید بین ۲ تا ۲۵۶ نفر باشد.");
  }

  return { title, description, type, startAt, capacity };
}

async function getTournamentOrThrow(tournamentId) {
  const id = validateId(tournamentId, "شناسه مسابقه");
  const tournament = await readData(`${PATH}/${id}`);

  if (!tournament || typeof tournament !== "object") {
    throw new Error("مسابقه موردنظر پیدا نشد.");
  }

  return { id, ...tournament };
}

export async function createTournament(data, actor) {
  requireStaff(actor);

  const tournament = validateTournament(data);
  const now = Date.now();

  return await createRecord(PATH, {
    ...tournament,
    status: "registration",
    participants: {},
    results: {},
    championUid: null,
    archived: false,
    createdBy: actor.uid,
    createdAt: now,
    updatedAt: now
  });
}

export async function getTournaments(options = {}, actor = null) {
  if (options.includeArchived === true) {
    requireStaff(actor);
  }

  const data = await readData(PATH);

  if (!data || typeof data !== "object") return [];

  return Object.entries(data)
    .filter(([, item]) => item && typeof item === "object")
    .map(([id, item]) => ({ ...item, id }))
    .filter(item => {
      if (
        options.status &&
        item.status !== options.status
      ) {
        return false;
      }

      if (
        options.type &&
        item.type !== options.type
      ) {
        return false;
      }

      if (
        !options.includeArchived &&
        item.archived === true
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => (a.startAt || 0) - (b.startAt || 0));
}

export async function getTournament(tournamentId) {
  const tournament = await getTournamentOrThrow(tournamentId);

  if (tournament.archived === true) {
    return null;
  }

  return tournament;
}

export async function requestTournament(data, requester) {
  requireActiveUser(requester);

  if (!data || typeof data !== "object") {
    throw new Error("اطلاعات درخواست معتبر نیست.");
  }

  const title = normalizeText(data.title || "");
  const description = normalizeText(data.description || "");
  const type = data.type;

  if (title.length < 3 || title.length > 80) {
    throw new Error("عنوان درخواست باید بین ۳ تا ۸۰ حرف باشد.");
  }

  if (description.length > 1000) {
    throw new Error("توضیحات درخواست حداکثر ۱۰۰۰ حرف است.");
  }

  if (!["MP", "BR"].includes(type)) {
    throw new Error("نوع مسابقه معتبر نیست.");
  }

  return await createRecord(REQUESTS_PATH, {
    title,
    description,
    type,
    requestedBy: requester.uid,
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

export async function getTournamentRequests(actor) {
  requireStaff(actor);

  const data = await readData(REQUESTS_PATH);

  if (!data || typeof data !== "object") return [];

  return Object.entries(data)
    .filter(([, item]) => item && typeof item === "object")
    .map(([id, item]) => ({ ...item, id }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function reviewTournamentRequest(
  requestId,
  decision,
  note,
  actor
) {
  requireStaff(actor);

  const id = validateId(requestId, "شناسه درخواست");

  if (!["approved", "rejected"].includes(decision)) {
    throw new Error("تصمیم ثبت‌شده معتبر نیست.");
  }

  const request = await readData(`${REQUESTS_PATH}/${id}`);

  if (!request) {
    throw new Error("درخواست مسابقه پیدا نشد.");
  }

  if (request.status !== "pending") {
    throw new Error("این درخواست قبلاً بررسی شده است.");
  }

  const cleanNote = normalizeText(note || "");

  if (cleanNote.length > 500) {
    throw new Error("توضیحات بررسی حداکثر ۵۰۰ حرف است.");
  }

  await updateData(`${REQUESTS_PATH}/${id}`, {
    status: decision,
    reviewNote: cleanNote,
    reviewedBy: actor.uid,
    reviewedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

export async function registerParticipant(
  tournamentId,
  memberUid,
  actor
) {
  requireActiveUser(actor);

  const id = validateId(tournamentId, "شناسه مسابقه");
  const uid = validateId(memberUid, "شناسه عضو");

  if (uid !== actor.uid) {
    throw new Error("فقط می‌توانید حساب خودتان را ثبت‌نام کنید.");
  }

  const tournament = await getTournamentOrThrow(id);

  if (
    tournament.archived === true ||
    tournament.status !== "registration"
  ) {
    throw new Error("ثبت‌نام این مسابقه فعال نیست.");
  }

  const participants = tournament.participants || {};

  if (participants[uid]) {
    throw new Error("قبلاً در این مسابقه ثبت‌نام کرده‌اید.");
  }

  if (Object.keys(participants).length >= tournament.capacity) {
    throw new Error("ظرفیت مسابقه تکمیل شده است.");
  }

  await updateData(`${PATH}/${id}/participants`, {
    [uid]: {
      registeredAt: Date.now(),
      status: "registered"
    }
  });

  await updateData(`${PATH}/${id}`, {
    updatedAt: Date.now()
  });

  return true;
}

export async function unregisterParticipant(
  tournamentId,
  actor
) {
  requireActiveUser(actor);

  const id = validateId(tournamentId, "شناسه مسابقه");
  const tournament = await getTournamentOrThrow(id);

  if (tournament.status !== "registration") {
    throw new Error("لغو ثبت‌نام فقط پیش از شروع مسابقه ممکن است.");
  }

  if (!tournament.participants?.[actor.uid]) {
    throw new Error("شما در این مسابقه ثبت‌نام نکرده‌اید.");
  }

  const { deleteData } = await import("./database.js");

  await deleteData(
    `${PATH}/${id}/participants/${actor.uid}`
  );

  await updateData(`${PATH}/${id}`, {
    updatedAt: Date.now()
  });

  return true;
}

export async function setTournamentStatus(
  tournamentId,
  status,
  actor
) {
  requireStaff(actor);

  const id = validateId(tournamentId, "شناسه مسابقه");
  const allowed = [
    "registration",
    "ongoing",
    "completed",
    "cancelled"
  ];

  if (!allowed.includes(status)) {
    throw new Error("وضعیت مسابقه معتبر نیست.");
  }

  const tournament = await getTournamentOrThrow(id);

  if (tournament.archived === true) {
    throw new Error("مسابقه بایگانی‌شده قابل تغییر وضعیت نیست.");
  }

  if (
    status === "ongoing" &&
    Object.keys(tournament.participants || {}).length < 2
  ) {
    throw new Error("برای شروع مسابقه حداقل دو شرکت‌کننده لازم است.");
  }

  await updateData(`${PATH}/${id}`, {
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

  const id = validateId(tournamentId, "شناسه مسابقه");
  const uid = validateId(memberUid, "شناسه شرکت‌کننده");

  if (!["win", "loss", "draw"].includes(result)) {
    throw new Error("نتیجه معتبر نیست.");
  }

  const tournament = await getTournamentOrThrow(id);

  if (tournament.status !== "ongoing") {
    throw new Error("ثبت نتیجه فقط برای مسابقه در حال برگزاری مجاز است.");
  }

  if (!tournament.participants?.[uid]) {
    throw new Error("این فرد شرکت‌کننده مسابقه نیست.");
  }

  await updateData(`${PATH}/${id}/results`, {
    [uid]: {
      result,
      recordedBy: actor.uid,
      recordedAt: Date.now()
    }
  });

  await updateData(`${PATH}/${id}`, {
    updatedAt: Date.now()
  });

  return true;
}

export async function setTournamentChampion(
  tournamentId,
  championUid,
  actor
) {
  requireStaff(actor);

  const id = validateId(tournamentId, "شناسه مسابقه");
  const uid = validateId(championUid, "شناسه قهرمان");

  const tournament = await getTournamentOrThrow(id);

  if (tournament.status !== "ongoing") {
    throw new Error("تعیین قهرمان فقط برای مسابقه در حال برگزاری ممکن است.");
  }

  if (!tournament.participants?.[uid]) {
    throw new Error("قهرمان باید از شرکت‌کنندگان مسابقه باشد.");
  }

  if (tournament.results?.[uid]?.result !== "win") {
    throw new Error("برای انتخاب قهرمان باید نتیجه برد ثبت شده باشد.");
  }

  await updateData(`${PATH}/${id}`, {
    championUid: uid,
    status: "completed",
    completedAt: Date.now(),
    completedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function archiveTournament(tournamentId, actor) {
  requireStaff(actor);

  const id = validateId(tournamentId, "شناسه مسابقه");
  const tournament = await getTournamentOrThrow(id);

  if (
    tournament.status !== "completed" &&
    tournament.status !== "cancelled"
  ) {
    throw new Error("فقط مسابقه تمام‌شده یا لغوشده قابل بایگانی است.");
  }

  await updateData(`${PATH}/${id}`, {
    archived: true,
    archivedBy: actor.uid,
    archivedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

export async function deleteTournament(tournamentId, actor) {
  requireAdmin(actor);

  const id = validateId(tournamentId, "شناسه مسابقه");
  const tournament = await getTournamentOrThrow(id);

  if (
    tournament.status !== "completed" &&
    tournament.status !== "cancelled"
  ) {
    throw new Error("مسابقه فعال را نمی‌توان حذف کرد.");
  }

  await deleteData(`${PATH}/${id}`);

  return true;
    }
    
