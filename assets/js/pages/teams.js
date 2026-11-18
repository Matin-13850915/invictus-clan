
import {
  getTeams,
  createTeam,
  updateTeam,
  addTeamMember,
  removeTeamMember,
  setTeamCaptain,
  deactivateTeam,
  activateTeam,
  deleteTeam
} from "../teams.js";

import { readData } from "../database.js";

const $ = (tag, className = "", text = "") => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) {
    node.textContent = String(text);
  }
  return node;
};

const isStaff = user =>
  ["admin", "leader"].includes(user?.role) &&
  user?.active === true;

const isAdmin = user =>
  user?.role === "admin" &&
  user?.active === true;

const TYPE_LABELS = {
  MP: "Multiplayer",
  BR: "Battle Royale",
  BOTH: "MP و BR"
};

function showMessage(container, message, type = "info") {
  const box = $("div", `card team-message ${type}`, message);
  container.prepend(box);
}

function createButton(text, className, handler) {
  const button = $("button", className, text);
  button.type = "button";
  button.addEventListener("click", handler);
  return button;
}

function createField(labelText, input) {
  const wrapper = $("label", "team-field");
  wrapper.append($("span", "", labelText), input);
  return wrapper;
}

function createInput(placeholder = "", value = "") {
  const input = $("input", "team-input");
  input.type = "text";
  input.placeholder = placeholder;
  input.value = value;
  return input;
}

function createSelect(options, selected = "") {
  const select = $("select", "team-input");

  options.forEach(([value, label]) => {
    const option = $("option", "", label);
    option.value = value;
    option.selected = value === selected;
    select.appendChild(option);
  });

  return select;
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fa")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک");
}

function getMemberName(member) {
  return (
    member.displayName ||
    member.gameName ||
    member.uid ||
    "عضو بدون نام"
  );
}

function formatDate(value) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "ثبت نشده";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium"
  }).format(new Date(timestamp));
}

async function loadMembers() {
  const [usersData, rolesData] = await Promise.all([
    readData("publicProfiles"),
    readData("roles")
  ]);

  const users = usersData && typeof usersData === "object"
    ? usersData
    : {};

  const roles = rolesData && typeof rolesData === "object"
    ? rolesData
    : {};

  const ids = new Set([
    ...Object.keys(users),
    ...Object.keys(roles)
  ]);

  return [...ids]
    .map(uid => ({
      uid,
      ...(users[uid] || {}),
      ...(roles[uid] || {})
    }))
    .filter(member =>
      member.uid &&
      member.active === true &&
      member.status !== "banned" &&
      member.status !== "suspended"
    )
    .sort((a, b) =>
      getMemberName(a).localeCompare(getMemberName(b), "fa")
    );
}

function createTeamForm(container, user, members, onSaved) {
  if (!isStaff(user)) return;

  const section = $("section", "card team-create-section");
  section.append(
    $("h2", "card-title", "ساخت تیم جدید")
  );

  const name = createInput("مثلاً INVICTUS Alpha");
  const description = $("textarea", "team-input");
  description.placeholder = "توضیحات تیم";
  description.maxLength = 300;

  const type = createSelect([
    ["MP", "Multiplayer"],
    ["BR", "Battle Royale"],
    ["BOTH", "MP و BR"]
  ]);

  const captain = createSelect([
    ["", "بدون کاپیتان"]
  ]);

  members.forEach(member => {
    captain.appendChild(
      $("option", "", getMemberName(member))
    );
    captain.lastChild.value = member.uid;
  });

  const form = $("form", "team-form");

  form.append(
    createField("نام تیم", name),
    createField("توضیحات", description),
    createField("نوع تیم", type),
    createField("کاپیتان اولیه", captain)
  );

  const submit = $("button", "primary-button", "ساخت تیم");
  submit.type = "submit";
  form.appendChild(submit);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (name.value.trim().length < 2) {
      showMessage(section, "نام تیم باید حداقل ۲ حرف باشد.", "error");
      return;
    }

    submit.disabled = true;
    submit.textContent = "در حال ساخت...";

    try {
      await createTeam({
        name: name.value,
        description: description.value,
        type: type.value,
        captainUid: captain.value || null
      }, user);

      showMessage(section, "تیم با موفقیت ساخته شد.", "success");
      form.reset();
      await onSaved();

    } catch (error) {
      showMessage(
        section,
        error.message || "ساخت تیم ناموفق بود.",
        "error"
      );
    } finally {
      submit.disabled = false;
      submit.textContent = "ساخت تیم";
    }
  });

  section.appendChild(form);
  container.appendChild(section);
}

