
import {
  getAllManagedUsers,
  getManagedUser,
  createManagedUserProfile,
  changeUserRole,
  setUserActiveStatus,
  updateManagedUser,
  getUserManagementHistory
} from "../user-management.js";

import { getAdminUid } from "../auth.js";

const $ = (tag, className = "", value = "") => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = String(value ?? "");
  return element;
};

const roles = {
  admin: "مدیر کل",
  leader: "لیدر",
  tester: "تستر",
  member: "عضو"
};

function button(label, className, action) {
  const element = $("button", className, label);
  element.type = "button";
  element.addEventListener("click", action);
  return element;
}

function inputField(label, name, value = "", type = "text") {
  const wrapper = $("label", "form-field");
  wrapper.appendChild($("span", "form-label", label));

  const input = $("input", "form-input");
  input.name = name;
  input.type = type;
  input.value = value ?? "";

  wrapper.appendChild(input);
  return wrapper;
}

function selectField(label, name, options, selected) {
  const wrapper = $("label", "form-field");
  wrapper.appendChild($("span", "form-label", label));

  const select = document.createElement("select");
  select.className = "form-input";
  select.name = name;

  options.forEach(option => {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    item.selected = option.value === selected;
    select.appendChild(item);
  });

  wrapper.appendChild(select);
  return wrapper;
}

function section(title, description = "") {
  const element = $("section", "card admin-section");
  element.appendChild($("h2", "section-title", title));

  if (description) {
    element.appendChild($("p", "section-description", description));
  }

  return element;
}

function roleLabel(role) {
  return roles[role] || "نامشخص";
}

