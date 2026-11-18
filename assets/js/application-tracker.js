
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateData,
  updateMultipleData,
  findByField
} from "./database.js";

import { normalizeText } from "./utils.js";

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

const TERMINAL_STATUSES = [
  "accepted",
  "rejected",
  "withdrawn",
  "expired"
];

function requireUser(actor) {
  if (
    !actor ||
    typeof actor.uid !== "string" ||
    !actor.uid.trim()
  ) {
    throw new Error("برای انجام این عملیات باید وارد حساب شوید.");
  }

  if (
    actor.active !== true ||
    ["banned", "suspended"].includes(actor.status)
  ) {
    throw new Error("حساب شما فعال نیست.");
  }
}

function requireLeader(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر یا ادمین اجازه انجام این عملیات را دارد.");
  }
}

function requireTesterOrLeader(actor) {
  requireUser(actor);

  if (!["admin", "leader", "tester"].includes(actor.role)) {
    throw new Error("اجازه انجام این عملیات را ندارید.");
  }
}

function cleanText(value, maxLength = 300) {
  return normalizeText(
    String(value ?? "").trim()
  ).slice(0, maxLength);
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

function validateApplication(data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error("اطلاعات درخواست معتبر نیست.");
  }

  const gameName = cleanText(data.gameName, 40);
  const applicationType = String(
    data.applicationType || ""
  ).toUpperCase();

  const gameLevel = Number(data.gameLevel);
  const email = cleanText(data.email, 120).toLowerCase();

  const contactType = String(
    data.contactType || ""
  ).toLowerCase();

  const contactValue = cleanText(
    data.contactValue,
    100
  );

  if (gameName.length < 2) {
    throw new Error("نام داخل بازی باید حداقل ۲ کاراکتر باشد.");
  }

  if (!["MP", "BR", "BOTH"].includes(applicationType)) {
    throw new Error("نوع درخواست معتبر نیست.");
  }

  if (
    !Number.isInteger(gameLevel) ||
    gameLevel < 1 ||
    gameLevel > 500
  ) {
    throw new Error("لول بازی معتبر نیست.");
  }

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("فرمت ایمیل معتبر نیست.");
  }

  if (!["telegram", "rubika"].includes(contactType)) {
    throw new Error("نوع راه ارتباطی معتبر نیست.");
  }

  if (contactValue.length < 3) {
    throw new Error("اطلاعات راه ارتباطی معتبر نیست.");
  }

  const realName = cleanText(data.realName, 80);

  if (realName.length < 2) {
    throw new Error("نام واقعی باید حداقل ۲ کاراکتر باشد.");
  }

  const mpRank = cleanText(data.mpRank, 40);
  const brRank = cleanText(data.brRank, 40);

  if (
    applicationType === "MP" &&
    !mpRank
  ) {
    throw new Error("رنک مولتی‌پلیر را وارد کنید.");
  }

  if (
    applicationType === "BR" &&
    !brRank
  ) {
    throw new Error("رنک بتل رویال را وارد کنید.");
  }

  if (
    applicationType === "BOTH" &&
    (!mpRank || !brRank)
  ) {
    throw new Error("رنک هر دو بخش را وارد کنید.");
  }

  return {
    realName,
    gameName,
    gameLevel,
    applicationType,
    mpRank,
    brRank,
    email,
    contactType,
    contactValue,
    telegram: cleanText(data.telegram, 80),
    rubika: cleanText(data.rubika, 80),
    description: cleanText(data.description, 1000)
  };
}

function sanitizeApplication(item) {
  return {
    id: item.id,
    uid: item.uid || null,

    realName: item.realName || "",
    gameName: item.gameName || "",
    gameLevel: item.gameLevel || 0,

    applicationType: item.applicationType || "",
    mpRank: item.mpRank || "",
    brRank: item.brRank || "",

    email: item.email || "",

    contactType: item.contactType || "",
    contactValue: item.contactValue || "",

    telegram: item.telegram || "",
    rubika: item.rubika || "",
    description: item.description || "",

    status: item.status || APPLICATION_STATUS.PENDING,
    statusLabel:
      STATUS_LABELS[item.status] || "وضعیت نامشخص",

    assignedTesterUid: item.assignedTesterUid || null,
    assignedSpecialty: item.assignedSpecialty || null,

    testResult: item.testResult || null,
    testNote: item.testNote || "",
    leaderNote: item.leaderNote || "",

    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,

    assignedBy: item.assignedBy || null,
    assignedAt: item.assignedAt || null,

    testedBy: item.testedBy || null,
    testedAt: item.testedAt || null,

    reviewedBy: item.reviewedBy || null,
    reviewedAt: item.reviewedAt || null,

    internalNote: item.internalNote || ""
  };
}

