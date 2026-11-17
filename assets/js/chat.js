
import {
  createRecord,
  readData,
  updateData,
  deleteData
} from "./database.js";

import { normalizeText } from "./utils.js";

const CHAT_PATH = "chats";
const EDIT_WINDOW = 15 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 2000;

const FIXED_ROOMS = ["general", "attachment"];

function requireUser(user) {
  if (!user?.uid || user.active !== true) {
    throw new Error("برای استفاده از چت باید عضو فعال باشید.");
  }
}

function requireStaff(user) {
  requireUser(user);

  if (!["admin", "leader"].includes(user.role)) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت اتاق‌ها را دارند.");
  }
}

function validateRoomId(id) {
  if (
    typeof id !== "string" ||
    !id.trim() ||
    /[.#$/[\]]/.test(id)
  ) {
    throw new Error("شناسه اتاق معتبر نیست.");
  }
}

function validateMessageId(id) {
  if (
    typeof id !== "string" ||
    !id.trim() ||
    /[.#$/[\]]/.test(id)
  ) {
    throw new Error("شناسه پیام معتبر نیست.");
  }
}

function validateMessage(text) {
  const message = normalizeText(String(text ?? "")).trim();

  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    throw new Error("پیام نمی‌تواند خالی یا بیشتر از ۲۰۰۰ حرف باشد.");
  }

  return message;
}

async function requireAvailableRoom(roomId, user) {
  validateRoomId(roomId);

  const rooms = await getChatRooms(user);

  if (!rooms.some(room => room.id === roomId)) {
    throw new Error("این اتاق وجود ندارد یا غیرفعال است.");
  }
}

export async function getChatRooms(user) {
  requireUser(user);

  const customRooms = await readData(`${CHAT_PATH}/rooms`);

  const rooms = [
    {
      id: "general",
      title: "چت عمومی",
      type: "fixed"
    },
    {
      id: "attachment",
      title: "پیوست",
      type: "fixed"
    }
  ];

  if (
    customRooms &&
    typeof customRooms === "object" &&
    !Array.isArray(customRooms)
  ) {
    for (const [id, room] of Object.entries(customRooms)) {
      if (
        !room ||
        typeof room !== "object" ||
        FIXED_ROOMS.includes(id) ||
        room.active === false
      ) {
        continue;
      }

      rooms.push({
        id,
        title: normalizeText(room.title || "اتاق بدون نام"),
        description: normalizeText(room.description || ""),
        type: "custom"
      });
    }
  }

  return rooms;
}

export async function createChatRoom(data, actor) {
  requireStaff(actor);

  const title = normalizeText(String(data?.title || "")).trim();
  const description = normalizeText(
    String(data?.description || "")
  ).trim();

  if (title.length < 2 || title.length > 50) {
    throw new Error("نام اتاق باید بین ۲ تا ۵۰ حرف باشد.");
  }

  if (description.length > 300) {
    throw new Error("توضیحات اتاق حداکثر ۳۰۰ حرف است.");
  }

  const id = await createRecord(`${CHAT_PATH}/rooms`, {
    title,
    description,
    active: true,
    createdBy: actor.uid
  });

  return id;
}

export async function getMessages(roomId, user) {
  requireUser(user);
  await requireAvailableRoom(roomId, user);

  const data = await readData(
    `${CHAT_PATH}/messages/${roomId}`
  );

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  return Object.entries(data)
    .filter(([id, message]) =>
      message &&
      typeof message === "object" &&
      !Array.isArray(message) &&
      typeof message.text === "string" &&
      typeof message.uid === "string"
    )
    .map(([id, message]) => ({
      id,
      ...message,
      createdAt: Number(message.createdAt) || 0
    }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function sendMessage(roomId, text, user) {
  requireUser(user);
  await requireAvailableRoom(roomId, user);

  const message = validateMessage(text);

  return createRecord(
    `${CHAT_PATH}/messages/${roomId}`,
    {
      uid: user.uid,
      displayName: normalizeText(
        String(user.displayName || "عضو")
      ).slice(0, 50),
      text: message,
      edited: false
    }
  );
}

export async function editMessage(
  roomId,
  messageId,
  newText,
  user
) {
  requireUser(user);
  validateRoomId(roomId);
  validateMessageId(messageId);
  await requireAvailableRoom(roomId, user);

  const path = `${CHAT_PATH}/messages/${roomId}/${messageId}`;
  const message = await readData(path);

  if (!message || message.uid !== user.uid) {
    throw new Error("فقط نویسنده پیام می‌تواند آن را ویرایش کند.");
  }

  const createdAt = Number(message.createdAt) || 0;

  if (
    !createdAt ||
    Date.now() - createdAt > EDIT_WINDOW
  ) {
    throw new Error("مهلت ویرایش پیام (۱۵ دقیقه) تمام شده است.");
  }

  await updateData(path, {
    text: validateMessage(newText),
    edited: true,
    editedAt: Date.now()
  });

  return true;
}

export async function deleteOwnMessage(
  roomId,
  messageId,
  user
) {
  requireUser(user);
  validateRoomId(roomId);
  validateMessageId(messageId);
  await requireAvailableRoom(roomId, user);

  const path = `${CHAT_PATH}/messages/${roomId}/${messageId}`;
  const message = await readData(path);

  if (!message || message.uid !== user.uid) {
    throw new Error("فقط نویسنده پیام می‌تواند آن را حذف کند.");
  }

  await deleteData(path);

  return true;
}

export async function deleteAnyMessage(
  roomId,
  messageId,
  actor
) {
  requireStaff(actor);
  validateRoomId(roomId);
  validateMessageId(messageId);

  const path = `${CHAT_PATH}/messages/${roomId}/${messageId}`;
  const message = await readData(path);

  if (!message) {
    throw new Error("پیام موردنظر پیدا نشد.");
  }

  await deleteData(path);

  return true;
}

export async function deactivateChatRoom(roomId, actor) {
  requireStaff(actor);
  validateRoomId(roomId);

  if (FIXED_ROOMS.includes(roomId)) {
    throw new Error("اتاق‌های اصلی قابل غیرفعال‌سازی نیستند.");
  }

  const path = `${CHAT_PATH}/rooms/${roomId}`;
  const room = await readData(path);

  if (!room) {
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
  validateRoomId(roomId);

  if (FIXED_ROOMS.includes(roomId)) {
    throw new Error("اتاق اصلی نیازی به فعال‌سازی ندارد.");
  }

  const path = `${CHAT_PATH}/rooms/${roomId}`;
  const room = await readData(path);

  if (!room) {
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
  validateRoomId(roomId);

  if (FIXED_ROOMS.includes(roomId)) {
    throw new Error("اتاق‌های اصلی قابل حذف نیستند.");
  }

  const path = `${CHAT_PATH}/rooms/${roomId}`;
  const room = await readData(path);

  if (!room) {
    throw new Error("اتاق موردنظر پیدا نشد.");
  }

  await updateData(path, {
    active: false,
    deletedBy: actor.uid,
    deletedAt: Date.now()
  });

  return true;
    }
