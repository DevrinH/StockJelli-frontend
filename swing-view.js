/* ============================================================
   swing-view.js — carousel + magnitude rail, wired to /api/sectors.
   Add to index.html head: <script src="swing-view.js?v=1" defer></script>
   Ported from v4's featured-row engine, but:
     • data comes from /api/sectors (real), not a hardcoded object
     • bars are MAGNITUDE (how often a name makes a big move), violet,
       NOT direction — a bar can't be misread as "chance it goes up"
     • carousel cycles ALL sectors, lead-first (endpoint already sorts)
     • rail = top names by magnitude across all sectors
     • names route to /ticker.html?sym=X
   Only renders when the swing view is visible.
============================================================ */
(function () {
  "use strict";
  var API = "https://api.stockjelli.com";
  var FEAT_MS = 6000;

  var SEC_ICON = {
    "Technology": "◆", "Financial Services": "$", "Healthcare": "✚",
    "Consumer Cyclical": "▤", "Consumer Defensive": "▣", "Communication Services": "◈",
    "Energy": "⚡", "Industrials": "⚙", "Real Estate": "⌂", "Basic Materials": "⬡", "Utilities": "▦"
  };

  var sectors = [];      // from /api/sectors, lead-first
  var featIdx = 0, featTimer = null, featStart = 0, featPaused = false;

  function magColor(p) { return p >= 60 ? "#a78bfa" : p >= 35 ? "#818cf8" : "rgba(255,255,255,0.35)"; }

  function tierState(r) {
    if (r.tier === "lead") return { t: "moving most", c: "var(--volt, #a78bfa)" };
    if (r.tier === "context") return { t: "some movement", c: "rgba(255,255,255,0.6)" };
    return { t: "quiet this month", c: "rgba(255,255,255,0.4)" };
  }

  function nameRowHTML(nm) {
    var raw = nm.rawPct == null ? 0 : nm.rawPct;
    var col = magColor(raw);
    var inside = raw >= 22;
    var label = nm.display;   // ≈% past n-ladder, else fraction
    return '<div class="feat-frow" onclick="location.href=\'/ticker.html?sym=' + encodeURIComponent(nm.symbol) + '\'">' +
      '<span class="feat-sym">' + nm.symbol + '</span>' +
      '<div class="feat-bar"><div class="feat-fill" style="width:' + raw + '%;background:' + col + '"></div>' +
        '<span class="feat-pct" style="' + (inside ? 'left:8px;color:#0a0a14' : 'left:calc(' + raw + '% + 7px);color:rgba(255,255,255,0.7)') + '">' + label + '</span></div>' +
      '<span class="feat-n">n=' + nm.n + '</span>' +
    '</div>';
  }

  function renderFeat() {
    if (!sectors.length) return;
    if (featIdx >= sectors.length) featIdx = 0;
    var sec = sectors[featIdx];
    var st = tierState(sec);
    var mag = sec.magnitude || {};
    var magPct = (mag.status === "ok" && mag.pct != null) ? mag.pct + "%" : "—";

    document.getElementById("featIco").textContent = SEC_ICON[sec.sector] || "◆";
    document.getElementById("featSec").textContent = sec.sector;
    var stEl = document.getElementById("featState");
    stEl.textContent = magPct + " make a big move · " + st.t;
    stEl.style.color = st.c;
    document.getElementById("featCount").textContent = (featIdx + 1) + " / " + sectors.length;

    var names = sec.names || [];
    document.getElementById("featList").innerHTML = names.length
      ? names.map(nameRowHTML).join("")
      : '<div class="feat-quiet" style="padding:14px 0;">no names with enough history yet</div>';

    document.getElementById("featTally").textContent = names.length + " names tracked";

    var dots = document.getElementById("featDots"); dots.innerHTML = "";
    sectors.forEach(function (_, i) {
      var d = document.createElement("div");
      d.className = "feat-dot" + (i === featIdx ? " on" : "");
      d.onclick = function () { featIdx = i; resetFeat(); };
      dots.appendChild(d);
    });
  }

  function renderRail() {
    // top names by magnitude across ALL sectors
    var all = [];
    sectors.forEach(function (s) { (s.names || []).forEach(function (n) { all.push({ n: n, sector: s.sector }); }); });
    all.sort(function (a, b) { return (b.n.rawPct - a.n.rawPct) || (b.n.n - a.n.n); });
    var top = all.slice(0, 6);
    document.getElementById("featRailBody").innerHTML = top.map(function (item) {
      var nm = item.n;
      return '<div class="feat-rail-row" onclick="location.href=\'/ticker.html?sym=' + encodeURIComponent(nm.symbol) + '\'">' +
        '<div class="feat-rail-tk">' + nm.symbol + ' <small>' + item.sector + '</small></div>' +
        '<span class="feat-rail-odds volt-c">' + nm.display + '</span>' +
        '<span class="feat-rail-res">›</span></div>';
    }).join("") || '<div class="feat-quiet" style="padding:12px 0;">gathering history…</div>';
  }

  function goFeat(dir) { var n = sectors.length; if (!n) return; featIdx = (featIdx + dir + n) % n; resetFeat(); }
  function resetFeat() { featStart = performance.now(); renderFeat(); }

  function tickFeat(now) {
    if (!featPaused && sectors.length) {
      var elapsed = now - featStart;
      var pct = Math.min(100, (elapsed / FEAT_MS) * 100);
      var pf = document.getElementById("featProg"); if (pf) pf.style.width = pct + "%";
      if (elapsed >= FEAT_MS) { featIdx = (featIdx + 1) % sectors.length; featStart = now; renderFeat(); }
    } else { featStart = now; }
    featTimer = requestAnimationFrame(tickFeat);
  }

  function load() {
    fetch(API + "/api/sectors", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        sectors = (j && j.rows) ? j.rows : [];
        featIdx = 0; renderFeat(); renderRail();
      })
      .catch(function () { sectors = []; });
  }

  function init() {
    var hero = document.getElementById("featHero");
    if (!hero) return;
    document.getElementById("featPrev").onclick = function () { goFeat(-1); };
    document.getElementById("featNext").onclick = function () { goFeat(1); };
    hero.addEventListener("mouseenter", function () { featPaused = true; });
    hero.addEventListener("mouseleave", function () { featPaused = false; featStart = performance.now(); });
    featStart = performance.now();
    load();
    if (featTimer) cancelAnimationFrame(featTimer);
    featTimer = requestAnimationFrame(tickFeat);
    setInterval(load, 5 * 60 * 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();