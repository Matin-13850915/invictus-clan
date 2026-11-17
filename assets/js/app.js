
import {
  login,
  logout,
  resetPassword,
  observeAuth,
  verifyCurrentSession
} from "./auth.js";

import { canAccessPage } from "./permissions.js";
import { db, ref, onValue } from "./firebase.js";

const $ = selector => document.querySelector(selector);

const elements = {
  loginView: $("#login-view"),
  dashboardView: $("#dashboard-view"),
  loginForm: $("#login-form"),
  loginEmail: $("#login-email"),
  loginPassword: $("#login-password"),
  loginMessage: $("#login-message"),
  loginSubmit: $("#login-submit"),
  forgotPassword: $("#forgot-password"),
  connectionStatus: $("#connection-status"),
  userName: $("#user-display-name"),
  userRole: $("#user-role"),
  userAvatar: $("#user-avatar"),
  logoutButton: $("#logout-button"),
  mobileMenuToggle: $("#mobile-menu-toggle"),
  sidebar: $("#sidebar"),
  nav: $("#main-nav"),
  pageTitle: $("#page-title"),
  pageContent: $("#page-content")
};

const pageNames = {
  home: "داشبورد",
  applications: "درخواست‌های عضویت",
  members: "اعضای کلن",
  announcements: "اطلاعیه‌ها",
  wars: "جنگ‌ها",
  rankings: "رتبه‌بندی",
  chat: "اتاق‌های چت",
  forum: "انجمن",
  messages: "پیام خصوصی",
  teams: "تیم‌ها",
  tournaments: "مسابقات",
  seasons: "فصل‌ها",
  rewards: "جوایز و فروشگاه",
  tickets: "پشتیبانی",
  archive: "آرشیو",
  statistics: "آمار و گزارش‌ها",
  staff: "فعالیت و سوابق",
  rules: "قوانین کلن",
  settings: "تنظیمات",
  profile: "پروفایل",
  notifications: "اعلان‌ها",
  support: "گزارش مشکلات سایت",
  admin: "مدیریت کل سایت",
  audit: "گزارش اقدامات",
  activity: "سوابق فعالیت"
};

const roleNames = {
  admin: "مدیر کل سیستم",
  leader: "لیدر کلن",
  tester: "تستر",
  member: "عضو کلن"
};

const pageLoaders = {
  home: () => import("./pages/home.js"),
  applications: () => import("./pages/applications.js"),
  members: () => import("./pages/members.js"),
  announcements: () => import("./pages/announcements.js"),
  wars: () => import("./pages/wars.js"),
  rankings: () => import("./pages/rankings.js"),
  chat: () => import("./pages/chat.js"),
  forum: () => import("./pages/forum.js"),
  messages: () => import("./pages/messages.js"),
  teams: () => import("./pages/teams.js"),
  tournaments: () => import("./pages/tournaments.js"),
  seasons: () => import("./pages/seasons.js"),
  rewards: () => import("./pages/rewards.js"),
  tickets: () => import("./pages/tickets.js"),
  archive: () => import("./pages/archive.js"),
  statistics: () => import("./pages/statistics.js"),
  rules: () => import("./pages/rules.js"),
  settings: () => import("./pages/settings.js"),
  profile: () => import("./pages/profile.js"),
  notifications: () => import("./pages/notifications.js"),
  admin: () => import("./pages/admin.js"),
  support: () => import("./pages/bug-reports.js"),
  audit: () => import("./pages/audit.js"),
  activity: () => import("./pages/activity.js"),
  staff: () => import("./pages/activity.js")
};

const renderFunctions = {
  home: "renderHome",
  applications: "renderApplications",
  members: "renderMembers",
  announcements: "renderAnnouncements",
  wars: "renderWars",
  rankings: "renderRankings",
  chat: "renderChat",
  forum: "renderForum",
  messages: "renderMessages",
  teams: "renderTeams",
  tournaments: "renderTournaments",
  seasons: "renderSeasons",
  rewards: "renderRewards",
  tickets: "renderTickets",
  archive: "renderArchive",
  statistics: "renderStatistics",
  rules: "renderRules",
  settings: "renderSettings",
  profile: "renderProfile",
  notifications: "renderNotifications",
  admin: "renderAdmin",
  support: "renderBugReports",
  audit: "renderAudit",
  activity: "renderActivity",
  staff: "renderActivity"
};

