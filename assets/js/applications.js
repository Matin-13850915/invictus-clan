
import {
  createRecord,
  readData,
  updateData
} from "./database.js";

import {
  normalizeText
} from "./utils.js";

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
  "testing",
  "test_completed",
  "retest_requested",
  "accepted",
  "rejected",
  "withdrawn",
  "expired"
];

export async function submitApplication(data) {
  if (!data || typeof data !== "object") {
    throw new Error("اطلاعات درخواست معتبر نیست.");
  }

  const application = {
    realName: normalizeText(data.realName),
    email: normalizeText(data.email).toLowerCase(),
    gameName: normalizeText(data.gameName),
    gameLevel: Number(data.gameLevel),
    contactType: data.contactType,
    contactValue: normalizeText(data.contactValue),
    applicationType: data.applicationType,
    mpRank: normalizeText(data.mpRank),
    brRank: normalizeText(data.brRank),
    status: "pending",
    assignedTesterUid: null,
    leaderNote: "",
    createdAt: Date.now(),
    updatedAt: Date.now()
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

  const id = await createRecord(
    APPLICATION_PATH,
    application
  );

  return {
    id,
    status: application.status
  };
}

export async function getApplication(applicationId) {
  if (!applicationId) {
    throw new Error("شناسه درخواست معتبر نیست.");
  }

  return await readData(
    `${APPLICATION_PATH}/${applicationId}`
  );
}

export async function getAllApplications() {
  const data = await readData(APPLICATION_PATH);

  if (!data) return [];

  return Object.entries(data)
    .map(([id, application]) => ({
      id,
      ...application
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateApplicationStatus(
  applicationId,
  status,
  reviewerUid,
  note = ""
) {
  if (!applicationId || !reviewerUid) {
    throw new Error("اطلاعات بررسی درخواست کامل نیست.");
  }

  if (!VALID_STATUSES.includes(status)) {
    throw new Error("وضعیت درخواست معتبر نیست.");
  }

  await updateData(
    `${APPLICATION_PATH}/${applicationId}`,
    {
      status,
      leaderNote: normalizeText(note),
      reviewedBy: reviewerUid,
      updatedAt: Date.now()
    }
  );

  return true;
}

export async function assignTester(
  applicationId,
  testerUid,
  leaderUid
) {
  if (!applicationId || !testerUid || !leaderUid) {
    throw new Error("اطلاعات تخصیص تستر کامل نیست.");
  }

  await updateData(
    `${APPLICATION_PATH}/${applicationId}`,
    {
      assignedTesterUid: testerUid,
      status: "awaiting_tester",
      assignedBy: leaderUid,
      updatedAt: Date.now()
    }
  );

  return true;
}
  
