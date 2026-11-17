
import {
  createRecord,
  readData,
  updateData
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "seasons";

function requireAdmin(actor) {
  if (!actor?.uid || actor.role !== "admin") {
    throw new Error("فقط ادمین اجازه مدیریت فصل‌ها را دارد.");
  }
}

function validateSeason(data) {
  const name = normalizeText(data?.name);
  const description = normalizeText(data?.description || "");
  const startAt = Number(data?.startAt);
  const endAt = Number(data?.endAt);

  if (name.length < 2 || name.length > 60) {
    throw new Error("نام فصل باید بین ۲ تا ۶۰ حرف باشد.");
  }

  if (description.length > 500) {
    throw new Error("توضیحات فصل حداکثر ۵۰۰ حرف است.");
  }

  if (
    !Number.isFinite(startAt) ||
    !Number.isFinite(endAt) ||
    startAt <= 0 ||
    endAt <= startAt
  ) {
    throw new Error("تاریخ شروع و پایان فصل معتبر نیست.");
  }

  return { name, description, startAt, endAt };
}

export async function createSeason(data, actor) {
  requireAdmin(actor);

  const season = validateSeason(data);

  return await createRecord(PATH, {
    ...season,
    active: false,
    paused: false,
    createdBy: actor.uid,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

export async function getSeasons() {
  const data = await readData(PATH);

  if (!data) return [];

  return Object.entries(data)
    .map(([id, season]) => ({ id, ...season }))
    .sort((a, b) => b.startAt - a.startAt);
}

export async function getActiveSeason() {
  const seasons = await getSeasons();

  return seasons.find(
    season => season.active === true && season.paused !== true
  ) || null;
}

export async function updateSeason(seasonId, data, actor) {
  requireAdmin(actor);

  if (!seasonId) {
    throw new Error("شناسه فصل معتبر نیست.");
  }

  const season = validateSeason(data);

  await updateData(`${PATH}/${seasonId}`, {
    ...season,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function activateSeason(seasonId, actor) {
  requireAdmin(actor);

  if (!seasonId) {
    throw new Error("شناسه فصل معتبر نیست.");
  }

  const seasons = await getSeasons();

  if (!seasons.some(season => season.id === seasonId)) {
    throw new Error("فصل موردنظر پیدا نشد.");
  }

  const changes = {};

  for (const season of seasons) {
    changes[`${PATH}/${season.id}/active`] = season.id === seasonId;
    changes[`${PATH}/${season.id}/paused`] = false;
  }

  const { update, ref, db } = await import("./firebase.js");

  await update(ref(db), changes);

  return true;
}

export async function pauseSeason(seasonId, paused, actor) {
  requireAdmin(actor);

  if (!seasonId || typeof paused !== "boolean") {
    throw new Error("اطلاعات توقف فصل معتبر نیست.");
  }

  await updateData(`${PATH}/${seasonId}`, {
    paused,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function archiveSeason(seasonId, actor) {
  requireAdmin(actor);

  if (!seasonId) {
    throw new Error("شناسه فصل معتبر نیست.");
  }

  await updateData(`${PATH}/${seasonId}`, {
    archived: true,
    active: false,
    archivedBy: actor.uid,
    archivedAt: Date.now()
  });

  return true;
}
