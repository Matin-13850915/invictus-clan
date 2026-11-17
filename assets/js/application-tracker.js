
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateData
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "applications";

export const APPLICATION_STATUS = Object.freeze({
  PENDING: "pending",
  AWAITING_TESTER: "awaiting_tester",
  AWAITING_TEST: "awaiting_test",
  TESTING: "testing",
  TEST_COMPLETED: "test_completed",
  AWAITING_LEADER: "awaiting_leader",
  RETEST_REQUESTED: "retest_requested",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
  EXPIRED: "expired"
});

const STATUS_LABELS = Object.freeze({
  pending: "در انتظار بررسی",
  awaiting_tester: "در انتظار تعیین تستر",
  awaiting_test: "در انتظار انجام تست",
  testing: "در حال تست",
  test_completed: "تست انجام شده",
  awaiting_leader: "در انتظار تصمیم لیدر",
  retest_requested: "درخواست تست مجدد",
  accepted: "پذیرفته شده",
  rejected: "رد شده",
  withdrawn: "انصراف داده شده",
  expired: "منقضی شده"
});

function requireUser(actor) {
  if (!actor?.uid) {
    throw new Error("برای انجام این عملیات باید وارد حساب شوید.");
  }
}

function requireLeader(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر یا ادمین می‌تواند این عملیات را انجام دهد.");
  }
}

function cleanText(value, maxLength = 300) {
  return normalizeText(String(value ?? "").trim()).slice(0, maxLength);
}

function validateApplication(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات درخواست معتبر نیست.");
  }

  const gameName = cleanText(data.gameName, 40);
  const applicationType = String(data.applicationType || "").toUpperCase();
  const gameLevel = Number(data.gameLevel);

  if (gameName.length < 2) {
    throw new Error("نام داخل بازی باید حداقل ۲ کاراکتر باشد.");
  }

  if (!["MP", "BR", "BOTH"].includes(applicationType)) {
    throw new Error("نوع درخواست معتبر نیست.");
  }

  if (!Number.isInteger(gameLevel) || gameLevel < 1 || gameLevel > 500) {
    throw new Error("لول بازی معتبر نیست.");
  }

  return {
    gameName,
    gameLevel,
    applicationType,
    mpRank: cleanText(data.mpRank, 40),
    brRank: cleanText(data.brRank, 40),
    realName: cleanText(data.realName, 80),
    email: cleanText(data.email, 120).toLowerCase(),
    telegram: cleanText(data.telegram, 80),
    rubika: cleanText(data.rubika, 80),
    description: cleanText(data.description, 1000)
  };
}

