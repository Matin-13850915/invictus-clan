
import {
  createRecord,
  readData,
  updateData,
  deleteData
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "privateMessages";
const EDIT_LIMIT = 15 * 60 * 1000;

function requireActiveUser(user) {
  if (!user?.uid || user.active !== true) {
    throw new Error("فقط اعضای فعال اجازه استفاده از پیام خصوصی را دارند.");
  }
}

function validateUid(uid) {
  if (
    typeof uid !== "string" ||
    !uid.trim() ||
    uid.length > 128 ||
    /[.#$/\[\]]/.test(uid)
  ) {
    throw new Error("شناسه کاربر معتبر نیست.");
  }
}

function validateId(id) {
  if (
    typeof id !== "string" ||
    !id.trim() ||
    /[.#$/\[\]]/.test(id)
  ) {
    throw new Error("شناسه پیام معتبر نیست.");
  }
}

function getConversationId(uid1, uid2) {
  validateUid(uid1);
  validateUid(uid2);

  if (uid1 === uid2) {
    throw new Error("گفتگو با خودتان امکان‌پذیر نیست.");
  }

  return [uid1, uid2].sort().join("_");
}

function validateMessage(text) {
  const message = normalizeText(text);

  if (!message || message.length > 2000) {
    throw new Error("پیام باید بین ۱ تا ۲۰۰۰ حرف باشد.");
  }

  return message;
}

async function getAuthorizedConversation(otherUid, user) {
  requireActiveUser(user);

  const conversationId = getConversationId(user.uid, otherUid);
  const path = `${PATH}/conversations/${conversationId}`;
  const conversation = await readData(path);

  if (!conversation?.participants?.[user.uid]) {
    throw new Error("شما عضو این گفتگو نیستید.");
  }

  return { conversationId, conversation };
}

function ensureNotBlocked(conversation, user, otherUid) {
  if (
    conversation?.blocked?.[user.uid] === true ||
    conversation?.blocked?.[otherUid] === true
  ) {
    throw new Error("ارسال پیام در این گفتگو امکان‌پذیر نیست.");
  }
}

export async function sendPrivateMessage(receiverUid, text, sender) {
  requireActiveUser(sender);
  validateUid(receiverUid);

  if (receiverUid === sender.uid) {
    throw new Error("نمی‌توانید برای خودتان پیام بفرستید.");
  }

  const message = validateMessage(text);
  const conversationId = getConversationId(sender.uid, receiverUid);
  const conversationPath = `${PATH}/conversations/${conversationId}`;

  let conversation = await readData(conversationPath);

  if (!conversation) {
    const participants = {
      [sender.uid]: true,
      [receiverUid]: true
    };

    await updateData(conversationPath, {
      participants,
      createdAt: Date.now(),
      lastMessageAt: Date.now()
    });

    conversation = { participants };
  }

  if (
    !conversation.participants?.[sender.uid] ||
    !conversation.participants?.[receiverUid]
  ) {
    throw new Error("اطلاعات اعضای گفتگو معتبر نیست.");
  }

  ensureNotBlocked(conversation, sender, receiverUid);

  const now = Date.now();

  const messageId = await createRecord(
    `${PATH}/messages/${conversationId}`,
    {
      senderUid: sender.uid,
      receiverUid,
      text: message,
      createdAt: now,
      edited: false,
      deleted: false
    }
  );

  await updateData(conversationPath, {
    lastMessageAt: now,
    lastMessagePreview: message.slice(0, 80)
  });

  return messageId;
}

export async function getConversationMessages(otherUid, user) {
  const { conversationId } = await getAuthorizedConversation(otherUid, user);

  const data = await readData(
    `${PATH}/messages/${conversationId}`
  );

  if (!data || typeof data !== "object") return [];

  return Object.entries(data)
    .map(([id, message]) => ({ id, ...message }))
    .filter(message => message && message.deleted !== true)
    .sort(
      (a, b) =>
        (Number(a.createdAt) || 0) -
        (Number(b.createdAt) || 0)
    );
}

export async function editPrivateMessage(
  otherUid,
  messageId,
  newText,
  user
) {
  validateId(messageId);

  const { conversationId } = await getAuthorizedConversation(otherUid, user);
  const path = `${PATH}/messages/${conversationId}/${messageId}`;
  const message = await readData(path);

  if (!message || message.deleted === true) {
    throw new Error("پیام پیدا نشد.");
  }

  if (message.senderUid !== user.uid) {
    throw new Error("فقط فرستنده می‌تواند پیام را ویرایش کند.");
  }

  const createdAt = Number(message.createdAt);

  if (!createdAt || Date.now() - createdAt > EDIT_LIMIT) {
    throw new Error("مهلت ویرایش پیام تمام شده است.");
  }

  await updateData(path, {
    text: validateMessage(newText),
    edited: true,
    editedAt: Date.now()
  });

  return true;
}

export async function deletePrivateMessage(
  otherUid,
  messageId,
  user
) {
  validateId(messageId);

  const { conversationId } = await getAuthorizedConversation(otherUid, user);
  const path = `${PATH}/messages/${conversationId}/${messageId}`;
  const message = await readData(path);

  if (!message || message.deleted === true) {
    throw new Error("پیام پیدا نشد.");
  }

  if (message.senderUid !== user.uid) {
    throw new Error("فقط فرستنده می‌تواند پیام را حذف کند.");
  }

  await updateData(path, {
    deleted: true,
    deletedAt: Date.now(),
    text: ""
  });

  return true;
}

export async function blockConversation(otherUid, user) {
  requireActiveUser(user);
  const conversationId = getConversationId(user.uid, otherUid);
  const path = `${PATH}/conversations/${conversationId}`;
  const conversation = await readData(path);

  if (!conversation?.participants?.[user.uid]) {
    throw new Error("شما عضو این گفتگو نیستید.");
  }

  await updateData(`${path}/blocked`, {
    [user.uid]: true
  });

  return true;
}

export async function unblockConversation(otherUid, user) {
  requireActiveUser(user);
  const conversationId = getConversationId(user.uid, otherUid);
  const path = `${PATH}/conversations/${conversationId}`;
  const conversation = await readData(path);

  if (!conversation?.participants?.[user.uid]) {
    throw new Error("شما عضو این گفتگو نیستید.");
  }

  await deleteData(`${path}/blocked/${user.uid}`);

  return true;
}
  
