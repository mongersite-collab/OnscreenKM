/* ============================================================
   KM MAILER - ارسال کد ورود به جیمیل کاربر
   کلاینت SMTP سبک بدون وابستگی (TLS ۴۶۵ یا STARTTLS ۵۸۷)
   اگر SMTP تنظیم نشده باشد، کد در کنسول سرور چاپ می‌شود
   ============================================================ */
"use strict";
const net = require("net");
const tls = require("tls");

function encodeHeader(str) {
  // MIME encoded-word برای متن فارسی در هدرها
  return "=?UTF-8?B?" + Buffer.from(String(str), "utf8").toString("base64") + "?=";
}

function buildMessage(opts) {
  const boundary = "km_" + Date.now().toString(36);
  const lines = [
    "From: " + encodeHeader(opts.fromName || "OnscreenKM") + " <" + opts.from + ">",
    "To: <" + opts.to + ">",
    "Subject: " + encodeHeader(opts.subject),
    "MIME-Version: 1.0",
    "Date: " + new Date().toUTCString(),
    "Content-Type: multipart/alternative; boundary=\"" + boundary + "\"",
    "",
    "--" + boundary,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(opts.text, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
    "",
    "--" + boundary,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(opts.html, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
    "",
    "--" + boundary + "--",
    ""
  ];
  return lines.join("\r\n");
}

function smtpSend(cfg, message, envelope) {
  return new Promise(function (resolve, reject) {
    const secure = cfg.port === 465;
    let socket = secure
      ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host })
      : net.connect({ host: cfg.host, port: cfg.port });

    let buffer = "";
    let step = 0;
    let upgraded = secure;
    let done = false;

    const script = [];

    function finish(err) {
      if (done) return;
      done = true;
      try { socket.end(); } catch (e) {}
      if (err) reject(err); else resolve(true);
    }

    const timer = setTimeout(function () {
      finish(new Error("SMTP timeout"));
    }, cfg.timeoutMs || 15000);

    function write(line) {
      socket.write(line + "\r\n");
    }

    function buildScript() {
      script.length = 0;
      script.push({ expect: 220, send: "EHLO onscreenkm" });
      if (!secure && cfg.starttls !== false) {
        script.push({ expect: 250, send: "STARTTLS" });
        script.push({ expect: 220, upgrade: true });
        script.push({ expect: 250, send: "EHLO onscreenkm" });
      }
      script.push({ expect: 250, send: "AUTH LOGIN" });
      script.push({ expect: 334, send: Buffer.from(cfg.user, "utf8").toString("base64") });
      script.push({ expect: 334, send: Buffer.from(cfg.pass, "utf8").toString("base64") });
      script.push({ expect: 235, send: "MAIL FROM:<" + envelope.from + ">" });
      script.push({ expect: 250, send: "RCPT TO:<" + envelope.to + ">" });
      script.push({ expect: 250, send: "DATA" });
      script.push({ expect: 354, sendData: true });
      script.push({ expect: 250, send: "QUIT" });
      script.push({ expect: 221, end: true });
    }
    buildScript();

    function attach(s) {
      s.setEncoding("utf8");
      s.on("data", onData);
      s.on("error", function (e) { clearTimeout(timer); finish(e); });
      s.on("close", function () {
        clearTimeout(timer);
        if (!done) finish(new Error("SMTP ارتباط زودتر از موعد بسته شد"));
      });
    }

    function onData(chunk) {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf("\r\n")) > -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (/^\d{3}-/.test(line)) continue; // ادامه‌ی چندخطی
        const code = parseInt(line.slice(0, 3), 10);
        const stage = script[step];
        if (!stage) return;
        if (code !== stage.expect) {
          clearTimeout(timer);
          return finish(new Error("SMTP پاسخ غیرمنتظره: " + line));
        }
        step++;
        const next = script[step - 1];
        if (next.upgrade && !upgraded) {
          socket.removeAllListeners("data");
          const plain = socket;
          socket = tls.connect({ socket: plain, servername: cfg.host }, function () {
            upgraded = true;
            attach(socket);
            write(script[step].send);
            step++;
          });
          socket.on("error", function (e) { clearTimeout(timer); finish(e); });
          return;
        }
        if (next.end) { clearTimeout(timer); return finish(null); }
        if (next.sendData) {
          socket.write(message.replace(/\r\n\.\r\n/g, "\r\n..\r\n"));
          socket.write("\r\n.\r\n");
          continue;
        }
        if (next.send != null) write(next.send);
      }
    }

    attach(socket);
  });
}

function Mailer(cfg) {
  this.cfg = cfg || {};
  this.enabled = !!(this.cfg.host && this.cfg.user && this.cfg.pass);
}

Mailer.prototype.sendCode = function (to, code, minutes) {
  const brand = "OnscreenKM";
  const text = brand + "\n\nکد ورود شما: " + code +
    "\nاین کد تا " + minutes + " دقیقه معتبر است." +
    "\nاگر شما درخواست ورود نداده‌اید، این پیام را نادیده بگیرید.";

  const html = '<div style="background:#05050b;padding:34px;font-family:Tahoma,Arial,sans-serif;direction:rtl">' +
    '<div style="max-width:460px;margin:auto;background:linear-gradient(160deg,#0e0f24,#14163a);' +
    'border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:30px;color:#f2f4ff;text-align:center">' +
    '<div style="font-size:13px;letter-spacing:4px;color:#8c90b3">ONSCREENKM</div>' +
    '<h2 style="margin:14px 0 6px;font-size:22px">کد ورود شما</h2>' +
    '<p style="color:#8c90b3;font-size:13px;margin:0 0 18px">این کد را در صفحه‌ی ورود وارد کن</p>' +
    '<div style="font-size:38px;font-weight:900;letter-spacing:10px;color:#fff;' +
    'background:linear-gradient(90deg,#34b8f5,#a855f7);-webkit-background-clip:text;' +
    'padding:14px 0">' + code + '</div>' +
    '<p style="color:#8c90b3;font-size:12px;margin-top:18px">اعتبار: ' + minutes + ' دقیقه</p>' +
    '<p style="color:#5c6080;font-size:11px;margin-top:14px">اگر خودت درخواست نداده‌ای، نادیده بگیر.</p>' +
    '</div></div>';

  if (!this.enabled) {
    console.log("\n[mailer] SMTP تنظیم نشده — کد ورود برای " + to + " : " + code + "\n");
    return Promise.resolve({ delivered: false, reason: "smtp-not-configured" });
  }

  const from = this.cfg.from || this.cfg.user;
  const message = buildMessage({
    from: from, fromName: brand, to: to,
    subject: "کد ورود شما به OnscreenKM: " + code,
    text: text, html: html
  });

  return smtpSend(this.cfg, message, { from: from, to: to })
    .then(function () { return { delivered: true }; })
    .catch(function (e) {
      console.error("[mailer] ارسال ناموفق:", e.message);
      console.log("[mailer] کد ورود برای " + to + " : " + code);
      return { delivered: false, reason: e.message };
    });
};

module.exports = Mailer;
