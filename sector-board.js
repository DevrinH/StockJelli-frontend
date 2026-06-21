/* ============================================================
   sector-board.js — self-contained. Add to index.html <head>:
     <script src="sector-board.js?v=1" defer></script>
   Renders the Sector Board from /api/sectors. No app.js needed.

   Server already tiers each row (lead / context / quiet) and
   sorts them. This file is pure rendering + the honesty rules:
     • magnitude bar is the headline on every row
     • direction lean shows on lead/context, SUPPRESSED on quiet
     • lead row gets a "moving most" chip
   The board is a STOCKS surface (sectors are equity sectors), so
   it hides on the crypto tab to stay coherent with #assetControl.
============================================================ */
(function () {
    "use strict";
  
    var API = "https://api.stockjelli.com";
    var section = document.getElementById("sectorBoard");
    var body = document.getElementById("sectorBoardBody");
    if (!section || !body) return;
  
    function leanClass(dir) {
      if (dir === "up") return "sb-lean-up";
      if (dir === "down") return "sb-lean-down";
      return "sb-lean-flat";
    }
  
    function renderRow(r) {
      var tier = r.tier || "quiet";
      var mag = r.magnitude || {};
      var lean = r.lean || {};
      var magPct = (mag.status === "ok" && mag.pct != null) ? mag.pct : null;
  
      // bar width: use the resolved pct, else the raw rate if present, else 0
      var rawPct = magPct;
      if (rawPct == null && mag.n && mag.hits != null) {
        rawPct = Math.round((mag.hits / mag.n) * 100);
      }
      var barW = Math.max(0, Math.min(100, rawPct == null ? 0 : rawPct));
  
      var magLabel = magPct != null ? magPct + "%"
        : (rawPct != null ? "~" + rawPct + "%" : "—");
  
      // direction: only on lead/context; quiet rows suppress it entirely
      var leanHtml;
      if (tier === "quiet") {
        leanHtml = '<span class="sb-lean-dim">no edge</span>';
      } else if (lean.status === "ok" && lean.pct != null) {
        var word = lean.dir === "up" ? "up" : lean.dir === "down" ? "down" : "flat";
        leanHtml = '<span class="' + leanClass(lean.dir) + '">leans ' + word +
          ' ' + lean.pct + '%</span>';
      } else {
        leanHtml = '<span class="sb-lean-dim">—</span>';
      }
  
      var chip = tier === "lead" ? '<span class="sb-lead-chip">moving most</span>' : "";
      var nameClass = tier === "quiet" ? "sb-name sb-name-quiet" : "sb-name";
  
      return '' +
        '<div class="sb-row sb-row-' + tier + '">' +
          '<div class="' + nameClass + '">' + r.sector + chip + '</div>' +
          '<div class="sb-bar-wrap">' +
            '<div class="sb-bar-track"><div class="sb-bar-fill" style="width:' + barW + '%"></div></div>' +
            '<span class="sb-bar-pct">' + magLabel + '</span>' +
          '</div>' +
          '<div class="sb-lean">' + leanHtml + '</div>' +
        '</div>';
    }
  
    function render(rows) {
      if (!rows || !rows.length) { section.style.display = "none"; return; }
      body.innerHTML = rows.map(renderRow).join("");
      section.style.display = "";
    }
  
    function load() {
      fetch(API + "/api/sectors", { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (j) { render(j && j.rows ? j.rows : []); })
        .catch(function () { section.style.display = "none"; });
    }
  
    // Show on stocks, hide on crypto — mirror #assetControl.
    function currentMode() {
      try { return localStorage.getItem("sj_asset_mode") || "stocks"; } catch (e) { return "stocks"; }
    }
    function applyModeVisibility() {
      if (currentMode() === "crypto") section.style.display = "none";
      else if (body.children.length) section.style.display = "";
    }
    var ctrl = document.getElementById("assetControl");
    if (ctrl) {
      ctrl.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-value]");
        if (!btn) return;
        setTimeout(applyModeVisibility, 0);
      });
    }
  
    load();
    setInterval(load, 5 * 60 * 1000);   // refresh every 5 min (board is slow-moving)
    if (currentMode() === "crypto") section.style.display = "none";
  })();