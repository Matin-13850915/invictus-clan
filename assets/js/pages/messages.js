
import {
  sendPrivateMessage,
  getConversationMessages,
  editPrivateMessage,
  deletePrivateMessage,
  blockConversation,
  unblockConversation
} from "../private-messages.js";

import { readData } from "../database.js";
import { getPublicProfile } from "../profile.js";

const $ = (tag, className = "", text = "") => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) {
    el.textContent = String(text);
  }
  return el;
};

const formatTime = value => {
  const timestamp = Number(value);
  if (!timestamp) return "";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(timestamp));
};

function button(label, className, callback) {
  const el = $("button", className, label);
  el.type = "button";
  el.addEventListener("click", callback);
  return el;
}

function showError(container, error, retry) {
  const box = $("div", "card error-state");
  box.appendChild(
    $("p", "", error?.message || "خطایی رخ داد.")
  );

  if (retry) {
    box.appendChild(
      button("تلاش دوباره", "secondary-button", retry)
    );
  }

  container.replaceChildren(box);
}

export async function renderMessages(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش پیام‌ها معتبر نیست.");
  }

  if (!user?.uid || user.active !== true) {
    container.replaceChildren(
      $("div", "card error-state",
        "برای استفاده از پیام خصوصی باید عضو فعال باشید."
      )
    );
    return;
  }

  let selectedUid = null;
  let members = [];
  let currentProfile = null;
  let blocked = false;

  const page = $("div", "private-messages-page");

  const header = $("section", "card messages-header");
  header.append(
    $("h1", "card-title", "پیام‌های خصوصی"),
    $("p", "", "گفتگوی مستقیم با اعضای فعال کلن")
  );

  const memberPanel = $("section", "card messages-members");
  memberPanel.appendChild(
    $("h2", "section-title", "انتخاب عضو")
  );

  const search = $("input", "form-input");
  search.type = "search";
  search.placeholder = "جستجوی نام عضو یا نام بازی...";
  memberPanel.appendChild(search);

  const memberList = $("div", "messages-member-list");
  memberPanel.appendChild(memberList);

  const conversation = $("section", "card private-conversation");
  const conversationHeader = $("div", "private-conversation-header");
  const conversationTitle = $("h2", "section-title", "یک عضو را انتخاب کنید");

  conversationHeader.appendChild(conversationTitle);

  const conversationActions = $("div", "private-conversation-actions");
  conversationHeader.appendChild(conversationActions);

  const messageList = $("div", "private-message-list");

  const form = $("form", "private-message-form");
  const input = $("textarea", "form-input");
  input.placeholder = "پیام خود را بنویسید...";
  input.rows = 3;
  input.maxLength = 2000;

  const send = $("button", "primary-button", "ارسال پیام");
  send.type = "submit";
  send.disabled = true;

  form.append(input, send);

  conversation.append(
    conversationHeader,
    messageList,
    form
  );

  page.append(header, memberPanel, conversation);
  container.replaceChildren(page);

  function showMemberList(filter = "") {
    memberList.replaceChildren();

    const query = filter.trim().toLocaleLowerCase();

    const filtered = members.filter(member => {
      const name = String(
        member.displayName || member.gameName || ""
      ).toLocaleLowerCase();

      const gameName = String(
        member.gameName || ""
      ).toLocaleLowerCase();

      return name.includes(query) || gameName.includes(query);
    });

    if (!filtered.length) {
      memberList.appendChild(
        $("p", "empty-state", "عضوی پیدا نشد.")
      );
      return;
    }

    filtered.forEach(member => {
      const item = button(
        `${member.displayName || member.gameName || "عضو"}${member.gameName ? ` (${member.gameName})` : ""}`,
        member.uid === selectedUid
          ? "messages-member active"
          : "messages-member",
        () => selectMember(member.uid)
      );

      memberList.appendChild(item);
    });
  }

  async function selectMember(uid) {
    if (!uid || uid === user.uid) return;

    selectedUid = uid;
    currentProfile = null;
    blocked = false;

    showMemberList(search.value);
    messageList.replaceChildren(
      $("p", "loading-state", "در حال دریافت گفتگو...")
    );

    input.disabled = true;
    send.disabled = true;
    conversationActions.replaceChildren();

    try {
      const member = members.find(item => item.uid === uid);

      currentProfile = await getPublicProfile(uid);

      conversationTitle.textContent =
        currentProfile?.displayName ||
        member?.displayName ||
        member?.gameName ||
        "گفتگوی خصوصی";

      const messages = await getConversationMessages(uid, user);

      renderMessageList(messages);

      const blockButton = button(
        "مسدود کردن گفتگو",
        "small-button danger-button",
        async () => {
          if (!confirm("ارسال پیام در این گفتگو مسدود شود؟")) return;

          try {
            await blockConversation(uid, user);
            blocked = true;
            input.disabled = true;
            send.disabled = true;
            blockButton.disabled = true;
            alert("گفتگو مسدود شد.");
          } catch (error) {
            alert(error.message || "مسدودسازی انجام نشد.");
          }
        }
      );

      const unblockButton = button(
        "رفع مسدودیت",
        "small-button",
        async () => {
          try {
            await unblockConversation(uid, user);
            blocked = false;
            input.disabled = false;
            send.disabled = false;
            alert("مسدودیت برداشته شد.");
          } catch (error) {
            alert(error.message || "رفع مسدودیت انجام نشد.");
          }
        }
      );

      conversationActions.append(blockButton, unblockButton);

      input.disabled = false;
      send.disabled = false;

    } catch (error) {
      if (
        String(error?.message || "").includes("عضو این گفتگو نیستید")
      ) {
        conversationTitle.textContent =
          currentProfile?.displayName || "گفتگوی جدید";

        messageList.replaceChildren(
          $("p", "empty-state",
            "هنوز گفتگویی با این عضو شروع نشده است. اولین پیام را ارسال کنید."
          )
        );

        input.disabled = false;
        send.disabled = false;

        conversationActions.appendChild(
          button(
            "مسدود کردن گفتگو",
            "small-button danger-button",
            async () => {
              alert("برای مسدودسازی، ابتدا باید گفتگو ایجاد شود.");
            }
          )
        );

        return;
      }

      showError(messageList, error, () => selectMember(uid));
    }
  }

  function renderMessageList(messages) {
    messageList.replaceChildren();

    if (!messages.length) {
      messageList.appendChild(
        $("p", "empty-state", "هنوز پیامی ارسال نشده است.")
      );
      return;
    }

    messages.forEach(message => {
      const own = message.senderUid === user.uid;

      const card = $("article",
        own ? "private-message own-message" : "private-message"
      );

      const meta = $("div", "private-message-meta");

      meta.append(
        $("strong", "", own ? "شما" : "عضو"),
        $("small", "", formatTime(message.createdAt))
      );

      card.appendChild(meta);
      card.appendChild(
        $("p", "private-message-text", message.text)
      );

      if (message.edited) {
        card.appendChild(
          $("small", "message-edited", "ویرایش‌شده")
        );
      }

      if (own) {
        const actions = $("div", "private-message-actions");

        actions.append(
          button("ویرایش", "small-button", async () => {
            const updated = prompt("متن جدید پیام:", message.text);
            if (updated === null || !updated.trim()) return;

            try {
              await editPrivateMessage(
                selectedUid,
                message.id,
                updated,
                user
              );
              await refreshMessages();
            } catch (error) {
              alert(error.message || "ویرایش پیام انجام نشد.");
            }
          }),

          button("حذف", "small-button danger-button", async () => {
            if (!confirm("پیام حذف شود؟")) return;

            try {
              await deletePrivateMessage(
                selectedUid,
                message.id,
                user
              );
              await refreshMessages();
            } catch (error) {
              alert(error.message || "حذف پیام انجام نشد.");
            }
          })
        );

        card.appendChild(actions);
      }

      messageList.appendChild(card);
    });

    messageList.scrollTop = messageList.scrollHeight;
  }

  async function refreshMessages() {
    if (!selectedUid) return;

    const messages = await getConversationMessages(
      selectedUid,
      user
    );

    renderMessageList(messages);
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const text = input.value.trim();

    if (!selectedUid || !text || blocked) return;

    send.disabled = true;

    try {
      await sendPrivateMessage(selectedUid, text, user);
      input.value = "";
      await refreshMessages();
    } catch (error) {
      alert(error.message || "ارسال پیام انجام نشد.");
    } finally {
      send.disabled = false;
    }
  });

  search.addEventListener("input", () => {
    showMemberList(search.value);
  });

  try {
    const [users, roles] = await Promise.all([
      readData("publicProfiles"),
      readData("roles")
    ]);

    const userRecords = users && typeof users === "object"
      ? users
      : {};

    const roleRecords = roles && typeof roles === "object"
      ? roles
      : {};

    members = Object.entries(roleRecords)
      .filter(([uid, role]) =>
        uid !== user.uid &&
        role?.active === true &&
        role?.role !== "banned"
      )
      .map(([uid, role]) => {
        const profile = userRecords[uid] || {};

        return {
          uid,
          active: role.active,
          role: role.role,
          displayName: profile.displayName || profile.gameName || "",
          gameName: profile.gameName || ""
        };
      });

    showMemberList();

  } catch (error) {
    showError(memberPanel, error);
  }
}
  
