
import {
  createTicket,
  getMyTickets,
  getAllTickets,
  getTicketReplies,
  replyToTicket,
  assignTicketToTester,
  unassignTicketTester,
  closeTicket,
  reopenTicket
} from "../tickets.js";

import { readData } from "../database.js";

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

const isStaff = user =>
  user?.active === true &&
  ["admin", "leader", "tester"].includes(user.role);

const categories = {
  account: "حساب کاربری",
  application: "درخواست عضویت",
  test: "تست و ارزیابی",
  war: "مسابقات و کلن‌وار",
  chat: "چت و ارتباطات",
  other: "سایر موارد"
};

const $button = (label, className, action) => {
  const el = $("button", className, label);
  el.type = "button";
  el.addEventListener("click", action);
  return el;
};

function field(label, control) {
  const wrapper = $("label", "ticket-field");
  wrapper.append($("span", "", label), control);
  return wrapper;
}

function input(type, placeholder = "") {
  const el = $("input", "ticket-input");
  el.type = type;
  el.placeholder = placeholder;
  return el;
}

function textarea(placeholder = "") {
  const el = $("textarea", "ticket-input");
  el.placeholder = placeholder;
  el.maxLength = 3000;
  el.rows = 5;
  return el;
}

function showMessage(container, text, type = "info") {
  container.prepend(
    $("div", `card ticket-message ${type}`, text)
  );
}

