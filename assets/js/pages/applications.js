
import {
  getApplications,
  assignApplicationTester,
  startApplicationTest,
  submitTestResult,
  decideApplication,
  getApplicationStatusLabel
} from "../application-tracker.js";

import { readData } from "../database.js";

const $ = (tag, className = "", text = "") => {
  const element = document.createElement(tag);

  if (className) element.className = className;

  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }

  return element;
};

const MANAGER_ROLES = ["admin", "leader"];

const STATUS_OPTIONS = [
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

const RESULT_LABELS = {
  recommended: "پیشنهاد پذیرش",
  not_recommended: "عدم پیشنهاد پذیرش",
  retest: "نیازمند تست مجدد"
};

const DECISION_LABELS = {
  accepted: "پذیرش نهایی",
  rejected: "رد درخواست",
  retest_requested: "درخواست تست مجدد"
};

function isActiveUser(user) {
  return Boolean(
    user &&
    typeof user.uid === "string" &&
    user.uid.trim() &&
    user.active === true &&
    user.status !== "banned" &&
    user.status !== "suspended"
  );
}

function isManager(user) {
  return (
    isActiveUser(user) &&
    MANAGER_ROLES.includes(user.role)
  );
}

function isTester(user) {
  return (
    isActiveUser(user) &&
    user.role === "tester" &&
    ["MP", "BR"].includes(user.specialty)
  );
}

function formatDate(value) {
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

function createButton(label, className, handler) {
  const button = $("button", className, label);

  button.type = "button";
  button.addEventListener("click", handler);

  return button;
}

function createSelect(options, className = "form-input") {
  const select = $("select", className);

  options.forEach(([value, label]) => {
    const option = $("option", "", label);

    option.value = value;
    select.appendChild(option);
  });

  return select;
}

function createField(labelText, control) {
  const wrapper = $("label", "application-field");

  wrapper.append(
    $("span", "application-field-label", labelText),
    control
  );

  return wrapper;
}

function showMessage(container, message, type = "info") {
  const box = $("div", `card application-message ${type}`, message);

  container.prepend(box);
}

function createSection(title, description = "") {
  const section = $("section", "card application-section");

  section.appendChild(
    $("h2", "card-title", title)
  );

  if (description) {
    section.appendChild(
      $("p", "application-description", description)
    );
  }

  return section;
}

function createInfo(label, value) {
  const item = $("div", "application-info-item");

  item.append(
    $("span", "application-info-label", label),
    $("strong", "application-info-value", value || "ثبت نشده")
  );

  return item;
}

function getApplicationName(application) {
  return (
    application.realName ||
    application.gameName ||
    application.email ||
    "متقاضی بدون نام"
  );
}

function getApplicationTypeLabel(type) {
  const labels = {
    MP: "Multiplayer",
    BR: "Battle Royale",
    BOTH: "MP و BR"
  };

  return labels[type] || "نامشخص";
}

function getContactTypeLabel(type) {
  const labels = {
    telegram: "تلگرام",
    rubika: "روبیکا"
  };

  return labels[String(type || "").toLowerCase()] || "نامشخص";
}

function getCompatibleSpecialties(application) {
  if (application.applicationType === "MP") {
    return ["MP"];
  }

  if (application.applicationType === "BR") {
    return ["BR"];
  }

  if (application.applicationType === "BOTH") {
    return ["MP", "BR"];
  }

  return [];
}

function getTesterName(tester) {
  return (
    tester.displayName ||
    tester.gameName ||
    tester.uid ||
    "تستر بدون نام"
  );
}

async function loadTesters() {
  const [rolesData, usersData] = await Promise.all([
    readData("roles"),
    readData("users")
  ]);

  const roles =
    rolesData && typeof rolesData === "object"
      ? rolesData
      : {};

  const users =
    usersData && typeof usersData === "object"
      ? usersData
      : {};

  return Object.entries(roles)
    .map(([uid, roleData]) => ({
      uid,
      ...(users[uid] || {}),
      ...(roleData || {})
    }))
    .filter(user =>
      user.role === "tester" &&
      user.active === true &&
      user.status !== "banned" &&
      user.status !== "suspended" &&
      ["MP", "BR"].includes(user.specialty)
    )
    .sort((a, b) =>
      getTesterName(a).localeCompare(
        getTesterName(b),
        "fa"
      )
    );
}

function createApplicationDetails(application) {
  const section = $("section", "application-details");

  const grid = $("div", "application-info-grid");

  grid.append(
    createInfo("نام واقعی", application.realName),
    createInfo("نام داخل بازی", application.gameName),
    createInfo("لول بازی", application.gameLevel),
    createInfo("نوع درخواست", getApplicationTypeLabel(application.applicationType)),
    createInfo("رنک MP", application.mpRank),
    createInfo("رنک BR", application.brRank),
    createInfo("ایمیل", application.email),

    createInfo(
      "نوع راه ارتباطی",
      getContactTypeLabel(application.contactType)
    ),

    createInfo(
      "آیدی یا شماره تماس",
      application.contactValue
    ),

    createInfo("تلگرام", application.telegram),
    createInfo("روبیکا", application.rubika)
  );

  section.appendChild(grid);

  if (application.description) {
    section.appendChild(
      $("p", "application-note",
        `توضیحات متقاضی: ${application.description}`
      )
    );
  }

  if (application.assignedTesterUid) {
    section.appendChild(
      $("p", "application-note",
        `شناسه تستر اختصاص‌یافته: ${application.assignedTesterUid}`
      )
    );
  }

  if (application.assignedSpecialty) {
    section.appendChild(
      $("p", "application-note",
        `تخصص تست: ${application.assignedSpecialty}`
      )
    );
  }

  if (application.testResult) {
    section.appendChild(
      $("p", "application-note",
        `نتیجه تست: ${RESULT_LABELS[application.testResult] || application.testResult}`
      )
    );
  }

  if (application.testNote) {
    section.appendChild(
      $("p", "application-note",
        `یادداشت تستر: ${application.testNote}`
      )
    );
  }

  if (application.leaderNote) {
    section.appendChild(
      $("p", "application-note",
        `یادداشت لیدر: ${application.leaderNote}`
      )
    );
  }

  if (application.internalNote) {
    section.appendChild(
      $("p", "application-note",
        `یادداشت داخلی: ${application.internalNote}`
      )
    );
  }

  return section;
}

function createAssignmentForm(
  application,
  testers,
  user,
  onChanged
) {
  if (!isManager(user)) return null;

  const allowedStatuses = [
    "pending",
    "awaiting_tester",
    "retest_requested"
  ];

  if (!allowedStatuses.includes(application.status)) {
    return null;
  }

  const section = createSection(
    "تخصیص تستر",
    "تستر متناسب با نوع درخواست را انتخاب کنید."
  );

  const specialties = getCompatibleSpecialties(application);

  if (!specialties.length) {
    section.appendChild(
      $("p", "empty-state", "نوع درخواست برای تخصیص تستر معتبر نیست.")
    );

    return section;
  }

  const specialtySelect = createSelect(
    specialties.map(item => [
      item,
      item === "MP" ? "تستر Multiplayer" : "تستر Battle Royale"
    ])
  );

  const testerSelect = createSelect([]);

  function updateTesterOptions() {
    const specialty = specialtySelect.value;

    const matching = testers.filter(tester =>
      tester.specialty === specialty
    );

    testerSelect.replaceChildren();

    if (!matching.length) {
      const option = $("option", "", "تستری با این تخصص پیدا نشد");

      option.value = "";
      testerSelect.appendChild(option);

      return;
    }

    const placeholder = $("option", "", "انتخاب تستر");

    placeholder.value = "";
    testerSelect.appendChild(placeholder);

    matching.forEach(tester => {
      const option = $("option", "",
        `${getTesterName(tester)} (${tester.specialty})`
      );

      option.value = tester.uid;
      testerSelect.appendChild(option);
    });
  }

  specialtySelect.addEventListener(
    "change",
    updateTesterOptions
  );

  updateTesterOptions();

  const form = $("form", "application-action-form");

  form.append(
    createField("تخصص تست", specialtySelect),
    createField("تستر", testerSelect)
  );

  const submit = $("button", "primary-button", "تخصیص تستر");

  submit.type = "submit";
  form.appendChild(submit);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!testerSelect.value) {
      showMessage(section, "ابتدا یک تستر معتبر انتخاب کنید.", "error");
      return;
    }

    submit.disabled = true;
    submit.textContent = "در حال تخصیص...";

    try {
      await assignApplicationTester(
        application.id,
        testerSelect.value,
        specialtySelect.value,
        user
      );

      showMessage(section, "تستر با موفقیت اختصاص داده شد.", "success");

      await onChanged();

    } catch (error) {
      showMessage(
        section,
        error.message || "تخصیص تستر انجام نشد.",
        "error"
      );
    } finally {
      submit.disabled = false;
      submit.textContent = "تخصیص تستر";
    }
  });

  section.appendChild(form);

  return section;
}

