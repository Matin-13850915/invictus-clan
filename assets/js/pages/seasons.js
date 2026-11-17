
import {
  createSeason,
  getSeasons,
  getActiveSeason,
  updateSeason,
  activateSeason,
  pauseSeason,
  archiveSeason
} from "../seasons.js";

const $ = (tag, className = "", text = "") => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }
  return element;
};

const canManage = user =>
  ["admin", "leader"].includes(user?.role) &&
  user?.active === true;

function button(text, className, callback) {
  const element = $("button", className, text);
  element.type = "button";
  element.addEventListener("click", callback);
  return element;
}

function field(labelText, input) {
  const wrapper = $("label", "season-field");
  wrapper.append($("span", "", labelText), input);
  return wrapper;
}

function input(type, placeholder = "") {
  const element = $("input", "season-input");
  element.type = type;
  element.placeholder = placeholder;
  return element;
}

function textarea(placeholder = "") {
  const element = $("textarea", "season-input");
  element.placeholder = placeholder;
  element.maxLength = 500;
  return element;
}

function formatDate(value) {
  const date = new Date(Number(value));

  if (!Number.isFinite(date.getTime())) {
    return "ثبت نشده";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function toLocalDateTime(value) {
  const date = new Date(Number(value));

  if (!Number.isFinite(date.getTime())) return "";

  const offset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16);
}

function showMessage(container, message, type = "info") {
  container.prepend(
    $("div", `card season-message ${type}`, message)
  );
}

function createSeasonForm(container, user, reload) {
  if (!canManage(user)) return;

  const card = $("section", "card season-form-card");

  card.appendChild(
    $("h2", "card-title", "ساخت فصل جدید")
  );

  const name = input("text", "مثلاً فصل اول INVICTUS");
  name.maxLength = 60;

  const description = textarea("توضیحات فصل");

  const startAt = input("datetime-local");
  const endAt = input("datetime-local");

  const form = $("form", "season-form");

  form.append(
    field("نام فصل", name),
    field("توضیحات", description),
    field("زمان شروع", startAt),
    field("زمان پایان", endAt)
  );

  const submit = $("button", "primary-button", "ساخت فصل");
  submit.type = "submit";

  form.appendChild(submit);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const start = new Date(startAt.value).getTime();
    const end = new Date(endAt.value).getTime();

    if (!name.value.trim() || name.value.trim().length < 2) {
      showMessage(card, "نام فصل باید حداقل ۲ حرف باشد.", "error");
      return;
    }

    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start <= 0 ||
      end <= start
    ) {
      showMessage(card, "تاریخ شروع و پایان معتبر نیست.", "error");
      return;
    }

    submit.disabled = true;
    submit.textContent = "در حال ساخت...";

    try {
      await createSeason({
        name: name.value,
        description: description.value,
        startAt: start,
        endAt: end
      }, user);

      showMessage(card, "فصل با موفقیت ساخته شد.", "success");
      form.reset();
      await reload();

    } catch (error) {
      showMessage(card, error.message, "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "ساخت فصل";
    }
  });

  card.appendChild(form);
  container.appendChild(card);
}

function createSeasonCard(season, user, reload) {
  const card = $("article", "card season-card");

  const header = $("div", "season-card-header");

  header.append(
    $("h2", "card-title", season.name || "فصل بدون نام")
  );

  if (season.active === true) {
    header.appendChild(
      $("span", "season-badge active", "فصل فعال")
    );
  } else if (season.archived === true) {
    header.appendChild(
      $("span", "season-badge archived", "آرشیوشده")
    );
  } else if (season.paused === true) {
    header.appendChild(
      $("span", "season-badge paused", "متوقف")
    );
  } else {
    header.appendChild(
      $("span", "season-badge", "غیرفعال")
    );
  }

  card.appendChild(header);

  card.append(
    $("p", "season-description",
      season.description || "بدون توضیحات"
    ),
    $("p", "season-meta",
      `شروع: ${formatDate(season.startAt)}`
    ),
    $("p", "season-meta",
      `پایان: ${formatDate(season.endAt)}`
    ),
    $("p", "season-meta",
      `ایجاد: ${formatDate(season.createdAt)}`
    )
  );

  if (canManage(user) && season.archived !== true) {
    const controls = $("div", "season-controls");

    controls.appendChild(
      button("ویرایش فصل", "secondary-button", async () => {
        const newName = prompt(
          "نام فصل:",
          season.name || ""
        );

        if (newName === null) return;

        const newDescription = prompt(
          "توضیحات فصل:",
          season.description || ""
        );

        if (newDescription === null) return;

        const newStart = prompt(
          "زمان شروع (فرمت تاریخ محلی):",
          toLocalDateTime(season.startAt)
        );

        if (newStart === null) return;

        const newEnd = prompt(
          "زمان پایان (فرمت تاریخ محلی):",
          toLocalDateTime(season.endAt)
        );

        if (newEnd === null) return;

        const start = new Date(newStart).getTime();
        const end = new Date(newEnd).getTime();

        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start <= 0 ||
          end <= start
        ) {
          showMessage(card, "تاریخ‌های واردشده معتبر نیستند.", "error");
          return;
        }

        try {
          await updateSeason(season.id, {
            name: newName,
            description: newDescription,
            startAt: start,
            endAt: end
          }, user);

          await reload();
        } catch (error) {
          showMessage(card, error.message, "error");
        }
      })
    );

    if (season.active !== true) {
      controls.appendChild(
        button("فعال‌سازی فصل", "primary-button", async () => {
          if (!confirm("با فعال‌سازی این فصل، فصل فعال قبلی غیرفعال می‌شود. ادامه می‌دهی؟")) {
            return;
          }

          try {
            await activateSeason(season.id, user);
            await reload();
          } catch (error) {
            showMessage(card, error.message, "error");
          }
        })
      );
    }

    if (season.active === true) {
      controls.appendChild(
        button(
          season.paused === true ? "ادامه فصل" : "توقف موقت",
          "secondary-button",
          async () => {
            try {
              await pauseSeason(
                season.id,
                season.paused !== true,
                user
              );

              await reload();
            } catch (error) {
              showMessage(card, error.message, "error");
            }
          }
        )
      );
    }

    controls.appendChild(
      button("آرشیو فصل", "danger-button", async () => {
        if (!confirm("این فصل آرشیو شود؟")) return;

        try {
          await archiveSeason(season.id, user);
          await reload();
        } catch (error) {
          showMessage(card, error.message, "error");
        }
      })
    );

    card.appendChild(controls);
  }

  return card;
}

