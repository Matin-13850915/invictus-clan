
import { normalizeText } from "./utils.js";

const DEFAULT_LIMIT = 50;

function cleanQuery(query) {
  if (typeof query !== "string") {
    return "";
  }

  return normalizeText(query.trim()).slice(0, 150);
}

function searchableText(item, fields) {
  return fields
    .map(field => item?.[field])
    .filter(value =>
      typeof value === "string" ||
      typeof value === "number"
    )
    .join(" ");
}

// جستجوی عمومی در داده‌های از قبل دریافت‌شده
export function searchItems(items, query, fields = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  const normalizedQuery = cleanQuery(query);

  if (!normalizedQuery) {
    return items;
  }

  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error("فیلدهای جستجو مشخص نشده‌اند.");
  }

  return items.filter(item => {
    const text = normalizeText(searchableText(item, fields));

    return text.includes(normalizedQuery);
  });
}

// جستجوی موضوعات انجمن
export function searchForumItems(items, query) {
  return searchItems(
    items,
    query,
    ["title", "description"]
  );
}

// جستجوی اطلاعیه‌ها
export function searchAnnouncements(items, query) {
  return searchItems(
    items,
    query,
    ["title", "content", "authorName"]
  );
}

// جستجوی اعضا
export function searchMembers(items, query) {
  return searchItems(
    items,
    query,
    ["displayName", "gameName", "role", "specialty"]
  );
}

// جستجوی جنگ‌ها
export function searchWars(items, query) {
  return searchItems(
    items,
    query,
    ["title", "opponent", "type", "status"]
  );
}

// جستجوی تیکت‌ها
export function searchTickets(items, query) {
  return searchItems(
    items,
    query,
    ["title", "subject", "status", "category"]
  );
}

// جستجوی مسابقات
export function searchTournaments(items, query) {
  return searchItems(
    items,
    query,
    ["title", "description", "gameMode", "status"]
  );
}

// جستجوی تیم‌ها
export function searchTeams(items, query) {
  return searchItems(
    items,
    query,
    ["name", "description", "type", "captainName"]
  );
}

// جستجوی درخواست‌های عضویت
export function searchApplications(items, query) {
  return searchItems(
    items,
    query,
    ["gameName", "realName", "email", "status", "applicationType"]
  );
}

// جستجوی پیام‌های انجمن یا چت
export function searchMessages(items, query) {
  return searchItems(
    items,
    query,
    ["content", "authorName", "roomName"]
  );
}

// جستجو با محدودیت تعداد نتیجه
export function searchWithLimit(
  items,
  query,
  fields,
  limit = DEFAULT_LIMIT
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new Error("محدودیت نتایج معتبر نیست.");
  }

  return searchItems(items, query, fields).slice(0, limit);
}

// جستجوی دقیق بر اساس شناسه
export function findById(items, id) {
  if (!Array.isArray(items) || typeof id !== "string") {
    return null;
  }

  return items.find(item => item?.id === id) || null;
}