function createTesterActions(application, user, onChanged) {
  if (!isTester(user)) return null;

  const section = createSection(
    "عملیات تستر",
    "نتیجه بررسی خود را پس از انجام تست ثبت کنید."
  );

  if (application.status === "awaiting_test") {
    section.appendChild(
      createButton(
        "شروع تست",
        "secondary-button",
        async () => {
          try {
            await startApplicationTest(
              application.id,
              user
            );

            await onChanged();

          } catch (error) {
            showMessage(
              section,
              error.message || "شروع تست انجام نشد.",
              "error"
            );
          }
        }
      )
    );
  }

  if (
    ["awaiting_test", "testing"].includes(application.status)
  ) {
    const form = $("form", "application-action-form");

    const resultSelect = createSelect([
      ["recommended", "پیشنهاد پذیرش"],
      ["not_recommended", "عدم پیشنهاد پذیرش"],
      ["retest", "نیازمند تست مجدد"]
    ]);

    const note = $("textarea", "form-input");

    note.placeholder = "توضیحات و دلیل نتیجه تست...";
    note.maxLength = 1000;
    note.rows = 4;

    const submit = $("button", "primary-button", "ثبت نتیجه تست");

    submit.type = "submit";

    form.append(
      createField("نتیجه تست", resultSelect),
      createField("توضیحات تست", note),
      submit
    );

    form.addEventListener("submit", async event => {
      event.preventDefault();

      submit.disabled = true;
      submit.textContent = "در حال ثبت...";

      try {
        await submitTestResult(
          application.id,
          resultSelect.value,
          note.value,
          user
        );

        showMessage(section, "نتیجه تست ثبت شد.", "success");

        await onChanged();

      } catch (error) {
        showMessage(
          section,
          error.message || "ثبت نتیجه تست انجام نشد.",
          "error"
        );
      } finally {
        submit.disabled = false;
        submit.textContent = "ثبت نتیجه تست";
      }
    });

    section.appendChild(form);
  }

  return section;
}

