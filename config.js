/* ============================================================
   KM SERVER CONFIG
   هر مقدار را می‌توان با متغیر محیطی (env) عوض کرد
   ============================================================ */
"use strict";
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

function envInt(name, def) {
  const v = parseInt(process.env[name], 10);
  return isNaN(v) ? def : v;
}

/* کلید امضای سشن: اگر در env نباشد، یک بار ساخته و ذخیره می‌شود */
function resolveSecret(dataDir) {
  if (process.env.KM_SECRET && process.env.KM_SECRET.length >= 16) return process.env.KM_SECRET;
  const f = path.join(dataDir, ".session-secret");
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
    const s = crypto.randomBytes(48).toString("hex");
    fs.writeFileSync(f, s, { mode: 0o600 });
    return s;
  } catch (e) {
    return crypto.randomBytes(48).toString("hex");
  }
}

const ROOT = path.join(__dirname, "..");
const DATA_DIR = process.env.KM_DATA_DIR || path.join(__dirname, "data");

module.exports = {
  root: ROOT,                                  // پوشه‌ی سایت استاتیک
  dataDir: DATA_DIR,
  dbFile: path.join(DATA_DIR, "users.json"),
  port: envInt("PORT", 4173),
  host: process.env.KM_HOST || "0.0.0.0",
  secret: resolveSecret(DATA_DIR),
  sessionTtlMs: envInt("KM_SESSION_DAYS", 7) * 24 * 3600 * 1000,

  /* -------- کد مخصوص دولپر (دسترسی نامحدود) --------
     حتماً قبل از انتشار عوضش کن: KM_DEV_CODE=... */
  devCode: process.env.KM_DEV_CODE || "KM-OWNER-2026-OMEGA-7X4Q",
  devEmail: (process.env.KM_DEV_EMAIL || "zarvandikomeil@gmail.com").toLowerCase(),
  devName: process.env.KM_DEV_NAME || "Komeil (Developer)",

  /* -------- دولپر توکن (Dolper Token) --------
     مخزن واحد است: همه‌ی ابزارها از همین یک مخزن کم می‌کنند */
  tokenName: "دولپر توکن",
  tokenNameEn: "Dolper Token",
  freeTokens: envInt("KM_FREE_TOKENS", 300),      // هدیه‌ی ساخت حساب
  dailyTokens: envInt("KM_DAILY_TOKENS", 10),     // هدیه‌ی روزانه

  /* -------- هزینه‌ی هر بار استفاده --------
     این اعداد فعلاً پیش‌فرض هستند.
     هر وقت عددهای خودت را دادی کافی است همین‌جا عوض شوند
     (یا با env مثل KM_COST_IMAGE=7). */
  /* -------- درگاه پرداخت (خرید دولپر توکن) --------
     شماره‌ی کارت/شبا فقط همینجا در سرور نگه داشته می‌شود
     و هرگز به سمت کاربر فرستاده نمی‌شود. */
  dailyToolCap: envInt("KM_DAILY_TOOL_CAP", 15),   // سقف تولید روزانه‌ی هر ابزار
  cooldownSec: envInt("KM_COOLDOWN_SEC", 12),      // فاصله‌ی لازم بین دو تولید
  pay: {
    provider: process.env.KM_PAY_PROVIDER || "vipad",
    priceToman: envInt("KM_TOKEN_PRICE", 1000),   // قیمت هر دولپر توکن
    minTokens: envInt("KM_MIN_BUY", 10),          // حداقل خرید
    maxTokens: envInt("KM_MAX_BUY", 0),           // 0 = بی‌نهایت
    apiKey: process.env.KM_VIPAD_API_KEY || "",
    payLink: process.env.KM_PAY_LINK || "",   // لینک مستقیم درگاه (ویپاد/زرین‌پال/...)
    createUrl: process.env.KM_VIPAD_CREATE_URL || "https://api.vipad.ir/v1/payment/request",
    verifyUrl: process.env.KM_VIPAD_VERIFY_URL || "https://api.vipad.ir/v1/payment/verify",
    callbackUrl: process.env.KM_PAY_CALLBACK || "",
    /* حساب مقصد — محرمانه، فقط برای تسویه‌ی درگاه */
    settlementCard: process.env.KM_SETTLE_CARD || "6219861854658621",
    settlementBank: process.env.KM_SETTLE_BANK || "بانک سامان",
    settlementName: process.env.KM_SETTLE_NAME || "محمد کمیل زروندی",
    supportPhone: process.env.KM_SUPPORT_PHONE || "09928839272"
  },

  costs: {
    image:   envInt("KM_COST_IMAGE", 10),     // ساخت هر عکس
    video:   envInt("KM_COST_VIDEO", 20),     // ساخت هر تصویر/ویدیو
    thumb:   envInt("KM_COST_THUMB", 20),     // ساخت هر تامنیل
    editvid: envInt("KM_COST_EDITVID", 25),   // ادیت هر ویدیو
    editimg: envInt("KM_COST_EDITIMG", 10),   // ادیت هر عکس
    audio: envInt("KM_COST_AUDIO", 20)    // ادیت هر عکس
  },

  toolNames: {
    image:   "ساخت عکس",
    video:   "ساخت تصویر / ویدیو",
    thumb:   "ساخت تامنیل",
    editvid: "ادیت ویدیو",
    editimg: "ادیت عکس",
    audio: "تولید صدا"
  },

  /* -------- ورود با گوگل -------- */
  googleClientId: process.env.KM_GOOGLE_CLIENT_ID || "",

  /* -------- کد یک‌بارمصرف ایمیلی -------- */
  codeTtlMin: envInt("KM_CODE_TTL_MIN", 10),
  codeMaxTries: envInt("KM_CODE_MAX_TRIES", 5),
  /* در حالت توسعه (وقتی SMTP تنظیم نیست) کد در پاسخ API هم برگردد */
  exposeCodeWhenNoSmtp: process.env.KM_EXPOSE_CODE !== "0",

  /* -------- SMTP (مثال برای جیمیل با App Password) -------- */
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: envInt("SMTP_PORT", 465),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
    starttls: process.env.SMTP_STARTTLS !== "0",
    timeoutMs: envInt("SMTP_TIMEOUT_MS", 15000)
  },

  /* -------- محدودیت‌های امنیتی -------- */
  limits: {
    bodyBytes: envInt("KM_MAX_BODY", 64 * 1024),
    authPerMin: envInt("KM_AUTH_PER_MIN", 12),
    codePer10Min: envInt("KM_CODE_PER_10MIN", 5),
    spendPerMin: envInt("KM_SPEND_PER_MIN", 40),
    failedLoginLock: envInt("KM_FAILED_LOCK", 6),
    lockMinutes: envInt("KM_LOCK_MINUTES", 15)
  },

  /* -------- HTTPS اختیاری -------- */
  tls: {
    key: process.env.KM_TLS_KEY || "",
    cert: process.env.KM_TLS_CERT || ""
  }
};
