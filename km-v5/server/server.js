/* ============================================================
   ONSCREENKM - SECURITY SERVER
   سرور امنیتی + سرویس توکن + میزبانی سایت
   Node.js >= 18  |  بدون هیچ وابستگی npm
   اجرا:  node server/server.js
   ============================================================ */
"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");
const crypto = require("crypto");

const CFG = require("./config");
const S = require("./lib/secure");
const Store = require("./lib/store");
const Mailer = require("./lib/mailer");

const store = new Store(CFG.dbFile);
const mailer = new Mailer(CFG.smtp);

const TOOLS = Object.keys(CFG.costs);

/* ---------- ریت‌لیمیترها ---------- */
const limitAuth = S.createLimiter(CFG.limits.authPerMin, 60 * 1000);
const limitCode = S.createLimiter(CFG.limits.codePer10Min, 10 * 60 * 1000);
const limitSpend = S.createLimiter(CFG.limits.spendPerMin, 60 * 1000);

/* ---------- کدهای یک‌بارمصرف در حافظه ---------- */
const codes = new Map(); // email -> { hash, exp, tries, name }
setInterval(function () {
  const now = Date.now();
  codes.forEach(function (v, k) { if (v.exp < now) codes.delete(k); });
}, 60 * 1000).unref();

/* ============================================================
   کمکی‌ها
   ============================================================ */

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=(self)");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
    "connect-src 'self' https://oauth2.googleapis.com https://accounts.google.com",
    "frame-src https://accounts.google.com",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join("; "));
  if (CFG.tls.key && CFG.tls.cert) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function sendJson(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readBody(req, max) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on("data", function (c) {
      size += c.length;
      if (size > max) {
        reject(new Error("body-too-large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", function () {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(new Error("bad-json")); }
    });
    req.on("error", reject);
  });
}

function freshTokens() {
  return CFG.freeTokens;   // مخزن واحدِ دولپر توکن
}

/* مدل قدیمی (توکن جداگانه برای هر ابزار) را به مخزن واحد تبدیل می‌کند */
function poolOf(u) {
  if (typeof u.tokens === "number") return u.tokens;
  if (u.tokens && typeof u.tokens === "object") {
    let sum = 0;
    Object.keys(u.tokens).forEach(function (k) { sum += Number(u.tokens[k]) || 0; });
    u.tokens = sum;
    return sum;
  }
  u.tokens = CFG.freeTokens;
  return u.tokens;
}

function dayStamp(ts) {
  const d = new Date(ts || Date.now());
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

/* هدیه‌ی روزانه: هر روز تقویمی یک بار */
function applyDaily(u) {
  if (u.unlimited) return 0;
  const today = dayStamp();
  if (u.lastDaily === today) return 0;
  poolOf(u);
  u.tokens += CFG.dailyTokens;
  u.lastDaily = today;
  u.dailyGrantedAt = Date.now();
  store.putUser(u);
  return CFG.dailyTokens;
}

function publicUser(u) {
  return {
    email: u.email,
    name: u.name,
    provider: u.provider,
    role: u.unlimited ? "developer" : "member",
    unlimited: !!u.unlimited,
    tokens: u.unlimited ? null : poolOf(u),
    tokenName: CFG.tokenName,
    dailyTokens: CFG.dailyTokens,
    lastDaily: u.lastDaily || null,
    createdAt: u.createdAt,
    usageCount: u.usageCount || 0,
    usage: (u.usage || []).slice(-25)
  };
}

function issue(res, user, extra) {
  const dailyGranted = applyDaily(user);
  user.lastLogin = Date.now();
  user.failed = 0;
  user.lockedUntil = 0;
  store.putUser(user);
  const token = S.signSession(
    { sub: user.email, role: user.unlimited ? "dev" : "member" },
    CFG.secret, CFG.sessionTtlMs
  );
  sendJson(res, 200, Object.assign({
    ok: true,
    session: token,
    expiresAt: Date.now() + CFG.sessionTtlMs,
    user: publicUser(user),
    costs: CFG.costs,
    toolNames: CFG.toolNames,
    tokenName: CFG.tokenName,
    dailyGranted: dailyGranted
  }, extra || {}));
}

function authUser(req) {
  const h = req.headers["authorization"] || "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  if (!m) return null;
  const payload = S.verifySession(m[1], CFG.secret);
  if (!payload) return null;
  if (store.isRevoked(payload.jti)) return null;
  const u = store.getUser(payload.sub);
  if (!u || u.disabled) return null;
  u._jti = payload.jti;
  u._exp = payload.exp;
  return u;
}

function ensureDevUser(email, name) {
  let u = store.getUser(email);
  if (!u) {
    u = {
      id: S.randomId(),
      email: email,
      name: name || CFG.devName,
      provider: "dev-code",
      passHash: null,
      verified: true,
      unlimited: true,
      tokens: freshTokens(),
      usageCount: 0,
      usage: [],
      createdAt: Date.now()
    };
  }
  u.unlimited = true;
  u.verified = true;
  store.putUser(u);
  return u;
}

/* ---------- اعتبارسنجی توکن گوگل ---------- */
function verifyGoogleIdToken(idToken) {
  return new Promise(function (resolve, reject) {
    if (!idToken || idToken.length > 4096) return reject(new Error("bad-token"));
    const req = https.request({
      host: "oauth2.googleapis.com",
      path: "/tokeninfo?id_token=" + encodeURIComponent(idToken),
      method: "GET",
      timeout: 10000
    }, function (r) {
      let data = "";
      r.on("data", function (c) { data += c; });
      r.on("end", function () {
        let j = null;
        try { j = JSON.parse(data); } catch (e) {}
        if (!j || r.statusCode !== 200 || !j.email) return reject(new Error("google-verify-failed"));
        if (CFG.googleClientId && j.aud !== CFG.googleClientId) return reject(new Error("aud-mismatch"));
        if (j.email_verified !== "true" && j.email_verified !== true) return reject(new Error("email-not-verified"));
        resolve({ email: S.normEmail(j.email), name: S.sanitizeName(j.name || j.given_name || "") });
      });
    });
    req.on("timeout", function () { req.destroy(new Error("timeout")); });
    req.on("error", reject);
    req.end();
  });
}

/* ============================================================
   API
   ============================================================ */

async function handleApi(req, res, pathname) {
  const ip = clientIp(req);
  const method = req.method.toUpperCase();

  /* ---------- GET /api/config ---------- */
  if (pathname === "/api/config" && method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      brand: "OnscreenKM",
      freeTokens: CFG.freeTokens,
      dailyTokens: CFG.dailyTokens,
      pay: {
        provider: CFG.pay.provider,
        priceToman: CFG.pay.priceToman,
        minTokens: CFG.pay.minTokens,
        maxTokens: CFG.pay.maxTokens,
        enabled: !!CFG.pay.apiKey,
        supportPhone: CFG.pay.supportPhone
      },
      tokenName: CFG.tokenName,
      tokenNameEn: CFG.tokenNameEn,
      costs: CFG.costs,
      toolNames: CFG.toolNames,
      googleClientId: CFG.googleClientId,
      emailCodeEnabled: true,
      smtpConfigured: mailer.enabled,
      codeTtlMin: CFG.codeTtlMin
    });
  }

  /* ---------- GET /api/health ---------- */
  if (pathname === "/api/health" && method === "GET") {
    return sendJson(res, 200, { ok: true, name: "KM Security Server", version: "1.0", users: store.allUsers().length });
  }

  if (method !== "POST" && method !== "GET") {
    return sendJson(res, 405, { ok: false, error: "متد مجاز نیست." });
  }

  let body = {};
  if (method === "POST") {
    try { body = await readBody(req, CFG.limits.bodyBytes); }
    catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message === "body-too-large" ? "حجم درخواست زیاد است." : "داده‌ی نامعتبر." });
    }
  }

  /* ---------- ثبت‌نام ---------- */
  if (pathname === "/api/auth/register" && method === "POST") {
    const rl = limitAuth(ip);
    if (!rl.ok) return sendJson(res, 429, { ok: false, error: "درخواست زیاد. " + rl.retryAfter + " ثانیه صبر کن." });

    const email = S.normEmail(body.email);
    if (!S.validEmail(email)) return sendJson(res, 400, { ok: false, error: "ایمیل معتبر نیست." });
    const pwProblem = S.passwordProblem(body.password);
    if (pwProblem) return sendJson(res, 400, { ok: false, error: pwProblem });
    if (store.getUser(email)) return sendJson(res, 409, { ok: false, error: "این ایمیل قبلاً ثبت شده. وارد شو." });

    const user = {
      id: S.randomId(),
      email: email,
      name: S.sanitizeName(body.name) || email.split("@")[0],
      provider: "password",
      passHash: S.hashPassword(body.password),
      verified: false,
      unlimited: email === CFG.devEmail && !!body.devCode && S.safeEqual(body.devCode, CFG.devCode),
      tokens: freshTokens(),
      usageCount: 0,
      usage: [],
      createdAt: Date.now()
    };
    store.putUser(user);
    store.saveNow();
    console.log("[auth] حساب جدید:", email);
    return issue(res, user, { welcome: true });
  }

  /* ---------- ورود با رمز ---------- */
  if (pathname === "/api/auth/login" && method === "POST") {
    const rl = limitAuth(ip);
    if (!rl.ok) return sendJson(res, 429, { ok: false, error: "درخواست زیاد. " + rl.retryAfter + " ثانیه صبر کن." });

    const email = S.normEmail(body.email);
    const user = store.getUser(email);
    const GENERIC = "ایمیل یا رمز عبور درست نیست.";

    if (!user || !user.passHash) {
      S.hashPassword("dummy-timing-guard"); // هم‌زمان‌سازی پاسخ
      return sendJson(res, 401, { ok: false, error: GENERIC });
    }
    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      const min = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return sendJson(res, 423, { ok: false, error: "حساب موقتاً قفل است. " + min + " دقیقه دیگر تلاش کن." });
    }
    if (!S.verifyPassword(body.password, user.passHash)) {
      user.failed = (user.failed || 0) + 1;
      if (user.failed >= CFG.limits.failedLoginLock) {
        user.lockedUntil = Date.now() + CFG.limits.lockMinutes * 60000;
        user.failed = 0;
      }
      store.putUser(user);
      return sendJson(res, 401, { ok: false, error: GENERIC });
    }
    return issue(res, user);
  }

  /* ---------- درخواست کد ایمیلی (جیمیل) ---------- */
  if (pathname === "/api/auth/code/request" && method === "POST") {
    /* فاصله‌ی ۶۰ ثانیه‌ای بین دو درخواست کد برای یک جیمیل */
    {
      const em = String((body && body.email) || "").trim().toLowerCase();
      global.__kmCodeAt = global.__kmCodeAt || {};
      const prev = global.__kmCodeAt[em] || 0;
      if (em && Date.now() - prev < 60 * 1000) {
        return sendJson(res, 429, {
          ok: false,
          error: "برای ارسال دوباره‌ی کد " +
            Math.ceil((60 * 1000 - (Date.now() - prev)) / 1000) + " ثانیه صبر کن.",
          retryAfter: Math.ceil((60 * 1000 - (Date.now() - prev)) / 1000)
        });
      }
      if (em) global.__kmCodeAt[em] = Date.now();
    }
    const rl = limitCode(ip);
    if (!rl.ok) return sendJson(res, 429, { ok: false, error: "درخواست کد زیاد بود. کمی بعد دوباره تلاش کن." });

    const email = S.normEmail(body.email);
    if (!S.validEmail(email)) return sendJson(res, 400, { ok: false, error: "ایمیل معتبر نیست." });

    const code = S.numericCode(6);
    codes.set(email, {
      hash: S.sha256(code + "|" + CFG.secret),
      exp: Date.now() + CFG.codeTtlMin * 60000,
      tries: 0,
      name: S.sanitizeName(body.name)
    });

    const result = await mailer.sendCode(email, code, CFG.codeTtlMin);
    const out = { ok: true, sent: result.delivered, ttlMin: CFG.codeTtlMin };
    if (!result.delivered && CFG.exposeCodeWhenNoSmtp) {
      out.devCode = code;
      out.notice = "SMTP تنظیم نشده — کد در حالت توسعه نمایش داده می‌شود.";
    }
    return sendJson(res, 200, out);
  }

  /* ---------- تایید کد ایمیلی ---------- */
  if (pathname === "/api/auth/code/verify" && method === "POST") {
    const rl = limitAuth(ip);
    if (!rl.ok) return sendJson(res, 429, { ok: false, error: "درخواست زیاد. کمی صبر کن." });

    const email = S.normEmail(body.email);
    const entry = codes.get(email);
    if (!entry || entry.exp < Date.now()) {
      codes.delete(email);
      return sendJson(res, 400, { ok: false, error: "کد منقضی شده. دوباره درخواست کن." });
    }
    entry.tries++;
    if (entry.tries > CFG.codeMaxTries) {
      codes.delete(email);
      return sendJson(res, 429, { ok: false, error: "تعداد تلاش زیاد شد. کد جدید بگیر." });
    }
    const given = String(body.code || "").replace(/[^0-9]/g, "");
    if (!S.safeEqual(S.sha256(given + "|" + CFG.secret), entry.hash)) {
      return sendJson(res, 401, { ok: false, error: "کد اشتباه است." });
    }
    codes.delete(email);

    let user = store.getUser(email);
    let isNew = false;
    if (!user) {
      isNew = true;
      user = {
        id: S.randomId(),
        email: email,
        name: entry.name || email.split("@")[0],
        provider: "email-code",
        passHash: null,
        verified: true,
        unlimited: false,
        tokens: freshTokens(),
        usageCount: 0,
        usage: [],
        createdAt: Date.now()
      };
      console.log("[auth] حساب جدید با کد ایمیلی:", email);
    }
    user.verified = true;
    store.putUser(user);
    store.saveNow();
    return issue(res, user, { welcome: isNew });
  }

  /* ---------- ورود با گوگل ---------- */
  if (pathname === "/api/auth/google" && method === "POST") {
    const rl = limitAuth(ip);
    if (!rl.ok) return sendJson(res, 429, { ok: false, error: "درخواست زیاد. کمی صبر کن." });

    let info;
    try { info = await verifyGoogleIdToken(body.credential); }
    catch (e) {
      return sendJson(res, 401, { ok: false, error: "تایید حساب گوگل ناموفق بود. از ورود با کد ایمیلی استفاده کن." });
    }

    let user = store.getUser(info.email);
    let isNew = false;
    if (!user) {
      isNew = true;
      user = {
        id: S.randomId(),
        email: info.email,
        name: info.name || info.email.split("@")[0],
        provider: "google",
        passHash: null,
        verified: true,
        unlimited: false,
        tokens: freshTokens(),
        usageCount: 0,
        usage: [],
        createdAt: Date.now()
      };
      console.log("[auth] حساب جدید با گوگل:", info.email);
    }
    user.verified = true;
    store.putUser(user);
    store.saveNow();
    return issue(res, user, { welcome: isNew });
  }

  /* ---------- کد مخصوص دولپر (دسترسی نامحدود) ---------- */
  if (pathname === "/api/auth/dev" && method === "POST") {
    const rl = limitAuth(ip);
    if (!rl.ok) return sendJson(res, 429, { ok: false, error: "درخواست زیاد. کمی صبر کن." });

    const given = String(body.code || "").trim();
    if (!given || !S.safeEqual(given, CFG.devCode)) {
      console.warn("[auth] تلاش ناموفق کد دولپر از", ip);
      return sendJson(res, 401, { ok: false, error: "کد دولپر معتبر نیست." });
    }
    const email = S.validEmail(body.email) ? S.normEmail(body.email) : CFG.devEmail;
    const user = ensureDevUser(email, body.name);
    store.saveNow();
    console.log("[auth] ورود دولپر:", email);
    return issue(res, user, { developer: true });
  }

  /* ---------- از اینجا به بعد نیاز به سشن دارد ---------- */
  const me = authUser(req);
  if (!me) return sendJson(res, 401, { ok: false, error: "برای این کار باید وارد حساب شوی.", needAuth: true });

  /* ---------- پروفایل ---------- */
  if (pathname === "/api/me" && method === "GET") {
    const granted = applyDaily(me);
    return sendJson(res, 200, {
      ok: true, user: publicUser(me), costs: CFG.costs, toolNames: CFG.toolNames,
      tokenName: CFG.tokenName, dailyGranted: granted
    });
  }

  /* ---------- خروج ---------- */
  if (pathname === "/api/auth/logout" && method === "POST") {
    store.revoke(me._jti, me._exp);
    return sendJson(res, 200, { ok: true });
  }

  /* ---------- کسر توکن ---------- */
  if (pathname === "/api/spend" && method === "POST") {
    const rl = limitSpend(me.email);
    if (!rl.ok) return sendJson(res, 429, { ok: false, error: "سرعت استفاده خیلی بالاست. " + rl.retryAfter + " ثانیه صبر کن." });

    const tool = String(body.tool || "");
    if (TOOLS.indexOf(tool) < 0) return sendJson(res, 400, { ok: false, error: "ابزار نامعتبر." });

    const cost = CFG.costs[tool];

    applyDaily(me);

    /* سقف روزانه‌ی هر ابزار + فاصله‌ی بین دو تولید */
    const stamp = dayStamp();
    me.toolDay = me.toolDay || {};
    if (me.toolDay.day !== stamp) me.toolDay = { day: stamp };
    const used = me.toolDay[tool] || 0;
    const cap = CFG.dailyToolCap;

    const gapMs = (CFG.cooldownSec || 0) * 1000;
    const lastAt = (me.lastGen && me.lastGen[tool]) || 0;
    const waitMs = gapMs - (Date.now() - lastAt);
    if (!me.unlimited && waitMs > 0) {
      return sendJson(res, 429, {
        ok: false, cooldown: true, wait: Math.ceil(waitMs / 1000),
        error: "\u062a\u0627 \u062c\u0646\u0631\u06cc\u062a \u06a9\u0631\u062f\u0646 \u0628\u0639\u062f\u06cc \u0635\u0628\u0631 \u06a9\u0646\u06cc\u062f \u2014 " + Math.ceil(waitMs / 1000) + " \u062b\u0627\u0646\u06cc\u0647."
      });
    }

    if (!me.unlimited && cap > 0 && used >= cap) {
      return sendJson(res, 429, {
        ok: false, capped: true, used: used, cap: cap,
        error: "\u0633\u0642\u0641 \u0631\u0648\u0632\u0627\u0646\u0647\u200c\u06cc \u0627\u06cc\u0646 \u0627\u0628\u0632\u0627\u0631 " + cap + " \u062a\u0648\u0644\u06cc\u062f \u0627\u0633\u062a. \u0641\u0631\u062f\u0627 \u062f\u0648\u0628\u0627\u0631\u0647 \u062a\u0644\u0627\u0634 \u06a9\u0646."
      });
    }

    me.toolDay[tool] = used + 1;
    me.lastGen = me.lastGen || {};
    me.lastGen[tool] = Date.now();

    if (me.unlimited) {
      me.usageCount = (me.usageCount || 0) + 1;
      me.usage = (me.usage || []).slice(-99).concat([{ tool: tool, cost: 0, at: Date.now() }]);
      store.putUser(me);
      return sendJson(res, 200, {
        ok: true, unlimited: true, tool: tool, cost: 0, tokens: null,
        costs: CFG.costs, tokenName: CFG.tokenName, usage: (me.usage || []).slice(-25)
      });
    }

    const pool = poolOf(me);

    if (pool < cost) {
      return sendJson(res, 402, {
        ok: false, insufficient: true, tool: tool, cost: cost,
        tokens: pool, costs: CFG.costs, tokenName: CFG.tokenName,
        error: "دولپر توکن کافی نداری. این کار " + cost + " دولپر توکن لازم دارد و موجودی تو " + pool + " است."
      });
    }

    me.tokens = pool - cost;
    me.usageCount = (me.usageCount || 0) + 1;
    me.usage = (me.usage || []).slice(-99).concat([{ tool: tool, cost: cost, at: Date.now() }]);
    store.putUser(me);

    return sendJson(res, 200, {
      ok: true, unlimited: false, tool: tool, cost: cost,
      tokens: me.tokens, costs: CFG.costs, tokenName: CFG.tokenName,
      usage: (me.usage || []).slice(-25)
    });
  }

  /* ---------- خرید دولپر توکن: ساخت فاکتور ---------- */
  if (pathname === "/api/pay/create" && method === "POST") {
    const amount = parseInt(body.amount, 10) || 0;
    const min = CFG.pay.minTokens;
    const max = CFG.pay.maxTokens;

    if (amount < min) {
      return sendJson(res, 400, { ok: false, error: "حداقل خرید " + min + " دولپر توکن است." });
    }
    if (max > 0 && amount > max) {
      return sendJson(res, 400, { ok: false, error: "حداکثر خرید " + max + " دولپر توکن است." });
    }

    const orderId = "KM-" + Date.now().toString(36).toUpperCase() + "-" +
      crypto.randomBytes(3).toString("hex").toUpperCase();
    const priceToman = CFG.pay.priceToman;
    const total = amount * priceToman;

    const order = {
      id: orderId, email: me.email, amount: amount,
      priceToman: priceToman, total: total,
      provider: CFG.pay.provider, status: "pending", createdAt: Date.now()
    };
    me.orders = (me.orders || []).slice(-49).concat([order]);
    store.putUser(me);
    store.saveNow();

    /* اگر کلید درگاه ثبت نشده باشد، فاکتور دستی پیگیری می‌شود */
    if (!CFG.pay.apiKey) {
      const q = "?order=" + encodeURIComponent(orderId) + "&amount=" + amount + "&total=" + total;
      const link = (CFG.pay.payLink || "").trim();
      const sep = link.indexOf("?") > -1 ? "&" : "?";
      const fallbackUrl = link
        ? (link + sep + "amount=" + total + "&order=" + encodeURIComponent(orderId))
        : ("/pay.html" + q);
      return sendJson(res, 200, {
        ok: true, orderId: orderId, amount: amount, total: total,
        payUrl: fallbackUrl, direct: !!link,
        notice: "درگاه " + CFG.pay.provider +
          " هنوز فعال نشده است (کلید KM_VIPAD_API_KEY در فایل .env خالی است). " +
          "مبلغ " + total + " تومان را پرداخت کن و پیگیری کن."
      });
    }

    const origin = (req.headers.origin || ("http://" + (req.headers.host || "localhost")));
    const callback = CFG.pay.callbackUrl || (origin + "/?order=" + orderId);

    return fetch(CFG.pay.createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + CFG.pay.apiKey
      },
      body: JSON.stringify({
        api_key: CFG.pay.apiKey,
        amount: total,
        currency: "IRT",
        order_id: orderId,
        description: amount + " دولپر توکن OnscreenKM",
        callback_url: callback,
        payer: { email: me.email, name: me.name || "" },
        settlement: {
          card: CFG.pay.settlementCard,
          bank: CFG.pay.settlementBank,
          holder: CFG.pay.settlementName
        }
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        const payUrl = data.payment_url || data.url || data.link ||
          (data.data && (data.data.payment_url || data.data.url)) || null;
        const ref = data.authority || data.token || (data.data && data.data.token) || null;
        order.ref = ref;
        store.putUser(me);
        store.saveNow();
        if (!payUrl) {
          return sendJson(res, 200, {
            ok: true, orderId: orderId, amount: amount, total: total, payUrl: null,
            notice: "درگاه پاسخ قابل استفاده نداد. لطفاً پیگیری کن."
          });
        }
        return sendJson(res, 200, { ok: true, orderId: orderId, amount: amount, total: total, payUrl: payUrl });
      })
      .catch(function () {
        return sendJson(res, 200, {
          ok: true, orderId: orderId, amount: amount, total: total, payUrl: null,
          notice: "اتصال به درگاه برقرار نشد. می‌توانی با همین شماره‌ی فاکتور پیگیری کنی."
        });
      });
  }

  /* ---------- خرید دولپر توکن: تایید پرداخت ---------- */
  if (pathname === "/api/pay/verify" && method === "POST") {
    const orderId = String(body.orderId || "");
    const order = (me.orders || []).filter(function (o) { return o.id === orderId; })[0];
    if (!order) return sendJson(res, 404, { ok: false, error: "فاکتور پیدا نشد." });
    if (order.status === "paid") {
      return sendJson(res, 200, { ok: true, already: true, added: 0, tokens: poolOf(me) });
    }

    function credit() {
      order.status = "paid";
      order.paidAt = Date.now();
      me.tokens = poolOf(me) + order.amount;
      store.putUser(me);
      store.saveNow();
      console.log("[pay] " + me.email + " +" + order.amount + " دولپر توکن (" + order.id + ")");
      return sendJson(res, 200, { ok: true, added: order.amount, tokens: me.tokens, orderId: order.id });
    }

    if (!CFG.pay.apiKey) {
      order.status = "awaiting";
      store.putUser(me);
      return sendJson(res, 200, {
        ok: false,
        error: "درگاه فعال نیست؛ پرداخت باید دستی پیگیری شود."
      });
    }

    return fetch(CFG.pay.verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + CFG.pay.apiKey
      },
      body: JSON.stringify({
        api_key: CFG.pay.apiKey,
        order_id: orderId,
        token: body.token || order.ref || "",
        amount: order.total
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        const ok = data.status === "success" || data.status === 100 ||
          data.ok === true || (data.data && data.data.status === "paid");
        if (!ok) {
          order.status = "failed";
          store.putUser(me);
          return sendJson(res, 200, { ok: false, error: "پرداخت تایید نشد." });
        }
        return credit();
      })
      .catch(function () {
        return sendJson(res, 200, { ok: false, error: "ارتباط با درگاه برقرار نشد." });
      });
  }

  /* ---------- لیست فاکتورهای کاربر ---------- */
  if (pathname === "/api/pay/orders" && method === "GET") {
    return sendJson(res, 200, { ok: true, orders: (me.orders || []).slice(-20).reverse() });
  }

  /* ---------- پنل دولپر: لیست کاربران ---------- */
  if (pathname === "/api/admin/users" && method === "GET") {
    if (!me.unlimited) return sendJson(res, 403, { ok: false, error: "فقط دولپر." });
    return sendJson(res, 200, {
      ok: true,
      users: store.allUsers().map(publicUser),
      total: store.allUsers().length
    });
  }

  /* ---------- پنل دولپر: شارژ توکن کاربر ---------- */
  if (pathname === "/api/admin/grant" && method === "POST") {
    if (!me.unlimited) return sendJson(res, 403, { ok: false, error: "فقط دولپر." });
    const target = store.getUser(S.normEmail(body.email));
    if (!target) return sendJson(res, 404, { ok: false, error: "کاربر پیدا نشد." });
    const amount = Math.max(-100000, Math.min(100000, parseInt(body.amount, 10) || 0));
    target.tokens = Math.max(0, poolOf(target) + amount);
    if (typeof body.unlimited === "boolean") target.unlimited = body.unlimited;
    store.putUser(target);
    store.saveNow();
    return sendJson(res, 200, { ok: true, user: publicUser(target) });
  }

  return sendJson(res, 404, { ok: false, error: "مسیر API پیدا نشد." });
}

