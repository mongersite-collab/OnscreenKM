/* ============================================================
   KM SHOP — خرید دولپر توکن از درگاه اینترنتی (ویپاد)
   - زبانه‌ی شناور وسط سمت راست؛ با هاور پیشنهاد می‌دهد
   - هر دولپر توکن ۱٬۰۰۰ تومان · حداقل خرید ۱۰ توکن، بدون سقف
   ============================================================ */
(function () {
  "use strict";

  var PRICE = 1000;      // \u062a\u0648\u0645\u0627\u0646 \u0628\u0647 \u0627\u0632\u0627\u06cc \u0647\u0631 \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646
  var MIN = 10;
  var GATEWAY = "\u0648\u06cc\u067e\u0627\u062f (Vipad)";
  var SUPPORT = "09928839272";
  var SUPPORT_INTL = "+98 992 883 9272";

  var PACKS = [
    { n: 10, tag: "\u0634\u0631\u0648\u0639" },
    { n: 50, tag: "\u067e\u0631\u0637\u0631\u0641\u062f\u0627\u0631" },
    { n: 150, tag: "\u062d\u0631\u0641\u0647\u200c\u0627\u06cc" },
    { n: 500, tag: "\u0627\u0633\u062a\u0648\u062f\u06cc\u0648\u06cc\u06cc" }
  ];

  var modal, qtyInput, totalBox, stateBox, goBtn;

  function el(h) {
    var d = document.createElement("div");
    d.innerHTML = h.trim();
    return d.firstChild;
  }

  function fa(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u066c");
  }

  function qty() {
    var v = parseInt(qtyInput.value, 10);
    if (isNaN(v) || v < MIN) v = MIN;
    return v;
  }

  function refreshTotal() {
    var v = qty();
    totalBox.innerHTML = "\u062c\u0645\u0639 \u067e\u0631\u062f\u0627\u062e\u062a: <b>" + fa(v * PRICE) +
      " \u062a\u0648\u0645\u0627\u0646</b> \u0628\u0631\u0627\u06cc <b>" + fa(v) + "</b> \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646";
    Array.prototype.forEach.call(modal.querySelectorAll(".pk"), function (p) {
      p.classList.toggle("on", parseInt(p.dataset.n, 10) === v);
    });
  }

  function say(text, kind) {
    stateBox.className = "buy-state " + (kind || "");
    stateBox.innerHTML = text;
  }

  /* ---------------- \u062f\u0631\u06af\u0627\u0647 \u067e\u0631\u062f\u0627\u062e\u062a ---------------- */

  function apiBase() {
    if (location.protocol === "file:") return (window.KM_API_BASE || "http://localhost:4173");
    return "";
  }

  /* \u0631\u0641\u062a\u0646 \u0628\u0647 \u0635\u0641\u062d\u0647\u200c\u06cc \u067e\u0631\u062f\u0627\u062e\u062a */
  function goPay(orderId, amount) {
    var total = amount * PRICE;
    var link = "";
    try { link = (localStorage.getItem("km_pay_link_v1") || "").trim(); } catch (e) { link = ""; }
    if (!link) link = (window.KM_PAY_LINK || "").trim();
    var url;
    if (link) {
      url = link + (link.indexOf("?") > -1 ? "&" : "?") +
        "amount=" + total + "&order=" + encodeURIComponent(orderId);
    } else {
      url = "pay.html?order=" + encodeURIComponent(orderId) +
        "&amount=" + amount + "&total=" + total;
    }
    say("\u062f\u0631 \u062d\u0627\u0644 \u0627\u0646\u062a\u0642\u0627\u0644 \u0628\u0647 \u062f\u0631\u06af\u0627\u0647 \u067e\u0631\u062f\u0627\u062e\u062a\u2026 " +
      '<a href="' + url + '" class="pay-link">\u0627\u06af\u0631 \u062e\u0648\u062f\u06a9\u0627\u0631 \u0628\u0627\u0632 \u0646\u0634\u062f \u0627\u06cc\u0646\u062c\u0627 \u0628\u0632\u0646</a>', "ok");
    setTimeout(function () { window.location.href = url; }, 500);
  }

  function api(path, body) {
    var headers = { "Content-Type": "application/json" };
    var s = window.KMAuth && window.KMAuth.session && window.KMAuth.session();
    if (s) headers["Authorization"] = "Bearer " + s;
    return fetch(apiBase() + path, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json(); });
  }

  function startPayment() {
    var amount = qty();

    if (!window.KMAuth || !window.KMAuth.isLoggedIn || !window.KMAuth.isLoggedIn()) {
      say("\u0627\u0648\u0644 \u0648\u0627\u0631\u062f \u062d\u0633\u0627\u0628\u062a \u0634\u0648 \u062a\u0627 \u062a\u0648\u06a9\u0646\u200c\u0647\u0627 \u0628\u0647 \u062d\u0633\u0627\u0628 \u062e\u0648\u062f\u062a \u0628\u0646\u0634\u06cc\u0646\u062f.", "err");
      return;
    }

    goBtn.disabled = true;
    say("\u062f\u0631 \u062d\u0627\u0644 \u0633\u0627\u062e\u062a \u0641\u0627\u06a9\u062a\u0648\u0631 \u062f\u0631 " + GATEWAY + "\u2026");

    api("/api/pay/create", { amount: amount })
      .then(function (r) {
        goBtn.disabled = false;

        if (!r.ok) {
          say(r.error || "\u0633\u0627\u062e\u062a \u0641\u0627\u06a9\u062a\u0648\u0631 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062f.", "err");
          return;
        }

        if (r.payUrl) {
          say("\u062f\u0631 \u062d\u0627\u0644 \u0627\u0646\u062a\u0642\u0627\u0644 \u0628\u0647 \u062f\u0631\u06af\u0627\u0647 \u067e\u0631\u062f\u0627\u062e\u062a\u2026 " +
            '<a href="' + r.payUrl + '" class="pay-link">\u0644\u06cc\u0646\u06a9 \u062f\u0633\u062a\u06cc</a>', "ok");
          setTimeout(function () { window.location.href = r.payUrl; }, 400);
          return;
        }

        /* \u0641\u0627\u06a9\u062a\u0648\u0631 \u0633\u0627\u062e\u062a\u0647 \u0634\u062f \u0648\u0644\u06cc \u0644\u06cc\u0646\u06a9 \u0646\u06cc\u0627\u0645\u062f */
        goPay(r.orderId, amount);
        return;

        /* \u062f\u0631\u06af\u0627\u0647 \u0647\u0646\u0648\u0632 \u0641\u0639\u0627\u0644 \u0646\u0634\u062f\u0647 (\u06a9\u0644\u06cc\u062f \u0648\u06cc\u067e\u0627\u062f \u062f\u0631 .env \u062b\u0628\u062a \u0646\u0634\u062f\u0647) */
        say("\u0634\u0645\u0627\u0631\u0647\u200c\u06cc \u0641\u0627\u06a9\u062a\u0648\u0631: <b>" + r.orderId + "</b><br>" +
          (r.notice || "") +
          "<br>\u0628\u0631\u0627\u06cc \u067e\u06cc\u06af\u06cc\u0631\u06cc \u0647\u0645\u06cc\u0646 \u0634\u0645\u0627\u0631\u0647\u200c\u06cc \u0641\u0627\u06a9\u062a\u0648\u0631 \u0631\u0627 \u0628\u0641\u0631\u0633\u062a.", "ok");
      })
      .catch(function () {
        goBtn.disabled = false;
        offlineOrder(amount);
      });
  }

  /* ---------------- \u0645\u062f\u0627\u0644 ---------------- */

  /* \u0648\u0642\u062a\u06cc \u0633\u0631\u0648\u0631 \u0627\u0645\u0646\u06cc\u062a\u06cc \u0631\u0648\u0634\u0646 \u0646\u06cc\u0633\u062a: \u0641\u0627\u06a9\u062a\u0648\u0631 \u062f\u0633\u062a\u06cc \u0628\u0627 \u0634\u0645\u0627\u0631\u0647\u200c\u06cc \u067e\u06cc\u06af\u06cc\u0631\u06cc */
  function offlineOrder(amount) {
    var id = "KM-OFF-" + Date.now().toString(36).toUpperCase();
    try {
      var k = "km_orders_v1";
      var list = JSON.parse(localStorage.getItem(k) || "[]");
      list.push({ id: id, amount: amount, total: amount * PRICE, at: Date.now(), status: "awaiting" });
      localStorage.setItem(k, JSON.stringify(list.slice(-30)));
    } catch (e) { }

    goPay(id, amount);
    if (false) say("\u0633\u0631\u0648\u0631 \u067e\u0631\u062f\u0627\u062e\u062a \u0631\u0648\u0634\u0646 \u0646\u06cc\u0633\u062a\u060c \u0627\u0645\u0627 \u0641\u0627\u06a9\u062a\u0648\u0631\u062a \u062b\u0628\u062a \u0634\u062f \u2713<br>" +
      "\u0634\u0645\u0627\u0631\u0647\u200c\u06cc \u067e\u06cc\u06af\u06cc\u0631\u06cc: <b>" + id + "</b><br>" +
      "\u0645\u0628\u0644\u063a: <b>" + fa(amount * PRICE) + " \u062a\u0648\u0645\u0627\u0646</b> \u0628\u0631\u0627\u06cc " + fa(amount) + " \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646<br>" +
      "\u0628\u0631\u0627\u06cc \u067e\u0631\u062f\u0627\u062e\u062a \u0622\u0646\u0644\u0627\u06cc\u0646\u060c \u0633\u0631\u0648\u0631 \u0631\u0627 \u0628\u0627 \u062f\u0633\u062a\u0648\u0631 <code>node server/server.js</code> \u0627\u062c\u0631\u0627 \u06a9\u0646 \u06cc\u0627 \u0647\u0645\u06cc\u0646 \u0634\u0645\u0627\u0631\u0647\u200c\u06cc \u067e\u06cc\u06af\u06cc\u0631\u06cc \u0631\u0627 \u0628\u0631\u0627\u06cc \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc \u0628\u0641\u0631\u0633\u062a.", "ok");
  }

  function build() {
    modal = el('<div class="km-modal" id="kmShop" role="dialog" aria-modal="true"></div>');

    var packs = "";
    PACKS.forEach(function (p) {
      packs += '<div class="pk" data-n="' + p.n + '">' +
        '<b>' + fa(p.n) + '</b>' +
        '<span>\u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646</span>' +
        '<i>' + fa(p.n * PRICE) + ' \u062a\u0648\u0645\u0627\u0646 \u00b7 ' + p.tag + '</i>' +
        '</div>';
    });

    var win = el('<div class="km-win">' +
      '<button class="km-x" aria-label="\u0628\u0633\u062a\u0646">\u2715</button>' +
      '<h3>\u2726 \u062e\u0631\u06cc\u062f \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646</h3>' +
      '<p class="km-sub">\u0647\u0631 \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646 <b>' + fa(PRICE) + ' \u062a\u0648\u0645\u0627\u0646</b> \u00b7 \u062d\u062f\u0627\u0642\u0644 \u062e\u0631\u06cc\u062f <b>' + MIN + '</b> \u062a\u0648\u06a9\u0646\u060c \u0633\u0642\u0641 \u062e\u0631\u06cc\u062f <b>\u0628\u06cc\u200c\u0646\u0647\u0627\u06cc\u062a</b>.</p>' +
      '<div class="gw-badge">\u25c9 \u062f\u0631\u06af\u0627\u0647 \u067e\u0631\u062f\u0627\u062e\u062a: ' + GATEWAY + '</div>' +
      '<div class="pk-grid">' + packs + '</div>' +
      '<div class="buy-row">' +
      '<div class="fld"><label>\u062a\u0639\u062f\u0627\u062f \u062f\u0644\u062e\u0648\u0627\u0647 (\u0627\u0632 ' + MIN + ' \u062a\u0627 \u0628\u06cc\u200c\u0646\u0647\u0627\u06cc\u062a)</label>' +
      '<input type="number" id="kmQty" min="' + MIN + '" step="1" value="50"></div>' +
      '</div>' +
      '<div class="buy-total"></div>' +
      '<button class="buy-go">\u067e\u0631\u062f\u0627\u062e\u062a \u0627\u0645\u0646 \u0648 \u062f\u0631\u06cc\u0627\u0641\u062a \u062a\u0648\u06a9\u0646</button>' +
      '<div class="buy-state"></div>' +
      '<div class="buy-note">' +
      '\u0627\u06af\u0631 \u0645\u0634\u06a9\u0644\u06cc \u0628\u0631\u0627\u06cc \u062e\u0631\u06cc\u062f \u062a\u0648\u06a9\u0646 \u0634\u0645\u0627 \u0627\u06cc\u062c\u0627\u062f \u0634\u062f\u060c \u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u06cc\u062f \u0628\u0647 \u0634\u0645\u0627\u0631\u0647\u200c\u06cc <b>' + SUPPORT + '</b> \u062f\u0631 \u0627\u06cc\u0631\u0627\u0646 \u0628\u0627 \u067e\u0633\u0648\u0646\u062f <b>' + SUPPORT_INTL + '</b>\u060c \u06cc\u0627 \u0628\u0647 \u0647\u0645\u06cc\u0646 \u062d\u0633\u0627\u0628 \u062f\u0631 \u062a\u0645\u0627\u0645\u06cc \u067e\u06cc\u0627\u0645\u200c\u0631\u0633\u0627\u0646\u200c\u0647\u0627 (\u0648\u0627\u062a\u0633\u200c\u0627\u067e \u00b7 \u062a\u0644\u06af\u0631\u0627\u0645 \u00b7 \u0627\u06cc\u062a\u0627 \u00b7 \u0628\u0644\u0647 \u00b7 \u0631\u0648\u0628\u06cc\u06a9\u0627) \u0645\u0631\u0627\u062c\u0639\u0647 \u0648 \u067e\u06cc\u06af\u06cc\u0631\u06cc \u06a9\u0646\u06cc\u062f.' +
      '</div>' +
      '</div>');

    modal.appendChild(win);
    document.body.appendChild(modal);

    qtyInput = win.querySelector("#kmQty");
    totalBox = win.querySelector(".buy-total");
    stateBox = win.querySelector(".buy-state");
    goBtn = win.querySelector(".buy-go");

    win.querySelector(".km-x").addEventListener("click", close);
    modal.addEventListener("click", function (e) { if (e.target === modal) close(); });
    qtyInput.addEventListener("input", refreshTotal);
    qtyInput.addEventListener("change", function () {
      qtyInput.value = qty();
      refreshTotal();
    });
    Array.prototype.forEach.call(win.querySelectorAll(".pk"), function (p) {
      p.addEventListener("click", function () {
        qtyInput.value = p.dataset.n;
        refreshTotal();
      });
    });
    goBtn.addEventListener("click", startPayment);

    refreshTotal();
  }

  function open(preset) {
    try {
      if (!modal || !document.body.contains(modal)) { modal = null; build(); }
      if (preset) { qtyInput.value = preset; refreshTotal(); }
      /* \u0647\u0645\u06cc\u0634\u0647 \u0631\u0648\u06cc \u0647\u0645\u0647\u200c\u06cc \u0644\u0627\u06cc\u0647\u200c\u0647\u0627 (\u062d\u062a\u06cc \u0635\u0641\u062d\u0647\u200c\u06cc \u0648\u0631\u0648\u062f \u0648 \u0627\u0633\u062a\u0648\u062f\u06cc\u0648) */
      modal.style.zIndex = "13500";
      modal.classList.add("open");
      var t = document.getElementById("kmShopTab");
      if (t) t.classList.remove("open");
      if (qtyInput) { try { qtyInput.focus(); } catch (e2) { } }
    } catch (err) {
      if (window.console) console.error("[KMShop] open failed:", err);
    }
  }

  function close() { if (modal) modal.classList.remove("open"); }

  /* ---------------- \u0632\u0628\u0627\u0646\u0647\u200c\u06cc \u0634\u0646\u0627\u0648\u0631 ---------------- */

  function buildTab() {
    var tab = el('<div id="kmShopTab" tabindex="0" role="button" aria-label="\u062e\u0631\u06cc\u062f \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646">' +
      '<div class="st-pop">' +
      '<h4>\u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646 \u06a9\u0645 \u062f\u0627\u0631\u06cc\u061f</h4>' +
      '<p>\u0647\u0631 \u062a\u0648\u06a9\u0646 <span class="st-price">' + fa(PRICE) + ' \u062a\u0648\u0645\u0627\u0646</span> \u00b7 \u0627\u0632 ' + MIN + ' \u062a\u0627 \u0628\u06cc\u200c\u0646\u0647\u0627\u06cc\u062a.<br>' +
      '\u067e\u0631\u062f\u0627\u062e\u062a \u0627\u0645\u0646 \u0627\u0632 \u062f\u0631\u06af\u0627\u0647 ' + GATEWAY + ' \u2014 \u062a\u0648\u06a9\u0646\u200c\u0647\u0627 \u0628\u0644\u0627\u0641\u0627\u0635\u0644\u0647 \u0628\u0647 \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646 \u062f\u0648\u0646 \u0627\u0636\u0627\u0641\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f.</p>' +
      '<button class="st-go">\u062e\u0631\u06cc\u062f \u062a\u0648\u06a9\u0646</button>' +
      '</div>' +
      '<div class="st-edge"><span class="st-orb"></span>\u062e\u0631\u06cc\u062f \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646</div>' +
      '</div>');

    tab.querySelector(".st-go").addEventListener("click", function (e) {
      e.stopPropagation();
      open();
    });
    tab.querySelector(".st-edge").addEventListener("click", function (e) {
      e.stopPropagation();
      /* \u0628\u0627\u0631 \u0627\u0648\u0644: \u06a9\u0634\u0648 \u0628\u0627\u0632 \u0645\u06cc\u200c\u0634\u0648\u062f \u00b7 \u0628\u0627\u0631 \u062f\u0648\u0645: \u067e\u0646\u062c\u0631\u0647\u200c\u06cc \u062e\u0631\u06cc\u062f */
      if (tab.classList.contains("open")) { open(); return; }
      tab.classList.add("open");
    });
    /* \u0645\u0633\u06cc\u0631 \u06a9\u0645\u06a9\u06cc: \u0647\u0631 \u062c\u0627\u06cc \u0633\u0627\u06cc\u062a \u0628\u0627 data-km-buy \u067e\u0646\u062c\u0631\u0647\u200c\u06cc \u062e\u0631\u06cc\u062f \u0631\u0627 \u0628\u0627\u0632 \u0645\u06cc\u200c\u06a9\u0646\u062f */
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-km-buy]");
      if (!b) return;
      e.preventDefault();
      open(b.getAttribute("data-km-buy") || null);
    });
    document.addEventListener("click", function (e) {
      if (!tab.contains(e.target)) tab.classList.remove("open");
    });
    tab.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });

    document.body.appendChild(tab);
  }

  /* ---------------- \u0628\u0627\u0632\u06af\u0634\u062a \u0627\u0632 \u062f\u0631\u06af\u0627\u0647 ---------------- */

  function checkReturn() {
    var q = new URLSearchParams(window.location.search);
    var order = q.get("order") || q.get("orderId");
    if (!order) return;

    api("/api/pay/verify", { orderId: order, token: q.get("token") || "", status: q.get("status") || "" })
      .then(function (r) {
        if (r.ok) {
          if (window.KMAuth && window.KMAuth.setTokens) window.KMAuth.setTokens(r.tokens);
          if (window.KMAuth && window.KMAuth.toast) {
            window.KMAuth.toast("+" + r.added + " \u062f\u0648\u0644\u067e\u0631 \u062a\u0648\u06a9\u0646 \u062e\u0631\u06cc\u062f\u0627\u0631\u06cc \u0634\u062f \u2726");
          }
        } else if (window.KMAuth && window.KMAuth.toast) {
          window.KMAuth.toast(r.error || "\u067e\u0631\u062f\u0627\u062e\u062a \u062a\u0627\u06cc\u06cc\u062f \u0646\u0634\u062f.", true);
        }
        history.replaceState({}, "", window.location.pathname);
      })
      .catch(function () { });
  }

  function init() {
    buildTab();
    setTimeout(checkReturn, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.KMShop = { open: open, close: close, price: PRICE, min: MIN };
})();