function createLeaderDecisionForm(application, user, onChanged) {
  if (!isManager(user)) return null;

  const allowedStatuses = [
    "pending",
    "awaiting_tester",
    "awaiting_leader",
    "retest_requested"
  ];

  if (!allowedStatuses.includes(application.status)) {
    return null;
  }

  const section = createSection(
    "تصمیم نهایی لیدر",
    "تصمیم نهایی درخواست را ثبت کنید. تستر اجازه پذیرش یا رد نهایی ندارد."
  );

  const decisionSelect = createSelect([
    ["rejected", "رد درخواست"],
    ["retest_requested", "درخواست تست مجدد"],
    ["accepted", "پذیرش نهایی"]
  ]);

  if (
    !["pending", "awaiting_leader"].includes(application.status)
  ) {
    const acceptOption = decisionSelect.querySelector(
      'option[value="accepted"]'
    );

    if (acceptOption) {
      acceptOption.disabled = true;
    }
  }

  const note = $("textarea", "form-input");

  note.placeholder = "دلیل تصمیم یا توضیحات لیدر...";
  note.maxLength = 1000;
  note.rows = 4;

  const form = $("form", "application-action-form");

  const submit = $("button", "primary-button", "ثبت تصمیم");

  submit.type = "submit";

  form.append(
    createField("تصمیم", decisionSelect),
    createField("توضیحات", note),
    submit
  );

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (
      decisionSelect.value === "accepted" &&
      !["pending", "awaiting_leader"].includes(application.status)
    ) {
      showMessage(
        section,
        "این درخواست هنوز آماده پذیرش نهایی نیست.",
        "error"
      );

      return;
    }

    const confirmed = confirm(
      `تصمیم «${DECISION_LABELS[decisionSelect.value]}» ثبت شود؟`
    );

    if (!confirmed) return;

    submit.disabled = true;
    submit.textContent = "در حال ثبت تصمیم...";

    try {
      await decideApplication(
        application.id,
        decisionSelect.value,
        note.value,
        user
      );

      showMessage(section, "تصمیم نهایی ثبت شد.", "success");

      await onChanged();

    } catch (error) {
      showMessage(
        section,
        error.message || "ثبت تصمیم انجام نشد.",
        "error"
      );
    } finally {
      submit.disabled = false;
      submit.textContent = "ثبت تصمیم";
    }
  });

  section.appendChild(form);

  return section;
}

