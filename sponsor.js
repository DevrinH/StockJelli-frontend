/* ============================================
   StockJelli — Sponsor Integration
   sponsor.js — FINAL
   
   All class names use "sponsor" / "partner".
   No class or ID contains the word "ad".
   ============================================ */

   (function initSponsorUnits() {
    "use strict";
  
    // ══════════════════════════════════════════════════════════════
    // YOUR ADSENSE SLOT IDS
    // Create each unit at: Ads → By ad unit → Display ads
    // Paste the data-ad-slot number for each one below.
    // ══════════════════════════════════════════════════════════════
    var SLOTS = {
      railLeft:       "1249017652",  // sj-rail-left
      railRight:      "9823164754",  // sj-rail-right
      afterScreener:  "8386105796",  // sj-after-screener
      aboveFooter:    "4996690972",  // sj-above-footer
    };
  
    var PUB_ID = "ca-pub-8792646979011381";
  
    // ══════════════════════════════════════════════════════════════
    // SUBSCRIBER CHECK — no sponsored content for paying users
    // ══════════════════════════════════════════════════════════════
    function isSubscriber() {
      return !!localStorage.getItem("sj_subscriber_email");
    }
  
    if (isSubscriber()) {
      console.log("[SJ] Subscriber detected — sponsor units skipped");
      document.body.classList.add("sj-subscriber");
      document.querySelectorAll(".sj-partner-fallback").forEach(function(fb) {
        fb.style.display = "";
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
      ins.setAttribute("data-ad-client", PUB_ID);
  
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
  
    function pushUnit() {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.log("[SJ] Sponsor push failed:", e.message);
      }
    }
  
    // ══════════════════════════════════════════════════════════════
    // RAIL UNITS (left + right sidebars)
    // ══════════════════════════════════════════════════════════════
  
    function initRailUnit(containerSelector, slotId) {
      if (!slotId) return; // skip if no slot ID yet
      var container = document.querySelector(containerSelector);
      if (!container) return;
  
      var label = document.createElement("div");
      label.className = "sj-sponsor-label";
      label.textContent = "Sponsored";
      container.appendChild(label);
  
      var ins = createInsElement(slotId, "vertical");
      ins.style.width = "160px";
      ins.style.height = "600px";
      container.appendChild(ins);
      pushUnit();
    }
  
    initRailUnit(".sj-sponsor-rail-left", SLOTS.railLeft);
    initRailUnit(".sj-sponsor-rail-right", SLOTS.railRight);
  
    // ══════════════════════════════════════════════════════════════
    // IN-CONTENT UNITS
    // ══════════════════════════════════════════════════════════════
  
    var isMobile = window.innerWidth <= 768;
  
    // After Screener
    (function () {
      if (!SLOTS.afterScreener) return; // skip if no slot ID yet
      var target = document.getElementById("sponsorAfterScreener");
      if (!target) return;
  
      target.classList.add("sj-sponsor-unit", "sj-sponsor-after-screener");
  
      var label = document.createElement("div");
      label.className = "sj-sponsor-label";
      label.textContent = "Sponsored";
      target.appendChild(label);
  
      var ins = createInsElement(SLOTS.afterScreener, "auto");
      target.appendChild(ins);
      pushUnit();
    })();
  
    // Above Footer (skip on tiny phones)
    (function () {
      if (!SLOTS.aboveFooter) return; // skip if no slot ID yet
      if (window.innerWidth < 480) return;
  
      var target = document.getElementById("sponsorAboveFooter");
      if (!target) return;
  
      target.classList.add("sj-sponsor-unit", "sj-sponsor-above-footer");
  
      var label = document.createElement("div");
      label.className = "sj-sponsor-label";
      label.textContent = "Sponsored";
      target.appendChild(label);
  
      var ins = createInsElement(SLOTS.aboveFooter, "horizontal");
      target.appendChild(ins);
      pushUnit();
    })();
  
    // ══════════════════════════════════════════════════════════════
    // MID-SESSION SUBSCRIBER DETECTION
    // ══════════════════════════════════════════════════════════════
    var _origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
      _origSetItem(key, value);
      if (key === "sj_subscriber_email" && value) {
        removeSponsorUnits();
      }
    };
  
    function removeSponsorUnits() {
      document.querySelectorAll(".sj-sponsor-unit, .sj-sponsor-rail-left, .sj-sponsor-rail-right").forEach(function(el) {
        el.style.transition = "opacity 0.3s ease";
        el.style.opacity = "0";
        setTimeout(function() { el.style.display = "none"; }, 350);
      });
      document.querySelectorAll(".sj-partner-fallback").forEach(function(fb) {
        fb.style.display = "";
      });
      document.body.classList.add("sj-subscriber");
    }
  
    // ══════════════════════════════════════════════════════════════
    // CLEANUP: Hide empty containers after 5s (blocker handling)
    // ══════════════════════════════════════════════════════════════
    setTimeout(function() {
      document.querySelectorAll(".sj-sponsor-unit").forEach(function(unit) {
        var ins = unit.querySelector("ins.adsbygoogle");
        if (ins && ins.getBoundingClientRect().height === 0) {
          unit.style.display = "none";
        }
      });
      [".sj-sponsor-rail-left", ".sj-sponsor-rail-right"].forEach(function(sel) {
        var rail = document.querySelector(sel);
        if (!rail) return;
        var ins = rail.querySelector("ins.adsbygoogle");
        if (ins && ins.getBoundingClientRect().height === 0) {
          rail.style.display = "none";
          var fallback = rail.parentElement.querySelector(".sj-partner-fallback");
          if (fallback) fallback.style.display = "";
        }
      });
    }, 5000);
  
    console.log("[SJ] Sponsor units initialized (" + (isMobile ? "mobile" : "desktop") + ")");
// ══════════════════════════════════════════════════════════════
  // AD-FREE BUTTON → opens subscribe modal
  // ══════════════════════════════════════════════════════════════
  var noClutterBtn = document.getElementById("noClutterBtn");
  if (noClutterBtn) {
    if (isSubscriber()) {
      noClutterBtn.style.display = "none";
    }
    noClutterBtn.addEventListener("click", function() {
      var alertsBtn = document.getElementById("enableAlertsBtn")
                   || document.getElementById("inlineAlertBtn");
      if (alertsBtn) alertsBtn.click();
    });
  }


  })();