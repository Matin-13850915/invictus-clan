
import { getAllRecords } from "./database.js";

function requireStaff(actor) {
  if (
    !actor?.uid ||
    actor.active !== true ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("اجازه خروجی گرفتن ندارید.");
  }
}

function safeValue(value) {
  const text = String(value ?? "");

  // جلوگیری از اجرای فرمول در نرم‌افزارهای صفحه‌گسترده
  if (/^[\s]*[=+\-@]/.test(text)) {
    return `'${text}`;
  }

  return text;
}

function escapeCSV(value) {
  return `"${safeValue(value).replace(/"/g, '""')}"`;
}

function createCSV(headers, rows) {
  const lines = [
    headers.map(escapeCSV).join(","),
    ...rows.map(row => row.map(escapeCSV).join(","))
  ];

  return "\uFEFF" + lines.join("\r\n");
}

function safeDate(value) {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("fa-IR");
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

// خروجی اعضا
export async function exportMembersCSV(actor) {
  requireStaff(actor);

  const members = safeArray(await getAllRecords("users"));

  const headers = [
    "UID",
    "نام بازی",
    "نقش",
    "وضعیت",
    "تاریخ عضویت"
  ];

  const rows = members.map(member => [
    member.uid || member.id || "",
    member.gameName || "",
    member.role || "",
    member.active === true ? "فعال" : "غیرفعال",
    safeDate(member.createdAt)
  ]);

  return createCSV(headers, rows);
}

// خروجی جنگ‌ها
export async function exportWarsCSV(actor) {
  requireStaff(actor);

  const wars = safeArray(await getAllRecords("wars"));

  const headers = [
    "شناسه",
    "حریف",
    "نوع",
    "تاریخ",
    "وضعیت",
    "نتیجه"
  ];

  const rows = wars.map(war => [
    war.id || "",
    war.opponent || "",
    war.type || "",
    safeDate(war.date),
    war.status || "",
    war.result || ""
  ]);

  return createCSV(headers, rows);
}

// خروجی درخواست‌های عضویت
export async function exportApplicationsCSV(actor) {
  requireStaff(actor);

  const applications = safeArray(
    await getAllRecords("applications")
  );

  const headers = [
    "شناسه",
    "نام",
    "نام بازی",
    "UID بازی",
    "نوع درخواست",
    "وضعیت",
    "تاریخ ثبت"
  ];

  const rows = applications.map(item => [
    item.id || "",
    item.realName || item.name || "",
    item.gameName || "",
    item.gameUid || item.codmUid || "",
    item.type || "",
    item.status || "",
    safeDate(item.createdAt)
  ]);

  return createCSV(headers, rows);
}

// خروجی مسابقات
export async function exportTournamentsCSV(actor) {
  requireStaff(actor);

  const tournaments = safeArray(
    await getAllRecords("tournaments")
  );

  const headers = [
    "شناسه",
    "عنوان",
    "وضعیت",
    "نوع",
    "تاریخ شروع",
    "تاریخ پایان"
  ];

  const rows = tournaments.map(item => [
    item.id || "",
    item.title || item.name || "",
    item.status || "",
    item.type || "",
    safeDate(item.startDate),
    safeDate(item.endDate)
  ]);

  return createCSV(headers, rows);
}

// خروجی تیم‌ها
export async function exportTeamsCSV(actor) {
  requireStaff(actor);

  const teams = safeArray(await getAllRecords("teams"));

  const headers = [
    "شناسه",
    "نام تیم",
    "وضعیت",
    "کاپیتان",
    "تعداد اعضا"
  ];

  const rows = teams.map(item => [
    item.id || "",
    item.name || item.title || "",
    item.active === false ? "غیرفعال" : "فعال",
    item.captainUid || "",
    Array.isArray(item.members)
      ? item.members.length
      : 0
  ]);

  return createCSV(headers, rows);
}

// خروجی جوایز
export async function exportRewardsCSV(actor) {
  requireStaff(actor);

  const rewards = safeArray(await getAllRecords("rewards"));

  const headers = [
    "شناسه",
    "نام جایزه",
    "هزینه",
    "موجودی",
    "وضعیت"
  ];

  const rows = rewards.map(item => [
    item.id || "",
    item.name || item.title || "",
    item.cost ?? "",
    item.stock ?? "",
    item.active === true ? "فعال" : "غیرفعال"
  ]);

  return createCSV(headers, rows);
}

// دانلود CSV
export function downloadCSV(
  content,
  filename = "invictus-export.csv"
) {
  if (typeof content !== "string") {
    throw new Error("محتوای خروجی معتبر نیست.");
  }

  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof Blob === "undefined"
  ) {
    throw new Error("دانلود فایل در این محیط پشتیبانی نمی‌شود.");
  }

  const safeFilename = String(filename)
    .replace(/[\\/:*?"<>|]/g, "_")
    .slice(0, 100) || "invictus-export.csv";

  const blob = new Blob([content], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = safeFilename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  // کمی تأخیر برای جلوگیری از لغو زودهنگام دانلود در بعضی مرورگرها
  setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    
