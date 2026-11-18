
import {
  createTournament,
  getTournaments,
  requestTournament,
  getTournamentRequests,
  reviewTournamentRequest,
  registerParticipant,
  unregisterParticipant,
  setTournamentStatus,
  recordTournamentResult,
  setTournamentChampion,
  archiveTournament,
  deleteTournament
} from "../tournaments.js";

const STAFF = ["admin", "leader"];

const STATUS_LABELS = {
  registration: "در حال ثبت‌نام",
  ongoing: "در حال برگزاری",
  completed: "پایان‌یافته",
  cancelled: "لغوشده"
};

const RESULT_LABELS = {
  win: "برد",
  loss: "باخت",
  draw: "مساوی"
};

const $ = (tag, className = "", text = "") => {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== null && text !== undefined) {
    element.textContent = String(text);
  }

  return element;
};

const isStaff = user =>
  STAFF.includes(user?.role) &&
  user?.active === true;

const isAdmin = user =>
  user?.role === "admin" &&
  user?.active === true;

function makeButton(text, className, callback) {
  const button = $("button", className, text);
  button.type = "button";
  button.addEventListener("click", callback);
  return button;
}

function makeInput(type, placeholder = "") {
  const input = $("input", "tournament-input");
  input.type = type;
  input.placeholder = placeholder;
  return input;
}

function makeSelect(options) {
  const select = $("select", "tournament-input");

  options.forEach(([value, label]) => {
    const option = $("option", "", label);
    option.value = value;
    select.appendChild(option);
  });

  return select;
}

function makeField(labelText, input) {
  const label = $("label", "tournament-field");
  label.append($("span", "", labelText), input);
  return label;
}

function showMessage(container, message, type = "info") {
  const box = $("div", `card tournament-message ${type}`, message);
  container.prepend(box);
}

function formatDate(value) {
  const date = new Date(Number(value));

  if (!Number.isFinite(date.getTime())) {
    return "تاریخ نامشخص";
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

function createTournamentForm(container, user, reload) {
  if (!isStaff(user)) return;

  const card = $("section", "card tournament-form-card");
  card.appendChild($("h2", "card-title", "ایجاد مسابقه"));

  const title = makeInput("text", "عنوان مسابقه");
  title.maxLength = 80;

  const description = $("textarea", "tournament-input");
  description.placeholder = "توضیحات مسابقه";
  description.maxLength = 1000;

  const type = makeSelect([
    ["MP", "Multiplayer"],
    ["BR", "Battle Royale"]
  ]);

  const startAt = makeInput("datetime-local");
  const capacity = makeInput("number");
  capacity.min = "2";
  capacity.max = "256";
  capacity.value = "10";

  const form = $("form", "tournament-form");

  form.append(
    makeField("عنوان", title),
    makeField("توضیحات", description),
    makeField("نوع مسابقه", type),
    makeField("زمان شروع", startAt),
    makeField("ظرفیت شرکت‌کنندگان", capacity)
  );

  const submit = $("button", "primary-button", "ایجاد مسابقه");
  submit.type = "submit";
  form.appendChild(submit);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const timestamp = new Date(startAt.value).getTime();

    if (!title.value.trim() || title.value.trim().length < 3) {
      showMessage(card, "عنوان باید حداقل ۳ حرف باشد.", "error");
      return;
    }

    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      showMessage(card, "زمان شروع مسابقه معتبر نیست.", "error");
      return;
    }

    submit.disabled = true;
    submit.textContent = "در حال ثبت...";

    try {
      await createTournament({
        title: title.value,
        description: description.value,
        type: type.value,
        startAt: timestamp,
        capacity: Number(capacity.value)
      }, user);

      showMessage(card, "مسابقه ساخته شد.", "success");
      form.reset();
      await reload();

    } catch (error) {
      showMessage(
        card,
        error.message || "ساخت مسابقه ناموفق بود.",
        "error"
      );
    } finally {
      submit.disabled = false;
      submit.textContent = "ایجاد مسابقه";
    }
  });

  card.appendChild(form);
  container.appendChild(card);
}

function createRequestForm(container, user, reload) {
  if (!user?.uid || user.active !== true || isStaff(user)) return;

  const card = $("section", "card tournament-request-card");
  card.appendChild(
    $("h2", "card-title", "درخواست برگزاری مسابقه")
  );

  const title = makeInput("text", "عنوان پیشنهادی");
  title.maxLength = 80;

  const description = $("textarea", "tournament-input");
  description.placeholder = "توضیحات درخواست";
  description.maxLength = 1000;

  const type = makeSelect([
    ["MP", "Multiplayer"],
    ["BR", "Battle Royale"]
  ]);

  const form = $("form", "tournament-form");

  form.append(
    makeField("عنوان", title),
    makeField("توضیحات", description),
    makeField("نوع", type)
  );

  const submit = $("button", "primary-button", "ارسال درخواست");
  submit.type = "submit";
  form.appendChild(submit);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    submit.disabled = true;

    try {
      await requestTournament({
        title: title.value,
        description: description.value,
        type: type.value
      }, user);

      showMessage(card, "درخواست برای بررسی ارسال شد.", "success");
      form.reset();
      await reload();

    } catch (error) {
      showMessage(card, error.message, "error");
    } finally {
      submit.disabled = false;
    }
  });

  card.appendChild(form);
  container.appendChild(card);
}

