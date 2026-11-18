
import { getWars } from "../wars.js";

function createElement(tag, className, text) {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;

  return node;
}

function formatDate(timestamp) {
  if (!Number.isFinite(Number(timestamp)) || Number(timestamp) <= 0) {
    return "زمان ثبت نشده";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date(Number(timestamp)));
}

const RESULT_LABELS = {
  pending: "در انتظار برگزاری",
  win: "پیروزی",
  loss: "شکست",
  draw: "مساوی",
  cancelled: "لغوشده"
};

function createWarCard(war) {
  const card = createElement("article", "card war-card");

  const header = createElement("div", "war-card-header");

  header.append(
    createElement("h2", "card-title", `مقابل ${war.opponent || "حریف نامشخص"}`),
    createElement(
      "span",
      "war-type",
      war.type === "MP" ? "Multiplayer" : "Battle Royale"
    )
  );

  const result = createElement(
    "span",
    `war-result result-${war.result}`,
    RESULT_LABELS[war.result] || "نامشخص"
  );

  const details = createElement("div", "war-details");

  details.append(
    createElement("p", "", `تاریخ: ${formatDate(war.date)}`),
    createElement(
      "p",
      "",
      `تعداد بازیکنان: ${Object.keys(war.participants || {}).length}`
    )
  );

  if (war.winner) {
    details.appendChild(
      createElement("p", "", `برنده: ${war.winner}`)
    );
  }

  if (war.description) {
    details.appendChild(
      createElement("p", "war-description", war.description)
    );
  }

  card.append(header, result, details);

  return card;
}

export async function renderWars(container) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش جنگ‌ها معتبر نیست.");
  }

  container.replaceChildren(
    createElement("p", "loading-state", "در حال دریافت جنگ‌ها...")
  );

  try {
    const wars = await getWars();

    const fragment = document.createDocumentFragment();

    const heading = createElement("section", "card");

    heading.append(
      createElement("h2", "card-title", "جنگ‌های INVICTUS"),
      createElement("p", "", "برنامه مسابقات و نتایج جنگ‌های کلن")
    );

    fragment.appendChild(heading);

    const filters = createElement("section", "card war-filters");

    const typeFilter = document.createElement("select");
    typeFilter.className = "war-filter";
    typeFilter.setAttribute("aria-label", "فیلتر نوع جنگ");

    [
      ["all", "همه جنگ‌ها"],
      ["MP", "Multiplayer"],
      ["BR", "Battle Royale"]
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      typeFilter.appendChild(option);
    });

    const resultFilter = document.createElement("select");
    resultFilter.className = "war-filter";
    resultFilter.setAttribute("aria-label", "فیلتر نتیجه");

    [
      ["all", "همه نتایج"],
      ["pending", "در انتظار"],
      ["win", "پیروزی"],
      ["loss", "شکست"],
      ["draw", "مساوی"],
      ["cancelled", "لغوشده"]
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      resultFilter.appendChild(option);
    });

    filters.append(
      createElement("label", "", "نوع جنگ"),
      typeFilter,
      createElement("label", "", "نتیجه"),
      resultFilter
    );

    fragment.appendChild(filters);

    const summary = createElement(
      "p",
      "war-count",
      `تعداد جنگ‌ها: ${wars.length}`
    );

    fragment.appendChild(summary);

    const list = createElement("div", "wars-list");

    function updateList() {
      const filtered = wars.filter(war => {
        const typeMatches =
          typeFilter.value === "all" ||
          war.type === typeFilter.value;

        const resultMatches =
          resultFilter.value === "all" ||
          war.result === resultFilter.value;

        return typeMatches && resultMatches;
      });

      list.replaceChildren();

      summary.textContent = `تعداد جنگ‌های نمایش‌داده‌شده: ${filtered.length}`;

      if (!filtered.length) {
        list.appendChild(
          createElement("section", "card empty-state", "جنگی با این فیلتر پیدا نشد.")
        );
        return;
      }

      filtered.forEach(war => {
        list.appendChild(createWarCard(war));
      });
    }

    typeFilter.addEventListener("change", updateList);
    resultFilter.addEventListener("change", updateList);

    updateList();

    fragment.appendChild(list);
    container.replaceChildren(fragment);

  } catch (error) {
    console.error("Wars loading failed:", error);

    const errorCard = createElement(
      "section",
      "card error-state",
      "دریافت جنگ‌ها ناموفق بود. اتصال Firebase و دسترسی دیتابیس را بررسی کنید."
    );

    const retry = createElement("button", "secondary-button", "تلاش دوباره");
    retry.type = "button";
    retry.addEventListener("click", () => renderWars(container));

    errorCard.appendChild(retry);
    container.replaceChildren(errorCard);
  }
      }
      
