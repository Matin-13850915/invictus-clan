
import {
  getAuditHistory,
  getUserAuditHistory
} from "../audit.js";

const $ = (tag, className = "", value = "") => {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  element.textContent = String(value ?? "");
  return element;
};

const ACTION_LABELS = {
  member_approved: "تأیید عضو",
  member_rejected: "رد درخواست عضویت",
  member_suspended: "تعلیق حساب",
  member_activated: "فعال‌سازی حساب",
  role_changed: "تغییر نقش",
  war_created: "ایجاد جنگ",
  war_updated: "ویرایش جنگ",
  war_result_recorded: "ثبت نتیجه جنگ",
  announcement_created: "ایجاد اطلاعیه",
  announcement_deleted: "حذف اطلاعیه",
  points_added: "افزایش امتیاز",
  points_removed: "کاهش امتیاز",
  reward_approved: "تأیید جایزه",
  reward_rejected: "رد جایزه",
  team_created: "ایجاد تیم",
  team_updated: "ویرایش تیم",
  team_deleted: "حذف تیم",
  tournament_created: "ایجاد تورنمنت",
  tournament_completed: "اتمام تورنمنت",
  rules_updated: "به‌روزرسانی قوانین",
  settings_updated: "تغییر تنظیمات"
};

const ROLE_LABELS = {
  admin: "مدیر کل",
  leader: "لیدر",
  tester: "تستر",
  member: "عضو"
};

function formatDate(value) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "زمان نامشخص";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "زمان نامشخص";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function stringifyValue(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[غیرقابل نمایش]";
    }
  }

  return String(value);
}

function createAuditCard(item) {
  const card = $("article", "card audit-card");

  const title =
    ACTION_LABELS[item.action] ||
    item.action ||
    "اقدام ثبت‌شده";

  card.append(
    $("h3", "audit-title", title),
    $("p", "", `انجام‌دهنده: ${item.actorUid || "نامشخص"}`),
    $("p", "", `نقش انجام‌دهنده: ${ROLE_LABELS[item.actorRole] || "نامشخص"}`),
    $("p", "", `حساب هدف: ${item.targetUid || "بدون حساب هدف"}`),
    $("p", "", `زمان: ${formatDate(item.createdAt)}`)
  );

  if (item.reason) {
    card.appendChild(
      $("p", "audit-reason", `دلیل: ${item.reason}`)
    );
  }

  const details = item.details;

  if (
    details &&
    typeof details === "object" &&
    !Array.isArray(details) &&
    Object.keys(details).length
  ) {
    const detailsBox = $("details", "audit-details");

    detailsBox.appendChild(
      $("summary", "", "جزئیات بیشتر")
    );

    Object.entries(details).forEach(([key, value]) => {
      detailsBox.appendChild(
        $("p", "", `${key}: ${stringifyValue(value)}`)
      );
    });

    card.appendChild(detailsBox);
  }

  return card;
}

function makeButton(label, callback) {
  const button = $("button", "secondary-button", label);

  button.type = "button";
  button.addEventListener("click", callback);

  return button;
}

export async function renderAudit(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش گزارش‌ها معتبر نیست.");
  }

  if (!user?.uid || user.active !== true) {
    container.replaceChildren(
      $("div", "card error-state",
        "برای مشاهده گزارش‌ها باید وارد حساب فعال خود شوید."
      )
    );
    return;
  }

  const isStaff = ["admin", "leader"].includes(user.role);

  const load = async () => {
    container.replaceChildren(
      $("p", "loading-state", "در حال دریافت گزارش‌ها...")
    );

    try {
      const logs = isStaff
        ? await getAuditHistory(user, 200)
        : await getUserAuditHistory(user.uid, user, 200);

      const records = Array.isArray(logs) ? logs : [];

      const page = $("div", "audit-page");

      const header = $("section", "card audit-header");

      header.append(
        $("h1", "card-title", "تاریخچه اقدامات"),
        $("p", "section-description",
          isStaff
            ? "گزارش اقدامات ثبت‌شده در کلن"
            : "گزارش اقداماتی که به حساب شما مربوط هستند"
        ),
        $("p", "audit-count", `تعداد گزارش‌ها: ${records.length}`)
      );

      page.appendChild(header);

      const list = $("section", "audit-list");

      if (!records.length) {
        list.appendChild(
          $("div", "card empty-state",
            "گزارشی برای نمایش وجود ندارد."
          )
        );
      } else {
        records.forEach(item => {
          list.appendChild(createAuditCard(item));
        });
      }

      page.appendChild(list);

      page.appendChild(
        makeButton("به‌روزرسانی گزارش‌ها", load)
      );

      container.replaceChildren(page);

    } catch (error) {
      console.error("Audit page error:", error);

      const errorBox = $("div", "card error-state");

      errorBox.append(
        $("p", "",
          error.message || "دریافت گزارش‌ها ناموفق بود."
        ),
        makeButton("تلاش دوباره", load)
      );

      container.replaceChildren(errorBox);
    }
  };

  await load();
}
