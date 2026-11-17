
import {
  createReward,
  getRewards,
  updateReward,
  setRewardActive,
  requestReward,
  getRewardRequests,
  getMyRewardRequests,
  reviewRewardRequest,
  deleteReward
} from "../rewards.js";

import { readData } from "../database.js";

const $ = (tag, className = "", text = "") => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) {
    el.textContent = String(text);
  }
  return el;
};

const isStaff = user =>
  user?.active === true &&
  ["admin", "leader"].includes(user.role);

const isAdmin = user =>
  user?.active === true &&
  user.role === "admin";

function button(text, className, callback) {
  const el = $("button", className, text);
  el.type = "button";
  el.addEventListener("click", callback);
  return el;
}

function field(label, control) {
  const wrapper = $("label", "reward-field");
  wrapper.append($("span", "", label), control);
  return wrapper;
}

function input(type, placeholder = "") {
  const el = $("input", "reward-input");
  el.type = type;
  el.placeholder = placeholder;
  return el;
}

function message(container, text, type = "info") {
  container.prepend(
    $("div", `card reward-message ${type}`, text)
  );
}

function formatDate(value) {
  const date = new Date(Number(value));

  if (!Number.isFinite(date.getTime())) {
    return "نامشخص";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function statusLabel(status) {
  const labels = {
    pending: "در انتظار بررسی",
    approved: "تأیید شده",
    rejected: "رد شده",
    delivered: "تحویل داده شده"
  };

  return labels[status] || status || "نامشخص";
}

async function loadBalance(user) {
  const value = await readData(`pointBalances/${user.uid}`);

  if (typeof value === "number") return value;

  if (value && typeof value === "object") {
    return Number(value.balance) || 0;
  }

  return 0;
}

function createRewardForm(container, user, reload) {
  if (!isStaff(user)) return;

  const card = $("section", "card reward-form-card");
  card.appendChild(
    $("h2", "card-title", "افزودن جایزه جدید")
  );

  const title = input("text", "نام جایزه");
  title.maxLength = 80;

  const description = $("textarea", "reward-input");
  description.placeholder = "توضیحات جایزه";
  description.maxLength = 500;

  const cost = input("number", "هزینه با امتیاز");
  cost.min = "1";
  cost.max = "1000000";

  const stock = input("number", "تعداد موجودی");
  stock.min = "0";
  stock.max = "10000";
  stock.value = "1";

  const form = $("form", "reward-form");

  form.append(
    field("نام جایزه", title),
    field("توضیحات", description),
    field("هزینه امتیازی", cost),
    field("موجودی", stock)
  );

  const submit = $("button", "primary-button", "ثبت جایزه");
  submit.type = "submit";
  form.appendChild(submit);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    submit.disabled = true;

    try {
      await createReward({
        title: title.value,
        description: description.value,
        cost: Number(cost.value),
        stock: Number(stock.value)
      }, user);

      message(card, "جایزه با موفقیت ثبت شد.", "success");
      form.reset();
      stock.value = "1";
      await reload();

    } catch (error) {
      message(card, error.message, "error");
    } finally {
      submit.disabled = false;
    }
  });

  card.appendChild(form);
  container.appendChild(card);
}

function createRewardCard(reward, user, reload) {
  const card = $("article", "card reward-card");

  const header = $("div", "reward-card-header");

  header.append(
    $("h3", "card-title", reward.title || "جایزه"),
    $("span", "reward-cost", `${Number(reward.cost) || 0} امتیاز`)
  );

  card.appendChild(header);

  card.append(
    $("p", "reward-description",
      reward.description || "بدون توضیحات"
    ),
    $("p", "reward-stock",
      `موجودی: ${Number(reward.stock) || 0}`
    )
  );

  if (reward.active !== true) {
    card.appendChild(
      $("span", "reward-badge inactive", "غیرفعال")
    );
  }

  if (reward.active === true && Number(reward.stock) > 0) {
    card.appendChild(
      button("درخواست این جایزه", "primary-button", async () => {
        try {
          await requestReward(reward.id, user);
          message(card, "درخواست شما ثبت شد.", "success");
          await reload();
        } catch (error) {
          message(card, error.message, "error");
        }
      })
    );
  } else {
    card.appendChild(
      $("p", "reward-unavailable",
        reward.active !== true
          ? "این جایزه غیرفعال است."
          : "موجودی این جایزه تمام شده است."
      )
    );
  }

  if (isStaff(user)) {
    const controls = $("div", "reward-controls");

    controls.appendChild(
      button("ویرایش", "secondary-button", async () => {
        const title = prompt("نام جایزه:", reward.title || "");
        if (title === null) return;

        const description = prompt(
          "توضیحات:",
          reward.description || ""
        );
        if (description === null) return;

        const cost = prompt(
          "هزینه امتیازی:",
          String(reward.cost)
        );
        if (cost === null) return;

        const stock = prompt(
          "موجودی:",
          String(reward.stock)
        );
        if (stock === null) return;

        try {
          await updateReward(reward.id, {
            title,
            description,
            cost: Number(cost),
            stock: Number(stock)
          }, user);

          await reload();
        } catch (error) {
          message(card, error.message, "error");
        }
      })
    );

    controls.appendChild(
      button(
        reward.active === true ? "غیرفعال‌کردن" : "فعال‌کردن",
        "secondary-button",
        async () => {
          try {
            await setRewardActive(
              reward.id,
              reward.active !== true,
              user
            );
            await reload();
          } catch (error) {
            message(card, error.message, "error");
          }
        }
      )
    );

    if (isAdmin(user)) {
      controls.appendChild(
        button("حذف جایزه", "danger-button", async () => {
          if (!confirm("این جایزه حذف شود؟")) return;

          try {
            await deleteReward(reward.id, user);
            await reload();
          } catch (error) {
            message(card, error.message, "error");
          }
        })
      );
    }

    card.appendChild(controls);
  }

  return card;
}

