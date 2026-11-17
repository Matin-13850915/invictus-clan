
import {
  getApplications,
  assignApplicationTester,
  startApplicationTest,
  submitTestResult,
  decideApplication,
  getApplicationStatusLabel
} from "../application-tracker.js";

import { readData } from "../database.js";

const MANAGERS = ["admin", "leader"];

const STATUSES = [
  ["", "همه وضعیت‌ها"],
  ["pending", "در انتظار بررسی"],
  ["awaiting_tester", "در انتظار تعیین تستر"],
  ["awaiting_test", "در انتظار انجام تست"],
  ["testing", "در حال تست"],
  ["awaiting_leader", "در انتظار تصمیم لیدر"],
  ["retest_requested", "درخواست تست مجدد"],
  ["accepted", "پذیرفته شده"],
  ["rejected", "رد شده"],
  ["withdrawn", "انصراف داده شده"],
  ["expired", "منقضی شده"]
];

const RESULTS = {
  recommended: "پیشنهاد پذیرش",
  not_recommended: "عدم پیشنهاد پذیرش",
  retest: "نیازمند تست مجدد"
};

const DECISIONS = {
  accepted: "پذیرش نهایی",
  rejected: "رد درخواست",
  retest_requested: "درخواست تست مجدد"
};

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text !== undefined && text !== null) {
    node.textContent = String(text);
  }

  return node;
}

function active(user) {
  return Boolean(
    user?.uid &&
    user.active === true &&
    user.status !== "banned" &&
    user.status !== "suspended"
  );
}

function manager(user) {
  return active(user) && MANAGERS.includes(user.role);
}

function tester(user) {
  return (
    active(user) &&
    user.role === "tester" &&
    ["MP", "BR"].includes(user.specialty)
  );
}

function button(text, handler, className = "secondary-button") {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", handler);
  return node;
}

function select(options) {
  const node = el("select", "form-input");

  options.forEach(([value, label]) => {
    const option = el("option", "", label);
    option.value = value;
    node.appendChild(option);
  });

  return node;
}

function field(label, control) {
  const wrapper = el("label", "application-field");

  wrapper.append(
    el("span", "application-field-label", label),
    control
  );

  return wrapper;
}

function section(title, description = "") {
  const node = el("section", "card application-section");

  node.appendChild(el("h2", "card-title", title));

  if (description) {
    node.appendChild(
      el("p", "application-description", description)
    );
  }

  return node;
}

function message(parent, text, type = "info") {
  parent.prepend(
    el("div", `card application-message ${type}`, text)
  );
}

function info(label, value) {
  const node = el("div", "application-info-item");

  node.append(
    el("span", "application-info-label", label),
    el(
      "strong",
      "application-info-value",
      value === 0 ? "0" : value || "ثبت نشده"
    )
  );

  return node;
}

function date(value) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "ثبت نشده";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("fa")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک");
}

function contactLabel(type) {
  const labels = {
    telegram: "تلگرام",
    rubika: "روبیکا"
  };

  return labels[String(type || "").toLowerCase()] || "نامشخص";
}

function typeLabel(type) {
  const labels = {
    MP: "Multiplayer",
    BR: "Battle Royale",
    BOTH: "MP و BR"
  };

  return labels[type] || "نامشخص";
}

function applicationName(app) {
  return (
    app.realName ||
    app.gameName ||
    app.email ||
    "متقاضی بدون نام"
  );
}

function compatibleSpecialties(app) {
  if (app.applicationType === "MP") return ["MP"];
  if (app.applicationType === "BR") return ["BR"];
  if (app.applicationType === "BOTH") return ["MP", "BR"];

  return [];
}

function testerName(user) {
  return user.displayName || user.gameName || user.uid;
}

