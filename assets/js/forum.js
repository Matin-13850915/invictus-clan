
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord
} from "./database.js";

import { createId, normalizeText } from "./utils.js";

const TOPICS_PATH = "forum/topics";
const POSTS_PATH = "forum/posts";

const MAX_TITLE_LENGTH = 100;
const MAX_POST_LENGTH = 5000;
const EDIT_WINDOW = 15 * 60 * 1000;

function requireUser(actor) {
  if (
    !actor?.uid ||
    actor.active !== true
  ) {
    throw new Error("برای استفاده از انجمن باید عضو فعال باشید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت انجمن را دارند.");
  }
}

function validateId(id, label = "شناسه") {
  if (
    typeof id !== "string" ||
    !id.trim() ||
    /[.#$/\[\]]/.test(id)
  ) {
    throw new Error(`${label} معتبر نیست.`);
  }
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    throw new Error("متن واردشده معتبر نیست.");
  }

  const text = normalizeText(value).trim();

  if (!text || text.length > maxLength) {
    throw new Error(`متن باید بین ۱ تا ${maxLength} کاراکتر باشد.`);
  }

  return text;
}

function timestamp() {
  return Date.now();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

// ساخت موضوع جدید؛ فقط مدیریت
export async function createForumTopic(data, actor) {
  requireStaff(actor);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اطلاعات موضوع معتبر نیست.");
  }

  const title = cleanText(data.title, MAX_TITLE_LENGTH);
  const description = data.description
    ? cleanText(data.description, 500)
    : title;

  const topic = {
    id: createId(),
    title,
    description,
    createdBy: actor.uid,
    createdByName: cleanText(
      String(actor.displayName || "مدیریت"),
      50
    ),
    createdAt: timestamp(),
    updatedAt: timestamp(),
    active: true,
    pinned: data.pinned === true,
    archived: false,
    deleted: false,
    postCount: 0
  };

  const id = await createRecord(TOPICS_PATH, topic);

  return { ...topic, recordId: id };
}

// دریافت موضوعات فعال
export async function getForumTopics(user) {
  requireUser(user);

  const topics = safeArray(await getAllRecords(TOPICS_PATH));

  return topics
    .filter(topic =>
      topic &&
      topic.active === true &&
      topic.archived !== true &&
      topic.deleted !== true
    )
    .sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return Number(b.pinned) - Number(a.pinned);
      }

      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
}

// دریافت همه موضوعات برای مدیریت
export async function getAllForumTopics(actor) {
  requireStaff(actor);

  const topics = safeArray(await getAllRecords(TOPICS_PATH));

  return topics.sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
}

// ویرایش موضوع
export async function updateForumTopic(topicId, changes, actor) {
  requireStaff(actor);
  validateId(topicId, "شناسه موضوع");

  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new Error("اطلاعات ویرایش معتبر نیست.");
  }

  const path = `${TOPICS_PATH}/${topicId}`;
  const topic = await getRecord(path);

  if (!topic || topic.deleted === true) {
    throw new Error("موضوع موردنظر پیدا نشد.");
  }

  const updates = {
    updatedAt: timestamp()
  };

  if (changes.title !== undefined) {
    updates.title = cleanText(changes.title, MAX_TITLE_LENGTH);
  }

  if (changes.description !== undefined) {
    updates.description = cleanText(changes.description, 500);
  }

  if (changes.pinned !== undefined) {
    updates.pinned = changes.pinned === true;
  }

  if (changes.active !== undefined) {
    updates.active = changes.active === true;
  }

  await updateRecord(path, updates);

  return { ...topic, ...updates };
}

// بایگانی موضوع
export async function archiveForumTopic(topicId, actor) {
  requireStaff(actor);
  validateId(topicId, "شناسه موضوع");

  const path = `${TOPICS_PATH}/${topicId}`;
  const topic = await getRecord(path);

  if (!topic || topic.deleted === true) {
    throw new Error("موضوع پیدا نشد.");
  }

  await updateRecord(path, {
    archived: true,
    active: false,
    archivedAt: timestamp(),
    archivedBy: actor.uid,
    updatedAt: timestamp()
  });

  return true;
}