export async function renderSeasons(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش فصل‌ها معتبر نیست.");
  }

  container.replaceChildren(
    $("p", "loading-state", "در حال دریافت فصل‌ها...")
  );

  try {
    const [seasons, activeSeason] = await Promise.all([
      getSeasons(),
      getActiveSeason()
    ]);

    const content = $("div", "seasons-content");

    const heading = $("section", "card");

    heading.append(
      $("h2", "card-title", "مدیریت فصل‌ها"),
      $("p", "", "ساخت، مدیریت و آرشیو فصل‌های رقابتی INVICTUS")
    );

    if (activeSeason) {
      const activeCard = $("section", "card active-season-card");

      activeCard.append(
        $("h3", "", "فصل فعال"),
        $("p", "", activeSeason.name),
        $("p", "", `پایان: ${formatDate(activeSeason.endAt)}`)
      );

      if (activeSeason.paused === true) {
        activeCard.appendChild(
          $("p", "season-warning", "این فصل در حال حاضر متوقف است.")
        );
      }

      content.appendChild(activeCard);
    } else {
      content.appendChild(
        $("section", "card empty-state", "در حال حاضر فصل فعالی وجود ندارد.")
      );
    }

    content.appendChild(heading);

    createSeasonForm(content, user, () =>
      renderSeasons(container, user)
    );

    const toolbar = $("div", "seasons-toolbar");

    const search = input("search", "جستجوی نام فصل...");
    const filter = $("select", "season-input");

    [
      ["all", "همه فصل‌ها"],
      ["active", "فصل فعال"],
      ["inactive", "فصل‌های غیرفعال"],
      ["paused", "فصل‌های متوقف"],
      ["archived", "آرشیوشده"]
    ].forEach(([value, label]) => {
      const option = $("option", "", label);
      option.value = value;
      filter.appendChild(option);
    });

    toolbar.append(search, filter);
    content.appendChild(toolbar);

    const list = $("div", "seasons-list");
    content.appendChild(list);

    function updateList() {
      const term = search.value.trim().toLocaleLowerCase();

      const filtered = seasons.filter(season => {
        const matchesName = (season.name || "")
          .toLocaleLowerCase()
          .includes(term);

        let matchesStatus = true;

        if (filter.value === "active") {
          matchesStatus = season.active === true &&
            season.archived !== true;
        }

        if (filter.value === "inactive") {
          matchesStatus = season.active !== true &&
            season.paused !== true &&
            season.archived !== true;
        }

        if (filter.value === "paused") {
          matchesStatus = season.paused === true &&
            season.archived !== true;
        }

        if (filter.value === "archived") {
          matchesStatus = season.archived === true;
        }

        return matchesName && matchesStatus;
      });

      list.replaceChildren();

      if (!filtered.length) {
        list.appendChild(
          $("section", "card empty-state", "فصلی با این مشخصات پیدا نشد.")
        );
        return;
      }

      filtered.forEach(season => {
        list.appendChild(
          createSeasonCard(
            season,
            user,
            () => renderSeasons(container, user)
          )
        );
      });
    }

    search.addEventListener("input", updateList);
    filter.addEventListener("change", updateList);

    updateList();
    container.replaceChildren(content);

  } catch (error) {
    console.error("Seasons page error:", error);

    const card = $("section", "card error-state");

    card.append(
      $("p", "", error.message || "دریافت فصل‌ها ناموفق بود."),
      button("تلاش دوباره", "secondary-button", () =>
        renderSeasons(container, user)
      )
    );

    container.replaceChildren(card);
  }
}
