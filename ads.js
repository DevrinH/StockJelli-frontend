/* ============================================
   StockJelli — Google AdSense Integration
   
   - Tasteful ad placements (not aggressive)
   - Ad-free for subscribers (checks localStorage)
   - Responsive: different sizes desktop vs mobile
   - Respects ad blockers gracefully
   
   Load AFTER app.js (defer)
   ============================================ */

   (function initStockJelliAds() {
    "use strict";
  
    // ── CONFIG ──────────────────────────────────────────────────────────────────
    const ADSENSE_PUB = "ca-pub-8792646979011381";
  
    // ── SUBSCRIBER CHECK ───────────────────────────────────────────────────────
    // If user is a verified subscriber, skip ALL ads
    function isSubscriber() {
      return !!localStorage.getItem("sj_subscriber_email");
    }
  
    if (isSubscriber()) {
      console.log("[StockJelli Ads] Subscriber detected — ads disabled.");
      // Add body class so CSS can also hide any ad containers
      document.body.classList.add("sj-subscriber");
      return; // Exit entirely, no ads injected
    }
  
    // ── HELPERS ─────────────────────────────────────────────────────────────────
  
    /**
     * Create an ad container with proper AdSense markup
     * @param {string} slotId - Your AdSense ad slot ID
     * @param {string} format - 'auto', 'horizontal', 'rectangle', 'fluid'
     * @param {object} opts - { className, style, responsive }
     */
    function createAdUnit(slotId, format, opts = {}) {
      const wrapper = document.createElement("div");
      wrapper.className = `sj-ad-unit ${opts.className || ""}`.trim();
      wrapper.setAttribute("data-ad-slot", slotId);
  
      // Label
      const label = document.createElement("div");
      label.className = "sj-ad-label";
      label.textContent = "Advertisement";
      wrapper.appendChild(label);
  
      // AdSense ins element
      const ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
  
      if (opts.style) {
        Object.assign(ins.style, opts.style);
      }
  
      ins.setAttribute("data-ad-client", ADSENSE_PUB);
      ins.setAttribute("data-ad-slot", slotId);
  
      if (format === "auto") {
        ins.setAttribute("data-ad-format", "auto");
        ins.setAttribute("data-full-width-responsive", "true");
      } else if (format === "horizontal") {
        ins.setAttribute("data-ad-format", "horizontal");
        ins.setAttribute("data-full-width-responsive", "true");
      } else if (format === "fluid") {
        ins.setAttribute("data-ad-format", "fluid");
        ins.setAttribute("data-ad-layout-key", "-fb+5w+4e-db+86");
      } else if (format === "rectangle") {
        ins.setAttribute("data-ad-format", "rectangle");
      }
  
      wrapper.appendChild(ins);
  
      return wrapper;
    }
  
    /**
     * Push ad to AdSense after inserting into DOM
     */
    function pushAd(wrapper) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        // Ad blocker or AdSense not loaded — fail silently
        console.log("[StockJelli Ads] AdSense push failed (ad blocker?):", e.message);
        // Hide the wrapper so there's no empty space
        if (wrapper) wrapper.style.display = "none";
      }
    }
  
    /**
     * Insert ad unit after a target element
     */
    function insertAfter(targetEl, adWrapper) {
      if (!targetEl || !adWrapper) return false;
      targetEl.parentNode.insertBefore(adWrapper, targetEl.nextSibling);
      return true;
    }
  
    /**
     * Insert ad unit before a target element
     */
    function insertBefore(targetEl, adWrapper) {
      if (!targetEl || !adWrapper) return false;
      targetEl.parentNode.insertBefore(adWrapper, targetEl);
      return true;
    }
  
    // ── AD PLACEMENTS ──────────────────────────────────────────────────────────
    // Tasteful, non-intrusive placements:
    //
    // 1. BELOW INLINE ALERT CTA (after screener table area)
    //    - Desktop: Leaderboard (728x90) or responsive
    //    - Mobile: Mobile banner (320x100) or responsive
    //
    // 2. BETWEEN MOMENTUM RIVER AND MARKET PULSE
    //    - Desktop: In-article responsive
    //    - Mobile: Smaller responsive unit
    //
    // 3. ABOVE FOOTER (after social section)
    //    - Both: Responsive horizontal
    //
    // Mobile: We skip placement #2 to avoid ad overload on small screens
  
    const isMobile = window.innerWidth <= 768;
  
    // ── PLACEMENT 1: After the inline alert CTA / Yesterday section ─────────
    (function placeAfterScreener() {
      // Try to place after yesterday section, or after inline alert CTA
      const anchor =
        document.getElementById("yesterdaySection") ||
        document.getElementById("inlineAlertCta");
  
      if (!anchor) return;
  
      const ad = createAdUnit(
        "auto", // Use "auto" slot — replace with your actual slot ID once assigned
        "auto",
        {
          className: "sj-ad-after-screener",
        }
      );
  
      insertAfter(anchor, ad);
      pushAd(ad);
    })();
  
    // ── PLACEMENT 2: Between Momentum River and Market Pulse (desktop only) ──
    if (!isMobile) {
      (function placeBetweenSections() {
        const marketPulse = document.getElementById("marketRegime");
        if (!marketPulse) return;
  
        const ad = createAdUnit(
          "auto",
          "horizontal",
          {
            className: "sj-ad-between-sections",
          }
        );
  
        insertBefore(marketPulse, ad);
        pushAd(ad);
      })();
    }
  
    // ── PLACEMENT 3: Above footer / after social section ────────────────────
    (function placeAboveFooter() {
      const footer = document.querySelector("footer.footer");
      if (!footer) return;
  
      const ad = createAdUnit(
        "auto",
        "auto",
        {
          className: "sj-ad-above-footer",
        }
      );
  
      insertBefore(footer, ad);
      pushAd(ad);
    })();
  
    // ── HANDLE SUBSCRIBER LOGIN/LOGOUT ─────────────────────────────────────
    // Listen for subscriber verification (from SJ unlock modal)
    // If they become a subscriber mid-session, remove ads immediately
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
      origSetItem(key, value);
      if (key === "sj_subscriber_email" && value) {
        removeAllAds();
      }
    };
  
    function removeAllAds() {
      document.querySelectorAll(".sj-ad-unit").forEach(el => {
        el.style.transition = "opacity 0.3s ease, max-height 0.3s ease";
        el.style.opacity = "0";
        el.style.maxHeight = "0";
        el.style.overflow = "hidden";
        el.style.margin = "0";
        el.style.padding = "0";
        setTimeout(() => el.remove(), 350);
      });
      document.body.classList.add("sj-subscriber");
      console.log("[StockJelli Ads] Subscriber verified — ads removed.");
    }
  
    // ── AD BLOCKER DETECTION (soft) ────────────────────────────────────────
    // Don't nag — just log and clean up empty containers after a delay
    setTimeout(() => {
      document.querySelectorAll(".sj-ad-unit").forEach(unit => {
        const ins = unit.querySelector("ins.adsbygoogle");
        if (ins) {
          const rect = ins.getBoundingClientRect();
          // If the ad unit has no height, AdSense didn't fill it
          if (rect.height === 0) {
            unit.style.display = "none";
          }
        }
      });
    }, 4000);
  
    console.log("[StockJelli Ads] Initialized —", isMobile ? "mobile" : "desktop", "layout.");
  
  })();