/* ============================================================
   sector-board.js (v2 — grouped cards, mockup shape)
   Replaces the flat-row version. Renders each sector as a CARD:
     header = sector name + magnitude % (the gate, real today)
              + direction lean as a SIDE LABEL (suppressed on quiet)
     rows   = top example names, each with a MAGNITUDE bar + fraction
     foot   = sample-depth line
   Bars are magnitude (how much names move), never direction — so a
   bar can't be misread as "chance it goes up". Names route to
   /ticker.html on click. Hides on the crypto tab.
============================================================ */
(function () {
    "use strict";
    var API = "https://api.stockjelli.com";
    var section = document.getElementById("sectorBoard");
    var body = document.getElementById("sectorBoardBody");
    if (!section || !body) return;
  
    function leanClass(d) { return d === "up" ? "sb-lean-up" : d === "down" ? "sb-lean-down" : "sb-lean-flat"; }
  
    function headerLean(tier, lean) {
      if (tier === "quiet") return '<span class="sb-lean sb-lean-dim">quiet \u00b7 no edge</span>';
      if (lean && lean.status === "ok" && lean.pct != null) {
        return '<span class="sb-lean ' + leanClass(lean.dir) + '">leans ' + lean.dir + ' ' + lean.pct + '%</span>';
      }
      return '<span class="sb-lean sb-lean-dim">no clear lean</span>';
    }
  
    function nameRow(nm) {
      var barW = Math.max(0, Math.min(100, nm.rawPct == null ? 0 : nm.rawPct));
      var fillClass = nm.rawPct >= 60 ? "sb-fill-hot" : nm.rawPct >= 35 ? "sb-fill-mid" : "sb-fill-low";
      var label = nm.display;
      return '<a class="sb-name-row" href="/ticker.html?sym=' + encodeURIComponent(nm.symbol) + '">' +
        '<span class="sb-name-sym">' + nm.symbol + '</span>' +
        '<span class="sb-name-bar"><span class="sb-name-fill ' + fillClass + '" style="width:' + barW + '%"></span>' +
          '<span class="sb-name-pct">' + label + '</span></span>' +
        '<span class="sb-name-n">n=' + nm.n + '</span>' +
      '</a>';
    }
  
    function card(r) {
      var tier = r.tier || "quiet";
      var mag = r.magnitude || {};
      var magPct = (mag.status === "ok" && mag.pct != null) ? mag.pct + "%" : "\u2014";
      var names = (r.names || []).map(nameRow).join("");
      var foot;
      if (tier === "lead") foot = "most movement this month";
      else if (tier === "context") foot = "moderate movement";
      else foot = "quiet / weak this month";
      var nTotal = mag.n != null ? mag.n : 0;
  
      return '<div class="sb-card sb-card-' + tier + '">' +
        '<div class="sb-card-head">' +
          '<div class="sb-card-head-left">' +
            '<span class="sb-card-sec">' + r.sector + '</span>' +
            (tier === "lead" ? '<span class="sb-lead-chip">moving most</span>' : '') +
          '</div>' +
          headerLean(tier, r.lean) +
        '</div>' +
        '<div class="sb-card-mag"><span class="sb-card-magpct">' + magPct + '</span>' +
          '<span class="sb-card-magcap">of names made a big move (\u00b15% / ~3d)</span></div>' +
        (names ? '<div class="sb-card-names">' + names + '</div>' : '') +
        '<div class="sb-card-foot">' + foot + ' \u00b7 ' + nTotal + ' resolved signals</div>' +
      '</div>';
    }
  
    function render(rows) {
      if (!rows || !rows.length) { section.style.display = "none"; return; }
      body.innerHTML = rows.map(card).join("");
      section.style.display = "";
    }
  
    function load() {
      fetch(API + "/api/sectors", { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (j) { render(j && j.rows ? j.rows : []); })
        .catch(function () { section.style.display = "none"; });
    }
  
    function currentMode() {
      try { return localStorage.getItem("sj_asset_mode") || "stocks"; } catch (e) { return "stocks"; }
    }
    function applyModeVisibility() {
      if (currentMode() === "crypto") section.style.display = "none";
      else if (body.children.length) section.style.display = "";
    }
    var ctrl = document.getElementById("assetControl");
    if (ctrl) ctrl.addEventListener("click", function () { setTimeout(applyModeVisibility, 0); });
  
    load();
    setInterval(load, 5 * 60 * 1000);
    if (currentMode() === "crypto") section.style.display = "none";
  })();