
import {
  createRecord,
  readData,
  updateData
} from "./database.js";

import { normalizeText } from "./utils.js";
import { canManageSeasons } from "./permissions.js";

const PATH = "seasons";

function requireManager(actor) {
  if (!canManageSeasons(actor)) {
    throw new Error("اجازه مدیریت فصل‌ها را ندارید.");
  }
}

function validateId(id) {
  if (
    typeof id !== "string" ||
    !id.trim() ||
    /[.#$[\]/]/.test(id)
  ) {
    throw new Error("شناسه فصل معتبر نیست.");
  }

  return id.trim();
}

function validateSeason(data) {
  const name = normalizeText(data?.name || "");
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
    !Number.isSafeInteger(startAt) ||
    !Number.isSafeInteger(endAt) ||
    startAt <= 0 ||
    endAt <= startAt
  ) {
    throw new Error("تاریخ شروع و پایان فصل معتبر نیست.");
  }

  return { name, description, startAt, endAt };
}

function normalizeSeasons(data) {
  if (!data || typeof data !== "object") return [];

  return Object.entries(data)
    .filter(([, season]) =>
      season &&
      typeof season === "object" &&
      !Array.isArray(season)
    )
    .map(([id, season]) => ({
      ...season,
      id
    }))
    .sort((a, b) => Number(b.startAt) - Number(a.startAt));
}

export async function createSeason(data, actor) {
  requireManager(actor);

  const season = validateSeason(data);
  const now = Date.now();

  return createRecord(PATH, {
    ...season,
    active: false,
    paused: false,
    archived: false,
    createdBy: actor.uid,
    createdAt: now,
    updatedAt: now
  });
}

export async function getSeasons() {
  const data = await readData(PATH);
  return normalizeSeasons(data);
}

export async function getActiveSeason() {
  const seasons = await getSeasons();

  return seasons.find(season =>
    season.active === true &&
    season.paused !== true &&
    season.archived !== true
  ) || null;
}

export async function updateSeason(seasonId, data, actor) {
  requireManager(actor);

  const id = validateId(seasonId);
  const season = validateSeason(data);

  const existing = await readData(`${PATH}/${id}`);

  if (!existing) {
    throw new Error("فصل موردنظر پیدا نشد.");
  }

  if (existing.archived === true) {
    throw new Error("فصل آرشیوشده قابل ویرایش نیست.");
  }

  await updateData(`${PATH}/${id}`, {
    ...season,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function activateSeason(seasonId, actor) {
  requireManager(actor);

  const id = validateId(seasonId);
  const seasons = await getSeasons();

  const target = seasons.find(season => season.id === id);

  if (!target) {
    throw new Error("فصل موردنظر پیدا نشد.");
  }

  if (target.archived === true) {
    throw new Error("فصل آرشیوشده قابل فعال‌سازی نیست.");
  }

  const changes = {};

  for (const season of seasons) {
    if (season.archived === true) continue;

    changes[`${PATH}/${season.id}/active`] =
      season.id === id;

    changes[`${PATH}/${season.id}/paused`] = false;
    changes[`${PATH}/${season.id}/updatedAt`] = Date.now();
    changes[`${PATH}/${season.id}/updatedBy`] = actor.uid;
  }

  const { update, ref, db } = await import("./firebase.js");

  await update(ref(db), changes);

  return true;
}

export async function pauseSeason(seasonId, paused, actor) {
  requireManager(actor);

  const id = validateId(seasonId);

  if (typeof paused !== "boolean") {
    throw new Error("وضعیت توقف فصل معتبر نیست.");
  }

  const existing = await readData(`${PATH}/${id}`);

  if (!existing) {
    throw new Error("فصل موردنظر پیدا نشد.");
  }

  if (existing.archived === true) {
    throw new Error("فصل آرشیوشده قابل توقف یا ادامه نیست.");
  }

  await updateData(`${PATH}/${id}`, {
    paused,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function archiveSeason(seasonId, actor) {
  requireManager(actor);

  const id = validateId(seasonId);
  const existing = await readData(`${PATH}/${id}`);

  if (!existing) {
    throw new Error("فصل موردنظر پیدا نشد.");
  }

  if (existing.archived === true) {
    throw new Error("این فصل قبلاً آرشیو شده است.");
  }

  await updateData(`${PATH}/${id}`, {
    archived: true,
    active: false,
    paused: false,
    archivedBy: actor.uid,
    archivedAt: Date.now(),
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}
