
export const ROLES = Object.freeze({
  ADMIN: "admin",
  LEADER: "leader",
  TESTER: "tester",
  MEMBER: "member"
});

const ROLE_LEVEL = Object.freeze({
  member: 1,
  tester: 2,
  leader: 3,
  admin: 4
});

export function hasRole(user, role) {
  return Boolean(user && user.role === role);
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
  return Boolean(
    user && (
      user.role === ROLES.ADMIN ||
      user.role === ROLES.LEADER ||
      user.role === ROLES.TESTER
    )
  );
}

export function hasMinimumRole(user, requiredRole) {
  if (!user || !ROLE_LEVEL[user.role] || !ROLE_LEVEL[requiredRole]) {
    return false;
  }

  return ROLE_LEVEL[user.role] >= ROLE_LEVEL[requiredRole];
}

export function canManageWebsite(user) {
  return isAdmin(user);
}

export function canManageMembers(user) {
  return isAdmin(user) || isLeader(user);
}

export function canManageApplications(user) {
  return isAdmin(user) || isLeader(user);
}

export function canPublishAnnouncements(user) {
  return isAdmin(user) || isLeader(user);
}

export function canManageWars(user) {
  return isAdmin(user) || isLeader(user);
}

export function canManageTeams(user) {
  return isAdmin(user) || isLeader(user);
}

export function canManageTournaments(user) {
  return isAdmin(user) || isLeader(user);
}

export function canManageSeasons(user) {
  return isAdmin(user) || isLeader(user);
}

export function canManageRewards(user) {
  return isAdmin(user) || isLeader(user);
}

export function canModerateChat(user) {
  return isAdmin(user) || isLeader(user);
}

export function canViewStaffChat(user) {
  return isAdmin(user) || isLeader(user);
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

export function canSubmitTestResult(user) {
  return isTester(user) || isLeader(user) || isAdmin(user);
}

export function canViewAssignedTests(user) {
  return isTester(user) || isLeader(user) || isAdmin(user);
}

export function canManageOwnProfile(user, targetUid) {
  return Boolean(user && user.uid === targetUid);
}

export function canViewPrivateHistory(user, targetUid) {
  return Boolean(
    user && (
      user.uid === targetUid ||
      isLeader(user) ||
      isAdmin(user)
    )
  );
}

export function canManagePoints(user) {
  return isAdmin(user) || isLeader(user);
}

export function canApproveWarApplications(user) {
  return isAdmin(user) || isLeader(user);
}

export function canManageSupportTickets(user, ticket) {
  if (!user || !ticket) return false;

  if (isAdmin(user) || isLeader(user)) return true;

  if (isTester(user)) {
    return ticket.assignedTesterUid === user.uid;
  }

  return ticket.ownerUid === user.uid;
}
