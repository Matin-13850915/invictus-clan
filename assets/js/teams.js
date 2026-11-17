import {
  createRecord,
  readData,
  updateData,
  deleteData
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "teams";

function requireStaff(actor) {
  if (
    !actor?.uid ||
    actor.active !== true ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("فقط لیدر و ادمین فعال اجازه مدیریت تیم‌ها را دارند.");
  }
}

function requireAdmin(actor) {
  if (
    !actor?.uid ||
    actor.active !== true ||
    actor.role !== "admin"
  ) {
    throw new Error("این عملیات فقط برای ادمین فعال مجاز است.");
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

function validateTeam(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات تیم معتبر نیست.");
  }

  const name = normalizeText(String(data.name || "")).trim();
  const description = normalizeText(
    String(data.description || "")
  ).trim();

  const type = String(data.type || "").trim().toUpperCase();

  if (name.length < 2 || name.length > 40) {
    throw new Error("نام تیم باید بین ۲ تا ۴۰ حرف باشد.");
  }

  if (description.length > 300) {
    throw new Error("توضیحات تیم حداکثر ۳۰۰ حرف است.");
  }

  if (!["MP", "BR", "BOTH"].includes(type)) {
    throw new Error("نوع تیم معتبر نیست.");
  }

  return { name, description, type };
}

function validateMemberUid(uid) {
  return validateId(uid, "شناسه عضو");
}

export async function createTeam(data, actor) {
  requireStaff(actor);

  const team = validateTeam(data);

  const captainUid = data.captainUid
    ? validateMemberUid(data.captainUid)
    : null;

  const members = {};

  if (captainUid) {
    members[captainUid] = {
      joinedAt: Date.now(),
      addedBy: actor.uid
    };
  }

  return createRecord(PATH, {
    ...team,
    captainUid,
    members,
    active: true,
    createdBy: actor.uid,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

export async function getTeams(options = {}, actor = null) {
  const includeInactive = options.includeInactive === true;

  if (includeInactive) {
    requireStaff(actor);
  }

  const data = await readData(PATH);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  return Object.entries(data)
    .filter(([, team]) =>
      team &&
      typeof team === "object" &&
      !Array.isArray(team) &&
      !team.deletedAt
    )
    .map(([id, team]) => ({ ...team, id }))
    .filter(team => {
      if (!includeInactive && team.active !== true) {
        return false;
      }

      if (options.type && team.type !== options.type) {
        return false;
      }

      return true;
    })
    .sort((a, b) =>
      String(a.name || "").localeCompare(
        String(b.name || ""),
        "fa"
      )
    );
}

export async function getTeam(teamId) {
  const id = validateId(teamId, "شناسه تیم");
  const team = await readData(`${PATH}/${id}`);

  if (!team || team.active !== true || team.deletedAt) {
    return null;
  }

  return { ...team, id };
}

export async function updateTeam(teamId, data, actor) {
  requireStaff(actor);

  const id = validateId(teamId, "شناسه تیم");
  const teamData = validateTeam(data);

  const existing = await readData(`${PATH}/${id}`);

  if (!existing || existing.deletedAt) {
    throw new Error("تیم موردنظر پیدا نشد.");
  }

  await updateData(`${PATH}/${id}`, {
    ...teamData,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function addTeamMember(teamId, memberUid, actor) {
  requireStaff(actor);

  const id = validateId(teamId, "شناسه تیم");
  const uid = validateMemberUid(memberUid);

  const team = await readData(`${PATH}/${id}`);

  if (!team || team.active !== true || team.deletedAt) {
    throw new Error("تیم فعال پیدا نشد.");
  }

  if (team.members?.[uid]) {
    throw new Error("این عضو از قبل در تیم حضور دارد.");
  }

  await updateData(`${PATH}/${id}/members`, {
    [uid]: {
      joinedAt: Date.now(),
      addedBy: actor.uid
    }
  });

  return true;
}

export async function removeTeamMember(teamId, memberUid, actor) {
  requireStaff(actor);

  const id = validateId(teamId, "شناسه تیم");
  const uid = validateMemberUid(memberUid);

  const team = await readData(`${PATH}/${id}`);

  if (!team || !team.members?.[uid]) {
    throw new Error("این عضو در تیم وجود ندارد.");
  }

  if (team.captainUid === uid) {
    throw new Error("ابتدا کاپیتان جدیدی انتخاب کنید.");
  }

  await deleteData(`${PATH}/${id}/members/${uid}`);

  return true;
}

export async function setTeamCaptain(teamId, captainUid, actor) {
  requireStaff(actor);

  const id = validateId(teamId, "شناسه تیم");
  const uid = validateMemberUid(captainUid);

  const team = await readData(`${PATH}/${id}`);

  if (!team || team.active !== true || team.deletedAt) {
    throw new Error("تیم فعال پیدا نشد.");
  }

  if (!team.members?.[uid]) {
    throw new Error("کاپیتان باید عضو همین تیم باشد.");
  }

  await updateData(`${PATH}/${id}`, {
    captainUid: uid,
    captainUpdatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function deactivateTeam(teamId, actor) {
  requireStaff(actor);

  const id = validateId(teamId, "شناسه تیم");
  const team = await readData(`${PATH}/${id}`);

  if (!team || team.deletedAt) {
    throw new Error("تیم موردنظر پیدا نشد.");
  }

  await updateData(`${PATH}/${id}`, {
    active: false,
    deactivatedBy: actor.uid,
    deactivatedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

export async function activateTeam(teamId, actor) {
  requireStaff(actor);

  const id = validateId(teamId, "شناسه تیم");
  const team = await readData(`${PATH}/${id}`);

  if (!team || team.deletedAt) {
    throw new Error("تیم موردنظر پیدا نشد یا حذف شده است.");
  }

  await updateData(`${PATH}/${id}`, {
    active: true,
    activatedBy: actor.uid,
    activatedAt: Date.now(),
    updatedAt: Date.now()
  });

  return true;
}

export async function deleteTeam(teamId, actor) {
  requireAdmin(actor);

  const id = validateId(teamId, "شناسه تیم");
  const team = await readData(`${PATH}/${id}`);

  if (!team) {
    throw new Error("تیم موردنظر پیدا نشد.");
  }

  await deleteData(`${PATH}/${id}`);

  return true;
}