async function loadTesters() {
  const [rolesData, usersData] = await Promise.all([
    readData("roles"),
    readData("users")
  ]);

  const roles = rolesData || {};
  const users = usersData || {};

  return Object.entries(roles)
    .map(([uid, role]) => ({
      uid,
      ...(users[uid] || {}),
      ...(role || {})
    }))
    .filter(user =>
      user.role === "tester" &&
      user.active === true &&
      user.status !== "banned" &&
      user.status !== "suspended" &&
      ["MP", "BR"].includes(user.specialty)
    )
    .sort((a, b) =>
      testerName(a).localeCompare(testerName(b), "fa")
    );
}

function applicationDetails(app) {
  const wrapper = el("section", "application-details");
  const grid = el("div", "application-info-grid");

  grid.append(
    info("نام واقعی", app.realName),
    info("نام داخل بازی", app.gameName),
    info("لول بازی", app.gameLevel),
    info("نوع درخواست", typeLabel(app.applicationType)),
    info("رنک MP", app.mpRank),
    info("رنک BR", app.brRank),
    info("ایمیل", app.email),
    info("نوع راه ارتباطی", contactLabel(app.contactType)),
    info("آیدی یا شماره تماس", app.contactValue),
    info("تلگرام", app.telegram),
    info("روبیکا", app.rubika)
  );

  wrapper.appendChild(grid);

  const notes = [
    ["توضیحات متقاضی", app.description],
    ["شناسه تستر", app.assignedTesterUid],
    ["تخصص تست", app.assignedSpecialty],
    ["نتیجه تست", RESULTS[app.testResult] || app.testResult],
    ["یادداشت تستر", app.testNote],
    ["یادداشت لیدر", app.leaderNote],
    ["یادداشت داخلی", app.internalNote]
  ];

  notes.forEach(([label, value]) => {
    if (value) {
      wrapper.appendChild(
        el("p", "application-note", `${label}: ${value}`)
      );
    }
  });

  return wrapper;
}

function assignmentForm(app, testers, user, reload) {
  if (!manager(user)) return null;

  if (![
    "pending",
    "awaiting_tester",
    "retest_requested"
  ].includes(app.status)) {
    return null;
  }

  const box = section(
    "تخصیص تستر",
    "تستر متناسب با نوع درخواست را انتخاب کنید."
  );

  const specialties = compatibleSpecialties(app);

  if (!specialties.length) {
    box.appendChild(
      el("p", "empty-state", "نوع درخواست معتبر نیست.")
    );
    return box;
  }

  const specialty = select(
    specialties.map(value => [
      value,
      value === "MP" ? "تستر Multiplayer" : "تستر Battle Royale"
    ])
  );

  const testerSelect = select([]);

  function updateTesters() {
    testerSelect.replaceChildren();

    const matching = testers.filter(item =>
      item.specialty === specialty.value
    );

    const placeholder = el(
      "option",
      "",
      matching.length ? "انتخاب تستر" : "تستری پیدا نشد"
    );

    placeholder.value = "";
    testerSelect.appendChild(placeholder);

    matching.forEach(item => {
      const option = el(
        "option",
        "",
        `${testerName(item)} (${item.specialty})`
      );

      option.value = item.uid;
      testerSelect.appendChild(option);
    });
  }

  specialty.addEventListener("change", updateTesters);
  updateTesters();

  const form = el("form", "application-action-form");
  const submit = el("button", "primary-button", "تخصیص تستر");

  submit.type = "submit";

  form.append(
    field("تخصص تست", specialty),
    field("تستر", testerSelect),
    submit
  );

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!testerSelect.value) {
      message(box, "ابتدا تستر را انتخاب کنید.", "error");
      return;
    }

    submit.disabled = true;

    try {
      await assignApplicationTester(
        app.id,
        testerSelect.value,
        specialty.value,
        user
      );

      await reload();

    } catch (error) {
      message(box, error.message || "تخصیص تستر ناموفق بود.", "error");
      submit.disabled = false;
    }
  });

  box.appendChild(form);
  return box;
}

