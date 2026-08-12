/* ONSCREENKM - قابلیت صوتی: شنیدن (میکروفون) و حرف زدن (صدای KM) */
(function () {
  "use strict";

  var input = document.getElementById("chatInput");
  var sendBtn = document.getElementById("sendBtn");
  var log = document.getElementById("chatLog");
  var row = input && input.parentNode;
  if (!input || !sendBtn || !row) return;

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var TTS = window.speechSynthesis;

  var MIC_IDLE = "\u25C9";
  var MIC_LIVE = "\u25A0";
  var SPK_OFF = "\u266A";
  var SPK_ON = "\u266B";

  var wrap = document.createElement("div");
  wrap.className = "voice-row";

  var micBtn = document.createElement("button");
  micBtn.type = "button";
  micBtn.className = "voice-btn";
  micBtn.id = "micBtn";
  micBtn.title = "با صدا حرف بزن";
  micBtn.setAttribute("aria-label", "ورودی صوتی");
  micBtn.textContent = MIC_IDLE;

  var spkBtn = document.createElement("button");
  spkBtn.type = "button";
  spkBtn.className = "voice-btn";
  spkBtn.id = "spkBtn";
  spkBtn.title = "KM جواب‌ها را بلند بخواند";
  spkBtn.setAttribute("aria-label", "خواندن پاسخ‌ها");
  spkBtn.textContent = SPK_OFF;

  wrap.appendChild(micBtn);
  wrap.appendChild(spkBtn);
  row.appendChild(wrap);

  function notice(msg) {
    var n = document.getElementById("chatNotice");
    if (!n) return;
    n.textContent = msg;
    n.classList.add("show");
    setTimeout(function () { n.classList.remove("show"); }, 2600);
  }

  /* ---------- خواندن پاسخ‌ها ---------- */
  var speakOn = false;

  function pickVoice() {
    if (!TTS) return null;
    var vs = TTS.getVoices() || [];
    var fa = vs.filter(function (v) { return /fa|persian/i.test(v.lang + " " + v.name); })[0];
    var ar = vs.filter(function (v) { return /^ar/i.test(v.lang); })[0];
    return fa || ar || vs[0] || null;
  }

  function speak(text) {
    if (!speakOn || !TTS || !text) return;
    try {
      TTS.cancel();
      var u = new SpeechSynthesisUtterance(text);
      var v = pickVoice();
      if (v) u.voice = v;
      u.lang = (v && v.lang) || "fa-IR";
      u.rate = 1;
      u.pitch = 1.02;
      TTS.speak(u);
    } catch (e) {}
  }

  if (!TTS) {
    spkBtn.disabled = true;
    spkBtn.title = "مرورگر شما خواندن صوتی را پشتیبانی نمی‌کند";
  } else {
    if (TTS.onvoiceschanged !== undefined) TTS.onvoiceschanged = pickVoice;
    spkBtn.addEventListener("click", function () {
      speakOn = !speakOn;
      spkBtn.classList.toggle("on", speakOn);
      spkBtn.textContent = speakOn ? SPK_ON : SPK_OFF;
      if (speakOn) {
        notice("صدای KM روشن شد.");
        speak("سلام، من KM هستم.");
      } else {
        TTS.cancel();
        notice("صدای KM خاموش شد.");
      }
    });
  }

  if (log && "MutationObserver" in window) {
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1 || !n.classList || !n.classList.contains("km")) return;
          var t = 0;
          var timer = setInterval(function () {
            t++;
            if (t > 80) { clearInterval(timer); return; }
            if (!n.querySelector(".cursor")) {
              clearInterval(timer);
              speak(n.textContent.trim());
            }
          }, 120);
        });
      });
    }).observe(log, { childList: true });
  }

  /* ---------- ورودی صوتی ---------- */
  if (!SR) {
    micBtn.disabled = true;
    micBtn.title = "ورودی صوتی در این مرورگر پشتیبانی نمی‌شود (کروم یا اج را امتحان کن)";
    return;
  }

  var rec = new SR();
  rec.lang = "fa-IR";
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  var listening = false;

  function stop() {
    listening = false;
    micBtn.classList.remove("on", "listening");
    micBtn.textContent = MIC_IDLE;
    try { rec.stop(); } catch (e) {}
  }

  micBtn.addEventListener("click", function () {
    if (listening) { stop(); return; }
    try {
      if (TTS) TTS.cancel();
      rec.start();
      listening = true;
      micBtn.classList.add("on", "listening");
      micBtn.textContent = MIC_LIVE;
      notice("گوش می‌دهم... حرف بزن.");
    } catch (e) {
      notice("میکروفون در دسترس نیست.");
    }
  });

  rec.onresult = function (e) {
    var txt = "";
    for (var i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
    input.value = txt.trim();
    if (e.results[e.results.length - 1].isFinal) {
      stop();
      if (input.value) setTimeout(function () { sendBtn.click(); }, 220);
    }
  };

  rec.onerror = function (e) {
    stop();
    notice(e.error === "not-allowed"
      ? "اجازه‌ی میکروفون داده نشد."
      : "صدا گرفته نشد - دوباره امتحان کن.");
  };

  rec.onend = function () { if (listening) stop(); };
})();
