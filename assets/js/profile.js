
import {
  readData,
  updateData
} from "./database.js";

import { normalizeText } from "./utils.js";

function validateUid(uid) {
  if (
    typeof uid !== "string" ||
    !uid.trim() ||
    uid.length > 128 ||
    /[.#$/\[\]]/.test(uid)
  ) {
    throw new Error("شناسه کاربر معتبر نیست.");
  }

  return uid;
}

function requireOwner(uid, actor) {
  validateUid(uid);

  if (
    !actor?.uid ||
    actor.active !== true ||
    actor.uid !== uid
  ) {
    throw new Error(
      "فقط صاحب حساب می‌تواند این پروفایل را تغییر دهد."
    );
  }
}

function cleanText(value, label, maxLength) {
  if (typeof value !== "string") {
    throw new Error(`${label} معتبر نیست.`);
  }

  const clean = normalizeText(value);

  if (clean.length > maxLength) {
    throw new Error(
      `${label} نمی‌تواند بیشتر از ${maxLength} کاراکتر باشد.`
    );
  }

  return clean;
}

export async function getProfile(uid, actor) {
  validateUid(uid);

  if (
    !actor?.uid ||
    actor.active !== true ||
    actor.uid !== uid
  ) {
    throw new Error(
      "اجازه مشاهده اطلاعات خصوصی این پروفایل را ندارید."
    );
  }

  return await readData(`users/${uid}`);
}

export async function updateOwnProfile(uid, changes, actor) {
  requireOwner(uid, actor);

  if (
    !changes ||
    typeof changes !== "object" ||
    Array.isArray(changes)
  ) {
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

  const unknownFields = Object.keys(changes).filter(
    field => !allowedFields.includes(field)
  );

  if (unknownFields.length) {
    throw new Error(
      "فقط اطلاعات شخصی مجاز قابل ویرایش هستند."
    );
  }

  const safeChanges = {};

  if (Object.hasOwn(changes, "displayName")) {
    safeChanges.displayName = cleanText(
      changes.displayName,
      "نام نمایشی",
      40
    );

    if (safeChanges.displayName.length < 2) {
      throw new Error(
        "نام نمایشی باید حداقل ۲ کاراکتر باشد."
      );
    }
  }

  if (Object.hasOwn(changes, "gameName")) {
    safeChanges.gameName = cleanText(
      changes.gameName,
      "نام داخل بازی",
      40
    );

    if (safeChanges.gameName.length < 2) {
      throw new Error(
        "نام داخل بازی باید حداقل ۲ کاراکتر باشد."
      );
    }
  }

  if (Object.hasOwn(changes, "gameLevel")) {
    const level = Number(changes.gameLevel);

    if (
      !Number.isInteger(level) ||
      level < 1 ||
      level > 500
    ) {
      throw new Error("لول بازی باید بین ۱ تا ۵۰۰ باشد.");
    }

    safeChanges.gameLevel = level;
  }

  for (const field of ["telegram", "rubika"]) {
    if (Object.hasOwn(changes, field)) {
      safeChanges[field] = cleanText(
        changes[field],
        field === "telegram" ? "آیدی تلگرام" : "آیدی روبیکا",
        60
      );
    }
  }

  if (Object.hasOwn(changes, "bio")) {
    safeChanges.bio = cleanText(
      changes.bio,
      "درباره من",
      300
    );
  }

  if (!Object.keys(safeChanges).length) {
    throw new Error(
      "اطلاعاتی برای ویرایش ارسال نشده است."
    );
  }

  safeChanges.updatedAt = Date.now();

  await updateData(`users/${uid}`, safeChanges);

  return true;
}

export async function getPublicProfile(uid) {
  validateUid(uid);

  const profile = await readData(`users/${uid}`);

  if (!profile) return null;

  return {
    displayName: profile.displayName || "",
    gameName: profile.gameName || "",
    gameLevel: profile.gameLevel || null,
    bio: profile.bio || "",
    joinedAt: profile.joinedAt || profile.createdAt || null
  };
}