function createTournamentCard(tournament, user, reload) {
  const card = $("article", "card tournament-card");

  const header = $("div", "tournament-card-header");

  header.append(
    $("h2", "card-title", tournament.title || "مسابقه بدون عنوان"),
    $("span", "tournament-type", tournament.type || "نامشخص")
  );

  card.appendChild(header);

  card.append(
    $("p", "tournament-description",
      tournament.description || "بدون توضیحات"
    ),
    $("p", "tournament-meta",
      `وضعیت: ${STATUS_LABELS[tournament.status] || tournament.status}`
    ),
    $("p", "tournament-meta",
      `زمان شروع: ${formatDate(tournament.startAt)}`
    ),
    $("p", "tournament-meta",
      `ظرفیت: ${Object.keys(tournament.participants || {}).length} / ${tournament.capacity}`
    )
  );

  const participants = tournament.participants || {};
  const results = tournament.results || {};

  const participantList = $("div", "tournament-participants");
  participantList.appendChild(
    $("h3", "", "شرکت‌کنندگان")
  );

  const participantIds = Object.keys(participants);

  if (!participantIds.length) {
    participantList.appendChild(
      $("p", "empty-state", "هنوز کسی ثبت‌نام نکرده است.")
    );
  }

  participantIds.forEach(uid => {
    const row = $("div", "tournament-participant-row");

    row.append(
      $("span", "", uid),
      $("span", "", RESULT_LABELS[results[uid]?.result] || "بدون نتیجه")
    );

    participantList.appendChild(row);
  });

  card.appendChild(participantList);

  const isRegistered = Boolean(participants[user?.uid]);

  if (
    user?.active === true &&
    !isStaff(user) &&
    tournament.status === "registration"
  ) {
    if (isRegistered) {
      card.appendChild(
        makeButton("لغو ثبت‌نام", "secondary-button", async () => {
          try {
            await unregisterParticipant(tournament.id, user);
            await reload();
          } catch (error) {
            showMessage(card, error.message, "error");
          }
        })
      );
    } else if (
      participantIds.length < Number(tournament.capacity)
    ) {
      card.appendChild(
        makeButton("ثبت‌نام در مسابقه", "primary-button", async () => {
          try {
            await registerParticipant(
              tournament.id,
              user.uid,
              user
            );

            await reload();
          } catch (error) {
            showMessage(card, error.message, "error");
          }
        })
      );
    }
  }

  if (isStaff(user)) {
    const controls = $("div", "tournament-controls");

    const statusSelect = makeSelect(
      Object.entries(STATUS_LABELS)
    );
    statusSelect.value = tournament.status;

    controls.append(
      statusSelect,
      makeButton("ثبت وضعیت", "secondary-button", async () => {
        try {
          await setTournamentStatus(
            tournament.id,
            statusSelect.value,
            user
          );

          await reload();
        } catch (error) {
          showMessage(card, error.message, "error");
        }
      })
    );

    if (tournament.status === "ongoing") {
      participantIds.forEach(uid => {
        const resultSelect = makeSelect([
          ["win", "برد"],
          ["loss", "باخت"],
          ["draw", "مساوی"]
        ]);

        resultSelect.value = results[uid]?.result || "win";

        const resultRow = $("div", "tournament-result-row");

        resultRow.append(
          $("span", "", uid),
          resultSelect,
          makeButton("ثبت نتیجه", "small-button", async () => {
            try {
              await recordTournamentResult(
                tournament.id,
                uid,
                resultSelect.value,
                user
              );

              await reload();
            } catch (error) {
              showMessage(card, error.message, "error");
            }
          })
        );

        controls.appendChild(resultRow);
      });

      const championSelect = makeSelect([
        ["", "انتخاب قهرمان"],
        ...participantIds
          .filter(uid => results[uid]?.result === "win")
          .map(uid => [uid, uid])
      ]);

      controls.append(
        championSelect,
        makeButton("تعیین قهرمان و پایان مسابقه", "primary-button", async () => {
          if (!championSelect.value) {
            showMessage(card, "ابتدا قهرمان را انتخاب کن.", "error");
            return;
          }

          try {
            await setTournamentChampion(
              tournament.id,
              championSelect.value,
              user
            );

            await reload();
          } catch (error) {
            showMessage(card, error.message, "error");
          }
        })
      );
    }

    if (
      tournament.status === "completed" ||
      tournament.status === "cancelled"
    ) {
      controls.appendChild(
        makeButton("بایگانی مسابقه", "secondary-button", async () => {
          try {
            await archiveTournament(tournament.id, user);
            await reload();
          } catch (error) {
            showMessage(card, error.message, "error");
          }
        })
      );
    }

    if (isAdmin(user)) {
      controls.appendChild(
        makeButton("حذف مسابقه", "danger-button", async () => {
          if (!confirm("از حذف این مسابقه مطمئنی؟")) return;

          try {
            await deleteTournament(tournament.id, user);
            await reload();
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

async function renderRequests(container, user, reload) {
  if (!isStaff(user)) return;

  const section = $("section", "card tournament-requests");
  section.appendChild(
    $("h2", "card-title", "درخواست‌های برگزاری مسابقه")
  );

  try {
    const requests = await getTournamentRequests(user);

    if (!requests.length) {
      section.appendChild(
        $("p", "empty-state", "درخواستی برای بررسی وجود ندارد.")
      );
    }

    requests
      .filter(item => item.status === "pending")
      .forEach(item => {
        const row = $("div", "tournament-request-row");

        row.append(
          $("h3", "", item.title),
          $("p", "", `نوع: ${item.type}`),
          $("p", "", item.description || "بدون توضیحات"),
          $("p", "", `درخواست‌دهنده: ${item.requestedBy}`)
        );

        const note = makeInput("text", "یادداشت بررسی");
        note.maxLength = 500;

        row.appendChild(note);

        row.append(
          makeButton("تأیید", "primary-button", async () => {
            try {
              await reviewTournamentRequest(
                item.id,
                "approved",
                note.value,
                user
              );

              showMessage(section, "درخواست تأیید شد.", "success");
              await reload();
            } catch (error) {
              showMessage(section, error.message, "error");
            }
          }),
          makeButton("رد درخواست", "danger-button", async () => {
            try {
              await reviewTournamentRequest(
                item.id,
                "rejected",
                note.value,
                user
              );

              showMessage(section, "درخواست رد شد.", "success");
              await reload();
            } catch (error) {
              showMessage(section, error.message, "error");
            }
          })
        );

        section.appendChild(row);
      });

  } catch (error) {
    showMessage(section, error.message, "error");
  }

  container.appendChild(section);
}

export async function renderTournaments(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش مسابقات معتبر نیست.");
  }

  const loading = $("p", "loading-state", "در حال دریافت مسابقات...");
  container.replaceChildren(loading);

  try {
    const tournaments = await getTournaments(
      {},
      null
    );

    const content = $("div", "tournaments-content");

    const heading = $("section", "card");
    heading.append(
      $("h2", "card-title", "مسابقات INVICTUS"),
      $("p", "", "مدیریت رقابت‌های داخلی کلن در بخش MP و BR")
    );

    const toolbar = $("div", "tournaments-toolbar");

    const search = makeInput("search", "جستجوی مسابقه...");
    const typeFilter = makeSelect([
      ["ALL", "همه حالت‌ها"],
      ["MP", "Multiplayer"],
      ["BR", "Battle Royale"]
    ]);

    const statusFilter = makeSelect([
      ["ALL", "همه وضعیت‌ها"],
      ...Object.entries(STATUS_LABELS)
    ]);

    toolbar.append(search, typeFilter, statusFilter);

    const list = $("div", "tournaments-list");

    content.append(heading, toolbar, list);

    createTournamentForm(content, user, () =>
      renderTournaments(container, user)
    );

    createRequestForm(content, user, () =>
      renderTournaments(container, user)
    );

    await renderRequests(content, user, () =>
      renderTournaments(container, user)
    );

    function updateList() {
      const term = search.value.trim().toLocaleLowerCase();

      const filtered = tournaments.filter(item => {
        const matchesName = (item.title || "")
          .toLocaleLowerCase()
          .includes(term);

        const matchesType =
          typeFilter.value === "ALL" ||
          item.type === typeFilter.value;

        const matchesStatus =
          statusFilter.value === "ALL" ||
          item.status === statusFilter.value;

        return matchesName && matchesType && matchesStatus;
      });

      list.replaceChildren();

      if (!filtered.length) {
        list.appendChild(
          $("div", "card empty-state", "مسابقه‌ای پیدا نشد.")
        );
        return;
      }

      filtered.forEach(item => {
        list.appendChild(
          createTournamentCard(
            item,
            user,
            () => renderTournaments(container, user)
          )
        );
      });
    }

    search.addEventListener("input", updateList);
    typeFilter.addEventListener("change", updateList);
    statusFilter.addEventListener("change", updateList);

    updateList();
    container.replaceChildren(content);

  } catch (error) {
    console.error("Tournament page error:", error);

    const card = $("section", "card error-state");
    card.append(
      $("p", "", error.message || "دریافت مسابقات ناموفق بود."),
      makeButton("تلاش دوباره", "secondary-button", () =>
        renderTournaments(container, user)
      )
    );

    container.replaceChildren(card);
  }
  }
      
