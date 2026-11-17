
import {
  getAllRecords
} from "./database.js";

function requireStaff(actor) {
  if (
    !actor?.uid ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("دسترسی به آمار مدیریتی ندارید.");
  }
}

function countBy(items, field, value) {
  return items.filter(item => item?.[field] === value).length;
}

export async function getDashboardStats(actor) {
  requireStaff(actor);

  const [
    users,
    applications,
    wars,
    announcements,
    tournaments,
    tickets,
    rewards,
    teams
  ] = await Promise.all([
    getAllRecords("users"),
    getAllRecords("applications"),
    getAllRecords("wars"),
    getAllRecords("announcements"),
    getAllRecords("tournaments"),
    getAllRecords("tickets"),
    getAllRecords("rewards"),
    getAllRecords("teams")
  ]);

  const activeUsers = users.filter(
    user => user.active === true
  );

  return {
    members: {
      total: users.length,
      active: activeUsers.length,
      inactive: users.length - activeUsers.length
    },

    applications: {
      total: applications.length,
      pending: countBy(applications, "status", "pending"),
      accepted: countBy(applications, "status", "accepted"),
      rejected: countBy(applications, "status", "rejected")
    },

    wars: {
      total: wars.length,
      upcoming: countBy(wars, "status", "upcoming"),
      completed: countBy(wars, "status", "completed")
    },

    announcements: {
      total: announcements.length,
      active: announcements.filter(
        item => item.archived !== true
      ).length
    },

    tournaments: {
      total: tournaments.length,
      active: tournaments.filter(
        item => ["open", "in_progress"].includes(item.status)
      ).length
    },

    tickets: {
      total: tickets.length,
      open: countBy(tickets, "status", "open")
    },

    rewards: {
      total: rewards.length,
      active: rewards.filter(
        item => item.active === true
      ).length
    },

    teams: {
      total: teams.length,
      active: teams.filter(
        item => item.active !== false
      ).length
    },

    generatedAt: Date.now()
  };
                        }
