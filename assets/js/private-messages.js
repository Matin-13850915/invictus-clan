
import {
  createRecord,
  readData,
  updateData
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "privateMessages";

function requireActiveUser(user) {
  if (!user?.uid || user.active !== true) {
    throw new Error("فقط اعضای فعال اجازه ارسال پیام خصوصی دارند.");
  }
}

function getConversationId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function validateMessage(text) {
  const message = normalizeText(text);

  if (!message || message.length > 2000) {
    throw new Error("پیام باید بین ۱ تا ۲۰۰۰ حرف باشد.");
  }

  return message;
}

export async function sendPrivateMessage(
  receiverUid,
  text,
  sender
) {
  requireActiveUser(sender);

  if (!receiverUid || receiverUid === sender.uid) {
    throw new Error("گیرنده پیام معتبر نیست.");
  }

  const message = validateMessage(text);
  const conversationId = getConversationId(
    sender.uid,
    receiverUid
  );

  const conversation = await readData(
    `${PATH}/conversations/${conversationId}`
  );

  if (
    conversation?.blocked?.[sender.uid] === true ||
    conversation?.blocked?.[receiverUid] === true
  ) {
    throw new Error("ارسال پیام در این گفتگو امکان‌پذیر نیست.");
  }

  const participants = {
    [sender.uid]: true,
    [receiverUid]: true
  };

  if (!conversation) {
    await updateData(
      `${PATH}/conversations/${conversationId}`,
      {
        participants,
        createdAt: Date.now(),
        lastMessageAt: Date.now()
      }
    );
  }

  const messageId = await createRecord(
    `${PATH}/messages/${conversationId}`,
    {
      senderUid: sender.uid,
      receiverUid,
      text: message,
      createdAt: Date.now(),
      edited: false
    }
  );

  await updateData(
    `${PATH}/conversations/${conversationId}`,
    {
      lastMessageAt: Date.now(),
      lastMessagePreview: message.slice(0, 80)
    }
  );

  return messageId;
}

export async function getConversationMessages(
  otherUid,
  user
) {
  requireActiveUser(user);

  if (!otherUid || otherUid === user.uid) {
    throw new Error("شناسه مخاطب معتبر نیست.");
  }

  const conversationId = getConversationId(
    user.uid,
    otherUid
  );

  const conversation = await readData(
    `${PATH}/conversations/${conversationId}`
  );

  if (!conversation?.participants?.[user.uid]) {
    return [];
  }

  const data = await readData(
    `${PATH}/messages/${conversationId}`
  );

  if (!data) return [];

  return Object.entries(data)
    .map(([id, message]) => ({ id, ...message }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function editPrivateMessage(
  otherUid,
  messageId,
  newText,
  user
) {
  requireActiveUser(user);

  const conversationId = getConversationId(
    user.uid,
    otherUid
  );

  const path =
    `${PATH}/messages/${conversationId}/${messageId}`;

  const message = await readData(path);

  if (!message || message.senderUid !== user.uid) {
    throw new Error("فقط فرستنده می‌تواند پیام را ویرایش کند.");
  }

  if (Date.now() - message.createdAt > 15 * 60 * 1000) {
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
  requireActiveUser(user);

  const conversationId = getConversationId(
    user.uid,
    otherUid
  );

  const path =
    `${PATH}/messages/${conversationId}/${messageId}`;

  const message = await readData(path);

  if (!message || message.senderUid !== user.uid) {
    throw new Error("فقط فرستنده می‌تواند پیام را حذف کند.");
  }

  const { deleteData } = await import("./database.js");

  await deleteData(path);

  return true;
}

export async function blockConversation(
  otherUid,
  user
) {
  requireActiveUser(user);

  if (!otherUid || otherUid === user.uid) {
    throw new Error("شناسه مخاطب معتبر نیست.");
  }

  const conversationId = getConversationId(
    user.uid,
    otherUid
  );

  await updateData(
    `${PATH}/conversations/${conversationId}/blocked`,
    {
      [user.uid]: true
    }
  );

  return true;
}

export async function unblockConversation(
  otherUid,
  user
) {
  requireActiveUser(user);

  const conversationId = getConversationId(
    user.uid,
    otherUid
  );

  const { deleteData } = await import("./database.js");

  await deleteData(
    `${PATH}/conversations/${conversationId}/blocked/${user.uid}`
  );

  return true;
}
