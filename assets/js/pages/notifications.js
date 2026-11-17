
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from "../notification-center.js";

const $ = (tag, className = "", text = "") => {
  const el = document.createElement(tag);

  if (className) el.className = className;

  if (text !== undefined && text !== null) {
    el.textContent = String(text);
  }

  return el;
};

const formatDate = value => {
  const timestamp = Number(value);

  if (!timestamp) return "زمان نامشخص";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "زمان نامشخص";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
};

function makeButton(label, className, callback) {
  const button = $("button", className, label);
  button.type = "button";
  button.addEventListener("click", callback);
  return button;
}

function notificationTitle(notification) {
  const labels = {
    application: "درخواست عضویت",
    application_update: "به‌روزرسانی درخواست",
    war: "جنگ کلن",
    war_application: "درخواست شرکت در جنگ",
    message: "پیام جدید",
    ticket: "تیکت پشتیبانی",
    announcement: "اطلاعیه جدید",
    reward: "فروشگاه جوایز",
    tournament: "تورنمنت",
    team: "تیم کلن",
    rules: "قوانین کلن",
    system: "اعلان سیستمی"
  };

  return labels[notification.type] ||
    notification.title ||
    "اعلان جدید";
}

function createNotificationCard(notification, reload) {
  const card = $("article",
    notification.read
      ? "card notification-card read"
      : "card notification-card unread"
  );

  const header = $("div", "notification-header");

  header.append(
    $("strong", "notification-title",
      notificationTitle(notification)
    ),
    $("small", "notification-date",
      formatDate(notification.createdAt)
    )
  );

  card.appendChild(header);

  card.appendChild(
    $("p", "notification-message",
      notification.message ||
      notification.body ||
      notification.description ||
      "اعلان جدیدی برای شما ثبت شده است."
    )
  );

  if (!notification.read) {
    card.appendChild(
      makeButton(
        "علامت‌گذاری به‌عنوان خوانده‌شده",
        "secondary-button",
        async () => {
          try {
            await markNotificationRead(notification.id);
            await reload();
          } catch (error) {
            alert(error.message || "به‌روزرسانی اعلان انجام نشد.");
          }
        }
      )
    );
  } else {
    card.appendChild(
      $("small", "notification-read-label", "خوانده‌شده")
    );
  }

  return card;
}

export async function renderNotifications(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش اعلان‌ها معتبر نیست.");
  }

  if (!user?.uid || user.active !== true) {
    container.replaceChildren(
      $("div", "card error-state",
        "برای مشاهده اعلان‌ها باید عضو فعال باشید."
      )
    );
    return;
  }

  const load = async () => {
    container.replaceChildren(
      $("p", "loading-state", "در حال دریافت اعلان‌ها...")
    );

    try {
      const notifications = await getNotifications(user);

      const items = Array.isArray(notifications)
        ? notifications
        : [];

      const unread = items.filter(item =>
        item.read !== true
      );

      const page = $("div", "notifications-page");

      const header = $("section", "card notifications-header");

      header.append(
        $("h1", "card-title", "مرکز اعلان‌ها"),
        $("p", "",
          `تعداد اعلان‌ها: ${items.length}`
        ),
        $("p", "",
          `خوانده‌نشده: ${unread.length}`
        )
      );

      const controls = $("div", "notification-controls");

      controls.appendChild(
        makeButton(
          "به‌روزرسانی",
          "secondary-button",
          load
        )
      );

      if (unread.length) {
        controls.appendChild(
          makeButton(
            "خواندن همه اعلان‌ها",
            "primary-button",
            async () => {
              if (!confirm("تمام اعلان‌ها خوانده‌شده علامت‌گذاری شوند؟")) {
                return;
              }

              try {
                await markAllNotificationsRead(user);
                await load();
              } catch (error) {
                alert(error.message || "عملیات انجام نشد.");
              }
            }
          )
        );
      }

      header.appendChild(controls);
      page.appendChild(header);

      const list = $("section", "notification-list");

      if (!items.length) {
        list.appendChild(
          $("div", "card empty-state",
            "در حال حاضر اعلانی برای شما ثبت نشده است."
          )
        );
      } else {
        items
          .slice()
          .sort((a, b) =>
            Number(b.createdAt || 0) -
            Number(a.createdAt || 0)
          )
          .forEach(notification => {
            list.appendChild(
              createNotificationCard(notification, load)
            );
          });
      }

      page.appendChild(list);
      container.replaceChildren(page);

    } catch (error) {
      console.error("Notifications page error:", error);

      const box = $("div", "card error-state");

      box.append(
        $("p", "",
          error.message || "دریافت اعلان‌ها با خطا مواجه شد."
        ),
        makeButton("تلاش دوباره", "secondary-button", load)
      );

      container.replaceChildren(box);
    }
  };

  await load();
    }
  
