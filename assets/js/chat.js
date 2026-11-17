import {
  getChatRooms,
  getMessages,
  sendMessage,
  editMessage,
  deleteOwnMessage,
  deleteAnyMessage,
  createChatRoom,
  deactivateChatRoom,
  activateChatRoom,
  deleteChatRoom
} from "../chat.js";

const $ = (tag, className = "", text = "") => {
  const el = document.createElement(tag);

  if (className) el.className = className;
  if (text !== undefined && text !== null) {
    el.textContent = String(text);
  }

  return el;
};

const isStaff = user =>
  user?.active === true &&
  ["admin", "leader"].includes(user.role);

const formatTime = value => {
  const timestamp = Number(value);
  if (!timestamp) return "";

  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(timestamp));
};

function makeButton(text, className, callback) {
  const button = $("button", className, text);
  button.type = "button";
  button.addEventListener("click", callback);
  return button;
}

function showMessage(container, text, type = "info") {
  container.replaceChildren(
    $("div", `chat-notice ${type}`, text)
  );
}

function createRoomForm(container, user, reload) {
  if (!isStaff(user)) return;

  const form = $("form", "card chat-create-room");

  form.appendChild(
    $("h3", "card-title", "ساخت اتاق جدید")
  );

  const title = $("input", "form-input");
  title.type = "text";
  title.placeholder = "نام اتاق";
  title.maxLength = 50;
  title.required = true;

  const description = $("input", "form-input");
  description.type = "text";
  description.placeholder = "توضیحات اتاق (اختیاری)";
  description.maxLength = 300;

  const submit = $("button", "primary-button", "ساخت اتاق");
  submit.type = "submit";

  form.append(title, description, submit);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    submit.disabled = true;

    try {
      await createChatRoom({
        title: title.value,
        description: description.value
      }, user);

      form.reset();
      await reload();

    } catch (error) {
      alert(error.message || "ساخت اتاق انجام نشد.");
    } finally {
      submit.disabled = false;
    }
  });

  container.appendChild(form);
}

function createRoomList(rooms, selectedId, onSelect, user, reload) {
  const wrapper = $("section", "chat-room-list");

  wrapper.appendChild(
    $("h3", "section-title", "اتاق‌های گفتگو")
  );

  const list = $("div", "chat-room-buttons");

  rooms.forEach(room => {
    const item = $("div", "chat-room-item");

    item.appendChild(
      makeButton(
        room.title,
        room.id === selectedId
          ? "chat-room-button active"
          : "chat-room-button",
        () => onSelect(room.id)
      )
    );

    if (room.description) {
      item.appendChild(
        $("p", "chat-room-description", room.description)
      );
    }

    if (isStaff(user) && room.type === "custom") {
      const controls = $("div", "chat-room-controls");

      if (room.active === false) {
        controls.appendChild(
          makeButton(
            "فعال‌سازی",
            "small-button",
            async () => {
              try {
                await activateChatRoom(room.id, user);
                await reload();
              } catch (error) {
                alert(error.message || "فعال‌سازی انجام نشد.");
              }
            }
          )
        );
      } else {
        controls.append(
          makeButton(
            "غیرفعال‌سازی",
            "small-button",
            async () => {
              if (!confirm("این اتاق غیرفعال شود؟")) return;

              try {
                await deactivateChatRoom(room.id, user);
                await reload();
              } catch (error) {
                alert(error.message || "عملیات انجام نشد.");
              }
            }
          ),
          makeButton(
            "حذف اتاق",
            "small-button danger-button",
            async () => {
              if (!confirm("این اتاق حذف منطقی شود؟")) return;

              try {
                await deleteChatRoom(room.id, user);
                await reload();
              } catch (error) {
                alert(error.message || "حذف اتاق انجام نشد.");
              }
            }
          )
        );
      }

      item.appendChild(controls);
    }

    list.appendChild(item);
  });

  wrapper.appendChild(list);
  return wrapper;
}

