
import {
  createRecord,
  readData,
  updateData,
  findByField
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "tickets";
const ROLES_PATH = "roles";

const CATEGORIES = [
  "account",
  "application",
  "test",
  "war",
  "chat",
  "other"
];

const STAFF_ROLES = ["admin", "leader"];

function requireActiveUser(user) {
  if (!user?.uid || user.active !== true) {
    throw new Error("فقط اعضای فعال اجازه انجام این عملیات را دارند.");
  }
}

function requireStaff(user) {
  requireActiveUser(user);

  if (!["admin", "leader", "tester"].includes(user.role)) {
    throw new Error("دسترسی به این بخش مجاز نیست.");
  }
}

function requireManager(user) {
  requireActiveUser(user);

  if (!STAFF_ROLES.includes(user.role)) {
    throw new Error("فقط لیدر و ادمین اجازه این عملیات را دارند.");
  }
}

function validateId(value, label = "شناسه") {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(value)
  ) {
    throw new Error(`${label} معتبر نیست.`);
  }

  return value;
}

function validateTicket(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات تیکت معتبر نیست.");
  }

  const title = normalizeText(data.title || "");
  const body = normalizeText(data.body || "");
  const category = data.category;

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

async function getTicketOrThrow(ticketId) {
  const id = validateId(ticketId, "شناسه تیکت");
  const ticket = await readData(`${PATH}/${id}`);

  if (!ticket || typeof ticket !== "object") {
    throw new Error("تیکت پیدا نشد.");
  }

  return { id, ...ticket };
}

function canAccessTicket(ticket, user) {
  if (ticket.ownerUid === user.uid) return true;

  if (STAFF_ROLES.includes(user.role)) return true;

  return (
    user.role === "tester" &&
    ticket.category === "test" &&
    ticket.assignedTesterUid === user.uid
  );
}

function requireTicketAccess(ticket, user) {
  requireActiveUser(user);

  if (!canAccessTicket(ticket, user)) {
    throw new Error("شما اجازه دسترسی به این تیکت را ندارید.");
  }
}

function sortTickets(tickets) {
  return tickets.sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
  );
}

export async function createTicket(data, user) {
  requireActiveUser(user);

  const ticket = validateTicket(data);
  const now = Date.now();

  return await createRecord(PATH, {
    ...ticket,
    ownerUid: user.uid,
    status: "open",
    assignedTesterUid: null,
    createdAt: now,
    updatedAt: now
  });
}

export async function getMyTickets(user) {
  requireActiveUser(user);

  const tickets = await findByField(PATH, "ownerUid", user.uid);
  return sortTickets(tickets);
}

export async function getAllTickets(user) {
  requireStaff(user);

  const tickets = user.role === "tester"
    ? await findByField(PATH, "assignedTesterUid", user.uid)
    : await (async () => {
        const data = await readData(PATH);
        if (!data || typeof data !== "object") return [];
        return Object.entries(data)
          .filter(([, ticket]) => ticket && typeof ticket === "object")
          .map(([id, ticket]) => ({ ...ticket, id }));
      })();

  return sortTickets(
    user.role === "tester"
      ? tickets.filter(ticket => ticket.category === "test")
      : tickets
  );
}

export async function getTicket(ticketId, user) {
  requireActiveUser(user);

  const ticket = await getTicketOrThrow(ticketId);
  requireTicketAccess(ticket, user);

  return ticket;
}

export async function replyToTicket(ticketId, message, user) {
  requireActiveUser(user);

  const ticket = await getTicketOrThrow(ticketId);
  requireTicketAccess(ticket, user);

  const text = normalizeText(message || "");

  if (text.length < 1 || text.length > 2000) {
    throw new Error("پاسخ باید بین ۱ تا ۲۰۰۰ حرف باشد.");
  }

  if (ticket.status === "closed") {
    throw new Error("این تیکت بسته شده است.");
  }

  const replyId = await createRecord(
    `${PATH}/${ticket.id}/replies`,
    {
      uid: user.uid,
      displayName: normalizeText(user.displayName || "کاربر"),
      role: user.role,
      message: text,
      createdAt: Date.now()
    }
  );

  await updateData(`${PATH}/${ticket.id}`, {
    updatedAt: Date.now(),
    lastReplyBy: user.uid
  });

  return replyId;
}

export async function getTicketReplies(ticketId, user) {
  requireActiveUser(user);

  const ticket = await getTicketOrThrow(ticketId);
  requireTicketAccess(ticket, user);

  const data = await readData(
    `${PATH}/${ticket.id}/replies`
  );

  if (!data || typeof data !== "object") return [];

  return Object.entries(data)
    .filter(([, reply]) => reply && typeof reply === "object")
    .map(([id, reply]) => ({ ...reply, id }))
    .sort(
      (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
    );
}

export async function assignTicketToTester(
  ticketId,
  testerUid,
  actor
) {
  requireManager(actor);

  const id = validateId(ticketId, "شناسه تیکت");
  const uid = validateId(testerUid, "شناسه تستر");

  const ticket = await getTicketOrThrow(id);

  if (ticket.category !== "test") {
    throw new Error("فقط تیکت‌های مربوط به تست قابل تخصیص هستند.");
  }

  if (ticket.status === "closed") {
    throw new Error("تیکت بسته‌شده قابل تخصیص نیست.");
  }

  const tester = await readData(`${ROLES_PATH}/${uid}`);

  if (
    !tester ||
    tester.role !== "tester" ||
    tester.active !== true ||
    !["MP", "BR"].includes(tester.specialty)
  ) {
    throw new Error("تستر فعال و معتبر پیدا نشد.");
  }

  if (
    ticket.specialty &&
    ticket.specialty !== tester.specialty
  ) {
    throw new Error("تخصص تستر با موضوع تیکت مطابقت ندارد.");
  }

  await updateData(`${PATH}/${id}`, {
    assignedTesterUid: uid,
    assignedBy: actor.uid,
    assignedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

export async function unassignTicketTester(ticketId, actor) {
  requireManager(actor);

  const id = validateId(ticketId, "شناسه تیکت");
  const ticket = await getTicketOrThrow(id);

  if (ticket.category !== "test") {
    throw new Error("این تیکت مربوط به تست نیست.");
  }

  await updateData(`${PATH}/${id}`, {
    assignedTesterUid: null,
    unassignedBy: actor.uid,
    unassignedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

export async function closeTicket(ticketId, actor) {
  requireManager(actor);

  const id = validateId(ticketId, "شناسه تیکت");
  const ticket = await getTicketOrThrow(id);

  if (ticket.status === "closed") {
    throw new Error("این تیکت قبلاً بسته شده است.");
  }

  await updateData(`${PATH}/${id}`, {
    status: "closed",
    closedBy: actor.uid,
    closedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

export async function reopenTicket(ticketId, actor) {
  requireManager(actor);

  const id = validateId(ticketId, "شناسه تیکت");
  const ticket = await getTicketOrThrow(id);

  if (ticket.status !== "closed") {
    throw new Error("این تیکت بسته نیست.");
  }

  await updateData(`${PATH}/${id}`, {
    status: "open",
    reopenedBy: actor.uid,
    reopenedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
      }
                      
