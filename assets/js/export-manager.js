
import { getAllRecords } from "./database.js";

function requireStaff(actor) {
  if (
    !actor?.uid ||
    !["admin", "leader"].includes(actor.role)
  ) {
    throw new Error("اجازه خروجی گرفتن ندارید.");
  }
}

function safeValue(value) {
  const text = String(value ?? "");

  // جلوگیری از اجرای فرمول‌های مخرب در نرم‌افزارهای صفحه‌گسترده
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

// خروجی فهرست اعضا
export async function exportMembersCSV(actor) {
  requireStaff(actor);

  const members = await getAllRecords("users");

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
    member.createdAt
      ? new Date(member.createdAt).toLocaleDateString("fa-IR")
      : ""
  ]);

  return createCSV(headers, rows);
}

// خروجی تاریخچه جنگ‌ها
export async function exportWarsCSV(actor) {
  requireStaff(actor);

  const wars = await getAllRecords("wars");

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
    war.date || "",
    war.status || "",
    war.result || ""
  ]);

  return createCSV(headers, rows);
}

// دانلود فایل CSV در مرورگر
export function downloadCSV(content, filename = "invictus-export.csv") {
  if (typeof content !== "string") {
    throw new Error("محتوای خروجی معتبر نیست.");
  }

  const blob = new Blob([content], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
