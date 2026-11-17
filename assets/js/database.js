
import {
  db,
  ref,
  get,
  set,
  update,
  push,
  remove,
  query,
  orderByChild,
  equalTo,
  onValue,
  runTransaction
} from "./firebase.js";

/**
 * اعتبارسنجی مسیرهای Realtime Database
 */
function validatePath(path) {
  if (
    typeof path !== "string" ||
    !path.trim() ||
    path.startsWith("/") ||
    path.endsWith("/") ||
    path.includes("//")
  ) {
    throw new Error("مسیر دیتابیس معتبر نیست.");
  }

  const parts = path.split("/");

  for (const part of parts) {
    if (
      !part ||
      part === "." ||
      part === ".." ||
      /[#$[\]]/.test(part) ||
      (part.includes(".") && part !== ".info")
    ) {
      throw new Error("بخش نامعتبر در مسیر دیتابیس وجود دارد.");
    }
  }

  return path;
}

/**
 * اعتبارسنجی مقدار رکورد
 */
function validateObject(value, message) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(message);
  }
}

/**
 * خواندن اطلاعات
 */
export async function readData(path) {
  const snapshot = await get(
    ref(db, validatePath(path))
  );

  return snapshot.exists()
    ? snapshot.val()
    : null;
}

/**
 * نوشتن کامل اطلاعات
 */
export async function writeData(path, value) {
  await set(
    ref(db, validatePath(path)),
    value
  );

  return true;
}

/**
 * ویرایش بخشی از اطلاعات
 */
export async function updateData(path, values) {
  validateObject(
    values,
    "اطلاعات ارسالی معتبر نیست."
  );

  if (!Object.keys(values).length) {
    throw new Error("هیچ اطلاعاتی برای ویرایش ارسال نشده است.");
  }

  await update(
    ref(db, validatePath(path)),
    values
  );

  return true;
}

/**
 * سازگاری با فایل‌هایی که updateRecord وارد می‌کنند
 */
export async function updateRecord(path, values) {
  return updateData(path, values);
}

/**
 * حذف اطلاعات
 */
export async function deleteData(path) {
  await remove(
    ref(db, validatePath(path))
  );

  return true;
}

/**
 * ایجاد رکورد جدید
 */
export async function createRecord(path, value) {
  validateObject(
    value,
    "اطلاعات رکورد معتبر نیست."
  );

  const newRecord = push(
    ref(db, validatePath(path))
  );

  const now = Date.now();

  await set(newRecord, {
    ...value,
    createdAt: value.createdAt ?? now,
    updatedAt: value.updatedAt ?? now
  });

  return newRecord.key;
}

/**
 * دریافت یک رکورد
 */
export async function getRecord(path) {
  const data = await readData(path);

  if (data === null) {
    return null;
  }

  if (
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return data;
  }

  return {
    ...data,
    id: data.id || path.split("/").pop()
  };
}

/**
 * دریافت تمام رکوردهای یک مجموعه
 */
export async function getAllRecords(path) {
  const data = await readData(path);

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return [];
  }

  return Object.entries(data)
    .filter(([, item]) => item !== null)
    .map(([id, item]) => ({
      ...(item && typeof item === "object"
        ? item
        : { value: item }),
      id
    }));
}

/**
 * جستجو بر اساس یک فیلد
 */
export async function findByField(path, field, value) {
  if (
    typeof field !== "string" ||
    !field.trim() ||
    /[.#$[\]/]/.test(field)
  ) {
    throw new Error("نام فیلد معتبر نیست.");
  }

  const recordsQuery = query(
    ref(db, validatePath(path)),
    orderByChild(field),
    equalTo(value)
  );

  const snapshot = await get(recordsQuery);

  if (!snapshot.exists()) {
    return [];
  }

  return Object.entries(snapshot.val())
    .map(([id, item]) => ({
      ...(item && typeof item === "object"
        ? item
        : { value: item }),
      id
    }));
}

/**
 * گوش دادن زنده به تغییرات دیتابیس
 */
export function listenToData(
  path,
  callback,
  onError = () => {}
) {
  if (typeof callback !== "function") {
    throw new Error("تابع دریافت اطلاعات معتبر نیست.");
  }

  if (typeof onError !== "function") {
    throw new Error("تابع مدیریت خطا معتبر نیست.");
  }

  return onValue(
    ref(db, validatePath(path)),
    snapshot => {
      callback(
        snapshot.exists()
          ? snapshot.val()
          : null
      );
    },
    error => {
      onError(error);
    }
  );
}

/**
 * تغییر اتمیک مقدار عددی
 */
export async function changeNumberAtomically(
  path,
  amount
) {
  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount)
  ) {
    throw new Error("مقدار عددی معتبر نیست.");
  }

  const result = await runTransaction(
    ref(db, validatePath(path)),
    currentValue => {
      const current =
        currentValue === null
          ? 0
          : Number(currentValue);

      if (!Number.isFinite(current)) {
        return;
      }

      return current + amount;
    }
  );

  if (!result.committed) {
    throw new Error("تغییر اطلاعات انجام نشد.");
  }

  return result.snapshot.val();
  }
  