function createTeamCard(team, user, members, onChanged) {
  const card = $("article", "card team-card");

  const header = $("div", "team-card-header");

  header.append(
    $("h2", "card-title", team.name || "تیم بدون نام"),
    $("span", "team-type", TYPE_LABELS[team.type] || team.type)
  );

  card.appendChild(header);

  card.append(
    $("p", "team-description", team.description || "بدون توضیحات"),
    $("p", "team-meta", `تاریخ ساخت: ${formatDate(team.createdAt)}`)
  );

  const memberMap = team.members || {};
  const memberIds = Object.keys(memberMap);

  const captain = members.find(
    member => member.uid === team.captainUid
  );

  card.append(
    $("p", "team-captain",
      `کاپیتان: ${captain ? getMemberName(captain) : "تعیین نشده"}`
    ),
    $("p", "team-count", `تعداد اعضا: ${memberIds.length}`)
  );

  const list = $("div", "team-member-list");

  memberIds.forEach(uid => {
    const member = members.find(item => item.uid === uid);

    const row = $("div", "team-member-row");

    row.appendChild(
      $("span", "", member ? getMemberName(member) : uid)
    );

    if (isStaff(user)) {
      if (team.captainUid !== uid) {
        row.appendChild(
          createButton("کاپیتان", "small-button", async () => {
            try {
              await setTeamCaptain(team.id, uid, user);
              await onChanged();
            } catch (error) {
              showMessage(card, error.message, "error");
            }
          })
        );
      }

      row.appendChild(
        createButton("حذف از تیم", "small-button danger", async () => {
          if (!confirm("این عضو از تیم حذف شود؟")) return;

          try {
            await removeTeamMember(team.id, uid, user);
            await onChanged();
          } catch (error) {
            showMessage(card, error.message, "error");
          }
        })
      );
    }

    list.appendChild(row);
  });

  if (!memberIds.length) {
    list.appendChild(
      $("p", "empty-state", "هنوز عضوی به این تیم اضافه نشده است.")
    );
  }

  card.appendChild(list);

  if (isStaff(user)) {
    const controls = $("div", "team-controls");

    const availableMembers = members.filter(
      member => !memberMap[member.uid]
    );

    const memberSelect = createSelect([
      ["", "انتخاب عضو برای افزودن"],
      ...availableMembers.map(member => [
        member.uid,
        getMemberName(member)
      ])
    ]);

    controls.appendChild(memberSelect);

    controls.appendChild(
      createButton("افزودن عضو", "secondary-button", async () => {
        if (!memberSelect.value) {
          showMessage(card, "ابتدا یک عضو انتخاب کن.", "error");
          return;
        }

        try {
          await addTeamMember(
            team.id,
            memberSelect.value,
            user
          );

          await onChanged();
        } catch (error) {
          showMessage(card, error.message, "error");
        }
      })
    );

    controls.appendChild(
      createButton("ویرایش تیم", "secondary-button", async () => {
        const newName = prompt("نام جدید تیم:", team.name || "");
        if (newName === null) return;

        const newDescription = prompt(
          "توضیحات جدید:",
          team.description || ""
        );

        if (newDescription === null) return;

        const newType = prompt(
          "نوع تیم را وارد کن: MP یا BR یا BOTH",
          team.type || "MP"
        );

        if (newType === null) return;

        try {
          await updateTeam(team.id, {
            name: newName,
            description: newDescription,
            type: newType.trim().toUpperCase()
          }, user);

          await onChanged();
        } catch (error) {
          showMessage(card, error.message, "error");
        }
      })
    );

    if (team.active === false) {
      controls.appendChild(
        createButton("فعال‌سازی تیم", "secondary-button", async () => {
          try {
            await activateTeam(team.id, user);
            await onChanged();
          } catch (error) {
            showMessage(card, error.message, "error");
          }
        })
      );
    } else {
      controls.appendChild(
        createButton("غیرفعال‌سازی", "secondary-button", async () => {
          if (!confirm("این تیم غیرفعال شود؟")) return;

          try {
            await deactivateTeam(team.id, user);
            await onChanged();
          } catch (error) {
            showMessage(card, error.message, "error");
          }
        })
      );
    }

    if (isAdmin(user)) {
      controls.appendChild(
        createButton("حذف کامل تیم", "danger-button", async () => {
          if (!confirm("حذف کامل تیم قابل بازگشت نیست. ادامه می‌دهی؟")) {
            return;
          }

          try {
            await deleteTeam(team.id, user);
            await onChanged();
          } catch (error) {
            showMessage(card, error.message, "error");
          }
        })
      );
    }

    card.appendChild(controls);
  }

  return card;
}

