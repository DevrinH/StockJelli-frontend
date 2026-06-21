/* ============================================================
   ticker-search.js — self-contained. Add to index.html head:
     <script src="ticker-search.js?v=1" defer></script>
   Loads /api/watchlist once, filters the 300 names client-side,
   routes to /ticker.html?sym=SYMBOL. Keyboard: ↑/↓ to move,
   ↵ to open, Esc to clear.
============================================================ */
(function () {
    "use strict";
    var API = "https://api.stockjelli.com";
    var input = document.getElementById("tickerSearchInput");
    var results = document.getElementById("tickerSearchResults");
    if (!input || !results) return;
  
    var WATCH = [];          // [{symbol, sector, magPct, magDisplay, magStatus}]
    var filtered = [];
    var active = -1;
  
    fetch(API + "/api/watchlist", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) { WATCH = (j && j.rows) ? j.rows : []; })
      .catch(function () { WATCH = []; });
  
    function magBadge(row) {
      if (row.magStatus === "ok" && row.magPct != null) {
        return '<span class="tsr-mag tsr-mag-ok">≈' + row.magPct + '%</span>';
      }
      if (row.magStatus === "count" || row.magStatus === "thin") {
        return '<span class="tsr-mag tsr-mag-build">' + (row.magDisplay || "·") + '</span>';
      }
      return '<span class="tsr-mag tsr-mag-build">—</span>';
    }
  
    function render() {
      if (!filtered.length) { results.style.display = "none"; results.innerHTML = ""; return; }
      results.innerHTML = filtered.map(function (row, i) {
        return '<a class="tsr-row' + (i === active ? " tsr-active" : "") + '" href="/ticker.html?sym=' +
          encodeURIComponent(row.symbol) + '" data-i="' + i + '">' +
          '<span class="tsr-sym">' + row.symbol + '</span>' +
          '<span class="tsr-sector">' + (row.sector || "") + '</span>' +
          magBadge(row) + '</a>';
      }).join("");
      results.style.display = "";
    }
  
    function filter(q) {
      q = q.trim().toUpperCase();
      if (!q) { filtered = []; active = -1; render(); return; }
      // prefix match first, then contains
      var starts = [], contains = [];
      for (var i = 0; i < WATCH.length; i++) {
        var s = WATCH[i].symbol.toUpperCase();
        if (s === q) { starts.unshift(WATCH[i]); }
        else if (s.indexOf(q) === 0) { starts.push(WATCH[i]); }
        else if (s.indexOf(q) > 0) { contains.push(WATCH[i]); }
      }
      filtered = starts.concat(contains).slice(0, 8);
      active = filtered.length ? 0 : -1;
      render();
    }
  
    function go(i) {
      var row = filtered[i];
      if (row) window.location.href = "/ticker.html?sym=" + encodeURIComponent(row.symbol);
    }
  
    input.addEventListener("input", function () { filter(input.value); });
  
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); if (filtered.length) { active = (active + 1) % filtered.length; render(); } }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (filtered.length) { active = (active - 1 + filtered.length) % filtered.length; render(); } }
      else if (e.key === "Enter") { e.preventDefault(); if (active >= 0) go(active); }
      else if (e.key === "Escape") { input.value = ""; filtered = []; active = -1; render(); input.blur(); }
    });
  
    // click a result
    results.addEventListener("mousedown", function (e) {
      var row = e.target.closest(".tsr-row");
      if (row) { e.preventDefault(); go(parseInt(row.dataset.i, 10)); }
    });
  
    // close on outside click
    document.addEventListener("click", function (e) {
      if (!e.target.closest("#tickerSearch")) { results.style.display = "none"; }
    });
    input.addEventListener("focus", function () { if (filtered.length) results.style.display = ""; });
  })();