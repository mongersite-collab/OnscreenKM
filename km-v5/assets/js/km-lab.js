/* ============================================================
   KM LAB — موتور هوش مصنوعی پرامپت‌محور + گالری نتایج
   - سه زون: کارگاه طراحی / خروجی / گالری نتایج
   - هوش مصنوعی محلی (بدون اینترنت) برای تصویر/تامنیل/ادیت ویدیو/ادیت عکس
   ============================================================ */
(function () {
  "use strict";

  var GKEY = "km_gallery_v1";
  var QKEY = "km_quota_v1";
  var DAY_CAP = 15;          // \u0633\u0642\u0641 \u0631\u0648\u0632\u0627\u0646\u0647\u200c\u06cc \u0647\u0631 \u0627\u0628\u0632\u0627\u0631
  var GAP_MS = 12000;        // \u0641\u0627\u0635\u0644\u0647\u200c\u06cc \u0644\u0627\u0632\u0645 \u0628\u06cc\u0646 \u062f\u0648 \u062a\u0648\u0644\u06cc\u062f
  var MAX_ITEMS = 24;

  var NAMES = {
    image: "\u0637\u0631\u0627\u062d\u06cc \u0639\u06a9\u0633",
    video: "\u0633\u0627\u062e\u062a \u062a\u0635\u0648\u06cc\u0631 / \u0648\u06cc\u062f\u06cc\u0648",
    thumb: "\u0633\u0627\u062e\u062a \u062a\u0627\u0645\u0646\u06cc\u0644",
    editvid: "\u0627\u062f\u06cc\u062a \u0648\u06cc\u062f\u06cc\u0648",
    editimg: "\u0627\u062f\u06cc\u062a \u0639\u06a9\u0633",
    audio: "\u062a\u0648\u0644\u06cc\u062f \u0635\u062f\u0627"
  };

  /* ---------------- \u0627\u0628\u0632\u0627\u0631\u0647\u0627\u06cc \u067e\u0627\u06cc\u0647 ---------------- */

  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  /* ---------- \u0633\u0647\u0645\u06cc\u0647\u200c\u06cc \u0631\u0648\u0632\u0627\u0646\u0647 \u0648 \u0642\u0641\u0644 \u062a\u0648\u0644\u06cc\u062f ---------- */

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function quota() {
    var q = {};
    try { q = JSON.parse(localStorage.getItem(QKEY) || "{}"); } catch (e) { q = {}; }
    if (q.day !== today()) q = { day: today() };
    return q;
  }

  function usedToday(tool) {
    var q = quota();
    return q[tool] || 0;
  }

  function bumpQuota(tool) {
    var q = quota();
    q[tool] = (q[tool] || 0) + 1;
    try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch (e) { }
    return q[tool];
  }

  function unlimited() {
    var u = (window.KMAuth && window.KMAuth.user) ? window.KMAuth.user() : null;
    return !!(u && u.unlimited);
  }

  window.KMGen = window.KMGen || { busy: false, last: {} };

  function gateCheck(tool) {
    if (unlimited()) return null;
    if (window.KMGen.busy) {
      return "\u06cc\u06a9 \u062a\u0648\u0644\u06cc\u062f \u062f\u0631 \u062c\u0631\u06cc\u0627\u0646 \u0627\u0633\u062a \u2014 \u062a\u0627 \u062c\u0646\u0631\u06cc\u062a \u06a9\u0631\u062f\u0646 \u0628\u0639\u062f\u06cc \u0635\u0628\u0631 \u06a9\u0646\u06cc\u062f \u25c9";
    }
    var last = window.KMGen.last[tool] || 0;
    var wait = Math.ceil((GAP_MS - (Date.now() - last)) / 1000);
    if (wait > 0) {
      return "\u062a\u0627 \u062c\u0646\u0631\u06cc\u062a \u06a9\u0631\u062f\u0646 \u0628\u0639\u062f\u06cc \u0635\u0628\u0631 \u06a9\u0646\u06cc\u062f \u2014 " + wait +
        " \u062b\u0627\u0646\u06cc\u0647\u06cc \u062f\u06cc\u06af\u0631 \u0622\u0645\u0627\u062f\u0647 \u0627\u0633\u062a \u23f3";
    }
    var u = usedToday(tool);
    if (u >= DAY_CAP) {
      return "\u0633\u0642\u0641 \u0631\u0648\u0632\u0627\u0646\u0647\u200c\u06cc \u0627\u06cc\u0646 \u0627\u0628\u0632\u0627\u0631 " + DAY_CAP +
        " \u062a\u0648\u0644\u06cc\u062f \u0627\u0633\u062a \u2014 \u0641\u0631\u062f\u0627 \u062f\u0648\u0628\u0627\u0631\u0647 \u062a\u0644\u0627\u0634 \u06a9\u0646 \u26d4";
    }
    return null;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function hash32(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ============================================================
     KM VISION — خوانش پرامپت و ساخت نقشه‌ی خلاقه
     ============================================================ */

  var PALETTES = [
    { key: "cosmos", fa: "\u06a9\u06cc\u0647\u0627\u0646\u06cc", words: ["\u0641\u0636", "\u06a9\u0647\u06a9\u0634", "\u0622\u0628\u06cc", "\u0628\u0646\u0641\u0634", "\u0634\u0628", "\u0633\u062a\u0627\u0631", "space", "galaxy", "blue", "violet", "purple", "night", "cosmic", "neon"] },
    { key: "sunset", fa: "\u063a\u0631\u0648\u0628", words: ["\u063a\u0631\u0648\u0628", "\u0646\u0627\u0631\u0646\u062c", "\u0642\u0631\u0645\u0632", "\u06af\u0631\u0645", "\u0637\u0644\u0627", "\u0622\u062a\u0634", "sunset", "orange", "red", "warm", "gold", "fire"] },
    { key: "emerald", fa: "\u0632\u0645\u0631\u062f", words: ["\u0633\u0628\u0632", "\u062c\u0646\u06af\u0644", "\u0637\u0628\u06cc\u0639", "\u0632\u0645\u0631\u062f", "green", "forest", "nature", "emerald", "matrix"] },
    { key: "ice", fa: "\u06cc\u062e", words: ["\u06cc\u062e", "\u0633\u0641\u06cc\u062f", "\u0633\u0631\u062f", "\u0645\u06cc\u0646\u06cc\u0645\u0627\u0644", "\u0641\u0644\u0632", "\u0628\u0631\u0641", "ice", "white", "cold", "minimal", "silver", "snow", "clean"] }
  ];

  var MOODS = [
    { key: "cinematic", fa: "\u0633\u06cc\u0646\u0645\u0627\u06cc\u06cc", words: ["\u0633\u06cc\u0646\u0645\u0627", "\u062f\u0631\u0627\u0645", "\u062d\u0645\u0627\u0633", "cinematic", "epic", "drama", "movie"] },
    { key: "tech", fa: "\u062a\u06a9\u0646\u0648\u0644\u0648\u0698\u06cc\u06a9", words: ["\u062a\u06a9\u0646\u0648\u0644\u0648\u0698", "\u0647\u0648\u0634", "\u0631\u0628\u0627\u062a", "\u062f\u06cc\u062c\u06cc\u062a\u0627\u0644", "\u0634\u0628\u06a9", "ai", "tech", "cyber", "future", "data", "neural"] },
    { key: "calm", fa: "\u0622\u0631\u0627\u0645", words: ["\u0622\u0631\u0627\u0645", "\u0644\u0637\u06cc\u0641", "\u0633\u0627\u062f", "\u0645\u0644\u0627\u06cc\u0645", "calm", "soft", "clean", "simple"] },
    { key: "bold", fa: "\u067e\u0631\u0642\u062f\u0631\u062a", words: ["\u0642\u062f\u0631\u062a", "\u0627\u0646\u0641\u062c\u0627\u0631", "\u062a\u0646\u062f", "\u062c\u0633\u0648\u0631", "\u0647\u06cc\u062c\u0627\u0646", "bold", "power", "explosive", "loud", "hype"] }
  ];

  var STOP = ["\u06cc\u06a9", "\u0627\u06cc\u0646", "\u0622\u0646", "\u0631\u0627", "\u0628\u0627", "\u0627\u0632", "\u0628\u0631\u0627\u06cc", "\u06a9\u0647", "\u062f\u0631", "\u0648", "\u06cc\u0627", "\u0628\u0647", "the", "a", "of", "and", "with", "for", "in", "on"];

  function pick(list, text, seed) {
    var best = null, bestScore = 0;
    list.forEach(function (item) {
      var score = 0;
      item.words.forEach(function (w) { if (text.indexOf(w) > -1) score += w.length > 3 ? 2 : 1; });
      if (score > bestScore) { bestScore = score; best = item; }
    });
    if (best) return { item: best, matched: true };
    return { item: list[Math.floor(rng(seed)() * list.length)], matched: false };
  }

  function keywords(text) {
    return text.split(/[\s\u060C,\.\-\/\n\r\u061B;:!\?\(\)\[\]"']+/)
      .filter(function (w) { return w.length > 2 && STOP.indexOf(w) < 0; })
      .slice(0, 6);
  }

  function readPrompt(prompt, tool) {
    var text = String(prompt || "").toLowerCase();
    var seed = hash32(text + "|" + tool);
    var r = rng(seed);
    var pal = pick(PALETTES, text, seed);
    var mood = pick(MOODS, text, seed ^ 0x9e3779b9);
    var kw = keywords(String(prompt || ""));

    return {
      seed: seed,
      rand: r,
      palette: pal.item,
      paletteMatched: pal.matched,
      mood: mood.item,
      moodMatched: mood.matched,
      keywords: kw,
      headline: kw.slice(0, 3).join(" ") || "OnscreenKM",
      sub: kw.slice(3, 6).join(" ") || "UNDERSTAND. ASSIST. EVOLVE.",
      intensity: Math.round(35 + r() * 55),
      density: Math.round(30 + r() * 60),
      glow: Math.round(40 + r() * 55)
    };
  }

  /* ============================================================
     گالری نتایج (مخزن کارها)
     ============================================================ */

  function loadGallery() {
    try { return JSON.parse(localStorage.getItem(GKEY) || "[]"); }
    catch (e) { return []; }
  }

  function saveGallery(list) {
    try { localStorage.setItem(GKEY, JSON.stringify(list.slice(-MAX_ITEMS))); }
    catch (e) {
      try { localStorage.setItem(GKEY, JSON.stringify(list.slice(-6))); } catch (e2) { }
    }
  }

  function addItem(item) {
    var list = loadGallery();
    list.push(item);
    saveGallery(list);
    renderGallery(item.tool);
    return item;
  }

  function removeItem(id) {
    var list = loadGallery().filter(function (x) { return x.id !== id; });
    saveGallery(list);
    renderGallery(currentTool);
  }

  /* \u06af\u0631\u0641\u062a\u0646 \u062a\u0635\u0648\u06cc\u0631 \u0627\u0632 \u0635\u062d\u0646\u0647\u200c\u06cc \u062e\u0631\u0648\u062c\u06cc */
  function snapStage(tool) {
    var body = document.querySelector(".studio-modal.open .studio-body");
    if (!body) return null;
    var cv = body.querySelector("canvas");
    var out = document.createElement("canvas");
    var ctx = out.getContext("2d");
    var W = 420, srcW, srcH, draw;

    if (cv && cv.width > 2) {
      srcW = cv.width; srcH = cv.height;
      draw = function () { ctx.drawImage(cv, 0, 0, out.width, out.height); };
    } else {
      var vid = body.querySelector("video");
      if (vid && vid.videoWidth) {
        srcW = vid.videoWidth; srcH = vid.videoHeight;
        draw = function () { ctx.drawImage(vid, 0, 0, out.width, out.height); };
      } else {
        var img = body.querySelector(".stage img");
        if (!img || !img.naturalWidth) return null;
        srcW = img.naturalWidth; srcH = img.naturalHeight;
        draw = function () { ctx.drawImage(img, 0, 0, out.width, out.height); };
      }
    }

    out.width = W;
    out.height = Math.max(1, Math.round(W * srcH / srcW));
    ctx.fillStyle = "#05050b";
    ctx.fillRect(0, 0, out.width, out.height);
    try { draw(); } catch (e) { return null; }
    try { return out.toDataURL("image/jpeg", 0.72); } catch (e) { return null; }
  }

  function capture(tool, label, cost) {
    var thumb = snapStage(tool);
    if (!thumb) return null;
    return addItem({
      id: "g" + Date.now() + Math.floor(Math.random() * 999),
      tool: tool,
      title: label || NAMES[tool] || tool,
      thumb: thumb,
      cost: cost == null ? null : cost,
      at: Date.now()
    });
  }

  /* ============================================================
     تزریق سه‌زونی داخل پنجره‌ی استودیو
     ============================================================ */

  var currentTool = "image";

  function zoneTag(icon, title, sub) {
    return el('<div class="zone-tag"><span class="zi">' + icon + '</span>' +
      '<span class="zt">' + title + '</span>' +
      '<span class="zs">' + sub + '</span></div>');
  }

  function fmtTime(ts) {
    var d = new Date(ts);
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) +
      " \u00b7 " + d.getDate() + "/" + (d.getMonth() + 1);
  }

  function renderGallery(tool) {
    var wrap = document.querySelector(".studio-modal.open .km-gallery");
    if (!wrap) return;
    var all = loadGallery().slice().reverse();
    var mine = all.filter(function (x) { return x.tool === tool; });
    var list = wrap.__all ? all : mine;

    var head = wrap.querySelector(".gal-head");
    head.querySelector(".gal-count").textContent = list.length + " \u0645\u0648\u0631\u062f";

    var grid = wrap.querySelector(".gal-grid");
    grid.innerHTML = "";

    if (!list.length) {
      grid.appendChild(el('<div class="gal-empty">\u0647\u0646\u0648\u0632 \u0646\u062a\u06cc\u062c\u0647\u200c\u0627\u06cc \u0646\u06cc\u0633\u062a \u2014 \u06cc\u06a9 \u0637\u0631\u0627\u062d\u06cc \u0628\u0633\u0627\u0632 \u0648 \u062e\u0631\u0648\u062c\u06cc \u0628\u06af\u06cc\u0631\u061b \u0646\u062a\u06cc\u062c\u0647 \u062e\u0648\u062f\u06a9\u0627\u0631 \u0627\u06cc\u0646\u062c\u0627 \u0630\u062e\u06cc\u0631\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f \u25c9</div>'));
      return;
    }

    list.forEach(function (item) {
      var card = el('<figure class="gal-item">' +
        '<img src="' + item.thumb + '" alt="' + esc(item.title) + '">' +
        '<figcaption>' +
        '<b>' + esc(NAMES[item.tool] || item.tool) + '</b>' +
        '<span>' + fmtTime(item.at) + (item.cost ? " \u00b7 \u2212" + item.cost + " \u062a\u0648\u06a9\u0646" : "") + '</span>' +
        '</figcaption>' +
        '<div class="gal-acts">' +
        '<button class="ga-btn" data-a="open">\u0646\u0645\u0627\u06cc\u0634</button>' +
        '<button class="ga-btn" data-a="dl">\u062f\u0627\u0646\u0644\u0648\u062f</button>' +
        '<button class="ga-btn del" data-a="del">\u062d\u0630\u0641</button>' +
        '</div></figure>');

      card.addEventListener("click", function (e) {
        var b = e.target.closest("[data-a]");
        if (!b) return;
        var a = b.getAttribute("data-a");
        if (a === "del") return removeItem(item.id);
        if (a === "open") {
          var w = window.open("", "_blank");
          if (w) w.document.write('<title>' + esc(item.title) + '</title>' +
            '<body style="margin:0;background:#05050b;display:grid;place-items:center;height:100vh">' +
            '<img src="' + item.thumb + '" style="max-width:96vw;max-height:96vh;border-radius:14px">');
          return;
        }
        var a2 = document.createElement("a");
        a2.href = item.thumb;
        a2.download = "km-" + item.tool + "-" + item.id + ".jpg";
        a2.click();
      });

      grid.appendChild(card);
    });
  }

  function buildGallery(tool) {
    var wrap = el('<section class="km-gallery">' +
      '<div class="gal-head">' +
      '<span class="gal-title">\u25c8 \u06af\u0627\u0644\u0631\u06cc \u0646\u062a\u0627\u06cc\u062c</span>' +
      '<span class="gal-count">0</span>' +
      '<button class="gal-tog">\u0647\u0645\u0647\u200c\u06cc \u0627\u0628\u0632\u0627\u0631\u0647\u0627</button>' +
      '<button class="gal-clear">\u067e\u0627\u06a9\u200c\u0633\u0627\u0632\u06cc</button>' +
      '</div>' +
      '<div class="gal-grid"></div>' +
      '</section>');

    wrap.__all = false;
    wrap.querySelector(".gal-tog").addEventListener("click", function () {
      wrap.__all = !wrap.__all;
      this.textContent = wrap.__all
        ? "\u0641\u0642\u0637 \u0627\u06cc\u0646 \u0627\u0628\u0632\u0627\u0631"
        : "\u0647\u0645\u0647\u200c\u06cc \u0627\u0628\u0632\u0627\u0631\u0647\u0627";
      this.classList.toggle("on", wrap.__all);
      renderGallery(currentTool);
    });
    wrap.querySelector(".gal-clear").addEventListener("click", function () {
      saveGallery([]);
      renderGallery(currentTool);
    });

    return wrap;
  }

  /* ---------------- \u0646\u0648\u0627\u0631 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06cc ---------------- */

  var AI_TOOLS = ["video", "thumb", "editvid", "editimg", "image", "audio"];

  var IDEAS = {
    image: "\u0645\u062b\u0644\u0627\u064b: \u067e\u0648\u0633\u062a\u0631 \u06a9\u06cc\u0647\u0627\u0646\u06cc \u0622\u0628\u06cc \u0628\u0646\u0641\u0634 \u0628\u0627 \u0647\u0633\u062a\u0647\u200c\u06cc \u0646\u0648\u0631\u0627\u0646\u06cc",
    video: "\u0645\u062b\u0644\u0627\u064b: \u062d\u0631\u06a9\u062a \u0633\u06cc\u0646\u0645\u0627\u06cc\u06cc \u062f\u0631 \u0634\u0647\u0631 \u0622\u06cc\u0646\u062f\u0647 \u0628\u0627 \u0630\u0631\u0627\u062a \u0646\u0648\u0631",
    thumb: "\u0645\u062b\u0644\u0627\u064b: \u062a\u0627\u0645\u0646\u06cc\u0644 \u067e\u0631\u0642\u062f\u0631\u062a \u062f\u0631\u0628\u0627\u0631\u0647\u200c\u06cc \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06cc",
    editvid: "\u0645\u062b\u0644\u0627\u064b: \u0631\u0646\u06af \u0633\u0631\u062f \u0633\u06cc\u0646\u0645\u0627\u06cc\u06cc \u0628\u0627 \u06a9\u0646\u062a\u0631\u0627\u0633\u062a \u0628\u0627\u0644\u0627",
    editimg: "\u0645\u062b\u0644\u0627\u064b: \u0646\u0648\u0631\u067e\u0631\u062f\u0627\u0632\u06cc \u063a\u0631\u0648\u0628 \u06af\u0631\u0645 \u0648 \u062f\u0631\u0627\u0645\u0627\u062a\u06cc\u06a9",
    audio: "\u0645\u062b\u0644\u0627\u064b: \u0645\u0648\u0633\u06cc\u0642\u06cc \u0641\u0636\u0627\u06cc\u06cc \u0622\u0631\u0627\u0645 \u0628\u0631\u0627\u06cc \u062a\u06cc\u0632\u0631 \u06f2\u06f0 \u062b\u0627\u0646\u06cc\u0647\u200c\u0627\u06cc"
  };

  function applyPlan(body, plan) {
    var ctrls = body.querySelector(".ctrls");
    if (!ctrls) return;

    /* 1) \u067e\u0627\u0644\u062a \u0631\u0646\u06af: \u0627\u0648\u0644\u06cc\u0646 \u06af\u0631\u0648\u0647 \u062f\u06a9\u0645\u0647\u200c\u0627\u06cc */
    var segs = ctrls.querySelectorAll(".seg");
    if (segs.length) {
      var idx = PALETTES.indexOf(plan.palette);
      var btns = segs[0].querySelectorAll("button");
      if (btns.length) (btns[Math.min(idx < 0 ? 0 : idx, btns.length - 1)]).click();
      for (var i = 1; i < segs.length; i++) {
        var b2 = segs[i].querySelectorAll("button");
        if (b2.length) b2[Math.floor(plan.rand() * b2.length)].click();
      }
    }

    /* 2) \u0627\u0633\u0644\u0627\u06cc\u062f\u0631\u0647\u0627 */
    var vals = [plan.intensity, plan.density, plan.glow];
    var ranges = ctrls.querySelectorAll('input[type=range]');
    for (var j = 0; j < ranges.length; j++) {
      var r = ranges[j];
      var min = parseFloat(r.min || 0), max = parseFloat(r.max || 100);
      var pct = vals[j % vals.length] / 100;
      r.value = String(Math.round(min + (max - min) * pct));
      r.dispatchEvent(new Event("input", { bubbles: true }));
      r.dispatchEvent(new Event("change", { bubbles: true }));
    }

    /* 3) \u0645\u062a\u0646\u200c\u0647\u0627 */
    var texts = ctrls.querySelectorAll('input[type=text], textarea');
    var fill = [plan.headline, plan.sub];
    var f = 0;
    for (var k = 0; k < texts.length; k++) {
      var t = texts[k];
      if (t.classList.contains("ai-prompt")) continue;
      if (f >= fill.length) break;
      t.value = fill[f++];
      t.dispatchEvent(new Event("input", { bubbles: true }));
      t.dispatchEvent(new Event("change", { bubbles: true }));
    }

    /* 4) \u0633\u0644\u06a9\u062a\u200c\u0647\u0627 */
    var sels = ctrls.querySelectorAll("select");
    for (var m = 0; m < sels.length; m++) {
      var sel = sels[m];
      if (sel.options.length > 1) {
        sel.selectedIndex = Math.floor(plan.rand() * sel.options.length);
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }

  function buildAiBar(tool, body) {
    var cost = (window.KMAuth && window.KMAuth.cost && window.KMAuth.cost(tool)) || "\u2014";

    var bar = el('<div class="ai-bar">' +
      '<div class="ai-head">' +
      '<span class="ai-orb"></span>' +
      '<b>\u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06cc KM \u2014 ' + esc(NAMES[tool] || tool) + '</b>' +
      '<span class="ai-cost">\u062e\u0631\u0648\u062c\u06cc: ' + cost + ' \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646</span>' +
      '</div>' +
      '<textarea class="ai-prompt" rows="2" placeholder="' + esc(IDEAS[tool] || "") + '"></textarea>' +
      '<div class="ai-row">' +
      '<button class="ai-make ai-go">\u25c9 \u0633\u0627\u062e\u062a\u0646 (' + cost + ' \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646)</button>' +
      '<button class="ai-dice">\u25c8 \u0627\u06cc\u062f\u0647\u200c\u06cc \u062a\u0635\u0627\u062f\u0641\u06cc</button>' +
      '</div>' +
      '<div class="ai-plan"></div>' +
      '</div>');

    var ta = bar.querySelector(".ai-prompt");
    var planBox = bar.querySelector(".ai-plan");

    function generate(plan) {
      window.KMGen.busy = true;
      window.KMGen.last[tool] = Date.now();
      bar.classList.add("thinking");
      planBox.innerHTML = '<span class="ai-think">\u062f\u0631 \u062d\u0627\u0644 \u062a\u062d\u0644\u06cc\u0644 \u067e\u0631\u0627\u0645\u067e\u062a\u2026</span>';

      setTimeout(function () {
        applyPlan(body, plan);
        bar.classList.remove("thinking");
        var chips = '<span class="chip">\u067e\u0627\u0644\u062a: ' + plan.palette.fa + '</span>' +
          '<span class="chip">\u062d\u0633\u200c\u0648\u062d\u0627\u0644: ' + plan.mood.fa + '</span>' +
          '<span class="chip">\u0634\u062f\u062a: ' + plan.intensity + '\u066a</span>' +
          '<span class="chip">\u062a\u0631\u0627\u06a9\u0645: ' + plan.density + '\u066a</span>';
        plan.keywords.slice(0, 4).forEach(function (w) {
          chips += '<span class="chip kw">' + esc(w) + '</span>';
        });
        planBox.innerHTML = chips;

        /* \u067e\u06cc\u0627\u0645 \u067e\u0627\u06cc\u0627\u0646 \u0633\u0627\u062e\u062a + \u0633\u0647\u0645\u06cc\u0647\u200c\u06cc \u0628\u0627\u0642\u06cc\u200c\u0645\u0627\u0646\u062f\u0647 */
        window.KMGen.busy = false;
        window.KMGen.last[tool] = Date.now();
        var leftTxt = "";
        if (!unlimited()) {
          var usedNow = bumpQuota(tool);
          leftTxt = " \u00b7 \u0627\u0645\u0631\u0648\u0632 " + usedNow + "/" + DAY_CAP;
        }
        planBox.innerHTML = '<span class="ai-done">\u2713 \u0633\u0627\u062e\u062a\u0647 \u0634\u062f \u2014 ' +
          esc(NAMES[tool] || tool) + leftTxt + '</span>' + chips;
        if (window.KMToast) window.KMToast("\u2713 \u0633\u0627\u062e\u062a\u0647 \u0634\u062f \u2014 " + (NAMES[tool] || tool));

        /* \u062b\u0628\u062a \u062e\u0648\u062f\u06a9\u0627\u0631 \u062f\u0631 \u06a9\u062a\u0627\u0628\u062e\u0627\u0646\u0647 */
        setTimeout(function () {
          capture(tool, plan.text ? plan.text.slice(0, 60) : (NAMES[tool] || tool), lastCost);
        }, 420);
      }, 420);
    }

    var lastCost = null;

    function run() {
      var txt = ta.value.trim();
      if (!txt) {
        planBox.innerHTML = '<span class="ai-warn">\u0627\u0648\u0644 \u0628\u0646\u0648\u06cc\u0633 \u0686\u0647 \u0686\u06cc\u0632\u06cc \u0645\u06cc\u200c\u062e\u0648\u0627\u0647\u06cc \u25c9</span>';
        return;
      }
      var blocked = gateCheck(tool);
      if (blocked) {
        planBox.innerHTML = '<span class="ai-warn">' + blocked + '</span>';
        return;
      }

      var plan = readPrompt(txt, tool);
      plan.text = txt;

      var goBtn = bar.querySelector(".ai-go");
      var cost = (window.KMAuth && window.KMAuth.cost) ? window.KMAuth.cost(tool) : 0;

      if (!window.KMAuth || !window.KMAuth.spend) { generate(plan); return; }

      goBtn.disabled = true;
      planBox.innerHTML = '<span class="ai-think">\u06a9\u0633\u0631 ' + cost + ' \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646\u2026</span>';

      Promise.resolve(window.KMAuth.spend(tool)).then(function (r) {
        goBtn.disabled = false;
        if (r && r.ok === false && (r.cooldown || r.capped)) {
          planBox.innerHTML = '<span class="ai-warn">' + esc(r.error || "") + '</span>';
          return;
        }
        if (!r || r.ok === false) {
          planBox.innerHTML = '<span class="ai-warn">\u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646 \u06a9\u0645 \u062f\u0627\u0631\u06cc \u2014 ' +
            '<a href="#" class="ai-buy">\u062e\u0631\u06cc\u062f \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646 \u2726</a></span>';
          var a = planBox.querySelector(".ai-buy");
          if (a) a.addEventListener("click", function (ev) {
            ev.preventDefault();
            if (window.KMShop) window.KMShop.open();
          });
          return;
        }
        lastCost = r.unlimited ? 0 : (r.cost != null ? r.cost : cost);
        /* \u062e\u0631\u0648\u062c\u06cc \u0628\u0639\u062f\u06cc \u062f\u0648\u0628\u0627\u0631\u0647 \u06a9\u0633\u0631 \u0646\u0634\u0648\u062f */
        window.KMPaid = window.KMPaid || {};
        window.KMPaid[tool] = Date.now();
        generate(plan);
      });
    }

    bar.querySelector(".ai-go").addEventListener("click", run);
    bar.querySelector(".ai-dice").addEventListener("click", function () {
      var seeds = [
        "\u0634\u0647\u0631 \u0622\u06cc\u0646\u062f\u0647 \u0622\u0628\u06cc \u0628\u0646\u0641\u0634 \u0633\u06cc\u0646\u0645\u0627\u06cc\u06cc",
        "\u0647\u0633\u062a\u0647\u200c\u06cc \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06cc \u062f\u0631 \u0641\u0636\u0627",
        "\u063a\u0631\u0648\u0628 \u06af\u0631\u0645 \u0631\u0648\u06cc \u0627\u0642\u06cc\u0627\u0646\u0648\u0633 \u062f\u06cc\u062c\u06cc\u062a\u0627\u0644",
        "\u0634\u0628\u06a9\u0647\u200c\u06cc \u0639\u0635\u0628\u06cc \u0632\u0645\u0631\u062f\u06cc \u0645\u06cc\u0646\u06cc\u0645\u0627\u0644",
        "\u0637\u0648\u0641\u0627\u0646 \u06cc\u062e\u06cc \u0633\u0641\u06cc\u062f \u0648 \u0633\u0631\u062f \u0648 \u062a\u0645\u06cc\u0632"
      ];
      ta.value = seeds[Math.floor(Math.random() * seeds.length)];
      run();
    });

    ta.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run();
    });

    return bar;
  }

  /* ---------------- \u062a\u0632\u0631\u06cc\u0642 \u0632\u0648\u0646\u200c\u0647\u0627 ---------------- */

  function decorate(tool) {
    var win = document.querySelector(".studio-modal.open .studio-win");
    if (!win) return;
    var body = win.querySelector(".studio-body");
    if (!body || body.getAttribute("data-lab") === tool) return;

    body.setAttribute("data-lab", tool);
    body.classList.add("lab-body");
    currentTool = tool;

    var ctrls = body.querySelector(".ctrls");
    var stage = body.querySelector(".stage");

    if (ctrls) {
      ctrls.parentNode.insertBefore(
        zoneTag("\u25c9", "\u06a9\u0627\u0631\u06af\u0627\u0647 \u0637\u0631\u0627\u062d\u06cc", "\u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u0648 \u067e\u0631\u0627\u0645\u067e\u062a"), ctrls);
      if (AI_TOOLS.indexOf(tool) > -1) {
        ctrls.parentNode.insertBefore(buildAiBar(tool, body), ctrls);
      }
    }

    if (stage) {
      stage.parentNode.insertBefore(
        zoneTag("\u25a0", "\u062e\u0631\u0648\u062c\u06cc \u0632\u0646\u062f\u0647", "\u067e\u06cc\u0634\u200c\u0646\u0645\u0627\u06cc\u0634 \u0648 \u062f\u0631\u06cc\u0627\u0641\u062a \u0641\u0627\u06cc\u0644"), stage);
    }

    body.appendChild(zoneTag("\u25c8", "\u0646\u062a\u06cc\u062c\u0647\u200c\u06cc \u06a9\u0627\u0631", "\u0647\u0631 \u062e\u0631\u0648\u062c\u06cc \u062e\u0648\u062f\u06a9\u0627\u0631 \u0627\u06cc\u0646\u062c\u0627 \u062b\u0628\u062a \u0645\u06cc\u200c\u0634\u0648\u062f"));
    body.appendChild(buildGallery(tool));
    renderGallery(tool);
  }

  /* ---------------- \u0642\u0644\u0627\u0628 \u0628\u0647 \u0627\u0633\u062a\u0648\u062f\u06cc\u0648 ---------------- */

  function hookStudio() {
    if (!window.KMStudio || window.KMStudio.__lab) return false;
    var open = window.KMStudio.open;
    window.KMStudio.open = function (tool) {
      var r = open.apply(this, arguments);
      setTimeout(function () { decorate(tool); }, 60);
      setTimeout(function () { decorate(tool); }, 320);
      return r;
    };
    window.KMStudio.__lab = true;
    return true;
  }

  var tries = 0;
  var timer = setInterval(function () {
    if (hookStudio() || ++tries > 40) clearInterval(timer);
  }, 250);

  /* ---------------- \u062b\u0628\u062a \u062e\u0631\u0648\u062c\u06cc\u200c\u0647\u0627 \u062f\u0631 \u06af\u0627\u0644\u0631\u06cc ---------------- */

  var pending = null;

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".studio-actions .mini-btn");
    if (!btn) return;
    var body = document.querySelector(".studio-modal.open .studio-body");
    if (!body) return;
    pending = {
      tool: body.getAttribute("data-lab") || currentTool,
      label: (btn.textContent || "").trim(),
      at: Date.now(),
      done: false
    };
    setTimeout(function () {
      if (!pending || pending.done) return;
      pending.done = true;
      capture(pending.tool, pending.label, null);
    }, 1500);
  }, true);

  document.addEventListener("km-tokens", function () {
    if (!pending || pending.done || Date.now() - pending.at > 6000) return;
    pending.done = true;
    var cost = (window.KMAuth && window.KMAuth.cost) ? window.KMAuth.cost(pending.tool) : null;
    setTimeout(function () { capture(pending.tool, pending.label, cost); }, 500);
  });

  /* ---------------- API \u0639\u0645\u0648\u0645\u06cc ---------------- */

  /* ---------------- \u06a9\u062a\u0627\u0628\u062e\u0627\u0646\u0647\u200c\u06cc \u0645\u0646 ---------------- */

  var libModal = null;

  function libRender(filter) {
    var wrap = libModal.querySelector(".lib-body");
    var items = loadGallery();
    if (filter && filter !== "all") {
      items = items.filter(function (it) { return it.tool === filter; });
    }
    if (!items.length) {
      wrap.innerHTML = '<div class="lib-empty">\u0647\u0646\u0648\u0632 \u0686\u06cc\u0632\u06cc \u062a\u0648\u0644\u06cc\u062f \u0646\u06a9\u0631\u062f\u0647\u200c\u0627\u06cc. \u0627\u0632 \u06a9\u0627\u0631\u06af\u0627\u0647 KM \u0634\u0631\u0648\u0639 \u06a9\u0646 \u25c9</div>';
      return;
    }

    var groups = {};
    items.forEach(function (it) {
      var k = it.tool || "other";
      (groups[k] = groups[k] || []).push(it);
    });

    var html = "";
    Object.keys(groups).forEach(function (k) {
      var list = groups[k].slice().sort(function (a, b) { return b.at - a.at; });
      html += '<div class="lib-group"><h5>' + esc(NAMES[k] || k) + ' <em>' + list.length + ' \u0645\u0648\u0631\u062f</em></h5><div class="gal-grid">';
      list.forEach(function (it) {
        html += '<div class="gal-item">' +
          (it.thumb ? '<img src="' + it.thumb + '" alt="">' : '<div class="gal-ph">\u25c8</div>') +
          '<div class="gal-meta"><b>' + esc(it.label || "") + '</b>' +
          '<span>' + fmtTime(it.at) + (it.cost ? ' \u00b7 ' + it.cost + ' \u062a\u0648\u06a9\u0646' : '') + '</span></div>' +
          '</div>';
      });
      html += '</div></div>';
    });
    wrap.innerHTML = html;
  }

  function openLibrary(filter) {
    if (!libModal) {
      libModal = el('<div class="km-modal" id="kmLib"><div class="km-win lib-win">' +
        '<button class="km-x">\u2715</button>' +
        '<h3>\u25c8 \u06a9\u062a\u0627\u0628\u062e\u0627\u0646\u0647\u200c\u06cc \u0645\u0646</h3>' +
        '<p class="km-sub">\u0647\u0631 \u0686\u06cc\u0632\u06cc \u06a9\u0647 \u0628\u0627 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06cc KM \u0633\u0627\u062e\u062a\u06cc\u060c \u0645\u0631\u062a\u0651\u0628 \u0648 \u062f\u0633\u062a\u0647\u200c\u0628\u0646\u062f\u06cc\u200c\u0634\u062f\u0647.</p>' +
        '<div class="lib-tabs"></div>' +
        '<div class="lib-body"></div>' +
        '</div></div>');
      document.body.appendChild(libModal);

      var tabs = libModal.querySelector(".lib-tabs");
      var defs = [["all", "\u0647\u0645\u0647"]].concat(AI_TOOLS.map(function (t) { return [t, NAMES[t] || t]; }));
      defs.forEach(function (d) {
        var b = document.createElement("button");
        b.textContent = d[1];
        b.dataset.k = d[0];
        b.addEventListener("click", function () {
          Array.prototype.forEach.call(tabs.children, function (x) { x.classList.remove("on"); });
          b.classList.add("on");
          libRender(d[0]);
        });
        tabs.appendChild(b);
      });
      tabs.firstChild.classList.add("on");

      libModal.querySelector(".km-x").addEventListener("click", function () {
        libModal.classList.remove("open");
      });
      libModal.addEventListener("click", function (e) {
        if (e.target === libModal) libModal.classList.remove("open");
      });
    }
    libRender(filter || "all");
    libModal.classList.add("open");
  }


  /* ---------------- \u0645\u0631\u06a9\u0632 \u0647\u0648\u0634 \u067e\u06cc\u0634\u0631\u0641\u062a\u0647 ---------------- */

  var hubModal = null;

  var HUB = [
    { t: "image", i: "\u25c9", d: "\u0633\u0627\u062e\u062a \u0639\u06a9\u0633 \u0627\u0632 \u0631\u0648\u06cc \u067e\u0631\u0627\u0645\u067e\u062a \u0641\u0627\u0631\u0633\u06cc" },
    { t: "video", i: "\u25a0", d: "\u0633\u0627\u062e\u062a \u062a\u0635\u0648\u06cc\u0631 / \u0648\u06cc\u062f\u06cc\u0648\u06cc \u0645\u062a\u062d\u0631\u06a9" },
    { t: "thumb", i: "\u25c8", d: "\u0633\u0627\u062e\u062a \u062a\u0627\u0645\u0646\u06cc\u0644 \u062d\u0631\u0641\u0647\u200c\u0627\u06cc" },
    { t: "editvid", i: "\u2726", d: "\u0627\u062f\u06cc\u062a \u0648\u06cc\u062f\u06cc\u0648 \u0628\u0627 \u0641\u06cc\u0644\u062a\u0631\u0647\u0627\u06cc \u0647\u0648\u0634\u0645\u0646\u062f" },
    { t: "editimg", i: "\u2727", d: "\u0627\u062f\u06cc\u062a \u0639\u06a9\u0633 \u0648 \u0631\u062a\u0648\u0634 \u062e\u0648\u062f\u06a9\u0627\u0631" },
    { t: "audio", i: "\u266a", d: "\u062a\u0648\u0644\u06cc\u062f \u0635\u062f\u0627 \u0648 \u0645\u0648\u0633\u06cc\u0642\u06cc \u067e\u0633\u200c\u0632\u0645\u06cc\u0646\u0647" }
  ];

  function openHub() {
    if (!hubModal) {
      var cards = "";
      HUB.forEach(function (h) {
        var c = (window.KMAuth && window.KMAuth.cost) ? window.KMAuth.cost(h.t) : "";
        cards += '<div class="hub-card" data-tool="' + h.t + '">' +
          '<div class="hi">' + h.i + '</div>' +
          '<b>' + esc(NAMES[h.t] || h.t) + '</b>' +
          '<span>' + h.d + '</span>' +
          '<i>' + c + ' \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646 \u0628\u0631\u0627\u06cc \u0647\u0631 \u0633\u0627\u062e\u062a</i>' +
          '</div>';
      });

      hubModal = el('<div class="km-modal" id="kmHub"><div class="km-win">' +
        '<button class="km-x">\u2715</button>' +
        '<h3>\u2726 \u0647\u0648\u0634 \u067e\u06cc\u0634\u0631\u0641\u062a\u0647 KM</h3>' +
        '<p class="km-sub">\u06cc\u06a9\u06cc \u0631\u0627 \u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0646\u061b \u067e\u0631\u0627\u0645\u067e\u062a \u0628\u0646\u0648\u06cc\u0633 \u0648 \u062f\u06a9\u0645\u0647\u200c\u06cc \u00ab\u0633\u0627\u062e\u062a\u0646\u00bb \u0631\u0627 \u0628\u0632\u0646. \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646 \u0647\u0645\u06cc\u0646 \u062c\u0627 \u06a9\u0645 \u0645\u06cc\u200c\u0634\u0648\u062f \u0648 \u0646\u062a\u06cc\u062c\u0647 \u062f\u0631 \u06a9\u062a\u0627\u0628\u062e\u0627\u0646\u0647 \u062b\u0628\u062a \u0645\u06cc\u200c\u0634\u0648\u062f.</p>' +
        '<div class="hub-grid">' + cards + '</div>' +
        '</div></div>');
      document.body.appendChild(hubModal);

      hubModal.querySelector(".km-x").addEventListener("click", function () {
        hubModal.classList.remove("open");
      });
      hubModal.addEventListener("click", function (e) {
        if (e.target === hubModal) hubModal.classList.remove("open");
      });
      Array.prototype.forEach.call(hubModal.querySelectorAll(".hub-card"), function (c) {
        c.addEventListener("click", function () {
          hubModal.classList.remove("open");
          if (window.KMStudio && window.KMStudio.open) window.KMStudio.open(c.dataset.tool);
        });
      });
    }
    hubModal.classList.add("open");
  }

  function addNavLink() {
    var nav = document.getElementById("navPill");
    if (!nav || nav.querySelector(".nav-ai")) return;
    var a = document.createElement("a");
    a.href = "#";
    a.className = "nav-ai";
    a.textContent = "\u2726 \u0647\u0648\u0634 \u067e\u06cc\u0634\u0631\u0641\u062a\u0647";
    a.addEventListener("click", function (e) { e.preventDefault(); openHub(); });
    var ghost = nav.querySelector(".btn-ghost");
    if (ghost) nav.insertBefore(a, ghost); else nav.appendChild(a);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addNavLink);
  } else {
    addNavLink();
  }

  window.KMLab = {
    read: readPrompt,
    capture: capture,
    openLibrary: openLibrary,
    openHub: openHub,
    gallery: loadGallery,
    clear: function () { saveGallery([]); renderGallery(currentTool); }
  };
})();
