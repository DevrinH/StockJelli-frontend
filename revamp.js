/* ============================================================
   STOCKJELLI HOMEPAGE REVAMP — PHASE 1 WIRING — REV 4
   Load defer AFTER app.js and alerts-frontend.js:
     <script src="revamp.js?v=4" defer></script>

   REV 4 (Option A — real /api/leveraged wiring):
     • Monitor strip TQQQ now reads the LIVE /api/leveraged route
       (cache.leveraged, polled every 60s from Tiingo while market open).
     • Crypto mode → Bitcoin from /api/crypto (BTC row + header btcPct), 24/7.
     • NO sparkline — backend has no intraday series. Strip shows price + %
       only. The <svg> spark in the markup is left empty/hidden.
     • Market-session labeling: TQQQ poll only runs when session==="open",
       so off-hours we show the last snapshot tagged "at last close".
     • Live alert log (#alertCardsSection) + odds donut + broker unchanged.
   ============================================================ */
   (() => {
    if (window.__SJ_REVAMP_INIT__) return;
    window.__SJ_REVAMP_INIT__ = true;
  
    const API_BASE = "https://api.stockjelli.com";
    const CIRC = 2 * Math.PI * 86;
    const $ = (id) => document.getElementById(id);
    const currentMode = () =>
      document.querySelector("#assetControl .segmented-on")?.dataset?.value || "stocks";
  
    /* ---------- ODDS DONUT (peak +3% over resolved current-formula alerts) ---------- */
    function computeOdds(notifications, mode) {
      let rows = notifications || [];
      if (mode === "stocks") rows = rows.filter(a => a.mode === "stocks");
      else if (mode === "crypto") rows = rows.filter(a => a.mode === "crypto");
      rows = rows.filter(a => a.formulaVersion === "v2.1" || (a.formulaVersion === "v2" && a.mode === "crypto"));
      const now = Date.now();
      const resolved = rows.filter(a => {
        if (a.peakAfterPush == null) return false;
        if (a.mode === "crypto" && a.pushTimestamp && (now - new Date(a.pushTimestamp).getTime()) < 15 * 60 * 1000) return false;
        return true;
      });
      const total = rows.length, n = resolved.length;
      const hits = resolved.filter(a => a.peakAfterPush >= 2.95).length;
      return { pct: n > 0 ? Math.round((hits / n) * 100) : null, hits, n, total };
    }
    function paintDonut({ pct, n, total }, mode) {
      const titleEl = $("oddsHeroTitle"), countEl = $("oddsHeroCount");
      const pctEl = $("oddsDonutPct"), fillEl = $("oddsDonutFill");
      if (titleEl) titleEl.textContent = mode === "crypto" ? "Crypto Momentum Odds" : "Stock Momentum Odds";
      if (pct == null || n === 0) {
        if (pctEl) pctEl.textContent = "—";
        if (countEl) countEl.textContent = "gathering signals";
        if (fillEl) fillEl.style.strokeDashoffset = String(CIRC);
        return;
      }
      if (pctEl) pctEl.textContent = String(pct);
      if (countEl) countEl.textContent = `${n} of ${total} signals`;
      if (fillEl) {
        fillEl.style.strokeDashoffset = String(CIRC);
        requestAnimationFrame(() => { fillEl.style.strokeDashoffset = String(CIRC * (1 - pct / 100)); });
        const col = pct >= 80 ? "#4ade80" : pct >= 65 ? "#818cf8" : "#f59e0b";
        fillEl.style.stroke = col; fillEl.style.filter = `drop-shadow(0 0 8px ${col}59)`;
      }
    }
    let _lastNotifs = null;
    function refreshOdds() {
      const mode = currentMode();
      if (_lastNotifs) { paintDonut(computeOdds(_lastNotifs, mode), mode); return; }
      const src = window.__sjAlertPrefetch ? window.__sjAlertPrefetch
        : fetch(`${API_BASE}/api/notification-log?limit=500`).then(r => r.json());
      src.then(data => { _lastNotifs = data.notifications || []; paintDonut(computeOdds(_lastNotifs, mode), mode); })
         .catch(() => paintDonut({ pct: null, hits: 0, n: 0, total: 0 }, mode));
    }
  
    /* ---------- EXCHANGE PICKER ---------- */
    const BROKER_KEY = "sj_preferred_broker";   // match broker-link.js if different
    const currentBroker = () => localStorage.getItem(BROKER_KEY) || "tradingview";
    function setBrokerUI(val) {
      document.querySelectorAll("#heroBrokerControl .segmented-btn").forEach(b => b.classList.toggle("segmented-on", b.dataset.value === val));
      document.querySelectorAll("#accountBrokerControl .segmented-btn").forEach(b => b.classList.toggle("segmented-on", b.dataset.value === val));
    }
    function initBroker() {
      const ctrl = $("heroBrokerControl"); if (!ctrl) return;
      setBrokerUI(currentBroker());
      ctrl.addEventListener("click", (e) => {
        const btn = e.target.closest(".segmented-btn"); if (!btn) return;
        const val = btn.dataset.value;
        localStorage.setItem(BROKER_KEY, val);
        if (typeof window.setBroker === "function") window.setBroker(val);
        setBrokerUI(val);
        document.querySelector("#assetControl .segmented-on")?.click();
      });
    }
  
    /* ---------- MODE FLIP HOOK ---------- */
    function initModeHook() {
      $("assetControl")?.addEventListener("click", (e) => {
        if (!e.target.closest(".segmented-btn")) return;
        setTimeout(() => { refreshOdds(); refreshMonitor(); }, 60);
      });
    }
  
    /* ---------- MONITOR STRIP: TQQQ (stocks) / BTC (crypto) ----------
       No sparkline — backend exposes no intraday series. Price + % only.
       The <svg> in markup stays empty; we hide it so the layout collapses
       cleanly to a two-part strip (title | price+%). */
    function hideSpark() {
      const chart = document.querySelector(".monitor-strip-chart");
      if (chart) chart.style.display = "none";
    }
    function paintMonitor({ title, tag, price, pct, priceDecimals = 2, sessionNote = "", logo = null }) {
      const t = $("monitorTitle"), tg = $("monitorTag"), p = $("monitorPrice"), c = $("monitorChg");
      const logoEl = $("monitorLogo");
      if (logoEl) {
        if (logo) { logoEl.src = logo; logoEl.alt = title || ""; logoEl.style.display = ""; }
        else { logoEl.removeAttribute("src"); logoEl.style.display = "none"; }
      }
      if (t && title) t.textContent = title;
      if (tg) tg.textContent = sessionNote ? `${tag} · ${sessionNote}` : tag;
      if (p) p.textContent = price != null
        ? `$${Number(price).toLocaleString(undefined, { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}`
        : "$—";
      const up = (pct ?? 0) >= 0;
      if (c) {
        if (pct != null) { c.textContent = `${up ? "+" : ""}${Number(pct).toFixed(2)}%`; c.classList.remove("up", "down"); c.classList.add(up ? "up" : "down"); c.style.opacity = sessionNote && sessionNote !== "live" ? "0.7" : ""; }
        else { c.textContent = "—"; c.classList.remove("up", "down"); }
      }
    }
  
    async function refreshMonitor() {
      const mode = currentMode();
  
      if (mode === "crypto") {
        // Bitcoin — live 24/7 from /api/crypto.
        // NOTE: /api/crypto only returns rows that PASS the momentum filter
        // (pctChange >= 3% etc). BTC at +0.6% won't be in rows, so we ask for
        // a loose filter (pctMin=-100, big limit) so BTC is always present.
        // The header carries btcPct (the %); the BTC row carries the price.
        try {
          const r = await fetch(`${API_BASE}/api/crypto?limit=250&pctMin=-100&volMin=0&mcapMin=0`, { cache: "no-store" });
          const d = await r.json();
          const btcRow = (d.rows || []).find(x => (x.coinSymbol || "").toUpperCase() === "BTC");
          // prefer the header % (24h), fall back to the row's pctChange
          const btcPct = d?.header?.btcPct ?? d?.header?.left?.pct ?? btcRow?.pctChange ?? null;
          const price = btcRow?.price ?? null;
          const logo = btcRow?.image ?? "https://assets.coingecko.com/coins/images/1/large/bitcoin.png";
          paintMonitor({ title: "Bitcoin Monitor", tag: "BTC · 24h", price, pct: btcPct, priceDecimals: 0, sessionNote: "live", logo });
        } catch (e) {
          paintMonitor({ title: "Bitcoin Monitor", tag: "BTC · 24h", price: null, pct: null, priceDecimals: 0, logo: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png" });
        }
        return;
      }
  
      // Stocks → TQQQ from the live /api/leveraged cache
      try {
        const r = await fetch(`${API_BASE}/api/leveraged`, { cache: "no-store" });
        const d = await r.json();
        const tqqq = (d.rows || []).find(x => (x.symbol || "").toUpperCase() === "TQQQ");
        // session note: "live" while market open, else "at last close"
        const note = d.live ? "live" : (d.marketSession === "premarket" ? "pre-market" : d.marketSession === "afterhours" ? "after hours" : "at last close");
        paintMonitor({
          title: "TQQQ Monitor",
          tag: "ProShares UltraPro QQQ",
          price: tqqq?.price ?? null,
          pct: tqqq?.pctChange ?? null,
          priceDecimals: 2,
          sessionNote: note,
        });
      } catch (e) {
        paintMonitor({ title: "TQQQ Monitor", tag: "ProShares UltraPro QQQ", price: null, pct: null });
      }
    }
  
    /* ---------- BOOT ---------- */
    function boot() {
      hideSpark();
      initBroker();
      initModeHook();
      refreshOdds();
      refreshMonitor();
      setInterval(refreshOdds, 60_000);
      setInterval(refreshMonitor, 60_000);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  })();