
import {
  createRecord,
  readData,
  updateData
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "rankings";
const HISTORY_PATH = "rankingHistory";

const DEFAULT_RANKING = {
  points: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  manualPoints: 0,
  automaticPoints: 0
};

function requireStaff(actor) {
  if (
    !actor?.uid ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("فقط لیدر و ادمین اجازه تغییر امتیازات را دارند.");
  }
}

function validateUid(uid) {
  if (
    typeof uid !== "string" ||
    !uid.trim() ||
    uid.includes("/") ||
    uid.includes(".") ||
    uid.includes("#") ||
    uid.includes("$") ||
    uid.includes("[") ||
    uid.includes("]")
  ) {
    throw new Error("شناسه عضو معتبر نیست.");
  }

  return uid;
}

function validateSeasonId(seasonId) {
  if (
    typeof seasonId !== "string" ||
    !seasonId.trim() ||
    /[.#$/[\]]/.test(seasonId)
  ) {
    throw new Error("شناسه فصل معتبر نیست.");
  }

  return seasonId;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeRanking(data = {}) {
  const manualPoints = toNumber(data.manualPoints);
  const automaticPoints = toNumber(data.automaticPoints);

  return {
    points: manualPoints + automaticPoints,
    wins: Math.max(0, toNumber(data.wins)),
    losses: Math.max(0, toNumber(data.losses)),
    draws: Math.max(0, toNumber(data.draws)),
    manualPoints,
    automaticPoints,
    displayName: data.displayName || "",
    updatedAt: data.updatedAt || null
  };
}

export async function getRankings(seasonId = "current") {
  validateSeasonId(seasonId);

  const data = await readData(`${PATH}/${seasonId}`);

  if (!data || typeof data !== "object") return [];

  return Object.entries(data)
    .filter(([key, item]) =>
      key !== "settings" &&
      item &&
      typeof item === "object"
    )
    .map(([uid, item]) => ({
      uid,
      ...normalizeRanking(item)
    }))
    .sort((a, b) => {
      const difference = b.points - a.points;

      if (difference !== 0) return difference;

      return a.displayName.localeCompare(b.displayName, "fa");
    })
    .map((item, index) => ({
      ...item,
      position: index + 1
    }));
}

export async function getMemberRanking(uid, seasonId = "current") {
  validateUid(uid);
  validateSeasonId(seasonId);

  const data = await readData(`${PATH}/${seasonId}/${uid}`);

  return normalizeRanking(data || DEFAULT_RANKING);
}

export async function addManualPoints(
  uid,
  amount,
  reason,
  actor,
  seasonId = "current"
) {
  requireStaff(actor);
  validateUid(uid);
  validateSeasonId(seasonId);

  const points = Number(amount);
  const cleanReason = normalizeText(reason);

  if (!Number.isInteger(points) || points === 0) {
    throw new Error("مقدار امتیاز معتبر نیست.");
  }

  if (Math.abs(points) > 10000) {
    throw new Error("مقدار امتیاز بیش از حد مجاز است.");
  }

  if (cleanReason.length < 3 || cleanReason.length > 300) {
    throw new Error("دلیل تغییر امتیاز باید بین ۳ تا ۳۰۰ حرف باشد.");
  }

  const member = await getMemberRanking(uid, seasonId);

  const manualPoints = member.manualPoints + points;
  const totalPoints = manualPoints + member.automaticPoints;
  const now = Date.now();

  await updateData(`${PATH}/${seasonId}/${uid}`, {
    manualPoints,
    points: totalPoints,
    updatedAt: now
  });

  await createRecord(HISTORY_PATH, {
    uid,
    seasonId,
    amount: points,
    reason: cleanReason,
    type: "manual",
    changedBy: actor.uid,
    createdAt: now
  });

  return {
    points: totalPoints,
    manualPoints
  };
}

export async function recordWarPerformance(
  uid,
  result,
  actor,
  seasonId = "current",
  warId = null
) {
  requireStaff(actor);
  validateUid(uid);
  validateSeasonId(seasonId);

  if (!["win", "loss", "draw"].includes(result)) {
    throw new Error("نتیجه عملکرد معتبر نیست.");
  }

  if (warId !== null && (
    typeof warId !== "string" ||
    !warId.trim() ||
    /[.#$/[\]]/.test(warId)
  )) {
    throw new Error("شناسه جنگ معتبر نیست.");
  }

  const member = await getMemberRanking(uid, seasonId);

  const pointsPerResult = {
    win: 10,
    draw: 3,
    loss: 1
  };

  const automaticPoints =
    member.automaticPoints + pointsPerResult[result];

  const stats = {
    wins: member.wins + (result === "win" ? 1 : 0),
    losses: member.losses + (result === "loss" ? 1 : 0),
    draws: member.draws + (result === "draw" ? 1 : 0)
  };

  const totalPoints = automaticPoints + member.manualPoints;
  const now = Date.now();

  await updateData(`${PATH}/${seasonId}/${uid}`, {
    ...stats,
    automaticPoints,
    manualPoints: member.manualPoints,
    points: totalPoints,
    updatedAt: now
  });

  await createRecord(HISTORY_PATH, {
    uid,
    seasonId,
    warId,
    result,
    points: pointsPerResult[result],
    type: "war",
    changedBy: actor.uid,
    createdAt: now
  });

  return {
    ...stats,
    automaticPoints,
    manualPoints: member.manualPoints,
    points: totalPoints
  };
}

export async function getRankingHistory(uid) {
  validateUid(uid);

  const data = await readData(HISTORY_PATH);

  if (!data || typeof data !== "object") return [];

  return Object.entries(data)
    .filter(([, item]) => item && item.uid === uid)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getAllRankingHistory(actor) {
  requireStaff(actor);

  const data = await readData(HISTORY_PATH);

  if (!data || typeof data !== "object") return [];

  return Object.entries(data)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    
