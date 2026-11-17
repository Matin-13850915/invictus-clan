
import {
  login,
  logout,
  resetPassword,
  observeAuth,
  verifyCurrentSession
} from "./auth.js";

import { canAccessPage } from "./permissions.js";

import {
  auth,
  db,
  ref,
  onValue
} from "./firebase.js";

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
  pageContent: $("#page-content"),
  pageAlerts: $("#page-alerts")
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
  settings: "تنظیمات حساب",
  admin: "مدیریت کل سایت"
};

const roleNames = {
  admin: "مدیر کل سیستم",
  leader: "لیدر کلن",
  tester: "تستر",
  member: "عضو کلن"
};

let currentUser = null;
let authCheckInProgress = false;
let connectionUnsubscribe = null;

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
  if (connectionUnsubscribe) {
    connectionUnsubscribe();
  }

  connectionUnsubscribe = onValue(
    ref(db, ".info/connected"),
    snapshot => {
      setConnectionStatus(snapshot.val() === true);
    },
    () => setConnectionStatus(false)
  );
}

function showLogin() {
  currentUser = null;

  if (elements.loginView) {
    elements.loginView.hidden = false;
  }

  if (elements.dashboardView) {
    elements.dashboardView.hidden = true;
  }

  if (elements.loginForm) {
    elements.loginForm.reset();
  }

  if (elements.pageContent) {
    elements.pageContent.replaceChildren();
  }
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

function applyNavigationPermissions() {
  if (!elements.nav || !currentUser) return;

  elements.nav.querySelectorAll("a[data-page]").forEach(link => {
    const page = link.dataset.page;
    const allowed = canAccessPage(currentUser, page);

    link.hidden = !allowed;
    link.setAttribute("aria-hidden", String(!allowed));
  });
}

function renderPage() {
  if (!currentUser || !elements.pageContent) return;

  const page = location.hash.replace(/^#/, "") || "home";

  if (!Object.prototype.hasOwnProperty.call(pageNames, page)) {
    location.hash = "home";
    return;
  }

  if (!canAccessPage(currentUser, page)) {
    elements.pageContent.textContent =
      "شما اجازه دسترسی به این بخش را ندارید.";

    setText(elements.pageTitle, "دسترسی محدود");
    return;
  }

  setText(elements.pageTitle, pageNames[page]);

  if (elements.nav) {
    elements.nav.querySelectorAll("a[data-page]").forEach(link => {
      link.classList.toggle(
        "active",
        link.dataset.page === page
      );
    });
  }

  elements.pageContent.replaceChildren();

  const card = document.createElement("section");
  card.className = "card";

  const heading = document.createElement("h2");
  heading.className = "card-title";
  heading.textContent = pageNames[page];

  const description = document.createElement("p");
  description.style.color = "var(--muted)";

  description.textContent = page === "home"
    ? `به پنل کلن INVICTUS خوش آمدید، ${currentUser.displayName || "عضو کلن"}.`
    : "ساختار دسترسی این بخش آماده است؛ اتصال قابلیت‌های آن در مرحله توسعه ماژول مربوطه انجام می‌شود.";

  card.append(heading, description);
  elements.pageContent.appendChild(card);

  if (elements.sidebar) {
    elements.sidebar.classList.remove("open");
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
    showLoginMessage(
      error.message || "ورود انجام نشد. اطلاعات حساب را بررسی کنید."
    );
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
      error.message || "ارسال لینک بازیابی انجام نشد."
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
  } catch {
    showToast("خروج از حساب ناموفق بود.", "error");
  } finally {
    if (elements.logoutButton) {
      elements.logoutButton.disabled = false;
    }
  }
}

function bindEvents() {
  elements.loginForm?.addEventListener("submit", handleLogin);

  elements.forgotPassword?.addEventListener(
    "click",
    handlePasswordReset
  );

  elements.logoutButton?.addEventListener(
    "click",
    handleLogout
  );

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
  
