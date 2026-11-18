
import { readData } from "../database.js";

function createElement(tag, className = "", value = "") {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }

  node.textContent = String(value ?? "");

  return node;
}

function getRoleName(role) {
  const roles = {
    admin: "مدیر کل",
    leader: "لیدر",
    tester: "تستر",
    member: "عضو"
  };

  return roles[role] || "نامشخص";
}

function createMemberCard(member) {
  const card = createElement("article", "card member-card");

  const name =
    member.displayName ||
    member.gameName ||
    "عضو بدون نام";

  const header = createElement("div", "member-card-header");

  const title = createElement("h3", "", name);

  const role = createElement(
    "span",
    "member-role",
    getRoleName(member.role)
  );

  header.append(title, role);

  const details = createElement("div", "member-details");

  details.append(
    createElement(
      "p",
      "",
      `نام داخل بازی: ${member.gameName || "ثبت نشده"}`
    ),
    createElement(
      "p",
      "",
      `تخصص: ${member.specialty || "ندارد"}`
    ),
    createElement(
      "p",
      "",
      `وضعیت: ${member.active === false ? "غیرفعال" : "فعال"}`
    )
  );

  card.append(header, details);

  return card;
}

function normalizeSearch(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fa")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک");
}

export async function renderMembers(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش اعضا معتبر نیست.");
  }

  if (!user?.uid || user.active !== true) {
    container.replaceChildren(
      createElement(
        "section",
        "card error-state",
        "برای مشاهده اعضا ابتدا وارد حساب فعال شوید."
      )
    );

    return;
  }

  container.replaceChildren(
    createElement(
      "p",
      "loading-state",
      "در حال دریافت اعضای کلن..."
    )
  );

  try {
    const [usersData, rolesData] = await Promise.all([
      readData("publicProfiles"),
      readData("roles")
    ]);

    const users =
      usersData &&
      typeof usersData === "object" &&
      !Array.isArray(usersData)
        ? usersData
        : {};

    const roles =
      rolesData &&
      typeof rolesData === "object" &&
      !Array.isArray(rolesData)
        ? rolesData
        : {};

    const userIds = new Set([
      ...Object.keys(users),
      ...Object.keys(roles)
    ]);

    const members = [...userIds]
      .map(uid => ({
        uid,
        ...(users[uid] || {}),
        ...(roles[uid] || {})
      }))
      .filter(member =>
        member.role &&
        member.active === true &&
        member.status !== "banned" &&
        member.status !== "suspended"
      )
      .sort((a, b) =>
        String(a.displayName || a.gameName || "").localeCompare(
          String(b.displayName || b.gameName || ""),
          "fa"
        )
      );

    const toolbar = createElement("div", "members-toolbar");

    const search = document.createElement("input");

    search.type = "search";
    search.className = "members-search";
    search.placeholder = "جستجوی نام یا نام بازی...";
    search.setAttribute(
      "aria-label",
      "جستجوی اعضای کلن"
    );

    const count = createElement(
      "p",
      "members-count",
      ""
    );

    toolbar.append(search, count);

    const list = createElement(
      "div",
      "members-list"
    );

    function updateList() {
      const term = normalizeSearch(search.value);

      const filteredMembers = members.filter(member => {
        const displayName = normalizeSearch(
          member.displayName
        );

        const gameName = normalizeSearch(
          member.gameName
        );

        return (
          displayName.includes(term) ||
          gameName.includes(term)
        );
      });

      count.textContent =
        `تعداد اعضای فعال: ${filteredMembers.length}`;

      list.replaceChildren();

      if (filteredMembers.length === 0) {
        list.appendChild(
          createElement(
            "section",
            "card empty-state",
            "عضوی با این مشخصات پیدا نشد."
          )
        );

        return;
      }

      const fragment = document.createDocumentFragment();

      filteredMembers.forEach(member => {
        fragment.appendChild(
          createMemberCard(member)
        );
      });

      list.appendChild(fragment);
    }

    search.addEventListener("input", updateList);

    updateList();

    container.replaceChildren(
      createElement(
        "h2",
        "page-section-title",
        "اعضای کلن INVICTUS"
      ),
      toolbar,
      list
    );

  } catch (error) {
    console.error(
      "Members loading failed:",
      error
    );

    const errorCard = createElement(
      "section",
      "card error-state",
      "دریافت فهرست اعضا ناموفق بود."
    );

    const retryButton = createElement(
      "button",
      "secondary-button",
      "تلاش دوباره"
    );

    retryButton.type = "button";

    retryButton.addEventListener("click", () => {
      renderMembers(container, user);
    });

    errorCard.appendChild(retryButton);

    container.replaceChildren(errorCard);
  }
}
