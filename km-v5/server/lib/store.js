/* ============================================================
   KM STORE - ذخیره‌ساز امن کاربران روی فایل JSON
   نوشتن اتمیک (فایل موقت + rename) و کش در حافظه
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

function Store(file) {
  this.file = file;
  this.dir = path.dirname(file);
  this.data = { users: {}, revoked: {}, meta: { created: Date.now(), version: 1 } };
  this.dirty = false;
  this.load();
  const self = this;
  this.timer = setInterval(function () { self.flush(); }, 3000);
  if (this.timer.unref) this.timer.unref();
}

Store.prototype.load = function () {
  try {
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    if (fs.existsSync(this.file)) {
      const raw = fs.readFileSync(this.file, "utf8");
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.users) this.data = parsed;
      }
    }
  } catch (e) {
    console.error("[store] خطا در خواندن دیتابیس:", e.message);
    try {
      if (fs.existsSync(this.file)) fs.renameSync(this.file, this.file + ".corrupt." + Date.now());
    } catch (e2) {}
  }
};

Store.prototype.flush = function () {
  if (!this.dirty) return;
  try {
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
    this.dirty = false;
  } catch (e) {
    console.error("[store] خطا در ذخیره:", e.message);
  }
};

Store.prototype.save = function () { this.dirty = true; };
Store.prototype.saveNow = function () { this.dirty = true; this.flush(); };

Store.prototype.getUser = function (email) {
  return this.data.users[email] || null;
};

Store.prototype.allUsers = function () {
  const self = this;
  return Object.keys(this.data.users).map(function (k) { return self.data.users[k]; });
};

Store.prototype.putUser = function (user) {
  this.data.users[user.email] = user;
  this.save();
  return user;
};

Store.prototype.revoke = function (jti, exp) {
  this.data.revoked[jti] = exp || (Date.now() + 7 * 24 * 3600 * 1000);
  const now = Date.now();
  const r = this.data.revoked;
  Object.keys(r).forEach(function (k) { if (r[k] < now) delete r[k]; });
  this.save();
};

Store.prototype.isRevoked = function (jti) {
  return !!(jti && this.data.revoked[jti] && this.data.revoked[jti] > Date.now());
};

module.exports = Store;
