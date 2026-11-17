
import {
  login,
  logout,
  resetPassword,
  observeAuth,
  verifyCurrentSession
} from "./auth.js";

import { canAccessPage } from "./permissions.js";
import { db, ref, onValue } from "./firebase.js";
import { submitApplication } from "./applications.js";

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
  staff: "کادر مدیریتی",
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
  staff: () => import("./pages/activity.js"),
  rules: () => import("./pages/rules.js"),
  settings: () => import("./pages/settings.js"),
  profile: () => import("./pages/profile.js"),
  notifications: () => import("./pages/notifications.js"),
  support: () => import("./pages/bug-reports.js"),
  admin: () => import("./pages/admin.js"),
  audit: () => import("./pages/audit.js"),
  activity: () => import("./pages/activity.js")
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
  staff: "renderActivity",
  rules: "renderRules",
  settings: "renderSettings",
  profile: "renderProfile",
  notifications: "renderNotifications",
  support: "renderBugReports",
  admin: "renderAdmin",
  audit: "renderAudit",
  activity: "renderActivity"
};

let currentUser = null;
let authCheckInProgress = false;
let connectionUnsubscribe = null;
let pageRenderVersion = 0;

function setText(element, value) {
  if (element) {
    element.textContent = String(value ?? "");
  }
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
    snapshot => {
      setConnectionStatus(snapshot.val() === true);
    },
    () => {
      setConnectionStatus(false);
    }
  );
}

/* PUBLIC APPLICATION FORM */

