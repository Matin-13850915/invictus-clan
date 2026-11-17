
import {
  getRecord,
  updateRecord
} from "./database.js";

const LINKS_PATH = "siteSettings/socialLinks";

const ALLOWED_PLATFORMS = [
  "telegram",
  "rubika",
  "discord",
  "instagram",
  "youtube",
  "website"
];

function requireAdmin(actor) {
  if (!actor?.uid || actor.role !== "admin") {
    throw new Error("فقط ادمین اجازه مدیریت لینک‌ها را دارد.");
  }
}

function validateUrl(value) {
  if (typeof value !== "string" || value.length > 500) {
    throw new Error("لینک معتبر نیست.");
  }

  let url;

  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("فرمت لینک صحیح نیست.");
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("فقط لینک HTTP یا HTTPS مجاز است.");
  }

  return url.href;
}

// دریافت لینک‌های عمومی کلن
export async function getSocialLinks() {
  const saved = await getRecord(LINKS_PATH);

  return saved || {};
}

// افزودن یا ویرایش لینک
export async function updateSocialLink(
  platform,
  url,
  actor
) {
  requireAdmin(actor);

  if (!ALLOWED_PLATFORMS.includes(platform)) {
    throw new Error("این شبکه اجتماعی پشتیبانی نمی‌شود.");
  }

  const validUrl = validateUrl(url);

  await updateRecord(LINKS_PATH, {
    [platform]: {
      url: validUrl,
      active: true,
      updatedAt: Date.now(),
      updatedBy: actor.uid
    }
  });

  return true;
}

// فعال یا غیرفعال کردن لینک
export async function toggleSocialLink(
  platform,
  active,
  actor
) {
  requireAdmin(actor);

  if (!ALLOWED_PLATFORMS.includes(platform)) {
    throw new Error("شبکه اجتماعی معتبر نیست.");
  }

  if (typeof active !== "boolean") {
    throw new Error("وضعیت باید روشن یا خاموش باشد.");
  }

  const current = await getRecord(LINKS_PATH);

  if (!current?.[platform]) {
    throw new Error("ابتدا لینک این شبکه را ثبت کنید.");
  }

  await updateRecord(
    `${LINKS_PATH}/${platform}`,
    {
      active,
      updatedAt: Date.now(),
      updatedBy: actor.uid
    }
  );

  return true;
}

// حذف لینک
export async function deleteSocialLink(platform, actor) {
  requireAdmin(actor);

  if (!ALLOWED_PLATFORMS.includes(platform)) {
    throw new Error("شبکه اجتماعی معتبر نیست.");
  }

  const current = await getRecord(LINKS_PATH);

  if (!current?.[platform]) {
    return false;
  }

  const { deleteData } = await import("./database.js");

  await deleteData(`${LINKS_PATH}/${platform}`);

  return true;
}