let currentUser = null;
let authCheckInProgress = false;
let connectionUnsubscribe = null;
let pageRenderVersion = 0;

function setText(element, value) {
  if (element) element.textContent = value;
}

function showLoginMessage(message, type = "error") {
  if (!elements.loginMessage) return;

  elements.loginMessage.textContent = message;
  elements.loginMessage.className = "form-message";

  if (type === "success") {
    elements.loginMessage.classList.add("success");
  }
}

function showToast(message, type = "success") {
  const region = $("#toast-region");
  if (!region) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  region.appendChild(toast);

  window.setTimeout(() => toast.remove(), 3500);
}

function setConnectionStatus(connected) {
  const element = elements.connectionStatus;
  if (!element) return;

  element.textContent = connected
    ? "متصل به Firebase"
    : "اتصال به Firebase قطع است";

  element.classList.toggle("online", connected);
  element.classList.toggle("offline", !connected);
}

function startConnectionMonitor() {
  connectionUnsubscribe?.();

  connectionUnsubscribe = onValue(
    ref(db, ".info/connected"),
    snapshot => setConnectionStatus(snapshot.val() === true),
    () => setConnectionStatus(false)
  );
}

function showLogin() {
  currentUser = null;
  pageRenderVersion++;

  if (elements.loginView) elements.loginView.hidden = false;
  if (elements.dashboardView) elements.dashboardView.hidden = true;
  if (elements.loginForm) elements.loginForm.reset();
  if (elements.pageContent) elements.pageContent.replaceChildren();
  if (elements.sidebar) elements.sidebar.classList.remove("open");
}

function showDashboard(user) {
  currentUser = user;

  if (elements.loginView) elements.loginView.hidden = true;
  if (elements.dashboardView) elements.dashboardView.hidden = false;

  setText(
    elements.userName,
    user.displayName || user.email || "کاربر"
  );

  setText(
    elements.userRole,
    roleNames[user.role] || "نقش نامشخص"
  );

  setText(
    elements.userAvatar,
    (user.displayName || user.email || "I")
      .trim()
      .charAt(0)
      .toUpperCase()
  );

  applyNavigationPermissions();

  if (!location.hash) {
    location.hash = "home";
  } else {
    renderPage();
  }
}

function applyNavigationPermissions() {
  if (!elements.nav || !currentUser) return;

  elements.nav.querySelectorAll("a[data-page]").forEach(link => {
    const page = link.dataset.page;
    const allowed = canAccessPage(currentUser, page);

    link.hidden = !allowed;
    link.setAttribute("aria-hidden", String(!allowed));
  });
}

function showPageError(error) {
  console.error("Page rendering failed:", error);

  if (!elements.pageContent) return;

  const card = document.createElement("section");
  card.className = "card error-state";

  const message = document.createElement("p");
  message.textContent =
    error?.message ||
    "بارگذاری صفحه ناموفق بود. اتصال و دسترسی حساب را بررسی کنید.";

  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "secondary-button";
  retry.textContent = "تلاش دوباره";
  retry.addEventListener("click", renderPage);

  card.append(message, retry);
  elements.pageContent.replaceChildren(card);
}

async function renderBuiltPage(page) {
  if (page === "staff") {
    const module = await import("./pages/audit.js");
    return module.renderAudit(elements.pageContent, currentUser);
  }

  const loader = pageLoaders[page];
  const functionName = renderFunctions[page];

  if (!loader || !functionName) {
    throw new Error("صفحه موردنظر هنوز به برنامه متصل نشده است.");
  }

  const module = await loader();
  const render = module[functionName];

  if (typeof render !== "function") {
    throw new Error(
      `تابع ${functionName} در فایل صفحه پیدا نشد.`
    );
  }

  return render(elements.pageContent, currentUser);
}

