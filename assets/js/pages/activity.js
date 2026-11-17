
import {
  getMemberActivity,
  getMemberActivityStats,
  getRecentClanActivity,
  getMemberWarParticipation
} from "../member-activity.js";

const $ = (tag, className = "", value = "") => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = String(value ?? "");
  return el;
};

const ACTIVITY_LABELS = {
  war_participation: "شرکت در جنگ",
  war_win: "پیروزی در جنگ",
  war_loss: "شکست در جنگ",
  tournament_participation: "شرکت در تورنمنت",
  tournament_win: "قهرمانی تورنمنت",
  team_activity: "فعالیت تیمی",
  badge_received: "دریافت نشان"
};

function formatDate(value) {
  const date = new Date(Number(value));

  if (!value || Number.isNaN(date.getTime())) {
    return "زمان نامشخص";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function makeButton(label, callback) {
  const button = $("button", "secondary-button", label);
  button.type = "button";
  button.addEventListener("click", callback);
  return button;
}

function createActivityCard(activity) {
  const card = $("article", "card activity-card");

  card.append(
    $("strong", "activity-type",
      ACTIVITY_LABELS[activity.type] || "فعالیت ثبت‌شده"
    ),
    $("p", "activity-description",
      activity.description || "بدون توضیحات"
    ),
    $("small", "activity-date", formatDate(activity.createdAt))
  );

  if (activity.referenceId) {
    card.appendChild(
      $("small", "activity-reference",
        `شناسه مرجع: ${activity.referenceId}`
      )
    );
  }

  return card;
}

function createStat(label, value) {
  const card = $("div", "card activity-stat");

  card.append(
    $("span", "stat-label", label),
    $("strong", "stat-value", value)
  );

  return card;
}

export async function renderActivity(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش سوابق معتبر نیست.");
  }

  if (!user?.uid || user.active !== true) {
    container.replaceChildren(
      $("div", "card error-state",
        "برای مشاهده سوابق باید وارد حساب فعال خود شوید."
      )
    );
    return;
  }

  const isStaff = ["admin", "leader"].includes(user.role);

  const load = async () => {
    container.replaceChildren(
      $("p", "loading-state", "در حال دریافت سوابق فعالیت...")
    );

    try {
      const [activities, warStats] = await Promise.all([
        getMemberActivity(user.uid, user),
        getMemberWarParticipation(user.uid, user)
      ]);

      const page = $("div", "activity-page");

      const header = $("section", "card activity-header");

      header.append(
        $("h1", "card-title", "سوابق فعالیت من"),
        $("p", "section-description",
          "تاریخچه مشارکت‌ها و فعالیت‌های ثبت‌شده شما در کلن"
        )
      );

      page.appendChild(header);

      const stats = $("section", "activity-stats");

      stats.append(
        createStat("کل فعالیت‌ها", activities.length),
        createStat("شرکت در جنگ", warStats.total),
        createStat("پیروزی", warStats.wins),
        createStat("شکست", warStats.losses)
      );

      page.appendChild(stats);

      const history = $("section", "activity-history");

      history.appendChild(
        $("h2", "section-title", "تاریخچه فعالیت‌ها")
      );

      if (!activities.length) {
        history.appendChild(
          $("div", "card empty-state",
            "هنوز فعالیتی برای حساب شما ثبت نشده است."
          )
        );
      } else {
        activities.forEach(activity => {
          history.appendChild(createActivityCard(activity));
        });
      }

      page.appendChild(history);

      if (isStaff) {
        const staffSection = $("section", "card staff-activity-section");

        staffSection.append(
          $("h2", "section-title", "آمار فعالیت اعضای کلن"),
          $("p", "section-description",
            "این بخش فقط برای ادمین و لیدر قابل مشاهده است."
          )
        );

        const staffActions = $("div", "activity-staff-actions");

        staffActions.appendChild(
          makeButton("مشاهده آمار اعضا", async () => {
            try {
              const summaries = await getMemberActivityStats(user);
              const users = await getRecentClanActivity(user, 30);

              const result = $("div", "card activity-report");

              result.appendChild(
                $("h3", "section-title", "گزارش فعالیت اعضا")
              );

              if (!summaries.length) {
                result.appendChild(
                  $("p", "empty-state", "هنوز آماری ثبت نشده است.")
                );
              } else {
                summaries.forEach(item => {
                  const row = $("article", "activity-member-row");

                  row.append(
                    $("strong", "", `UID: ${item.uid}`),
                    $("p", "", `کل فعالیت‌ها: ${item.totalActivities}`),
                    $("p", "", `جنگ‌ها: ${item.wars}`),
                    $("p", "", `بردها: ${item.wins}`),
                    $("p", "", `باخت‌ها: ${item.losses}`),
                    $("p", "", `تورنمنت‌ها: ${item.tournaments}`),
                    $("p", "", `قهرمانی‌ها: ${item.tournamentWins}`),
                    $("p", "", `نشان‌ها: ${item.badges}`)
                  );

                  result.appendChild(row);
                });
              }

              result.appendChild(
                $("h3", "section-title", "۳۰ فعالیت اخیر کلن")
              );

              if (!users.length) {
                result.appendChild(
                  $("p", "empty-state", "فعالیت اخیری وجود ندارد.")
                );
              } else {
                users.forEach(item => {
                  result.appendChild(createActivityCard(item));
                });
              }

              staffSection.querySelector(".activity-report")?.remove();
              staffSection.appendChild(result);

            } catch (error) {
              alert(error.message || "دریافت گزارش انجام نشد.");
            }
          })
        );

        staffSection.appendChild(staffActions);
        page.appendChild(staffSection);
      }

      page.appendChild(
        makeButton("به‌روزرسانی سوابق", load)
      );

      container.replaceChildren(page);

    } catch (error) {
      console.error("Activity page error:", error);

      const errorBox = $("div", "card error-state");

      errorBox.append(
        $("p", "",
          error.message || "دریافت سوابق با خطا مواجه شد."
        ),
        makeButton("تلاش دوباره", load)
      );

      container.replaceChildren(errorBox);
    }
  };

  await load();
  }
        
