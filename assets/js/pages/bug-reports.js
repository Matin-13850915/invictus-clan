
import {
  createBugReport,
  getMyBugReports,
  getAllBugReports,
  updateBugReportStatus,
  replyToBugReport,
  assignBugReport
} from "../bug-reports.js";

const $ = (tag, className = "", value = "") => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = String(value ?? "");
  return el;
};

const CATEGORIES = {
  login: "ورود و حساب کاربری",
  display: "نمایش و ظاهر",
  chat: "چت و پیام‌ها",
  profile: "پروفایل",
  performance: "سرعت و عملکرد",
  other: "سایر موارد"
};

const STATUSES = {
  open: "جدید",
  in_progress: "در حال بررسی",
  resolved: "حل‌شده",
  closed: "بسته‌شده"
};

function dateText(value) {
  const date = new Date(Number(value));

  if (!value || Number.isNaN(date.getTime())) {
    return "نامشخص";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function button(label, callback) {
  const el = $("button", "secondary-button", label);
  el.type = "button";
  el.addEventListener("click", callback);
  return el;
}

function field(labelText, control) {
  const wrapper = $("label", "form-field");
  wrapper.append($("span", "field-label", labelText), control);
  return wrapper;
}

function createReportCard(report, user, reload) {
  const card = $("article", "card bug-report-card");
  const staff = ["admin", "leader"].includes(user.role);

  card.append(
    $("h3", "report-title", report.title),
    $("p", "", `دسته: ${CATEGORIES[report.category] || report.category}`),
    $("p", "", `وضعیت: ${STATUSES[report.status] || report.status}`),
    $("p", "", `ثبت‌کننده: ${report.reporterName || report.uid}`),
    $("p", "", `زمان ثبت: ${dateText(report.createdAt)}`),
    $("p", "report-description", report.description)
  );

  if (report.page) {
    card.appendChild($("p", "", `صفحه مشکل: ${report.page}`));
  }

  if (report.staffReply) {
    card.append(
      $("h4", "", "پاسخ مدیریت"),
      $("p", "staff-reply", report.staffReply),
      $("small", "", `زمان پاسخ: ${dateText(report.repliedAt)}`)
    );
  }

  if (staff) {
    const actions = $("div", "report-actions");

    const statusSelect = $("select", "form-control");
    statusSelect.append(
      new Option("جدید", "open"),
      new Option("در حال بررسی", "in_progress"),
      new Option("حل‌شده", "resolved"),
      new Option("بسته‌شده", "closed")
    );
    statusSelect.value = report.status;

    actions.appendChild(field("تغییر وضعیت", statusSelect));

    actions.appendChild(button("ثبت وضعیت", async () => {
      try {
        await updateBugReportStatus(
          report.id,
          statusSelect.value,
          user
        );
        alert("وضعیت گزارش به‌روزرسانی شد.");
        await reload();
      } catch (error) {
        alert(error.message || "تغییر وضعیت انجام نشد.");
      }
    }));

    const replyInput = $("textarea", "form-control");
    replyInput.rows = 3;
    replyInput.maxLength = 2000;
    replyInput.placeholder = "پاسخ مدیریت به گزارش...";

    if (report.staffReply) replyInput.value = report.staffReply;

    actions.appendChild(field("پاسخ مدیریت", replyInput));

    actions.appendChild(button("ارسال پاسخ", async () => {
      try {
        await replyToBugReport(
          report.id,
          replyInput.value,
          user
        );
        alert("پاسخ ثبت شد.");
        await reload();
      } catch (error) {
        alert(error.message || "ثبت پاسخ انجام نشد.");
      }
    }));

    const assignInput = $("input", "form-control");
    assignInput.placeholder = "UID مسئول";
    assignInput.value = report.assignedTo || "";

    actions.appendChild(field("ارجاع به مسئول", assignInput));

    actions.appendChild(button("ثبت مسئول", async () => {
      try {
        await assignBugReport(
          report.id,
          assignInput.value.trim(),
          user
        );
        alert("مسئول گزارش ثبت شد.");
        await reload();
      } catch (error) {
        alert(error.message || "ارجاع گزارش انجام نشد.");
      }
    }));

    card.appendChild(actions);
  }

  return card;
}

export async function renderBugReports(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش گزارش‌ها معتبر نیست.");
  }

  if (!user?.uid) {
    container.replaceChildren(
      $("div", "card error-state", "ابتدا وارد حساب خود شوید.")
    );
    return;
  }

  const staff = ["admin", "leader"].includes(user.role);

  const load = async () => {
    container.replaceChildren(
      $("p", "loading-state", "در حال دریافت گزارش‌ها...")
    );

    try {
      const reports = staff
        ? await getAllBugReports(user)
        : await getMyBugReports(user);

      const page = $("div", "bug-reports-page");

      const header = $("section", "card");
      header.append(
        $("h1", "card-title", "گزارش مشکلات سایت"),
        $("p", "", staff
          ? "گزارش‌های ثبت‌شده توسط اعضا"
          : "ثبت مشکل و پیگیری وضعیت گزارش‌های شما"
        )
      );

      page.appendChild(header);

      if (!staff) {
        const form = $("form", "card bug-report-form");

        const title = $("input", "form-control");
        title.required = true;
        title.maxLength = 100;
        title.placeholder = "عنوان مشکل";

        const category = $("select", "form-control");
        Object.entries(CATEGORIES).forEach(([value, label]) => {
          category.appendChild(new Option(label, value));
        });

        const description = $("textarea", "form-control");
        description.required = true;
        description.maxLength = 3000;
        description.rows = 5;
        description.placeholder = "مشکل را کامل توضیح بده...";

        const pageInput = $("input", "form-control");
        pageInput.maxLength = 100;
        pageInput.placeholder = "نام صفحه (اختیاری)";

        const submit = $("button", "primary-button", "ثبت گزارش");
        submit.type = "submit";

        form.append(
          $("h2", "section-title", "ثبت گزارش جدید"),
          field("عنوان", title),
          field("دسته‌بندی", category),
          field("توضیحات", description),
          field("صفحه مربوطه", pageInput),
          submit
        );

        form.addEventListener("submit", async event => {
          event.preventDefault();

          if (!form.reportValidity()) return;

          submit.disabled = true;

          try {
            await createBugReport({
              title: title.value,
              category: category.value,
              description: description.value,
              page: pageInput.value
            }, user);

            alert("گزارش شما ثبت شد.");
            form.reset();
            await load();
          } catch (error) {
            alert(error.message || "ثبت گزارش انجام نشد.");
          } finally {
            submit.disabled = false;
          }
        });

        page.appendChild(form);
      }

      const list = $("section", "bug-report-list");
      list.appendChild(
        $("h2", "section-title", "گزارش‌های ثبت‌شده")
      );

      if (!reports.length) {
        list.appendChild(
          $("div", "card empty-state", "هنوز گزارشی ثبت نشده است.")
        );
      } else {
        reports.forEach(report => {
          list.appendChild(createReportCard(report, user, load));
        });
      }

      page.append(
        list,
        button("به‌روزرسانی", load)
      );

      container.replaceChildren(page);

    } catch (error) {
      console.error("Bug reports error:", error);

      container.replaceChildren(
        $("div", "card error-state",
          error.message || "دریافت گزارش‌ها ناموفق بود."
        ),
        button("تلاش دوباره", load)
      );
    }
  };

  await load();
  }
        
