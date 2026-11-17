
import {
  createRecord,
  getRecord,
  updateRecord,
  getAllRecords
} from "./database.js";

import { createId } from "./utils.js";

const RULES_PATH = "clanRules";
const ACCEPTANCE_PATH = "ruleAcceptances";
const HISTORY_PATH = "rulesHistory";

function requireUser(actor) {
  if (!actor?.uid) {
    throw new Error("ابتدا وارد حساب خود شوید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه ویرایش قوانین را دارند.");
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
export async function getCurrentRules() {
  return await getRecord(RULES_PATH);
}

// انتشار نسخه جدید قوانین
export async function publishRules(content, important, actor) {
  requireStaff(actor);

  const text = validateContent(content);
  const previous = await getCurrentRules();

  const version = (previous?.version || 0) + 1;
  const now = Date.now();

  const rules = {
    content: text,
    version,
    important: Boolean(important),
    publishedAt: now,
    publishedBy: actor.uid
  };

  await updateRecord(RULES_PATH, rules);

  await createRecord(HISTORY_PATH, {
    id: createId(),
    version,
    content: text,
    important: Boolean(important),
    publishedAt: now,
    publishedBy: actor.uid,
    previousVersion: previous?.version || 0
  });

  return rules;
}

// بررسی تأیید قوانین توسط کاربر
export async function hasAcceptedCurrentRules(actor) {
  requireUser(actor);

  const [rules, acceptance] = await Promise.all([
    getCurrentRules(),
    getRecord(`${ACCEPTANCE_PATH}/${actor.uid}`)
  ]);

  if (!rules) {
    return true;
  }

  return Boolean(
    acceptance &&
    acceptance.version === rules.version
  );
}

// ثبت تأیید قوانین
export async function acceptCurrentRules(actor) {
  requireUser(actor);

  const rules = await getCurrentRules();

  if (!rules) {
    throw new Error("هنوز قانونی برای تأیید منتشر نشده است.");
  }

  const acceptance = {
    uid: actor.uid,
    version: rules.version,
    acceptedAt: Date.now()
  };

  await updateRecord(
    `${ACCEPTANCE_PATH}/${actor.uid}`,
    acceptance
  );

  return acceptance;
}

// دریافت تاریخچه قوانین
export async function getRulesHistory(actor) {
  requireStaff(actor);

  const history = await getAllRecords(HISTORY_PATH);

  return history.sort(
    (a, b) => (b.publishedAt || 0) - (a.publishedAt || 0)
  );
}

// دریافت وضعیت تأیید قوانین توسط یک عضو
export async function getMemberRulesStatus(uid, actor) {
  requireStaff(actor);

  if (typeof uid !== "string" || !uid) {
    throw new Error("شناسه کاربر معتبر نیست.");
  }

  const [rules, acceptance] = await Promise.all([
    getCurrentRules(),
    getRecord(`${ACCEPTANCE_PATH}/${uid}`)
  ]);

  return {
    currentVersion: rules?.version || 0,
    acceptedVersion: acceptance?.version || 0,
    acceptedAt: acceptance?.acceptedAt || null,
    accepted: Boolean(
      rules &&
      acceptance &&
      acceptance.version === rules.version
    )
  };
}