async function renderPage() {
  if (!currentUser || !elements.pageContent) return;

  const page = location.hash.replace(/^#/, "") || "home";

  if (!Object.prototype.hasOwnProperty.call(pageNames, page)) {
    location.hash = "home";
    return;
  }

  if (!canAccessPage(currentUser, page)) {
    setText(elements.pageTitle, "دسترسی محدود");
    elements.pageContent.textContent =
      "شما اجازه دسترسی به این بخش را ندارید.";
    return;
  }

  setText(elements.pageTitle, pageNames[page]);

  elements.nav?.querySelectorAll("a[data-page]").forEach(link => {
    link.classList.toggle("active", link.dataset.page === page);
  });

  elements.pageContent.replaceChildren();
  elements.sidebar?.classList.remove("open");

  const version = ++pageRenderVersion;

  try {
    await renderBuiltPage(page);

    if (version !== pageRenderVersion) return;

  } catch (error) {
    if (version !== pageRenderVersion) return;
    showPageError(error);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const email = elements.loginEmail?.value.trim();
  const password = elements.loginPassword?.value;

  if (!email || !password) {
    showLoginMessage("ایمیل و رمز عبور را وارد کنید.");
    return;
  }

  if (elements.loginSubmit) {
    elements.loginSubmit.disabled = true;
    elements.loginSubmit.textContent = "در حال ورود...";
  }

  try {
    await login(email, password);
    showLoginMessage("ورود موفقیت‌آمیز بود.", "success");
  } catch (error) {
    showLoginMessage(error.message || "ورود انجام نشد.");
  } finally {
    if (elements.loginSubmit) {
      elements.loginSubmit.disabled = false;
      elements.loginSubmit.textContent = "ورود به پنل";
    }
  }
}

async function handlePasswordReset() {
  const email = elements.loginEmail?.value.trim();

  if (!email) {
    showLoginMessage("ابتدا ایمیل حساب را وارد کنید.");
    elements.loginEmail?.focus();
    return;
  }

  try {
    await resetPassword(email);
    showLoginMessage("لینک بازیابی رمز عبور ارسال شد.", "success");
  } catch (error) {
    showLoginMessage(error.message || "بازیابی رمز انجام نشد.");
  }
}

async function handleLogout() {
  if (elements.logoutButton) {
    elements.logoutButton.disabled = true;
  }

  try {
    await logout();
    showToast("از حساب خارج شدید.");
    showLogin();
  } catch (error) {
    console.error("Logout failed:", error);
    showToast("خروج از حساب ناموفق بود.", "error");
  } finally {
    if (elements.logoutButton) {
      elements.logoutButton.disabled = false;
    }
  }
}

function bindEvents() {
  elements.loginForm?.addEventListener("submit", handleLogin);
  elements.forgotPassword?.addEventListener("click", handlePasswordReset);
  elements.logoutButton?.addEventListener("click", handleLogout);

  elements.mobileMenuToggle?.addEventListener("click", () => {
    elements.sidebar?.classList.toggle("open");
  });

  elements.nav?.addEventListener("click", event => {
    const link = event.target.closest("a[data-page]");

    if (link && window.innerWidth <= 900) {
      elements.sidebar?.classList.remove("open");
    }
  });

  window.addEventListener("hashchange", renderPage);
}

async function handleAuthState(user) {
  if (authCheckInProgress) return;

  if (!user) {
    showLogin();
    return;
  }

  authCheckInProgress = true;

  try {
    const session = await verifyCurrentSession();

    if (!session) {
      showLogin();
      showLoginMessage(
        "حساب شما فعال نیست یا دسترسی معتبر ندارد."
      );
      return;
    }

    showDashboard(session);

  } catch (error) {
    console.error("Authentication verification failed:", error);
    showLogin();
    showLoginMessage("بررسی حساب ناموفق بود.");

  } finally {
    authCheckInProgress = false;
  }
}

function initializeApp() {
  if (!elements.loginView || !elements.dashboardView) {
    console.error("ساختار اصلی صفحه در index.html ناقص است.");
    return;
  }

  bindEvents();
  startConnectionMonitor();
  observeAuth(handleAuthState);
}

initializeApp();
