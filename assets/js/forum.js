
import {
  createRecord,
  getRecord,
  getAllRecords,
  updateRecord,
  deleteRecord
} from "./database.js";

import { createId, normalizeText } from "./utils.js";

const TOPICS_PATH = "forum/topics";
const POSTS_PATH = "forum/posts";

const MAX_TITLE_LENGTH = 100;
const MAX_POST_LENGTH = 5000;

function requireUser(actor) {
  if (!actor?.uid) {
    throw new Error("برای استفاده از انجمن باید وارد حساب شوید.");
  }
}

function requireStaff(actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه مدیریت انجمن را دارند.");
  }
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    throw new Error("متن واردشده معتبر نیست.");
  }

  const text = value.trim();

  if (!text || text.length > maxLength) {
    throw new Error(`متن باید بین ۱ تا ${maxLength} کاراکتر باشد.`);
  }

  return text;
}

function timestamp() {
  return Date.now();
}

// ساخت موضوع جدید انجمن
export async function createForumTopic(data, actor) {
  requireStaff(actor);

  const title = cleanText(data.title, MAX_TITLE_LENGTH);
  const description = cleanText(data.description || title, 500);

  const topic = {
    id: createId(),
    title,
    description,
    createdBy: actor.uid,
    createdByName: actor.displayName || "مدیریت",
    createdAt: timestamp(),
    updatedAt: timestamp(),
    active: true,
    pinned: Boolean(data.pinned),
    archived: false,
    postCount: 0
  };

  await createRecord(TOPICS_PATH, topic);

  return topic;
}

// دریافت موضوعات فعال
export async function getForumTopics() {
  const topics = await getAllRecords(TOPICS_PATH);

  return topics
    .filter(topic => topic.active && !topic.archived)
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

  const topics = await getAllRecords(TOPICS_PATH);

  return topics.sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
}

// ویرایش موضوع
export async function updateForumTopic(topicId, changes, actor) {
  requireStaff(actor);

  const topic = await getRecord(`${TOPICS_PATH}/${topicId}`);

  if (!topic) {
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
    updates.pinned = Boolean(changes.pinned);
  }

  if (changes.active !== undefined) {
    updates.active = Boolean(changes.active);
  }

  await updateRecord(`${TOPICS_PATH}/${topicId}`, updates);

  return { ...topic, ...updates };
}

// بایگانی موضوع
export async function archiveForumTopic(topicId, actor) {
  requireStaff(actor);

  const topic = await getRecord(`${TOPICS_PATH}/${topicId}`);

  if (!topic) {
    throw new Error("موضوع پیدا نشد.");
  }

  await updateRecord(`${TOPICS_PATH}/${topicId}`, {
    archived: true,
    active: false,
    archivedAt: timestamp(),
    archivedBy: actor.uid
  });

  return true;
}

// ایجاد پست در موضوع
export async function createForumPost(topicId, content, actor) {
  requireUser(actor);

  const text = cleanText(content, MAX_POST_LENGTH);
  const topic = await getRecord(`${TOPICS_PATH}/${topicId}`);

  if (!topic || !topic.active || topic.archived) {
    throw new Error("این موضوع در دسترس نیست.");
  }

  const post = {
    id: createId(),
    topicId,
    authorUid: actor.uid,
    authorName: actor.displayName || "عضو کلن",
    content: text,
    createdAt: timestamp(),
    updatedAt: timestamp(),
    edited: false,
    deleted: false
  };

  await createRecord(POSTS_PATH, post);

  await updateRecord(`${TOPICS_PATH}/${topicId}`, {
    postCount: (topic.postCount || 0) + 1,
    updatedAt: timestamp()
  });

  return post;
}

// دریافت پست‌های یک موضوع
export async function getForumPosts(topicId) {
  const posts = await getAllRecords(POSTS_PATH);

  return posts
    .filter(post => post.topicId === topicId && !post.deleted)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

// ویرایش پست توسط نویسنده تا ۱۵ دقیقه
export async function editForumPost(postId, newContent, actor) {
  requireUser(actor);

  const post = await getRecord(`${POSTS_PATH}/${postId}`);

  if (!post || post.deleted) {
    throw new Error("پست پیدا نشد.");
  }

  if (post.authorUid !== actor.uid) {
    throw new Error("فقط نویسنده می‌تواند پست خودش را ویرایش کند.");
  }

  const elapsed = timestamp() - post.createdAt;

  if (elapsed > 15 * 60 * 1000) {
    throw new Error("مهلت ویرایش این پست تمام شده است.");
  }

  const content = cleanText(newContent, MAX_POST_LENGTH);

  await updateRecord(`${POSTS_PATH}/${postId}`, {
    content,
    edited: true,
    updatedAt: timestamp()
  });

  return true;
}

// حذف پست توسط نویسنده یا مدیریت
export async function deleteForumPost(postId, actor) {
  requireUser(actor);

  const post = await getRecord(`${POSTS_PATH}/${postId}`);

  if (!post || post.deleted) {
    throw new Error("پست پیدا نشد.");
  }

  const isOwner = post.authorUid === actor.uid;
  const isStaff = ["admin", "leader"].includes(actor.role);

  if (!isOwner && !isStaff) {
    throw new Error("اجازه حذف این پست را ندارید.");
  }

  await updateRecord(`${POSTS_PATH}/${postId}`, {
    deleted: true,
    deletedAt: timestamp(),
    deletedBy: actor.uid,
    content: ""
  });

  const topic = await getRecord(`${TOPICS_PATH}/${post.topicId}`);

  if (topic) {
    await updateRecord(`${TOPICS_PATH}/${post.topicId}`, {
      postCount: Math.max(0, (topic.postCount || 1) - 1),
      updatedAt: timestamp()
    });
  }

  return true;
}

// حذف کامل موضوع؛ فقط مدیریت
export async function deleteForumTopic(topicId, actor) {
  requireStaff(actor);

  const topic = await getRecord(`${TOPICS_PATH}/${topicId}`);

  if (!topic) {
    throw new Error("موضوع پیدا نشد.");
  }

  const posts = await getAllRecords(POSTS_PATH);

  const relatedPosts = posts.filter(
    post => post.topicId === topicId
  );

  for (const post of relatedPosts) {
    await deleteRecord(`${POSTS_PATH}/${post.id}`);
  }

  await deleteRecord(`${TOPICS_PATH}/${topicId}`);

  return true;
}

// جستجو در موضوعات انجمن
export async function searchForumTopics(searchText) {
  const search = normalizeText(searchText);

  if (!search) {
    return getForumTopics();
  }

  const topics = await getForumTopics();

  return topics.filter(topic => {
    const title = normalizeText(topic.title);
    const description = normalizeText(topic.description);

    return title.includes(search) || description.includes(search);
  });
                                    }
  
