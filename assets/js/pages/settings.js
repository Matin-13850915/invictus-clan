
import { readData, writeData } from "../database.js";

const $ = (tag, className = "", text = "") => {
  const el = document.createElement(tag);

  if (className) el.className = className;

  if (text !== undefined && text !== null) {
    el.textContent = String(text);
  }

  return el;
};

const isManager = user =>
  user?.active === true &&
  ["admin", "leader"].includes(user.role);

function makeButton(label, className, callback) {
  const button = $("button", className, label);
  button.type = "button";
  button.addEventListener("click", callback);
  return button;
}

function field(labelText, value, name, type = "text") {
  const wrapper = $("label", "form-field");
  wrapper.appendChild($("span", "form-label", labelText));

  const input = $("input", "form-input");
  input.type = type;
  input.name = name;
  input.value = value ?? "";

  wrapper.appendChild(input);
  return wrapper;
}

function checkboxField(labelText, checked, name) {
  const wrapper = $("label", "settings-checkbox");

  const input = $("input");
  input.type = "checkbox";
  input.name = name;
  input.checked = checked === true;

  wrapper.append(
    input,
    $("span", "", labelText)
  );

  return wrapper;
}

function section(title, description = "") {
  const wrapper = $("section", "card settings-section");

  wrapper.appendChild(
    $("h2", "section-title", title)
  );

  if (description) {
    wrapper.appendChild(
      $("p", "settings-description", description)
    );
  }

  return wrapper;
}

export async function renderSettings(container, user) {
  if (!(container instanceof HTMLElement)) {
    throw new Error("محل نمایش تنظیمات معتبر نیست.");
  }

  if (!isManager(user)) {
    container.replaceChildren(
      $("div", "card error-state",
        "دسترسی به تنظیمات فقط برای لیدر و ادمین مجاز است."
      )
    );
    return;
  }

  const load = async () => {
    container.replaceChildren(
      $("p", "loading-state", "در حال دریافت تنظیمات...")
    );

    try {
      const settings = await readData("clanSettings") || {};

      const page = $("div", "settings-page");

      const header = $("section", "card settings-header");

      header.append(
        $("h1", "card-title", "تنظیمات کلن INVICTUS"),
        $("p", "",
          "مدیریت اطلاعات عمومی و قابلیت‌های کلن"
        )
      );

      page.appendChild(header);

      const form = $("form", "settings-form");

      const general = section(
        "اطلاعات عمومی",
        "اطلاعات اصلی نمایش داده‌شده در بخش‌های مختلف سایت."
      );

      general.append(
        field(
          "نام کلن",
          settings.name || "INVICTUS",
          "name"
        ),
        field(
          "توضیحات کلن",
          settings.description || "",
          "description"
        ),
        field(
          "تگ کلن",
          settings.tag || "INVICTUS",
          "tag"
        ),
        field(
          "شناسه داخل بازی",
          settings.gameId || "",
          "gameId"
        ),
        field(
          "لینک ارتباطی",
          settings.contactUrl || "",
          "contactUrl",
          "url"
        )
      );

      const recruitment = section(
        "وضعیت جذب عضو",
        "کنترل باز یا بسته بودن درخواست عضویت."
      );

      recruitment.appendChild(
        checkboxField(
          "فعال بودن جذب عضو",
          settings.recruitmentOpen !== false,
          "recruitmentOpen"
        )
      );

      const features = section(
        "قابلیت‌های سایت",
        "این گزینه‌ها فقط تنظیمات نمایشی هستند و جایگزین کنترل دسترسی امنیتی نمی‌شوند."
      );

      const featureSettings = settings.features || {};

      features.append(
        checkboxField(
          "نمایش رتبه‌بندی",
          featureSettings.rankings !== false,
          "featureRankings"
        ),
        checkboxField(
          "نمایش تورنمنت‌ها",
          featureSettings.tournaments !== false,
          "featureTournaments"
        ),
        checkboxField(
          "نمایش تیم‌ها",
          featureSettings.teams !== false,
          "featureTeams"
        ),
        checkboxField(
          "نمایش فروشگاه جوایز",
          featureSettings.rewards !== false,
          "featureRewards"
        ),
        checkboxField(
          "نمایش چت عمومی",
          featureSettings.chat !== false,
          "featureChat"
        )
      );

      const save = $("button", "primary-button", "ذخیره تنظیمات");
      save.type = "submit";

      form.append(general, recruitment, features, save);

      form.addEventListener("submit", async event => {
        event.preventDefault();

        if (!confirm("تنظیمات جدید ذخیره شوند؟")) return;

        save.disabled = true;

        const get = name =>
          form.elements.namedItem(name);

        const nextSettings = {
          ...settings,
          name: get("name").value.trim(),
          description: get("description").value.trim(),
          tag: get("tag").value.trim(),
          gameId: get("gameId").value.trim(),
          contactUrl: get("contactUrl").value.trim(),
          recruitmentOpen: get("recruitmentOpen").checked,
          features: {
            rankings: get("featureRankings").checked,
            tournaments: get("featureTournaments").checked,
            teams: get("featureTeams").checked,
            rewards: get("featureRewards").checked,
            chat: get("featureChat").checked
          },
          updatedAt: Date.now(),
          updatedBy: user.uid
        };

        try {
          await writeData("clanSettings", nextSettings);
          alert("تنظیمات با موفقیت ذخیره شد.");
          await load();
        } catch (error) {
          alert(error.message || "ذخیره تنظیمات انجام نشد.");
        } finally {
          save.disabled = false;
        }
      });

      page.appendChild(form);

      const warning = $("div", "card settings-warning");

      warning.appendChild(
        $("p", "",
          "تغییر تنظیمات نمایشی به‌تنهایی دسترسی کاربران را محدود نمی‌کند. امنیت واقعی باید در قوانین Firebase نیز اعمال شود."
        )
      );

      page.appendChild(warning);

      container.replaceChildren(page);

    } catch (error) {
      console.error("Settings page error:", error);

      const box = $("div", "card error-state");

      box.append(
        $("p", "",
          error.message || "دریافت تنظیمات انجام نشد."
        ),
        makeButton("تلاش دوباره", "secondary-button", load)
      );

      container.replaceChildren(box);
    }
  };

  await load();
                        }
  