export async function renderTeams(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش تیم‌ها معتبر نیست.");
  }

  container.replaceChildren(
    $("p", "loading-state", "در حال دریافت تیم‌ها...")
  );

  try {
    const [members, teams] = await Promise.all([
      loadMembers(),
      getTeams(
        { includeInactive: isStaff(user) },
        isStaff(user) ? user : null
      )
    ]);

    const heading = $("section", "card");
    heading.append(
      $("h2", "card-title", "تیم‌های INVICTUS"),
      $("p", "", "مدیریت ترکیب تیم‌های رقابتی MP و BR")
    );

    const toolbar = $("div", "teams-toolbar");
    const search = createInput("جستجوی نام تیم...");
    const filter = createSelect([
      ["ALL", "همه تیم‌ها"],
      ["MP", "Multiplayer"],
      ["BR", "Battle Royale"],
      ["BOTH", "MP و BR"]
    ]);

    toolbar.append(search, filter);

    const list = $("div", "teams-list");

    const content = $("div", "teams-content");
    content.append(heading, toolbar, list);

    if (isStaff(user)) {
      createTeamForm(content, user, members, () =>
        renderTeams(container, user)
      );
    }

    function updateList() {
      const term = normalizeName(search.value);

      const filtered = teams.filter(team => {
        const nameMatches = normalizeName(team.name).includes(term);
        const typeMatches =
          filter.value === "ALL" ||
          team.type === filter.value;

        return nameMatches && typeMatches;
      });

      list.replaceChildren();

      if (!filtered.length) {
        list.appendChild(
          $("section", "card empty-state", "تیمی با این مشخصات پیدا نشد.")
        );
        return;
      }

      filtered.forEach(team => {
        list.appendChild(
          createTeamCard(
            team,
            user,
            members,
            () => renderTeams(container, user)
          )
        );
      });
    }

    search.addEventListener("input", updateList);
    filter.addEventListener("change", updateList);

    updateList();
    container.replaceChildren(content);

  } catch (error) {
    console.error("Teams page failed:", error);

    const errorCard = $("section", "card error-state",
      error.message || "دریافت تیم‌ها ناموفق بود."
    );

    errorCard.appendChild(
      createButton("تلاش دوباره", "secondary-button", () =>
        renderTeams(container, user)
      )
    );

    container.replaceChildren(errorCard);
  }
}
  