function formatDate(value) {
  const date = new Date(Number(value));

  if (!Number.isFinite(date.getTime())) {
    return "نامشخص";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function statusLabel(status) {
  return status === "closed" ? "بسته‌شده" : "باز";
}

function createTicketForm(container, user, reload) {
  const card = $("section", "card ticket-create-card");

  card.appendChild(
    $("h2", "card-title", "ثبت تیکت جدید")
  );

  const title = input("text", "موضوع تیکت");
  title.maxLength = 100;

  const category = $("select", "ticket-input");

  Object.entries(categories).forEach(([value, label]) => {
    const option = $("option", "", label);
    option.value = value;
    category.appendChild(option);
  });

  const body = textarea("متن کامل درخواست خود را بنویسید...");

  const form = $("form", "ticket-form");

  form.append(
    field("عنوان", title),
    field("دسته‌بندی", category),
    field("شرح درخواست", body)
  );

  const submit = $("button", "primary-button", "ارسال تیکت");
  submit.type = "submit";
  form.appendChild(submit);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    submit.disabled = true;
    submit.textContent = "در حال ارسال...";

    try {
      await createTicket({
        title: title.value,
        category: category.value,
        body: body.value
      }, user);

      showMessage(card, "تیکت شما ثبت شد.", "success");
      form.reset();
      await reload();

    } catch (error) {
      showMessage(card, error.message, "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "ارسال تیکت";
    }
  });

  container.appendChild(card);
}

async function loadTesters() {
  const roles = await readData("roles");

  if (!roles || typeof roles !== "object") {
    return [];
  }

  return Object.entries(roles)
    .filter(([, user]) =>
      user &&
      user.role === "tester" &&
      user.active === true &&
      ["MP", "BR"].includes(user.specialty)
    )
    .map(([uid, user]) => ({
      uid,
      ...user
    }));
}

async function showReplies(card, ticket, user) {
  const section = $("section", "ticket-replies");

  section.appendChild(
    $("h3", "section-title", "گفتگو")
  );

  section.appendChild(
    $("p", "loading-state", "در حال دریافت پیام‌ها...")
  );

  try {
    const replies = await getTicketReplies(ticket.id, user);
    section.replaceChildren(
      $("h3", "section-title", `گفتگو (${replies.length})`)
    );

    if (!replies.length) {
      section.appendChild(
        $("p", "empty-state", "هنوز پاسخی ثبت نشده است.")
      );
    }

    replies.forEach(reply => {
      const item = $("article", "ticket-reply");

      item.append(
        $("div", "ticket-reply-header",
          `${reply.displayName || "کاربر"} · ${formatDate(reply.createdAt)}`
        ),
        $("p", "ticket-reply-body", reply.message || "")
      );

      section.appendChild(item);
    });

    if (ticket.status !== "closed") {
      const form = $("form", "ticket-reply-form");
      const replyInput = textarea("پاسخ خود را بنویسید...");
      replyInput.maxLength = 2000;

      const submit = $("button", "primary-button", "ارسال پاسخ");
      submit.type = "submit";

      form.append(replyInput, submit);

      form.addEventListener("submit", async event => {
        event.preventDefault();

        if (!replyInput.value.trim()) return;

        submit.disabled = true;

        try {
          await replyToTicket(
            ticket.id,
            replyInput.value,
            user
          );

          await showReplies(card, ticket, user);
        } catch (error) {
          showMessage(card, error.message, "error");
        } finally {
          submit.disabled = false;
        }
      });

      section.appendChild(form);
    }

  } catch (error) {
    section.replaceChildren(
      $("p", "error-state", error.message || "دریافت گفتگو ناموفق بود.")
    );
  }

  card.appendChild(section);
}

async function createTicketCard(ticket, user, reload) {
  const card = $("article", "card ticket-card");

  const header = $("div", "ticket-card-header");

  header.append(
    $("h3", "card-title", ticket.title || "بدون عنوان"),
    $("span",
      `ticket-status ${ticket.status === "closed" ? "closed" : "open"}`,
      statusLabel(ticket.status)
    )
  );

  card.append(
    header,
    $("p", "ticket-category",
      `دسته‌بندی: ${categories[ticket.category] || ticket.category}`
    ),
    $("p", "ticket-meta",
      `شناسه: ${ticket.id}`
    ),
    $("p", "ticket-meta",
      `ثبت: ${formatDate(ticket.createdAt)}`
    ),
    $("p", "ticket-meta",
      `آخرین تغییر: ${formatDate(ticket.updatedAt)}`
    ),
    $("p", "ticket-owner",
      `شناسه ثبت‌کننده: ${ticket.ownerUid || "نامشخص"}`
    ),
    $("div", "ticket-body", ticket.body || "")
  );

  if (ticket.assignedTesterUid) {
    card.appendChild(
      $("p", "ticket-assigned",
        `تستر مسئول: ${ticket.assignedTesterUid}`
      )
    );
  }

  if (isManager(user) && ticket.category === "test" &&
      ticket.status !== "closed") {
    const controls = $("div", "ticket-controls");

    controls.appendChild(
      $button("تخصیص تستر", "secondary-button", async () => {
        try {
          const testers = await loadTesters();

          if (!testers.length) {
            showMessage(card, "تستر فعالی پیدا نشد.", "error");
            return;
          }

          const choices = testers.map(tester =>
            `${tester.uid} — ${tester.displayName || tester.specialty}`
          ).join("\n");

          const uid = prompt(
            `شناسه تستر موردنظر را وارد کن:\n${choices}`,
            ticket.assignedTesterUid || ""
          );

          if (!uid) return;

          await assignTicketToTester(
            ticket.id,
            uid.trim(),
            user
          );

          await reload();
        } catch (error) {
          showMessage(card, error.message, "error");
        }
      })
    );

    if (ticket.assignedTesterUid) {
      controls.appendChild(
        $button("لغو تخصیص تستر", "secondary-button", async () => {
          try {
            await unassignTicketTester(ticket.id, user);
            await reload();
          } catch (error) {
            showMessage(card, error.message, "error");
          }
        })
      );
    }

    card.appendChild(controls);
  }

  if (isManager(user)) {
    if (ticket.status === "closed") {
      card.appendChild(
        $button("بازگشایی تیکت", "secondary-button", async () => {
          try {
            await reopenTicket(ticket.id, user);
            await reload();
          } catch (error) {
            showMessage(card, error.message, "error");
          }
        })
      );
    } else {
      card.appendChild(
        $button("بستن تیکت", "danger-button", async () => {
          if (!confirm("این تیکت بسته شود؟")) return;

          try {
            await closeTicket(ticket.id, user);
            await reload();
          } catch (error) {
            showMessage(card, error.message, "error");
          }
        })
      );
    }
  }

  const repliesButton = $button(
    "نمایش گفتگو",
    "secondary-button",
    async () => {
      repliesButton.disabled = true;
      repliesButton.textContent = "در حال دریافت...";

      try {
        await showReplies(card, ticket, user);
        repliesButton.remove();
      } finally {
        repliesButton.disabled = false;
      }
    }
  );

  card.appendChild(repliesButton);

  return card;
}

export async function renderTickets(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش تیکت‌ها معتبر نیست.");
  }

  container.replaceChildren(
    $("p", "loading-state", "در حال دریافت تیکت‌ها...")
  );

  try {
    const tickets = isStaff(user)
      ? await getAllTickets(user)
      : await getMyTickets(user);

    const content = $("div", "tickets-page");

    const header = $("section", "card tickets-header");

    header.append(
      $("h2", "card-title", "مرکز پشتیبانی"),
      $("p", "", "برای پیگیری مشکلات و درخواست‌ها از سیستم تیکت استفاده کن."),
      $("p", "ticket-count",
        `تعداد تیکت‌های قابل مشاهده: ${tickets.length}`
      )
    );

    content.appendChild(header);

    createTicketForm(
      content,
      user,
      () => renderTickets(container, user)
    );

    const toolbar = $("div", "tickets-toolbar");

    const search = input("search", "جستجوی عنوان یا شناسه...");
    const filter = $("select", "ticket-input");

    [
      ["all", "همه وضعیت‌ها"],
      ["open", "باز"],
      ["closed", "بسته‌شده"]
    ].forEach(([value, label]) => {
      const option = $("option", "", label);
      option.value = value;
      filter.appendChild(option);
    });

    toolbar.append(search, filter);
    content.appendChild(toolbar);

    const list = $("div", "tickets-list");
    content.appendChild(list);

    async function updateList() {
      const term = search.value.trim().toLocaleLowerCase();

      const filtered = tickets.filter(ticket => {
        const matchesSearch =
          (ticket.title || "").toLocaleLowerCase().includes(term) ||
          (ticket.id || "").toLocaleLowerCase().includes(term);

        const matchesStatus =
          filter.value === "all" ||
          ticket.status === filter.value;

        return matchesSearch && matchesStatus;
      });

      list.replaceChildren();

      if (!filtered.length) {
        list.appendChild(
          $("div", "card empty-state", "تیکتی برای نمایش پیدا نشد.")
        );
        return;
      }

      for (const ticket of filtered) {
        list.appendChild(
          await createTicketCard(
            ticket,
            user,
            () => renderTickets(container, user)
          )
        );
      }
    }

    search.addEventListener("input", updateList);
    filter.addEventListener("change", updateList);

    await updateList();
    container.replaceChildren(content);

  } catch (error) {
    console.error("Tickets page error:", error);

    const card = $("section", "card error-state");

    card.append(
      $("p", "", error.message || "دریافت تیکت‌ها ناموفق بود."),
      $button("تلاش دوباره", "secondary-button", () =>
        renderTickets(container, user)
      )
    );

    container.replaceChildren(card);
  }
    }
                        
