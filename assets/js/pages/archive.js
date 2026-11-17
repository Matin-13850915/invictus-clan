
import {
  getAnnouncements,
  restoreAnnouncement
} from "../announcements.js";

import {
  getWars,
  restoreWar
} from "../wars.js";

import {
  getTournaments
} from "../tournaments.js";

import {
  getSeasons
} from "../seasons.js";

const $ = (tag, className = "", text = "") => {
  const element = document.createElement(tag);

  if (className) element.className = className;

  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }

  return element;
};

const isManager = user =>
  user?.active === true &&
  ["admin", "leader"].includes(user.role);

const formatDate = value => {
  const timestamp = Number(value);

  if (!timestamp) return "نامشخص";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "نامشخص";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
};

function createButton(label, className, callback) {
  const button = $("button", className, label);
  button.type = "button";
  button.addEventListener("click", callback);
  return button;
}

function createSection(title, count) {
  const wrapper = $("section", "archive-section");

  const heading = $("div", "archive-section-heading");

  heading.append(
    $("h2", "section-title", title),
    $("span", "archive-count", count)
  );

  wrapper.appendChild(heading);

  return wrapper;
}

function createEmpty(text) {
  return $("div", "card empty-state", text);
}

function createArchiveCard({
  title,
  category,
  description,
  date,
  details = [],
  actions = []
}) {
  const card = $("article", "card archive-card");

  const header = $("div", "archive-card-header");

  header.append(
    $("h3", "card-title", title || "بدون عنوان"),
    $("span", "archive-category", category)
  );

  card.appendChild(header);

  if (description) {
    card.appendChild(
      $("p", "archive-description", description)
    );
  }

  const metadata = $("div", "archive-metadata");

  metadata.appendChild(
    $("span", "", `تاریخ: ${formatDate(date)}`)
  );

  details.forEach(detail => {
    metadata.appendChild(
      $("span", "", detail)
    );
  });

  card.appendChild(metadata);

  if (actions.length) {
    const actionArea = $("div", "archive-actions");

    actions.forEach(action => {
      actionArea.appendChild(action);
    });

    card.appendChild(actionArea);
  }

  return card;
}

function renderAnnouncements(items, user, reload) {
  const archived = items.filter(item =>
    item.archived === true
  );

  const wrapper = createSection(
    "اطلاعیه‌های بایگانی‌شده",
    archived.length
  );

  if (!archived.length) {
    wrapper.appendChild(
      createEmpty("اطلاعیه بایگانی‌شده‌ای وجود ندارد.")
    );
    return wrapper;
  }

  archived.forEach(item => {
    const actions = [];

    actions.push(
      createButton(
        "بازگردانی اطلاعیه",
        "secondary-button",
        async () => {
          if (!confirm("این اطلاعیه به بخش اطلاعیه‌ها بازگردد؟")) {
            return;
          }

          try {
            await restoreAnnouncement(item.id, user);
            await reload();
          } catch (error) {
            alert(error.message || "بازگردانی اطلاعیه انجام نشد.");
          }
        }
      )
    );

    wrapper.appendChild(
      createArchiveCard({
        title: item.title,
        category: "اطلاعیه",
        description: item.body,
        date: item.archivedAt || item.updatedAt || item.createdAt,
        details: [
          item.authorName
            ? `نویسنده: ${item.authorName}`
            : ""
        ].filter(Boolean),
        actions
      })
    );
  });

  return wrapper;
}

function renderWars(items, user, reload) {
  const archived = items.filter(item =>
    item.archived === true
  );

  const wrapper = createSection(
    "جنگ‌های بایگانی‌شده",
    archived.length
  );

  if (!archived.length) {
    wrapper.appendChild(
      createEmpty("جنگ بایگانی‌شده‌ای وجود ندارد.")
    );
    return wrapper;
  }

  archived.forEach(war => {
    const resultLabels = {
      pending: "در انتظار نتیجه",
      win: "برد",
      loss: "باخت",
      draw: "مساوی",
      cancelled: "لغوشده"
    };

    const actions = [
      createButton(
        "بازگردانی جنگ",
        "secondary-button",
        async () => {
          if (!confirm("این جنگ از آرشیو خارج شود؟")) {
            return;
          }

          try {
            await restoreWar(war.id, user);
            await reload();
          } catch (error) {
            alert(error.message || "بازگردانی جنگ انجام نشد.");
          }
        }
      )
    ];

    wrapper.appendChild(
      createArchiveCard({
        title: `جنگ با ${war.opponent || "حریف نامشخص"}`,
        category: war.type || "جنگ",
        description: war.description,
        date: war.date,
        details: [
          `نتیجه: ${resultLabels[war.result] || "نامشخص"}`,
          `تعداد شرکت‌کنندگان: ${Object.keys(war.participants || {}).length}`,
          war.winner ? `برنده: ${war.winner}` : ""
        ].filter(Boolean),
        actions
      })
    );
  });

  return wrapper;
}

