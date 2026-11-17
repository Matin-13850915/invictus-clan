
export const CLAN = Object.freeze({
  name: "łK¹・INVICTUS",
  tag: "łK¹",
  game: "Call of Duty: Mobile",
  gameShort: "CODM",
  theme: "dark-gold"
});

export const APPLICATION_STATUS = Object.freeze({
  PENDING: "pending",
  AWAITING_TESTER: "awaiting_tester",
  TESTING: "testing",
  TEST_COMPLETED: "test_completed",
  RETEST_REQUESTED: "retest_requested",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
  EXPIRED: "expired"
});

export const WAR_TYPES = Object.freeze({
  MP: "MP",
  BR: "BR"
});

export const WAR_RESULTS = Object.freeze({
  WIN: "win",
  LOSS: "loss",
  DRAW: "draw"
});

export const CHAT_ROOMS = Object.freeze({
  GENERAL: "general",
  ATTACHMENT: "attachment",
  STAFF: "staff"
});

export const RESTRICTION_DURATIONS = Object.freeze({
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  SIX_HOURS: 6 * 60 * 60 * 1000,
  TWELVE_HOURS: 12 * 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000
});

export const MESSAGE_EDIT_WINDOW = 15 * 60 * 1000;

export const NOTIFICATION_TYPES = Object.freeze({
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  DANGER: "danger"
});

export const DEFAULT_SETTINGS = Object.freeze({
  maintenanceMode: false,
  applicationsEnabled: true,
  chatEnabled: true,
  rewardsShopEnabled: true,
  tournamentsEnabled: true
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