function assertApplicationId(id) {
  if (
    typeof id !== "string" ||
    !id.trim() ||
    /[.#$/[\]]/.test(id)
  ) {
    throw new Error("شناسه درخواست معتبر نیست.");
  }
}

function sanitizeApplication(item) {
  return {
    id: item.id,
    uid: item.uid,
    gameName: item.gameName || "",
    gameLevel: item.gameLevel || 0,
    applicationType: item.applicationType || "",
    mpRank: item.mpRank || "",
    brRank: item.brRank || "",
    status: item.status || APPLICATION_STATUS.PENDING,
    statusLabel: STATUS_LABELS[item.status] || "وضعیت نامشخص",
    assignedTesterUid: item.assignedTesterUid || null,
    assignedSpecialty: item.assignedSpecialty || null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null
  };
}

export async function createApplication(data, actor) {
  requireUser(actor);

  const existing = await getAllRecords(PATH);

  if (existing.some(item =>
    item.uid === actor.uid &&
    !["rejected", "withdrawn", "expired"].includes(item.status)
  )) {
    throw new Error("شما از قبل یک درخواست فعال دارید.");
  }

  const application = validateApplication(data);
  const now = Date.now();

  const id = await createRecord(PATH, {
    ...application,
    uid: actor.uid,
    status: APPLICATION_STATUS.PENDING,
    assignedTesterUid: null,
    assignedSpecialty: null,
    internalNote: "",
    createdAt: now,
    updatedAt: now
  });

  return id;
}

export async function getMyApplicationStatus(actor) {
  requireUser(actor);

  const applications = await getAllRecords(PATH);

  return applications
    .filter(item => item.uid === actor.uid)
    .map(sanitizeApplication)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getMyApplicationDetails(applicationId, actor) {
  requireUser(actor);
  assertApplicationId(applicationId);

  const application = await getRecord(`${PATH}/${applicationId}`);

  if (!application || application.uid !== actor.uid) {
    throw new Error("درخواست موردنظر پیدا نشد.");
  }

  return sanitizeApplication(application);
}

export async function getApplications(actor, options = {}) {
  requireLeader(actor);

  const applications = await getAllRecords(PATH);
  const status = options.status || null;

  return applications
    .filter(item => !status || item.status === status)
    .map(item => ({
      ...sanitizeApplication(item),
      realName: item.realName || "",
      email: item.email || "",
      telegram: item.telegram || "",
      rubika: item.rubika || "",
      description: item.description || "",
      internalNote: item.internalNote || ""
    }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function assignApplicationTester(
  applicationId,
  testerUid,
  specialty,
  actor
) {
  requireLeader(actor);
  assertApplicationId(applicationId);

  if (
    typeof testerUid !== "string" ||
    !testerUid.trim() ||
    /[.#$/[\]]/.test(testerUid)
  ) {
    throw new Error("شناسه تستر معتبر نیست.");
  }

  if (!["MP", "BR"].includes(specialty)) {
    throw new Error("تخصص تستر باید MP یا BR باشد.");
  }

  const application = await getRecord(`${PATH}/${applicationId}`);

  if (!application) {
    throw new Error("درخواست پیدا نشد.");
  }

  if (!["pending", "awaiting_tester", "retest_requested"].includes(application.status)) {
    throw new Error("وضعیت فعلی درخواست اجازه تعیین تستر نمی‌دهد.");
  }

  const now = Date.now();

  await updateData(`${PATH}/${applicationId}`, {
    assignedTesterUid: testerUid,
    assignedSpecialty: specialty,
    status: APPLICATION_STATUS.AWAITING_TEST,
    assignedBy: actor.uid,
    assignedAt: now,
    updatedAt: now
  });

  return true;
}

export async function submitTestResult(
  applicationId,
  result,
  note,
  actor
) {
  requireUser(actor);
  assertApplicationId(applicationId);

  if (!["admin", "leader", "tester"].includes(actor.role)) {
    throw new Error("اجازه ثبت نتیجه تست را ندارید.");
  }

  const application = await getRecord(`${PATH}/${applicationId}`);

  if (!application) {
    throw new Error("درخواست پیدا نشد.");
  }

  if (
    actor.role === "tester" &&
    (
      application.assignedTesterUid !== actor.uid ||
      application.assignedSpecialty !== actor.specialty
    )
  ) {
    throw new Error("این درخواست به شما اختصاص داده نشده است.");
  }

  if (!["awaiting_test", "testing"].includes(application.status)) {
    throw new Error("این درخواست در وضعیت قابل تست نیست.");
  }

  if (!["recommended", "not_recommended", "retest"].includes(result)) {
    throw new Error("نتیجه تست معتبر نیست.");
  }

  const now = Date.now();

  await updateData(`${PATH}/${applicationId}`, {
    testResult: result,
    testNote: cleanText(note, 1000),
    testedBy: actor.uid,
    testedAt: now,
    status: APPLICATION_STATUS.AWAITING_LEADER,
    updatedAt: now
  });

  return true;
}

export async function decideApplication(
  applicationId,
  decision,
  note,
  actor
) {
  requireLeader(actor);
  assertApplicationId(applicationId);

  if (!["accepted", "rejected", "retest_requested"].includes(decision)) {
    throw new Error("تصمیم نهایی معتبر نیست.");
  }

  const application = await getRecord(`${PATH}/${applicationId}`);

  if (!application) {
    throw new Error("درخواست پیدا نشد.");
  }

  if (
    ![
      "pending",
      "awaiting_leader",
      "retest_requested"
    ].includes(application.status)
  ) {
    throw new Error("وضعیت فعلی درخواست اجازه این تصمیم را نمی‌دهد.");
  }

  const now = Date.now();

  await updateData(`${PATH}/${applicationId}`, {
    status: decision,
    leaderDecision: decision,
    leaderNote: cleanText(note, 1000),
    reviewedBy: actor.uid,
    reviewedAt: now,
    updatedAt: now
  });

  return true;
}

export async function withdrawApplication(applicationId, actor) {
  requireUser(actor);
  assertApplicationId(applicationId);

  const application = await getRecord(`${PATH}/${applicationId}`);

  if (!application || application.uid !== actor.uid) {
    throw new Error("درخواست پیدا نشد.");
  }

  if (["accepted", "rejected", "withdrawn"].includes(application.status)) {
    throw new Error("این درخواست قابل انصراف نیست.");
  }

  await updateData(`${PATH}/${applicationId}`, {
    status: APPLICATION_STATUS.WITHDRAWN,
    withdrawnAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

export function getApplicationStatusLabel(status) {
  return STATUS_LABELS[status] || "وضعیت نامشخص";
      }
      
