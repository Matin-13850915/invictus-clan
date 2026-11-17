
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord
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

function validateId(value, label) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 128 ||
    /[.#$/\[\]]/.test(value)
  ) {
    throw new Error(`${label} معتبر نیست.`);
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

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات قوانین معتبر نیست.");
  }

  const title = cleanText(data.title, 100);
  const content = cleanText(data.content, 15000);

  const current = await getRecord(`${RULES_PATH}/current`);

  const version = Number(current?.version || 0) + 1;
  const now = Date.now();

  const rule = {
    version,
    title,
    content,
    active: true,
    createdAt: now,
    createdBy: actor.uid
  };

  const historyId = await createRecord(
    `${RULES_PATH}/history`,
    rule
  );

  await updateRecord(`${RULES_PATH}/current`, {
    ...rule,
    historyId
  });

  return {
    ...rule,
    historyId
  };
}

// دریافت آخرین نسخه قوانین
export async function getCurrentRules(actor) {
  requireUser(actor);

  return getRecord(`${RULES_PATH}/current`);
}

// ثبت پذیرش نسخه فعلی قوانین
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

  // آخرین پذیرش عضو
  await updateRecord(
    `${ACCEPTANCE_PATH}/${actor.uid}/current`,
    acceptance
  );

  // سابقه مستقل پذیرش‌ها
  await createRecord(
    `${ACCEPTANCE_PATH}/${actor.uid}/history`,
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
    `${ACCEPTANCE_PATH}/${actor.uid}/current`
  );

  return Number(acceptance?.version) === Number(rules.version);
}

// دریافت سابقه پذیرش قوانین توسط یک عضو
export async function getMyRulesAcceptanceHistory(actor) {
  requireUser(actor);

  const history = await getAllRecords(
    `${ACCEPTANCE_PATH}/${actor.uid}/history`
  );

  return history.sort(
    (a, b) => (Number(b.acceptedAt) || 0) -
      (Number(a.acceptedAt) || 0)
  );
}

// مشاهده تاریخچه نسخه‌های قوانین
export async function getRulesHistory(actor) {
  requireStaff(actor);

  const history = await getAllRecords(`${RULES_PATH}/history`);

  return history.sort(
    (a, b) => (Number(b.version) || 0) -
      (Number(a.version) || 0)
  );
}

// دریافت تاریخچه پذیرش همه اعضا؛ فقط ادمین
export async function getAllRulesAcceptanceHistory(actor) {
  requireStaff(actor);

  if (actor.role !== "admin") {
    throw new Error("مشاهده تاریخچه همه اعضا مخصوص ادمین است.");
  }

  return getAllRecords(ACCEPTANCE_PATH);
    }
