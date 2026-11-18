
import {
  getProfile,
  updateOwnProfile
} from "../profile.js";

import {
  auth,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "../firebase.js";

const $ = (tag, className = "", value = "") => {
  const element = document.createElement(tag);

  if (className) element.className = className;

  element.textContent = String(value ?? "");
  return element;
};

function createField(labelText, name, value, options = {}) {
  const wrapper = $("label", "form-field");

  wrapper.appendChild(
    $("span", "form-label", labelText)
  );

  const input = document.createElement(
    options.multiline ? "textarea" : "input"
  );

  input.className = "form-input";
  input.name = name;

  if (!options.multiline) {
    input.type = options.type || "text";
  }

  input.value = value ?? "";

  if (options.maxLength) {
    input.maxLength = options.maxLength;
  }

  if (options.min !== undefined) {
    input.min = String(options.min);
  }

  if (options.max !== undefined) {
    input.max = String(options.max);
  }

  wrapper.appendChild(input);

  return wrapper;
}

function createInfo(label, value) {
  const row = $("div", "profile-info-row");

  row.append(
    $("span", "profile-info-label", label),
    $("strong", "profile-info-value", value || "ثبت نشده")
  );

  return row;
}

export async function renderProfile(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش پروفایل معتبر نیست.");
  }

  if (!user?.uid || user.active !== true) {
    container.replaceChildren(
      $("div", "card error-state",
        "برای مشاهده پروفایل باید وارد حساب فعال خود شوید."
      )
    );
    return;
  }

  const load = async () => {
    container.replaceChildren(
      $("p", "loading-state", "در حال دریافت پروفایل...")
    );

    try {
      const profile = await getProfile(user.uid, user) || {};

      const page = $("div", "profile-page");
      const header = $("section", "card profile-header");

      header.append(
        $("h1", "card-title", "پروفایل من"),
        $("p", "profile-subtitle",
          "اطلاعات شخصی و مشخصات داخل بازی"
        )
      );

      const account = $("section", "card profile-account");

      account.append(
        $("h2", "section-title", "اطلاعات حساب"),
        createInfo("شناسه کاربری", user.uid),
        createInfo("ایمیل", user.email),
        createInfo("نقش", {
          admin: "مدیر کل",
          leader: "لیدر",
          tester: "تستر",
          member: "عضو"
        }[user.role] || "نامشخص")
      );

      const form = $("form", "card profile-form");

      form.appendChild(
        $("h2", "section-title", "ویرایش اطلاعات")
      );

      form.append(
        createField(
          "نام نمایشی",
          "displayName",
          profile.displayName,
          { maxLength: 40 }
        ),
        createField(
          "نام داخل بازی",
          "gameName",
          profile.gameName,
          { maxLength: 40 }
        ),
        createField(
          "لول بازی",
          "gameLevel",
          profile.gameLevel,
          {
            type: "number",
            min: 1,
            max: 500
          }
        ),
        createField(
          "آیدی تلگرام",
          "telegram",
          profile.telegram,
          { maxLength: 60 }
        ),
        createField(
          "آیدی روبیکا",
          "rubika",
          profile.rubika,
          { maxLength: 60 }
        ),
        createField(
          "درباره من",
          "bio",
          profile.bio,
          {
            multiline: true,
            maxLength: 300
          }
        )
      );

      const note = $("p", "form-hint",
        "نقش و سطح دسترسی فقط توسط مدیریت کلن تعیین می‌شود."
      );

      const save = $("button", "primary-button",
        "ذخیره تغییرات"
      );

      save.type = "submit";

      form.append(note, save);

      form.addEventListener("submit", async event => {
        event.preventDefault();

        const get = name =>
          form.elements.namedItem(name)?.value ?? "";

        const levelValue = get("gameLevel").trim();

        const changes = {
          displayName: get("displayName"),
          gameName: get("gameName"),
          telegram: get("telegram"),
          rubika: get("rubika"),
          bio: get("bio")
        };

        if (levelValue !== "") {
          changes.gameLevel = Number(levelValue);
        }

        save.disabled = true;

        try {
          await updateOwnProfile(
            user.uid,
            changes,
            user
          );

          alert("پروفایل با موفقیت ذخیره شد.");
          await load();

        } catch (error) {
          alert(
            error.message || "ذخیره پروفایل ناموفق بود."
          );
        } finally {
          save.disabled = false;
        }
      });

      const security = $("section", "card profile-security");
      security.append(
        $("h2", "section-title", "امنیت حساب"),
        $("p", "form-hint", "برای تغییر رمز عبور، رمز فعلی و رمز جدید را وارد کنید.")
      );

      const passwordForm = $("form", "profile-form");
      const currentPassword = document.createElement("input");
      currentPassword.className = "form-input";
      currentPassword.type = "password";
      currentPassword.autocomplete = "current-password";
      currentPassword.minLength = 8;
      currentPassword.required = true;
      currentPassword.placeholder = "رمز عبور فعلی";

      const newPassword = document.createElement("input");
      newPassword.className = "form-input";
      newPassword.type = "password";
      newPassword.autocomplete = "new-password";
      newPassword.minLength = 8;
      newPassword.required = true;
      newPassword.placeholder = "رمز عبور جدید (حداقل ۸ کاراکتر)";

      const confirmPassword = document.createElement("input");
      confirmPassword.className = "form-input";
      confirmPassword.type = "password";
      confirmPassword.autocomplete = "new-password";
      confirmPassword.minLength = 8;
      confirmPassword.required = true;
      confirmPassword.placeholder = "تکرار رمز عبور جدید";

      const passwordSubmit = $("button", "primary-button", "تغییر رمز عبور");
      passwordSubmit.type = "submit";
      passwordForm.append(
        currentPassword,
        newPassword,
        confirmPassword,
        passwordSubmit
      );

      passwordForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (newPassword.value !== confirmPassword.value) {
          alert("رمز جدید و تکرار آن یکسان نیستند.");
          return;
        }

        if (newPassword.value.length < 8) {
          alert("رمز جدید باید حداقل ۸ کاراکتر باشد.");
          return;
        }

        const firebaseUser = auth.currentUser;
        if (!firebaseUser || !user.email) {
          alert("نشست ورود معتبر نیست؛ دوباره وارد شوید.");
          return;
        }

        passwordSubmit.disabled = true;

        try {
          const credential = EmailAuthProvider.credential(
            user.email,
            currentPassword.value
          );

          await reauthenticateWithCredential(firebaseUser, credential);
          await updatePassword(firebaseUser, newPassword.value);
          passwordForm.reset();
          alert("رمز عبور با موفقیت تغییر کرد.");
        } catch (error) {
          console.error("Password change failed:", error);
          alert(
            error?.code === "auth/wrong-password" ||
            error?.code === "auth/invalid-credential"
              ? "رمز عبور فعلی اشتباه است."
              : error?.message || "تغییر رمز عبور انجام نشد."
          );
        } finally {
          passwordSubmit.disabled = false;
        }
      });

      security.appendChild(passwordForm);
      page.append(header, account, form, security);
      container.replaceChildren(page);

    } catch (error) {
      console.error("Profile page error:", error);

      const errorCard = $("div", "card error-state");

      errorCard.append(
        $("p", "",
          error.message || "دریافت پروفایل انجام نشد."
        ),
        (() => {
          const button = $("button", "secondary-button",
            "تلاش دوباره"
          );

          button.type = "button";
          button.addEventListener("click", load);

          return button;
        })()
      );

      container.replaceChildren(errorCard);
    }
  };

  await load();
}
  