function renderTournaments(items) {
  const archived = items.filter(item =>
    item.archived === true
  );

  const wrapper = createSection(
    "تورنمنت‌های بایگانی‌شده",
    archived.length
  );

  if (!archived.length) {
    wrapper.appendChild(
      createEmpty("تورنمنت بایگانی‌شده‌ای وجود ندارد.")
    );
    return wrapper;
  }

  archived.forEach(item => {
    const statusLabels = {
      registration: "در حال ثبت‌نام",
      ongoing: "در حال برگزاری",
      completed: "تکمیل‌شده",
      cancelled: "لغوشده"
    };

    wrapper.appendChild(
      createArchiveCard({
        title: item.title,
        category: item.type || "تورنمنت",
        description: item.description,
        date: item.startAt,
        details: [
          `وضعیت: ${statusLabels[item.status] || "نامشخص"}`,
          `شرکت‌کنندگان: ${Object.keys(item.participants || {}).length}`,
          item.championUid
            ? `شناسه قهرمان: ${item.championUid}`
            : ""
        ].filter(Boolean)
      })
    );
  });

  return wrapper;
}

function renderSeasons(items) {
  const archived = items.filter(item =>
    item.archived === true
  );

  const wrapper = createSection(
    "فصل‌های بایگانی‌شده",
    archived.length
  );

  if (!archived.length) {
    wrapper.appendChild(
      createEmpty("فصل بایگانی‌شده‌ای وجود ندارد.")
    );
    return wrapper;
  }

  archived.forEach(item => {
    wrapper.appendChild(
      createArchiveCard({
        title: item.name,
        category: "فصل",
        description: item.description,
        date: item.startAt,
        details: [
          `شروع: ${formatDate(item.startAt)}`,
          `پایان: ${formatDate(item.endAt)}`
        ]
      })
    );
  });

  return wrapper;
}

export async function renderArchive(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش آرشیو معتبر نیست.");
  }

  if (!isManager(user)) {
    container.replaceChildren(
      $("section", "card error-state",
        "مشاهده آرشیو مدیریتی فقط برای لیدر و ادمین مجاز است."
      )
    );
    return;
  }

  container.replaceChildren(
    $("p", "loading-state", "در حال دریافت اطلاعات آرشیو...")
  );

  const reload = () => renderArchive(container, user);

  try {
    const [
      announcements,
      wars,
      tournaments,
      seasons
    ] = await Promise.all([
      getAnnouncements({ includeArchived: true }),
      getWars({ includeArchived: true }),
      getTournaments({ includeArchived: true }, user),
      getSeasons()
    ]);

    const content = $("div", "archive-page");

    const header = $("section", "card archive-header");

    header.append(
      $("h1", "card-title", "آرشیو INVICTUS"),
      $("p", "",
        "مدیریت و مشاهده سوابق بایگانی‌شده کلن"
      )
    );

    const refresh = createButton(
      "به‌روزرسانی آرشیو",
      "secondary-button",
      reload
    );

    header.appendChild(refresh);
    content.appendChild(header);

    const allItems = [
      ...announcements.filter(item => item.archived === true),
      ...wars.filter(item => item.archived === true),
      ...tournaments.filter(item => item.archived === true),
      ...seasons.filter(item => item.archived === true)
    ];

    const summary = $("div", "statistics-grid");

    summary.append(
      $("div", "card archive-summary-card",
        `اطلاعیه‌ها: ${announcements.filter(item => item.archived === true).length}`
      ),
      $("div", "card archive-summary-card",
        `جنگ‌ها: ${wars.filter(item => item.archived === true).length}`
      ),
      $("div", "card archive-summary-card",
        `تورنمنت‌ها: ${tournaments.filter(item => item.archived === true).length}`
      ),
      $("div", "card archive-summary-card",
        `فصل‌ها: ${seasons.filter(item => item.archived === true).length}`
      )
    );

    content.appendChild(summary);

    content.append(
      renderAnnouncements(announcements, user, reload),
      renderWars(wars, user, reload),
      renderTournaments(tournaments),
      renderSeasons(seasons)
    );

    if (!allItems.length) {
      content.appendChild(
        createEmpty("هنوز موردی در آرشیو ثبت نشده است.")
      );
    }

    container.replaceChildren(content);

  } catch (error) {
    console.error("Archive page error:", error);

    const errorCard = $("section", "card error-state");

    errorCard.append(
      $("p", "",
        error.message || "دریافت آرشیو با خطا مواجه شد."
      ),
      createButton("تلاش دوباره", "secondary-button", reload)
    );

    container.replaceChildren(errorCard);
  }
}
