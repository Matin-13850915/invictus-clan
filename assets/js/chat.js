
import {
  createRecord,
  readData,
  updateData
} from "./database.js";

import { normalizeText } from "./utils.js";

const ROOT = "chats";
const FIXED_ROOMS = ["general", "attachment"];
const EDIT_WINDOW = 15 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 2000;

function requireActiveUser(user) {
  if (
    !user ||
    typeof user.uid !== "string" ||
    !user.uid.trim() ||
    user.active !== true
  ) {
    throw new Error("برای استفاده از چت باید عضو فعال باشید.");
  }
}

function requireStaff(user) {
  requireActiveUser(user);

  if (!["admin", "leader"].includes(user.role)) {
    throw new Error("این عملیات فقط برای ادمین و لیدر مجاز است.");
  }
}

function validateId(value, label) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(value)
  ) {
    throw new Error(`${label} معتبر نیست.`);
  }

  return value;
}

function cleanText(value, maxLength, label = "متن") {
  const text = normalizeText(String(value ?? "")).trim();

  if (!text || text.length > maxLength) {
    throw new Error(`${label} باید بین ۱ تا ${maxLength} کاراکتر باشد.`);
  }

  return text;
}

async function getRoomRecord(roomId) {
  if (FIXED_ROOMS.includes(roomId)) {
    return {
      id: roomId,
      title: roomId === "general" ? "چت عمومی" : "پیوست",
      description: "",
      active: true,
      type: "fixed"
    };
  }

  const room = await readData(`${ROOT}/rooms/${roomId}`);

  if (
    !room ||
    typeof room !== "object" ||
    room.deletedAt
  ) {
    return null;
  }

  return {
    ...room,
    id: roomId,
    type: "custom"
  };
}

async function requireUsableRoom(roomId, user) {
  validateId(roomId, "شناسه اتاق");

  const room = await getRoomRecord(roomId);

  if (!room) {
    throw new Error("اتاق موردنظر پیدا نشد.");
  }

  if (room.active === false && !["admin", "leader"].includes(user.role)) {
    throw new Error("این اتاق غیرفعال است.");
  }

  return room;
}

export async function getChatRooms(user) {
  requireActiveUser(user);

  const roomsData = await readData(`${ROOT}/rooms`);
  const rooms = [
    {
      id: "general",
      title: "چت عمومی",
      description: "",
      active: true,
      type: "fixed"
    },
    {
      id: "attachment",
      title: "پیوست",
      description: "",
      active: true,
      type: "fixed"
    }
  ];

  if (
    roomsData &&
    typeof roomsData === "object" &&
    !Array.isArray(roomsData)
  ) {
    for (const [id, room] of Object.entries(roomsData)) {
      if (
        !room ||
        typeof room !== "object" ||
        Array.isArray(room) ||
        FIXED_ROOMS.includes(id) ||
        room.deletedAt
      ) {
        continue;
      }

      if (room.active === false && !["admin", "leader"].includes(user.role)) {
        continue;
      }

      rooms.push({
        ...room,
        id,
        title: normalizeText(room.title || "اتاق بدون نام"),
        description: normalizeText(room.description || ""),
        active: room.active !== false,
        type: "custom"
      });
    }
  }

  return rooms;
}

export async function createChatRoom(data, actor) {
  requireStaff(actor);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات اتاق معتبر نیست.");
  }

  const title = cleanText(data.title, 50, "نام اتاق");
  const description = data.description
    ? normalizeText(String(data.description)).trim()
    : "";

  if (title.length < 2) {
    throw new Error("نام اتاق باید حداقل ۲ حرف باشد.");
  }

  if (description.length > 300) {
    throw new Error("توضیحات اتاق حداکثر ۳۰۰ حرف است.");
  }

  return createRecord(`${ROOT}/rooms`, {
    title,
    description,
    active: true,
    createdBy: actor.uid
  });
}

