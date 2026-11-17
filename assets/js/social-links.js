
import {
  getRecord,
  updateRecord,
  deleteData
} from "./database.js";

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
  if (!actor?.uid || actor.role !== "admin") {
    throw new Error("فقط ادمین اجازه مدیریت لینک‌ها را دارد.");
  }
}

function validatePlatform(platform) {
  if (!ALLOWED_PLATFORMS.includes(platform)) {
    throw new Error("این شبکه اجتماعی پشتیبانی نمی‌شود.");
  }

  return platform;
}

function validateUrl(value) {
  if (typeof value !== "string" || value.trim().length > 500) {
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
    url.password
  ) {
    throw new Error("فقط لینک HTTPS معتبر مجاز است.");
  }

  return url.href;
}

// دریافت لینک‌های فعال و معتبر برای نمایش عمومی
export async function getSocialLinks() {
  const saved = await getRecord(LINKS_PATH);

  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    return {};
  }

  const result = {};

  for (const platform of ALLOWED_PLATFORMS) {
    const item = saved[platform];

    if (!item || item.active !== true) {
      continue;
    }

    try {
      result[platform] = {
        url: validateUrl(item.url),
        active: true
      };
    } catch {
      // لینک نامعتبر نمایش داده نمی‌شود.
    }
  }

  return result;
}

// دریافت تمام لینک‌ها برای پنل مدیریت
export async function getAllSocialLinks(actor) {
  requireAdmin(actor);

  const saved = await getRecord(LINKS_PATH);

  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    return {};
  }

  const result = {};

  for (const platform of ALLOWED_PLATFORMS) {
    const item = saved[platform];

    if (!item || typeof item !== "object") {
      continue;
    }

    result[platform] = {
      url: typeof item.url === "string" ? item.url : "",
      active: item.active === true,
      updatedAt: item.updatedAt || null,
      updatedBy: item.updatedBy || null
    };
  }

  return result;
}

// افزودن یا ویرایش لینک
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

// فعال یا غیرفعال کردن لینک
export async function toggleSocialLink(platform, active, actor) {
  requireAdmin(actor);

  validatePlatform(platform);

  if (typeof active !== "boolean") {
    throw new Error("وضعیت باید روشن یا خاموش باشد.");
  }

  const current = await getRecord(`${LINKS_PATH}/${platform}`);

  if (!current || typeof current.url !== "string") {
    throw new Error("ابتدا لینک این شبکه را ثبت کنید.");
  }

  await updateRecord(`${LINKS_PATH}/${platform}`, {
    active,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });

  return true;
}

// حذف لینک
export async function deleteSocialLink(platform, actor) {
  requireAdmin(actor);

  validatePlatform(platform);

  const current = await getRecord(`${LINKS_PATH}/${platform}`);

  if (!current) {
    return false;
  }

  await deleteData(`${LINKS_PATH}/${platform}`);

  return true;
}
