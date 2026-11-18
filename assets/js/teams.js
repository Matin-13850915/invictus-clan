import {
  createRecord,
  getRecord,
  getAllRecords,
  updateData,
  deleteData,
  readData
} from "./database.js";

const PATH = "teams";
const TYPES = ["MP", "BR", "BOTH"];

function requireManager(actor) {
  if (
    !actor?.uid ||
    actor.active !== true ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت تیم‌ها را دارند.");
  }
}

function validateId(id) {
  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(id)
  ) {
    throw new Error("شناسه تیم معتبر نیست.");
  }
}

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function validateTeam(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات تیم معتبر نیست.");
  }

  const name = clean(data.name, 60);
  const description = clean(data.description, 300);
  const type = String(data.type || "").toUpperCase();

  if (name.length < 2) {
    throw new Error("نام تیم باید حداقل ۲ حرف باشد.");
  }

  if (!TYPES.includes(type)) {
    throw new Error("نوع تیم باید MP، BR یا BOTH باشد.");
  }

  return { name, description, type };
}

async function ensureActiveMember(uid) {
  if (typeof uid !== "string" || !uid.trim()) {
    throw new Error("عضو انتخاب‌شده معتبر نیست.");
  }

  const [role, profile] = await Promise.all([
    readData(`roles/${uid}`),
    readData(`publicProfiles/${uid}`)
  ]);

  if (
    !role ||
    role.active !== true ||
    ["banned", "suspended"].includes(role.status)
  ) {
    throw new Error("فقط اعضای فعال را می‌توان به تیم اضافه کرد.");
  }

  return {
    uid,
    displayName: profile?.displayName || profile?.gameName || ""
  };
}

export async function getTeams(options = {}, actor = null) {
  const includeInactive = options?.includeInactive === true;

  if (includeInactive) requireManager(actor);

  const teams = await getAllRecords(PATH);

  return teams
    .filter(team => includeInactive || team.active !== false)
    .map(team => ({
      ...team,
      members: team.members && typeof team.members === "object"
        ? team.members
        : {},
      active: team.active !== false
    }))
    .sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "fa")
    );
}

export async function createTeam(data, actor) {
  requireManager(actor);
  const team = validateTeam(data);

  const members = {};
  let captainUid = null;

  if (data.captainUid) {
    const captain = await ensureActiveMember(data.captainUid);
    members[captain.uid] = {
      uid: captain.uid,
      addedAt: Date.now(),
      addedBy: actor.uid
    };
    captainUid = captain.uid;
  }

  return createRecord(PATH, {
    ...team,
    members,
    captainUid,
    active: true,
    createdBy: actor.uid,
    updatedBy: actor.uid
  });
}

export async function updateTeam(teamId, changes, actor) {
  requireManager(actor);
  validateId(teamId);

  const current = await getRecord(`${PATH}/${teamId}`);
  if (!current) throw new Error("تیم پیدا نشد.");

  const next = validateTeam({
    name: changes?.name ?? current.name,
    description: changes?.description ?? current.description,
    type: changes?.type ?? current.type
  });

  await updateData(`${PATH}/${teamId}`, {
    ...next,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });

  return true;
}

export async function addTeamMember(teamId, uid, actor) {
  requireManager(actor);
  validateId(teamId);
  const member = await ensureActiveMember(uid);

  const path = `${PATH}/${teamId}`;
  const team = await getRecord(path);
  if (!team) throw new Error("تیم پیدا نشد.");
  if (team.active === false) throw new Error("تیم غیرفعال است.");

  if (team.members?.[uid]) {
    throw new Error("این عضو از قبل در تیم حضور دارد.");
  }

  await updateData(path, {
    [`members/${uid}`]: {
      uid,
      addedAt: Date.now(),
      addedBy: actor.uid,
      displayName: member.displayName
    },
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });

  return true;
}

export async function removeTeamMember(teamId, uid, actor) {
  requireManager(actor);
  validateId(teamId);

  if (typeof uid !== "string" || !uid.trim()) {
    throw new Error("شناسه عضو معتبر نیست.");
  }

  const path = `${PATH}/${teamId}`;
  const team = await getRecord(path);
  if (!team?.members?.[uid]) throw new Error("این عضو در تیم نیست.");

  const changes = {
    [`members/${uid}`]: null,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  };

  if (team.captainUid === uid) changes.captainUid = null;

  await updateData(path, changes);
  return true;
}

export async function setTeamCaptain(teamId, uid, actor) {
  requireManager(actor);
  validateId(teamId);

  const team = await getRecord(`${PATH}/${teamId}`);
  if (!team) throw new Error("تیم پیدا نشد.");

  if (!team.members?.[uid]) {
    throw new Error("کاپیتان باید ابتدا عضو همین تیم باشد.");
  }

  await updateData(`${PATH}/${teamId}`, {
    captainUid: uid,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });

  return true;
}

export async function deactivateTeam(teamId, actor) {
  requireManager(actor);
  validateId(teamId);
  const team = await getRecord(`${PATH}/${teamId}`);
  if (!team) throw new Error("تیم پیدا نشد.");

  await updateData(`${PATH}/${teamId}`, {
    active: false,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });
  return true;
}

export async function activateTeam(teamId, actor) {
  requireManager(actor);
  validateId(teamId);
  const team = await getRecord(`${PATH}/${teamId}`);
  if (!team) throw new Error("تیم پیدا نشد.");

  await updateData(`${PATH}/${teamId}`, {
    active: true,
    updatedAt: Date.now(),
    updatedBy: actor.uid
  });
  return true;
}

export async function deleteTeam(teamId, actor) {
  if (actor?.role !== "admin" || actor?.active !== true) {
    throw new Error("حذف کامل تیم فقط برای ادمین مجاز است.");
  }

  validateId(teamId);
  const team = await getRecord(`${PATH}/${teamId}`);
  if (!team) throw new Error("تیم پیدا نشد.");

  await deleteData(`${PATH}/${teamId}`);
  return true;
}
