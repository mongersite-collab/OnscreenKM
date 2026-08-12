/* ===================== ONSCREENKM - KM STUDIO =====================
   طراحی عکس / طراحی ویدیو / ادیت عکس / ادیت ویدیو / ساخت تامنیل
   کاملاً درون مرورگر - بدون سرور و بدون کتابخانه‌ی خارجی
================================================================== */
(function () {
  "use strict";

  var PALETTES = {
    cosmos:  ["#34b8f5", "#a855f7", "#6d5bf7"],
    sunset:  ["#ff9a3d", "#ff3d7f", "#8b2ff7"],
    emerald: ["#2ee6a8", "#22d3ee", "#3b82f6"],
    ice:     ["#cfe4ff", "#8fb6ff", "#6b7ba8"]
  };

  var RATIOS = {
    "1:1":  [1080, 1080],
    "16:9": [1600, 900],
    "9:16": [900, 1600],
    "4:5":  [1080, 1350]
  };

  var mark = new Image();
  mark.src = "assets/media/km-mark.png";

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function fa(n) { return String(n); }

  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1200);
  }

  function saveCanvas(cv, name, type, q) {
    if (cv.toBlob) cv.toBlob(function (b) { if (b) saveBlob(b, name); }, type || "image/png", q);
    else {
      var a = document.createElement("a");
      a.href = cv.toDataURL(type || "image/png", q); a.download = name; a.click();
    }
  }

  function ff(weight, size) {
    return weight + " " + size + "px Vazirmatn, 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif";
  }

  /* متن چندخطی متناسب با عرض */
  function wrapText(ctx, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], line = "";
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  /* ================= موتور هنر فضایی ================= */

  function bg(ctx, W, H) {
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#05050b");
    g.addColorStop(.55, "#080a1e");
    g.addColorStop(1, "#0b0718");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function stars(ctx, W, H, rnd, n, t) {
    t = t || 0;
    for (var i = 0; i < n; i++) {
      var x = rnd() * W, y = rnd() * H, r = rnd() * 1.9 + .3;
      var tw = .35 + .65 * Math.abs(Math.sin(t * .9 + i));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.2832);
      ctx.fillStyle = "rgba(226,238,255," + (tw * (.25 + rnd() * .6)) + ")";
      ctx.fill();
    }
  }

  function nebula(ctx, W, H, rnd, P, t) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 16; i++) {
      var x = rnd() * W, y = rnd() * H;
      var r = (rnd() * .34 + .12) * Math.max(W, H);
      var c = P[i % P.length];
      var drift = Math.sin(t + i) * W * .015;
      var g = ctx.createRadialGradient(x + drift, y, 0, x + drift, y, r);
      g.addColorStop(0, c + "55");
      g.addColorStop(.5, c + "1c");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + drift, y, r, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  function neural(ctx, W, H, rnd, P, t) {
    var n = Math.round(Math.min(120, W * H / 16000));
    var pts = [];
    for (var i = 0; i < n; i++) {
      pts.push({
        x: rnd() * W, y: rnd() * H,
        ax: rnd() * 6.2832, sp: .3 + rnd() * .9, rad: 8 + rnd() * 26
      });
    }
    var lim = Math.pow(Math.min(W, H) * .17, 2);
    for (var i2 = 0; i2 < pts.length; i2++) {
      var p = pts[i2];
      p.px = p.x + Math.cos(p.ax + t * p.sp) * p.rad;
      p.py = p.y + Math.sin(p.ax + t * p.sp) * p.rad;
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var a = 0; a < pts.length; a++) {
      for (var b = a + 1; b < pts.length; b++) {
        var dx = pts[a].px - pts[b].px, dy = pts[a].py - pts[b].py;
        var d = dx * dx + dy * dy;
        if (d < lim) {
          ctx.beginPath();
          ctx.moveTo(pts[a].px, pts[a].py);
          ctx.lineTo(pts[b].px, pts[b].py);
          ctx.strokeStyle = "rgba(120,170,255," + (.20 * (1 - d / lim)) + ")";
          ctx.lineWidth = Math.max(1, W / 1400);
          ctx.stroke();
        }
      }
    }
    for (var c2 = 0; c2 < pts.length; c2++) {
      var q = pts[c2], col = P[c2 % P.length];
      ctx.beginPath();
      ctx.arc(q.px, q.py, Math.max(1.4, W / 620), 0, 6.2832);
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function orb(ctx, W, H, rnd, P, t) {
    var cx = W / 2, cy = H * .46, R = Math.min(W, H) * .19;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    var halo = ctx.createRadialGradient(cx, cy, R * .3, cx, cy, R * 3.1);
    halo.addColorStop(0, P[1] + "66");
    halo.addColorStop(.4, P[0] + "24");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < 3; i++) {
      var rr = R * (1.5 + i * .55);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * (.25 + i * .12) + i);
      ctx.scale(1, .32);
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, 6.2832);
      ctx.strokeStyle = P[i % P.length] + "88";
      ctx.lineWidth = Math.max(1.2, W / 900);
      ctx.stroke();
      ctx.restore();
    }

    var core = ctx.createRadialGradient(cx - R * .3, cy - R * .35, R * .05, cx, cy, R);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(.35, P[0]);
    core.addColorStop(1, P[1] + "22");
    ctx.beginPath();
    ctx.arc(cx, cy, R * (1 + Math.sin(t * 1.4) * .03), 0, 6.2832);
    ctx.fillStyle = core;
    ctx.fill();
    ctx.restore();
  }

  function aurora(ctx, W, H, rnd, P, t) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var b = 0; b < 5; b++) {
      var amp = H * (.06 + rnd() * .09);
      var base = H * (.25 + b * .12);
      var g = ctx.createLinearGradient(0, base - amp * 2, 0, base + amp * 2);
      var c = P[b % P.length];
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(.5, c + "4d");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, base);
      for (var x = 0; x <= W; x += 12) {
        var y = base + Math.sin(x / W * 6.2832 * (1 + b * .35) + t * (.6 + b * .2)) * amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, base + amp * 3.2);
      ctx.lineTo(0, base + amp * 3.2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function warp(ctx, W, H, rnd, P, t) {
    var cx = W / 2, cy = H / 2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 150; i++) {
      var a = rnd() * 6.2832;
      var base = rnd();
      var d = ((base + t * .22) % 1);
      var r0 = d * d * Math.max(W, H) * .75;
      var len = 6 + d * 90;
      var x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0;
      var x1 = cx + Math.cos(a) * (r0 + len), y1 = cy + Math.sin(a) * (r0 + len);
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.strokeStyle = (i % 4 === 0 ? P[1] : "rgba(200,225,255,1)");
      ctx.globalAlpha = Math.min(1, d * 1.4) * .55;
      ctx.lineWidth = Math.max(1, d * 2.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function vignette(ctx, W, H, amount) {
    var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .28, W / 2, H / 2, Math.max(W, H) * .78);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0," + (amount == null ? .62 : amount) + ")");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function grain(ctx, W, H, rnd, amount) {
    var n = Math.round(W * H / 900);
    ctx.save();
    for (var i = 0; i < n; i++) {
      ctx.fillStyle = "rgba(255,255,255," + (rnd() * amount) + ")";
      ctx.fillRect(rnd() * W, rnd() * H, 1, 1);
    }
    ctx.restore();
  }

  function badge(ctx, W, H, size) {
    if (!mark.complete || !mark.naturalWidth) return;
    var s = size || Math.max(46, W * .07);
    var x = W - s - W * .045, y = H - s - H * .05;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s / 2, 0, 6.2832);
    ctx.closePath();
    ctx.shadowColor = "rgba(120,90,255,.8)";
    ctx.shadowBlur = s * .5;
    ctx.clip();
    ctx.drawImage(mark, x, y, s, s);
    ctx.restore();
  }

  function drawScene(ctx, W, H, o, t) {
    var rnd = mulberry32(o.seed || 7);
    bg(ctx, W, H);
    stars(ctx, W, H, mulberry32((o.seed || 7) + 99), Math.round(W * H / 5200), t);
    var P = PALETTES[o.palette] || PALETTES.cosmos;
    if (o.style === "nebula") nebula(ctx, W, H, rnd, P, t);
    else if (o.style === "neural") neural(ctx, W, H, rnd, P, t);
    else if (o.style === "orb") orb(ctx, W, H, rnd, P, t);
    else if (o.style === "aurora") aurora(ctx, W, H, rnd, P, t);
    else if (o.style === "warp") warp(ctx, W, H, rnd, P, t);
    vignette(ctx, W, H, .6);
  }

  function drawTitle(ctx, W, H, title, sub, alpha) {
    if (!title && !sub) return;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    var size = Math.round(Math.min(W, H) * .092);
    ctx.font = ff(800, size);
    var lines = wrapText(ctx, title || "", W * .82);
    var startY = H * (sub ? .74 : .78) - (lines.length - 1) * size * .62;

    ctx.shadowColor = "rgba(90,140,255,.85)";
    ctx.shadowBlur = size * .8;
    ctx.fillStyle = "#ffffff";
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, startY + i * size * 1.24);
    }
    ctx.shadowBlur = 0;

    if (sub) {
      var ss = Math.round(size * .3);
      ctx.font = ff(600, ss);
      ctx.fillStyle = "rgba(207,228,255,.85)";
      var y2 = startY + lines.length * size * 1.24 + ss * .6;
      ctx.fillText(sub, W / 2, y2);
    }
    ctx.restore();
  }

  function pickMime() {
    var list = [
      "video/webm;codecs=vp9,opus", "video/webm;codecs=vp9",
      "video/webm;codecs=vp8,opus", "video/webm;codecs=vp8",
      "video/webm", "video/mp4"
    ];
    if (!window.MediaRecorder) return null;
    for (var i = 0; i < list.length; i++) {
      try { if (MediaRecorder.isTypeSupported(list[i])) return list[i]; } catch (e) {}
    }
    return "";
  }

  /* ================= پنجره‌ی استودیو ================= */

  var modal, win, headTitle, headSub, bodyEl, current = null;

  function buildModal() {
    modal = el('<div class="studio-modal" id="studioModal" role="dialog" aria-modal="true"></div>');
    win = el('<div class="studio-win"></div>');
    var head = el('<div class="studio-head"></div>');
    var box = document.createElement("div");
    headTitle = el("<h3></h3>");
    headSub = el('<div class="mono"></div>');
    box.appendChild(headTitle); box.appendChild(headSub);
    var close = el('<button class="studio-close" aria-label="بستن">\u00d7</button>');
    close.addEventListener("click", closeStudio);
    head.appendChild(box); head.appendChild(close);
    bodyEl = el('<div class="studio-body"></div>');
    win.appendChild(head); win.appendChild(bodyEl);
    modal.appendChild(win);
    document.body.appendChild(modal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeStudio(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("open")) closeStudio();
    });
  }

  function closeStudio() {
    if (current && current.destroy) { try { current.destroy(); } catch (e) {} }
    current = null;
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }

  function openStudio(key) {
    if (!modal) buildModal();
    if (current && current.destroy) { try { current.destroy(); } catch (e) {} }
    bodyEl.innerHTML = "";
    var t = TOOLS[key];
    headTitle.textContent = t.name;
    headSub.textContent = t.code;
    current = t.mount(bodyEl);
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  /* ابزارهای کمکی برای ساخت کنترل‌ها */
  function ctrl(label, node, valNode) {
    var w = el('<div class="ctrl"></div>');
    var l = document.createElement("label");
    l.appendChild(document.createTextNode(label));
    if (valNode) l.appendChild(valNode);
    w.appendChild(l);
    w.appendChild(node);
    return w;
  }

  function range(min, max, val, step) {
    var i = document.createElement("input");
    i.type = "range"; i.min = min; i.max = max; i.value = val; i.step = step || 1;
    return i;
  }

  function textInput(ph, val) {
    var i = document.createElement("input");
    i.type = "text"; i.placeholder = ph || ""; i.value = val || "";
    return i;
  }

  function seg(options, val, onChange) {
    var s = el('<div class="seg"></div>');
    options.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = o.label;
      b.dataset.v = o.v;
      if (o.v === val) b.classList.add("on");
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(s.children, function (c) { c.classList.remove("on"); });
        b.classList.add("on");
        onChange(o.v);
      });
      s.appendChild(b);
    });
    return s;
  }

  function fileInput(accept, onFile) {
    var i = document.createElement("input");
    i.type = "file"; i.accept = accept;
    i.addEventListener("change", function () { if (i.files && i.files[0]) onFile(i.files[0]); });
    return i;
  }

  function button(label, cls) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "mini-btn" + (cls ? " " + cls : "");
    b.textContent = label;
    return b;
  }

  function stageBox() {
    var s = el('<div class="stage"></div>');
    return s;
  }

  function note(html) {
    var n = el('<div class="studio-note"></div>');
    n.innerHTML = html;
    return n;
  }

  /* ================= ابزار ۱: طراحی عکس ================= */

  function imageTool(root) {
    var o = {
      title: "ONSCREENKM", sub: "UNDERSTAND. ASSIST. EVOLVE.",
      style: "nebula", palette: "cosmos", ratio: "1:1", seed: 42, logo: true
    };

    var left = el('<div class="ctrls"></div>');
    var right = document.createElement("div");
    var stage = stageBox();
    var cv = document.createElement("canvas");
    stage.appendChild(cv);
    right.appendChild(stage);

    var ctx = cv.getContext("2d");

    function render() {
      var r = RATIOS[o.ratio];
      cv.width = r[0]; cv.height = r[1];
      cv.style.width = "100%";
      cv.style.maxWidth = (r[0] > r[1] ? "760px" : "420px");
      drawScene(ctx, cv.width, cv.height, o, 0);
      drawTitle(ctx, cv.width, cv.height, o.title, o.sub, 1);
      if (o.logo) badge(ctx, cv.width, cv.height);
    }

    var tIn = textInput("متن اصلی", o.title);
    tIn.addEventListener("input", function () { o.title = tIn.value; render(); });
    var sIn = textInput("زیرنویس", o.sub);
    sIn.addEventListener("input", function () { o.sub = sIn.value; render(); });

    left.appendChild(ctrl("متن اصلی", tIn));
    left.appendChild(ctrl("زیرنویس", sIn));
    left.appendChild(ctrl("سبک", seg([
      { v: "nebula", label: "سحابی" }, { v: "neural", label: "عصبی" },
      { v: "orb", label: "هسته" }, { v: "aurora", label: "شفق" }, { v: "warp", label: "پرش نور" }
    ], o.style, function (v) { o.style = v; render(); })));
    left.appendChild(ctrl("پالت رنگ", seg([
      { v: "cosmos", label: "کیهانی" }, { v: "sunset", label: "غروب" },
      { v: "emerald", label: "زمرد" }, { v: "ice", label: "یخی" }
    ], o.palette, function (v) { o.palette = v; render(); })));
    left.appendChild(ctrl("ابعاد", seg([
      { v: "1:1", label: "1:1" }, { v: "16:9", label: "16:9" },
      { v: "9:16", label: "9:16" }, { v: "4:5", label: "4:5" }
    ], o.ratio, function (v) { o.ratio = v; render(); })));

    var acts = el('<div class="studio-actions"></div>');
    var shuffle = button("طرح تازه");
    shuffle.addEventListener("click", function () { o.seed = Math.floor(Math.random() * 99999); render(); });
    var logoBtn = button("لوگو: روشن");
    logoBtn.addEventListener("click", function () {
      o.logo = !o.logo;
      logoBtn.textContent = o.logo ? "لوگو: روشن" : "لوگو: خاموش";
      render();
    });
    var dl = button("دانلود PNG", "primary");
    dl.addEventListener("click", function () { saveCanvas(cv, "KM-art-" + Date.now() + ".png"); });
    acts.appendChild(shuffle); acts.appendChild(logoBtn); acts.appendChild(dl);
    right.appendChild(acts);
    right.appendChild(note("هر بار <b>طرح تازه</b> را بزنی، یک ترکیب کاملاً جدید ساخته می‌شود. خروجی تا <b>1600 پیکسل</b> و کاملاً رایگان است."));

    root.appendChild(left); root.appendChild(right);

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
    if (!mark.complete) mark.addEventListener("load", render);
    render();

    return { destroy: function () {} };
  }

  /* ================= ابزار ۲: طراحی ویدیو ================= */

  function videoTool(root) {
    var o = {
      title: "ONSCREENKM", sub: "UNDERSTAND. ASSIST. EVOLVE.",
      style: "warp", palette: "cosmos", seed: 11, dur: 8, size: "720"
    };

    var left = el('<div class="ctrls"></div>');
    var right = document.createElement("div");
    var stage = stageBox();
    var cv = document.createElement("canvas");
    stage.appendChild(cv);
    right.appendChild(stage);
    var ctx = cv.getContext("2d");

    function dims() { return o.size === "1080" ? [1920, 1080] : [1280, 720]; }

    function setup() {
      var d = dims();
      cv.width = d[0]; cv.height = d[1];
      cv.style.width = "100%";
      cv.style.maxWidth = "760px";
    }

    var raf = null, t0 = Date.now(), recording = false;

    function frame() {
      var t = (Date.now() - t0) / 1000;
      var loop = t % o.dur;
      drawScene(ctx, cv.width, cv.height, o, loop);
      /* عنوان در یک‌سوم پایانی محو می‌شود */
      var k = loop / o.dur;
      var alpha = k < .45 ? 0 : Math.min(1, (k - .45) / .22);
      if (k > .93) alpha = Math.max(0, 1 - (k - .93) / .07);
      if (alpha > 0) drawTitle(ctx, cv.width, cv.height, o.title, o.sub, alpha);
      badge(ctx, cv.width, cv.height);
      raf = requestAnimationFrame(frame);
    }

    setup();
    frame();

    var tIn = textInput("عنوان", o.title);
    tIn.addEventListener("input", function () { o.title = tIn.value; });
    var sIn = textInput("زیرنویس", o.sub);
    sIn.addEventListener("input", function () { o.sub = sIn.value; });

    left.appendChild(ctrl("عنوان", tIn));
    left.appendChild(ctrl("زیرنویس", sIn));
    left.appendChild(ctrl("صحنه", seg([
      { v: "warp", label: "پرش نور" }, { v: "neural", label: "عصبی" },
      { v: "orb", label: "هسته" }, { v: "nebula", label: "سحابی" }, { v: "aurora", label: "شفق" }
    ], o.style, function (v) { o.style = v; })));
    left.appendChild(ctrl("پالت رنگ", seg([
      { v: "cosmos", label: "کیهانی" }, { v: "sunset", label: "غروب" },
      { v: "emerald", label: "زمرد" }, { v: "ice", label: "یخی" }
    ], o.palette, function (v) { o.palette = v; })));
    left.appendChild(ctrl("کیفیت", seg([
      { v: "720", label: "HD 720p" }, { v: "1080", label: "Full HD 1080p" }
    ], o.size, function (v) { o.size = v; setup(); })));

    var durVal = document.createElement("b");
    durVal.textContent = o.dur + " ثانیه";
    var durR = range(4, 20, o.dur, 1);
    durR.addEventListener("input", function () {
      o.dur = +durR.value; durVal.textContent = o.dur + " ثانیه";
    });
    left.appendChild(ctrl("مدت زمان", durR, durVal));

    var acts = el('<div class="studio-actions"></div>');
    var shuffle = button("طرح تازه");
    shuffle.addEventListener("click", function () { o.seed = Math.floor(Math.random() * 99999); });
    var recBtn = button("ضبط و دانلود ویدیو", "primary");
    acts.appendChild(shuffle); acts.appendChild(recBtn);
    right.appendChild(acts);

    var bar = el('<div class="progress-line"><i></i></div>');
    right.appendChild(bar);
    var noteEl = note("صحنه زنده در حال پخش است. با دکمه‌ی ضبط، یک فایل <b>WebM</b> ساخته و دانلود می‌شود.");
    right.appendChild(noteEl);

    var mime = pickMime();
    if (mime === null) {
      recBtn.disabled = true;
      noteEl.innerHTML = "این مرورگر از ضبط ویدیو پشتیبانی نمی‌کند - پیش‌نمایش زنده کار می‌کند. کروم یا ادج را امتحان کن.";
    }

    recBtn.addEventListener("click", function () {
      if (recording || mime === null) return;
      recording = true;
      recBtn.disabled = true;
      recBtn.innerHTML = '<span class="recdot"></span>در حال ضبط...';
      bar.classList.add("on");
      t0 = Date.now();

      var stream = cv.captureStream(30);
      var chunks = [];
      var mr;
      try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6000000 } : undefined); }
      catch (e) { mr = new MediaRecorder(stream); }

      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = function () {
        var blob = new Blob(chunks, { type: mr.mimeType || "video/webm" });
        var ext = (mr.mimeType || "").indexOf("mp4") > -1 ? "mp4" : "webm";
        saveBlob(blob, "KM-video-" + Date.now() + "." + ext);
        recording = false;
        recBtn.disabled = false;
        recBtn.textContent = "ضبط و دانلود ویدیو";
        bar.classList.remove("on");
        bar.firstChild.style.width = "0%";
      };

      mr.start();
      var started = Date.now();
      var tick = setInterval(function () {
        var p = Math.min(1, (Date.now() - started) / (o.dur * 1000));
        bar.firstChild.style.width = (p * 100) + "%";
        if (p >= 1) { clearInterval(tick); try { mr.stop(); } catch (e) {} }
      }, 100);
    });

    root.appendChild(left); root.appendChild(right);

    return {
      destroy: function () { if (raf) cancelAnimationFrame(raf); }
    };
  }

  /* ================= ابزار ۳: ادیت عکس ================= */

  function editImageTool(root) {
    var img = null;
    var f = { bri: 100, con: 100, sat: 120, blur: 0, hue: 0, vig: 30, grn: 0, rot: 0, flip: false, text: "", logo: false };

    var left = el('<div class="ctrls"></div>');
    var right = document.createElement("div");
    var stage = stageBox();
    var empty = el('<div class="stage-empty">یک عکس انتخاب کن<br>تا فیلترها را زنده رویش ببینی</div>');
    var cv = document.createElement("canvas");
    cv.style.display = "none";
    stage.appendChild(empty); stage.appendChild(cv);
    right.appendChild(stage);
    var ctx = cv.getContext("2d");

    function render() {
      if (!img) return;
      var W = img.naturalWidth, H = img.naturalHeight;
      var swap = (f.rot % 180) !== 0;
      cv.width = swap ? H : W;
      cv.height = swap ? W : H;
      cv.style.width = "100%";
      cv.style.maxWidth = "760px";

      ctx.save();
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.translate(cv.width / 2, cv.height / 2);
      ctx.rotate(f.rot * Math.PI / 180);
      if (f.flip) ctx.scale(-1, 1);
      ctx.filter = "brightness(" + f.bri + "%) contrast(" + f.con + "%) saturate(" + f.sat +
        "%) blur(" + f.blur + "px) hue-rotate(" + f.hue + "deg)";
      ctx.drawImage(img, -W / 2, -H / 2, W, H);
      ctx.restore();

      ctx.filter = "none";
      if (f.vig > 0) vignette(ctx, cv.width, cv.height, f.vig / 100);
      if (f.grn > 0) grain(ctx, cv.width, cv.height, mulberry32(5), f.grn / 400);

      if (f.text) {
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        var size = Math.round(Math.min(cv.width, cv.height) * .085);
        ctx.font = ff(800, size);
        ctx.shadowColor = "rgba(0,0,0,.75)";
        ctx.shadowBlur = size * .5;
        ctx.fillStyle = "#fff";
        var lines = wrapText(ctx, f.text, cv.width * .86);
        var y = cv.height * .86 - (lines.length - 1) * size * .6;
        for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], cv.width / 2, y + i * size * 1.2);
        ctx.restore();
      }
      if (f.logo) badge(ctx, cv.width, cv.height);
    }

    left.appendChild(ctrl("عکس را انتخاب کن", fileInput("image/*", function (file) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        img = im;
        empty.style.display = "none";
        cv.style.display = "block";
        render();
        URL.revokeObjectURL(url);
      };
      im.src = url;
    })));

    function slider(label, key, min, max, unit) {
      var v = document.createElement("b");
      v.textContent = f[key] + (unit || "");
      var r = range(min, max, f[key], 1);
      r.addEventListener("input", function () {
        f[key] = +r.value; v.textContent = f[key] + (unit || ""); render();
      });
      left.appendChild(ctrl(label, r, v));
    }

    slider("روشنایی", "bri", 20, 200, "%");
    slider("کنتراست", "con", 20, 220, "%");
    slider("اشباع رنگ", "sat", 0, 260, "%");
    slider("محوی لبه", "vig", 0, 90, "%");
    slider("دانه‌ی فیلم", "grn", 0, 100, "%");
    slider("چرخش رنگ", "hue", 0, 360, "");
    slider("بلور", "blur", 0, 20, "px");

    var txt = textInput("متن روی عکس (اختیاری)", "");
    txt.addEventListener("input", function () { f.text = txt.value; render(); });
    left.appendChild(ctrl("متن روی عکس", txt));

    var acts = el('<div class="studio-actions"></div>');
    var rot = button("چرخش ۹۰ درجه");
    rot.addEventListener("click", function () { f.rot = (f.rot + 90) % 360; render(); });
    var flip = button("آینه");
    flip.addEventListener("click", function () { f.flip = !f.flip; render(); });
    var lg = button("لوگو: خاموش");
    lg.addEventListener("click", function () {
      f.logo = !f.logo;
      lg.textContent = f.logo ? "لوگو: روشن" : "لوگو: خاموش";
      render();
    });
    var reset = button("بازنشانی");
    reset.addEventListener("click", function () {
      f.bri = 100; f.con = 100; f.sat = 120; f.blur = 0; f.hue = 0; f.vig = 30; f.grn = 0; f.rot = 0; f.flip = false;
      bodyRefresh();
    });
    var dl = button("دانلود عکس", "primary");
    dl.addEventListener("click", function () {
      if (!img) return;
      saveCanvas(cv, "KM-edit-" + Date.now() + ".png");
    });
    acts.appendChild(rot); acts.appendChild(flip); acts.appendChild(lg);
    acts.appendChild(reset); acts.appendChild(dl);
    right.appendChild(acts);
    right.appendChild(note("همه‌ی پردازش روی دستگاه خودت انجام می‌شود - <b>عکست هیچ‌جا آپلود نمی‌شود.</b>"));

    function bodyRefresh() {
      var n = root.querySelector(".ctrls");
      if (n) n.remove();
      root.insertBefore(rebuild(), root.firstChild);
      render();
    }
    function rebuild() { return left; }

    root.appendChild(left); root.appendChild(right);
    return { destroy: function () {} };
  }

  /* ================= ابزار ۴: ادیت ویدیو ================= */

  function editVideoTool(root) {
    var f = { bri: 105, con: 108, sat: 125, blur: 0, hue: 0, vig: 25, mute: false, start: 0, end: 0 };
    var vid = document.createElement("video");
    vid.playsInline = true; vid.loop = true; vid.muted = true; vid.crossOrigin = "anonymous";

    var left = el('<div class="ctrls"></div>');
    var right = document.createElement("div");
    var stage = stageBox();
    var empty = el('<div class="stage-empty">یک ویدیو انتخاب کن<br>تا زنده رنگ‌شناسی و برشش کنی</div>');
    var cv = document.createElement("canvas");
    cv.style.display = "none";
    stage.appendChild(empty); stage.appendChild(cv);
    right.appendChild(stage);
    var ctx = cv.getContext("2d");

    var raf = null, ready = false, recording = false;

    function loop() {
      if (ready && vid.videoWidth) {
        ctx.save();
        ctx.filter = "brightness(" + f.bri + "%) contrast(" + f.con + "%) saturate(" + f.sat +
          "%) blur(" + f.blur + "px) hue-rotate(" + f.hue + "deg)";
        ctx.drawImage(vid, 0, 0, cv.width, cv.height);
        ctx.restore();
        ctx.filter = "none";
        if (f.vig > 0) vignette(ctx, cv.width, cv.height, f.vig / 100);
        if (vid.currentTime >= f.end && f.end > 0) vid.currentTime = f.start;
      }
      raf = requestAnimationFrame(loop);
    }
    loop();

    var startR = range(0, 100, 0, .1), endR = range(0, 100, 100, .1);
    var startVal = document.createElement("b"), endVal = document.createElement("b");

    left.appendChild(ctrl("ویدیو را انتخاب کن", fileInput("video/*", function (file) {
      vid.src = URL.createObjectURL(file);
      vid.onloadedmetadata = function () {
        cv.width = vid.videoWidth; cv.height = vid.videoHeight;
        cv.style.width = "100%"; cv.style.maxWidth = "760px";
        empty.style.display = "none"; cv.style.display = "block";
        f.start = 0; f.end = vid.duration;
        startR.max = endR.max = vid.duration.toFixed(1);
        startR.value = 0; endR.value = vid.duration;
        startVal.textContent = "0.0s"; endVal.textContent = vid.duration.toFixed(1) + "s";
        ready = true;
        vid.play();
      };
    })));

    function slider(label, key, min, max, unit) {
      var v = document.createElement("b");
      v.textContent = f[key] + (unit || "");
      var r = range(min, max, f[key], 1);
      r.addEventListener("input", function () { f[key] = +r.value; v.textContent = f[key] + (unit || ""); });
      left.appendChild(ctrl(label, r, v));
    }

    slider("روشنایی", "bri", 20, 200, "%");
    slider("کنتراست", "con", 20, 220, "%");
    slider("اشباع رنگ", "sat", 0, 260, "%");
    slider("محوی لبه", "vig", 0, 90, "%");
    slider("چرخش رنگ", "hue", 0, 360, "");
    slider("بلور", "blur", 0, 16, "px");

    startR.addEventListener("input", function () {
      f.start = +startR.value;
      if (f.start >= f.end) f.start = Math.max(0, f.end - .5);
      startVal.textContent = f.start.toFixed(1) + "s";
      if (ready) vid.currentTime = f.start;
    });
    endR.addEventListener("input", function () {
      f.end = +endR.value;
      if (f.end <= f.start) f.end = f.start + .5;
      endVal.textContent = f.end.toFixed(1) + "s";
    });
    left.appendChild(ctrl("شروع برش", startR, startVal));
    left.appendChild(ctrl("پایان برش", endR, endVal));

    var acts = el('<div class="studio-actions"></div>');
    var playBtn = button("پخش / مکث");
    playBtn.addEventListener("click", function () { if (vid.paused) vid.play(); else vid.pause(); });
    var recBtn = button("خروجی گرفتن و دانلود", "primary");
    acts.appendChild(playBtn); acts.appendChild(recBtn);
    right.appendChild(acts);

    var bar = el('<div class="progress-line"><i></i></div>');
    right.appendChild(bar);
    var noteEl = note("فیلترها زنده اعمال می‌شوند. در خروجی، فقط بازه‌ی برش‌خورده با همان رنگ‌شناسی ضبط می‌شود.");
    right.appendChild(noteEl);

    var mime = pickMime();
    if (mime === null) {
      recBtn.disabled = true;
      noteEl.innerHTML = "این مرورگر از خروجی گرفتن پشتیبانی نمی‌کند - پیش‌نمایش کار می‌کند.";
    }

    recBtn.addEventListener("click", function () {
      if (!ready || recording || mime === null) return;
      recording = true;
      recBtn.disabled = true;
      recBtn.innerHTML = '<span class="recdot"></span>در حال خروجی...';
      bar.classList.add("on");

      var stream = cv.captureStream(30);
      var chunks = [];
      var mr;
      try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6000000 } : undefined); }
      catch (e) { mr = new MediaRecorder(stream); }

      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = function () {
        var blob = new Blob(chunks, { type: mr.mimeType || "video/webm" });
        var ext = (mr.mimeType || "").indexOf("mp4") > -1 ? "mp4" : "webm";
        saveBlob(blob, "KM-video-edit-" + Date.now() + "." + ext);
        recording = false;
        recBtn.disabled = false;
        recBtn.textContent = "خروجی گرفتن و دانلود";
        bar.classList.remove("on");
        bar.firstChild.style.width = "0%";
      };

      vid.currentTime = f.start;
      vid.play();
      mr.start();
      var span = Math.max(.5, f.end - f.start) * 1000;
      var started = Date.now();
      var tick = setInterval(function () {
        var p = Math.min(1, (Date.now() - started) / span);
        bar.firstChild.style.width = (p * 100) + "%";
        if (p >= 1) { clearInterval(tick); try { mr.stop(); } catch (e) {} }
      }, 100);
    });

    root.appendChild(left); root.appendChild(right);

    return {
      destroy: function () {
        if (raf) cancelAnimationFrame(raf);
        try { vid.pause(); vid.src = ""; } catch (e) {}
      }
    };
  }

  /* ================= ابزار ۵: ساخت تامنیل ================= */

  function thumbTool(root) {
    var o = {
      title: "هوش مصنوعی KM",
      sub: "ONSCREENKM",
      badgeTxt: "جدید",
      layout: "right",
      dark: 55,
      accent: "#a855f7",
      style: "nebula", palette: "cosmos", seed: 21,
      logo: true
    };
    var photo = null;

    var left = el('<div class="ctrls"></div>');
    var right = document.createElement("div");
    var stage = stageBox();
    var cv = document.createElement("canvas");
    cv.width = 1280; cv.height = 720;
    cv.style.width = "100%"; cv.style.maxWidth = "760px";
    stage.appendChild(cv);
    right.appendChild(stage);
    var ctx = cv.getContext("2d");

    function render() {
      var W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);

      if (photo) {
        var s = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
        var dw = photo.naturalWidth * s, dh = photo.naturalHeight * s;
        ctx.drawImage(photo, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } else {
        drawScene(ctx, W, H, o, 0);
      }

      /* پوشش تیره جهت‌دار */
      var g;
      if (o.layout === "center") {
        g = ctx.createRadialGradient(W / 2, H / 2, H * .12, W / 2, H / 2, W * .72);
        g.addColorStop(0, "rgba(3,3,10," + (o.dark / 100) + ")");
        g.addColorStop(1, "rgba(3,3,10," + Math.min(.95, o.dark / 100 + .25) + ")");
      } else {
        var l2r = o.layout === "right";
        g = ctx.createLinearGradient(l2r ? W : 0, 0, l2r ? 0 : W, 0);
        g.addColorStop(0, "rgba(3,3,10," + Math.min(.96, o.dark / 100 + .3) + ")");
        g.addColorStop(.62, "rgba(3,3,10," + (o.dark / 100 * .55) + ")");
        g.addColorStop(1, "rgba(3,3,10,.12)");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      /* خط لهجه‌ی رنگی */
      ctx.fillStyle = o.accent;
      if (o.layout === "center") ctx.fillRect(W / 2 - 60, H * .18, 120, 6);
      else if (o.layout === "right") ctx.fillRect(W - 90, H * .26, 6, H * .34);
      else ctx.fillRect(84, H * .26, 6, H * .34);

      var pad = 108;
      var maxW = o.layout === "center" ? W * .8 : W * .56;
      var cx = o.layout === "center" ? W / 2 : (o.layout === "right" ? W - pad : pad);
      ctx.textAlign = o.layout === "center" ? "center" : (o.layout === "right" ? "right" : "left");
      ctx.textBaseline = "alphabetic";

      /* برچسب */
      if (o.badgeTxt) {
        ctx.font = ff(700, 26);
        var bw = ctx.measureText(o.badgeTxt).width + 34;
        var bx = o.layout === "center" ? W / 2 - bw / 2 : (o.layout === "right" ? W - pad - bw : pad);
        var by = H * .235;
        ctx.fillStyle = o.accent;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by - 34, bw, 46, 23); ctx.fill(); }
        else ctx.fillRect(bx, by - 34, bw, 46);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(o.badgeTxt, bx + bw / 2, by);
        ctx.textAlign = o.layout === "center" ? "center" : (o.layout === "right" ? "right" : "left");
      }

      /* عنوان بزرگ با اندازه‌ی خودکار */
      var size = 94;
      var lines;
      do {
        ctx.font = ff(900, size);
        lines = wrapText(ctx, o.title, maxW);
        if (lines.length <= 3) break;
        size -= 6;
      } while (size > 44);

      var ty = H * .46;
      ctx.shadowColor = "rgba(0,0,0,.8)";
      ctx.shadowBlur = 26;
      ctx.fillStyle = "#ffffff";
      for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], cx, ty + i * size * 1.12);
      ctx.shadowBlur = 0;

      if (o.sub) {
        ctx.font = ff(600, 30);
        ctx.fillStyle = "rgba(207,228,255,.9)";
        ctx.fillText(o.sub, cx, ty + lines.length * size * 1.12 + 16);
      }

      if (o.logo) badge(ctx, W, H, 96);
    }

    var tIn = textInput("عنوان تامنیل", o.title);
    tIn.addEventListener("input", function () { o.title = tIn.value; render(); });
    var sIn = textInput("زیرنویس", o.sub);
    sIn.addEventListener("input", function () { o.sub = sIn.value; render(); });
    var bIn = textInput("برچسب گوشه", o.badgeTxt);
    bIn.addEventListener("input", function () { o.badgeTxt = bIn.value; render(); });

    left.appendChild(ctrl("عنوان", tIn));
    left.appendChild(ctrl("زیرنویس", sIn));
    left.appendChild(ctrl("برچسب", bIn));
    left.appendChild(ctrl("عکس پس‌زمینه (اختیاری)", fileInput("image/*", function (file) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () { photo = im; render(); URL.revokeObjectURL(url); };
      im.src = url;
    })));
    left.appendChild(ctrl("چیدمان", seg([
      { v: "right", label: "راست" }, { v: "center", label: "وسط" }, { v: "left", label: "چپ" }
    ], o.layout, function (v) { o.layout = v; render(); })));
    left.appendChild(ctrl("پس‌زمینه‌ی ساختگی", seg([
      { v: "nebula", label: "سحابی" }, { v: "neural", label: "عصبی" },
      { v: "orb", label: "هسته" }, { v: "warp", label: "پرش نور" }
    ], o.style, function (v) { o.style = v; photo = null; render(); })));

    var dv = document.createElement("b");
    dv.textContent = o.dark + "%";
    var dr = range(0, 90, o.dark, 1);
    dr.addEventListener("input", function () { o.dark = +dr.value; dv.textContent = o.dark + "%"; render(); });
    left.appendChild(ctrl("تیرگی پوشش", dr, dv));

    var col = document.createElement("input");
    col.type = "color"; col.value = o.accent;
    col.addEventListener("input", function () { o.accent = col.value; render(); });
    left.appendChild(ctrl("رنگ لهجه", col));

    var acts = el('<div class="studio-actions"></div>');
    var shuffle = button("پس‌زمینه‌ی تازه");
    shuffle.addEventListener("click", function () {
      photo = null; o.seed = Math.floor(Math.random() * 99999); render();
    });
    var lg = button("لوگو: روشن");
    lg.addEventListener("click", function () {
      o.logo = !o.logo;
      lg.textContent = o.logo ? "لوگو: روشن" : "لوگو: خاموش";
      render();
    });
    var dlP = button("دانلود PNG");
    dlP.addEventListener("click", function () { saveCanvas(cv, "KM-thumbnail-" + Date.now() + ".png"); });
    var dlJ = button("دانلود JPG", "primary");
    dlJ.addEventListener("click", function () { saveCanvas(cv, "KM-thumbnail-" + Date.now() + ".jpg", "image/jpeg", .92); });
    acts.appendChild(shuffle); acts.appendChild(lg); acts.appendChild(dlP); acts.appendChild(dlJ);
    right.appendChild(acts);
    right.appendChild(note("خروجی دقیقاً <b>1280×720</b> است - اندازه‌ی استاندارد تامنیل یوتیوب و آپارات."));

    root.appendChild(left); root.appendChild(right);

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
    if (!mark.complete) mark.addEventListener("load", render);
    render();

    return { destroy: function () {} };
  }

  /* ================= ابزار ۶: تولید صدا ================= */

  var MOODS = {
    cosmic:   { name: "کیهانی", root: 110.0, scale: [0, 3, 5, 7, 10], wave: "sine", warm: 0.35 },
    cinema:   { name: "سینمایی", root: 82.41, scale: [0, 2, 3, 7, 8], wave: "triangle", warm: 0.5 },
    pulse:    { name: "تپش", root: 130.81, scale: [0, 2, 5, 7, 9], wave: "sawtooth", warm: 0.22 },
    calm:     { name: "آرام", root: 98.0, scale: [0, 4, 7, 11, 14], wave: "sine", warm: 0.6 }
  };

  function encodeWav(buf) {
    var ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
    var bytes = len * ch * 2;
    var ab = new ArrayBuffer(44 + bytes);
    var v = new DataView(ab);
    function str(off, t) { for (var i = 0; i < t.length; i++) v.setUint8(off + i, t.charCodeAt(i)); }
    str(0, "RIFF"); v.setUint32(4, 36 + bytes, true); str(8, "WAVE");
    str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, ch, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
    str(36, "data"); v.setUint32(40, bytes, true);
    var data = [], i;
    for (i = 0; i < ch; i++) data.push(buf.getChannelData(i));
    var off = 44;
    for (i = 0; i < len; i++) {
      for (var c = 0; c < ch; c++) {
        var x = Math.max(-1, Math.min(1, data[c][i]));
        v.setInt16(off, x < 0 ? x * 0x8000 : x * 0x7fff, true);
        off += 2;
      }
    }
    return new Blob([ab], { type: "audio/wav" });
  }

  function renderAudio(o) {
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return Promise.reject(new Error("no-audio"));

    var sr = 44100, dur = o.dur;
    var ac = new OAC(2, Math.ceil(sr * dur), sr);
    var M = MOODS[o.mood] || MOODS.cosmic;
    var rnd = mulberry32(o.seed || 7);

    var master = ac.createGain();
    master.gain.value = 0.0001;
    master.gain.exponentialRampToValueAtTime(Math.max(0.05, o.vol / 100), ac.currentTime + 1.4);
    master.gain.setValueAtTime(Math.max(0.05, o.vol / 100), Math.max(0, dur - 2.2));
    master.gain.exponentialRampToValueAtTime(0.0001, dur);

    var verb = ac.createConvolver();
    var irLen = Math.floor(sr * 2.2);
    var ir = ac.createBuffer(2, irLen, sr);
    for (var c = 0; c < 2; c++) {
      var d = ir.getChannelData(c);
      for (var i = 0; i < irLen; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / irLen, 2.6);
    }
    verb.buffer = ir;
    var wet = ac.createGain(); wet.gain.value = 0.34;
    verb.connect(wet); wet.connect(master);
    master.connect(ac.destination);

    function voice(freq, start, len, gain, type, detune) {
      var osc = ac.createOscillator();
      osc.type = type || M.wave;
      osc.frequency.value = freq;
      if (detune) osc.detune.value = detune;
      var g = ac.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.9, len * 0.35));
      g.gain.exponentialRampToValueAtTime(0.0001, start + len);
      var lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 400 + M.warm * 3200;
      osc.connect(g); g.connect(lp); lp.connect(master); lp.connect(verb);
      osc.start(start); osc.stop(start + len + 0.05);
    }

    /* پد زیرین */
    voice(M.root, 0, dur, 0.16, "sine");
    voice(M.root * 1.5, 0.4, dur - 0.4, 0.08, "sine", 6);

    /* آکوردهای کشیده */
    var chordLen = Math.max(3, dur / 4);
    for (var t = 0; t < dur - 0.6; t += chordLen) {
      var base = M.scale[Math.floor(rnd() * M.scale.length)];
      [0, 4, 7].forEach(function (iv, k) {
        var f = M.root * 2 * Math.pow(2, (base + iv) / 12);
        voice(f, t, chordLen * 1.15, 0.055 - k * 0.008, M.wave, (rnd() * 12 - 6));
      });
    }

    /* آرپژ درخشان */
    if (o.sparkle) {
      var step = 60 / o.bpm / 2;
      for (var st = 0.6; st < dur - 0.4; st += step) {
        if (rnd() < 0.34) continue;
        var n = M.scale[Math.floor(rnd() * M.scale.length)];
        var fr = M.root * 4 * Math.pow(2, n / 12);
        voice(fr, st, step * 1.8, 0.035, "sine", 0);
      }
    }

    /* نفس فضایی (نویز سوایپ) */
    if (o.air) {
      var nb = ac.createBuffer(1, Math.ceil(sr * dur), sr);
      var nd = nb.getChannelData(0);
      for (var j = 0; j < nd.length; j++) nd[j] = (rnd() * 2 - 1) * 0.5;
      var ns = ac.createBufferSource(); ns.buffer = nb;
      var bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(300, 0);
      bp.frequency.linearRampToValueAtTime(3400, dur * 0.7);
      bp.frequency.linearRampToValueAtTime(500, dur);
      var ng = ac.createGain(); ng.gain.value = 0.05;
      ns.connect(bp); bp.connect(ng); ng.connect(master); ng.connect(verb);
      ns.start(0); ns.stop(dur);
    }

    /* ضرباهنگ زیربم */
    if (o.beat) {
      var per = 60 / o.bpm;
      for (var b = 0.2; b < dur - 0.3; b += per) {
        var k = ac.createOscillator(); k.type = "sine";
        k.frequency.setValueAtTime(120, b);
        k.frequency.exponentialRampToValueAtTime(42, b + 0.22);
        var kg = ac.createGain();
        kg.gain.setValueAtTime(0.34, b);
        kg.gain.exponentialRampToValueAtTime(0.0001, b + 0.3);
        k.connect(kg); kg.connect(master);
        k.start(b); k.stop(b + 0.32);
      }
    }

    return ac.startRendering();
  }

  function audioTool(root) {
    var o = { mood: "cosmic", dur: 20, bpm: 84, vol: 80, sparkle: true, air: true, beat: false, seed: 21 };
    var lastBlob = null, lastUrl = "";

    var left = el('<div class="ctrls"></div>');
    var right = document.createElement("div");
    var stage = stageBox();
    var cv = document.createElement("canvas");
    cv.width = 1280; cv.height = 420;
    cv.style.width = "100%";
    stage.appendChild(cv);
    right.appendChild(stage);
    var ctx = cv.getContext("2d");

    var player = document.createElement("audio");
    player.controls = true;
    player.style.cssText = "width:100%;margin-top:12px;border-radius:14px;";
    right.appendChild(player);

    var peaks = null;

    function paint(progress) {
      var W = cv.width, H = cv.height;
      var g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#080a1c"); g.addColorStop(1, "#0d0620");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      var rnd = mulberry32(o.seed);
      for (var i = 0; i < 80; i++) {
        var x = rnd() * W, y = rnd() * H, r = rnd() * 1.6 + 0.3;
        ctx.fillStyle = "rgba(207,228,255," + (0.15 + rnd() * 0.5) + ")";
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
      }

      var mid = H * 0.55;
      if (!peaks) {
        ctx.fillStyle = "rgba(207,228,255,.55)";
        ctx.font = ff(600, 34);
        ctx.textAlign = "center";
        ctx.fillText("◉ دکمه‌ی «ساختن صدا» را بزن", W / 2, mid);
        ctx.textAlign = "start";
      } else {
        var n = peaks.length, bw = W / n;
        for (var k = 0; k < n; k++) {
          var h = Math.max(2, peaks[k] * H * 0.78);
          var done = progress != null && (k / n) <= progress;
          var grad = ctx.createLinearGradient(0, mid - h / 2, 0, mid + h / 2);
          grad.addColorStop(0, done ? "#a855f7" : "rgba(52,184,245,.95)");
          grad.addColorStop(1, done ? "#34b8f5" : "rgba(168,85,247,.75)");
          ctx.fillStyle = grad;
          ctx.fillRect(k * bw + bw * 0.22, mid - h / 2, Math.max(1.4, bw * 0.56), h);
        }
        ctx.fillStyle = "rgba(255,255,255,.75)";
        ctx.font = ff(600, 26);
        ctx.fillText("KM AUDIO · " + (MOODS[o.mood] || {}).name + " · " + o.dur + "s", 34, 54);
      }
      badge(ctx, W, H, 64);
    }

    function buildPeaks(buf) {
      var d = buf.getChannelData(0), N = 160, block = Math.floor(d.length / N);
      var out = [];
      for (var i = 0; i < N; i++) {
        var mx = 0;
        for (var j = 0; j < block; j += 16) { var a = Math.abs(d[i * block + j] || 0); if (a > mx) mx = a; }
        out.push(Math.min(1, mx * 1.25));
      }
      peaks = out;
    }

    /* کنترل‌ها */
    left.appendChild(ctrl("حالت صدا", seg([
      { v: "cosmic", label: "کیهانی" }, { v: "cinema", label: "سینمایی" },
      { v: "pulse", label: "تپش" }, { v: "calm", label: "آرام" }
    ], o.mood, function (v) { o.mood = v; })));

    var dLbl = document.createElement("span");
    dLbl.textContent = o.dur + " ثانیه";
    var dR = range(5, 60, o.dur, 1);
    dR.addEventListener("input", function () { o.dur = +dR.value; dLbl.textContent = o.dur + " ثانیه"; });
    left.appendChild(ctrl("مدت زمان", dR, dLbl));

    var bLbl = document.createElement("span");
    bLbl.textContent = o.bpm + " BPM";
    var bR = range(50, 150, o.bpm, 1);
    bR.addEventListener("input", function () { o.bpm = +bR.value; bLbl.textContent = o.bpm + " BPM"; });
    left.appendChild(ctrl("ضرباهنگ", bR, bLbl));

    var vLbl = document.createElement("span");
    vLbl.textContent = o.vol + "٪";
    var vR = range(20, 100, o.vol, 1);
    vR.addEventListener("input", function () { o.vol = +vR.value; vLbl.textContent = o.vol + "٪"; });
    left.appendChild(ctrl("بلندی", vR, vLbl));

    left.appendChild(ctrl("لایه‌ها", seg([
      { v: "sparkle", label: "درخشش" },
      { v: "air", label: "نفس فضا" },
      { v: "beat", label: "کوبه" }
    ], "sparkle", function (v) {
      o[v] = !o[v];
    })));

    var acts = el('<div class="studio-actions"></div>');
    var mk = button("◉ ساختن صدا", "primary");
    var fresh = button("طرح تازه");
    var dl = button("دانلود WAV");
    dl.disabled = true;

    mk.addEventListener("click", function () {
      mk.disabled = true;
      mk.textContent = "در حال ساخت…";
      renderAudio(o).then(function (buf) {
        buildPeaks(buf);
        paint(null);
        lastBlob = encodeWav(buf);
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = URL.createObjectURL(lastBlob);
        player.src = lastUrl;
        dl.disabled = false;
        mk.disabled = false;
        mk.textContent = "◉ ساختن صدا";
        try { player.play(); } catch (e) { }
      }).catch(function () {
        mk.disabled = false;
        mk.textContent = "◉ ساختن صدا";
        alert("مرورگر از موتور صدا پشتیبانی نمی‌کند.");
      });
    });

    fresh.addEventListener("click", function () {
      o.seed = Math.floor(Math.random() * 99999);
      paint(null);
      mk.click();
    });

    dl.addEventListener("click", function () {
      if (lastBlob) saveBlob(lastBlob, "KM-audio-" + Date.now() + ".wav");
    });

    player.addEventListener("timeupdate", function () {
      if (player.duration) paint(player.currentTime / player.duration);
    });

    acts.appendChild(mk); acts.appendChild(fresh); acts.appendChild(dl);
    right.appendChild(acts);
    right.appendChild(note("خروجی <b>WAV ۴۴.۱ کیلوهرتز استریو</b> است و کاملاً داخل مرورگر ساخته می‌شود — بدون سرور و بدون آپلود. هزینه‌ی هر ساخت: <b>۲۰ دولپر توکن</b>."));

    root.appendChild(left); root.appendChild(right);
    paint(null);

    return {
      destroy: function () {
        try { player.pause(); } catch (e) { }
        if (lastUrl) URL.revokeObjectURL(lastUrl);
      }
    };
  }

  /* ================= ثبت ابزارها ================= */

  var TOOLS = {
    image:  { name: "طراحی عکس", code: "IMAGE FORGE", mount: imageTool },
    video:  { name: "طراحی ویدیو", code: "MOTION FORGE", mount: videoTool },
    editimg:{ name: "ادیت عکس", code: "PHOTO LAB", mount: editImageTool },
    editvid:{ name: "ادیت ویدیو", code: "VIDEO LAB", mount: editVideoTool },
    thumb:  { name: "ساخت تامنیل", code: "THUMBNAIL", mount: thumbTool },
    audio:  { name: "تولید صدا", code: "SOUND FORGE", mount: audioTool }
  };

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-tool]");
    if (!b) return;
    var key = b.getAttribute("data-tool");
    if (TOOLS[key]) { e.preventDefault(); openStudio(key); }
  });

  window.KMStudio = { open: openStudio, close: closeStudio };
})();
