# راه‌اندازی نسخه نهایی INVICTUS

## فایل‌های مهم
- `index.html` نقطه ورود سایت است.
- `assets/` شامل ظاهر و منطق برنامه است.
- `database.rules.json` قوانین Realtime Database است.
- `firebase.json` مسیر فایل قوانین را برای Firebase CLI مشخص می‌کند.
- `tests/verify-project.mjs` بررسی ایستای پروژه را اجرا می‌کند.

## راه‌اندازی Firebase

1. در Firebase Console پروژه `invictus-eec12` را باز کنید.
2. در Authentication، روش ورود **Email/Password** را فعال کنید.
3. در Authentication > Settings > Authorized domains، دامنه‌ای را که سایت روی آن اجرا می‌شود اضافه کنید.
4. حساب ادمین اصلی باید در Firebase Authentication وجود داشته باشد و UID آن دقیقاً این مقدار باشد:

   `kxaAoKgm5WUxqsV9hoAk75XQuL43`

5. قبل از انتشار قوانین محدودکننده، در Realtime Database > Data از طریق کنسول Firebase رکورد ادمین را ایجاد یا بررسی کنید. اگر از قبل وجود دارد، آن را بازنویسی نکنید:

```json
{
  "roles": {
    "kxaAoKgm5WUxqsV9hoAk75XQuL43": {
      "role": "admin",
      "active": true,
      "status": "active",
      "specialty": null
    }
  },
  "users": {
    "kxaAoKgm5WUxqsV9hoAk75XQuL43": {
      "uid": "kxaAoKgm5WUxqsV9hoAk75XQuL43",
      "email": "ADMIN_EMAIL",
      "displayName": "INVICTUS Admin",
      "gameName": "INVICTUS Admin"
    }
  },
  "publicProfiles": {
    "kxaAoKgm5WUxqsV9hoAk75XQuL43": {
      "uid": "kxaAoKgm5WUxqsV9hoAk75XQuL43",
      "displayName": "INVICTUS Admin",
      "gameName": "INVICTUS Admin"
    }
  }
}
```

این JSON را به‌صورت یک‌جا روی دیتابیس موجود Import نکنید؛ فقط nodeهای مربوطه را در مسیرهای گفته‌شده ایجاد یا اصلاح کنید. مقدار `ADMIN_EMAIL` را با ایمیل واقعی حساب ادمین جایگزین کنید.

6. محتوای `database.rules.json` را در Realtime Database > Rules قرار دهید و Publish کنید. قوانین عمداً دسترسی ریشه را می‌بندند؛ دسترسی‌ها در مسیرهای جداگانه و بر اساس نقش و مالکیت کنترل می‌شوند.
7. فایل‌های پروژه را روی هاست استاتیک خود منتشر کنید. اگر از GitHub Pages استفاده می‌کنید، ریشه مخزن و شاخه انتشار را درست انتخاب کنید.

## ساخت حساب اعضا

- کاربر ابتدا فرم عمومی «درخواست عضویت» را ارسال می‌کند.
- لیدر یا ادمین درخواست را بررسی و در صورت نیاز تستر MP/BR را تعیین می‌کند.
- تستر فقط نتیجه و پیشنهاد خود را ثبت می‌کند؛ تصمیم نهایی با لیدر یا ادمین است.
- پس از پذیرش نهایی، متقاضی با همان ایمیل در بخش «ساخت حساب پس از تأیید درخواست» رمز عبور می‌سازد.
- حساب تازه‌ساخته‌شده به نقش `member` فعال متصل می‌شود.
- ساخت حساب لیدر یا تستر از این فرم انجام نمی‌شود؛ ادمین باید UID حساب Firebase آن‌ها را در پنل مدیریت ثبت و نقش مناسب را تعیین کند.

## مسیرهای داده مهم

- `roles/{uid}`: نقش و وضعیت دسترسی
- `users/{uid}`: اطلاعات خصوصی حساب
- `publicProfiles/{uid}`: اطلاعات عمومی قابل نمایش به اعضا
- `applications/{applicationId}`: درخواست‌های عضویت و روند تست
- `approvedApplications/{encodedEmail}`: مجوز یک‌بارمصرف ساخت حساب بعد از پذیرش
- `chats/rooms` و `chats/messages/{roomId}`: اتاق‌ها و چت عمومی
- `privateMessages/conversations/{conversationId}` و `privateMessages/messages/{conversationId}`: پیام خصوصی
- `notifications/{uid}`: اعلان‌های هر کاربر
- `teams`, `wars`, `warApplications`, `rankings`, `tournaments`, `tournamentRequests`, `seasons`
- `rewards`, `rewardRequests`, `pointBalances`
- `tickets`, `bugReports`, `forum/topics`, `forum/posts`
- `clanRules`, `ruleAcceptances`, `clanSettings`

ساختارهای دیگر در اولین استفاده توسط خود برنامه ایجاد می‌شوند. هیچ node حضور و غیاب اضافه نشده و فایل `assets/js/member-presence.js` دست‌نخورده باقی مانده است.

## بررسی پروژه

در محیطی که Node.js نصب است، از ریشه پروژه اجرا کنید:

```bash
npm test
```

این تست، نحو JavaScript، مسیر importهای نسبی، اتصال routeها به توابع render، وجود فایل‌های ورودی و JSON قوانین را بررسی می‌کند.

**محدودیت تست:** این بررسی ایستا است. اتصال واقعی به Firebase، اجرای مرورگر روی دامنه نهایی و اعتبارسنجی قواعد در Firebase Emulator/Console از محیط ساخت ZIP قابل انجام نبود؛ پس نتیجه `npm test` را نباید معادل تست زنده Firebase دانست.