function createApplicationCard(
  application,
  user,
  testers,
  onChanged
) {
  const card = $("article", "card application-card");

  const header = $("div", "application-card-header");

  const title = $("h2", "card-title", getApplicationName(application));

  const status = $("span", "application-status",
    getApplicationStatusLabel(application.status)
  );

  header.append(title, status);

  card.appendChild(header);

  card.append(
    $("p", "application-meta",
      `نام بازی: ${application.gameName || "ثبت نشده"}`
    ),
    $("p", "application-meta",
      `تاریخ ثبت: ${formatDate(application.createdAt)}`
    ),
    $("p", "application-meta",
      `شناسه درخواست: ${application.id}`
    )
  );

  card.appendChild(
    createApplicationDetails(application)
  );

  const assignment = createAssignmentForm(
    application,
    testers,
    user,
    onChanged
  );

  if (assignment) {
    card.appendChild(assignment);
  }

  const testerActions = createTesterActions(
    application,
    user,
    onChanged
  );

  if (testerActions) {
    card.appendChild(testerActions);
  }

  const leaderForm = createLeaderDecisionForm(
    application,
    user,
    onChanged
  );

  if (leaderForm) {
    card.appendChild(leaderForm);
  }

  return card;
}

function createSummary(applications) {
  const summary = $("section", "application-summary");

  const count = status =>
    applications.filter(item => item.status === status).length;

  const items = [
    ["کل درخواست‌ها", applications.length],
    ["در انتظار بررسی", count("pending")],
    ["در انتظار تست", count("awaiting_test")],
    ["در انتظار لیدر", count("awaiting_leader")],
    ["پذیرفته‌شده", count("accepted")],
    ["ردشده", count("rejected")]
  ];

  items.forEach(([label, value]) => {
    const box = $("div", "card application-stat");

    box.append(
      $("span", "application-stat-label", label),
      $("strong", "application-stat-value",
        new Intl.NumberFormat("fa-IR").format(value)
      )
    );

    summary.appendChild(box);
  });

  return summary;
}

export async function renderApplications(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش درخواست‌ها معتبر نیست.");
  }

  if (!isManager(user) && !isTester(user)) {
    container.replaceChildren(
      $("section", "card error-state",
        "دسترسی به مدیریت درخواست‌های عضویت برای حساب شما مجاز نیست."
      )
    );

    return;
  }

  container.replaceChildren(
    $("p", "loading-state", "در حال دریافت درخواست‌های عضویت...")
  );

  const load = async () => {
    container.replaceChildren(
      $("p", "loading-state", "در حال دریافت اطلاعات...")
    );

    try {
      const [applications, testers] = await Promise.all([
        getApplications(user),
        isManager(user) ? loadTesters() : Promise.resolve([])
      ]);

      const content = $("div", "applications-page");

      const heading = createSection(
        "مدیریت درخواست‌های عضویت INVICTUS",
        isTester(user)
          ? `درخواست‌های اختصاص‌یافته به شما در تخصص ${user.specialty}`
          : "بررسی متقاضیان، تخصیص تستر و تصمیم‌گیری نهایی"
      );

      const toolbar = $("div", "applications-toolbar");

      const search = $("input", "form-input");
      search.type = "search";
      search.placeholder = "جستجو با نام، ایمیل، نام بازی یا اطلاعات تماس...";

      const statusFilter = createSelect(STATUS_OPTIONS);

      toolbar.append(search, statusFilter);

      const list = $("div", "applications-list");

      const refresh = createButton(
        "به‌روزرسانی درخواست‌ها",
        "secondary-button",
        load
      );

      function updateList() {
        const term = normalize(search.value);
        const selectedStatus = statusFilter.value;

        const filtered = applications.filter(application => {
          const searchText = normalize([
            application.realName,
            application.gameName,
            application.email,
            application.uid,
            application.id,
            application.contactType,
            application.contactValue,
            application.telegram,
            application.rubika
          ].join(" "));

          const matchesSearch = searchText.includes(term);

          const matchesStatus =
            !selectedStatus ||
            application.status === selectedStatus;

          return matchesSearch && matchesStatus;
        });

        list.replaceChildren();

        if (!filtered.length) {
          list.appendChild(
            $("section", "card empty-state",
              "درخواستی با این مشخصات پیدا نشد."
            )
          );

          return;
        }

        filtered.forEach(application => {
          list.appendChild(
            createApplicationCard(
              application,
              user,
              testers,
              load
            )
          );
        });
      }

      search.addEventListener("input", updateList);
      statusFilter.addEventListener("change", updateList);

      content.append(
        heading,
        createSummary(applications),
        toolbar,
        list,
        refresh
      );

      updateList();

      container.replaceChildren(content);

    } catch (error) {
      console.error("Applications page error:", error);

      const errorCard = $("section", "card error-state");

      errorCard.append(
        $("p", "",
          error.message || "دریافت درخواست‌های عضویت ناموفق بود."
        ),
        createButton("تلاش دوباره", "secondary-button", load)
      );

