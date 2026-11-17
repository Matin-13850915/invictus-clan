
const ERROR_MESSAGES = {
  "auth/invalid-credential": "ایمیل یا رمز عبور اشتباه است.",
  "auth/user-not-found": "حساب کاربری پیدا نشد.",
  "auth/wrong-password": "رمز عبور اشتباه است.",
  "auth/email-already-in-use": "این ایمیل قبلاً ثبت شده است.",
  "auth/weak-password": "رمز عبور به اندازه کافی قوی نیست.",
  "auth/invalid-email": "فرمت ایمیل معتبر نیست.",
  "auth/too-many-requests": "تعداد درخواست‌ها بیش از حد مجاز است.",
  "auth/network-request-failed": "اتصال اینترنت را بررسی کنید.",
  "auth/requires-recent-login": "برای این عملیات دوباره وارد حساب شوید.",
  "PERMISSION_DENIED": "اجازه انجام این عملیات را ندارید.",
  "NETWORK_ERROR": "ارتباط با سرور برقرار نشد."
};

export function getErrorMessage(error) {
  const code = error?.code || error?.message || "";

  return ERROR_MESSAGES[code] ||
    "عملیات ناموفق بود. لطفاً دوباره تلاش کنید.";
}

export function handleError(error, logger = console.error) {
  logger("INVICTUS ERROR:", error);

  return {
    success: false,
    message: getErrorMessage(error)
  };
}

export function createAppError(code, message) {
  const error = new Error(message);
  error.code = code;

  return error;
}