function createMessageCard(message, user, roomId, reload) {
  const own = message.uid === user.uid;

  const card = $("article",
    own ? "chat-message own-message" : "chat-message"
  );

  const header = $("div", "chat-message-header");

  header.append(
    $("strong", "chat-sender",
      own ? "شما" : message.displayName || "عضو کلن"
    ),
    $("span", "chat-time", formatTime(message.createdAt))
  );

  card.appendChild(header);

  card.appendChild(
    $("p", "chat-message-text", message.text)
  );

  if (message.edited) {
    card.appendChild(
      $("small", "chat-edited", "ویرایش‌شده")
    );
  }

  const actions = $("div", "chat-message-actions");

  if (own) {
    actions.append(
      makeButton(
        "ویرایش",
        "small-button",
        async () => {
          const updated = prompt("متن جدید پیام:", message.text);

          if (updated === null || !updated.trim()) return;

          try {
            await editMessage(roomId, message.id, updated, user);
            await reload();
          } catch (error) {
            alert(error.message || "ویرایش پیام انجام نشد.");
          }
        }
      ),
      makeButton(
        "حذف پیام",
        "small-button danger-button",
        async () => {
          if (!confirm("پیام حذف شود؟")) return;

          try {
            await deleteOwnMessage(roomId, message.id, user);
            await reload();
          } catch (error) {
            alert(error.message || "حذف پیام انجام نشد.");
          }
        }
      )
    );
  }

  if (isStaff(user) && !own) {
    actions.appendChild(
      makeButton(
        "حذف مدیریتی",
        "small-button danger-button",
        async () => {
          if (!confirm("این پیام حذف شود؟")) return;

          try {
            await deleteAnyMessage(roomId, message.id, user);
            await reload();
          } catch (error) {
            alert(error.message || "حذف پیام انجام نشد.");
          }
        }
      )
    );
  }

  if (actions.childElementCount) {
    card.appendChild(actions);
  }

  return card;
}

function createMessageForm(container, roomId, user, reload) {
  const form = $("form", "chat-message-form");

  const input = $("textarea", "chat-message-input");
  input.placeholder = "پیامت را بنویس...";
  input.maxLength = 2000;
  input.rows = 3;
  input.required = true;

  const submit = $("button", "primary-button", "ارسال پیام");
  submit.type = "submit";

  form.append(input, submit);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const value = input.value.trim();
    if (!value) return;

    submit.disabled = true;

    try {
      await sendMessage(roomId, value, user);
      input.value = "";
      await reload();
    } catch (error) {
      alert(error.message || "ارسال پیام انجام نشد.");
    } finally {
      submit.disabled = false;
    }
  });

  container.appendChild(form);
}

export async function renderChat(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش چت معتبر نیست.");
  }

  if (!user?.uid || user.active !== true) {
    showMessage(
      container,
      "برای استفاده از چت باید عضو فعال باشید.",
      "error"
    );
    return;
  }

  let selectedRoomId = null;

  const loadPage = async () => {
    container.replaceChildren(
      $("p", "loading-state", "در حال دریافت اطلاعات چت...")
    );

    try {
      const rooms = await getChatRooms(user);

      if (!rooms.length) {
        showMessage(container, "اتاقی برای نمایش وجود ندارد.");
        return;
      }

      if (
        !selectedRoomId ||
        !rooms.some(room => room.id === selectedRoomId)
      ) {
        selectedRoomId = rooms[0].id;
      }

      const messages = await getMessages(selectedRoomId, user);

      const page = $("div", "chat-page");

      const header = $("section", "card chat-header");

      header.append(
        $("h1", "card-title", "چت کلن INVICTUS"),
        $("p", "",
          "گفتگو با اعضای فعال کلن در اتاق‌های عمومی و اختصاصی"
        ),
        makeButton(
          "به‌روزرسانی",
          "secondary-button",
          loadPage
        )
      );

      page.appendChild(header);

      createRoomForm(page, user, loadPage);

      const layout = $("div", "chat-layout");

      const roomsPanel = createRoomList(
        rooms,
        selectedRoomId,
        async roomId => {
          selectedRoomId = roomId;
          await loadPage();
        },
        user,
        loadPage
      );

      const conversation = $("section", "chat-conversation");

      const selectedRoom = rooms.find(
        room => room.id === selectedRoomId
      );

      conversation.appendChild(
        $("h2", "chat-current-room",
          selectedRoom?.title || "گفتگو"
        )
      );

      const messageList = $("div", "chat-message-list");

      if (!messages.length) {
        messageList.appendChild(
          $("div", "empty-state",
            "هنوز پیامی در این اتاق ارسال نشده است."
          )
        );
      } else {
        messages.forEach(message => {
          messageList.appendChild(
            createMessageCard(
              message,
              user,
              selectedRoomId,
              loadPage
            )
          );
        });
      }

      conversation.appendChild(messageList);

      createMessageForm(
        conversation,
        selectedRoomId,
        user,
        loadPage
      );

      layout.append(roomsPanel, conversation);
      page.appendChild(layout);

      container.replaceChildren(page);

    } catch (error) {
      console.error("Chat page error:", error);

      const errorBox = $("section", "card error-state");

      errorBox.append(
        $("p", "",
          error.message || "بارگذاری چت با خطا مواجه شد."
        ),
        makeButton(
          "تلاش دوباره",
          "secondary-button",
          loadPage
        )
      );

      container.replaceChildren(errorBox);
    }
  };

  container.replaceChildren(
    $("p", "loading-state", "در حال بارگذاری اتاق‌های گفتگو...")
  );

  await loadPage();
              }
