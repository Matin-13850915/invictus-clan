
import { getRecord } from "./database.js";

function requireAdmin(actor) {
  if (!actor?.uid || actor.role !== "admin") {
    throw new Error("فقط ادمین اجازه بررسی سلامت سیستم را دارد.");
  }
}

export async function checkSystemHealth(actor) {
  requireAdmin(actor);

  const checks = [];

  // بررسی اتصال Firebase
  try {
    const connection = await getRecord(".info/connected");

    checks.push({
      name: "Firebase",
      status: connection === true ? "online" : "unknown",
      message: connection === true
        ? "اتصال برقرار است."
        : "وضعیت اتصال مشخص نیست."
    });
  } catch {
    checks.push({
      name: "Firebase",
      status: "error",
      message: "بررسی اتصال ناموفق بود."
    });
  }

  // بررسی دسترسی به تنظیمات سایت
  try {
    await getRecord("siteSettings");

    checks.push({
      name: "تنظیمات سایت",
      status: "online",
      message: "اطلاعات قابل دریافت است."
    });
  } catch {
    checks.push({
      name: "تنظیمات سایت",
      status: "error",
      message: "دریافت تنظیمات ناموفق بود."
    });
  }

  const hasError = checks.some(
    item => item.status === "error"
  );

  return {
    overallStatus: hasError ? "warning" : "healthy",
    checkedAt: Date.now(),
    checks
  };
}