export async function getMessages(roomId, user) {
  requireActiveUser(user);
  await requireUsableRoom(roomId, user);

  const data = await readData(`${ROOT}/messages/${roomId}`);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  return Object.entries(data)
    .filter(([, message]) =>
      message &&
      typeof message === "object" &&
      !Array.isArray(message) &&
      message.deleted !== true &&
      typeof message.text === "string"
    )
    .map(([id, message]) => ({
      ...message,
      id,
      createdAt: Number(message.createdAt) || 0
    }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function sendMessage(roomId, text, user) {
  requireActiveUser(user);
  await requireUsableRoom(roomId, user);

  const message = cleanText(
    text,
    MAX_MESSAGE_LENGTH,
    "پیام"
  );

  return createRecord(`${ROOT}/messages/${roomId}`, {
    uid: user.uid,
    displayName: normalizeText(
      String(user.displayName || user.gameName || "عضو")
    ).slice(0, 50),
    text: message,
    edited: false,
    deleted: false
  });
}

export async function editMessage(roomId, messageId, newText, user) {
  requireActiveUser(user);

  validateId(roomId, "شناسه اتاق");
  validateId(messageId, "شناسه پیام");

  await requireUsableRoom(roomId, user);

  const path = `${ROOT}/messages/${roomId}/${messageId}`;
  const message = await readData(path);

  if (
    !message ||
    message.uid !== user.uid ||
    message.deleted === true
  ) {
    throw new Error("فقط نویسنده می‌تواند پیام خودش را ویرایش کند.");
  }

  const createdAt = Number(message.createdAt) || 0;

  if (
    !createdAt ||
    Date.now() - createdAt > EDIT_WINDOW
  ) {
    throw new Error("مهلت ویرایش پیام (۱۵ دقیقه) تمام شده است.");
  }

  await updateData(path, {
    text: cleanText(newText, MAX_MESSAGE_LENGTH, "پیام"),
    edited: true,
    editedAt: Date.now()
  });

  return true;
}

export async function deleteOwnMessage(roomId, messageId, user) {
  requireActiveUser(user);

  validateId(roomId, "شناسه اتاق");
  validateId(messageId, "شناسه پیام");

  await requireUsableRoom(roomId, user);

  const path = `${ROOT}/messages/${roomId}/${messageId}`;
  const message = await readData(path);

  if (
    !message ||
    message.uid !== user.uid ||
    message.deleted === true
  ) {
    throw new Error("فقط نویسنده می‌تواند پیام خودش را حذف کند.");
  }

  await updateData(path, {
    text: "",
    deleted: true,
    deletedAt: Date.now(),
    deletedBy: user.uid
  });

  return true;
}

export async function deleteAnyMessage(roomId, messageId, actor) {
  requireStaff(actor);

  validateId(roomId, "شناسه اتاق");
  validateId(messageId, "شناسه پیام");

  const path = `${ROOT}/messages/${roomId}/${messageId}`;
  const message = await readData(path);

  if (!message || message.deleted === true) {
    throw new Error("پیام موردنظر پیدا نشد.");
  }

  await updateData(path, {
    text: "",
    deleted: true,
    deletedAt: Date.now(),
    deletedBy: actor.uid
  });

  return true;
}

export async function deactivateChatRoom(roomId, actor) {
  requireStaff(actor);
  validateId(roomId, "شناسه اتاق");

  if (FIXED_ROOMS.includes(roomId)) {
    throw new Error("اتاق‌های اصلی قابل غیرفعال‌سازی نیستند.");
  }

  const path = `${ROOT}/rooms/${roomId}`;
  const room = await readData(path);

  if (!room || room.deletedAt) {
    throw new Error("اتاق موردنظر پیدا نشد.");
  }

  await updateData(path, {
    active: false,
    deactivatedBy: actor.uid,
    deactivatedAt: Date.now()
  });

  return true;
}

export async function activateChatRoom(roomId, actor) {
  requireStaff(actor);
  validateId(roomId, "شناسه اتاق");

  if (FIXED_ROOMS.includes(roomId)) {
    throw new Error("اتاق‌های اصلی همیشه فعال هستند.");
  }

  const path = `${ROOT}/rooms/${roomId}`;
  const room = await readData(path);

  if (!room || room.deletedAt) {
    throw new Error("اتاق موردنظر پیدا نشد.");
  }

  await updateData(path, {
    active: true,
    activatedBy: actor.uid,
    activatedAt: Date.now()
  });

  return true;
}

export async function deleteChatRoom(roomId, actor) {
  requireStaff(actor);
  validateId(roomId, "شناسه اتاق");

  if (FIXED_ROOMS.includes(roomId)) {
    throw new Error("اتاق‌های اصلی قابل حذف نیستند.");
  }

  const path = `${ROOT}/rooms/${roomId}`;
  const room = await readData(path);

  if (!room || room.deletedAt) {
    throw new Error("اتاق موردنظر پیدا نشد.");
  }

  await updateData(path, {
    active: false,
    deletedAt: Date.now(),
    deletedBy: actor.uid
  });

  return true;
}
