
export const ROLES = Object.freeze({
  ADMIN: "admin",
  LEADER: "leader",
  TESTER: "tester",
  MEMBER: "member"
});

export const TESTER_SPECIALTIES = Object.freeze({
  MP: "MP",
  BR: "BR"
});

function validUser(user) {
  return Boolean(user && typeof user.uid === "string" && user.uid);
}

export function hasRole(user, role) {
  return validUser(user) && user.role === role;
}

export function isAdmin(user) {
  return hasRole(user, ROLES.ADMIN);
}

export function isLeader(user) {
  return hasRole(user, ROLES.LEADER);
}

export function isTester(user) {
  return hasRole(user, ROLES.TESTER);
}

export function isMember(user) {
  return hasRole(user, ROLES.MEMBER);
}

export function isStaff(user) {
  return isAdmin(user) || isLeader(user) || isTester(user);
}

export function isLeaderOrAdmin(user) {
  return isAdmin(user) || isLeader(user);
}

export function hasTesterSpecialty(user, specialty) {
  return (
    isTester(user) &&
    Object.values(TESTER_SPECIALTIES).includes(specialty) &&
    user.specialty === specialty
  );
}

export function canAccessPage(user, page) {
  if (!validUser(user) || !user.active) return false;

  const access = {
    home: ["admin", "leader", "tester", "member"],
    applications: ["admin", "leader", "tester"],
    members: ["admin", "leader", "tester", "member"],
    announcements: ["admin", "leader", "tester", "member"],
    wars: ["admin", "leader", "tester", "member"],
    rankings: ["admin", "leader", "tester", "member"],
    chat: ["admin", "leader", "tester", "member"],
    forum: ["admin", "leader", "tester", "member"],
    messages: ["admin", "leader", "member"],
    teams: ["admin", "leader", "tester", "member"],
    tournaments: ["admin", "leader", "tester", "member"],
    seasons: ["admin", "leader", "tester", "member"],
    rewards: ["admin", "leader", "member"],
    tickets: ["admin", "leader", "tester", "member"],
    archive: ["admin", "leader"],
    statistics: ["admin", "leader"],
    staff: ["admin", "leader", "tester", "member"],
    rules: ["admin", "leader", "tester", "member"],
    settings: ["admin", "leader", "tester", "member"],
    admin: ["admin"]
  };

  return Boolean(access[page]?.includes(user.role));
}

export function canManageWebsite(user) {
  return isAdmin(user);
}

export function canManageMembers(user) {
  return isLeaderOrAdmin(user);
}

export function canManageApplications(user) {
  return isLeaderOrAdmin(user);
}

export function canReviewAssignedApplication(user, application) {
  if (!user || !application) return false;

  if (isLeaderOrAdmin(user)) return true;

  return (
    isTester(user) &&
    application.assignedTesterUid === user.uid &&
    application.assignedSpecialty === user.specialty
  );
}

export function canPublishAnnouncements(user) {
  return isLeaderOrAdmin(user);
}

export function canManageWars(user) {
  return isLeaderOrAdmin(user);
}

export function canManageTeams(user) {
  return isLeaderOrAdmin(user);
}

export function canManageTournaments(user) {
  return isLeaderOrAdmin(user);
}

export function canManageSeasons(user) {
  return isLeaderOrAdmin(user);
}

export function canManageRewards(user) {
  return isLeaderOrAdmin(user);
}

export function canModerateChat(user) {
  return isLeaderOrAdmin(user);
}

export function canViewStaffChat(user) {
  return isLeaderOrAdmin(user);
}

export function canEditSiteContent(user) {
  return isAdmin(user);
}

export function canAssignRoles(user) {
  return isAdmin(user);
}

export function canDeleteAccounts(user) {
  return isAdmin(user);
}

export function canSubmitTestResult(user, application) {
  return canReviewAssignedApplication(user, application);
}

export function canViewAssignedTests(user, application) {
  return canReviewAssignedApplication(user, application);
}

export function canManageOwnProfile(user, targetUid) {
  return validUser(user) && user.uid === targetUid;
}

export function canViewPrivateHistory(user, targetUid) {
  return Boolean(
    validUser(user) &&
    (user.uid === targetUid || isLeaderOrAdmin(user))
  );
}

export function canManagePoints(user) {
  return isLeaderOrAdmin(user);
}

export function canApproveWarApplications(user) {
  return isLeaderOrAdmin(user);
}

export function canManageSupportTickets(user, ticket) {
  if (!validUser(user) || !ticket) return false;

  if (isLeaderOrAdmin(user)) return true;

  if (isTester(user)) {
    return ticket.assignedTesterUid === user.uid;
  }

  return ticket.ownerUid === user.uid;
}

export function canManageAccountRoles(user) {
  return isAdmin(user);
}

export function canManageSiteSettings(user) {
  return isAdmin(user);
    }
