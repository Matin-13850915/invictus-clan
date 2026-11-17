
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

function validatePath(path) {
  if (
    typeof path !== "string" ||
    !path.trim() ||
    path.includes("//") ||
    path.startsWith("/") ||
    path.endsWith("/") ||
    path.split("/").some(part => part === "." || part === "..")
  ) {
    throw new Error("مسیر دیتابیس معتبر نیست.");
  }

  return path;
}

export async function readData(path) {
  const snapshot = await get(ref(db, validatePath(path)));
  return snapshot.exists() ? snapshot.val() : null;
}

export async function writeData(path, value) {
  await set(ref(db, validatePath(path)), value);
  return true;
}

export async function updateData(path, values) {
  if (
    !values ||
    typeof values !== "object" ||
    Array.isArray(values)
  ) {
    throw new Error("اطلاعات ارسالی معتبر نیست.");
  }

  await update(ref(db, validatePath(path)), values);
  return true;
}

export async function deleteData(path) {
  await remove(ref(db, validatePath(path)));
  return true;
}

export async function createRecord(path, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("اطلاعات رکورد معتبر نیست.");
  }

  const newRecord = push(ref(db, validatePath(path)));

  await set(newRecord, {
    ...value,
    createdAt: Date.now()
  });

  return newRecord.key;
}

export async function getRecord(path) {
  const data = await readData(path);

  if (data === null) return null;

  if (typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  return {
    ...data,
    id: data.id || path.split("/").pop()
  };
}

export async function getAllRecords(path) {
  const data = await readData(path);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  return Object.entries(data).map(([id, item]) => ({
    ...(item && typeof item === "object" ? item : { value: item }),
    id
  }));
}

export async function findByField(path, field, value) {
  if (typeof field !== "string" || !field.trim()) {
    throw new Error("نام فیلد معتبر نیست.");
  }

  const recordsQuery = query(
    ref(db, validatePath(path)),
    orderByChild(field),
    equalTo(value)
  );

  const snapshot = await get(recordsQuery);

  if (!snapshot.exists()) return [];

  return Object.entries(snapshot.val()).map(([id, item]) => ({
    ...item,
    id
  }));
}

export function listenToData(path, callback, onError = () => {}) {
  if (typeof callback !== "function") {
    throw new Error("تابع دریافت اطلاعات معتبر نیست.");
  }

  return onValue(
    ref(db, validatePath(path)),
    snapshot => {
      callback(snapshot.exists() ? snapshot.val() : null);
    },
    error => onError(error)
  );
}

export async function changeNumberAtomically(path, amount) {
  if (!Number.isFinite(amount)) {
    throw new Error("مقدار عددی معتبر نیست.");
  }

  const result = await runTransaction(
    ref(db, validatePath(path)),
    currentValue => {
      const current = Number(currentValue || 0);

      if (!Number.isFinite(current)) return;

      return current + amount;
    }
  );

  if (!result.committed) {
    throw new Error("تغییر اطلاعات انجام نشد.");
  }

  return result.snapshot.val();
    }
