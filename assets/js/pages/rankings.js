
import { getAllRankings } from "../rankings.js";

function el(tag, className, text) {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;

  return node;
}

function createRankingRow(player, index) {
  const row = el("article", "card ranking-card");

  const position = el(
    "span",
    "ranking-position",
    `#${index + 1}`
  );

  const info = el("div", "ranking-player-info");

  info.append(
    el("strong", "", player.displayName || player.gameName || "بازیکن"),
    el("small", "", player.uid || "")
  );

  const stats = el("div", "ranking-stats");

  stats.append(
    el("span", "", `امتیاز: ${player.points}`),
    el("span", "", `برد: ${player.wins}`),
    el("span", "", `باخت: ${player.losses}`),
    el("span", "", `مساوی: ${player.draws}`)
  );

  row.append(position, info, stats);

  return row;
}

function createFilter(label, options) {
  const wrapper = el("div", "ranking-filter-group");
  const select = document.createElement("select");

  select.className = "ranking-filter";
  select.setAttribute("aria-label", label);

  options.forEach(([value, text]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  });

  wrapper.append(
    el("label", "", label),
    select
  );

  return { wrapper, select };
}

export async function renderRankings(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش رتبه‌بندی معتبر نیست.");
  }

  container.replaceChildren(
    el("p", "loading-state", "در حال دریافت رتبه‌بندی...")
  );

  try {
    const rankings = await getAllRankings(user);

    const fragment = document.createDocumentFragment();

    const heading = el("section", "card");
    heading.append(
      el("h2", "card-title", "رتبه‌بندی INVICTUS"),
      el("p", "", "جدول امتیازات و عملکرد اعضای کلن")
    );

    fragment.appendChild(heading);

    const filters = el("section", "card ranking-filters");

    const mode = createFilter("نوع رتبه‌بندی", [
      ["all", "همه"],
      ["MP", "Multiplayer"],
      ["BR", "Battle Royale"]
    ]);

    const sort = createFilter("ترتیب", [
      ["points", "بیشترین امتیاز"],
      ["wins", "بیشترین برد"],
      ["losses", "کمترین باخت"]
    ]);

    filters.append(mode.wrapper, sort.wrapper);
    fragment.appendChild(filters);

    const summary = el("p", "ranking-count", "");
    fragment.appendChild(summary);

    const list = el("div", "rankings-list");

    function updateList() {
      const selectedMode = mode.select.value;
      const selectedSort = sort.select.value;

      const filtered = rankings.filter(player => {
        if (selectedMode === "all") return true;
        return player.mode === selectedMode;
      });

      filtered.sort((a, b) => {
        if (selectedSort === "wins") {
          return b.wins - a.wins;
        }

        if (selectedSort === "losses") {
          return a.losses - b.losses;
        }

        return b.points - a.points;
      });

      list.replaceChildren();

      summary.textContent =
        `تعداد بازیکنان: ${filtered.length}`;

      if (!filtered.length) {
        list.appendChild(
          el("section", "card empty-state", "اطلاعات رتبه‌بندی موجود نیست.")
        );
        return;
      }

      filtered.forEach((player, index) => {
        list.appendChild(createRankingRow(player, index));
      });
    }

    mode.select.addEventListener("change", updateList);
    sort.select.addEventListener("change", updateList);

    updateList();

    fragment.appendChild(list);
    container.replaceChildren(fragment);

  } catch (error) {
    console.error("Rankings loading failed:", error);

    const errorCard = el(
      "section",
      "card error-state",
      "دریافت رتبه‌بندی ناموفق بود. دسترسی دیتابیس را بررسی کنید."
    );

    const retry = el("button", "secondary-button", "تلاش دوباره");
    retry.type = "button";
    retry.addEventListener("click", () => {
      renderRankings(container, user);
    });

    errorCard.appendChild(retry);
    container.replaceChildren(errorCard);
  }
      }
            
