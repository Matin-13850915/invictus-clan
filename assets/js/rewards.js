
import {
  createRecord,
  readData,
  updateData,
  deleteData
} from "./database.js";

import { normalizeText } from "./utils.js";

const REWARDS_PATH = "rewards";
const REQUESTS_PATH = "rewardRequests";
const BALANCE_PATH = "pointBalances";

function requireStaff(actor) {
  if (
    !actor?.uid ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت جوایز را دارند.");
  }
}

function requireAdmin(actor) {
  if (!actor?.uid || actor.role !== "admin") {
    throw new Error("این عملیات مخصوص ادمین است.");
  }
}

function validateReward(data) {
  const title = normalizeText(data?.title);
  const description = normalizeText(data?.description || "");
  const cost = Number(data?.cost);
  const stock = Number(data?.stock);

  if (title.length < 2 || title.length > 80) {
    throw new Error("نام جایزه باید بین ۲ تا ۸۰ حرف باشد.");
  }

  if (description.length > 500) {
    throw new Error("توضیحات جایزه حداکثر ۵۰۰ حرف است.");
  }

  if (!Number.isInteger(cost) || cost < 1 || cost > 1000000) {
    throw new Error("هزینه جایزه معتبر نیست.");
  }

  if (!Number.isInteger(stock) || stock < 0 || stock > 10000) {
    throw new Error("موجودی جایزه معتبر نیست.");
  }

  return { title, description, cost, stock };
}

export async function createReward(data, actor) {
  requireStaff(actor);

  const reward = validateReward(data);

  return await createRecord(REWARDS_PATH, {
    ...reward,
    active: true,
    createdBy: actor.uid,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

export async function getRewards(includeInactive = false) {
  const data = await readData(REWARDS_PATH);

  if (!data) return [];

  return Object.entries(data)
    .map(([id, reward]) => ({ id, ...reward }))
    .filter(reward => includeInactive || reward.active === true)
    .sort((a, b) => a.cost - b.cost);
}

export async function updateReward(rewardId, data, actor) {
  requireStaff(actor);

  if (!rewardId) {
    throw new Error("شناسه جایزه معتبر نیست.");
  }

  const reward = validateReward(data);

  await updateData(`${REWARDS_PATH}/${rewardId}`, {
    ...reward,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function setRewardActive(rewardId, active, actor) {
  requireStaff(actor);

  if (!rewardId || typeof active !== "boolean") {
    throw new Error("اطلاعات وضعیت جایزه معتبر نیست.");
  }

  await updateData(`${REWARDS_PATH}/${rewardId}`, {
    active,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function requestReward(rewardId, member) {
  if (!member?.uid || member.active !== true) {
    throw new Error("فقط اعضای فعال می‌توانند جایزه درخواست کنند.");
  }

  if (!rewardId) {
    throw new Error("شناسه جایزه معتبر نیست.");
  }

  const reward = await readData(`${REWARDS_PATH}/${rewardId}`);

  if (!reward || reward.active !== true) {
    throw new Error("این جایزه در دسترس نیست.");
  }

  if (reward.stock <= 0) {
    throw new Error("موجودی این جایزه تمام شده است.");
  }

  const balance = Number(
    await readData(`${BALANCE_PATH}/${member.uid}`)
  ) || 0;

  if (balance < reward.cost) {
    throw new Error("امتیاز شما برای دریافت این جایزه کافی نیست.");
  }

  return await createRecord(REQUESTS_PATH, {
    rewardId,
    rewardTitle: reward.title,
    cost: reward.cost,
    memberUid: member.uid,
    status: "pending",
    requestedAt: Date.now()
  });
}

export async function getRewardRequests(actor) {
  requireStaff(actor);

  const data = await readData(REQUESTS_PATH);

  if (!data) return [];

  return Object.entries(data)
    .map(([id, request]) => ({ id, ...request }))
    .sort((a, b) => b.requestedAt - a.requestedAt);
}

export async function reviewRewardRequest(
  requestId,
  decision,
  actor,
  note = ""
) {
  requireStaff(actor);

  if (!requestId || !["approved", "rejected"].includes(decision)) {
    throw new Error("تصمیم درخواست معتبر نیست.");
  }

  const request = await readData(`${REQUESTS_PATH}/${requestId}`);

  if (!request || request.status !== "pending") {
    throw new Error("این درخواست وجود ندارد یا قبلاً بررسی شده است.");
  }

  const cleanNote = normalizeText(note);

  if (cleanNote.length > 300) {
    throw new Error("توضیحات حداکثر ۳۰۰ حرف است.");
  }

  await updateData(`${REQUESTS_PATH}/${requestId}`, {
    status: decision,
    reviewNote: cleanNote,
    reviewedBy: actor.uid,
    reviewedAt: Date.now()
  });

  return true;
}

export async function deleteReward(rewardId, actor) {
  requireAdmin(actor);

  if (!rewardId) {
    throw new Error("شناسه جایزه معتبر نیست.");
  }

  await deleteData(`${REWARDS_PATH}/${rewardId}`);

  return true;
                   }
