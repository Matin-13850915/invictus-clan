
import {
  createForumTopic,
  getForumTopics,
  getAllForumTopics,
  updateForumTopic,
  archiveForumTopic,
  createForumPost,
  getForumPosts,
  editForumPost,
  deleteForumPost,
  deleteForumTopic,
  searchForumTopics
} from "../forum.js";

const $ = (tag, className = "", value = "") => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = String(value ?? "");
  return el;
};

const staffRole = role => ["admin", "leader"].includes(role);

function dateText(value) {
  const date = new Date(Number(value));
  if (!value || Number.isNaN(date.getTime())) return "نامشخص";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function button(label, callback, className = "secondary-button") {
  const el = $("button", className, label);
  el.type = "button";
  el.addEventListener("click", callback);
  return el;
}

function field(labelText, control) {
  const wrapper = $("label", "form-field");
  wrapper.append($("span", "field-label", labelText), control);
  return wrapper;
}

export async function renderForum(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش انجمن معتبر نیست.");
  }

  if (!user?.uid || user.active !== true) {
    container.replaceChildren(
      $("div", "card error-state", "برای ورود به انجمن باید عضو فعال باشید.")
    );
    return;
  }

  const isStaff = staffRole(user.role);
  let selectedTopic = null;

  const load = async (searchText = "") => {
    container.replaceChildren(
      $("p", "loading-state", "در حال دریافت انجمن...")
    );

    try {
      const topics = isStaff
        ? await getAllForumTopics(user)
        : searchText.trim()
          ? await searchForumTopics(searchText, user)
          : await getForumTopics(user);

      const visibleTopics = isStaff
        ? topics.filter(topic =>
            topic.deleted !== true &&
            topic.archived !== true &&
            topic.active === true
          )
        : topics;

      const page = $("div", "forum-page");

      const header = $("section", "card forum-header");
      header.append(
        $("h1", "card-title", "انجمن کلن"),
        $("p", "section-description",
          "گفتگو، تبادل تجربه و هماهنگی اعضای INVICTUS"
        )
      );

      const searchInput = $("input", "form-control");
      searchInput.placeholder = "جستجو در موضوعات...";
      searchInput.value = searchText;

      header.appendChild(field("جستجوی موضوع", searchInput));

      header.appendChild(
        button("جستجو", () => load(searchInput.value))
      );

      header.appendChild(
        button("نمایش همه موضوعات", () => load(""))
      );

      page.appendChild(header);

      if (isStaff) {
        const createForm = $("form", "card forum-create-form");
        const title = $("input", "form-control");
        title.required = true;
        title.maxLength = 100;
        title.placeholder = "عنوان موضوع جدید";

        const description = $("textarea", "form-control");
        description.rows = 3;
        description.maxLength = 500;
        description.placeholder = "توضیح کوتاه موضوع";

        const pinned = $("input");
        pinned.type = "checkbox";

        const submit = $("button", "primary-button", "ایجاد موضوع");
        submit.type = "submit";

        createForm.append(
          $("h2", "section-title", "ایجاد موضوع جدید"),
          field("عنوان", title),
          field("توضیحات", description),
          field("سنجاق شود", pinned),
          submit
        );

        createForm.addEventListener("submit", async event => {
          event.preventDefault();

          if (!createForm.reportValidity()) return;

          submit.disabled = true;

          try {
            await createForumTopic({
              title: title.value,
              description: description.value,
              pinned: pinned.checked
            }, user);

            alert("موضوع ایجاد شد.");
            await load(searchInput.value);
          } catch (error) {
            alert(error.message || "ایجاد موضوع ناموفق بود.");
          } finally {
            submit.disabled = false;
          }
        });

        page.appendChild(createForm);
      }

      const list = $("section", "forum-topic-list");
      list.appendChild(
        $("h2", "section-title", "موضوعات انجمن")
      );

      if (!visibleTopics.length) {
        list.appendChild(
          $("div", "card empty-state", "موضوعی برای نمایش وجود ندارد.")
        );
      }

      visibleTopics.forEach(topic => {
        const card = $("article", "card forum-topic-card");

        card.append(
          $("h3", "topic-title",
            `${topic.pinned ? "📌 " : ""}${topic.title}`
          ),
          $("p", "topic-description", topic.description || ""),
          $("small", "", `تعداد پیام‌ها: ${topic.postCount || 0}`),
          $("small", "", `آخرین تغییر: ${dateText(topic.updatedAt)}`)
        );

        card.appendChild(
          button("ورود به گفتگو", () => openTopic(topic, page))
        );

        if (isStaff) {
          card.append(
            button(topic.pinned ? "برداشتن سنجاق" : "سنجاق موضوع", async () => {
              try {
                await updateForumTopic(topic.id, {
                  pinned: !topic.pinned
                }, user);
                await load(searchInput.value);
              } catch (error) {
                alert(error.message || "تغییر موضوع ناموفق بود.");
              }
            }),
            button("بایگانی", async () => {
              if (!confirm("این موضوع بایگانی شود؟")) return;

              try {
                await archiveForumTopic(topic.id, user);
                await load(searchInput.value);
              } catch (error) {
                alert(error.message || "بایگانی ناموفق بود.");
              }
            }),
            button("حذف موضوع", async () => {
              if (!confirm("موضوع حذف شود؟ این عملیات منطقی است.")) return;

              try {
                await deleteForumTopic(topic.id, user);
                await load(searchInput.value);
              } catch (error) {
                alert(error.message || "حذف موضوع ناموفق بود.");
              }
            })
          );
        }

        list.appendChild(card);
      });

      page.appendChild(list);
      container.replaceChildren(page);

      if (selectedTopic) {
        const current = visibleTopics.find(
          topic => topic.id === selectedTopic.id
        );

        if (current) {
          await openTopic(current, page);
        } else {
          selectedTopic = null;
        }
      }

    } catch (error) {
      console.error("Forum error:", error);

      container.replaceChildren(
        $("div", "card error-state",
          error.message || "دریافت انجمن ناموفق بود."
        ),
        button("تلاش دوباره", () => load(searchText))
      );
    }
  };

  async function openTopic(topic, page) {
    selectedTopic = topic;

    const old = page.querySelector(".forum-discussion");
    if (old) old.remove();

    const discussion = $("section", "card forum-discussion");

    discussion.append(
      $("h2", "section-title", topic.title),
      $("p", "section-description", topic.description || "")
    );

    const postsContainer = $("div", "forum-posts");
    postsContainer.appendChild(
      $("p", "loading-state", "در حال دریافت پیام‌ها...")
    );

    discussion.appendChild(postsContainer);

    const postForm = $("form", "forum-post-form");
    const postInput = $("textarea", "form-control");
    postInput.required = true;
    postInput.maxLength = 5000;
    postInput.rows = 4;
    postInput.placeholder = "پیام خود را بنویسید...";

    const send = $("button", "primary-button", "ارسال پیام");
    send.type = "submit";

    postForm.append(
      field("پیام جدید", postInput),
      send
    );

    postForm.addEventListener("submit", async event => {
      event.preventDefault();

      if (!postForm.reportValidity()) return;

      send.disabled = true;

      try {
        await createForumPost(topic.id, postInput.value, user);
        postInput.value = "";
        await refreshPosts();
      } catch (error) {
        alert(error.message || "ارسال پیام ناموفق بود.");
      } finally {
        send.disabled = false;
      }
    });

    discussion.appendChild(postForm);

    discussion.appendChild(
      button("بستن گفتگو", () => {
        discussion.remove();
        selectedTopic = null;
      })
    );

    page.appendChild(discussion);

    async function refreshPosts() {
      try {
        const posts = await getForumPosts(topic.id, user);
        postsContainer.replaceChildren();

        if (!posts.length) {
          postsContainer.appendChild(
            $("p", "empty-state", "هنوز پیامی در این موضوع ثبت نشده است.")
          );
          return;
        }

        posts.forEach(post => {
          const card = $("article", "forum-post-card");

          card.append(
            $("strong", "post-author", post.authorName || "عضو کلن"),
            $("small", "", dateText(post.createdAt)),
            $("p", "post-content", post.content || "")
          );

          if (post.edited) {
            card.appendChild($("small", "", "ویرایش‌شده"));
          }

          const canEdit =
            post.authorUid === user.uid &&
            Date.now() - Number(post.createdAt) <= 15 * 60 * 1000;

          if (canEdit) {
            card.appendChild(
              button("ویرایش پیام", async () => {
                const next = prompt("متن جدید پیام:", post.content);

                if (next === null) return;

                try {
                  await editForumPost(post.id, next, user);
                  await refreshPosts();
                } catch (error) {
                  alert(error.message || "ویرایش پیام ناموفق بود.");
                }
              })
            );
          }

          if (post.authorUid === user.uid || isStaff) {
            card.appendChild(
              button("حذف پیام", async () => {
                if (!confirm("این پیام حذف شود؟")) return;

                try {
                  await deleteForumPost(post.id, user);
                  await refreshPosts();
                } catch (error) {
                  alert(error.message || "حذف پیام ناموفق بود.");
                }
              })
            );
          }

          postsContainer.appendChild(card);
        });

      } catch (error) {
        postsContainer.replaceChildren(
          $("p", "error-state",
            error.message || "دریافت پیام‌ها ناموفق بود."
          )
        );
      }
    }

    await refreshPosts();
  }

  await load();
                    }
        
