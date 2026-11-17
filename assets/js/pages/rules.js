
import {
  getCurrentRules,
  publishRules,
  hasAcceptedCurrentRules,
  acceptCurrentRules,
  getRulesHistory
} from "../rules.js";

const $ = (tag, className = "", text = "") => {
  const el = document.createElement(tag);

  if (className) el.className = className;

  if (text !== undefined && text !== null) {
    el.textContent = String(text);
  }

  return el;
};

const isManager = user =>
  user?.active === true &&
  ["admin", "leader"].includes(user.role);

function button(text, className, callback) {
  const el = $("button", className, text);
  el.type = "button";
  el.addEventListener("click", callback);
  return el;
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

function message(container, text, type = "info") {
  container.prepend(
    $("div", `card rules-message ${type}`, text)
  );
}

function createPublishForm(container, user, reload) {
  if (!isManager(user)) return;

  const card = $("section", "card rules-publish-card");

  card.appendChild(
    $("h2", "card-title", "انتشار نسخه جدید قوانین")
  );

  const importantWrapper = $("label", "rules-checkbox");

  const important = $("input");
  important.type = "checkbox";

  importantWrapper.append(
    important,
    $("span", "", "این تغییر مهم است و اعضا باید دوباره قوانین را تأیید کنند.")
  );

  const content = $("textarea", "rules-editor");
  content.placeholder = "متن کامل قوانین جدید را وارد کنید...";
  content.maxLength = 30000;
  content.rows = 12;

  const submit = $("button", "primary-button", "انتشار قوانین");
  submit.type = "button";

  submit.addEventListener("click", async () => {
    if (!content.value.trim()) {
      message(card, "متن قوانین نمی‌تواند خالی باشد.", "error");
      return;
    }

    const confirmation = confirm(
      "نسخه جدید قوانین منتشر شود؟ اعضا باید نسخه جدید را تأیید کنند."
    );

    if (!confirmation) return;

    submit.disabled = true;
    submit.textContent = "در حال انتشار...";

    try {
      await publishRules(
        content.value,
        important.checked,
        user
      );

      message(card, "نسخه جدید قوانین منتشر شد.", "success");
      content.value = "";
      important.checked = false;

      await reload();

    } catch (error) {
      message(card, error.message, "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "انتشار قوانین";
    }
  });

  card.append(
    importantWrapper,
    content,
    submit
  );

  container.appendChild(card);
}

function createCurrentRulesCard(rules, accepted, user, reload) {
  const card = $("section", "card current-rules-card");

  const heading = $("div", "rules-heading");

  heading.append(
    $("h2", "card-title", rules?.title || "قوانین کلن"),
    $("span", "rules-version", `نسخه ${rules?.version || 0}`)
  );

  card.appendChild(heading);

  if (!rules?.version) {
    card.appendChild(
      $("p", "empty-state", "هنوز قانونی منتشر نشده است.")
    );

    return card;
  }

  card.append(
    $("p", "rules-date",
      `تاریخ انتشار: ${formatDate(rules.publishedAt || rules.createdAt)}`
    ),
    $("div", "rules-content", rules.content || "")
  );

  if (rules.important === true) {
    card.appendChild(
      $("p", "rules-important",
        "این نسخه به‌عنوان تغییر مهم منتشر شده است."
      )
    );
  }

  const acceptance = $("div", "rules-acceptance");

  if (accepted) {
    acceptance.appendChild(
      $("p", "rules-accepted", "شما این نسخه از قوانین را تأیید کرده‌اید.")
    );
  } else {
    acceptance.appendChild(
      $("p", "rules-not-accepted",
        "برای ادامه فعالیت، باید نسخه فعلی قوانین را تأیید کنید."
      )
    );

    acceptance.appendChild(
      button("قوانین را خواندم و می‌پذیرم", "primary-button", async () => {
        const confirmed = confirm(
          "تأیید می‌کنی که قوانین را مطالعه کرده‌ای و می‌پذیری؟"
        );

        if (!confirmed) return;

        try {
          await acceptCurrentRules(user);
          message(card, "تأیید قوانین ثبت شد.", "success");
          await reload();
        } catch (error) {
          message(card, error.message, "error");
        }
      })
    );
  }

  card.appendChild(acceptance);

  return card;
}

function createHistorySection(history) {
  const section = $("section", "rules-history-section");

  section.appendChild(
    $("h2", "section-title", "تاریخچه نسخه‌های قوانین")
  );

  if (!history.length) {
    section.appendChild(
      $("div", "card empty-state", "تاریخچه‌ای ثبت نشده است.")
    );

    return section;
  }

  history.forEach(item => {
    const card = $("article", "card rules-history-card");

    card.append(
      $("h3", "card-title",
        `${item.title || "قوانین کلن"} · نسخه ${item.version || "؟"}`
      ),
      $("p", "rules-date",
        `انتشار: ${formatDate(item.publishedAt || item.createdAt)}`
      ),
      $("p", "rules-history-preview",
        (item.content || "").slice(0, 250)
      )
    );

    if ((item.content || "").length > 250) {
      const more = button(
        "نمایش متن کامل",
        "secondary-button",
        () => {
          const full = $("div", "rules-content", item.content);
          card.appendChild(full);
          more.remove();
        }
      );

      card.appendChild(more);
    }

    section.appendChild(card);
  });

  return section;
}

export async function renderRules(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش قوانین معتبر نیست.");
  }

  container.replaceChildren(
    $("p", "loading-state", "در حال دریافت قوانین...")
  );

  try {
    const [rules, accepted] = await Promise.all([
      getCurrentRules(user),
      hasAcceptedCurrentRules(user)
    ]);

    const content = $("div", "rules-page");

    const header = $("section", "card rules-header");

    header.append(
      $("h2", "card-title", "قوانین و مقررات INVICTUS"),
      $("p", "", "قوانین کلن را مطالعه کن تا همه اعضا با نظم و احترام کنار یکدیگر فعالیت کنند.")
    );

    content.appendChild(header);

    content.appendChild(
      createCurrentRulesCard(
        rules,
        accepted,
        user,
        () => renderRules(container, user)
      )
    );

    createPublishForm(
      content,
      user,
      () => renderRules(container, user)
    );

    if (isManager(user)) {
      const historySection = $("section", "rules-history-section");

      historySection.appendChild(
        $("h2", "section-title", "تاریخچه انتشار")
      );

      try {
        const history = await getRulesHistory(user);

        const historyContent = createHistorySection(history);

        historyContent.querySelectorAll(".section-title").forEach(
          heading => heading.remove()
        );

        historySection.appendChild(historyContent);

      } catch (error) {
        historySection.appendChild(
          $("p", "error-state", error.message)
        );
      }

      content.appendChild(historySection);
    }

    container.replaceChildren(content);

  } catch (error) {
    console.error("Rules page error:", error);

    const card = $("section", "card error-state");

    card.append(
      $("p", "", error.message || "دریافت قوانین ناموفق بود."),
      button("تلاش دوباره", "secondary-button", () =>
        renderRules(container, user)
      )
    );

    container.replaceChildren(card);
  }
    }
    
