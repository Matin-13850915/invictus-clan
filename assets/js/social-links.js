
import {
  getRecord,
  updateRecord,
  deleteData
} from "./database.js";

import { canEditSiteContent } from "./permissions.js";

const LINKS_PATH = "siteSettings/socialLinks";

export const ALLOWED_PLATFORMS = Object.freeze([
  "telegram",
  "rubika",
  "discord",
  "instagram",
  "youtube",
  "website"
]);

function requireAdmin(actor) {
  if (!canEditSiteContent(actor)) {
    throw new Error("فقط ادمین اجازه مدیریت لینک‌ها را دارد.");
  }
}

function validatePlatform(platform) {
  if (
    typeof platform !== "string" ||
    !ALLOWED_PLATFORMS.includes(platform)
  ) {
    throw new Error("این شبکه اجتماعی پشتیبانی نمی‌شود.");
  }

  return platform;
}

function validateUrl(value) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 500
  ) {
    throw new Error("لینک معتبر نیست.");
  }

  let url;

  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("فرمت لینک صحیح نیست.");
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.hostname.includes("..") ||
    url.hostname.startsWith(".") ||
    url.hostname.endsWith(".")
  ) {
    throw new Error("فقط لینک HTTPS معتبر مجاز است.");
  }

  return url.href;
}

function normalizeSavedItem(item) {
  if (
    !item ||
    typeof item !== "object" ||
    Array.isArray(item)
  ) {
    return null;
  }

  try {
    return {
      url: validateUrl(item.url),
      active: item.active === true
    };
  } catch {
    return null;
  }
}

export async function getSocialLinks() {
  const saved = await getRecord(LINKS_PATH);

  if (
    !saved ||
    typeof saved !== "object" ||
    Array.isArray(saved)
  ) {
    return {};
  }

  const result = {};

  for (const platform of ALLOWED_PLATFORMS) {
    const item = normalizeSavedItem(saved[platform]);

    if (!item || !item.active) continue;

    result[platform] = item;
  }

  return result;
}

export async function getAllSocialLinks(actor) {
  requireAdmin(actor);

  const saved = await getRecord(LINKS_PATH);

  if (
    !saved ||
    typeof saved !== "object" ||
    Array.isArray(saved)
  ) {
    return {};
  }

  const result = {};

  for (const platform of ALLOWED_PLATFORMS) {
    const item = saved[platform];

    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      continue;
    }

    result[platform] = {
      url: typeof item.url === "string" ? item.url : "",
      active: item.active === true,
      updatedAt: Number.isFinite(item.updatedAt)
        ? item.updatedAt
        : null,
      updatedBy: typeof item.updatedBy === "string"
        ? item.updatedBy
        : null
    };
  }

  return result;
}

export async function updateSocialLink(platform, url, actor) {
  requireAdmin(actor);

  validatePlatform(platform);
  const validUrl = validateUrl(url);

  await updateRecord(`${LINKS_PATH}/${platform}`, {
    url: validUrl,
    active: true,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });

  return true;
}

export async function toggleSocialLink(platform, active, actor) {
  requireAdmin(actor);

  validatePlatform(platform);

  if (typeof active !== "boolean") {
    throw new Error("وضعیت باید روشن یا خاموش باشد.");
  }

  const path = `${LINKS_PATH}/${platform}`;
  const current = await getRecord(path);

  if (
    !current ||
    typeof current.url !== "string"
  ) {
    throw new Error("ابتدا لینک این شبکه را ثبت کنید.");
  }

  validateUrl(current.url);

  await updateRecord(path, {
    active,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });

  return true;
}

export async function deleteSocialLink(platform, actor) {
  requireAdmin(actor);

  validatePlatform(platform);

  const path = `${LINKS_PATH}/${platform}`;
  const current = await getRecord(path);

  if (!current) return false;

  await deleteData(path);

  return true;
}