function createRequestCard(request, user, reload) {
  const card = $("article", "card reward-request-card");

  card.append(
    $("h3", "card-title", request.rewardTitle || "درخواست جایزه"),
    $("p", "", `عضو: ${request.memberUid || "نامشخص"}`),
    $("p", "", `هزینه: ${Number(request.cost) || 0} امتیاز`),
    $("p", "", `تاریخ: ${formatDate(request.requestedAt)}`),
    $("p", "", `وضعیت: ${statusLabel(request.status)}`)
  );

  if (request.reviewNote) {
    card.appendChild(
      $("p", "reward-review-note", `توضیحات بررسی: ${request.reviewNote}`)
    );
  }

  if (isAdmin(user) && request.status === "pending") {
    const controls = $("div", "reward-controls");

    controls.appendChild(
      button("تأیید درخواست", "primary-button", async () => {
        const note = prompt("توضیحات (اختیاری):", "");
        if (note === null) return;

        try {
          await reviewRewardRequest(
            request.id,
            "approved",
            user,
            note
          );

          message(card, "درخواست تأیید شد.", "success");
          await reload();
        } catch (error) {
          message(card, error.message, "error");
        }
      })
    );

    controls.appendChild(
      button("رد درخواست", "danger-button", async () => {
        const note = prompt("دلیل رد درخواست:", "");
        if (note === null) return;

        try {
          await reviewRewardRequest(
            request.id,
            "rejected",
            user,
            note
          );

          message(card, "درخواست رد شد.", "success");
          await reload();
        } catch (error) {
          message(card, error.message, "error");
        }
      })
    );

    card.appendChild(controls);
  }

  return card;
}

export async function renderRewards(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش فروشگاه معتبر نیست.");
  }

  container.replaceChildren(
    $("p", "loading-state", "در حال بارگذاری فروشگاه...")
  );

  try {
    const [rewards, myRequests, balance] = await Promise.all([
      getRewards(isStaff(user), isStaff(user) ? user : null),
      getMyRewardRequests(user),
      loadBalance(user)
    ]);

    let staffRequests = [];

    if (isStaff(user)) {
      staffRequests = await getRewardRequests(user);
    }

    const content = $("div", "rewards-page");

    const header = $("section", "card rewards-header");

    header.append(
      $("h2", "card-title", "فروشگاه جوایز INVICTUS"),
      $("p", "", "امتیازهایت را برای دریافت جوایز خرج کن."),
      $("div", "reward-balance", `موجودی امتیاز شما: ${balance}`)
    );

    content.appendChild(header);

    createRewardForm(
      content,
      user,
      () => renderRewards(container, user)
    );

    const shopSection = $("section", "rewards-section");
    shopSection.appendChild(
      $("h2", "section-title", "جوایز فروشگاه")
    );

    const search = input("search", "جستجوی جایزه...");
    shopSection.appendChild(search);

    const rewardList = $("div", "rewards-list");
    shopSection.appendChild(rewardList);

    function updateRewards() {
      const term = search.value.trim().toLocaleLowerCase();

      const filtered = rewards.filter(reward =>
        (reward.title || "").toLocaleLowerCase().includes(term) ||
        (reward.description || "").toLocaleLowerCase().includes(term)
      );

      rewardList.replaceChildren();

      if (!filtered.length) {
        rewardList.appendChild(
          $("div", "card empty-state", "جایزه‌ای پیدا نشد.")
        );
        return;
      }

      filtered.forEach(reward => {
        rewardList.appendChild(
          createRewardCard(
            reward,
            user,
            () => renderRewards(container, user)
          )
        );
      });
    }

    search.addEventListener("input", updateRewards);
    updateRewards();

    content.appendChild(shopSection);

    const mySection = $("section", "rewards-section");

    mySection.appendChild(
      $("h2", "section-title", "درخواست‌های من")
    );

    if (!myRequests.length) {
      mySection.appendChild(
        $("div", "card empty-state", "هنوز درخواستی ثبت نکرده‌اید.")
      );
    } else {
      myRequests.forEach(request => {
        mySection.appendChild(
          createRequestCard(request, user, () =>
            renderRewards(container, user)
          )
        );
      });
    }

    content.appendChild(mySection);

    if (isStaff(user)) {
      const requestsSection = $("section", "rewards-section");

      requestsSection.appendChild(
        $("h2", "section-title", "درخواست‌های اعضا")
      );

      if (!staffRequests.length) {
        requestsSection.appendChild(
          $("div", "card empty-state", "درخواستی برای نمایش وجود ندارد.")
        );
      } else {
        staffRequests.forEach(request => {
          requestsSection.appendChild(
            createRequestCard(request, user, () =>
              renderRewards(container, user)
            )
          );
        });
      }

      content.appendChild(requestsSection);
    }

    container.replaceChildren(content);

  } catch (error) {
    console.error("Rewards page error:", error);

    const card = $("section", "card error-state");

    card.append(
      $("p", "", error.message || "بارگذاری فروشگاه ناموفق بود."),
      button("تلاش دوباره", "secondary-button", () =>
        renderRewards(container, user)
      )
    );

    container.replaceChildren(card);
  }
}
