
import { readData } from "../database.js";
import { getRankings } from "../rankings.js";
import { getWars } from "../wars.js";
import { getTeams } from "../teams.js";
import { getTournaments } from "../tournaments.js";

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

function formatNumber(value) {
  return new Intl.NumberFormat("fa-IR").format(
    Number(value) || 0
  );
}

function formatDate(value) {
  const date = new Date(Number(value));

  if (!Number.isFinite(date.getTime())) {
    return "نامشخص";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium"
  }).format(date);
}

function statCard(title, value, description = "") {
  const card = $("article", "card statistics-card");

  card.append(
    $("p", "statistics-label", title),
    $("strong", "statistics-value", formatNumber(value))
  );

  if (description) {
    card.appendChild(
      $("p", "statistics-description", description)
    );
  }

  return card;
}

function section(title) {
  const wrapper = $("section", "statistics-section");
  wrapper.appendChild(
    $("h2", "section-title", title)
  );
  return wrapper;
}

function emptyMessage(text) {
  return $("div", "card empty-state", text);
}

function createRankingTable(rankings) {
  const wrapper = section("برترین اعضا");

  if (!rankings.length) {
    wrapper.appendChild(
      emptyMessage("هنوز رتبه‌بندی ثبت نشده است.")
    );
    return wrapper;
  }

  const table = $("div", "statistics-table");

  const header = $("div", "statistics-row statistics-table-header");

  header.append(
    $("span", "", "رتبه"),
    $("span", "", "نام عضو"),
    $("span", "", "امتیاز"),
    $("span", "", "برد")
  );

  table.appendChild(header);

  rankings.slice(0, 10).forEach(member => {
    const row = $("div", "statistics-row");

    row.append(
      $("span", "rank-position", `#${member.position}`),
      $("span", "rank-name",
        member.displayName || member.uid
      ),
      $("span", "", formatNumber(member.points)),
      $("span", "", formatNumber(member.wins))
    );

    table.appendChild(row);
  });

  wrapper.appendChild(table);
  return wrapper;
}

function createWarStatistics(wars) {
  const visibleWars = wars.filter(war =>
    war.archived !== true
  );

  const completed = visibleWars.filter(war =>
    ["win", "loss", "draw"].includes(war.result)
  );

  const wins = completed.filter(war =>
    war.result === "win"
  ).length;

  const losses = completed.filter(war =>
    war.result === "loss"
  ).length;

  const draws = completed.filter(war =>
    war.result === "draw"
  ).length;

  const pending = visibleWars.filter(war =>
    war.result === "pending"
  ).length;

  const wrapper = section("عملکرد کلن‌وار");

  const grid = $("div", "statistics-grid");

  grid.append(
    statCard("کل جنگ‌ها", visibleWars.length),
    statCard("برد", wins),
    statCard("باخت", losses),
    statCard("مساوی", draws),
    statCard("در انتظار نتیجه", pending)
  );

  const winRate = completed.length
    ? Math.round((wins / completed.length) * 100)
    : 0;

  const rate = $("div", "card statistics-rate");

  rate.append(
    $("p", "statistics-label", "درصد برد جنگ‌های ثبت‌شده"),
    $("strong", "statistics-value", `${formatNumber(winRate)}٪`)
  );

  wrapper.append(grid, rate);

  const typeCounts = {
    MP: visibleWars.filter(war => war.type === "MP").length,
    BR: visibleWars.filter(war => war.type === "BR").length
  };

  const types = $("div", "card statistics-type-breakdown");

  types.append(
    $("h3", "card-title", "تفکیک نوع جنگ"),
    $("p", "", `مولتی‌پلیر: ${formatNumber(typeCounts.MP)}`),
    $("p", "", `بتل رویال: ${formatNumber(typeCounts.BR)}`)
  );

  wrapper.appendChild(types);

  return wrapper;
}

function createMemberStatistics(users, roles) {
  const wrapper = section("آمار اعضا");

  const allUsers = users && typeof users === "object"
    ? Object.values(users)
    : [];

  const allRoles = roles && typeof roles === "object"
    ? Object.values(roles)
    : [];

  const activeUsers = allRoles.filter(user =>
    user?.active === true
  );

  const countRole = role =>
    activeUsers.filter(user => user.role === role).length;

  const grid = $("div", "statistics-grid");

  grid.append(
    statCard("کل حساب‌ها", allUsers.length),
    statCard("اعضای فعال", activeUsers.length),
    statCard("ادمین", countRole("admin")),
    statCard("لیدر", countRole("leader")),
    statCard("تستر", countRole("tester")),
    statCard("عضو عادی", countRole("member"))
  );

  wrapper.appendChild(grid);
  return wrapper;
}