function testerActions(app, user, reload) {
  if (!tester(user)) return null;

  const box = section(
    "عملیات تستر",
    "نتیجه بررسی را پس از انجام تست ثبت کنید."
  );

  if (app.status === "awaiting_test") {
    box.appendChild(
      button("شروع تست", async () => {
        try {
          await startApplicationTest(app.id, user);
          await reload();
        } catch (error) {
          message(box, error.message || "شروع تست ناموفق بود.", "error");
        }
      })
    );
  }

  if (["awaiting_test", "testing"].includes(app.status)) {
    const result = select([
      ["recommended", "پیشنهاد پذیرش"],
      ["not_recommended", "عدم پیشنهاد پذیرش"],
      ["retest", "نیازمند تست مجدد"]
    ]);

    const note = el("textarea", "form-input");
    note.placeholder = "توضیحات و دلیل نتیجه تست...";
    note.maxLength = 1000;
    note.rows = 4;

    const form = el("form", "application-action-form");
    const submit = el("button", "primary-button", "ثبت نتیجه تست");

    submit.type = "submit";

    form.append(
      field("نتیجه تست", result),
      field("توضیحات تست", note),
      submit
    );

    form.addEventListener("submit", async event => {
      event.preventDefault();
      submit.disabled = true;

      try {
        await submitTestResult(
          app.id,
          result.value,
          note.value,
          user
        );

        await reload();

      } catch (error) {
        message(box, error.message || "ثبت نتیجه ناموفق بود.", "error");
        submit.disabled = false;
      }
    });

    box.appendChild(form);
  }

  return box;
}

function leaderDecision(app, user, reload) {
  if (!manager(user)) return null;

  const allowed = [
    "pending",
    "awaiting_tester",
    "awaiting_leader",
    "retest_requested"
  ];

  if (!allowed.includes(app.status)) return null;

  const box = section(
    "تصمیم نهایی لیدر",
    "تستر اجازه پذیرش یا رد نهایی ندارد."
  );

  const decision = select([
    ["rejected", "رد درخواست"],
    ["retest_requested", "درخواست تست مجدد"],
    ["accepted", "پذیرش نهایی"]
  ]);

  if (!["pending", "awaiting_leader"].includes(app.status)) {
    decision.querySelector('option[value="accepted"]').disabled = true;
  }

  const note = el("textarea", "form-input");
  note.placeholder = "دلیل تصمیم یا توضیحات لیدر...";
  note.maxLength = 1000;
  note.rows = 4;

  const form = el("form", "application-action-form");
  const submit = el("button", "primary-button", "ثبت تصمیم");

  submit.type = "submit";

  form.append(
    field("تصمیم", decision),
    field("توضیحات", note),
    submit
  );

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (
      decision.value === "accepted" &&
      !["pending", "awaiting_leader"].includes(app.status)
    ) {
      message(box, "این درخواست آماده پذیرش نهایی نیست.", "error");
      return;
    }

    if (!confirm(`تصمیم «${DECISIONS[decision.value]}» ثبت شود؟`)) {
      return;
    }

    submit.disabled = true;

    try {
      await decideApplication(
        app.id,
        decision.value,
        note.value,
        user
      );

      await reload();

    } catch (error) {
      message(box, error.message || "ثبت تصمیم ناموفق بود.", "error");
      submit.disabled = false;
    }
  });

  box.appendChild(form);
  return box;
}

function applicationCard(app, user, testers, reload) {
  const card = el("article", "card application-card");

  const header = el("div", "application-card-header");

  header.append(
    el("h2", "card-title", applicationName(app)),
    el(
      "span",
      "application-status",
      getApplicationStatusLabel(app.status)
    )
  );

  card.append(
    header,
    el("p", "application-meta", `نام بازی: ${app.gameName || "ثبت نشده"}`),
    el("p", "application-meta", `تاریخ ثبت: ${date(app.createdAt)}`),
    el("p", "application-meta", `شناسه درخواست: ${app.id}`),
    applicationDetails(app)
  );

  const assignment = assignmentForm(app, testers, user, reload);
  const actions = testerActions(app, user, reload);
  const decision = leaderDecision(app, user, reload);

  if (assignment) card.appendChild(assignment);
  if (actions) card.appendChild(actions);
  if (decision) card.appendChild(decision);

  return card;
}

