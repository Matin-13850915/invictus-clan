
const ERROR_MESSAGES = Object.freeze({
  "auth/invalid-credential": "ایمیل یا رمز عبور اشتباه است.",
  "auth/user-not-found": "حساب کاربری پیدا نشد.",
  "auth/wrong-password": "رمز عبور اشتباه است.",
  "auth/email-already-in-use": "این ایمیل قبلاً ثبت شده است.",
  "auth/weak-password": "رمز عبور به اندازه کافی قوی نیست.",
  "auth/invalid-email": "فرمت ایمیل معتبر نیست.",
  "auth/too-many-requests": "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد تلاش کنید.",
  "auth/network-request-failed": "اتصال اینترنت را بررسی کنید.",
  "auth/requires-recent-login": "برای این عملیات دوباره وارد حساب شوید.",
  "auth/user-disabled": "این حساب غیرفعال شده است.",
  "auth/operation-not-allowed": "این عملیات در تنظیمات احراز هویت فعال نیست.",
  "auth/weak-password": "رمز عبور باید قوی‌تر باشد.",
  "auth/expired-action-code": "لینک بازیابی منقضی شده است.",
  "auth/invalid-action-code": "لینک یا کد تأیید معتبر نیست.",
  "auth/popup-closed-by-user": "پنجره ورود بسته شد.",
  "PERMISSION_DENIED": "اجازه انجام این عملیات را ندارید.",
  "NETWORK_ERROR": "ارتباط با سرور برقرار نشد.",
  "permission-denied": "دسترسی لازم برای این عملیات وجود ندارد.",
  "unavailable": "سرویس موقتاً در دسترس نیست.",
  "database/invalid-path": "مسیر اطلاعات معتبر نیست.",
  "database/invalid-data": "اطلاعات واردشده معتبر نیست.",
  "database/not-found": "اطلاعات موردنظر پیدا نشد.",
  "validation/failed": "اطلاعات واردشده را بررسی کنید.",
  "session/expired": "نشست شما منقضی شده است. دوباره وارد شوید.",
  "session/invalid": "نشست کاربری معتبر نیست.",
  "application/not-found": "درخواست عضویت پیدا نشد.",
  "application/already-exists": "درخواست مشابه قبلاً ثبت شده است.",
  "application/not-assigned": "این درخواست به شما اختصاص داده نشده است.",
  "chat/message-too-long": "متن پیام بیش از حد طولانی است.",
  "chat/edit-expired": "مهلت ویرایش پیام به پایان رسیده است.",
  "chat/room-not-found": "اتاق گفت‌وگو پیدا نشد.",
  "user/not-found": "کاربر پیدا نشد.",
  "user/inactive": "حساب کاربری فعال نیست.",
  "user/unauthorized": "شما مجوز انجام این کار را ندارید."
});

export function getErrorMessage(error) {
  const code = String(
    error?.code ||
    error?.message ||
    ""
  );

  if (ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }

  if (code.startsWith("auth/")) {
    return "در ورود یا احراز هویت مشکلی رخ داد. دوباره تلاش کنید.";
  }

  if (
    code.includes("PERMISSION_DENIED") ||
    code.includes("permission_denied")
  ) {
    return ERROR_MESSAGES.PERMISSION_DENIED;
  }

  if (
    code.includes("network") ||
    code.includes("NETWORK")
  ) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  return "عملیات ناموفق بود. لطفاً دوباره تلاش کنید.";
}

export function handleError(error, logger = console.error) {
  if (typeof logger === "function") {
    logger("INVICTUS ERROR:", {
      code: error?.code || "UNKNOWN",
      message: error?.message || "Unknown error"
    });
  }

  return {
    success: false,
    code: error?.code || "UNKNOWN",
    message: getErrorMessage(error)
  };
}

export function createAppError(code, message) {
  const error = new Error(
    message || getErrorMessage({ code })
  );

  error.code = code || "UNKNOWN";

  return error;
}

export function isPermissionError(error) {
  const code = String(error?.code || "");

  return (
    code.includes("PERMISSION_DENIED") ||
    code.includes("permission-denied") ||
    code.includes("permission_denied")
  );
}

export function isNetworkError(error) {
  const code = String(error?.code || "");

  return (
    code.includes("network") ||
    code.includes("NETWORK") ||
    code === "unavailable"
  );
}

export function isAuthError(error) {
  return String(error?.code || "").startsWith("auth/");
    }
    
