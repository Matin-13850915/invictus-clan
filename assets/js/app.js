
import {
  auth,
  db,
  ref,
  get,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "./firebase.js";

const ADMIN_UID = "kxaAoKgm5WUxqsV9hoAk75XQuL43";

const $ = (selector) => document.querySelector(selector);

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
  settings: "تنظیمات حساب",
  admin: "مدیریت کل سایت"
};

let currentUser = null;
let currentRole = null;

function showMessage(message, type = "error") {
  elements.loginMessage.textContent = message;
  elements.loginMessage.className = "form-message";

  if (type === "success") {
    elements.loginMessage.classList.add("success");
  }
}

function setConnectionStatus(online, message) {
  elements.connectionStatus.textContent = message;
  elements.connectionStatus.classList.toggle("online", online);
  elements.connectionStatus.classList.toggle("offline", !online);
}

function showLogin() {
  elements.loginView.hidden = false;
  elements.dashboardView.hidden = true;
  currentUser = null;
  currentRole = null;
}

function showDashboard(user, role) {
  currentUser = user;
  currentRole = role;

  elements.loginView.hidden = true;
  elements.dashboardView.hidden = false;

  elements.userName.textContent =
    user.displayName || user.email || "مدیر کل";

  elements.userRole.textContent = role === "admin"
    ? "مدیر کل سیستم"
    : role === "leader"
      ? "لیدر کلن"
      : role === "tester"
        ? "تستر"
        : "عضو کلن";

  elements.userAvatar.textContent =
    (user.displayName || user.email || "I").charAt(0).toUpperCase();

  renderPage();
}

function showToast(message, type = "success") {
  const region = $("#toast-region");
  const toast = document.createElement("div");

  toast.className = `toast ${type}`;
  toast.textContent = message;
  region.appendChild(toast);

  window.setTimeout(() => toast.remove(), 3500);
}

function renderPage() {
  const page = location.hash.replace("#", "") || "home";

  if (!pageNames[page]) {
    location.hash = "home";
    return;
  }

  elements.pageTitle.textContent = pageNames[page];

  document.querySelectorAll("#main-nav a").forEach(link => {
    link.classList.toggle("active", link.dataset.page === page);
  });

  if (page === "admin" && currentRole !== "admin") {
    elements.pageContent.textContent =
      "شما اجازه دسترسی به مدیریت کل سایت را ندارید.";
    return;
  }

  elements.pageContent.innerHTML = "";

  const heading = document.createElement("div");
  heading.className = "card";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = pageNames[page];

  const description = document.createElement("p");
  description.style.color = "var(--muted)";
  description.textContent =
    page === "home"
      ? "به پنل مدیریت کلن łK¹・INVICTUS خوش آمدید."
      : "این بخش در مراحل بعدی به سیستم واقعی متصل خواهد شد.";

  heading.append(title, description);
  elements.pageContent.appendChild(heading);
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value;

  if (!email || !password) {
    showMessage("ایمیل و رمز عبور را وارد کنید.");
    return;
  }

  elements.loginSubmit.disabled = true;
  elements.loginSubmit.textContent = "در حال ورود...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMessage("ورود موفقیت‌آمیز بود.", "success");
  } catch (error) {
    const messages = {
      "auth/invalid-credential": "ایمیل یا رمز عبور اشتباه است.",
      "auth/user-not-found": "حساب کاربری پیدا نشد.",
      "auth/wrong-password": "رمز عبور اشتباه است.",
      "auth/too-many-requests": "تعداد تلاش‌ها زیاد بوده؛ کمی بعد دوباره امتحان کنید.",
      "auth/network-request-failed": "اتصال اینترنت یا VPN را بررسی کنید."
    };

    showMessage(messages[error.code] || "ورود انجام نشد. دوباره تلاش کنید.");
  } finally {
    elements.loginSubmit.disabled = false;
    elements.loginSubmit.textContent = "ورود به پنل";
  }
});

elements.forgotPassword.addEventListener("click", async () => {
  const email = elements.loginEmail.value.trim();

  if (!email) {
    showMessage("ابتدا ایمیل حساب خود را وارد کنید.");
    elements.loginEmail.focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessage("لینک بازیابی رمز عبور به ایمیل ارسال شد.", "success");
  } catch (error) {
    showMessage("ارسال لینک انجام نشد. ایمیل و اتصال اینترنت را بررسی کنید.");
  }
});

elements.logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showLogin();
    showToast("با موفقیت از حساب خارج شدید.");
  } catch (error) {
    showToast("خروج از حساب انجام نشد.", "error");
  }
});

elements.mobileMenuToggle.addEventListener("click", () => {
  elements.sidebar.classList.toggle("open");
});

elements.nav.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-page]");

  if (link && window.innerWidth <= 900) {
    elements.sidebar.classList.remove("open");
  }
});

window.addEventListener("hashchange", renderPage);

window.addEventListener("online", () => {
  setConnectionStatus(true, "اتصال اینترنت برقرار است");
});

window.addEventListener("offline", () => {
  setConnectionStatus(false, "اتصال اینترنت قطع است");
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    setConnectionStatus(navigator.onLine, navigator.onLine
      ? "آماده ورود"
      : "بدون اینترنت");
    return;
  }

  try {
    const roleSnapshot = await get(ref(db, `roles/${user.uid}`));

    if (!roleSnapshot.exists()) {
      await signOut(auth);
      showLogin();
      showMessage("برای این حساب نقشی تعریف نشده است.");
      return;
    }

    const roleData = roleSnapshot.val();

    if (roleData.active !== true) {
      await signOut(auth);
      showLogin();
      showMessage("این حساب غیرفعال شده است.");
      return;
    }

    const role = roleData.role;

    if (!["admin", "leader", "tester", "member"].includes(role)) {
      await signOut(auth);
      showLogin();
      showMessage("نقش حساب معتبر نیست.");
      return;
    }

    if (user.uid === ADMIN_UID && role !== "admin") {
      await signOut(auth);
      showLogin();
      showMessage("نقش مدیر اصلی معتبر نیست.");
      return;
    }

    if (user.uid !== ADMIN_UID && role === "admin") {
      await signOut(auth);
      showLogin();
      showMessage("این حساب اجازه دریافت نقش مدیر اصلی را ندارد.");
      return;
    }

    showDashboard(user, role);
    setConnectionStatus(true, "متصل به سیستم");
  } catch (error) {
    await signOut(auth);
    showLogin();
    setConnectionStatus(false, "خطا در دریافت اطلاعات");
    showMessage("دریافت نقش حساب ناموفق بود. قوانین Firebase را بررسی کنید.");
  }
});
    
