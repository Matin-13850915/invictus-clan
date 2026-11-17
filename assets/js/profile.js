
import {
  readData,
  updateData
} from "./database.js";

import {
  normalizeText
} from "./utils.js";

export async function getProfile(uid) {
  if (!uid) {
    throw new Error("شناسه کاربر معتبر نیست.");
  }

  return await readData(`profiles/${uid}`);
}

export async function updateOwnProfile(uid, changes) {
  if (!uid || !changes || typeof changes !== "object") {
    throw new Error("اطلاعات پروفایل معتبر نیست.");
  }

  const allowedFields = [
    "displayName",
    "gameName",
    "gameLevel",
    "telegram",
    "rubika",
    "bio"
  ];

  const safeChanges = {};

  for (const field of allowedFields) {
    if (Object.hasOwn(changes, field)) {
      safeChanges[field] = changes[field];
    }
  }

  if (Object.keys(safeChanges).length === 0) {
    throw new Error("اطلاعاتی برای ویرایش ارسال نشده است.");
  }

  if (safeChanges.displayName !== undefined) {
    safeChanges.displayName = normalizeText(
      safeChanges.displayName
    );

    if (safeChanges.displayName.length < 2 ||
        safeChanges.displayName.length > 40) {
      throw new Error("نام نمایشی باید بین ۲ تا ۴۰ حرف باشد.");
    }
  }

  if (safeChanges.gameName !== undefined) {
    safeChanges.gameName = normalizeText(
      safeChanges.gameName
    );

    if (safeChanges.gameName.length < 2 ||
        safeChanges.gameName.length > 40) {
      throw new Error("نام داخل بازی معتبر نیست.");
    }
  }

  if (safeChanges.gameLevel !== undefined) {
    const level = Number(safeChanges.gameLevel);

    if (!Number.isInteger(level) || level < 1 || level > 500) {
      throw new Error("لول بازی معتبر نیست.");
    }

    safeChanges.gameLevel = level;
  }

  if (safeChanges.bio !== undefined) {
    safeChanges.bio = normalizeText(safeChanges.bio);

    if (safeChanges.bio.length > 300) {
      throw new Error("توضیحات پروفایل حداکثر ۳۰۰ حرف است.");
    }
  }

  safeChanges.updatedAt = Date.now();

  await updateData(`profiles/${uid}`, safeChanges);

  return true;
}

export async function getPublicProfile(uid) {
  const profile = await getProfile(uid);

  if (!profile) return null;

  return {
    displayName: profile.displayName || "",
    gameName: profile.gameName || "",
    gameLevel: profile.gameLevel || null,
    bio: profile.bio || "",
    joinedAt: profile.joinedAt || null
  };
}
