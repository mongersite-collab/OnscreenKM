/* ============================================================
   ONSCREENKM - AUTH GATE + TOKEN CLIENT
   ورود / ثبت‌نام / کد جیمیل / گوگل / کد دولپر
   و مدیریت توکن هر پنج هوش مصنوعی
   ============================================================ */
(function () {
  "use strict";

  var SKEY = "km_session_v1";
  var LKEY = "km_local_users_v1";

  var TOOLS = ["image", "video", "thumb", "editvid", "editimg", "audio"];
  var NAMES = {
    image: "ساخت عکس",
    video: "ساخت تصویر / ویدیو",
    thumb: "ساخت تامنیل",
    editvid: "ادیت ویدیو",
    editimg: "ادیت عکس",
    audio: "تولید صدا"
  };

  /* پیش‌فرض‌ها - اگر سرور روشن باشد از /api/config خوانده می‌شوند */
  var CFG = {
    freeTokens: 300,
    dailyTokens: 10,
    tokenName: "دولپر توکن",
    costs: { image: 10, video: 20, thumb: 20, editvid: 25, editimg: 10, audio: 20 },
    googleClientId: "",
    codeTtlMin: 10,
    smtpConfigured: false
  };

  /* کد دولپر برای حالت آفلاین (وقتی سرور روشن نیست).
     نسخه‌ی امن و اصلی این کد فقط روی سرور چک می‌شود. */
  var LOCAL_DEV_CODE = "KM-OWNER-2026-OMEGA-7X4Q";

  var state = {
    online: false,
    session: null,
    user: null,
    ready: false
  };

  /* ---------------- ابزارهای کمکی ---------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }

  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = { "Content-Type": "application/json" };
    if (state.session) headers["Authorization"] = "Bearer " + state.session;
    return fetch(path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        j._status = r.status;
        return j;
      });
    });
  }

  function saveSession(token, user) {
    state.session = token;
    state.user = user;
    try {
      localStorage.setItem(SKEY, JSON.stringify({ t: token, u: user, at: Date.now(), online: state.online }));
    } catch (e) {}
  }

  function clearSession() {
    state.session = null;
    state.user = null;
    try { localStorage.removeItem(SKEY); } catch (e) {}
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(SKEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function freshTokens() { return CFG.freeTokens; }

  function poolOf(u) {
    if (!u) return 0;
    if (typeof u.tokens === "number") return u.tokens;
    if (u.tokens && typeof u.tokens === "object") {
      var sum = 0;
      TOOLS.forEach(function (k) { sum += Number(u.tokens[k]) || 0; });
      u.tokens = sum;
      return sum;
    }
    u.tokens = CFG.freeTokens;
    return u.tokens;
  }

  function todayStamp() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  /* هدیه‌ی روزانه در حالت آفلاین */
  function offlineDaily(u) {
    if (!u || u.unlimited) return 0;
    var t = todayStamp();
    if (u.lastDaily === t) return 0;
    u.tokens = poolOf(u) + CFG.dailyTokens;
    u.lastDaily = t;
    putLocalUser(u);
    return CFG.dailyTokens;
  }

  function fmt(n) { return String(n); }

  /* ---------------- حالت آفلاین (بدون سرور) ---------------- */

  function localUsers() {
    try { return JSON.parse(localStorage.getItem(LKEY) || "{}"); } catch (e) { return {}; }
  }
  function putLocalUser(u) {
    var all = localUsers();
    all[u.email] = u;
    try { localStorage.setItem(LKEY, JSON.stringify(all)); } catch (e) {}
  }
  function localHash(pw, email) {
    /* هش ساده فقط برای حالت آفلاین دمو */
    var s = pw + "|" + email + "|km-offline";
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return "o" + h.toString(16);
  }

  /* ---------------- HUD توکن ---------------- */

  var hud, hudNum, hudPanel;

  function buildHud() {
    hud = el('<div id="kmHud"></div>');
    var pill = el('<div class="hud-pill" role="button" tabindex="0" title="دولپر توکن دون">' +
      '<span class="hud-orb"></span>' +
      '<span class="hud-num">0</span>' +
      '<span class="hud-label">DOLPER<br>TOKEN</span>' +
      '<span class="hud-caret">▼</span>' +
      '</div>');
    hudPanel = el('<div class="hud-panel"></div>');
    hud.appendChild(pill);
    hud.appendChild(hudPanel);
    document.body.appendChild(hud);
    hudNum = $(".hud-num", pill);

    function toggle() { hud.classList.toggle("open"); }
    pill.addEventListener("click", toggle);
    pill.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
    document.addEventListener("click", function (e) {
      if (hud.classList.contains("open") && !hud.contains(e.target)) hud.classList.remove("open");
    });
  }

  function renderHud(flash) {
    if (!hud) buildHud();
    var u = state.user;
    if (!u) { hud.classList.remove("show"); return; }
    hud.classList.add("show");

    var pool = u.unlimited ? null : poolOf(u);

    if (u.unlimited) {
      hudNum.innerHTML = '<span class="hud-inf">∞</span>';
    } else {
      hudNum.textContent = String(pool);
      hud.classList.toggle("low", pool < 25);
      if (flash) {
        hudNum.classList.remove("flash");
        void hudNum.offsetWidth;
        hudNum.classList.add("flash");
      }
    }

    var initial = (u.name || u.email || "K").trim().charAt(0).toUpperCase();
    var html = '<div class="hud-user">' +
      '<div class="hud-avatar">' + initial + '</div>' +
      '<div><div class="hud-name">' + escapeHtml(u.name || u.email) + '</div>' +
      '<div class="hud-role' + (u.unlimited ? " dev" : "") + '">' +
      (u.unlimited ? "DEVELOPER — دسترسی نامحدود" : "کاربر عادی") +
      '</div></div></div>';

    /* مخزن اصلی */
    html += '<div class="vault-box">' +
      '<div class="vault-cap">دولپر توکن دون</div>' +
      '<div class="vault-num">' + (u.unlimited ? "∞" : pool) + '</div>' +
      '<div class="vault-sub">DOLPER TOKEN VAULT</div>' +
      (u.unlimited ? "" : '<div class="vault-bar"><i style="width:' +
        Math.max(2, Math.min(100, (pool / CFG.freeTokens) * 100)) + '%"></i></div>') +
      '</div>';

    /* تعرفه‌ی هر ابزار */
    html += '<div class="hud-sec">هزینه‌ی هر بار استفاده</div>';
    TOOLS.forEach(function (k) {
      var cost = CFG.costs[k];
      var can = u.unlimited ? "∞" : Math.floor(pool / cost);
      html += '<div class="hud-row">' +
        '<span class="n">' + NAMES[k] + '</span>' +
        '<span class="v' + (!u.unlimited && pool < cost ? " low" : "") + '">' + cost +
        ' <small>توکن</small></span>' +
        '<span class="c">' + can + '×</span></div>';
    });

    html += '<div class="hud-gift">+' + CFG.dailyTokens +
      ' دولپر توکن هدیه‌ی روزانه — هر روز که سر بزنی</div>';

    /* تاریخچه‌ی مصرف */
    var usage = (u.usage || []).slice(-5).reverse();
    if (usage.length) {
      html += '<div class="hud-sec">آخرین مصرف‌ها</div>';
      usage.forEach(function (x) {
        var d = new Date(x.at);
        var hh = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
        html += '<div class="hud-log"><span>' + (NAMES[x.tool] || x.tool) + '</span>' +
          '<span class="t">' + hh + '</span>' +
          '<span class="m">−' + x.cost + '</span></div>';
      });
    }

    if (!state.online) {
      html += '<div class="hud-cost" style="margin-top:10px;text-align:center">حالت آفلاین — سرور امنیتی روشن نیست</div>';
    }

    hudPanel.innerHTML = html;

    var libBtn = el('<button class="hud-act lib">\u25c8 \u06a9\u062a\u0627\u0628\u062e\u0627\u0646\u0647\u200c\u06cc \u0645\u0646</button>');
    libBtn.addEventListener("click", function () {
      if (window.KMLab && window.KMLab.openLibrary) window.KMLab.openLibrary();
    });
    hudPanel.appendChild(libBtn);

    var buyBtn = el('<button class="hud-act buy">\u2726 \u062e\u0631\u06cc\u062f \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646</button>');
    buyBtn.addEventListener("click", function () {
      if (window.KMShop) window.KMShop.open();
    });
    hudPanel.appendChild(buyBtn);

    var out = el('<button class="hud-out">خروج از حساب</button>');
    out.addEventListener("click", logout);
    hudPanel.appendChild(out);

    document.dispatchEvent(new CustomEvent("km-tokens", {
      detail: { pool: pool, unlimited: !!u.unlimited, costs: CFG.costs }
    }));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var toastEl, toastTimer;
  function toast(msg, bad) {
    if (!toastEl) {
      toastEl = el('<div class="km-toast"></div>');
      document.body.appendChild(toastEl);
    }
    toastEl.className = "km-toast" + (bad ? " bad" : "");
    toastEl.innerHTML = msg;
    void toastEl.offsetWidth;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 3200);
  }

  /* ---------------- صفحه‌ی ورود ---------------- */

  var gate, msgBox, starTimer;

  function buildGate() {
    gate = el('<div id="kmAuth" role="dialog" aria-modal="true"></div>');
    var canvas = el('<canvas class="ka-stars"></canvas>');
    gate.appendChild(canvas);

    var card = el('<div class="ka-card"></div>');
    card.innerHTML =
      '<img class="ka-logo" src="assets/media/km-mark.png" alt="OnscreenKM">' +
      '<div class="ka-brand">ONSCREENKM</div>' +
      '<h2 class="ka-title">ورود به KM</h2>' +
      '<p class="ka-lead">برای استفاده از هوش مصنوعی و استودیو، وارد شو یا حساب بساز.<br>به هر حساب تازه، <b>' + CFG.freeTokens + ' دولپر توکن</b> هدیه داده می‌شود و هر روز <b>' + CFG.dailyTokens + ' توکن</b> دیگر.</p>' +

      '<div class="ka-tabs">' +
      '<button data-pane="login" class="on">ورود</button>' +
      '<button data-pane="signup">ساخت حساب</button>' +
      '<button data-pane="code">کد جیمیل</button>' +
      '</div>' +

      /* --- ورود --- */
      '<div class="ka-pane on" data-pane="login">' +
      '<div class="ka-field"><label>ایمیل</label><input type="email" id="kaLoginEmail" placeholder="you@gmail.com" autocomplete="email"></div>' +
      '<div class="ka-field"><label>رمز عبور</label><input type="password" id="kaLoginPass" placeholder="رمز عبور" autocomplete="current-password"></div>' +
      '<button class="ka-btn" id="kaLoginBtn">ورود به حساب</button>' +
      '<div class="ka-or">یا</div>' +
      '<button class="ka-google" id="kaGoogleBtn">' +
      '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16.9z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.3 0 20 0 24s1 7.7 2.6 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.1-5.5c-2 1.4-4.6 2.2-8.2 2.2-6.4 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>' +
      '<span>ورود با حساب گوگل</span></button>' +
      '</div>' +

      /* --- ثبت‌نام --- */
      '<div class="ka-pane" data-pane="signup">' +
      '<div class="ka-field"><label>نام نمایشی</label><input type="text" id="kaRegName" placeholder="اسمت"></div>' +
      '<div class="ka-field"><label>ایمیل</label><input type="email" id="kaRegEmail" placeholder="you@gmail.com" autocomplete="email"></div>' +
      '<div class="ka-field"><label>رمز عبور (حداقل ۸ کاراکتر و یک عدد)</label><input type="password" id="kaRegPass" placeholder="رمز عبور" autocomplete="new-password"></div>' +
      '<button class="ka-btn" id="kaRegBtn">ساخت حساب و گرفتن توکن رایگان</button>' +
      '<div class="ka-gift">هدیه‌ی خوش‌آمد: <b>' + CFG.freeTokens + ' دولپر توکن</b> + روزانه <b>' + CFG.dailyTokens + '</b> توکن</div>' +
      '</div>' +

      /* --- کد جیمیل --- */
      '<div class="ka-pane" data-pane="code">' +
      '<div class="ka-field"><label>آدرس جیمیل</label><input type="email" id="kaCodeEmail" placeholder="you@gmail.com" autocomplete="email"></div>' +
      '<button class="ka-btn" id="kaCodeSend">فرستادن کد ۶ رقمی</button>' +
      '<div id="kaCodeStep" style="display:none;margin-top:6px">' +
      '<div class="ka-otp-head">' +
      '<div class="oi">✉</div>' +
      '<h4>کد تایید را وارد کن</h4>' +
      '<p>یک کد ۶ رقمی به <b id="kaMask"></b> فرستادیم.<br>صندوق ورودی و پوشه‌ی اسپم را چک کن.</p>' +
      '</div>' +
      '<div class="otp-boxes" id="kaOtp">' +
      '<input inputmode="numeric" maxlength="1"><input inputmode="numeric" maxlength="1">' +
      '<input inputmode="numeric" maxlength="1"><input inputmode="numeric" maxlength="1">' +
      '<input inputmode="numeric" maxlength="1"><input inputmode="numeric" maxlength="1">' +
      '</div>' +
      '<input type="hidden" id="kaCodeInput">' +
      '<button class="ka-btn" id="kaCodeVerify">تایید و ورود</button>' +
      '<div class="ka-otp-foot">' +
      '<button id="kaCodeResend" disabled>ارسال دوباره‌ی کد</button>' +
      '<span id="kaCodeTimer"></span>' +
      '</div>' +
      '<div class="ka-otp-note">هر جیمیل فقط یک حساب می‌سازد · کد ۱۰ دقیقه اعتبار دارد · حداکثر ۵ درخواست در ۱۰ دقیقه</div>' +
      '</div></div>' +

      /* --- کد دولپر --- */
      '<div class="ka-pane" data-pane="dev">' +
      '<div class="ka-field"><label>کد ورود مخصوص دولپر</label><input type="password" id="kaDevCode" placeholder="KM-OWNER-..." autocomplete="off"></div>' +
      '<button class="ka-btn" id="kaDevBtn">باز کردن دسترسی نامحدود</button>' +
      '<div class="ka-gift">با این کد، تمام قابلیت‌های سایت بدون هیچ محدودیت توکن باز می‌شود. <b>∞</b></div>' +
      '<button class="ka-ghost" id="kaDevBack">بازگشت به ورود عادی</button>' +
      '</div>' +

      '<div class="ka-msg" id="kaMsg"></div>' +
      '<div class="ka-dev-link" id="kaDevLink">◈ ورود دولپر با کد مخصوص</div>' +
      '<div class="ka-foot">رمز عبور با <b>scrypt</b> هش می‌شود و سشن با <b>HMAC-SHA256</b> امضا می‌شود.<br>هیچ رمزی به صورت خام ذخیره نمی‌شود.</div>';

    var shell = el('<div class="ka-shell"></div>');
    var left = el('<div class="ka-left"></div>');
    var right = el('<aside class="ka-right">' +
      '<div class="ka-space"></div>' +
      '<div class="ka-right-cap">' +
      '<b>\u0645\u0642\u0635\u062f: \u0645\u0631\u06cc\u062e</b>' +
      '<span>\u0641\u0636\u0627\u067e\u06cc\u0645\u0627\u06cc KM \u0627\u0632 \u062f\u0648\u0631\u062f\u0633\u062a \u0645\u06cc\u200c\u0622\u06cc\u062f\u060c \u0646\u06cc\u0645\u200c\u062f\u0648\u0631 \u0633\u06cc\u0627\u0631\u0647 \u0645\u06cc\u200c\u0686\u0631\u062e\u062f \u0648 \u0628\u0647 \u062a\u0648 \u0644\u0628\u062e\u0646\u062f \u0645\u06cc\u200c\u0632\u0646\u062f</span>' +
      '</div></aside>');

    left.appendChild(card);
    shell.appendChild(left);
    shell.appendChild(right);
    gate.appendChild(shell);
    document.body.appendChild(gate);
    msgBox = $("#kaMsg", gate);

    if (window.KMSpace) {
      try { window.KMSpace.mount(right.querySelector(".ka-space")); } catch (e) { }
    }

    /* تب‌ها */
    var tabs = card.querySelectorAll(".ka-tabs button");
    Array.prototype.forEach.call(tabs, function (b) {
      b.addEventListener("click", function () { showPane(b.dataset.pane); });
    });

    $("#kaDevLink", card).addEventListener("click", function () { showPane("dev"); });
    $("#kaDevBack", card).addEventListener("click", function () { showPane("login"); });

    /* دکمه‌ها */
    $("#kaLoginBtn", card).addEventListener("click", doLogin);
    $("#kaRegBtn", card).addEventListener("click", doRegister);
    $("#kaCodeSend", card).addEventListener("click", doSendCode);
    $("#kaCodeResend", card).addEventListener("click", doSendCode);
    $("#kaCodeVerify", card).addEventListener("click", doVerifyCode);
    $("#kaDevBtn", card).addEventListener("click", doDevLogin);
    $("#kaGoogleBtn", card).addEventListener("click", doGoogle);

    card.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var pane = card.querySelector(".ka-pane.on");
      if (!pane) return;
      var btn = pane.querySelector(".ka-btn");
      if (pane.dataset.pane === "code" && $("#kaCodeStep").style.display !== "none") {
        btn = $("#kaCodeVerify");
      }
      if (btn) { e.preventDefault(); btn.click(); }
    });

    starfield(canvas);
  }

  function showPane(name) {
    var card = $(".ka-card", gate);
    Array.prototype.forEach.call(card.querySelectorAll(".ka-pane"), function (p) {
      p.classList.toggle("on", p.dataset.pane === name);
    });
    Array.prototype.forEach.call(card.querySelectorAll(".ka-tabs button"), function (b) {
      b.classList.toggle("on", b.dataset.pane === name);
    });
    hideMsg();
  }

  function msg(text, kind) {
    msgBox.className = "ka-msg show " + (kind || "info");
    msgBox.innerHTML = text;
  }
  function hideMsg() { if (msgBox) msgBox.className = "ka-msg"; }

  function busy(btn, on, label) {
    if (!btn) return;
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.disabled = true;
      btn.textContent = label || "لطفاً صبر کن...";
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.textContent = btn.dataset.label;
    }
  }

  /* آسمان پرستاره‌ی پشت صفحه‌ی ورود */
  function starfield(canvas) {
    var ctx = canvas.getContext("2d");
    var stars = [], W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = [];
      var n = Math.min(90, Math.round(W * H / 14000));
      for (var i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          r: Math.random() * 1.5 + .3,
          a: Math.random() * 6.28,
          s: Math.random() * .5 + .15
        });
      }
    }
    resize();
    window.addEventListener("resize", resize);

    var t = 0, lastStar = 0;
    function draw(now) {
      starTimer = requestAnimationFrame(draw);
      /* وقتی صفحه‌ی ورود بسته شد، رسم متوقف می‌شود */
      if (document.hidden || !gate || !gate.classList.contains("show")) return;
      if (now - lastStar < 40) return;   /* سقف ~۲۵ فریم */
      lastStar = now;
      t += .04;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        var tw = .35 + .65 * Math.abs(Math.sin(t * st.s * 3 + st.a));
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, 6.2832);
        ctx.fillStyle = "rgba(200,225,255," + (tw * .6) + ")";
        ctx.fill();
        st.y -= st.s * .3;
        if (st.y < -4) { st.y = H + 4; st.x = Math.random() * W; }
      }
    }
    if (reduce) { draw(0); cancelAnimationFrame(starTimer); } else requestAnimationFrame(draw);
  }

  /* ---------------- عملیات ورود ---------------- */

  function onAuthSuccess(res, welcome) {
    saveSession(res.session, res.user);
    if (res.costs) CFG.costs = res.costs;
    if (res.dailyGranted) {
      setTimeout(function () {
        toast("هدیه‌ی امروز: +" + res.dailyGranted + " دولپر توکن ✦");
      }, 3400);
    }
    unlock();
    renderHud();
    if (welcome) {
      toast(res.user.unlimited
        ? "خوش آمدی دولپر — دسترسی نامحدود فعال شد ∞"
        : "حسابت ساخته شد — " + CFG.freeTokens + " دولپر توکن هدیه گرفتی ◉");
    } else {
      toast("خوش برگشتی، " + escapeHtml(res.user.name || "") + " ◉");
    }
  }

  function doLogin() {
    var btn = $("#kaLoginBtn");
    var email = ($("#kaLoginEmail").value || "").trim().toLowerCase();
    var pass = $("#kaLoginPass").value || "";
    if (!email || !pass) return msg("ایمیل و رمز عبور را پر کن.", "err");
    busy(btn, true);

    if (!state.online) {
      var u = localUsers()[email];
      busy(btn, false);
      if (!u || u.passHash !== localHash(pass, email)) return msg("ایمیل یا رمز عبور درست نیست.", "err");
      return onAuthSuccess({ session: "offline-" + email, user: u }, false);
    }

    api("/api/auth/login", { method: "POST", body: { email: email, password: pass } })
      .then(function (r) {
        busy(btn, false);
        if (!r.ok) return msg(r.error || "ورود ناموفق بود.", "err");
        onAuthSuccess(r, false);
      })
      .catch(function () { busy(btn, false); msg("ارتباط با سرور برقرار نشد.", "err"); });
  }

  function doRegister() {
    var btn = $("#kaRegBtn");
    var name = ($("#kaRegName").value || "").trim();
    var email = ($("#kaRegEmail").value || "").trim().toLowerCase();
    var pass = $("#kaRegPass").value || "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg("ایمیل معتبر نیست.", "err");
    if (pass.length < 8 || !/[0-9]/.test(pass)) return msg("رمز عبور باید حداقل ۸ کاراکتر و شامل عدد باشد.", "err");
    busy(btn, true, "در حال ساخت حساب...");

    if (!state.online) {
      var all = localUsers();
      if (all[email]) { busy(btn, false); return msg("این ایمیل قبلاً ثبت شده.", "err"); }
      var u = {
        email: email, name: name || email.split("@")[0], provider: "offline",
        passHash: localHash(pass, email), unlimited: false,
        tokens: freshTokens(), createdAt: Date.now()
      };
      putLocalUser(u);
      busy(btn, false);
      return onAuthSuccess({ session: "offline-" + email, user: u }, true);
    }

    api("/api/auth/register", { method: "POST", body: { email: email, password: pass, name: name } })
      .then(function (r) {
        busy(btn, false);
        if (!r.ok) return msg(r.error || "ساخت حساب ناموفق بود.", "err");
        onAuthSuccess(r, true);
      })
      .catch(function () { busy(btn, false); msg("ارتباط با سرور برقرار نشد.", "err"); });
  }

  var pendingEmail = "";
  var offlineCode = "";
  var resendTimer = null;

  function maskEmail(e) {
    var a = String(e).split("@");
    if (a.length < 2) return e;
    var n = a[0];
    var head = n.slice(0, 2);
    return head + new Array(Math.max(3, n.length - 1)).join("•") + "@" + a[1];
  }

  function otpInputs() {
    return Array.prototype.slice.call(document.querySelectorAll("#kaOtp input"));
  }

  function otpValue() {
    return otpInputs().map(function (i) { return i.value || ""; }).join("");
  }

  function otpBind() {
    var boxes = otpInputs();
    if (!boxes.length || boxes[0].__bound) return;
    boxes.forEach(function (inp, i) {
      inp.__bound = true;
      inp.addEventListener("input", function () {
        inp.value = (inp.value || "").replace(/[^0-9]/g, "").slice(0, 1);
        inp.classList.toggle("filled", !!inp.value);
        if (inp.value && boxes[i + 1]) boxes[i + 1].focus();
        if (otpValue().length === 6) doVerifyCode();
      });
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Backspace" && !inp.value && boxes[i - 1]) boxes[i - 1].focus();
      });
      inp.addEventListener("paste", function (e) {
        var t = (e.clipboardData || window.clipboardData).getData("text").replace(/[^0-9]/g, "");
        if (!t) return;
        e.preventDefault();
        boxes.forEach(function (b, k) {
          b.value = t[k] || "";
          b.classList.toggle("filled", !!b.value);
        });
        if (t.length >= 6) doVerifyCode();
      });
    });
  }

  function otpClear() {
    otpInputs().forEach(function (i) { i.value = ""; i.classList.remove("filled"); });
    var f = otpInputs()[0];
    if (f) f.focus();
  }

  function startResendCountdown(sec) {
    var btn = document.getElementById("kaCodeResend");
    var lbl = document.getElementById("kaCodeTimer");
    if (!btn || !lbl) return;
    var left = sec || 60;
    clearInterval(resendTimer);
    btn.disabled = true;
    function tick() {
      lbl.textContent = "امکان ارسال دوباره تا " + left + " ثانیه";
      if (left-- <= 0) {
        clearInterval(resendTimer);
        btn.disabled = false;
        lbl.textContent = "";
      }
    }
    tick();
    resendTimer = setInterval(tick, 1000);
  }

  function showOtpStep(email) {
    var step = document.getElementById("kaCodeStep");
    if (step) step.style.display = "block";
    var em = document.getElementById("kaCodeEmail");
    if (em) em.parentNode.style.display = "none";
    var send = document.getElementById("kaCodeSend");
    if (send) send.style.display = "none";
    var mask = document.getElementById("kaMask");
    if (mask) mask.textContent = maskEmail(email);
    otpBind();
    otpClear();
    startResendCountdown(60);
  }

  function doSendCode() {
    var btn = $("#kaCodeSend");
    var email = ($("#kaCodeEmail").value || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg("آدرس جیمیل معتبر نیست.", "err");
    pendingEmail = email;
    busy(btn, true, "در حال ارسال...");

    if (!state.online) {
      offlineCode = String(Math.floor(100000 + Math.random() * 900000));
      busy(btn, false);
      showOtpStep(email);
      return msg("حالت آفلاین: سرور ایمیل در دسترس نیست. کد آزمایشی شما: <b>" + offlineCode + "</b>", "info");
    }

    api("/api/auth/code/request", { method: "POST", body: { email: email } })
      .then(function (r) {
        busy(btn, false);
        if (!r.ok) return msg(r.error || "ارسال کد ناموفق بود.", "err");
        showOtpStep(email);
        if (r.devCode) msg("SMTP تنظیم نشده — کد حالت توسعه: <b>" + r.devCode + "</b>", "info");
        else msg("کد ۶ رقمی به <b>" + escapeHtml(email) + "</b> فرستاده شد. تا " + (r.ttlMin || CFG.codeTtlMin) + " دقیقه معتبر است.", "ok");
      })
      .catch(function () { busy(btn, false); msg("ارتباط با سرور برقرار نشد.", "err"); });
  }

  function doVerifyCode() {
    var btn = $("#kaCodeVerify");
    var code = otpValue().replace(/[^0-9]/g, "");
    if (code.length !== 6) return msg("کد باید ۶ رقم باشد.", "err");
    busy(btn, true);

    if (!state.online) {
      busy(btn, false);
      if (code !== offlineCode) return msg("کد اشتباه است.", "err");
      var all = localUsers();
      var u = all[pendingEmail];
      var isNew = !u;
      if (!u) {
        u = {
          email: pendingEmail, name: pendingEmail.split("@")[0], provider: "email-code",
          passHash: null, unlimited: false, tokens: freshTokens(), createdAt: Date.now()
        };
        putLocalUser(u);
      }
      return onAuthSuccess({ session: "offline-" + pendingEmail, user: u }, isNew);
    }

    api("/api/auth/code/verify", { method: "POST", body: { email: pendingEmail, code: code } })
      .then(function (r) {
        busy(btn, false);
        if (!r.ok) return msg(r.error || "کد تایید نشد.", "err");
        onAuthSuccess(r, !!r.welcome);
      })
      .catch(function () { busy(btn, false); msg("ارتباط با سرور برقرار نشد.", "err"); });
  }

  function doDevLogin() {
    var btn = $("#kaDevBtn");
    var code = ($("#kaDevCode").value || "").trim();
    if (!code) return msg("کد دولپر را وارد کن.", "err");
    busy(btn, true, "در حال بررسی کد...");

    if (!state.online) {
      busy(btn, false);
      if (code !== LOCAL_DEV_CODE) return msg("کد دولپر معتبر نیست.", "err");
      var u = {
        email: "developer@onscreenkm", name: "Developer", provider: "dev-code",
        unlimited: true, tokens: null, createdAt: Date.now()
      };
      putLocalUser(u);
      return onAuthSuccess({ session: "offline-dev", user: u }, true);
    }

    api("/api/auth/dev", { method: "POST", body: { code: code } })
      .then(function (r) {
        busy(btn, false);
        if (!r.ok) return msg(r.error || "کد دولپر معتبر نیست.", "err");
        onAuthSuccess(r, true);
      })
      .catch(function () { busy(btn, false); msg("ارتباط با سرور برقرار نشد.", "err"); });
  }

  /* ---- ورود با گوگل (Google Identity Services) ---- */
  function doGoogle() {
    if (!state.online) {
      return msg("ورود با گوگل فقط وقتی سرور امنیتی روشن است کار می‌کند. فعلاً از <b>کد جیمیل</b> استفاده کن.", "info");
    }
    if (!CFG.googleClientId) {
      showPane("code");
      return msg("ورود مستقیم با گوگل هنوز تنظیم نشده (KM_GOOGLE_CLIENT_ID). فعلاً با <b>کد جیمیل</b> وارد شو — همان حساب گوگلت.", "info");
    }
    loadGoogleScript().then(function () {
      /* global google */
      google.accounts.id.initialize({
        client_id: CFG.googleClientId,
        callback: function (resp) {
          api("/api/auth/google", { method: "POST", body: { credential: resp.credential } })
            .then(function (r) {
              if (!r.ok) return msg(r.error || "ورود با گوگل ناموفق بود.", "err");
              onAuthSuccess(r, !!r.welcome);
            });
        }
      });
      google.accounts.id.prompt();
    }).catch(function () {
      msg("بارگذاری سرویس گوگل ناموفق بود. از کد جیمیل استفاده کن.", "err");
    });
  }

  function loadGoogleScript() {
    return new Promise(function (resolve, reject) {
      if (window.google && window.google.accounts) return resolve();
      var s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true; s.defer = true;
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* ---------------- قفل / باز کردن سایت ---------------- */

  var lockWaits = 0;

  function lock() {
    /* \u0635\u0641\u062d\u0647\u200c\u06cc \u0648\u0631\u0648\u062f \u0628\u0639\u062f \u0627\u0632 \u067e\u0627\u06cc\u0627\u0646 \u0644\u0648\u062f\u06cc\u0646\u06af \u0646\u0634\u0627\u0646 \u062f\u0627\u062f\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f */
    var ldr = document.getElementById("loader");
    if (ldr && !ldr.classList.contains("hidden") && lockWaits < 24) {
      lockWaits++;
      setTimeout(lock, 220);
      return;
    }
    if (!gate) buildGate();
    gate.classList.add("show");
    document.documentElement.classList.add("km-locked");
    document.body.classList.add("km-locked");
    if (hud) hud.classList.remove("show");
  }

  function unlock() {
    if (gate) gate.classList.remove("show");
    document.documentElement.classList.remove("km-locked");
    document.body.classList.remove("km-locked");
  }

  function logout() {
    if (state.online && state.session) {
      api("/api/auth/logout", { method: "POST" }).catch(function () {});
    }
    clearSession();
    if (hud) hud.classList.remove("show");
    lock();
    showPane("login");
    msg("از حساب خارج شدی.", "info");
  }

  /* ---------------- خرج کردن توکن ---------------- */

  function spend(tool) {
    return new Promise(function (resolve) {
      if (!state.user) { lock(); return resolve({ ok: false, reason: "auth" }); }

      var cost = CFG.costs[tool] != null ? CFG.costs[tool] : 10;

      if (state.user.unlimited) {
        toast(NAMES[tool] + " — دسترسی نامحدود ∞");
        return resolve({ ok: true, unlimited: true });
      }

      if (!state.online) {
        offlineDaily(state.user);
        var pool = poolOf(state.user);
        if (pool < cost) {
          toast("دولپر توکن کافی نداری — «" + NAMES[tool] + "» " + cost + " توکن لازم دارد و موجودی تو " + pool + " است.", true);
          return resolve({ ok: false, reason: "insufficient" });
        }
        state.user.tokens = pool - cost;
        state.user.usage = (state.user.usage || []).slice(-24).concat([{ tool: tool, cost: cost, at: Date.now() }]);
        putLocalUser(state.user);
        saveSession(state.session, state.user);
        renderHud(true);
        toast("−" + cost + " دولپر توکن — مانده: " + state.user.tokens);
        return resolve({ ok: true, cost: cost });
      }

      api("/api/spend", { method: "POST", body: { tool: tool } })
        .then(function (r) {
          if (r.needAuth) { clearSession(); lock(); return resolve({ ok: false, reason: "auth" }); }
          if (!r.ok) {
            toast(r.error || "کسر توکن ناموفق بود.", true);
            if (r.tokens != null) { state.user.tokens = r.tokens; renderHud(); }
            return resolve({ ok: false, reason: r.insufficient ? "insufficient" : "error" });
          }
          if (r.costs) CFG.costs = r.costs;
          state.user.tokens = r.tokens;
          state.user.unlimited = !!r.unlimited;
          if (r.usage) state.user.usage = r.usage;
          saveSession(state.session, state.user);
          renderHud(true);
          toast(r.unlimited
            ? NAMES[tool] + " — دسترسی نامحدود ∞"
            : "−" + r.cost + " دولپر توکن برای «" + NAMES[tool] + "» — مانده: " + r.tokens);
          resolve({ ok: true, cost: r.cost });
        })
        .catch(function () {
          toast("ارتباط با سرور قطع شد.", true);
          resolve({ ok: false, reason: "network" });
        });
    });
  }

  /* ---------------- راه‌اندازی ---------------- */

  function boot() {
    fetch("/api/config", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (c) {
        state.online = true;
        if (c.freeTokens) CFG.freeTokens = c.freeTokens;
        if (c.dailyTokens != null) CFG.dailyTokens = c.dailyTokens;
        if (c.tokenName) CFG.tokenName = c.tokenName;
        if (c.costs) CFG.costs = c.costs;
        if (c.toolNames) Object.keys(c.toolNames).forEach(function (k) { NAMES[k] = c.toolNames[k]; });
        CFG.googleClientId = c.googleClientId || "";
        CFG.codeTtlMin = c.codeTtlMin || 10;
        CFG.smtpConfigured = !!c.smtpConfigured;
      })
      .catch(function () { state.online = false; })
      .then(function () { start(); });
  }

  function start() {
    buildGate();
    buildHud();

    var saved = loadSession();
    if (!saved || !saved.t) { lock(); state.ready = true; return; }

    state.session = saved.t;
    state.user = saved.u;

    if (!state.online) {
      /* حالت آفلاین: از حافظه‌ی محلی ادامه می‌دهیم */
      var local = localUsers()[state.user && state.user.email];
      if (local) state.user = local;
      var g = offlineDaily(state.user);
      if (g) setTimeout(function () { toast("هدیه‌ی امروز: +" + g + " دولپر توکن ✦"); }, 1200);
      unlock(); renderHud(); state.ready = true;
      return;
    }

    api("/api/me")
      .then(function (r) {
        if (!r.ok) { clearSession(); lock(); return; }
        state.user = r.user;
        if (r.costs) CFG.costs = r.costs;
        saveSession(state.session, state.user);
        unlock();
        renderHud();
      })
      .catch(function () { unlock(); renderHud(); })
      .then(function () { state.ready = true; });
  }

  /* API عمومی برای km-studio.js */
  window.KMAuth = {
    spend: spend,
    user: function () { return state.user; },
    isLoggedIn: function () { return !!state.user; },
    require: function () { if (!state.user) { lock(); return false; } return true; },
    costs: function () { return CFG.costs; },
    cost: function (tool) { return CFG.costs[tool]; },
    pool: function () { return state.user ? (state.user.unlimited ? Infinity : poolOf(state.user)) : 0; },
    toolNames: function () { return NAMES; },
    config: function () { return CFG; },
    setTokens: function (v) {
      if (!state.user) return;
      state.user.tokens = v;
      if (!state.online) putLocalUser(state.user);
      saveSession(state.session, state.user);
      renderHud(true);
    },
    addTokens: function (n) {
      if (!state.user) return 0;
      state.user.tokens = poolOf(state.user) + (parseInt(n, 10) || 0);
      if (!state.online) putLocalUser(state.user);
      saveSession(state.session, state.user);
      renderHud(true);
      return state.user.tokens;
    },
    session: function () { return state.session; },
    online: function () { return state.online; },
    toast: function (t, err) { toast(t, err); },
    refresh: function () { renderHud(); },
    logout: logout,
    lock: lock
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
