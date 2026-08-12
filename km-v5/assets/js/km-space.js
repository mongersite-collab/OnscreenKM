/* ============================================================
   KM SPACE — صحنه‌ی کهکشانی سمت راست صفحه‌ی ورود
   فضاپیما از دوردست تند می‌آید ← آرام می‌شود ← نیم‌دور مریخ
   می‌چرخد ← به سمت ما می‌آید ← با دیدن ما لبخند می‌زند
   ============================================================ */
(function () {
  "use strict";

  var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mount(host) {
    if (!host || host.__space) return;
    host.__space = true;

    var cv = document.createElement("canvas");
    cv.className = "ka-space-cv";
    host.appendChild(cv);
    var ctx = cv.getContext("2d");

    var W = 0, H = 0, dpr = 1;
    var stars = [], dust = [], trail = [];

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = host.clientWidth || 520;
      H = host.clientHeight || 620;
      cv.style.width = W + "px";
      cv.style.height = H + "px";
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      stars = [];
      var n = Math.min(120, Math.round(W * H / 5200));
      for (var i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          r: Math.random() * 1.3 + .25,
          a: Math.random() * .7 + .25,
          s: Math.random() * .9 + .25,
          tw: Math.random() * 6.28
        });
      }
      dust = [];
      for (var j = 0; j < 26; j++) {
        dust.push({
          x: Math.random() * W, y: Math.random() * H,
          r: Math.random() * 2.4 + .8,
          a: Math.random() * .25 + .05,
          vy: -(Math.random() * .16 + .04),
          vx: (Math.random() - .5) * .1
        });
      }
    }

    /* ---------- \u0645\u0631\u06cc\u062e ---------- */
    function mars(cx, cy, R, t) {
      var g = ctx.createRadialGradient(cx - R * .35, cy - R * .38, R * .12, cx, cy, R);
      g.addColorStop(0, "#ff9d5c");
      g.addColorStop(.42, "#e2643a");
      g.addColorStop(.78, "#9c3a20");
      g.addColorStop(1, "#4a1710");

      /* \u0647\u0627\u0644\u0647 */
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      var halo = ctx.createRadialGradient(cx, cy, R * .92, cx, cy, R * 1.75);
      halo.addColorStop(0, "rgba(255,140,80,.28)");
      halo.addColorStop(1, "rgba(255,120,60,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.75, 0, 6.2832);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 6.2832);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.clip();

      /* \u06af\u0648\u062f\u0627\u0644\u200c\u0647\u0627 \u0648 \u0644\u06a9\u0647\u200c\u0647\u0627\u06cc \u0633\u0637\u062d */
      var spots = [
        [-.32, -.18, .20], [.18, -.34, .13], [.34, .12, .22],
        [-.12, .34, .16], [.02, -.06, .10], [-.46, .16, .11]
      ];
      for (var i = 0; i < spots.length; i++) {
        var s = spots[i];
        var a = (t * .06 + i) % 6.2832;
        var ox = Math.cos(a) * .06;
        ctx.beginPath();
        ctx.fillStyle = i % 2 ? "rgba(90,30,18,.34)" : "rgba(255,190,140,.16)";
        ctx.arc(cx + (s[0] + ox) * R, cy + s[1] * R, s[2] * R, 0, 6.2832);
        ctx.fill();
      }

      /* \u06a9\u0644\u0627\u0647\u06a9 \u0642\u0637\u0628\u06cc */
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,240,230,.5)";
      ctx.ellipse(cx - R * .08, cy - R * .86, R * .34, R * .16, 0, 0, 6.2832);
      ctx.fill();

      /* \u0633\u0627\u06cc\u0647\u200c\u06cc \u0634\u0628 */
      var sh = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      sh.addColorStop(0, "rgba(0,0,0,0)");
      sh.addColorStop(.55, "rgba(0,0,0,.18)");
      sh.addColorStop(1, "rgba(0,0,0,.72)");
      ctx.fillStyle = sh;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
    }

    /* ---------- \u0641\u0636\u0627\u067e\u06cc\u0645\u0627 ---------- */
    function ship(x, y, sc, rot, smile, engine) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(sc, sc);

      /* \u0634\u0639\u0644\u0647\u200c\u06cc \u0645\u0648\u062a\u0648\u0631 */
      if (engine > .02) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        var fl = ctx.createLinearGradient(-34, 0, -34 - 90 * engine, 0);
        fl.addColorStop(0, "rgba(120,220,255,.95)");
        fl.addColorStop(.4, "rgba(80,140,255,.5)");
        fl.addColorStop(1, "rgba(120,60,255,0)");
        ctx.fillStyle = fl;
        ctx.beginPath();
        ctx.moveTo(-30, -9);
        ctx.quadraticCurveTo(-34 - 95 * engine, 0, -30, 9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      /* \u062f\u0631\u062e\u0634\u0634 \u0632\u06cc\u0631\u06cc\u0646 */
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      var gl = ctx.createRadialGradient(0, 0, 4, 0, 0, 62);
      gl.addColorStop(0, "rgba(90,180,255,.34)");
      gl.addColorStop(1, "rgba(90,180,255,0)");
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(0, 0, 62, 0, 6.2832);
      ctx.fill();
      ctx.restore();

      /* \u0628\u062f\u0646\u0647 */
      var body = ctx.createLinearGradient(0, -18, 0, 20);
      body.addColorStop(0, "#eaf2ff");
      body.addColorStop(.5, "#9fb4d8");
      body.addColorStop(1, "#3d4b70");
      ctx.beginPath();
      ctx.moveTo(44, 0);
      ctx.quadraticCurveTo(16, -16, -26, -12);
      ctx.quadraticCurveTo(-38, -6, -38, 0);
      ctx.quadraticCurveTo(-38, 6, -26, 12);
      ctx.quadraticCurveTo(16, 16, 44, 0);
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.35)";
      ctx.lineWidth = 1;
      ctx.stroke();

      /* \u0628\u0627\u0644\u200c\u0647\u0627 */
      ctx.beginPath();
      ctx.fillStyle = "rgba(52,184,245,.55)";
      ctx.moveTo(-6, -10);
      ctx.lineTo(-30, -26);
      ctx.lineTo(-20, -8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-6, 10);
      ctx.lineTo(-30, 26);
      ctx.lineTo(-20, 8);
      ctx.closePath();
      ctx.fill();

      /* \u06a9\u0627\u0628\u06cc\u0646 */
      var dome = ctx.createRadialGradient(10, -4, 1, 12, 0, 20);
      dome.addColorStop(0, "rgba(190,240,255,.98)");
      dome.addColorStop(.6, "rgba(70,150,230,.85)");
      dome.addColorStop(1, "rgba(20,40,90,.9)");
      ctx.beginPath();
      ctx.ellipse(12, 0, 17, 11, 0, 0, 6.2832);
      ctx.fillStyle = dome;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.5)";
      ctx.stroke();

      /* \u0686\u0647\u0631\u0647\u200c\u06cc \u062e\u062f\u0645\u0647 \u2014 \u0644\u0628\u062e\u0646\u062f \u0647\u0646\u06af\u0627\u0645 \u062f\u06cc\u062f\u0646 \u0645\u0627 */
      if (smile > .01) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, smile * 1.4);
        ctx.fillStyle = "#06263f";
        var eye = 1.6 + smile * .5;
        ctx.beginPath(); ctx.arc(8, -2.5, eye, 0, 6.2832); ctx.fill();
        ctx.beginPath(); ctx.arc(16, -2.5, eye, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = "#06263f";
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(12, 1.5, 5.4, .18 * Math.PI, (1 - .18) * Math.PI * (0.35 + .65 * smile) + .18);
        ctx.stroke();
        /* \u0628\u0631\u0642 \u0634\u0627\u062f\u06cc */
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(255,255,255," + (.5 * smile) + ")";
        ctx.beginPath(); ctx.arc(6.4, -4.4, 1.1, 0, 6.2832); ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }

    /* ---------- \u0645\u0633\u06cc\u0631 \u062d\u0631\u06a9\u062a ---------- */
    var DUR = 15.5;              // \u0637\u0648\u0644 \u06cc\u06a9 \u062f\u0648\u0631 \u06a9\u0627\u0645\u0644 (\u062b\u0627\u0646\u06cc\u0647)
    var t0 = performance.now();

    function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
    function easeInOut(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }

    function path(tt) {
      var mx = W * .58, my = H * .40, R = Math.min(W, H) * .19;
      var far = { x: W * .94, y: H * .10 };
      var s;

      /* 1) \u0627\u0632 \u062f\u0648\u0631\u062f\u0633\u062a\u060c \u062a\u0646\u062f \u2014 \u0633\u067e\u0633 \u0622\u0631\u0627\u0645 */
      if (tt < 3.6) {
        var p = easeOut(tt / 3.6);
        var ex = mx + Math.cos(-Math.PI / 2) * R * 2.1;
        var ey = my + Math.sin(-Math.PI / 2) * R * 2.1;
        s = {
          x: far.x + (ex - far.x) * p,
          y: far.y + (ey - far.y) * p,
          sc: .06 + .34 * p,
          rot: 2.5 - 2.0 * p,
          engine: 1 - .55 * p,
          smile: 0
        };
        return s;
      }

      /* 2) \u0646\u06cc\u0645\u200c\u062f\u0648\u0631 \u062f\u0648\u0631 \u0645\u0631\u06cc\u062e (\u0642\u0648\u0633) */
      if (tt < 9.2) {
        var q = easeInOut((tt - 3.6) / 5.6);
        var ang = -Math.PI / 2 + Math.PI * q;      // \u0646\u06cc\u0645 \u062f\u0648\u0631 \u06a9\u0627\u0645\u0644
        var rr = R * (2.1 - .35 * Math.sin(Math.PI * q));
        return {
          x: mx + Math.cos(ang) * rr,
          y: my + Math.sin(ang) * rr * .82,
          sc: .40 + .18 * q,
          rot: ang + Math.PI / 2,
          engine: .45 + .25 * Math.sin(Math.PI * q),
          smile: 0
        };
      }

      /* 3) \u0628\u0647 \u0633\u0645\u062a \u0645\u0627 */
      if (tt < 12.4) {
        var k = easeInOut((tt - 9.2) / 3.2);
        var sx = mx + Math.cos(Math.PI / 2) * R * 2.1;
        var sy = my + Math.sin(Math.PI / 2) * R * 2.1 * .82;
        return {
          x: sx + (W * .5 - sx) * k,
          y: sy + (H * .70 - sy) * k,
          sc: .58 + 1.05 * k,
          rot: (Math.PI) * (1 - k) * .12,
          engine: .5 * (1 - k),
          smile: 0
        };
      }

      /* 4) \u0644\u0628\u062e\u0646\u062f \u0648 \u062e\u062f\u0627\u062d\u0627\u0641\u0638\u06cc */
      var f = (tt - 12.4) / (DUR - 12.4);
      var bob = Math.sin(f * 9) * 4;
      return {
        x: W * .5,
        y: H * .70 + bob,
        sc: 1.63 - .12 * f,
        rot: Math.sin(f * 6) * .05,
        engine: .06,
        smile: Math.min(1, f * 3.2) * (f > .82 ? Math.max(0, (1 - f) / .18) : 1)
      };
    }

    /* ---------- \u062d\u0644\u0642\u0647\u200c\u06cc \u062a\u0631\u0633\u06cc\u0645 ---------- */
    var raf = 0, last = 0;

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      if (now - last < 26) return;                 // \u062d\u062f\u0648\u062f \u06f3\u06f8 \u0641\u0631\u06cc\u0645
      last = now;

      var tt = ((now - t0) / 1000) % DUR;
      var s = path(tt);

      /* \u067e\u0633\u200c\u0632\u0645\u06cc\u0646\u0647 */
      var bg = ctx.createRadialGradient(W * .62, H * .34, 10, W * .5, H * .5, Math.max(W, H) * .9);
      bg.addColorStop(0, "#0b1030");
      bg.addColorStop(.55, "#070a1c");
      bg.addColorStop(1, "#04050d");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* \u0633\u062a\u0627\u0631\u0647\u200c\u0647\u0627 */
      var tsec = now / 1000;
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        var a = st.a * (.55 + .45 * Math.sin(tsec * st.s + st.tw));
        ctx.fillStyle = "rgba(210,230,255," + a.toFixed(3) + ")";
        ctx.fillRect(st.x, st.y, st.r, st.r);
      }

      /* \u063a\u0628\u0627\u0631 \u06a9\u0647\u06a9\u0634\u0627\u0646\u06cc */
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var d = 0; d < dust.length; d++) {
        var u = dust[d];
        u.x += u.vx; u.y += u.vy;
        if (u.y < -6) { u.y = H + 6; u.x = Math.random() * W; }
        ctx.fillStyle = "rgba(150,120,255," + u.a + ")";
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.restore();

      /* \u0645\u0631\u06cc\u062e */
      mars(W * .58, H * .40, Math.min(W, H) * .19, tsec);

      /* \u062f\u0646\u0628\u0627\u0644\u0647\u200c\u06cc \u0646\u0648\u0631\u06cc */
      trail.push({ x: s.x, y: s.y, a: .45, r: 2.6 * s.sc });
      if (trail.length > 34) trail.shift();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var k2 = 0; k2 < trail.length; k2++) {
        var tr = trail[k2];
        var fade = (k2 / trail.length);
        ctx.fillStyle = "rgba(90,170,255," + (tr.a * fade * .55).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, tr.r * fade, 0, 6.2832);
        ctx.fill();
      }
      ctx.restore();

      /* \u0641\u0636\u0627\u067e\u06cc\u0645\u0627 */
      ship(s.x, s.y, s.sc, s.rot, s.smile, s.engine);

      /* \u0632\u06cc\u0631\u0646\u0648\u06cc\u0633 \u0645\u0631\u062d\u0644\u0647 */
      if (s.smile > .35) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, s.smile);
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(207,228,255,.9)";
        ctx.font = "600 13px Vazirmatn, system-ui, sans-serif";
        ctx.fillText("\u062e\u0648\u0634 \u0622\u0645\u062f\u06cc \u0628\u0647 OnscreenKM", W * .5, H * .70 + 74);
        ctx.restore();
      }
    }

    size();
    if (RM) {
      /* \u062d\u0627\u0644\u062a \u06a9\u0645\u200c\u062d\u0631\u06a9\u062a: \u0641\u0642\u0637 \u06cc\u06a9 \u0642\u0627\u0628 \u062b\u0627\u0628\u062a */
      var bg2 = ctx.createRadialGradient(W * .6, H * .35, 10, W * .5, H * .5, Math.max(W, H));
      bg2.addColorStop(0, "#0b1030");
      bg2.addColorStop(1, "#04050d");
      ctx.fillStyle = bg2;
      ctx.fillRect(0, 0, W, H);
      mars(W * .58, H * .40, Math.min(W, H) * .19, 0);
      ship(W * .5, H * .70, 1.5, 0, 1, .1);
    } else {
      raf = requestAnimationFrame(frame);
    }

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(size, 180);
    }, { passive: true });

    host.__stop = function () { cancelAnimationFrame(raf); };
  }

  window.KMSpace = { mount: mount };
})();
