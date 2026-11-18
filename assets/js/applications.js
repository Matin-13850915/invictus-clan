
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateData,
  updateMultipleData
} from "./database.js";

import { normalizeText } from "./utils.js";

import {
  validEmail,
  validGameLevel,
  validApplicationType,
  validTextLength
} from "./validators.js";

const APPLICATION_PATH = "applications";

const VALID_STATUSES = [
  "pending",
  "awaiting_tester",
  "awaiting_test",
  "testing",
  "test_completed",
  "awaiting_leader",
  "retest_requested",
  "accepted",
  "rejected",
  "withdrawn",
  "expired"
];

const TERMINAL_STATUSES = [
  "accepted",
  "rejected",
  "withdrawn",
  "expired"
];

function clean(value, max = 300) {
  return normalizeText(String(value ?? "").trim()).slice(0, max);
}

function assertId(id, label = "شناسه درخواست") {
  if (
    typeof id !== "string" ||
    !id.trim() ||
    /[.#$/\[\]]/.test(id)
  ) {
    throw new Error(`${label} معتبر نیست.`);
  }
}

function requireLeader(actor) {
  if (
    !actor?.uid ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("فقط لیدر یا ادمین اجازه این عملیات را دارد.");
  }
}

function validateApplication(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات درخواست معتبر نیست.");
  }

  const application = {
    realName: clean(data.realName, 70),
    email: clean(data.email, 120).toLowerCase(),
    gameName: clean(data.gameName, 40),
    gameLevel: Number(data.gameLevel),
    contactType: String(data.contactType || "").toLowerCase(),
    contactValue: clean(data.contactValue, 100),
    applicationType: String(data.applicationType || "").toUpperCase(),
    mpRank: clean(data.mpRank, 40),
    brRank: clean(data.brRank, 40),
    telegram: clean(data.telegram, 80),
    rubika: clean(data.rubika, 80),
    description: clean(data.description, 1000)
  };

  if (!validTextLength(application.realName, 2, 70)) {
    throw new Error("نام واقعی باید بین ۲ تا ۷۰ حرف باشد.");
  }

  if (!validEmail(application.email)) {
    throw new Error("ایمیل معتبر وارد کنید.");
  }

  if (!validTextLength(application.gameName, 2, 40)) {
    throw new Error("نام داخل بازی معتبر نیست.");
  }

  if (!validGameLevel(application.gameLevel)) {
    throw new Error("لول بازی معتبر نیست.");
  }

  if (!["telegram", "rubika"].includes(application.contactType)) {
    throw new Error("نوع راه ارتباطی معتبر نیست.");
  }

  if (!validTextLength(application.contactValue, 3, 100)) {
    throw new Error("اطلاعات راه ارتباطی معتبر نیست.");
  }

  if (!validApplicationType(application.applicationType)) {
    throw new Error("نوع درخواست عضویت معتبر نیست.");
  }

  if (
    application.applicationType === "MP" &&
    !application.mpRank
  ) {
    throw new Error("رنک مولتی‌پلیر را وارد کنید.");
  }

  if (
    application.applicationType === "BR" &&
    !application.brRank
  ) {
    throw new Error("رنک بتل رویال را وارد کنید.");
  }

  if (
    application.applicationType === "BOTH" &&
    (!application.mpRank || !application.brRank)
  ) {
    throw new Error("رنک هر دو بخش را وارد کنید.");
  }

  return application;
}

export async function submitApplication(data) {
  const application = validateApplication(data);
  const now = Date.now();

  const id = await createRecord(APPLICATION_PATH, {
    ...application,
    uid: null,
    status: "pending",
    assignedTesterUid: null,
    assignedSpecialty: null,
    testResult: null,
    testNote: "",
    leaderNote: "",
    internalNote: "",
    createdAt: now,
    updatedAt: now
  });

  return {
    id,
    status: "pending"
  };
}

export async function getApplication(applicationId) {
  assertId(applicationId);

  const application = await getRecord(
    `${APPLICATION_PATH}/${applicationId}`
  );

  if (!application) {
    throw new Error("درخواست پیدا نشد.");
  }

  return {
    id: applicationId,
    ...application
  };
}

