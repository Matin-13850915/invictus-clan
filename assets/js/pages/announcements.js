
import { getAnnouncements } from "../announcements.js";

function element(tag, className, text) {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }

  if (text !== undefined && text !== null) {
    node.textContent = String(text);
  }

  return node;
}

function formatDate(timestamp) {
  if (
    !Number.isFinite(Number(timestamp)) ||
    Number(timestamp) <= 0
  ) {
    return "تاریخ نامشخص";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(Number(timestamp)));
}

function createAnnouncementCard(item) {
  const card = element("article", "card announcement-card");

  const header = element("div", "announcement-header");

  const title = element(
    "h2",
    "card-title",
    item.title || "بدون عنوان"
  );

  header.appendChild(title);

  if (item.pinned === true) {
    header.appendChild(
      element(
        "span",
        "announcement-pinned",
        "سنجاق‌شده"
      )
    );
  }

  const body = element(
    "p",
    "announcement-body",
    item.body || "متنی برای این اطلاعیه ثبت نشده است."
  );

  const metadata = element("div", "announcement-meta");

  metadata.append(
    element(
      "span",
      "",
      `نویسنده: ${item.authorName || "مدیریت"}`
    ),
    element(
      "span",
      "",
      formatDate(item.createdAt)
    )
  );

  card.append(header, body, metadata);

  if (
    item.updatedAt &&
    item.updatedAt > item.createdAt
  ) {
    card.appendChild(
      element(
        "small",
        "announcement-updated",
        `آخرین ویرایش: ${formatDate(item.updatedAt)}`
      )
    );
  }

  return card;
}

export async function renderAnnouncements(container) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش اطلاعیه‌ها معتبر نیست.");
  }

  container.replaceChildren(
    element(
      "p",
      "loading-state",
      "در حال دریافت اطلاعیه‌ها..."
    )
  );

  try {
    const announcements = await getAnnouncements();

    const fragment = document.createDocumentFragment();

    const heading = element("section", "card");

    heading.append(
      element(
        "h2",
        "card-title",
        "اطلاعیه‌های INVICTUS"
      ),
      element(
        "p",
        "",
        "آخرین اخبار و اطلاعیه‌های رسمی کلن"
      )
    );

    fragment.appendChild(heading);

    if (!announcements.length) {
      fragment.appendChild(
        element(
          "section",
          "card empty-state",
          "در حال حاضر اطلاعیه‌ای منتشر نشده است."
        )
      );

      container.replaceChildren(fragment);
      return;
    }

    const pinned = announcements.filter(
      item => item.pinned === true
    );

    const normal = announcements.filter(
      item => item.pinned !== true
    );

    const list = element(
      "div",
      "announcements-list"
    );

    for (const item of [...pinned, ...normal]) {
      list.appendChild(
        createAnnouncementCard(item)
      );
    }

    fragment.appendChild(list);

    container.replaceChildren(fragment);

  } catch (error) {
    console.error(
      "Announcements loading failed:",
      error
    );

    const errorCard = element(
      "section",
      "card error-state",
      error?.message || "دریافت اطلاعیه‌ها ناموفق بود."
    );

    const retry = element(
      "button",
      "secondary-button",
      "تلاش دوباره"
    );

    retry.type = "button";

    retry.addEventListener("click", () => {
      renderAnnouncements(container);
    });

    errorCard.appendChild(retry);

    container.replaceChildren(errorCard);
  }
}
  
