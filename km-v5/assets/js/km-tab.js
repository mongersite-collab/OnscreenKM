/* ONSCREENKM — تب فضایی: فاویکان متحرک + تایتل انیمیشنی */
(function () {
  "use strict";

  var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BRAND = "OnscreenKM";

  /* ---------------- فاویکان متحرک ---------------- */
  var link = document.getElementById("kmFavicon");
  if (!link) {
    link = document.createElement("link");
    link.id = "kmFavicon";
    link.rel = "icon";
    link.type = "image/png";
    document.head.appendChild(link);
  }

  var S = 64;
  var cv = document.createElement("canvas");
  cv.width = S; cv.height = S;
  var g = cv.getContext("2d");

  var mark = new Image();
  var markReady = false;
  mark.onload = function () { markReady = true; };
  mark.onerror = function () { markReady = false; };
  mark.src = "assets/media/km-mark.png";

  /* ستاره‌های ثابت دور لوگو */
  var STARS = [];
  for (var i = 0; i < 14; i++) {
    var a = Math.random() * Math.PI * 2;
    var r = 24 + Math.random() * 7;
    STARS.push({
      x: S / 2 + Math.cos(a) * r,
      y: S / 2 + Math.sin(a) * r,
      s: Math.random() * 1.1 + .4,
      p: Math.random() * Math.PI * 2,
      v: .04 + Math.random() * .06
    });
  }

  function draw(t) {
    g.clearRect(0, 0, S, S);

    /* هاله‌ی فضایی */
    var pulse = .5 + .5 * Math.sin(t * .0024);
    var halo = g.createRadialGradient(S / 2, S / 2, 8, S / 2, S / 2, S / 2);
    halo.addColorStop(0, "rgba(120,90,255," + (.30 + pulse * .22) + ")");
    halo.addColorStop(1, "rgba(5,5,11,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, S, S);

    /* ستاره‌های چشمک‌زن */
    for (var i = 0; i < STARS.length; i++) {
      var st = STARS[i];
      var tw = .35 + .65 * Math.abs(Math.sin(t * .001 * st.v * 12 + st.p));
      g.beginPath();
      g.arc(st.x, st.y, st.s, 0, 6.2832);
      g.fillStyle = "rgba(210,230,255," + tw * .9 + ")";
      g.fill();
    }

    /* لوگوی دایره‌ای وسط */
    var R = 23;
    g.save();
    g.beginPath();
    g.arc(S / 2, S / 2, R, 0, 6.2832);
    g.closePath();
    g.clip();
    if (markReady) {
      g.drawImage(mark, S / 2 - R, S / 2 - R, R * 2, R * 2);
    } else {
      var bg = g.createLinearGradient(0, 0, S, S);
      bg.addColorStop(0, "#34b8f5");
      bg.addColorStop(1, "#a855f7");
      g.fillStyle = bg;
      g.fillRect(0, 0, S, S);
      g.fillStyle = "#fff";
      g.font = "bold 26px system-ui,sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("KM", S / 2, S / 2 + 1);
    }
    g.restore();

    /* حلقه‌ی گردان با گرادیان */
    var rot = t * .0016;
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(rot);
    var ring = g.createLinearGradient(-R, -R, R, R);
    ring.addColorStop(0, "rgba(52,184,245,.15)");
    ring.addColorStop(.45, "#34b8f5");
    ring.addColorStop(.75, "#a855f7");
    ring.addColorStop(1, "rgba(168,85,247,.12)");
    g.strokeStyle = ring;
    g.lineWidth = 3.4;
    g.lineCap = "round";
    g.beginPath();
    g.arc(0, 0, R + 3, 0, Math.PI * 1.45);
    g.stroke();
    /* مدارگرد کوچک */
    g.beginPath();
    g.arc(R + 3, 0, 2.6, 0, 6.2832);
    g.fillStyle = "#eaf3ff";
    g.fill();
    g.restore();

    try { link.href = cv.toDataURL("image/png"); } catch (e) {}
  }

  /* ---------------- تایتل انیمیشنی ---------------- */
  var SPARKS = ["\u2726", "\u2727", "\u22c6", "\u2727"];
  var phase = 0;      /* 0=تایپ، 1=مکث، 2=درخشش */
  var idx = 0, hold = 0, spark = 0;

  function tickTitle() {
    if (document.hidden) {
      document.title = SPARKS[spark % SPARKS.length] + " " + BRAND + " \u2014 \u0645\u0646\u062a\u0638\u0631\u062a\u0645";
      spark++;
      return;
    }
    if (phase === 0) {
      idx++;
      document.title = BRAND.slice(0, idx) + (idx < BRAND.length ? "\u2588" : "");
      if (idx >= BRAND.length) { phase = 1; hold = 0; }
    } else if (phase === 1) {
      hold++;
      document.title = BRAND;
      if (hold > 10) { phase = 2; spark = 0; }
    } else {
      document.title = SPARKS[spark % SPARKS.length] + " " + BRAND + " " + SPARKS[spark % SPARKS.length];
      spark++;
      if (spark > 16) { phase = 0; idx = 0; }
    }
  }

  /* ---------------- اجرا ---------------- */
  if (RM) {
    document.title = BRAND;
    mark.complete ? draw(0) : mark.addEventListener("load", function () { draw(0); });
    return;
  }

  document.title = BRAND;

  var t0 = Date.now();
  setInterval(function () { if (!document.hidden) draw(Date.now() - t0); }, 110);
  setInterval(tickTitle, 260);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) { phase = 0; idx = 0; document.title = BRAND; }
  });
})();
