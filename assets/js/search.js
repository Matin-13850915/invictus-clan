
import { normalizeText } from "./utils.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_QUERY_LENGTH = 150;

function cleanQuery(query) {
  if (typeof query !== "string") return "";

  return normalizeText(
    query
      .replace(/\s+/g, " ")
      .trim()
  ).slice(0, MAX_QUERY_LENGTH);
}

function getFieldValue(item, path) {
  if (!item || typeof item !== "object") return "";

  return path.split(".").reduce((value, key) => {
    if (value === null || value === undefined) return "";
    return value[key];
  }, item);
}

function searchableText(item, fields) {
  if (!item || typeof item !== "object") return "";

  return fields
    .map(field => getFieldValue(item, field))
    .filter(value =>
      typeof value === "string" ||
      (typeof value === "number" && Number.isFinite(value)) ||
      typeof value === "boolean"
    )
    .join(" ");
}

export function searchItems(
  items,
  query,
  fields = [],
  limit = DEFAULT_LIMIT
) {
  if (!Array.isArray(items)) return [];

  if (
    !Array.isArray(fields) ||
    fields.length === 0 ||
    fields.some(field =>
      typeof field !== "string" || !field.trim()
    )
  ) {
    throw new Error("فیلدهای جستجو مشخص نشده‌اند.");
  }

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_LIMIT
  ) {
    throw new Error("محدودیت نتایج معتبر نیست.");
  }

  const normalizedQuery = cleanQuery(query);

  if (!normalizedQuery) {
    return items.slice(0, limit);
  }

  const terms = normalizedQuery
    .split(" ")
    .filter(Boolean);

  return items
    .filter(item => {
      const text = normalizeText(
        searchableText(item, fields)
      );

      return terms.every(term => text.includes(term));
    })
    .slice(0, limit);
}

export function searchForumItems(items, query) {
  return searchItems(items, query, [
    "title",
    "description",
    "authorName"
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
    "text",
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
  return searchItems(items, query, fields, limit);
}

export function findById(items, id) {
  if (
    !Array.isArray(items) ||
    id === undefined ||
    id === null
  ) {
    return null;
  }

  const target = String(id);

  return items.find(item =>
    item?.id !== undefined &&
    String(item.id) === target
  ) || null;
}
