
import { normalizeText } from "./utils.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function cleanQuery(query) {
  if (typeof query !== "string") {
    return "";
  }

  return normalizeText(query.trim()).slice(0, 150);
}

function searchableText(item, fields) {
  if (!item || typeof item !== "object") {
    return "";
  }

  return fields
    .map(field => item[field])
    .filter(value =>
      typeof value === "string" ||
      (typeof value === "number" && Number.isFinite(value))
    )
    .join(" ");
}

export function searchItems(items, query, fields = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error("فیلدهای جستجو مشخص نشده‌اند.");
  }

  const normalizedQuery = cleanQuery(query);

  if (!normalizedQuery) {
    return items.slice(0, DEFAULT_LIMIT);
  }

  return items.filter(item => {
    const text = normalizeText(searchableText(item, fields));
    return text.includes(normalizedQuery);
  });
}

export function searchForumItems(items, query) {
  return searchItems(items, query, [
    "title",
    "description"
  ]);
}

export function searchAnnouncements(items, query) {
  return searchItems(items, query, [
    "title",
    "content",
    "authorName"
  ]);
}

export function searchMembers(items, query) {
  return searchItems(items, query, [
    "displayName",
    "gameName",
    "role",
    "specialty"
  ]);
}

export function searchWars(items, query) {
  return searchItems(items, query, [
    "title",
    "opponent",
    "type",
    "status"
  ]);
}

export function searchTickets(items, query) {
  return searchItems(items, query, [
    "title",
    "subject",
    "status",
    "category"
  ]);
}

export function searchTournaments(items, query) {
  return searchItems(items, query, [
    "title",
    "description",
    "gameMode",
    "status"
  ]);
}

export function searchTeams(items, query) {
  return searchItems(items, query, [
    "name",
    "description",
    "type",
    "captainName"
  ]);
}

export function searchApplications(items, query) {
  return searchItems(items, query, [
    "gameName",
    "realName",
    "email",
    "status",
    "applicationType"
  ]);
}

export function searchMessages(items, query) {
  return searchItems(items, query, [
    "content",
    "authorName",
    "roomName"
  ]);
}

export function searchWithLimit(
  items,
  query,
  fields,
  limit = DEFAULT_LIMIT
) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_LIMIT
  ) {
    throw new Error("محدودیت نتایج معتبر نیست.");
  }

  const results = searchItems(items, query, fields);

  return results.slice(0, limit);
}

export function findById(items, id) {
  if (!Array.isArray(items) || id === undefined || id === null) {
    return null;
  }

  const target = String(id);

  return items.find(item =>
    item?.id !== undefined &&
    String(item.id) === target
  ) || null;
}
