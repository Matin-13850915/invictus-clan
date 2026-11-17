
import {
  createRecord,
  readData,
  updateData
} from "./database.js";

import { normalizeText } from "./utils.js";

const PATH = "rankings";

function requireStaff(actor) {
  if (
    !actor?.uid ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("فقط لیدر و ادمین اجازه تغییر امتیازات را دارند.");
  }
}

export async function getRankings(seasonId = "current") {
  const data = await readData(`${PATH}/${seasonId}`);

  if (!data) return [];

  return Object.entries(data)
    .filter(([key]) => key !== "settings")
    .map(([uid, item]) => ({
      uid,
      ...item
    }))
    .sort((a, b) => {
      const pointsDifference =
        (Number(b.points) || 0) - (Number(a.points) || 0);

      if (pointsDifference !== 0) return pointsDifference;

      return (a.displayName || "").localeCompare(
        b.displayName || "",
        "fa"
      );
    })
    .map((item, index) => ({
      ...item,
      position: index + 1
    }));
}

export async function getMemberRanking(uid, seasonId = "current") {
  if (!uid) {
    throw new Error("شناسه عضو معتبر نیست.");
  }

  const data = await readData(`${PATH}/${seasonId}/${uid}`);

  return data || {
    points: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    manualPoints: 0,
    automaticPoints: 0
  };
}

export async function addManualPoints(
  uid,
  amount,
  reason,
  actor,
  seasonId = "current"
) {
  requireStaff(actor);

  const points = Number(amount);
  const cleanReason = normalizeText(reason);

  if (!uid || !Number.isInteger(points) || points === 0) {
    throw new Error("مقدار امتیاز معتبر نیست.");
  }

  if (Math.abs(points) > 10000) {
    throw new Error("مقدار امتیاز بیش از حد مجاز است.");
  }

  if (cleanReason.length < 3 || cleanReason.length > 300) {
    throw new Error("دلیل تغییر امتیاز باید بین ۳ تا ۳۰۰ حرف باشد.");
  }

  const member = await getMemberRanking(uid, seasonId);

  const newManualPoints =
    (Number(member.manualPoints) || 0) + points;

  const newTotal =
    (Number(member.automaticPoints) || 0) + newManualPoints;

  await updateData(`${PATH}/${seasonId}/${uid}`, {
    manualPoints: newManualPoints,
    points: newTotal,
    updatedAt: Date.now()
  });

  await createRecord("rankingHistory", {
    uid,
    seasonId,
    amount: points,
    reason: cleanReason,
    type: "manual",
    changedBy: actor.uid,
    createdAt: Date.now()
  });

  return {
    points: newTotal,
    manualPoints: newManualPoints
  };
}

export async function recordWarPerformance(
  uid,
  result,
  actor,
  seasonId = "current"
) {
  requireStaff(actor);

  const allowedResults = ["win", "loss", "draw"];

  if (!uid || !allowedResults.includes(result)) {
    throw new Error("نتیجه عملکرد معتبر نیست.");
  }

  const member = await getMemberRanking(uid, seasonId);

  const pointsPerResult = {
    win: 10,
    draw: 3,
    loss: 1
  };

  const automaticPoints =
    (Number(member.automaticPoints) || 0) +
    pointsPerResult[result];

  const manualPoints = Number(member.manualPoints) || 0;

  const stats = {
    wins: Number(member.wins) || 0,
    losses: Number(member.losses) || 0,
    draws: Number(member.draws) || 0
  };

  if (result === "win") stats.wins++;
  if (result === "loss") stats.losses++;
  if (result === "draw") stats.draws++;

  const totalPoints = automaticPoints + manualPoints;

  await updateData(`${PATH}/${seasonId}/${uid}`, {
    ...stats,
    automaticPoints,
    manualPoints,
    points: totalPoints,
    updatedAt: Date.now()
  });

  await createRecord("rankingHistory", {
    uid,
    seasonId,
    result,
    points: pointsPerResult[result],
    type: "war",
    changedBy: actor.uid,
    createdAt: Date.now()
  });

  return {
    ...stats,
    automaticPoints,
    manualPoints,
    points: totalPoints
  };
}

export async function getRankingHistory(uid) {
  if (!uid) {
    throw new Error("شناسه عضو معتبر نیست.");
  }

  const data = await readData("rankingHistory");

  if (!data) return [];

  return Object.entries(data)
    .filter(([, item]) => item.uid === uid)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => b.createdAt - a.createdAt);
    }
      
