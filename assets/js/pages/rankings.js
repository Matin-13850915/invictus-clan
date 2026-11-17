
import { getRankings } from "../rankings.js";

function el(tag, className, text) {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;

  return node;
}

function createPlayerCard(player, index) {
  const card = el("article", "card ranking-card");

  const header = el("div", "ranking-player-info");

  header.append(
    el("strong", "", `رتبه ${index + 1} ـ ${player.displayName || "عضو کلن"}`),
    el("small", "", `شناسه: ${player.uid}`)
  );

  const stats = el("div", "ranking-stats");

  stats.append(
    el("span", "", `امتیاز کل: ${player.points}`),
    el("span", "", `امتیاز دستی: ${player.manualPoints}`),
    el("span", "", `امتیاز عملکرد: ${player.automaticPoints}`),
    el("span", "", `برد: ${player.wins}`),
    el("span", "", `باخت: ${player.losses}`),
    el("span", "", `مساوی: ${player.draws}`)
  );

  card.append(header, stats);

  return card;
}

export async function renderRankings(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش رتبه‌بندی معتبر نیست.");
  }

  container.replaceChildren(
    el("p", "loading-state", "در حال دریافت رتبه‌بندی...")
  );

  try {
    const rankings = await getRankings("current");

    const fragment = document.createDocumentFragment();

    fragment.appendChild(
      el("section", "card",
        "جدول رتبه‌بندی اعضای INVICTUS"
      )
    );

    const sort = document.createElement("select");
    sort.className = "ranking-filter";
    sort.setAttribute("aria-label", "ترتیب رتبه‌بندی");

    [
      ["points", "بیشترین امتیاز"],
      ["wins", "بیشترین برد"],
      ["losses", "کمترین باخت"]
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      sort.appendChild(option);
    });

    fragment.appendChild(sort);

    const summary = el("p", "ranking-count", "");
    fragment.appendChild(summary);

    const list = el("div", "rankings-list");

    function updateList() {
      const sorted = [...rankings];

      sorted.sort((a, b) => {
        if (sort.value === "wins") return b.wins - a.wins;
        if (sort.value === "losses") return a.losses - b.losses;
        return b.points - a.points;
      });

      list.replaceChildren();

      summary.textContent = `تعداد اعضا: ${sorted.length}`;

      if (!sorted.length) {
        list.appendChild(
          el("section", "card empty-state", "هنوز اطلاعات رتبه‌بندی ثبت نشده است.")
        );
        return;
      }

      sorted.forEach((player, index) => {
        list.appendChild(createPlayerCard(player, index));
      });
    }

    sort.addEventListener("change", updateList);
    updateList();

    fragment.appendChild(list);

    container.replaceChildren(fragment);
  } catch (error) {
    console.error("Rankings loading failed:", error);

    const errorCard = el(
      "section",
      "card error-state",
      "دریافت رتبه‌بندی ناموفق بود."
    );

    const retry = el("button", "secondary-button", "تلاش دوباره");
    retry.type = "button";
    retry.addEventListener("click", () => renderRankings(container, user));

    errorCard.appendChild(retry);
    container.replaceChildren(errorCard);
  }
      }