function canTesterHandle(application, actor) {
  if (actor.role !== "tester") {
    return true;
  }

  if (
    application.assignedTesterUid !== actor.uid ||
    application.assignedSpecialty !== actor.specialty
  ) {
    return false;
  }

  if (
    actor.specialty === "MP" &&
    !["MP", "BOTH"].includes(application.applicationType)
  ) {
    return false;
  }

  if (
    actor.specialty === "BR" &&
    !["BR", "BOTH"].includes(application.applicationType)
  ) {
    return false;
  }

  return true;
}

export async function createApplication(data, actor) {
  requireUser(actor);

  const application = validateApplication(data);

  const existing = await findByField(
    "applications",
    "uid",
    actor.uid
  );

  const hasActiveApplication = existing.some(item =>
    !TERMINAL_STATUSES.includes(item.status)
  );

  if (hasActiveApplication) {
    throw new Error("شما از قبل یک درخواست فعال دارید.");
  }

  const now = Date.now();

  return await createRecord("applications", {
    ...application,

    uid: actor.uid,

    status: APPLICATION_STATUS.PENDING,

    assignedTesterUid: null,
    assignedSpecialty: null,

    testResult: null,
    testNote: "",
    leaderNote: "",
    internalNote: "",

    createdAt: now,
    updatedAt: now
  });
}

export async function getMyApplicationStatus(actor) {
  requireUser(actor);

  const applications = await findByField(
    "applications",
    "uid",
    actor.uid
  );

  return applications
    .map(sanitizeApplication)
    .sort((a, b) =>
      (b.createdAt || 0) - (a.createdAt || 0)
    );
}

export async function getMyApplicationDetails(
  applicationId,
  actor
) {
  requireUser(actor);
  assertId(applicationId);

  const application = await getRecord(
    `applications/${applicationId}`
  );

  if (
    !application ||
    application.uid !== actor.uid
  ) {
    throw new Error("درخواست موردنظر پیدا نشد.");
  }

  return sanitizeApplication({
    ...application,
    id: applicationId
  });
}

export async function getApplications(actor, options = {}) {
  requireUser(actor);

  if (!["admin", "leader", "tester"].includes(actor.role)) {
    throw new Error("اجازه مشاهده درخواست‌ها را ندارید.");
  }

  if (
    actor.role === "tester" &&
    !["MP", "BR"].includes(actor.specialty)
  ) {
    throw new Error("تخصص تستر معتبر نیست.");
  }

  const applications = actor.role === "tester"
    ? await findByField("applications", "assignedTesterUid", actor.uid)
    : await getAllRecords("applications");

  const status = options.status || null;

  if (
    status &&
    !Object.prototype.hasOwnProperty.call(
      STATUS_LABELS,
      status
    )
  ) {
    throw new Error("فیلتر وضعیت معتبر نیست.");
  }

  return applications
    .filter(item => {
      if (status && item.status !== status) {
        return false;
      }

      if (actor.role === "tester") {
        return canTesterHandle(item, actor);
      }

      return true;
    })
    .map(item => {
      const sanitized = sanitizeApplication(item);

      if (
        actor.role !== "admin" &&
        actor.role !== "leader"
      ) {
        sanitized.internalNote = "";
      }

      return sanitized;
    })
    .sort((a, b) =>
      (b.createdAt || 0) - (a.createdAt || 0)
    );
}

export async function assignApplicationTester(
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
    `applications/${applicationId}`
  );

  if (!application) {
    throw new Error("درخواست پیدا نشد.");
  }

  if (
    ![
      "pending",
      "awaiting_tester",
      "retest_requested"
    ].includes(application.status)
  ) {
    throw new Error(
      "وضعیت فعلی درخواست اجازه تعیین تستر نمی‌دهد."
    );
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

  await updateData(
    `applications/${applicationId}`,
    {
      assignedTesterUid: testerUid,
      assignedSpecialty: specialty,

      status: APPLICATION_STATUS.AWAITING_TEST,

      assignedBy: actor.uid,
      assignedAt: now,

      updatedAt: now
    }
  );

  return true;
}

