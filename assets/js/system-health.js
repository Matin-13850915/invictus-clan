
import {
  db,
  ref,
  get,
  onValue
} from "./firebase.js";

import { canEditSiteContent } from "./permissions.js";

function requireAdmin(actor) {
  if (!canEditSiteContent(actor)) {
    throw new Error("فقط ادمین اجازه بررسی سلامت سیستم را دارد.");
  }
}

function getErrorMessage(error) {
  if (error?.code === "PERMISSION_DENIED") {
    return "دسترسی به این بخش توسط قوانین Firebase محدود شده است.";
  }

  return "بررسی این بخش ناموفق بود.";
}

async function checkDatabaseAccess(path, name) {
  try {
    const snapshot = await get(ref(db, path));

    return {
      name,
      status: snapshot.exists() ? "online" : "empty",
      message: snapshot.exists()
        ? "دسترسی برقرار است."
        : "مسیر قابل دسترسی است اما داده‌ای ندارد."
    };
  } catch (error) {
    return {
      name,
      status: "error",
      message: getErrorMessage(error)
    };
  }
}

async function checkFirebaseConnection() {
  try {
    const snapshot = await get(
      ref(db, ".info/connected")
    );

    const connected = snapshot.val() === true;

    return {
      name: "Firebase",
      status: connected ? "online" : "error",
      message: connected
        ? "اتصال برقرار است."
        : "اتصال Firebase برقرار نیست."
    };
  } catch {
    return {
      name: "Firebase",
      status: "error",
      message: "بررسی اتصال Firebase ناموفق بود."
    };
  }
}

export async function checkSystemHealth(actor) {
  requireAdmin(actor);

  const checks = await Promise.all([
    checkFirebaseConnection(),
    checkDatabaseAccess("siteSettings", "تنظیمات سایت"),
    checkDatabaseAccess("system/version", "اطلاعات نسخه")
  ]);

  const hasError = checks.some(
    item => item.status === "error"
  );

  const hasEmpty = checks.some(
    item => item.status === "empty"
  );

  return {
    overallStatus: hasError
      ? "warning"
      : hasEmpty
        ? "partial"
        : "healthy",
    checkedAt: Date.now(),
    checks
  };
}

export function watchFirebaseConnection(callback) {
  if (typeof callback !== "function") {
    throw new Error("تابع دریافت وضعیت اتصال معتبر نیست.");
  }

  const connectionRef = ref(db, ".info/connected");

  return onValue(
    connectionRef,
    snapshot => {
      callback(snapshot.val() === true);
    },
    error => {
      callback(false, error);
    }
  );
}
