
export const CLAN = Object.freeze({
  name: "łK¹・INVICTUS",
  tag: "łK¹",
  game: "Call of Duty: Mobile",
  gameShort: "CODM",
  theme: "dark-gold"
});

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

export const APPLICATION_STATUS = Object.freeze({
  PENDING: "pending",
  AWAITING_TESTER: "awaiting_tester",
  AWAITING_TEST: "awaiting_test",
  TESTING: "testing",
  TEST_COMPLETED: "test_completed",
  AWAITING_LEADER: "awaiting_leader",
  RETEST_REQUESTED: "retest_requested",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
  EXPIRED: "expired"
});

export const APPLICATION_TYPES = Object.freeze({
  MP: "MP",
  BR: "BR",
  BOTH: "BOTH"
});

export const WAR_TYPES = Object.freeze({
  MP: "MP",
  BR: "BR"
});

export const WAR_RESULTS = Object.freeze({
  PENDING: "pending",
  WIN: "win",
  LOSS: "loss",
  DRAW: "draw",
  CANCELLED: "cancelled"
});

export const WAR_APPLICATION_STATUS = Object.freeze({
  PENDING: "pending",
  SELECTED: "selected",
  NOT_SELECTED: "not_selected",
  WITHDRAWN: "withdrawn",
  RESERVE: "reserve"
});

export const CHAT_ROOMS = Object.freeze({
  GENERAL: "general",
  ATTACHMENT: "attachment",
  CUSTOM: "custom"
});

export const CHAT_ROOM_LABELS = Object.freeze({
  general: "چت عمومی",
  attachment: "پیوست"
});

export const MESSAGE_EDIT_WINDOW = 15 * 60 * 1000;

export const RESTRICTION_DURATIONS = Object.freeze({
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  SIX_HOURS: 6 * 60 * 60 * 1000,
  TWELVE_HOURS: 12 * 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000
});

export const MAX_CUSTOM_RESTRICTION = 30 * 24 * 60 * 60 * 1000;

export const NOTIFICATION_TYPES = Object.freeze({
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  DANGER: "danger"
});

export const TICKET_STATUS = Object.freeze({
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  WAITING: "waiting",
  CLOSED: "closed"
});

export const REWARD_REQUEST_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  DELIVERED: "delivered",
  CANCELLED: "cancelled"
});

export const TOURNAMENT_STATUS = Object.freeze({
  REQUESTED: "requested",
  PENDING: "pending",
  OPEN: "open",
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled"
});

export const SEASON_STATUS = Object.freeze({
  UPCOMING: "upcoming",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  ARCHIVED: "archived"
});

export const DEFAULT_SETTINGS = Object.freeze({
  maintenanceMode: false,
  applicationsEnabled: true,
  chatEnabled: true,
  rewardsShopEnabled: true,
  tournamentsEnabled: true,
  forumEnabled: true,
  announcementsEnabled: true
});

export const PAGE_ACCESS = Object.freeze({
  home: ["admin", "leader", "tester", "member"],
  applications: ["admin", "leader", "tester"],
  members: ["admin", "leader", "tester", "member"],
  announcements: ["admin", "leader", "tester", "member"],
  wars: ["admin", "leader", "tester", "member"],
  rankings: ["admin", "leader", "tester", "member"],
  chat: ["admin", "leader", "tester", "member"],
  forum: ["admin", "leader", "tester", "member"],
  messages: ["admin", "leader", "member"],
  staffChat: ["admin", "leader"],
  profile: ["admin", "leader", "tester", "member"],
  notifications: ["admin", "leader", "tester", "member"],
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
});
  
