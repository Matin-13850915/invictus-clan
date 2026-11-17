
import {
  createRecord,
  readData,
  updateData
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "tickets";

const CATEGORIES = [
  "account",
  "application",
  "test",
  "war",
  "chat",
  "other"
];

function requireActiveUser(user) {
  if (!user?.uid || user.active !== true) {
    throw new Error("فقط اعضای فعال اجازه ثبت تیکت دارند.");
  }
}

function requireStaff(user) {
  if (
    !user?.uid ||
    !["admin", "leader", "tester"].includes(user.role)
  ) {
    throw new Error("دسترسی به این بخش مجاز نیست.");
  }
}

function validateTicket(data) {
  const title = normalizeText(data?.title);
  const body = normalizeText(data?.body);
  const category = data?.category;

  if (title.length < 3 || title.length > 100) {
    throw new Error("عنوان تیکت باید بین ۳ تا ۱۰۰ حرف باشد.");
  }

  if (body.length < 10 || body.length > 3000) {
    throw new Error("متن تیکت باید بین ۱۰ تا ۳۰۰۰ حرف باشد.");
  }

  if (!CATEGORIES.includes(category)) {
    throw new Error("دسته‌بندی تیکت معتبر نیست.");
  }

  return { title, body, category };
}

export async function createTicket(data, user) {
  requireActiveUser(user);

  const ticket = validateTicket(data);

  return await createRecord(PATH, {
    ...ticket,
    ownerUid: user.uid,
    status: "open",
    assignedTesterUid: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

export async function getMyTickets(user) {
  requireActiveUser(user);

  const data = await readData(PATH);

  if (!data) return [];

  return Object.entries(data)
    .filter(([, ticket]) => ticket.ownerUid === user.uid)
    .map(([id, ticket]) => ({ id, ...ticket }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAllTickets(user) {
  requireStaff(user);

  const data = await readData(PATH);

  if (!data) return [];

  return Object.entries(data)
    .map(([id, ticket]) => ({ id, ...ticket }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function replyToTicket(
  ticketId,
  message,
  user
) {
  requireActiveUser(user);

  if (!ticketId) {
    throw new Error("شناسه تیکت معتبر نیست.");
  }

  const text = normalizeText(message);

  if (text.length < 1 || text.length > 2000) {
    throw new Error("پاسخ باید بین ۱ تا ۲۰۰۰ حرف باشد.");
  }

  const ticket = await readData(`${PATH}/${ticketId}`);

  if (!ticket) {
    throw new Error("تیکت پیدا نشد.");
  }

  const isOwner = ticket.ownerUid === user.uid;

  const isStaffMember =
    ["admin", "leader"].includes(user.role);

  const isAssignedTester =
    user.role === "tester" &&
    ticket.assignedTesterUid === user.uid &&
    ticket.category === "test";

  if (!isOwner && !isStaffMember && !isAssignedTester) {
    throw new Error("شما اجازه پاسخ به این تیکت را ندارید.");
  }

  if (ticket.status === "closed") {
    throw new Error("این تیکت بسته شده است.");
  }

  return await createRecord(
    `${PATH}/${ticketId}/replies`,
    {
      uid: user.uid,
      displayName: normalizeText(user.displayName || "کاربر"),
      role: user.role,
      message: text,
      createdAt: Date.now()
    }
  );
}

export async function getTicketReplies(ticketId, user) {
  requireActiveUser(user);

  const ticket = await readData(`${PATH}/${ticketId}`);

  if (!ticket) {
    throw new Error("تیکت پیدا نشد.");
  }

  const isOwner = ticket.ownerUid === user.uid;
  const isStaffMember =
    ["admin", "leader"].includes(user.role);

  const isAssignedTester =
    user.role === "tester" &&
    ticket.assignedTesterUid === user.uid &&
    ticket.category === "test";

  if (!isOwner && !isStaffMember && !isAssignedTester) {
    throw new Error("دسترسی به پیام‌های این تیکت مجاز نیست.");
  }

  const data = await readData(`${PATH}/${ticketId}/replies`);

  if (!data) return [];

  return Object.entries(data)
    .map(([id, reply]) => ({ id, ...reply }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function assignTicketToTester(
  ticketId,
  testerUid,
  actor
) {
  if (!actor?.uid || !["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه تخصیص تیکت را دارند.");
  }

  if (!ticketId || !testerUid) {
    throw new Error("اطلاعات تخصیص معتبر نیست.");
  }

  const ticket = await readData(`${PATH}/${ticketId}`);

  if (!ticket || ticket.category !== "test") {
    throw new Error("فقط تیکت‌های مربوط به تست قابل تخصیص هستند.");
  }

  await updateData(`${PATH}/${ticketId}`, {
    assignedTesterUid: testerUid,
    assignedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function closeTicket(ticketId, actor) {
  if (
    !actor?.uid ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("فقط لیدر و ادمین اجازه بستن تیکت را دارند.");
  }

  if (!ticketId) {
    throw new Error("شناسه تیکت معتبر نیست.");
  }

  await updateData(`${PATH}/${ticketId}`, {
    status: "closed",
    closedBy: actor.uid,
    closedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}
