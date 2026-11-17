
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

const ALL_ROLES = Object.freeze([
  ROLES.ADMIN,
  ROLES.LEADER,
  ROLES.TESTER,
  ROLES.MEMBER
]);

const MANAGEMENT_ROLES = Object.freeze([
  ROLES.ADMIN,
  ROLES.LEADER
]);

function validUser(user) {
  return Boolean(
    user &&
    typeof user.uid === "string" &&
    user.uid.trim() &&
    ALL_ROLES.includes(user.role)
  );
}

function isActiveUser(user) {
  return (
    validUser(user) &&
    user.active === true &&
    user.status !== "banned" &&
    user.status !== "suspended"
  );
}

export function hasRole(user, role) {
  return isActiveUser(user) && user.role === role;
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
  return (
    isAdmin(user) ||
    isLeader(user) ||
    isTester(user)
  );
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
  if (!isActiveUser(user)) return false;

  const access = {
    home: ALL_ROLES,
    applications: [
      ROLES.ADMIN,
      ROLES.LEADER,
      ROLES.TESTER
    ],
    members: ALL_ROLES,
    announcements: ALL_ROLES,
    wars: ALL_ROLES,
    rankings: ALL_ROLES,
    chat: ALL_ROLES,
    forum: ALL_ROLES,
    messages: ALL_ROLES,
    teams: ALL_ROLES,
    tournaments: ALL_ROLES,
    seasons: ALL_ROLES,
    rewards: ALL_ROLES,
    tickets: ALL_ROLES,
    archive: MANAGEMENT_ROLES,
    statistics: MANAGEMENT_ROLES,
    audit: MANAGEMENT_ROLES,
    staff: MANAGEMENT_ROLES,
    activity: ALL_ROLES,
    rules: ALL_ROLES,
    settings: ALL_ROLES,
    profile: ALL_ROLES,
    notifications: ALL_ROLES,
    support: ALL_ROLES,
    admin: [ROLES.ADMIN]
  };

  const allowedRoles = access[page];

  return Boolean(
    allowedRoles &&
    allowedRoles.includes(user.role)
  );
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
  if (!isActiveUser(user) || !application) {
    return false;
  }

  if (isLeaderOrAdmin(user)) {
    return true;
  }

  return (
    isTester(user) &&
    application.assignedTesterUid === user.uid &&
    application.assignedSpecialty === user.specialty &&
    hasTesterSpecialty(user, user.specialty)
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
  return (
    isActiveUser(user) &&
    typeof targetUid === "string" &&
    user.uid === targetUid
  );
}

export function canViewPrivateHistory(user, targetUid) {
  return (
    isActiveUser(user) &&
    typeof targetUid === "string" &&
    (
      user.uid === targetUid ||
      isLeaderOrAdmin(user)
    )
  );
}

export function canManagePoints(user) {
  return isLeaderOrAdmin(user);
}

export function canApproveWarApplications(user) {
  return isLeaderOrAdmin(user);
}

export function canManageSupportTickets(user, ticket) {
  if (!isActiveUser(user) || !ticket) {
    return false;
  }

  if (isLeaderOrAdmin(user)) {
    return true;
  }

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

export function canCreateChatRoom(user) {
  return isLeaderOrAdmin(user);
}

export function canDeleteAnyChatMessage(user) {
  return isLeaderOrAdmin(user);
}

export function canEditOwnChatMessage(user, message) {
  if (!isActiveUser(user) || !message) {
    return false;
  }

  if (message.uid !== user.uid) {
    return false;
  }

  const createdAt = Number(message.createdAt);

  if (!Number.isFinite(createdAt) || createdAt <= 0) {
    return false;
  }

  return Date.now() - createdAt <= 15 * 60 * 1000;
}

export function canDeleteOwnChatMessage(user, message) {
  return (
    isActiveUser(user) &&
    Boolean(message) &&
    message.uid === user.uid
  );
}

export function canViewMemberHistory(user, targetUid) {
  return canViewPrivateHistory(user, targetUid);
}

export function canManageBadges(user) {
  return isLeaderOrAdmin(user);
}

export function canManagePointsBalance(user) {
  return isLeaderOrAdmin(user);
    }
  
