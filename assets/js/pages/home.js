
const ROLE_NAMES = {
  admin: "مدیر کل سیستم",
  leader: "لیدر کلن",
  tester: "تستر",
  member: "عضو کلن"
};

const QUICK_LINKS = [
  {
    page: "applications",
    title: "درخواست‌های عضویت",
    roles: ["admin", "leader", "tester"]
  },
  { page: "members", title: "اعضای کلن" },
  { page: "announcements", title: "اطلاعیه‌ها" },
  { page: "wars", title: "جنگ‌ها" },
  { page: "rankings", title: "رتبه‌بندی" },
  { page: "chat", title: "اتاق‌های چت" },
  { page: "messages", title: "پیام خصوصی" },
  { page: "tickets", title: "پشتیبانی" },
  {
    page: "statistics",
    title: "آمار و گزارش‌ها",
    roles: ["admin", "leader"]
  },
  {
    page: "admin",
    title: "مدیریت کل سایت",
    roles: ["admin"]
  }
];

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }

  return element;
}

function createLink(page, title) {
  const link = createElement(
    "a",
    "home-shortcut",
    title
  );

  link.href = `#${page}`;
  link.dataset.page = page;

  return link;
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 11) return "صبح بخیر";
  if (hour < 17) return "روز بخیر";

  return "عصر بخیر";
}

function formatDate(date) {
  return new Intl.DateTimeFormat("fa-IR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

export function renderHome(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش داشبورد معتبر نیست.");
  }

  if (
    !user?.uid ||
    !user?.role ||
    user.active !== true
  ) {
    throw new Error("اطلاعات حساب کاربر معتبر نیست.");
  }

  const fragment = document.createDocumentFragment();

  // خوش‌آمدگویی
  const welcome = createElement(
    "section",
    "card home-welcome"
  );

  welcome.append(
    createElement(
      "span",
      "eyebrow",
      "INVICTUS CONTROL CENTER"
    ),
    createElement(
      "h2",
      "",
      `${getGreeting()}، ${user.displayName || "عضو کلن"}!`
    ),
    createElement(
      "p",
      "",
      "به پنل مدیریت و ارتباطات کلن INVICTUS خوش آمدید."
    )
  );

  fragment.appendChild(welcome);

  // اطلاعات حساب
  const account = createElement(
    "section",
    "card home-account"
  );

  account.append(
    createElement("h2", "card-title", "اطلاعات حساب"),
    createElement(
      "p",
      "",
      `نام نمایشی: ${user.displayName || "ثبت نشده"}`
    ),
    createElement(
      "p",
      "",
      `ایمیل: ${user.email || "نامشخص"}`
    ),
    createElement(
      "p",
      "",
      `نقش: ${ROLE_NAMES[user.role] || "نامشخص"}`
    ),
    createElement(
      "p",
      "",
      user.specialty
        ? `تخصص تستر: ${user.specialty}`
        : "تخصص: —"
    ),
    createElement(
      "p",
      "",
      `وضعیت حساب: ${user.active === true ? "فعال" : "نامشخص"}`
    )
  );

  fragment.appendChild(account);

  // میانبرها
  const shortcuts = createElement(
    "section",
    "card home-shortcuts"
  );

  shortcuts.appendChild(
    createElement(
      "h2",
      "card-title",
      "دسترسی سریع"
    )
  );

  const grid = createElement(
    "div",
    "home-shortcuts-grid"
  );

  QUICK_LINKS
    .filter(item =>
      !item.roles || item.roles.includes(user.role)
    )
    .forEach(item => {
      grid.appendChild(
        createLink(item.page, item.title)
      );
    });

  shortcuts.appendChild(grid);
  fragment.appendChild(shortcuts);

  // اطلاعات روز
  const dateCard = createElement(
    "section",
    "card home-date"
  );

  dateCard.append(
    createElement("h2", "card-title", "امروز"),
    createElement("p", "", formatDate(new Date()))
  );

  fragment.appendChild(dateCard);

  // پیام ویژه نقش کاربر
  const roleMessages = {
    admin: "دسترسی مدیریتی کامل برای مدیریت سامانه در اختیار شماست.",
    leader: "از این بخش می‌توانید امور اجرایی و مدیریتی کلن را پیگیری کنید.",
    tester: "درخواست‌های تست اختصاص‌یافته به خودتان را از بخش درخواست‌های عضویت پیگیری کنید.",
    member: "از بخش‌های مختلف برای ارتباط با اعضا و پیگیری فعالیت‌های کلن استفاده کنید."
  };

  const notice = createElement(
    "section",
    "card home-role-notice"
  );

  notice.append(
    createElement(
      "h2",
      "card-title",
      "پیام سامانه"
    ),
    createElement(
      "p",
      "",
      roleMessages[user.role] || "به سامانه خوش آمدید."
    )
  );

  fragment.appendChild(notice);

  container.replaceChildren(fragment);
      }
