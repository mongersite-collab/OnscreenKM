/* ============================================================
   KM SECURITY CORE - رمزنگاری، هش، سشن و ریت‌لیمیت
   بدون هیچ کتابخانه‌ی خارجی - فقط node:crypto
   ============================================================ */
"use strict";
const crypto = require("crypto");

const SCRYPT = { N: 16384, r: 8, p: 1, len: 64 };

function b64url(buf) {
  return Buffer.from(buf).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(str) {
  str = String(str).replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) {
    // مقایسه‌ی ساختگی تا زمان پاسخ لو نرود
    crypto.timingSafeEqual(A, A);
    return false;
  }
  return crypto.timingSafeEqual(A, B);
}

/* ---------- رمز عبور ---------- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(password), salt, SCRYPT.len, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024
  });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("hex"), key.toString("hex")].join("$");
}

function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split("$");
    if (parts[0] !== "scrypt") return false;
    const N = +parts[1], r = +parts[2], p = +parts[3];
    const salt = Buffer.from(parts[4], "hex");
    const expected = Buffer.from(parts[5], "hex");
    const key = crypto.scryptSync(String(password), salt, expected.length, {
      N, r, p, maxmem: 64 * 1024 * 1024
    });
    return crypto.timingSafeEqual(key, expected);
  } catch (e) { return false; }
}

/* ---------- توکن سشن (امضای HMAC-SHA256) ---------- */
function signSession(payload, secret, ttlMs) {
  const body = Object.assign({}, payload, {
    iat: Date.now(),
    exp: Date.now() + (ttlMs || 7 * 24 * 3600 * 1000),
    jti: crypto.randomBytes(9).toString("hex")
  });
  const data = b64url(JSON.stringify(body));
  const sig = b64url(crypto.createHmac("sha256", secret).update(data).digest());
  return data + "." + sig;
}

function verifySession(token, secret) {
  if (typeof token !== "string" || token.indexOf(".") < 0) return null;
  const i = token.lastIndexOf(".");
  const data = token.slice(0, i), sig = token.slice(i + 1);
  const good = b64url(crypto.createHmac("sha256", secret).update(data).digest());
  if (!safeEqual(sig, good)) return null;
  let body;
  try { body = JSON.parse(unb64url(data).toString("utf8")); } catch (e) { return null; }
  if (!body || typeof body.exp !== "number" || Date.now() > body.exp) return null;
  return body;
}

/* ---------- کد ۶ رقمی و شناسه‌ها ---------- */
function numericCode(digits) {
  digits = digits || 6;
  let out = "";
  while (out.length < digits) {
    out += (crypto.randomBytes(1)[0] % 10).toString();
  }
  return out;
}
function randomId(bytes) { return crypto.randomBytes(bytes || 12).toString("hex"); }
function sha256(str) { return crypto.createHash("sha256").update(String(str)).digest("hex"); }

/* ---------- ریت‌لیمیت پنجره‌ی لغزان ---------- */
function createLimiter(max, windowMs) {
  const hits = new Map();
  setInterval(function () {
    const now = Date.now();
    hits.forEach(function (arr, k) {
      const keep = arr.filter(function (t) { return now - t < windowMs; });
      if (keep.length) hits.set(k, keep); else hits.delete(k);
    });
  }, Math.min(windowMs, 60000)).unref();

  return function check(key) {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter(function (t) { return now - t < windowMs; });
    if (arr.length >= max) {
      const retry = Math.ceil((windowMs - (now - arr[0])) / 1000);
      hits.set(key, arr);
      return { ok: false, retryAfter: retry };
    }
    arr.push(now);
    hits.set(key, arr);
    return { ok: true, remaining: max - arr.length };
  };
}

/* ---------- اعتبارسنجی ---------- */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function normEmail(e) { return String(e || "").trim().toLowerCase(); }
function validEmail(e) { e = normEmail(e); return e.length <= 190 && EMAIL_RE.test(e); }

function passwordProblem(pw) {
  pw = String(pw || "");
  if (pw.length < 8) return "رمز عبور باید حداقل ۸ کاراکتر باشد.";
  if (pw.length > 200) return "رمز عبور خیلی بلند است.";
  if (!/[A-Za-z\u0600-\u06FF]/.test(pw)) return "رمز عبور باید حداقل یک حرف داشته باشد.";
  if (!/[0-9]/.test(pw)) return "رمز عبور باید حداقل یک عدد داشته باشد.";
  const weak = ["password", "12345678", "qwertyui", "11111111", "iloveyou"];
  if (weak.indexOf(pw.toLowerCase()) > -1) return "این رمز عبور خیلی ساده است.";
  return null;
}

function sanitizeName(n) {
  return String(n || "").replace(/[<>\r\n\t]/g, "").trim().slice(0, 60);
}

module.exports = {
  b64url, unb64url, safeEqual,
  hashPassword, verifyPassword,
  signSession, verifySession,
  numericCode, randomId, sha256,
  createLimiter,
  normEmail, validEmail, passwordProblem, sanitizeName
};
