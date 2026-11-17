
import { getRecord } from "./database.js";
import { db } from "./firebase.js";
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

function requireAdmin(actor) {
  if (!actor?.uid || actor.role !== "admin") {
    throw new Error("فقط ادمین اجازه بررسی سلامت سیستم را دارد.");
  }
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
  } catch {
    return {
      name,
      status: "error",
      message: "دریافت اطلاعات ناموفق بود."
    };
  }
}

export async function checkSystemHealth(actor) {
  requireAdmin(actor);

  const checks = [];

  // بررسی اتصال Firebase
  try {
    const connected = await getRecord(".info/connected");

    checks.push({
      name: "Firebase",
      status: connected === true ? "online" : "error",
      message: connected === true
        ? "اتصال برقرار است."
        : "اتصال Firebase برقرار نیست."
    });
  } catch {
    checks.push({
      name: "Firebase",
      status: "error",
      message: "بررسی اتصال ناموفق بود."
    });
  }

  // بررسی دسترسی به تنظیمات
  checks.push(
    await checkDatabaseAccess("siteSettings", "تنظیمات سایت")
  );

  // بررسی دسترسی به نسخه
  checks.push(
    await checkDatabaseAccess("system/version", "اطلاعات نسخه")
  );

  // بررسی دسترسی به کاربران
  checks.push(
    await checkDatabaseAccess("users", "اطلاعات کاربران")
  );

  const hasError = checks.some(
    item => item.status === "error"
  );

  const hasUnknown = checks.some(
    item => item.status === "empty"
  );

  return {
    overallStatus: hasError
      ? "warning"
      : hasUnknown
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
    snapshot => callback(snapshot.val() === true),
    error => callback(false, error)
  );
}
