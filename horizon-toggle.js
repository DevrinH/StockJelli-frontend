/* ============================================================
   horizon-toggle.js — self-contained. Add to index.html head:
     <script src="horizon-toggle.js?v=1" defer></script>
   Swing is the DEFAULT and currently the only live horizon.
   Intraday is disabled (no intraday magnitude data yet) — the
   button shows a "soon" tag and can't be selected. When intraday
   data ships, remove `disabled` from the HTML and point the
   intraday branch at intraday views.

   What the toggle drives today:
     swing    → sector board + screener visible (the live surfaces)
     intraday → reserved (disabled, so never reached yet)
   Persists choice to localStorage like the asset toggle does.
============================================================ */
(function () {
    "use strict";
    var ctrl = document.getElementById("horizonControl");
    var note = document.getElementById("horizonNote");
    if (!ctrl) return;
  
    var KEY = "sj_horizon";
    var SWING_NOTE = "Swing · chance of a big move (\u00b15%) over the next ~3 days \u00b7 direction is the sector's lean, not a call on the name";
    var INTRADAY_NOTE = "Intraday continuation \u00b7 +3% clean before \u22122% (coming soon)";
  
    function currentHorizon() {
      try { return localStorage.getItem(KEY) || "swing"; } catch (e) { return "swing"; }
    }
  
    // Surfaces that belong to the SWING view. (Intraday is disabled, so these
    // simply stay visible; when intraday ships, hide swing-only surfaces here.)
    function swingSurfaces() {
      return [
        document.getElementById("sectorBoard"),
        document.getElementById("screener"),
      ].filter(Boolean);
    }
  
    function apply(h) {
      // intraday is disabled — guard against ever switching to it
      if (h !== "swing") h = "swing";
      ctrl.querySelectorAll(".segmented-btn").forEach(function (b) {
        var on = b.dataset.horizon === h && !b.disabled;
        b.classList.toggle("segmented-on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      if (note) note.textContent = h === "swing" ? SWING_NOTE : INTRADAY_NOTE;
  
      // sector board is a SWING surface; respect the asset toggle's crypto-hide.
      var crypto = false;
      try { crypto = (localStorage.getItem("sj_asset_mode") === "crypto"); } catch (e) {}
      swingSurfaces().forEach(function (el) {
        if (el.id === "sectorBoard" && crypto) { el.style.display = "none"; }
      });
  
      try { localStorage.setItem(KEY, h); } catch (e) {}
    }
  
    ctrl.addEventListener("click", function (e) {
      var btn = e.target.closest(".segmented-btn");
      if (!btn || btn.disabled) return;       // intraday is disabled → ignored
      apply(btn.dataset.horizon);
    });
  
    apply(currentHorizon());
  })();