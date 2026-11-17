
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
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت تیم‌ها را دارند.");
  }
}

function validateTeam(data) {
  const name = normalizeText(data?.name);
  const description = normalizeText(data?.description || "");
  const type = data?.type;

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

export async function createTeam(data, actor) {
  requireStaff(actor);

  const team = validateTeam(data);

  return await createRecord(PATH, {
    ...team,
    captainUid: data.captainUid || null,
    members: {},
    active: true,
    createdBy: actor.uid,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

export async function getTeams(options = {}) {
  const data = await readData(PATH);

  if (!data) return [];

  return Object.entries(data)
    .map(([id, team]) => ({ id, ...team }))
    .filter(team => {
      if (!options.includeInactive && team.active === false) {
        return false;
      }

      if (options.type && team.type !== options.type) {
        return false;
      }

      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fa"));
}

export async function updateTeam(teamId, data, actor) {
  requireStaff(actor);

  if (!teamId) {
    throw new Error("شناسه تیم معتبر نیست.");
  }

  const team = validateTeam(data);

  await updateData(`${PATH}/${teamId}`, {
    ...team,
    updatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function addTeamMember(teamId, memberUid, actor) {
  requireStaff(actor);

  if (!teamId || !memberUid) {
    throw new Error("اطلاعات عضو معتبر نیست.");
  }

  await updateData(`${PATH}/${teamId}/members`, {
    [memberUid]: {
      joinedAt: Date.now(),
      addedBy: actor.uid
    }
  });

  return true;
}

export async function removeTeamMember(teamId, memberUid, actor) {
  requireStaff(actor);

  if (!teamId || !memberUid) {
    throw new Error("اطلاعات عضو معتبر نیست.");
  }

  const team = await readData(`${PATH}/${teamId}`);

  if (!team?.members?.[memberUid]) {
    throw new Error("این عضو در تیم وجود ندارد.");
  }

  const { deleteData } = await import("./database.js");

  await deleteData(`${PATH}/${teamId}/members/${memberUid}`);

  return true;
}

export async function setTeamCaptain(teamId, captainUid, actor) {
  requireStaff(actor);

  if (!teamId || !captainUid) {
    throw new Error("اطلاعات کاپیتان معتبر نیست.");
  }

  const team = await readData(`${PATH}/${teamId}`);

  if (!team?.members?.[captainUid]) {
    throw new Error("کاپیتان باید عضو همین تیم باشد.");
  }

  await updateData(`${PATH}/${teamId}`, {
    captainUid,
    captainUpdatedBy: actor.uid,
    updatedAt: Date.now()
  });

  return true;
}

export async function deactivateTeam(teamId, actor) {
  requireStaff(actor);

  if (!teamId) {
    throw new Error("شناسه تیم معتبر نیست.");
  }

  await updateData(`${PATH}/${teamId}`, {
    active: false,
    deactivatedBy: actor.uid,
    deactivatedAt: Date.now()
  });

  return true;
}

export async function deleteTeam(teamId, actor) {
  requireStaff(actor);

  if (!teamId) {
    throw new Error("شناسه تیم معتبر نیست.");
  }

  await deleteData(`${PATH}/${teamId}`);

  return true;
}
