/* ============================================
   StockJelli — Blog Sponsor Integration
   blog-sponsor.js
   
   Auto-injects AdSense placements into blog
   articles and the blog index page.
   
   Add to EVERY blog page:
   <script src="/blog-sponsor.js" defer></script>
   
   No need to edit individual article HTML.
   Uses "sponsor" naming — no "ad" in classes.
   ============================================ */

   (function initBlogSponsors() {
    "use strict";
  
    var PUB_ID = "ca-pub-8792646979011381";
  
    // ══════════════════════════════════════════════════════════════
    // BLOG-SPECIFIC SLOT IDS
    // Create 2 more Display units in AdSense:
    //   - sj-blog-mid-article
    //   - sj-blog-before-footer
    // Or reuse your existing slots — up to you.
    // ══════════════════════════════════════════════════════════════
    var SLOTS = {
      midArticle:    "8386105796",  // reusing sj-after-screener slot
      beforeFooter:  "4996690972",  // reusing sj-above-footer slot
    };
  
    // ── Subscriber check ──────────────────────────────────────
    function isSubscriber() {
      return !!localStorage.getItem("sj_subscriber_email");
    }
  
    if (isSubscriber()) {
      document.body.classList.add("sj-subscriber");
      return;
    }
  
    // ── Helpers ────────────────────────────────────────────────
    function createInsElement(slotId, format) {
      var ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
      ins.setAttribute("data-ad-client", PUB_ID);
      if (slotId) ins.setAttribute("data-ad-slot", slotId);
  
      if (format === "horizontal") {
        ins.setAttribute("data-ad-format", "horizontal");
        ins.setAttribute("data-full-width-responsive", "true");
      } else {
        ins.setAttribute("data-ad-format", "auto");
        ins.setAttribute("data-full-width-responsive", "true");
      }
      return ins;
    }
  
    function pushUnit() {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.log("[SJ Blog] Sponsor push failed:", e.message);
      }
    }
  
    function createSponsorBlock(slotId, format, extraClass) {
      var wrapper = document.createElement("div");
      wrapper.className = "sj-blog-sponsor" + (extraClass ? " " + extraClass : "");
  
      var label = document.createElement("div");
      label.className = "sj-sponsor-label";
      label.textContent = "Sponsored";
      wrapper.appendChild(label);
  
      var ins = createInsElement(slotId, format);
      wrapper.appendChild(ins);
  
      return wrapper;
    }
  
    // ══════════════════════════════════════════════════════════════
    // DETECT PAGE TYPE
    // ══════════════════════════════════════════════════════════════
    var blogBody = document.querySelector(".blog-body");
    var blogIndex = document.querySelector(".blog-index");
  
    // ══════════════════════════════════════════════════════════════
    // ARTICLE PAGES — 2 placements
    //   1. Mid-article: after the 3rd <h2> or halfway through
    //   2. Before footer: after .blog-body ends
    // ══════════════════════════════════════════════════════════════
    if (blogBody) {
      // ── Mid-article placement ─────────────────────────────────
      var headings = blogBody.querySelectorAll("h2");
      var insertAfterEl = null;
  
      if (headings.length >= 3) {
        // Place after the 3rd h2's next sibling paragraph
        insertAfterEl = headings[2];
        // Walk to the next paragraph after this h2
        var next = insertAfterEl.nextElementSibling;
        while (next && next.tagName !== "H2") {
          insertAfterEl = next;
          next = next.nextElementSibling;
          // Stop after first paragraph block after the h2
          if (insertAfterEl.tagName === "P" || insertAfterEl.tagName === "UL") break;
        }
      } else if (headings.length >= 2) {
        // Fewer headings — place after 2nd h2's content
        insertAfterEl = headings[1];
        var next = insertAfterEl.nextElementSibling;
        if (next) insertAfterEl = next;
      }
  
      if (insertAfterEl && SLOTS.midArticle) {
        var midBlock = createSponsorBlock(SLOTS.midArticle, "auto", "sj-blog-sponsor-mid");
        insertAfterEl.parentNode.insertBefore(midBlock, insertAfterEl.nextSibling);
        pushUnit();
      }
  
      // ── Before footer placement (after blog-body) ─────────────
      if (SLOTS.beforeFooter) {
        var footerBlock = createSponsorBlock(SLOTS.beforeFooter, "horizontal", "sj-blog-sponsor-footer");
        blogBody.parentNode.insertBefore(footerBlock, blogBody.nextSibling);
        pushUnit();
      }
    }
  
    // ══════════════════════════════════════════════════════════════
    // BLOG INDEX PAGE — 1 placement between sections
    // ══════════════════════════════════════════════════════════════
    if (blogIndex) {
      // Place after the first .blog-section-divider's grid
      var dividers = blogIndex.querySelectorAll(".blog-section-divider");
      var firstGrid = blogIndex.querySelector(".blog-index-grid");
  
      if (firstGrid && SLOTS.beforeFooter) {
        var indexBlock = createSponsorBlock(SLOTS.beforeFooter, "horizontal", "sj-blog-sponsor-index");
        firstGrid.parentNode.insertBefore(indexBlock, firstGrid.nextSibling);
        pushUnit();
      }
    }
  
    // ══════════════════════════════════════════════════════════════
    // CLEANUP: Hide empties after 5s
    // ══════════════════════════════════════════════════════════════
    setTimeout(function() {
      document.querySelectorAll(".sj-blog-sponsor").forEach(function(unit) {
        var ins = unit.querySelector("ins.adsbygoogle");
        if (ins && ins.getBoundingClientRect().height === 0) {
          unit.style.display = "none";
        }
      });
    }, 5000);
  
    console.log("[SJ Blog] Sponsor units initialized");
  })();