export async function startApplicationTest(
  applicationId,
  actor
) {
  requireTesterOrLeader(actor);
  assertId(applicationId);

  const application = await getRecord(
    `applications/${applicationId}`
  );

  if (!application) {
    throw new Error("درخواست پیدا نشد.");
  }

  if (!canTesterHandle(application, actor)) {
    throw new Error("این درخواست به شما اختصاص داده نشده است.");
  }

  if (
    application.status !== APPLICATION_STATUS.AWAITING_TEST
  ) {
    throw new Error("این درخواست در وضعیت شروع تست نیست.");
  }

  const now = Date.now();

  await updateData(
    `applications/${applicationId}`,
    {
      status: APPLICATION_STATUS.TESTING,

      testStartedBy: actor.uid,
      testStartedAt: now,

      updatedAt: now
    }
  );

  return true;
}

export async function submitTestResult(
  applicationId,
  result,
  note,
  actor
) {
  requireTesterOrLeader(actor);
  assertId(applicationId);

  if (
    ![
      "recommended",
      "not_recommended",
      "retest"
    ].includes(result)
  ) {
    throw new Error("نتیجه تست معتبر نیست.");
  }

  const application = await getRecord(
    `applications/${applicationId}`
  );

  if (!application) {
    throw new Error("درخواست پیدا نشد.");
  }

  if (!canTesterHandle(application, actor)) {
    throw new Error("این درخواست به شما اختصاص داده نشده است.");
  }

  if (
    ![
      APPLICATION_STATUS.AWAITING_TEST,
      APPLICATION_STATUS.TESTING
    ].includes(application.status)
  ) {
    throw new Error(
      "این درخواست در وضعیت قابل ثبت نتیجه تست نیست."
    );
  }

  const now = Date.now();

  await updateData(
    `applications/${applicationId}`,
    {
      testResult: result,
      testNote: cleanText(note, 1000),

      testedBy: actor.uid,
      testedAt: now,

      status: APPLICATION_STATUS.AWAITING_LEADER,

      updatedAt: now
    }
  );

  return true;
}

export async function decideApplication(
  applicationId,
  decision,
  note,
  actor
) {
  requireLeader(actor);
  assertId(applicationId);

  if (
    ![
      "accepted",
      "rejected",
      "retest_requested"
    ].includes(decision)
  ) {
    throw new Error("تصمیم نهایی معتبر نیست.");
  }

  const application = await getRecord(
    `applications/${applicationId}`
  );

  if (!application) {
    throw new Error("درخواست پیدا نشد.");
  }

  if (
    ![
      "pending",
      "awaiting_tester",
      "awaiting_leader",
      "retest_requested"
    ].includes(application.status)
  ) {
    throw new Error(
      "وضعیت فعلی درخواست اجازه این تصمیم را نمی‌دهد."
    );
  }

  if (
    decision === "accepted" &&
    ![
      "awaiting_leader",
      "pending"
    ].includes(application.status)
  ) {
    throw new Error(
      "برای پذیرش نهایی ابتدا باید نتیجه تست یا بررسی اولیه ثبت شود."
    );
  }

  const now = Date.now();

  const cleanNote = cleanText(note, 1000);
  const applicationChanges = {
    status: decision,
    leaderDecision: decision,
    leaderNote: cleanNote,
    reviewedBy: actor.uid,
    reviewedAt: now,
    updatedAt: now
  };

  if (decision === "accepted") {
    const email = String(application.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("ایمیل متقاضی معتبر نیست؛ امکان ساخت حساب فعال‌سازی وجود ندارد.");
    }

    const emailKey = encodeURIComponent(email).replace(/\./g, "%2E");
    await updateMultipleData({
      [`applications/${applicationId}/status`]: decision,
      [`applications/${applicationId}/leaderDecision`]: decision,
      [`applications/${applicationId}/leaderNote`]: cleanNote,
      [`applications/${applicationId}/reviewedBy`]: actor.uid,
      [`applications/${applicationId}/reviewedAt`]: now,
      [`applications/${applicationId}/updatedAt`]: now,
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
    await updateData(`applications/${applicationId}`, applicationChanges);
  }

  return true;
}

export async function withdrawApplication(
  applicationId,
  actor
) {
  requireUser(actor);
  assertId(applicationId);

  const application = await getRecord(
    `applications/${applicationId}`
  );

  if (
    !application ||
    application.uid !== actor.uid
  ) {
    throw new Error("درخواست موردنظر پیدا نشد.");
  }

  if (TERMINAL_STATUSES.includes(application.status)) {
    throw new Error("این درخواست قابل انصراف نیست.");
  }

  const now = Date.now();

  await updateData(
    `applications/${applicationId}`,
    {
      status: APPLICATION_STATUS.WITHDRAWN,
      withdrawnAt: now,
      updatedAt: now
    }
  );

  return true;
}

export function getApplicationStatusLabel(status) {
  return STATUS_LABELS[status] || "وضعیت نامشخص";
 }
  
