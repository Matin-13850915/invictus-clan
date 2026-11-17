
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

function requireActiveUser(actor) {
  if (!actor?.uid || actor.active !== true) {
    throw new Error("ابتدا باید وارد حساب فعال خود شوید.");
  }
}

function requireStaff(actor) {
  requireActiveUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت جوایز را دارند.");
  }
}

function requireAdmin(actor) {
  requireActiveUser(actor);

  if (actor.role !== "admin") {
    throw new Error("این عملیات مخصوص ادمین است.");
  }
}

function validateId(id, label = "شناسه") {
  if (
    typeof id !== "string" ||
    !id.trim() ||
    id.length > 128 ||
    /[.#$/\[\]]/.test(id)
  ) {
    throw new Error(`${label} معتبر نیست.`);
  }

  return id;
}

function validateReward(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات جایزه معتبر نیست.");
  }

  const title = normalizeText(data.title);
  const description = normalizeText(data.description || "");
  const cost = Number(data.cost);
  const stock = Number(data.stock);

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
  const now = Date.now();

  return createRecord(REWARDS_PATH, {
    ...reward,
    active: true,
    createdBy: actor.uid,
    createdAt: now,
    updatedAt: now
  });
}

export async function getRewards(includeInactive = false, actor = null) {
  if (includeInactive) {
    requireStaff(actor);
  }

  const data = await readData(REWARDS_PATH);

  if (!data || typeof data !== "object") return [];

  return Object.entries(data)
    .filter(([, reward]) => reward && typeof reward === "object")
    .map(([id, reward]) => ({ id, ...reward }))
    .filter(reward =>
      includeInactive || reward.active === true
    )
    .sort((a, b) => Number(a.cost) - Number(b.cost));
}

export async function updateReward(rewardId, data, actor) {
  requireStaff(actor);
  validateId(rewardId, "شناسه جایزه");

  const existing = await readData(`${REWARDS_PATH}/${rewardId}`);

  if (!existing) {
    throw new Error("جایزه موردنظر پیدا نشد.");
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
  validateId(rewardId, "شناسه جایزه");

  if (typeof active !== "boolean") {
    throw new Error("وضعیت جایزه معتبر نیست.");
  }

  const existing = await readData(`${REWARDS_PATH}/${rewardId}`);

  if (!existing) {
    throw new Error("جایزه موردنظر پیدا نشد.");
  }

  await updateData(`${REWARDS_PATH}/${rewardId}`, {
    active,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function requestReward(rewardId, member) {
  requireActiveUser(member);
  validateId(rewardId, "شناسه جایزه");

  const reward = await readData(`${REWARDS_PATH}/${rewardId}`);

  if (!reward || reward.active !== true) {
    throw new Error("این جایزه در دسترس نیست.");
  }

  const stock = Number(reward.stock);

  if (!Number.isInteger(stock) || stock <= 0) {
    throw new Error("موجودی این جایزه تمام شده است.");
  }

  const balance = Number(
    await readData(`${BALANCE_PATH}/${member.uid}`)
  );

  if (!Number.isFinite(balance) || balance < reward.cost) {
    throw new Error("امتیاز شما برای دریافت این جایزه کافی نیست.");
  }

  const requests = await readData(REQUESTS_PATH);

  const hasPendingRequest = requests &&
    Object.values(requests).some(request =>
      request &&
      request.memberUid === member.uid &&
      request.rewardId === rewardId &&
      request.status === "pending"
    );

  if (hasPendingRequest) {
    throw new Error("برای این جایزه قبلاً درخواست ثبت کرده‌اید.");
  }

  return createRecord(REQUESTS_PATH, {
    rewardId,
    rewardTitle: reward.title,
    cost: Number(reward.cost),
    memberUid: member.uid,
    status: "pending",
    requestedAt: Date.now()
  });
}

export async function getRewardRequests(actor) {
  requireStaff(actor);

  const data = await readData(REQUESTS_PATH);

  if (!data || typeof data !== "object") return [];

  return Object.entries(data)
    .filter(([, request]) => request && typeof request === "object")
    .map(([id, request]) => ({ id, ...request }))
    .sort(
      (a, b) =>
        (Number(b.requestedAt) || 0) -
        (Number(a.requestedAt) || 0)
    );
}

export async function getMyRewardRequests(member) {
  requireActiveUser(member);

  const data = await readData(REQUESTS_PATH);

  if (!data || typeof data !== "object") return [];

  return Object.entries(data)
    .filter(([, request]) =>
      request &&
      request.memberUid === member.uid
    )
    .map(([id, request]) => ({ id, ...request }))
    .sort(
      (a, b) =>
        (Number(b.requestedAt) || 0) -
        (Number(a.requestedAt) || 0)
    );
}

export async function reviewRewardRequest(
  requestId,
  decision,
  actor,
  note = ""
) {
  requireAdmin(actor);
  validateId(requestId, "شناسه درخواست");

  if (!["approved", "rejected"].includes(decision)) {
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

  if (decision === "approved") {
    const reward = await readData(`${REWARDS_PATH}/${request.rewardId}`);

    if (!reward || reward.active !== true) {
      throw new Error("این جایزه دیگر فعال نیست.");
    }

    if (Number(reward.stock) <= 0) {
      throw new Error("موجودی جایزه کافی نیست.");
    }

    const balance = Number(
      await readData(`${BALANCE_PATH}/${request.memberUid}`)
    );

    if (!Number.isFinite(balance) || balance < Number(request.cost)) {
      throw new Error("امتیاز عضو برای این جایزه کافی نیست.");
    }

    await updateData(`${BALANCE_PATH}/${request.memberUid}`, {
      balance: balance - Number(request.cost),
      updatedAt: Date.now()
    });

    await updateData(`${REWARDS_PATH}/${request.rewardId}`, {
      stock: Number(reward.stock) - 1,
      updatedAt: Date.now()
    });
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
  validateId(rewardId, "شناسه جایزه");

  const reward = await readData(`${REWARDS_PATH}/${rewardId}`);

  if (!reward) {
    throw new Error("جایزه موردنظر پیدا نشد.");
  }

  await deleteData(`${REWARDS_PATH}/${rewardId}`);

  return true;
    }
    