// ایجاد پست
export async function createForumPost(topicId, content, actor) {
  requireUser(actor);
  validateId(topicId, "شناسه موضوع");

  const text = cleanText(content, MAX_POST_LENGTH);
  const topic = await getRecord(`${TOPICS_PATH}/${topicId}`);

  if (
    !topic ||
    topic.active !== true ||
    topic.archived === true ||
    topic.deleted === true
  ) {
    throw new Error("این موضوع در دسترس نیست.");
  }

  const post = {
    id: createId(),
    topicId,
    authorUid: actor.uid,
    authorName: normalizeText(
      String(actor.displayName || "عضو کلن")
    ).slice(0, 50),
    content: text,
    createdAt: timestamp(),
    updatedAt: timestamp(),
    edited: false,
    deleted: false
  };

  const id = await createRecord(POSTS_PATH, post);

  // شمارنده تقریبی است؛ برای شمارش دقیق باید از تراکنش سمت سرور استفاده شود.
  await updateRecord(`${TOPICS_PATH}/${topicId}`, {
    postCount: Math.max(0, Number(topic.postCount) || 0) + 1,
    updatedAt: timestamp()
  });

  return { ...post, recordId: id };
}

// دریافت پست‌های موضوع
export async function getForumPosts(topicId, user) {
  requireUser(user);
  validateId(topicId, "شناسه موضوع");

  const topic = await getRecord(`${TOPICS_PATH}/${topicId}`);

  if (!topic || topic.deleted === true) {
    throw new Error("موضوع پیدا نشد.");
  }

  const posts = safeArray(await getAllRecords(POSTS_PATH));

  return posts
    .filter(post =>
      post &&
      post.topicId === topicId &&
      post.deleted !== true
    )
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

// ویرایش پست توسط نویسنده تا ۱۵ دقیقه
export async function editForumPost(postId, newContent, actor) {
  requireUser(actor);
  validateId(postId, "شناسه پست");

  const path = `${POSTS_PATH}/${postId}`;
  const post = await getRecord(path);

  if (!post || post.deleted === true) {
    throw new Error("پست پیدا نشد.");
  }

  if (post.authorUid !== actor.uid) {
    throw new Error("فقط نویسنده می‌تواند پست خودش را ویرایش کند.");
  }

  const createdAt = Number(post.createdAt) || 0;

  if (
    !createdAt ||
    timestamp() - createdAt > EDIT_WINDOW
  ) {
    throw new Error("مهلت ویرایش این پست تمام شده است.");
  }

  const content = cleanText(newContent, MAX_POST_LENGTH);

  await updateRecord(path, {
    content,
    edited: true,
    updatedAt: timestamp()
  });

  return true;
}

// حذف ظاهری پست توسط نویسنده یا مدیریت
export async function deleteForumPost(postId, actor) {
  requireUser(actor);
  validateId(postId, "شناسه پست");

  const path = `${POSTS_PATH}/${postId}`;
  const post = await getRecord(path);

  if (!post || post.deleted === true) {
    throw new Error("پست پیدا نشد.");
  }

  const isOwner = post.authorUid === actor.uid;
  const isStaff = ["admin", "leader"].includes(actor.role);

  if (!isOwner && !isStaff) {
    throw new Error("اجازه حذف این پست را ندارید.");
  }

  await updateRecord(path, {
    deleted: true,
    deletedAt: timestamp(),
    deletedBy: actor.uid,
    content: ""
  });

  const topic = await getRecord(`${TOPICS_PATH}/${post.topicId}`);

  if (topic) {
    await updateRecord(`${TOPICS_PATH}/${post.topicId}`, {
      postCount: Math.max(0, (Number(topic.postCount) || 1) - 1),
      updatedAt: timestamp()
    });
  }

  return true;
}

// حذف منطقی موضوع؛ پست‌ها و سابقه باقی می‌مانند
export async function deleteForumTopic(topicId, actor) {
  requireStaff(actor);
  validateId(topicId, "شناسه موضوع");

  const path = `${TOPICS_PATH}/${topicId}`;
  const topic = await getRecord(path);

  if (!topic || topic.deleted === true) {
    throw new Error("موضوع پیدا نشد.");
  }

  await updateRecord(path, {
    deleted: true,
    active: false,
    archived: true,
    deletedAt: timestamp(),
    deletedBy: actor.uid,
    updatedAt: timestamp()
  });

  return true;
}

// جستجو در موضوعات
export async function searchForumTopics(searchText, user) {
  requireUser(user);

  const search = normalizeText(
    String(searchText || "")
  ).trim().toLowerCase();

  const topics = await getForumTopics(user);

  if (!search) {
    return topics;
  }

  return topics.filter(topic => {
    const title = normalizeText(topic.title || "").toLowerCase();
    const description = normalizeText(
      topic.description || ""
    ).toLowerCase();

    return title.includes(search) ||
      description.includes(search);
  });
                    }
      