export async function getAllApplications(actor) {
  requireLeader(actor);

  const applications = await getAllRecords(APPLICATION_PATH);

  return applications
    .map(item => ({
      ...item,
      id: item.id
    }))
    .sort((a, b) =>
      (b.createdAt || 0) - (a.createdAt || 0)
    );
}

export async function updateApplicationStatus(
  applicationId,
  status,
  actor,
  note = ""
) {
  requireLeader(actor);
  assertId(applicationId);

  if (!VALID_STATUSES.includes(status)) {
    throw new Error("وضعیت درخواست معتبر نیست.");
  }

  const application = await getRecord(
    `${APPLICATION_PATH}/${applicationId}`
  );

  if (!application) {
    throw new Error("درخواست پیدا نشد.");
  }

  if (TERMINAL_STATUSES.includes(application.status)) {
    throw new Error("درخواست نهایی شده و قابل تغییر نیست.");
  }

  if (
    status === "accepted" &&
    !["awaiting_leader", "pending"].includes(application.status)
  ) {
    throw new Error("این درخواست هنوز آماده تصمیم نهایی نیست.");
  }

  const now = Date.now();

  const changes = {
    status,
    leaderNote: clean(note, 1000),
    reviewedBy: actor.uid,
    reviewedAt: now,
    updatedAt: now
  };

  if (status === "accepted") {
    const email = String(application.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("ایمیل متقاضی معتبر نیست.");
    }
    const emailKey = encodeURIComponent(email).replace(/\./g, "%2E");
    await updateMultipleData({
      [`${APPLICATION_PATH}/${applicationId}/status`]: status,
      [`${APPLICATION_PATH}/${applicationId}/leaderNote`]: changes.leaderNote,
      [`${APPLICATION_PATH}/${applicationId}/reviewedBy`]: actor.uid,
      [`${APPLICATION_PATH}/${applicationId}/reviewedAt`]: now,
      [`${APPLICATION_PATH}/${applicationId}/updatedAt`]: now,
      [`approvedApplications/${emailKey}`]: {
        applicationId,
        email,
        realName: application.realName || "",
        gameName: application.gameName || "",
        gameLevel: Number(application.gameLevel) || null,
        telegram: application.telegram || "",
        rubika: application.rubika || "",
        status: "accepted",
        claimedUid: null,
        approvedBy: actor.uid,
        approvedAt: now
      }
    });
  } else {
    await updateData(`${APPLICATION_PATH}/${applicationId}`, changes);
  }

  return true;
}

export async function assignTester(
  applicationId,
  testerUid,
  specialty,
  actor
) {
  requireLeader(actor);
  assertId(applicationId);
  assertId(testerUid, "شناسه تستر");

  if (!["MP", "BR"].includes(specialty)) {
    throw new Error("تخصص تستر باید MP یا BR باشد.");
  }

  const application = await getRecord(
    `${APPLICATION_PATH}/${applicationId}`
  );

  if (!application) {
    throw new Error("درخواست پیدا نشد.");
  }

  if (
    !["pending", "awaiting_tester", "retest_requested"].includes(
      application.status
    )
  ) {
    throw new Error("وضعیت فعلی درخواست اجازه تخصیص تستر نمی‌دهد.");
  }

  if (
    specialty === "MP" &&
    !["MP", "BOTH"].includes(application.applicationType)
  ) {
    throw new Error("این درخواست با تخصص MP سازگار نیست.");
  }

  if (
    specialty === "BR" &&
    !["BR", "BOTH"].includes(application.applicationType)
  ) {
    throw new Error("این درخواست با تخصص BR سازگار نیست.");
  }

  const now = Date.now();

  await updateData(`${APPLICATION_PATH}/${applicationId}`, {
    assignedTesterUid: testerUid,
    assignedSpecialty: specialty,
    assignedBy: actor.uid,
    assignedAt: now,
    status: "awaiting_test",
    updatedAt: now
  });

  return true;
 }
    