/* ============================================================
   سرویس فایل استاتیک (امن در برابر path traversal)
   ============================================================ */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm",
  ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8"
};

const BLOCKED = ["/server", "/backend", "/native", "/.git"];

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/") rel = "/index.html";

  for (let i = 0; i < BLOCKED.length; i++) {
    if (rel.toLowerCase().indexOf(BLOCKED[i]) === 0) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("403 - دسترسی ممنوع");
    }
  }

  const safe = path.normalize(rel).replace(/^(\.\.[\/\\])+/, "");
  const file = path.join(CFG.root, safe);

  if (file.indexOf(path.resolve(CFG.root)) !== 0 && file.indexOf(CFG.root) !== 0) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("403");
  }

  fs.stat(file, function (err, st) {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return res.end('<meta charset="utf-8"><body style="background:#05050b;color:#f2f4ff;font-family:Tahoma;text-align:center;padding:80px">' +
        '<h1 style="font-size:60px;margin:0">404</h1><p>این صفحه پیدا نشد.</p>' +
        '<a href="/" style="color:#34b8f5">بازگشت به OnscreenKM</a></body>');
    }
    const ext = path.extname(file).toLowerCase();
    const etag = '"' + st.size.toString(16) + "-" + st.mtimeMs.toString(16) + '"';
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304);
      return res.end();
    }
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": st.size,
      "ETag": etag,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600"
    });
    fs.createReadStream(file).pipe(res);
  });
}