function setupPublicApplication() {
  const authCard = $("#login-view .auth-card");

  if (!authCard || $("#public-application-toggle")) return;

  const toggle = document.createElement("button");
  toggle.id = "public-application-toggle";
  toggle.type = "button";
  toggle.className = "text-button";
  toggle.textContent = "درخواست عضویت در کلن";

  const root = document.createElement("section");
  root.id = "public-application-root";
  root.hidden = true;

  root.innerHTML = `
    <div class="auth-heading">
      <span class="eyebrow">JOIN INVICTUS</span>
      <h2>فرم درخواست عضویت</h2>
      <p>اطلاعات خود را با دقت وارد کنید.</p>
    </div>

    <form id="public-application-form">

      <label for="application-real-name">نام واقعی</label>
      <input
        id="application-real-name"
        name="realName"
        type="text"
        minlength="2"
        maxlength="70"
        required
      >

      <label for="application-email">ایمیل</label>
      <input
        id="application-email"
        name="email"
        type="email"
        maxlength="120"
        required
      >

      <label for="application-game-name">نام داخل بازی</label>
      <input
        id="application-game-name"
        name="gameName"
        type="text"
        minlength="2"
        maxlength="40"
        required
      >

      <label for="application-game-level">لول بازی</label>
      <input
        id="application-game-level"
        name="gameLevel"
        type="number"
        min="1"
        max="500"
        required
      >

      <label for="application-type">بخش مورد درخواست</label>
      <select
        id="application-type"
        name="applicationType"
        required
      >
        <option value="MP">مولتی‌پلیر (MP)</option>
        <option value="BR">بتل رویال (BR)</option>
        <option value="BOTH">هر دو بخش</option>
      </select>

      <div id="application-mp-field">
        <label for="application-mp-rank">رنک مولتی‌پلیر</label>
        <input
          id="application-mp-rank"
          name="mpRank"
          type="text"
          maxlength="40"
        >
      </div>

      <div id="application-br-field">
        <label for="application-br-rank">رنک بتل رویال</label>
        <input
          id="application-br-rank"
          name="brRank"
          type="text"
          maxlength="40"
        >
      </div>

      <label for="application-contact-type">راه ارتباطی</label>
      <select
        id="application-contact-type"
        name="contactType"
        required
      >
        <option value="telegram">تلگرام</option>
        <option value="rubika">روبیکا</option>
      </select>

      <label for="application-contact-value">
        آیدی یا شماره راه ارتباطی
      </label>
      <input
        id="application-contact-value"
        name="contactValue"
        type="text"
        minlength="3"
        maxlength="100"
        required
      >

      <label for="application-description">
        توضیحات تکمیلی (اختیاری)
      </label>
      <textarea
        id="application-description"
        name="description"
        maxlength="1000"
        rows="4"
      ></textarea>

      <button
        id="public-application-submit"
        type="submit"
      >
        ثبت درخواست عضویت
      </button>

      <p
        id="public-application-message"
        class="form-message"
        role="status"
        aria-live="polite"
      ></p>
    </form>
  `;

  authCard.append(toggle, root);

  toggle.addEventListener("click", () => {
    root.hidden = !root.hidden;
    toggle.textContent = root.hidden
      ? "درخواست عضویت در کلن"
      : "بستن فرم درخواست";

    if (!root.hidden) {
      root.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });

  const form = $("#public-application-form");
  const typeSelect = $("#application-type");
  const mpField = $("#application-mp-field");
  const brField = $("#application-br-field");
  const mpInput = $("#application-mp-rank");
  const brInput = $("#application-br-rank");
  const message = $("#public-application-message");
  const submitButton = $("#public-application-submit");

  function updateRankFields() {
    const type = typeSelect.value;

    const showMP = type === "MP" || type === "BOTH";
    const showBR = type === "BR" || type === "BOTH";

    mpField.hidden = !showMP;
    brField.hidden = !showBR;

    mpInput.required = showMP;
    brInput.required = showBR;

    if (!showMP) mpInput.value = "";
    if (!showBR) brInput.value = "";
  }

  typeSelect.addEventListener("change", updateRankFields);
  updateRankFields();

  form.addEventListener("submit", async event => {
    event.preventDefault();

    message.textContent = "";
    message.className = "form-message";

    const data = Object.fromEntries(
      new FormData(form).entries()
    );

    data.gameLevel = Number(data.gameLevel);

    submitButton.disabled = true;
    submitButton.textContent = "در حال ثبت درخواست...";

    try {
      const result = await submitApplication(data);

      message.className = "form-message success";
      message.textContent =
        `درخواست شما ثبت شد. کد پیگیری: ${result.id}`;

      form.reset();
      updateRankFields();

    } catch (error) {
      console.error("Public application failed:", error);

      message.className = "form-message";
      message.textContent =
        error?.message || "ثبت درخواست انجام نشد.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "ثبت درخواست عضویت";
    }
  });
}

function showLogin() {
  currentUser = null;
  pageRenderVersion++;

  if (elements.loginView) {
    elements.loginView.hidden = false;
  }

  if (elements.dashboardView) {
    elements.dashboardView.hidden = true;
  }

  if (elements.loginForm) {
    elements.loginForm.reset();
  }

  elements.pageContent?.replaceChildren();
  elements.sidebar?.classList.remove("open");
}

function applyNavigationPermissions() {
  if (!elements.nav || !currentUser) return;

  elements.nav.querySelectorAll("a[data-page]").forEach(link => {
    const allowed = canAccessPage(
      currentUser,
      link.dataset.page
    );

    link.hidden = !allowed;
    link.setAttribute("aria-hidden", String(!allowed));
  });
}

function showDashboard(user) {
  currentUser = user;

  if (elements.loginView) {
    elements.loginView.hidden = true;
  }

  if (elements.dashboardView) {
    elements.dashboardView.hidden = false;
  }

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
  const loader = pageLoaders[page];
  const functionName = renderFunctions[page];

  if (!loader || !functionName) {
    throw new Error(
      "صفحه موردنظر هنوز به برنامه متصل نشده است."
    );
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
    link.classList.toggle(
      "active",
      link.dataset.page === page
    );
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
    showLoginMessage(
      "لینک بازیابی رمز عبور ارسال شد.",
      "success"
    );
  } catch (error) {
    showLoginMessage(
      error.message || "بازیابی رمز انجام نشد."
    );
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
  elements.loginForm?.addEventListener(
    "submit",
    handleLogin
  );

  elements.forgotPassword?.addEventListener(
    "click",
    handlePasswordReset
  );

  elements.logoutButton?.addEventListener(
    "click",
    handleLogout
  );

  elements.mobileMenuToggle?.addEventListener("click", () => {
    const isOpen = elements.sidebar?.classList.toggle("open");

    elements.mobileMenuToggle?.setAttribute(
      "aria-expanded",
      String(Boolean(isOpen))
    );
  });

  elements.nav?.addEventListener("click", event => {
    const link = event.target.closest("a[data-page]");

    if (link && window.innerWidth <= 900) {
      elements.sidebar?.classList.remove("open");
      elements.mobileMenuToggle?.setAttribute(
        "aria-expanded",
        "false"
      );
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
    console.error(
      "Authentication verification failed:",
      error
    );

    showLogin();
    showLoginMessage("بررسی حساب ناموفق بود.");

  } finally {
    authCheckInProgress = false;
  }
}

function initializeApp() {
  if (!elements.loginView || !elements.dashboardView) {
    console.error(
      "ساختار اصلی صفحه در index.html ناقص است."
    );
    return;
  }

  setupPublicApplication();
  bindEvents();
  startConnectionMonitor();
  observeAuth(handleAuthState);
}

initializeApp();
      
