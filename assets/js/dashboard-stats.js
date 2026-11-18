
import { getAllRecords } from "./database.js";

function requireStaff(actor) {
  if (
    !actor?.uid ||
    actor.active !== true ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("دسترسی به آمار مدیریتی ندارید.");
  }
}

function countBy(items, field, value) {
  return items.filter(item => item?.[field] === value).length;
}

function countWhere(items, predicate) {
  return items.filter(predicate).length;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
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
    teams,
    seasons,
    badges,
    messages
  ] = await Promise.all([
    getAllRecords("users"),
    getAllRecords("applications"),
    getAllRecords("wars"),
    getAllRecords("announcements"),
    getAllRecords("tournaments"),
    getAllRecords("tickets"),
    getAllRecords("rewards"),
    getAllRecords("teams"),
    getAllRecords("seasons"),
    getAllRecords("badges"),
    getAllRecords("chats/messages")
  ]);

  const userList = safeArray(users);
  const applicationList = safeArray(applications);
  const warList = safeArray(wars);
  const announcementList = safeArray(announcements);
  const tournamentList = safeArray(tournaments);
  const ticketList = safeArray(tickets);
  const rewardList = safeArray(rewards);
  const teamList = safeArray(teams);
  const seasonList = safeArray(seasons);
  const badgeList = safeArray(badges);
  const messageList = safeArray(messages);

  const activeUsers = userList.filter(
    user => user?.active === true
  );

  const applicationStatuses = [
    "pending",
    "awaiting_tester",
    "awaiting_test",
    "testing",
    "test_completed",
    "awaiting_leader",
    "retest_requested",
    "accepted",
    "rejected",
    "withdrawn",
    "expired"
  ];

  const applicationCounts = Object.fromEntries(
    applicationStatuses.map(status => [
      status,
      countBy(applicationList, "status", status)
    ])
  );

  const completedWars = warList.filter(
    war => war?.status === "completed"
  );

  const wins = countBy(completedWars, "result", "win");
  const losses = countBy(completedWars, "result", "loss");
  const draws = countBy(completedWars, "result", "draw");

  const openTicketStatuses = [
    "open",
    "in_progress",
    "waiting_for_user"
  ];

  const openTickets = countWhere(
    ticketList,
    ticket => openTicketStatuses.includes(ticket?.status)
  );

  return {
    members: {
      total: userList.length,
      active: activeUsers.length,
      inactive: userList.length - activeUsers.length
    },

    applications: {
      total: applicationList.length,
      pending: applicationCounts.pending,
      accepted: applicationCounts.accepted,
      rejected: applicationCounts.rejected,
      statuses: applicationCounts
    },

    wars: {
      total: warList.length,
      upcoming: countBy(warList, "status", "upcoming"),
      completed: completedWars.length,
      wins,
      losses,
      draws
    },

    announcements: {
      total: announcementList.length,
      active: countWhere(
        announcementList,
        item => item?.archived !== true &&
          item?.active !== false
      ),
      archived: countBy(announcementList, "archived", true)
    },

    tournaments: {
      total: tournamentList.length,
      active: countWhere(
        tournamentList,
        item => ["open", "in_progress"].includes(item?.status)
      ),
      completed: countBy(tournamentList, "status", "completed")
    },

    tickets: {
      total: ticketList.length,
      open: openTickets,
      resolved: countBy(ticketList, "status", "resolved"),
      closed: countBy(ticketList, "status", "closed")
    },

    rewards: {
      total: rewardList.length,
      active: countBy(rewardList, "active", true),
      inactive: countBy(rewardList, "active", false)
    },

    teams: {
      total: teamList.length,
      active: countWhere(
        teamList,
        item => item?.active !== false
      )
    },

    seasons: {
      total: seasonList.length,
      active: countWhere(
        seasonList,
        item => ["active", "in_progress"].includes(item?.status)
      )
    },

    badges: {
      total: badgeList.length,
      active: countWhere(
        badgeList,
        item => item?.active !== false
      )
    },

    chat: {
      roomsWithMessages: messageList.length,
      messages: messageList.reduce(
        (total, room) => total +
          (room && typeof room === "object"
            ? Object.keys(room).length
            : 0),
        0
      )
    },

    generatedAt: Date.now()
  };
}
  