/* ============================================================
   راه‌اندازی
   ============================================================ */

function handler(req, res) {
  securityHeaders(res);
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname || "/";

  if (pathname.indexOf("/api/") === 0) {
    handleApi(req, res, pathname).catch(function (e) {
      console.error("[api] خطا:", e);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: "خطای داخلی سرور." });
    });
    return;
  }
  serveStatic(req, res, pathname);
}

let server;
if (CFG.tls.key && CFG.tls.cert) {
  server = https.createServer({
    key: fs.readFileSync(CFG.tls.key),
    cert: fs.readFileSync(CFG.tls.cert)
  }, handler);
} else {
  server = http.createServer(handler);
}

server.listen(CFG.port, CFG.host, function () {
  const proto = (CFG.tls.key && CFG.tls.cert) ? "https" : "http";
  console.log("");
  console.log("  ONSCREENKM SECURITY SERVER");
  console.log("  --------------------------------------------");
  console.log("  آدرس       : " + proto + "://localhost:" + CFG.port);
  console.log("  دیتابیس     : " + CFG.dbFile);
  console.log("  درگاه پرداخت : " + CFG.pay.provider + " · " + CFG.pay.priceToman + " تومان برای هر توکن " + (CFG.pay.apiKey ? "(فعال)" : "(کلید ثبت نشده)"));
  console.log("  دولپر توکن : " + CFG.freeTokens + " هدیه‌ی ثبت‌نام + " + CFG.dailyTokens + " روزانه");
  console.log("  هزینه‌ها     : " + JSON.stringify(CFG.costs));
  console.log("  کد دولپر    : " + (process.env.KM_DEV_CODE ? "(از env)" : CFG.devCode));
  console.log("  SMTP        : " + (mailer.enabled ? "فعال" : "غیرفعال (کد در کنسول چاپ می‌شود)"));
  console.log("  Google      : " + (CFG.googleClientId ? "فعال" : "غیرفعال (KM_GOOGLE_CLIENT_ID را تنظیم کن)"));
  console.log("  --------------------------------------------");
  console.log("");
});

function shutdown() {
  console.log("\n[server] در حال ذخیره و خاموشی...");
  store.saveNow();
  server.close(function () { process.exit(0); });
  setTimeout(function () { process.exit(0); }, 2000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtException", function (e) {
  console.error("[fatal]", e);
  store.saveNow();
});