function summary(applications) {
  const box = el("section", "application-summary");

  const counts = [
    ["کل درخواست‌ها", applications.length],
    ["در انتظار بررسی", applications.filter(x => x.status === "pending").length],
    ["در انتظار تست", applications.filter(x => x.status === "awaiting_test").length],
    ["در انتظار لیدر", applications.filter(x => x.status === "awaiting_leader").length],
    ["پذیرفته‌شده", applications.filter(x => x.status === "accepted").length],
    ["ردشده", applications.filter(x => x.status === "rejected").length]
  ];

  counts.forEach(([label, count]) => {
    const item = el("div", "card application-stat");

    item.append(
      el("span", "application-stat-label", label),
      el(
        "strong",
        "application-stat-value",
        new Intl.NumberFormat("fa-IR").format(count)
      )
    );

    box.appendChild(item);
  });

  return box;
}

export async function renderApplications(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش درخواست‌ها معتبر نیست.");
  }

  if (!manager(user) && !tester(user)) {
    container.replaceChildren(
      el("section", "card error-state",
        "دسترسی به مدیریت درخواست‌های عضویت برای حساب شما مجاز نیست."
      )
    );
    return;
  }

  const load = async () => {
    container.replaceChildren(
      el("p", "loading-state", "در حال دریافت درخواست‌ها...")
    );

    try {
      const [applications, testers] = await Promise.all([
        getApplications(user),
        manager(user) ? loadTesters() : Promise.resolve([])
      ]);

      const page = el("div", "applications-page");

      const heading = section(
        "مدیریت درخواست‌های عضویت INVICTUS",
        tester(user)
          ? `درخواست‌های اختصاص‌یافته به شما در تخصص ${user.specialty}`
          : "بررسی متقاضیان، تخصیص تستر و تصمیم‌گیری نهایی"
      );

      const toolbar = el("div", "applications-toolbar");

      const search = el("input", "form-input");
      search.type = "search";
      search.placeholder = "جستجو با نام، ایمیل، نام بازی یا اطلاعات تماس...";

      const statusFilter = select(STATUSES);

      toolbar.append(search, statusFilter);

      const list = el("div", "applications-list");

      function updateList() {
        const term = normalize(search.value);
        const status = statusFilter.value;

        const filtered = applications.filter(app => {
          const searchable = normalize([
            app.realName,
            app.gameName,
            app.email,
            app.uid,
            app.id,
            app.contactType,
            app.contactValue,
            app.telegram,
            app.rubika
          ].join(" "));

          return (
            searchable.includes(term) &&
            (!status || app.status === status)
          );
        });

        list.replaceChildren();

        if (!filtered.length) {
          list.appendChild(
            el("section", "card empty-state",
              "درخواستی با این مشخصات پیدا نشد."
            )
          );
          return;
        }

        filtered.forEach(app => {
          list.appendChild(
            applicationCard(app, user, testers, load)
          );
        });
      }

      search.addEventListener("input", updateList);
      statusFilter.addEventListener("change", updateList);

      page.append(
        heading,
        summary(applications),
        toolbar,
        list,
        button("به‌روزرسانی درخواست‌ها", load)
      );

      container.replaceChildren(page);
      updateList();

    } catch (error) {
      console.error("Applications page error:", error);

      const errorBox = el("section", "card error-state");

      errorBox.append(
        el(
          "p",
          "",
          error.message || "دریافت درخواست‌های عضویت ناموفق بود."
        ),
        button("تلاش دوباره", load)
      );

      container.replaceChildren(errorBox);
    }
  };

  await load();
}