function formatDate(value) {
  if (!value) return "نامشخص";

  const date = new Date(Number(value));

  if (Number.isNaN(date.getTime())) return "نامشخص";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function createUserCard(member, actor, reload) {
  const card = $("article", "card admin-user-card");

  const name = member.displayName ||
    member.gameName ||
    "بدون نام";

  card.append(
    $("h3", "admin-user-name", name),
    $("p", "", `UID: ${member.uid}`),
    $("p", "", `نقش: ${roleLabel(member.role)}`),
    $("p", "", `نام بازی: ${member.gameName || "ثبت نشده"}`),
    $("p", "", `تخصص: ${member.specialty || "ندارد"}`),
    $("p", "", `وضعیت: ${member.active === true ? "فعال" : "غیرفعال"}`)
  );

  const actions = $("div", "admin-user-actions");

  actions.appendChild(
    button("ویرایش اطلاعات", "secondary-button", async () => {
      const displayName = prompt(
        "نام نمایشی جدید:",
        member.displayName || ""
      );

      if (displayName === null) return;

      const gameName = prompt(
        "نام داخل بازی جدید:",
        member.gameName || ""
      );

      if (gameName === null) return;

      try {
        await updateManagedUser(member.uid, {
          displayName,
          gameName
        }, actor);

        alert("اطلاعات حساب ویرایش شد.");
        await reload();
      } catch (error) {
        alert(error.message || "ویرایش انجام نشد.");
      }
    })
  );

  if (member.uid !== actor.uid && member.uid !== getAdminUid()) {
    actions.appendChild(
      button("تغییر نقش", "secondary-button", async () => {
        const roleSelect = document.createElement("select");

        ["member", "leader", "tester"].forEach(role => {
          const option = document.createElement("option");
          option.value = role;
          option.textContent = roleLabel(role);
          option.selected = role === member.role;
          roleSelect.appendChild(option);
        });

        const specialtySelect = document.createElement("select");

        [
          { value: "MP", label: "تستر مولتی‌پلیر" },
          { value: "BR", label: "تستر بتل‌رویال" }
        ].forEach(item => {
          const option = document.createElement("option");
          option.value = item.value;
          option.textContent = item.label;
          specialtySelect.appendChild(option);
        });

        specialtySelect.value = member.specialty || "MP";

        const dialog = $("div", "admin-dialog");
        dialog.append(
          $("p", "", "نقش جدید را انتخاب کنید:"),
          roleSelect,
          specialtySelect
        );

        const confirmChange = button(
          "ثبت نقش",
          "primary-button",
          async () => {
            try {
              await changeUserRole(
                member.uid,
                roleSelect.value,
                specialtySelect.value,
                actor
              );

              alert("نقش حساب تغییر کرد.");
              await reload();
            } catch (error) {
              alert(error.message || "تغییر نقش انجام نشد.");
            }

            dialog.remove();
          }
        );

        const cancel = button(
          "انصراف",
          "secondary-button",
          () => dialog.remove()
        );

        dialog.append(confirmChange, cancel);
        card.appendChild(dialog);
      })
    );

    actions.appendChild(
      button(
        member.active === true ? "غیرفعال کردن" : "فعال کردن",
        member.active === true ? "danger-button" : "secondary-button",
        async () => {
          const active = member.active !== true;

          const reason = active
            ? ""
            : prompt("دلیل غیرفعال کردن حساب را بنویسید:");

          if (!active && reason === null) return;

          if (!confirm("از تغییر وضعیت این حساب مطمئن هستید؟")) {
            return;
          }

          try {
            await setUserActiveStatus(
              member.uid,
              active,
              reason || "",
              actor
            );

            alert("وضعیت حساب به‌روزرسانی شد.");
            await reload();
          } catch (error) {
            alert(error.message || "تغییر وضعیت انجام نشد.");
          }
        }
      )
    );
  }

  card.appendChild(actions);
  return card;
}

export async function renderAdmin(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش پنل مدیریت معتبر نیست.");
  }

  if (
    !user?.uid ||
    user.active !== true ||
    user.role !== "admin" ||
    user.uid !== getAdminUid()
  ) {
    container.replaceChildren(
      $("div", "card error-state",
        "دسترسی به پنل مدیریت فقط برای ادمین اصلی مجاز است."
      )
    );
    return;
  }

  const load = async () => {
    container.replaceChildren(
      $("p", "loading-state", "در حال دریافت اطلاعات مدیریت...")
    );

    try {
      const [members, history] = await Promise.all([
        getAllManagedUsers(user),
        getUserManagementHistory(user)
      ]);

      const page = $("div", "admin-page");

      const header = section(
        "پنل مدیریت INVICTUS",
        "مدیریت حساب‌ها، نقش‌ها و تاریخچه تغییرات"
      );

      header.append(
        $("p", "", `تعداد حساب‌ها: ${members.length}`),
        $("p", "", `تعداد اقدامات ثبت‌شده: ${history.length}`)
      );

      page.appendChild(header);

      const createSection = section(
        "ایجاد پروفایل برای UID موجود",
        "این بخش حساب Firebase جدید نمی‌سازد؛ فقط برای حساب احراز هویت‌شده موجود، پروفایل کلن ثبت می‌کند."
      );

      const createForm = $("form", "admin-create-form");

      createForm.append(
        inputField("UID حساب Firebase", "uid"),
        inputField("نام نمایشی", "displayName"),
        inputField("نام داخل بازی", "gameName"),
        selectField("نقش", "role", [
          { value: "member", label: "عضو" },
          { value: "leader", label: "لیدر" },
          { value: "tester", label: "تستر" }
        ], "member"),
        selectField("تخصص تستر", "specialty", [
          { value: "MP", label: "مولتی‌پلیر" },
          { value: "BR", label: "بتل‌رویال" }
        ], "MP")
      );

      const createButton = $("button", "primary-button", "ثبت پروفایل");
      createButton.type = "submit";
      createForm.appendChild(createButton);

      createForm.addEventListener("submit", async event => {
        event.preventDefault();

        const get = name =>
          createForm.elements.namedItem(name)?.value?.trim() || "";

        const uid = get("uid");

        if (!uid) {
          alert("UID را وارد کنید.");
          return;
        }

        try {
          const existing = await getManagedUser(uid, user);

          if (existing) {
            alert("برای این UID قبلاً پروفایل ثبت شده است.");
            return;
          }

          await createManagedUserProfile(uid, {
            displayName: get("displayName"),
            gameName: get("gameName"),
            role: get("role"),
            specialty: get("specialty")
          }, user);

          alert("پروفایل مدیریتی ثبت شد.");
          await load();
        } catch (error) {
          alert(error.message || "ایجاد پروفایل انجام نشد.");
        }
      });

      createSection.appendChild(createForm);
      page.appendChild(createSection);

      const membersSection = section(
        "مدیریت حساب‌ها",
        "حساب موردنظر را پیدا و اطلاعات مجاز آن را مدیریت کنید."
      );

      const search = document.createElement("input");
      search.type = "search";
      search.className = "form-input";
      search.placeholder = "جستجو با نام یا UID...";

      const list = $("div", "admin-users-list");

      function renderList() {
        const term = search.value.trim().toLowerCase();

        const filtered = members.filter(member => {
          const text = [
            member.uid,
            member.displayName,
            member.gameName,
            member.role
          ].join(" ").toLowerCase();

          return text.includes(term);
        });

        list.replaceChildren();

        if (!filtered.length) {
          list.appendChild(
            $("p", "empty-state", "حسابی پیدا نشد.")
          );
          return;
        }

        filtered.forEach(member => {
          list.appendChild(
            createUserCard(member, user, load)
          );
        });
      }

      search.addEventListener("input", renderList);

      membersSection.append(search, list);
      page.appendChild(membersSection);
      renderList();

      const historySection = section(
        "تاریخچه مدیریت حساب‌ها",
        "اقدامات مدیریتی ثبت‌شده در سیستم."
      );

      if (!history.length) {
        historySection.appendChild(
          $("p", "empty-state", "تاریخچه‌ای ثبت نشده است.")
        );
      } else {
        history.slice(0, 100).forEach(item => {
          const row = $("article", "admin-history-item");

          row.append(
            $("strong", "", item.action || "اقدام مدیریتی"),
            $("p", "", `حساب هدف: ${item.targetUid || "نامشخص"}`),
            $("p", "", `انجام‌دهنده: ${item.actorUid || "نامشخص"}`),
            $("small", "", formatDate(item.createdAt))
          );

          historySection.appendChild(row);
        });
      }

      page.appendChild(historySection);

      page.appendChild(
        button("به‌روزرسانی پنل", "secondary-button", load)
      );

      container.replaceChildren(page);

    } catch (error) {
      console.error("Admin page error:", error);

      const errorBox = $("div", "card error-state");

      errorBox.append(
        $("p", "", error.message || "دریافت اطلاعات مدیریت ناموفق بود."),
        button("تلاش دوباره", "secondary-button", load)
      );

      container.replaceChildren(errorBox);
    }
  };

  await load();
}
