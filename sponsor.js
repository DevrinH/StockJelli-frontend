/* ============================================
   StockJelli — Google AdSense Integration
   ads.js — v2 with Rail Ads
   
   SETUP: Replace the slot IDs below with your
   actual AdSense ad unit slot IDs from your
   dashboard. Create 4 "Display" ad units:
     - sj-rail-left
     - sj-rail-right
     - sj-after-screener
     - sj-above-footer
   ============================================ */

   (function initStockJelliAds() {
    "use strict";
  
    // ══════════════════════════════════════════════════════════════
    // PASTE YOUR SLOT IDS HERE (from AdSense dashboard)
    // ══════════════════════════════════════════════════════════════
    const SLOTS = {
      railLeft:       "",  // e.g. "1234567890"
      railRight:      "",  // e.g. "0987654321"
      afterScreener:  "",  // e.g. "1122334455"
      aboveFooter:    "",  // e.g. "5566778899"
    };
  
    const ADSENSE_PUB = "ca-pub-8792646979011381";
  
    // ══════════════════════════════════════════════════════════════
    // SUBSCRIBER CHECK — ad-free for paying users
    // ══════════════════════════════════════════════════════════════
    function isSubscriber() {
      return !!localStorage.getItem("sj_subscriber_email");
    }
  
    if (isSubscriber()) {
      console.log("[SJ Ads] Subscriber — ads disabled");
      document.body.classList.add("sj-subscriber");
      document.querySelectorAll(".sj-ad-rail, .sj-ad-unit").forEach(function(el) {
        el.style.display = "none";
      });
      return;
    }
  
    // ══════════════════════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════════════════════
  
    function createInsElement(slotId, format) {
      var ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
      ins.setAttribute("data-ad-client", ADSENSE_PUB);
  
      if (slotId) {
        ins.setAttribute("data-ad-slot", slotId);
      }
  
      if (format === "auto") {
        ins.setAttribute("data-ad-format", "auto");
        ins.setAttribute("data-full-width-responsive", "true");
      } else if (format === "vertical") {
        ins.setAttribute("data-ad-format", "vertical");
      } else if (format === "horizontal") {
        ins.setAttribute("data-ad-format", "horizontal");
        ins.setAttribute("data-full-width-responsive", "true");
      }
  
      return ins;
    }
  
    function pushAd() {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.log("[SJ Ads] push failed:", e.message);
      }
    }
  
    // ══════════════════════════════════════════════════════════════
    // RAIL ADS (left + right sidebars)
    // HTML containers: .sj-ad-rail-left / .sj-ad-rail-right
    // TradingView banners are hidden; AdSense fills the space.
    // If AdSense is blocked, TradingView fallback shows instead.
    // ══════════════════════════════════════════════════════════════
  
    function initRailAd(containerSelector, slotId) {
      var container = document.querySelector(containerSelector);
      if (!container) return;
  
      var label = document.createElement("div");
      label.className = "sj-ad-label";
      label.textContent = "Advertisement";
      container.appendChild(label);
  
      var ins = createInsElement(slotId, "vertical");
      ins.style.width = "160px";
      ins.style.height = "600px";
      container.appendChild(ins);
      pushAd();
    }
  
    initRailAd(".sj-ad-rail-left", SLOTS.railLeft);
    initRailAd(".sj-ad-rail-right", SLOTS.railRight);
  
    // ══════════════════════════════════════════════════════════════
    // IN-CONTENT ADS
    // ══════════════════════════════════════════════════════════════
  
    var isMobile = window.innerWidth <= 768;
  
    // After Screener table
    (function () {
      var target = document.getElementById("adAfterScreener");
      if (!target) return;
  
      target.classList.add("sj-ad-unit", "sj-ad-after-screener");
  
      var label = document.createElement("div");
      label.className = "sj-ad-label";
      label.textContent = "Advertisement";
      target.appendChild(label);
  
      var ins = createInsElement(SLOTS.afterScreener, "auto");
      target.appendChild(ins);
      pushAd();
    })();
  
    // Above Footer (skip on tiny phones < 480px)
    (function () {
      if (window.innerWidth < 480) return;
  
      var target = document.getElementById("adAboveFooter");
      if (!target) return;
  
      target.classList.add("sj-ad-unit", "sj-ad-above-footer");
  
      var label = document.createElement("div");
      label.className = "sj-ad-label";
      label.textContent = "Advertisement";
      target.appendChild(label);
  
      var ins = createInsElement(SLOTS.aboveFooter, "horizontal");
      target.appendChild(ins);
      pushAd();
    })();
  
    // ══════════════════════════════════════════════════════════════
    // MID-SESSION SUBSCRIBER DETECTION
    // ══════════════════════════════════════════════════════════════
    var _origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
      _origSetItem(key, value);
      if (key === "sj_subscriber_email" && value) {
        removeAllAds();
      }
    };
  
    function removeAllAds() {
      document.querySelectorAll(".sj-ad-unit, .sj-ad-rail-left, .sj-ad-rail-right").forEach(function(el) {
        el.style.transition = "opacity 0.3s ease";
        el.style.opacity = "0";
        setTimeout(function() { el.style.display = "none"; }, 350);
      });
      // Show TradingView fallbacks in rails for subscribers
      document.querySelectorAll(".sj-rail-fallback").forEach(function(fb) {
        fb.style.display = "";
      });
      document.body.classList.add("sj-subscriber");
      console.log("[SJ Ads] Subscriber verified — ads removed");
    }
  
    // ══════════════════════════════════════════════════════════════
    // CLEANUP: Hide empty containers after delay (ad blocker)
    // ══════════════════════════════════════════════════════════════
    setTimeout(function() {
      document.querySelectorAll(".sj-ad-unit").forEach(function(unit) {
        var ins = unit.querySelector("ins.adsbygoogle");
        if (ins && ins.getBoundingClientRect().height === 0) {
          unit.style.display = "none";
        }
      });
      // Check rails — if AdSense didn't fill, show TradingView fallback
      document.querySelectorAll(".sj-ad-rail-left, .sj-ad-rail-right").forEach(function(rail) {
        var ins = rail.querySelector("ins.adsbygoogle");
        if (ins && ins.getBoundingClientRect().height === 0) {
          var fallback = rail.parentElement.querySelector(".sj-rail-fallback");
          if (fallback) {
            rail.style.display = "none";
            fallback.style.display = "";
          }
        }
      });
    }, 5000);
  
    console.log("[SJ Ads] Init (" + (isMobile ? "mobile" : "desktop") + ")");
  })();