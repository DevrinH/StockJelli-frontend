/* ============================================================
   swing-view.js — carousel + magnitude rail, wired to /api/sectors.
   Add to index.html head: <script src="swing-view.js?v=2" defer></script>
   Ported from v4's featured-row engine, but:
     • data comes from /api/sectors (real), not a hardcoded object
     • bars are MAGNITUDE (how often a name made a big move), violet,
       NOT direction — a bar can't be misread as "chance it goes up"
     • carousel cycles ALL sectors, lead-first (endpoint already sorts)
     • rail = top names by magnitude across all sectors
     • names route to /ticker.html?sym=X

   WORDING (v2 — the correctness fix):
     • subtitle is PAST-TENSE FACTUAL, never "% chance of a swing"
       (that reads as forward prediction). It states history as fact:
       fraction form  -> "swung ±5% in 14 of 20 setups · direction-agnostic"
       percent form   -> "made a ±5% swing 70% of the time · direction-agnostic"
     • a one-line column key explains what the fractions count, keyed on
       the fixed 40-trading-day window (not a per-name "last 20"):
       "±5% move within 3 days · last 40 trading days of setups"

   FILL (v2):
     • all names shown, sorted high→low. Top 5 bright violet; the rest
       (and anything below the n-ladder / magnitude floor) render gray.

   Only renders when the swing view is visible.
============================================================ */
(function () {
  "use strict";
  var API = "https://api.stockjelli.com";
  var FEAT_MS = 6000;
  var BRIGHT_TOP = 5;        // top N names render bright; rest gray
  var QUIET_N = 10;          // n-ladder: below this, no rate -> quiet
  var QUIET_RATE = 35;       // magnitude floor (%) below which a name is quiet

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

  // PAST-TENSE FACTUAL subtitle. n = resolved 3-day setups, from the
  // 8wk/40d swing magnitude cache. Branch on the same magPct==null test
  // used for the bar labels so subtitle + bars never disagree.
  function magSubtitle(sec) {
    var mag = sec.magnitude || {};
    if (mag.status === "ok" && mag.pct != null) {
      return "made a ±5% swing " + mag.pct + "% of the time · direction-agnostic";
    }
    if (mag.hit != null && mag.n != null && mag.n > 0) {
      return "swung ±5% in " + mag.hit + " of " + mag.n + " setups · direction-agnostic";
    }
    return "gathering history · direction-agnostic";
  }

  // A name is "quiet" (gray) if it's below the n-ladder, below the
  // magnitude floor, or past the bright-top cutoff.
  function isQuietName(nm, rank) {
    if (rank >= BRIGHT_TOP) return true;
    if (nm.n == null || nm.n < QUIET_N) return true;
    var raw = nm.rawPct == null ? 0 : nm.rawPct;
    if (raw < QUIET_RATE) return true;
    return false;
  }

  function nameRowHTML(nm, rank) {
    var raw = nm.rawPct == null ? 0 : nm.rawPct;
    var quiet = isQuietName(nm, rank);
    var col = quiet ? "rgba(255,255,255,0.14)" : magColor(raw);
    var inside = raw >= 22;
    var label = nm.display;   // ≈% past n-ladder, else fraction
    var pctColor = quiet
      ? "rgba(255,255,255,0.4)"
      : (inside ? "#0a0a14" : "rgba(255,255,255,0.7)");
    var pctPos = inside ? "left:8px" : "left:calc(" + raw + "% + 7px)";
    return '<div class="feat-frow' + (quiet ? ' feat-frow-quiet' : '') +
      '" onclick="location.href=\'/ticker.html?sym=' + encodeURIComponent(nm.symbol) + '\'">' +
      '<span class="feat-sym">' + nm.symbol + '</span>' +
      '<div class="feat-bar"><div class="feat-fill' + (quiet ? ' feat-fill-quiet' : '') +
        '" style="width:' + raw + '%;background:' + col + '"></div>' +
        '<span class="feat-pct" style="' + pctPos + ';color:' + pctColor + '">' + label + '</span></div>' +
      '<span class="feat-n">n=' + nm.n + '</span>' +
    '</div>';
  }

  function renderFeat() {
    if (!sectors.length) return;
    if (featIdx >= sectors.length) featIdx = 0;
    var sec = sectors[featIdx];
    var st = tierState(sec);

    document.getElementById("featIco").textContent = SEC_ICON[sec.sector] || "◆";
    document.getElementById("featSec").textContent = sec.sector;

    var stEl = document.getElementById("featState");
    stEl.textContent = magSubtitle(sec);
    stEl.style.color = st.c;

    document.getElementById("featCount").textContent = (featIdx + 1) + " / " + sectors.length;

    // names sorted high→low; top 5 bright, rest gray
    var names = (sec.names || []).slice().sort(function (a, b) {
      var ra = a.rawPct == null ? 0 : a.rawPct;
      var rb = b.rawPct == null ? 0 : b.rawPct;
      return (rb - ra) || ((b.n || 0) - (a.n || 0));
    });

    var listEl = document.getElementById("featList");
    listEl.innerHTML = names.length
      ? '<div class="feat-list-key">±5% move within 3 days · last 40 trading days of setups</div>' +
        names.map(function (nm, i) { return nameRowHTML(nm, i); }).join("")
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