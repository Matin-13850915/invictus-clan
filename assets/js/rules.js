
import {
  createRecord,
  getRecord,
  updateRecord,
  getAllRecords
} from "./database.js";

const RULES_PATH = "clanRules";
const ACCEPTANCE_PATH = "ruleAcceptances";

function requireUser(actor) {
  if (!actor?.uid || actor.active !== true) {
    throw new Error("ابتدا وارد حساب فعال خود شوید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت قوانین را دارند.");
  }
}

function validateUid(uid) {
  if (
    typeof uid !== "string" ||
    !uid.trim() ||
    uid.length > 128 ||
    /[.#$/\[\]]/.test(uid)
  ) {
    throw new Error("شناسه کاربر معتبر نیست.");
  }
}

function validateContent(content) {
  if (typeof content !== "string") {
    throw new Error("متن قوانین معتبر نیست.");
  }

  const value = content.trim();

  if (!value || value.length > 30000) {
    throw new Error("متن قوانین باید بین ۱ تا ۳۰۰۰۰ کاراکتر باشد.");
  }

  return value;
}

// دریافت نسخه فعلی قوانین
export async function getCurrentRules(actor) {
  requireUser(actor);

  return getRecord(`${RULES_PATH}/current`);
}

// انتشار نسخه جدید قوانین
export async function publishRules(content, important, actor) {
  requireStaff(actor);

  const text = validateContent(content);
  const previous = await getCurrentRules(actor);

  const version = Number(previous?.version || 0) + 1;
  const now = Date.now();

  const rules = {
    title: "قوانین کلن",
    content: text,
    version,
    important: Boolean(important),
    active: true,
    createdAt: now,
    createdBy: actor.uid,
    publishedAt: now,
    publishedBy: actor.uid
  };

  const historyId = await createRecord(
    `${RULES_PATH}/history`,
    rules
  );

  await updateRecord(`${RULES_PATH}/current`, {
    ...rules,
    historyId
  });

  return {
    ...rules,
    historyId
  };
}

// بررسی تأیید قوانین توسط کاربر
export async function hasAcceptedCurrentRules(actor) {
  requireUser(actor);

  const [rules, acceptance] = await Promise.all([
    getCurrentRules(actor),
    getRecord(`${ACCEPTANCE_PATH}/${actor.uid}/current`)
  ]);

  if (!rules?.version) return true;

  return Number(acceptance?.version) === Number(rules.version);
}

// ثبت تأیید قوانین
export async function acceptCurrentRules(actor) {
  requireUser(actor);

  const rules = await getCurrentRules(actor);

  if (!rules?.version) {
    throw new Error("هنوز قانونی برای تأیید منتشر نشده است.");
  }

  const acceptance = {
    uid: actor.uid,
    version: rules.version,
    acceptedAt: Date.now()
  };

  await updateRecord(
    `${ACCEPTANCE_PATH}/${actor.uid}/current`,
    acceptance
  );

  await createRecord(
    `${ACCEPTANCE_PATH}/${actor.uid}/history`,
    acceptance
  );

  return acceptance;
}

// دریافت تاریخچه نسخه‌های قوانین
export async function getRulesHistory(actor) {
  requireStaff(actor);

  const history = await getAllRecords(
    `${RULES_PATH}/history`
  );

  return history.sort(
    (a, b) =>
      (Number(b.version) || 0) -
      (Number(a.version) || 0)
  );
}

// دریافت وضعیت تأیید قوانین توسط یک عضو
export async function getMemberRulesStatus(uid, actor) {
  requireStaff(actor);
  validateUid(uid);

  const [rules, acceptance] = await Promise.all([
    getCurrentRules(actor),
    getRecord(`${ACCEPTANCE_PATH}/${uid}/current`)
  ]);

  return {
    currentVersion: Number(rules?.version || 0),
    acceptedVersion: Number(acceptance?.version || 0),
    acceptedAt: acceptance?.acceptedAt || null,
    accepted: Boolean(
      rules?.version &&
      acceptance?.version &&
      Number(acceptance.version) === Number(rules.version)
    )
  };
}