function createTeamStatistics(teams) {
  const wrapper = section("آمار تیم‌ها");

  const activeTeams = teams.filter(team =>
    team.active !== false
  );

  const mp = activeTeams.filter(team =>
    team.type === "MP"
  ).length;

  const br = activeTeams.filter(team =>
    team.type === "BR"
  ).length;

  const both = activeTeams.filter(team =>
    team.type === "BOTH"
  ).length;

  const memberCount = activeTeams.reduce(
    (total, team) =>
      total + Object.keys(team.members || {}).length,
    0
  );

  const grid = $("div", "statistics-grid");

  grid.append(
    statCard("تیم‌های فعال", activeTeams.length),
    statCard("تیم MP", mp),
    statCard("تیم BR", br),
    statCard("تیم مشترک", both),
    statCard("مجموع عضویت تیمی", memberCount)
  );

  wrapper.appendChild(grid);
  return wrapper;
}

function createTournamentStatistics(tournaments) {
  const wrapper = section("آمار تورنمنت‌ها");

  const active = tournaments.filter(item =>
    item.archived !== true
  );

  const registration = active.filter(item =>
    item.status === "registration"
  ).length;

  const ongoing = active.filter(item =>
    item.status === "ongoing"
  ).length;

  const completed = active.filter(item =>
    item.status === "completed"
  ).length;

  const cancelled = active.filter(item =>
    item.status === "cancelled"
  ).length;

  const participants = active.reduce(
    (total, item) =>
      total + Object.keys(item.participants || {}).length,
    0
  );

  const grid = $("div", "statistics-grid");

  grid.append(
    statCard("کل تورنمنت‌ها", active.length),
    statCard("در حال ثبت‌نام", registration),
    statCard("در حال برگزاری", ongoing),
    statCard("تکمیل‌شده", completed),
    statCard("لغوشده", cancelled),
    statCard("مجموع ثبت‌نام‌ها", participants)
  );

  wrapper.appendChild(grid);
  return wrapper;
}

function createRankingSummary(rankings) {
  const wrapper = section("جمع‌بندی امتیازات");

  const totalPoints = rankings.reduce(
    (total, member) =>
      total + (Number(member.points) || 0),
    0
  );

  const totalWins = rankings.reduce(
    (total, member) =>
      total + (Number(member.wins) || 0),
    0
  );

  const totalLosses = rankings.reduce(
    (total, member) =>
      total + (Number(member.losses) || 0),
    0
  );

  const totalDraws = rankings.reduce(
    (total, member) =>
      total + (Number(member.draws) || 0),
    0
  );

  const grid = $("div", "statistics-grid");

  grid.append(
    statCard("اعضای دارای رتبه", rankings.length),
    statCard("مجموع امتیازات", totalPoints),
    statCard("مجموع برد اعضا", totalWins),
    statCard("مجموع باخت اعضا", totalLosses),
    statCard("مجموع مساوی اعضا", totalDraws)
  );

  wrapper.appendChild(grid);
  return wrapper;
}

export async function renderStatistics(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش آمار معتبر نیست.");
  }

  if (!isManager(user)) {
    container.replaceChildren(
      $("section", "card error-state",
        "مشاهده آمار مدیریتی فقط برای لیدر و ادمین مجاز است."
      )
    );
    return;
  }

  container.replaceChildren(
    $("p", "loading-state", "در حال محاسبه آمار کلن...")
  );

  try {
    const [
      rankings,
      wars,
      teams,
      tournaments,
      users,
      roles
    ] = await Promise.all([
      getRankings("current"),
      getWars({ includeArchived: true }),
      getTeams({ includeInactive: true }, user),
      getTournaments({ includeArchived: true }, user),
      readData("users"),
      readData("roles")
    ]);

    const content = $("div", "statistics-page");

    const header = $("section", "card statistics-header");

    header.append(
      $("h1", "card-title", "آمار و عملکرد INVICTUS"),
      $("p", "",
        "گزارش کلی اعضا، امتیازات، جنگ‌ها، تیم‌ها و تورنمنت‌ها"
      ),
      $("p", "statistics-updated",
        `آخرین محاسبه: ${formatDate(Date.now())}`
      )
    );

    content.appendChild(header);

    content.appendChild(
      createMemberStatistics(users, roles)
    );

    content.appendChild(
      createRankingSummary(rankings)
    );

    content.appendChild(
      createRankingTable(rankings)
    );

    content.appendChild(
      createWarStatistics(wars)
    );

    content.appendChild(
      createTeamStatistics(teams)
    );

    content.appendChild(
      createTournamentStatistics(tournaments)
    );

    const refresh = $("button", "secondary-button", "به‌روزرسانی آمار");

    refresh.type = "button";

    refresh.addEventListener("click", () =>
      renderStatistics(container, user)
    );

    const footer = $("div", "statistics-footer");

    footer.appendChild(refresh);
    content.appendChild(footer);

    container.replaceChildren(content);

  } catch (error) {
    console.error("Statistics page error:", error);

    const card = $("section", "card error-state");

    card.append(
      $("p", "",
        error.message || "محاسبه آمار با خطا مواجه شد."
      ),
      button("تلاش دوباره", "secondary-button", () =>
        renderStatistics(container, user)
      )
    );

    container.replaceChildren(card);
  }
}

function button(text, className, callback) {
  const el = $("button", className, text);
  el.type = "button";
  el.addEventListener("click", callback);
  return el;
}
  
