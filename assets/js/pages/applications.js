
import {
  getApplications,
  getApplicationStatusLabel
} from "../application-tracker.js";

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);

  if (className) node.className = className;

  if (text !== undefined && text !== null) {
    node.textContent = String(text);
  }

  return node;
}

function formatDate(value) {
  if (!value) return "ثبت نشده";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "نامشخص";
  }

  return date.toLocaleString("fa-IR");
}

function createInfo(label, value) {
  const item = el("div", "application-info-item");

  item.append(
    el("small", "", label),
    el("span", "", value || "ثبت نشده")
  );

  return item;
}

function createApplicationCard(application) {
  const card = el("article", "card application-card");

  const header = el("div", "application-card-header");

  const title = el(
    "h3",
    "",
    application.gameName || "بازیکن بدون نام"
  );

  const status = el(
    "span",
    "application-status",
    getApplicationStatusLabel(application.status)
  );

  header.append(title, status);

  const details = el("div", "application-info-grid");

  details.append(
    createInfo("لول بازی", application.gameLevel),
    createInfo("نوع درخواست", application.applicationType),
    createInfo("رنک MP", application.mpRank),
    createInfo("رنک BR", application.brRank),
    createInfo("نام واقعی", application.realName),
    createInfo("ایمیل", application.email),
    createInfo("تلگرام", application.telegram),
    createInfo("روبیکا", application.rubika),
    createInfo("تاریخ ثبت", formatDate(application.createdAt)),
    createInfo("آخرین تغییر", formatDate(application.updatedAt))
  );

  const tester = el(
    "p",
    "application-tester",
    `تستر اختصاص‌یافته: ${
      application.assignedTesterUid || "هنوز تعیین نشده"
    }`
  );

  const testResult = el(
    "p",
    "application-test-result",
    `نتیجه تست: ${application.testResult || "ثبت نشده"}`
  );

  card.append(header, details, tester, testResult);

  if (application.testNote) {
    card.append(
      el(
        "p",
        "application-note",
        `یادداشت تستر: ${application.testNote}`
      )
    );
  }

  if (application.leaderNote) {
    card.append(
      el(
        "p",
        "application-note",
        `یادداشت لیدر: ${application.leaderNote}`
      )
    );
  }

  if (application.description) {
    card.append(
      el(
        "p",
        "application-description",
        application.description
      )
    );
  }

  return card;
}

export async function renderApplications(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش درخواست‌ها معتبر نیست.");
  }

  if (
    !user?.uid ||
    user.active !== true ||
    !["admin", "leader", "tester"].includes(user.role)
  ) {
    container.replaceChildren(
      el(
        "section",
        "card error-state",
        "اجازه مشاهده درخواست‌های عضویت را ندارید."
      )
    );

    return;
  }

  container.replaceChildren(
    el(
      "p",
      "loading-state",
      "در حال دریافت درخواست‌های عضویت..."
    )
  );

  try {
    const toolbar = el("div", "applications-toolbar");
    const filter = document.createElement("select");

    filter.className = "application-filter";
    filter.setAttribute(
      "aria-label",
      "فیلتر وضعیت درخواست‌ها"
    );

    const statuses = [
      ["", "همه درخواست‌ها"],
      ["pending", "در انتظار بررسی"],
      ["awaiting_tester", "در انتظار تعیین تستر"],
      ["awaiting_test", "در انتظار انجام تست"],
      ["testing", "در حال تست"],
      ["test_completed", "تست انجام شده"],
      ["awaiting_leader", "در انتظار تصمیم لیدر"],
      ["retest_requested", "تست مجدد"],
      ["accepted", "پذیرفته شده"],
      ["rejected", "رد شده"],
      ["withdrawn", "انصراف داده شده"],
      ["expired", "منقضی شده"]
    ];

    statuses.forEach(([value, label]) => {
      const option = document.createElement("option");

      option.value = value;
      option.textContent = label;

      filter.appendChild(option);
    });

    const count = el("p", "applications-count", "");
    const list = el("div", "applications-list");

    toolbar.append(filter, count);

    async function load(status = "") {
      list.replaceChildren(
        el("p", "loading-state", "در حال بارگذاری...")
      );

      try {
        const applications = await getApplications(
          user,
          status ? { status } : {}
        );

        count.textContent =
          `تعداد درخواست‌ها: ${applications.length}`;

        list.replaceChildren();

        if (!applications.length) {
          list.appendChild(
            el(
              "section",
              "card empty-state",
              "درخواستی برای نمایش وجود ندارد."
            )
          );

          return;
        }

        applications.forEach(application => {
          list.appendChild(
            createApplicationCard(application)
          );
        });

      } catch (error) {
        console.error(
          "Applications loading failed:",
          error
        );

        list.replaceChildren(
          el(
            "section",
            "card error-state",
            error.message || "دریافت درخواست‌ها ناموفق بود."
          )
        );
      }
    }

    filter.addEventListener("change", () => {
      load(filter.value);
    });

    container.replaceChildren(
      el(
        "h2",
        "page-section-title",
        "مدیریت درخواست‌های عضویت"
      ),
      toolbar,
      list
    );

    await load();

  } catch (error) {
    console.error("Applications page failed:", error);

    const errorCard = el(
      "section",
      "card error-state",
      error.message || "بارگذاری صفحه درخواست‌ها با خطا مواجه شد."
    );

    const retry = el(
      "button",
      "secondary-button",
      "تلاش دوباره"
    );

    retry.type = "button";

    retry.addEventListener("click", () => {
      renderApplications(container, user);
    });

    errorCard.appendChild(retry);
    container.replaceChildren(errorCard);
  }
}
