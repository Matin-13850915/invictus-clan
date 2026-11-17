
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

const FIXED_ROOMS = ["general", "peivast"];

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

function validateMessage(text) {
  const message = normalizeText(text);

  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    throw new Error("پیام نمی‌تواند خالی یا بیشتر از ۲۰۰۰ حرف باشد.");
  }

  return message;
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
      id: "peivast",
      title: "پیوست",
      type: "fixed"
    }
  ];

  if (customRooms) {
    for (const [id, room] of Object.entries(customRooms)) {
      if (room.active !== false) {
        rooms.push({
          id,
          title: room.title,
          description: room.description || "",
          type: "custom"
        });
      }
    }
  }

  return rooms;
}

export async function createChatRoom(data, actor) {
  requireStaff(actor);

  const title = normalizeText(data?.title);
  const description = normalizeText(data?.description || "");

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
    createdBy: actor.uid,
    createdAt: Date.now()
  });

  return id;
}

export async function getMessages(roomId, user) {
  requireUser(user);

  if (!roomId) {
    throw new Error("شناسه اتاق معتبر نیست.");
  }

  const data = await readData(`${CHAT_PATH}/messages/${roomId}`);

  if (!data) return [];

  return Object.entries(data)
    .map(([id, message]) => ({
      id,
      ...message
    }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function sendMessage(roomId, text, user) {
  requireUser(user);

  if (!roomId) {
    throw new Error("شناسه اتاق معتبر نیست.");
  }

  const message = validateMessage(text);

  const rooms = await getChatRooms(user);

  if (!rooms.some(room => room.id === roomId)) {
    throw new Error("این اتاق وجود ندارد یا غیرفعال است.");
  }

  return await createRecord(
    `${CHAT_PATH}/messages/${roomId}`,
    {
      uid: user.uid,
      displayName: normalizeText(user.displayName || "عضو"),
      text: message,
      createdAt: Date.now(),
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

  if (!roomId || !messageId) {
    throw new Error("شناسه پیام معتبر نیست.");
  }

  const path = `${CHAT_PATH}/messages/${roomId}/${messageId}`;
  const message = await readData(path);

  if (!message || message.uid !== user.uid) {
    throw new Error("فقط نویسنده پیام می‌تواند آن را ویرایش کند.");
  }

  if (Date.now() - message.createdAt > EDIT_WINDOW) {
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

  if (!roomId || !messageId) {
    throw new Error("شناسه پیام معتبر نیست.");
  }

  await deleteData(
    `${CHAT_PATH}/messages/${roomId}/${messageId}`
  );

  return true;
}

export async function deactivateChatRoom(roomId, actor) {
  requireStaff(actor);

  if (!roomId || FIXED_ROOMS.includes(roomId)) {
    throw new Error("این اتاق قابل غیرفعال‌سازی نیست.");
  }

  await updateData(`${CHAT_PATH}/rooms/${roomId}`, {
    active: false,
    deactivatedBy: actor.uid,
    deactivatedAt: Date.now()
  });

  return true;
                    }
