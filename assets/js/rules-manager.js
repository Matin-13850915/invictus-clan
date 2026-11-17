
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord
} from "./database.js";

const RULES_PATH = "clanRules";
const ACCEPTANCE_PATH = "ruleAcceptances";

function requireUser(actor) {
  if (!actor?.uid) {
    throw new Error("ابتدا وارد حساب خود شوید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت قوانین را دارند.");
  }
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    throw new Error("متن واردشده معتبر نیست.");
  }

  const result = value.trim();

  if (!result || result.length > maxLength) {
    throw new Error(`متن باید بین ۱ تا ${maxLength} کاراکتر باشد.`);
  }

  return result;
}

// ایجاد نسخه جدید قوانین
export async function createRulesVersion(data, actor) {
  requireStaff(actor);

  const title = cleanText(data.title, 100);
  const content = cleanText(data.content, 15000);

  const current = await getRecord(`${RULES_PATH}/current`);

  const version = current?.version
    ? current.version + 1
    : 1;

  const rule = {
    version,
    title,
    content,
    active: true,
    createdAt: Date.now(),
    createdBy: actor.uid
  };

  const historyRecord = await createRecord(
    `${RULES_PATH}/history`,
    rule
  );

  await updateRecord(`${RULES_PATH}/current`, {
    ...rule,
    historyId: historyRecord?.id || null
  });

  return rule;
}

// دریافت آخرین نسخه قوانین
export async function getCurrentRules(actor) {
  requireUser(actor);

  return await getRecord(`${RULES_PATH}/current`);
}

// ثبت پذیرش قوانین
export async function acceptCurrentRules(actor) {
  requireUser(actor);

  const rules = await getCurrentRules(actor);

  if (!rules?.version) {
    throw new Error("هنوز نسخه‌ای از قوانین منتشر نشده است.");
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

// بررسی پذیرش آخرین نسخه
export async function hasAcceptedCurrentRules(actor) {
  requireUser(actor);

  const rules = await getCurrentRules(actor);

  if (!rules?.version) return true;

  const acceptance = await getRecord(
    `${ACCEPTANCE_PATH}/${actor.uid}`
  );

  return acceptance?.version === rules.version;
}

// مشاهده تاریخچه نسخه‌ها
export async function getRulesHistory(actor) {
  requireStaff(actor);

  const history = await getAllRecords(`${RULES_PATH}/history`);

  return history.sort(
    (a, b) => (b.version || 0) - (a.version || 0)
  );
}
