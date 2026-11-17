
import {
  ref,
  set,
  remove,
  onValue
} from "./firebase.js";

const PRESENCE_PATH = "presence";

function requireUser(actor) {
  if (!actor?.uid) {
    throw new Error("ابتدا وارد حساب خود شوید.");
  }
}

// ثبت آنلاین بودن عضو
export async function setMemberOnline(actor) {
  requireUser(actor);

  const presenceRef = ref(
    window.__firebaseDatabase,
    `${PRESENCE_PATH}/${actor.uid}`
  );

  await set(presenceRef, {
    uid: actor.uid,
    online: true,
    lastSeen: Date.now()
  });
}

// ثبت آفلاین شدن عضو
export async function setMemberOffline(actor) {
  requireUser(actor);

  const presenceRef = ref(
    window.__firebaseDatabase,
    `${PRESENCE_PATH}/${actor.uid}`
  );

  await set(presenceRef, {
    uid: actor.uid,
    online: false,
    lastSeen: Date.now()
  });
}

// مشاهده وضعیت آنلاین اعضا
export function watchMembersPresence(callback, actor) {
  requireUser(actor);

  if (!["admin", "leader"].includes(actor.role)) {
    throw new Error("فقط لیدر و ادمین اجازه مشاهده این اطلاعات را دارند.");
  }

  const presenceRef = ref(
    window.__firebaseDatabase,
    PRESENCE_PATH
  );

  return onValue(presenceRef, snapshot => {
    const data = snapshot.val() || {};

    callback(
      Object.values(data).map(member => ({
        uid: member.uid,
        online: member.online === true,
        lastSeen: member.lastSeen || null
      }))
    );
  });
}
