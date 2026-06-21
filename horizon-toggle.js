/* ============================================================
   horizon-toggle.js — self-contained. Add to index.html head:
     <script src="horizon-toggle.js?v=2" defer></script>

   TWO REAL VIEWS, both live:
     swing    → #swingView  (NEW: sector carousel + magnitude alerts)
     intraday → #intradayView (your EXISTING page — screener/river/pulse,
                untouched, just wrapped in this div)
   TQQQ lives OUTSIDE both views (in #tqqqAlways) so it shows on both.
   Default = swing (the flagship). Choice persisted to sj_horizon.

   WRAP INSTRUCTIONS (index.html):
     • Put <div id="swingView"> … new swing sections … </div>
       right after the hero.
     • Wrap your existing page body (everything from #screener down
       through river/pulse/blog — but NOT the footer/modals) in
       <div id="intradayView"> … </div>.
     • TQQQ monitor markup goes in <div id="tqqqAlways"> above both,
       so it renders regardless of horizon.
============================================================ */
(function () {
    "use strict";
    var ctrl = document.getElementById("horizonControl");
    var note = document.getElementById("horizonNote");
    var swingView = document.getElementById("swingView");
    var intradayView = document.getElementById("intradayView");
    if (!ctrl) return;
  
    var KEY = "sj_horizon";
    var SWING_NOTE = "Swing \u00b7 chance of a big move (\u00b15%) over the next ~3 days \u00b7 direction is the sector's lean, not a call on the name";
    var INTRADAY_NOTE = "Intraday \u00b7 live momentum screener \u00b7 continuation odds on today's movers";
  
    function currentHorizon() {
      try { return localStorage.getItem(KEY) || "swing"; } catch (e) { return "swing"; }
    }
  
    function apply(h) {
      if (h !== "swing" && h !== "intraday") h = "swing";
      ctrl.querySelectorAll(".segmented-btn").forEach(function (b) {
        var on = b.dataset.horizon === h;
        b.classList.toggle("segmented-on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      if (swingView) swingView.style.display = (h === "swing") ? "block" : "none";
      if (intradayView) intradayView.style.display = (h === "intraday") ? "block" : "none";
      if (note) note.textContent = (h === "swing") ? SWING_NOTE : INTRADAY_NOTE;
      try { localStorage.setItem(KEY, h); } catch (e) {}
      // let other scripts react (sector board, screener polling, etc.)
      window.dispatchEvent(new CustomEvent("sj:horizon", { detail: { horizon: h } }));
    }
  
    ctrl.addEventListener("click", function (e) {
      var btn = e.target.closest(".segmented-btn");
      if (!btn) return;
      apply(btn.dataset.horizon);
    });
  
    apply(currentHorizon());
  })();