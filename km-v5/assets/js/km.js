/* ONSCREENKM v5 — merged build */
(function () {
  "use strict";
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============ 1. LOADER ============ */
  (function loader() {
    var el = document.getElementById("loader");
    if (!el) return;
    var MIN = RM ? 400 : 2800;
    var start = Date.now();
    var done = false;

    function hide() {
      if (done) return;
      done = true;
      var wait = Math.max(0, MIN - (Date.now() - start));
      setTimeout(function () {
        el.classList.add("hidden");
        $$(".hero-reveal").forEach(function (n) { n.classList.add("in-view"); });
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 800);
      }, wait);
    }

    if (document.readyState === "complete") hide();
    else window.addEventListener("load", hide);
    setTimeout(hide, 3500);
  })();

  /* ============ 2. PARTICLE FIELD ============ */
  (function particles() {
    var c = document.getElementById("fx");
    if (!c || RM) return;
    var ctx = c.getContext("2d");
    var dots = [], mouse = { x: -9999, y: -9999 }, w = 0, h = 0;

    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth; h = window.innerHeight;
      c.style.width = w + "px";
      c.style.height = h + "px";
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.min(46, Math.round(w * h / 34000));
      dots = [];
      for (var i = 0; i < n; i++) {
        dots.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - .5) * .32, vy: (Math.random() - .5) * .32,
          r: Math.random() * 1.5 + .5
        });
      }
    }

    var LINK = 11000, MLINK = 17000, lastFrame = 0;

    function frame(now) {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      if (document.body.classList.contains("km-locked")) return;
      if (now - lastFrame < 32) return;   /* سقف ~۳۰ فریم در ثانیه */
      lastFrame = now;

      ctx.clearRect(0, 0, w, h);

      /* همه‌ی نقطه‌ها در یک مسیر = یک بار fill */
      ctx.beginPath();
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;
        ctx.moveTo(d.x + d.r, d.y);
        ctx.arc(d.x, d.y, d.r, 0, 6.2832);
      }
      ctx.fillStyle = "rgba(150,190,255,.55)";
      ctx.fill();

      /* خطوط در سه دسته‌ی شفافیت = فقط سه بار stroke */
      var b0 = [], b1 = [], b2 = [];
      for (var a = 0; a < dots.length; a++) {
        var p1 = dots[a];
        for (var b = a + 1; b < dots.length; b++) {
          var p2 = dots[b], dx = p1.x - p2.x;
          if (dx > 105 || dx < -105) continue;
          var dy = p1.y - p2.y;
          if (dy > 105 || dy < -105) continue;
          var dist = dx * dx + dy * dy;
          if (dist >= LINK) continue;
          var k = 1 - dist / LINK;
          (k > .66 ? b2 : k > .33 ? b1 : b0).push(p1, p2);
        }
      }
      ctx.lineWidth = 1;
      drawBucket(b0, "rgba(90,140,240,.06)");
      drawBucket(b1, "rgba(90,140,240,.11)");
      drawBucket(b2, "rgba(90,140,240,.17)");

      /* خطوط متصل به موس */
      if (mouse.x > -9000) {
        ctx.beginPath();
        var any = false;
        for (var m = 0; m < dots.length; m++) {
          var q = dots[m], mx = q.x - mouse.x, my = q.y - mouse.y;
          if (mx * mx + my * my >= MLINK) continue;
          ctx.moveTo(q.x, q.y); ctx.lineTo(mouse.x, mouse.y);
          any = true;
        }
        if (any) { ctx.strokeStyle = "rgba(168,85,247,.22)"; ctx.stroke(); }
      }
    }

    function drawBucket(arr, color) {
      if (!arr.length) return;
      ctx.beginPath();
      for (var i = 0; i < arr.length; i += 2) {
        ctx.moveTo(arr[i].x, arr[i].y);
        ctx.lineTo(arr[i + 1].x, arr[i + 1].y);
      }
      ctx.strokeStyle = color;
      ctx.stroke();
    }

    size();
    var rsz;
    window.addEventListener("resize", function () {
      clearTimeout(rsz); rsz = setTimeout(size, 180);
    });
    window.addEventListener("mousemove", function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    window.addEventListener("mouseout", function () { mouse.x = -9999; mouse.y = -9999; }, { passive: true });
    requestAnimationFrame(frame);
  })();

  /* ============ 3. CUSTOM CURSOR ============ */
  (function cursor() {
    var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!fine || RM) return;

    var dot = document.createElement("div"); dot.className = "cur-dot";
    var ring = document.createElement("div"); ring.className = "cur-ring";
    document.body.appendChild(dot); document.body.appendChild(ring);
    document.documentElement.classList.add("km-cursor");

    var tx = -100, ty = -100, rx = -100, ry = -100;
    var HOT = "a,button,[role=button],.chip,.mod-card,.chapter,.tl-item,select,label," +
      ".space-btn,.mini-btn,.seg button,.voice-btn,.studio-close," +
      ".ka-btn,.ka-google,.ka-ghost,.ka-tabs button,.ka-dev-link,.hud-pill,.hud-out";
    var TEXT = "input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true]";

    var lastTarget = null, needHover = false, moved = false;

    document.addEventListener("mousemove", function (e) {
      if (!dot.parentNode) document.body.appendChild(dot);
      if (!ring.parentNode) document.body.appendChild(ring);
      tx = e.clientX; ty = e.clientY;
      moved = true;
      if (e.target !== lastTarget) { lastTarget = e.target; needHover = true; }
    }, { passive: true });
    document.addEventListener("mousedown", function (e) {
      document.documentElement.classList.add("cur-down");
      if (document.hidden) return;
      var r = document.createElement("div");
      r.className = "cur-ripple";
      r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
      document.body.appendChild(r);
      setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 720);
    });
    document.addEventListener("mouseup", function () {
      document.documentElement.classList.remove("cur-down");
    });
    document.addEventListener("mouseleave", function (e) {
      if (e && e.relatedTarget) return;
      dot.classList.add("cur-hidden"); ring.classList.add("cur-hidden");
    });
    document.addEventListener("mouseenter", function () {
      dot.classList.remove("cur-hidden"); ring.classList.remove("cur-hidden");
    });

    (function loop() {
      requestAnimationFrame(loop);
      if (document.hidden) return;

      if (moved) {
        moved = false;
        if (dot.className.indexOf("cur-hidden") > -1) {
          dot.classList.remove("cur-hidden"); ring.classList.remove("cur-hidden");
        }
        dot.style.transform = "translate3d(" + tx + "px," + ty + "px,0)";
      }

      var dx = tx - rx, dy = ty - ry;
      if (dx * dx + dy * dy > .05) {
        rx += dx * .2; ry += dy * .2;
        ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      }

      if (needHover) {
        needHover = false;
        var t = lastTarget, cl = document.documentElement.classList;
        cl.toggle("cur-hot", !!(t && t.closest && t.closest(HOT)));
        cl.toggle("cur-text", !!(t && t.closest && t.closest(TEXT)));
      }
    })();
  })();

  /* ============ 4. SCROLL EFFECTS ============ */
  (function scrollFx() {
    var io = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("in-view"); io.unobserve(en.target); }
        });
      }, { threshold: .12, rootMargin: "0px 0px -60px 0px" });
      $$(".reveal").forEach(function (el) { io.observe(el); });
    } else {
      $$(".reveal").forEach(function (el) { el.classList.add("in-view"); });
    }

    var bar = document.getElementById("progress");
    var nav = document.getElementById("navPill");
    window.addEventListener("scroll", function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? window.scrollY / max : 0;
      if (bar) bar.style.transform = "scaleX(" + p + ")";
      if (nav) nav.classList.toggle("scrolled", window.scrollY > 60);
    }, { passive: true });

    $$("[data-count]").forEach(function (el) {
      var target = parseFloat(el.getAttribute("data-count")) || 0;
      var suffix = el.getAttribute("data-suffix") || "";
      var run = false;
      function animate() {
        if (run) return; run = true;
        var t0 = performance.now(), dur = 1400;
        (function step(now) {
          var k = Math.min(1, (now - t0) / dur);
          var eased = 1 - Math.pow(1 - k, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (k < 1) requestAnimationFrame(step);
        })(t0);
      }
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (e, ob) {
          if (e[0].isIntersecting) { animate(); ob.disconnect(); }
        }, { threshold: .4 }).observe(el);
      } else animate();
    });
  })();

  /* ============ 5. KM CONSOLE (own engine — KMBrain) ============ */
  (function console_() {
    var log = document.getElementById("chatLog");
    var input = document.getElementById("chatInput");
    var btn = document.getElementById("sendBtn");
    var notice = document.getElementById("chatNotice");
    if (!log || !input || !btn) return;

    var busy = false, typing = false, lastSent = 0;
    var COOLDOWN = 900;

    function scroll() { log.scrollTop = log.scrollHeight; }

    function addMessage(role, text, animate) {
      var el = document.createElement("div");
      el.className = "msg " + role;
      log.appendChild(el);
      if (animate) typeOut(el, text);
      else { el.textContent = text; scroll(); }
      return el;
    }

    function typeOut(node, text) {
      typing = true;
      var i = 0;
      var caret = document.createElement("span");
      caret.className = "cursor";
      node.appendChild(caret);
      (function step() {
        if (i <= text.length) {
          caret.remove();
          node.textContent = text.slice(0, i);
          node.appendChild(caret);
          i++;
          scroll();
          setTimeout(step, 14);
        } else {
          caret.remove();
          typing = false;
          setBusy(false);
        }
      })();
    }

    function setBusy(state) {
      busy = state;
      btn.disabled = state;
      input.disabled = state;
      btn.classList.toggle("working", state);
      if (!state) input.focus();
    }

    var noticeTimer = null;
    function flash(msg) {
      if (!notice) return;
      notice.textContent = msg;
      notice.classList.add("show");
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(function () { notice.classList.remove("show"); }, 2200);
    }

    function send() {
      if (busy || typing) {
        flash("KM \u062f\u0627\u0631\u062f \u062c\u0648\u0627\u0628 \u0642\u0628\u0644\u06cc \u0631\u0627 \u0645\u06cc\u200c\u0646\u0648\u06cc\u0633\u062f\u2026");
        return;
      }
      var now = Date.now();
      if (now - lastSent < COOLDOWN) {
        flash("\u06a9\u0645\u06cc \u0622\u0631\u0627\u0645\u200c\u062a\u0631 \u2014 \u06cc\u06a9 \u0644\u062d\u0638\u0647 \u0635\u0628\u0631 \u06a9\u0646.");
        return;
      }
      var q = input.value.trim();
      if (!q) return;

      lastSent = now;
      input.value = "";
      addMessage("user", q, false);
      setBusy(true);

      var answer;
      try {
        answer = window.KMBrain
          ? window.KMBrain.respond(q)
          : "\u0645\u0646 KM \u0647\u0633\u062a\u0645.";
      } catch (e) {
        answer = "\u0645\u0646 KM \u0647\u0633\u062a\u0645 \u2014 \u062f\u0648\u0628\u0627\u0631\u0647 \u0628\u067e\u0631\u0633.";
      }

      var think = 260 + Math.min(700, answer.length * 4);
      setTimeout(function () { addMessage("km", answer, true); }, think);
    }

    btn.addEventListener("click", send);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); send(); }
    });
    $$(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        if (busy || typing) { flash("\u06cc\u06a9 \u0644\u062d\u0638\u0647 \u0635\u0628\u0631 \u06a9\u0646\u2026"); return; }
        input.value = chip.getAttribute("data-q") || chip.textContent;
        send();
      });
    });
  })();
})();
