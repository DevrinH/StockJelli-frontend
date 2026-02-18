/* ============================================
   StockJelli — All Feature JS Additions
   
   Append inside your app.js IIFE (before the closing })(); )
   REPLACES all previously appended JS blocks.
   ============================================ */


// 0. STICKY HEADER + TICKER MEASUREMENT
(function initStickyMeasure() {
    const header = document.querySelector(".header");
    if (!header) return;
    function measure() {
      document.documentElement.style.setProperty("--header-h", header.getBoundingClientRect().height + "px");
    }
    measure();
    window.addEventListener("resize", measure);
    if (document.fonts?.ready) document.fonts.ready.then(measure);
  })();
  
  
  // 1. SCROLLING PULSE TICKER
  (function initPulseTicker() {
    const ticker = document.getElementById("pulseTicker");
    const track = document.getElementById("pulseTickerTrack");
    if (!ticker || !track) return;
  
    function fmtPct(n) {
      if (n == null) return "—";
      return `${n > 0 ? "+" : ""}${Number(n).toFixed(1)}%`;
    }
  
    function buildPulseSummary(stocks, crypto, isMarketOpen) {
      const allStocks = (stocks || []).filter(r => r.pctChange > 0).sort((a,b) => b.pctChange - a.pctChange);
      const allCrypto = (crypto || []).filter(r => r.pctChange > 0).sort((a,b) => b.pctChange - a.pctChange);
      const totalMovers = allStocks.length + allCrypto.length;
  
      if (totalMovers === 0) {
        return isMarketOpen ? "Scanning for momentum…" : "Markets closed · Watching crypto";
      }
  
      const allMovers = [
        ...allStocks.map(r => ({ sym: r.symbol, pct: r.pctChange })),
        ...allCrypto.map(r => ({ sym: r.coinSymbol || r.symbol, pct: r.pctChange })),
      ].sort((a, b) => b.pct - a.pct);
  
      const leader = allMovers[0];
      const leaderSym = leader?.sym || "—";
      const leaderPct = fmtPct(leader?.pct);
  
      const parts = [];
      if (!isMarketOpen) parts.push("Market closed");
  
      if (allStocks.length > 0 && allCrypto.length > 0) {
        parts.push(`${allStocks.length} stocks & ${allCrypto.length} crypto moving, led by ${leaderSym} (${leaderPct})`);
      } else if (allStocks.length > 0) {
        parts.push(`${allStocks.length} stocks moving, led by ${leaderSym} (${leaderPct})`);
      } else {
        parts.push(`${allCrypto.length} crypto still moving, led by ${leaderSym} (${leaderPct})`);
      }
  
      return parts.join(" · ");
    }
  
    function buildItems(stocks, crypto, isMarketOpen) {
      const items = [];
  
      const summary = buildPulseSummary(stocks, crypto, isMarketOpen);
      items.push(`<span class="ticker-pulse-text"><span class="ticker-pulse-dot"></span>${summary}</span>`);
      items.push(`<span class="ticker-separator"></span>`);
  
      const medals = ["🥇", "🥈", "🥉"];
      const topS = (stocks || []).filter(r => r.pctChange > 0).sort((a,b) => b.pctChange - a.pctChange).slice(0, 8);
      for (let i = 0; i < topS.length; i++) {
        const s = topS[i];
        const medal = i < 3 ? `<span class="ticker-medal">${medals[i]}</span> ` : "";
        items.push(`<span class="ticker-item">${medal}<span class="ticker-item-symbol">${s.symbol}</span> <span class="ticker-item-pct up">${fmtPct(s.pctChange)}</span></span>`);
      }
  
      if (topS.length > 0 && crypto?.length > 0) items.push(`<span class="ticker-separator"></span>`);
  
      const topC = (crypto || []).filter(r => r.pctChange > 0).sort((a,b) => b.pctChange - a.pctChange).slice(0, 8);
      for (let i = 0; i < topC.length; i++) {
        const c = topC[i];
        const medal = i < 3 ? `<span class="ticker-medal">${medals[i]}</span> ` : "";
        items.push(`<span class="ticker-item">${medal}<span class="ticker-item-symbol">${c.coinSymbol || c.symbol}</span> <span class="ticker-item-pct up">${fmtPct(c.pctChange)}</span></span>`);
      }
  
      return items;
    }
  
    function isUSMarketOpen() {
      const now = new Date();
      const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
      const day = et.getDay();
      const h = et.getHours(), m = et.getMinutes();
      const mins = h * 60 + m;
      return day >= 1 && day <= 5 && mins >= 570 && mins < 960;
    }
  
    async function fetchTicker() {
      try {
        const stockMcap = document.getElementById("mcapSlider")?.value || 100000000;
        const cryptoMcap = 50000000;
  
        const [s, c] = await Promise.all([
          fetch(`https://api.stockjelli.com/api/stocks?limit=20&mcapMin=${stockMcap}`, {cache:"no-store"}).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`https://api.stockjelli.com/api/crypto?limit=20&mcapMin=${cryptoMcap}`, {cache:"no-store"}).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        const items = buildItems(s?.rows, c?.rows, isUSMarketOpen());
        if (items.length <= 2) {
          items.push(`<span class="ticker-pulse-text"><span class="ticker-pulse-dot"></span>Scanning for momentum…</span>`);
        }
        const onePass = items.join("");
  
        const viewW = window.innerWidth || 1920;
        track.innerHTML = onePass;
        const contentW = track.scrollWidth || viewW;
        const repeats = Math.max(3, Math.ceil((viewW * 2.5) / contentW));
        track.innerHTML = onePass.repeat(repeats);
  
        ticker.style.display = "";
        requestAnimationFrame(() => {
          const onePassEl = document.createElement("div");
          onePassEl.style.cssText = "display:inline-flex;visibility:hidden;position:absolute";
          onePassEl.innerHTML = onePass;
          track.parentNode.appendChild(onePassEl);
          const onePassW = onePassEl.scrollWidth;
          onePassEl.remove();
  
          track.style.setProperty("--ticker-scroll", `-${onePassW}px`);
          const dur = Math.max(12, onePassW / 45);
          track.style.animationDuration = `${dur}s`;
          track.style.animationName = "tickerScroll";
          track.style.animationTimingFunction = "linear";
          track.style.animationIterationCount = "infinite";
        });
      } catch {}
    }
  
    fetchTicker();
    setInterval(fetchTicker, 60_000);
  })();
  
  
  // 2. LIVE TIMESTAMP UPDATER
  (function initLiveTimestamp() {
    const el = document.getElementById("liveTimestamp");
    const badge = el?.closest(".live-update-badge");
    if (!el) return;
    let lastRefresh = Date.now();
  
    setInterval(() => {
      const s = Math.floor((Date.now() - lastRefresh) / 1000);
      el.textContent = s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.floor(s/60)}m ago`;
    }, 1000);
  
    const _fetch = window.fetch;
    window.fetch = function(...args) {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      const p = _fetch.apply(this, args);
      if (url.includes("api.stockjelli.com/api/stocks") || url.includes("api.stockjelli.com/api/crypto")) {
        p.then(r => { if (r.ok) { lastRefresh = Date.now(); if (badge) { badge.classList.add("just-updated"); setTimeout(() => badge.classList.remove("just-updated"), 1500); } } }).catch(() => {});
      }
      return p;
    };
  })();
  
  
  // 3. INLINE ALERT CTA WIRING
  (function() {
    const btn = document.getElementById("inlineAlertBtn");
    if (btn) btn.addEventListener("click", () => { const m = document.getElementById("enableAlertsBtn"); if (m) m.click(); });
  })();
  
  
  // 3b. TOGGLE FADE TRANSITION
  (function() {
    const assetControl = document.getElementById("assetControl");
    if (!assetControl) return;
  
    assetControl.addEventListener("click", (e) => {
      const btn = e.target.closest(".segmented-btn");
      if (!btn) return;
      const wrap = document.querySelector(".table-wrap");
      if (wrap) {
        wrap.style.animation = "none";
        wrap.offsetHeight;
        wrap.style.animation = "";
      }
    });
  })();
  
  
  // 4. YESTERDAY'S TOP MOVERS
  (function initYesterday() {
    const section = document.getElementById("yesterdaySection");
    const body = document.getElementById("yesterdayBody");
    const dateEl = document.getElementById("yesterdayDate");
    const sGroup = document.getElementById("yesterdayStocksGroup");
    const sList = document.getElementById("yesterdayStocksList");
    const cGroup = document.getElementById("yesterdayCryptoGroup");
    const cList = document.getElementById("yesterdayCryptoList");
    const empty = document.getElementById("yesterdayEmpty");
    const assetControl = document.getElementById("assetControl");
    if (!section || !body) return;
  
    body.style.display = "";
  
    let hasStocks = false;
    let hasCrypto = false;
  
    function syncWithAssetTab() {
      const activeBtn = assetControl?.querySelector(".segmented-on");
      const mode = activeBtn?.dataset?.value || "stocks";
  
      if (mode === "stocks") {
        if (sGroup) sGroup.style.display = hasStocks ? "" : "none";
        if (cGroup) cGroup.style.display = "none";
        if (empty) empty.style.display = (!hasStocks) ? "" : "none";
      } else {
        if (sGroup) sGroup.style.display = "none";
        if (cGroup) cGroup.style.display = hasCrypto ? "" : "none";
        if (empty) empty.style.display = (!hasCrypto) ? "" : "none";
      }
    }
  
    if (assetControl) {
      assetControl.addEventListener("click", (e) => {
        const btn = e.target.closest(".segmented-btn");
        if (!btn) return;
        setTimeout(syncWithAssetTab, 50);
      });
    }
  
    function fmtPct(n) { return n == null ? "—" : `${n > 0 ? "+" : ""}${Number(n).toFixed(1)}%`; }
    function fmtUsd(n) { return n == null ? "$—" : n >= 1 ? `$${Number(n).toFixed(2)}` : `$${Number(n).toPrecision(4)}`; }
    function fmtDate(s) { if (!s) return ""; try { const p = s.split("-"); return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(p[1],10)-1] + " " + parseInt(p[2],10); } catch { return s; } }
    function tvUrl(sym, type) { return type === "crypto" ? `https://www.tradingview.com/chart/?symbol=BINANCE:${sym}USDT&aff_id=162729` : `https://www.tradingview.com/chart/?symbol=${sym}&aff_id=162729`; }
    function chip(item, type) {
      const sym = type === "crypto" ? item.coinSymbol : item.symbol;
      const cls = item.pctChange >= 0 ? "up" : "down";
      return `<a class="yesterday-chip" href="${tvUrl(sym,type)}" target="_blank" rel="noopener"><span class="yesterday-chip-symbol">${sym}</span><span class="yesterday-chip-pct ${cls}">${fmtPct(item.pctChange)}</span><span class="yesterday-chip-price">${fmtUsd(item.price)}</span></a>`;
    }
  
    (async () => {
      try {
        const res = await fetch("https://api.stockjelli.com/api/yesterday", {cache:"no-store"});
        if (!res.ok) return;
        const d = await res.json();
        if (!d.available) return;
        if (dateEl) dateEl.textContent = fmtDate(d.date);
  
        const stocks = (d.stocks || []).slice(0, 6);
        const crypto = (d.crypto || []).slice(0, 6);
        hasStocks = stocks.length > 0;
        hasCrypto = crypto.length > 0;
  
        if (!hasStocks && !hasCrypto) {
          if (empty) empty.style.display = "";
          section.style.display = "";
          return;
        }
  
        if (hasStocks && sList && sGroup) {
          sList.innerHTML = stocks.map(s => chip(s, "stock")).join("");
        }
        if (hasCrypto && cList && cGroup) {
          cList.innerHTML = crypto.map(c => chip(c, "crypto")).join("");
        }
  
        section.style.display = "";
        syncWithAssetTab();
      } catch {}
    })();
  })();
  
  
  // 5. BOOKMARK PROMPT
  (function() {
    if (localStorage.getItem("sj_bookmark_prompted") || localStorage.getItem("sj_promo_dismissed")) return;
    setTimeout(() => {
      const isMac = /mac/i.test(navigator.platform || navigator.userAgent || "");
      const el = document.createElement("div");
      el.className = "bookmark-prompt";
      el.innerHTML = `<span class="bookmark-prompt-icon">📌</span><span class="bookmark-prompt-text"><strong>Add StockJelli to your morning scan.</strong> Bookmark this page <kbd>${isMac ? "⌘+D" : "Ctrl+D"}</kbd></span><button class="bookmark-prompt-close" aria-label="Close">×</button>`;
      document.body.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("visible")));
      function dismiss() { localStorage.setItem("sj_bookmark_prompted","1"); el.classList.remove("visible"); setTimeout(() => el.remove(), 400); }
      el.querySelector(".bookmark-prompt-close").addEventListener("click", dismiss);
      setTimeout(dismiss, 15_000);
    }, 90_000);
  })();


  // ── 6. EKG ANIMATION ENGINE ─────────────────────────────────────────────────
  // IMPORTANT: This needs its own copy of REGIME_CONFIG since app.js's is
  // inside a closure and not accessible from here.

(function initMarketPulseEKG() {
  const canvas = document.getElementById("pulseEkgCanvas");
  if (!canvas) return;

  // Local regime config for the EKG (matches app.js REGIME_CONFIG)
  const EKG_REGIME_CONFIG = {
    expansion: {
      color: "#22c55e", colorRgb: "34, 197, 94",
      bpm: 62, amplitude: 0.35, frequency: 0.07, spikeStrength: 0.25, noise: 0.02,
    },
    rotation: {
      color: "#3b82f6", colorRgb: "59, 130, 246",
      bpm: 78, amplitude: 0.45, frequency: 0.10, spikeStrength: 0.35, noise: 0.05,
    },
    caution: {
      color: "#f59e0b", colorRgb: "245, 158, 11",
      bpm: 95, amplitude: 0.55, frequency: 0.15, spikeStrength: 0.45, noise: 0.10,
    },
    contraction: {
      color: "#ef4444", colorRgb: "239, 68, 68",
      bpm: 120, amplitude: 0.75, frequency: 0.22, spikeStrength: 0.6, noise: 0.18,
    },
  };

  const ctx = canvas.getContext("2d");
  let targetRegime = "rotation";
  let animFrame = null;

  const BUFFER_SIZE = 300;
  const buffer = new Float32Array(BUFFER_SIZE);
  let writeHead = 0;
  let tick = 0;

  // Interpolated config values
  let liveAmplitude = 0.45;
  let liveFrequency = 0.10;
  let liveSpikeStrength = 0.35;
  let liveNoise = 0.05;
  let liveColorR = 59, liveColorG = 130, liveColorB = 246;

  // Expose regime setter for renderRegime() in app.js to call
  window.__pulseEkgSetRegime = function (regimeKey) {
    if (EKG_REGIME_CONFIG[regimeKey]) {
      targetRegime = regimeKey;
    }
  };

  function generateSample(t, amp, freq, spike, noise) {
    const base = Math.sin(t * freq) * amp;
    const phase = Math.sin(t * freq);
    const spikeVal = Math.pow(Math.max(0, phase), 4) * spike;
    const secondary = Math.sin(t * freq * 2.3) * amp * 0.12;
    const n = (Math.random() - 0.5) * noise;
    return base + spikeVal + secondary + n;
  }

  // Resize canvas to match container (HiDPI aware)
  function resizeCanvas() {
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return; // not visible yet
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function draw() {
    const config = EKG_REGIME_CONFIG[targetRegime] || EKG_REGIME_CONFIG.rotation;

    // Smooth interpolation toward target
    const lerp = 0.03;
    liveAmplitude += (config.amplitude - liveAmplitude) * lerp;
    liveFrequency += (config.frequency - liveFrequency) * lerp;
    liveSpikeStrength += (config.spikeStrength - liveSpikeStrength) * lerp;
    liveNoise += (config.noise - liveNoise) * lerp;

    const [tr, tg, tb] = config.colorRgb.split(",").map(s => parseInt(s.trim()));
    liveColorR += (tr - liveColorR) * lerp;
    liveColorG += (tg - liveColorG) * lerp;
    liveColorB += (tb - liveColorB) * lerp;

    // Generate new samples (speed tied to BPM)
    const samplesPerFrame = Math.max(1, Math.round(config.bpm / 40));
    for (let i = 0; i < samplesPerFrame; i++) {
      const sample = generateSample(tick, liveAmplitude, liveFrequency, liveSpikeStrength, liveNoise);
      buffer[writeHead % BUFFER_SIZE] = sample;
      writeHead++;
      tick++;
    }

    // Get actual CSS pixel dimensions
    const wrap = canvas.parentElement;
    const w = wrap ? wrap.getBoundingClientRect().width : canvas.width;
    const h = wrap ? wrap.getBoundingClientRect().height : canvas.height;
    if (w === 0 || h === 0) {
      animFrame = requestAnimationFrame(draw);
      return;
    }
    const midY = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Faint grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 0.5;
    for (let gy = 0; gy < h; gy += h / 4) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    const r = Math.round(liveColorR);
    const g = Math.round(liveColorG);
    const b = Math.round(liveColorB);

    const visibleSamples = Math.min(BUFFER_SIZE, writeHead);
    const startIdx = Math.max(0, writeHead - visibleSamples);

    // Glow layer (thicker)
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < visibleSamples; i++) {
      const x = (i / visibleSamples) * w;
      const val = buffer[(startIdx + i) % BUFFER_SIZE];
      const y = midY - val * midY * 0.8;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Main line (crisp)
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.85)`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < visibleSamples; i++) {
      const x = (i / visibleSamples) * w;
      const val = buffer[(startIdx + i) % BUFFER_SIZE];
      const y = midY - val * midY * 0.8;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Leading dot
    if (visibleSamples > 1) {
      const lastVal = buffer[(writeHead - 1) % BUFFER_SIZE];
      const dotX = w - 2;
      const dotY = midY - lastVal * midY * 0.8;

      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
      ctx.fill();
    }

    // Fade-out on left edge — use transparent black since wrap has its own bg
    const fadeGrad = ctx.createLinearGradient(0, 0, 50, 0);
    fadeGrad.addColorStop(0, "rgba(0, 0, 0, 1)");
    fadeGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(0, 0, 50, h);
    ctx.globalCompositeOperation = "source-over";

    animFrame = requestAnimationFrame(draw);
  }

  // Start drawing
  draw();

  // Pause when tab is hidden
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = null;
    } else {
      if (!animFrame) draw();
    }
  });



  // ── 7. SJ FLOW GAUGE — Buy vs Sell Pressure Field ──────────────────────────
// Append this to feature-additions.js (after the EKG block)

(function initFlowGauge() {
    const container = document.getElementById("flowRows");
    const summaryEl = document.getElementById("flowSummaryValue");
    if (!container) return;
  
    // ── Category definitions ──
    const CATEGORIES = {
      crypto: [
        { key: "largecap",  name: "Large Cap",     sub: "BTC · ETH · SOL",       filter: r => (r.marketCap || 0) >= 10e9 },
        { key: "midcap",    name: "Mid Cap",        sub: "Top 20–80 by MCap",     filter: r => { const m = r.marketCap||0; return m >= 1e9 && m < 10e9; } },
        { key: "smallcap",  name: "Small Cap",      sub: "Under $1B MCap",        filter: r => (r.marketCap || 0) < 1e9 && (r.marketCap || 0) > 0 },
        { key: "altcoins",  name: "Altcoin Index",  sub: "All non-BTC movers",    filter: r => { const s = (r.coinSymbol||r.symbol||"").toUpperCase(); return s !== "BTC"; } },
        { key: "memecoins", name: "Meme / Micro",   sub: "High vol, low MCap",    filter: r => { const m = r.marketCap||0; const v = r.volume||0; return m > 0 && m < 500e6 && v/m > 0.3; } },
        { key: "overall",   name: "Crypto Overall", sub: "All qualifying movers",  filter: () => true },
      ],
      stocks: [
        { key: "megacap",   name: "Mega Cap",       sub: "AAPL · MSFT · NVDA",    filter: r => (r.marketCap || 0) >= 200e9 },
        { key: "largecap",  name: "Large Cap",       sub: "$10B – $200B",          filter: r => { const m = r.marketCap||0; return m >= 10e9 && m < 200e9; } },
        { key: "midcap",    name: "Mid Cap",         sub: "$2B – $10B",            filter: r => { const m = r.marketCap||0; return m >= 2e9 && m < 10e9; } },
        { key: "smallcap",  name: "Small Cap",       sub: "Under $2B",             filter: r => (r.marketCap || 0) < 2e9 && (r.marketCap || 0) > 0 },
        { key: "highrvol",  name: "High RVOL",       sub: "Vol 1.5x+ average",     filter: r => r.avgVolume > 0 && (r.volume / r.avgVolume) >= 1.5 },
        { key: "overall",   name: "Stocks Overall",  sub: "All qualifying movers",  filter: () => true },
      ],
    };
  
    // ── Buy-side color palettes ──
    // Crypto: blue → green gradient
    // Stocks: straight green
    const BUY_COLORS = {
      crypto: {
        gradStops: [
          { pos: 0,    rgba: "59, 130, 246, 0.04" },   // blue, faint
          { pos: 0.25, rgba: "59, 130, 246, 0.15" },   // blue
          { pos: 0.5,  rgba: "34, 197, 150, 0.30" },   // teal blend
          { pos: 0.75, rgba: "34, 197, 94, 0.50" },    // green
          { pos: 1,    rgba: "74, 222, 128, 0.70" },   // bright green
        ],
        lineGlow:   "rgba(59, 180, 200, 0.12)",
        particleR: 50, particleG: 200, particleB: 160,  // teal-ish
        particleGlowR: 34, particleGlowG: 197, particleGlowB: 140,
        pctR: 100, pctG: 220, pctB: 180,                // label color
      },
      stocks: {
        gradStops: [
          { pos: 0,    rgba: "34, 197, 94, 0.04" },
          { pos: 0.3,  rgba: "34, 197, 94, 0.12" },
          { pos: 0.6,  rgba: "34, 197, 94, 0.28" },
          { pos: 0.85, rgba: "74, 222, 128, 0.50" },
          { pos: 1,    rgba: "74, 222, 128, 0.70" },
        ],
        lineGlow:   "rgba(74, 222, 128, 0.10)",
        particleR: 74, particleG: 222, particleB: 128,
        particleGlowR: 34, particleGlowG: 197, particleGlowB: 94,
        pctR: 74, pctG: 222, pctB: 128,
      },
    };
  
    // Sell side is always red (same for both modes)
    const SELL_COLORS = {
      gradStops: [
        { pos: 0,    rgba: "248, 113, 113, 0.70" },
        { pos: 0.15, rgba: "239, 68, 68, 0.50" },
        { pos: 0.4,  rgba: "239, 68, 68, 0.28" },
        { pos: 0.7,  rgba: "239, 68, 68, 0.12" },
        { pos: 1,    rgba: "239, 68, 68, 0.04" },
      ],
      particleR: 248, particleG: 113, particleB: 113,
      particleGlowR: 239, particleGlowG: 68, particleGlowB: 68,
      pctR: 248, pctG: 113, pctB: 113,
    };
  
    // ── Compute pressure from a group of rows ──
    function groupPressure(rows, mode) {
      if (!rows.length) return 50;
      let total = 0;
      rows.forEach(r => {
        const pct = r.pctChange || 0;
        const momentum = Math.tanh(pct / 100 * 3);
        const price = r.price || 0;
        const hi = r.dayHigh || r.high24h || price;
        const lo = r.dayLow  || r.low24h  || price;
        let range = 0.5;
        if (hi !== lo) range = Math.max(0, Math.min(1, (price - lo) / (hi - lo)));
        const vol = r.volume || 0;
        const mcap = r.marketCap || 1;
        const avgVol = r.avgVolume || 0;
        let volC = 0.5;
        if (mode === "stocks" && avgVol > 0) volC = Math.min(1, (vol / avgVol) / 5);
        else if (mcap > 0) volC = Math.min(1, (vol / mcap) * 3);
        const raw = (momentum + 1) / 2;
        total += Math.max(0, Math.min(100, (raw * 0.5 + range * 0.3 + volC * 0.2) * 100));
      });
      return total / rows.length;
    }
  
    // ── Particle system ──
    class Particles {
      constructor() { this.list = []; this.max = 40; }
  
      emit(x, y, h, buyRatio, buyCol, sellCol) {
        if (this.list.length >= this.max || Math.random() > 0.35) return;
        const isBuy = Math.random() < buyRatio;
        const col = isBuy ? buyCol : sellCol;
        this.list.push({
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * h * 0.6,
          vx: isBuy ? -(1 + Math.random() * 2.5) : (1 + Math.random() * 2.5),
          vy: (Math.random() - 0.5) * 1.2,
          life: 1, decay: 0.012 + Math.random() * 0.018,
          size: 1.2 + Math.random() * 2,
          r: col.r, g: col.g, b: col.b,
          gr: col.gr, gg: col.gg, gb: col.gb,
        });
      }
  
      update() {
        for (let i = this.list.length - 1; i >= 0; i--) {
          const p = this.list[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += (Math.random() - 0.5) * 0.15;
          p.life -= p.decay;
          if (p.life <= 0) this.list.splice(i, 1);
        }
      }
  
      draw(ctx) {
        this.list.forEach(p => {
          const a = p.life * 0.7;
          // Glow
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size + 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${p.gr},${p.gg},${p.gb},${a * 0.15})`;
          ctx.fill();
          // Core
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${a})`;
          ctx.fill();
        });
      }
    }
  
    // ── Bar state ──
    const bars = [];
    let raf = null;
    let time = 0;
    let activeMode = "crypto"; // syncs with app.js toggle
  
    function makeBar(canvas, targetBuy) {
      return {
        canvas,
        ctx: canvas.getContext("2d"),
        target: targetBuy,
        current: 50,
        particles: new Particles(),
        wp1: Math.random() * Math.PI * 2,
        wp2: Math.random() * Math.PI * 2,
      };
    }
  
    // ── Draw one bar ──
    function drawBar(bar) {
      const { canvas, ctx, particles } = bar;
      const dpr = window.devicePixelRatio || 1;
      const wrap = canvas.parentElement;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
  
      const cw = Math.round(w * dpr);
      const ch = Math.round(h * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  
      bar.current += (bar.target - bar.current) * 0.04;
      const buyRatio = bar.current / 100;
      const contactX = buyRatio * w;
      const midY = h / 2;
  
      ctx.clearRect(0, 0, w, h);
  
      // ── Wavy boundary points ──
      const waveAmp = 6 + Math.sin(time * 0.7 + bar.wp2) * 3;
      const wf = 0.08;
      const wavePts = [];
      for (let y = -2; y <= h + 2; y += 2) {
        const w1 = Math.sin(y * wf + time * 1.8 + bar.wp1) * waveAmp;
        const w2 = Math.sin(y * wf * 1.7 + time * 2.4 + bar.wp2) * waveAmp * 0.5;
        const w3 = Math.sin(y * wf * 0.5 + time * 0.9) * waveAmp * 0.3;
        wavePts.push({ y, x: contactX + w1 + w2 + w3 });
      }
  
      const buyCfg = BUY_COLORS[activeMode] || BUY_COLORS.crypto;
  
      // ── Buy side (left of wave) ──
      ctx.beginPath();
      ctx.moveTo(0, 0);
      wavePts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(0, h);
      ctx.closePath();
  
      const buyGrad = ctx.createLinearGradient(0, 0, contactX + 20, 0);
      buyCfg.gradStops.forEach(s => buyGrad.addColorStop(s.pos, `rgba(${s.rgba})`));
      ctx.fillStyle = buyGrad;
      ctx.fill();
  
      // ── Sell side (right of wave) ──
      ctx.beginPath();
      ctx.moveTo(w, 0);
      wavePts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(w, h);
      ctx.closePath();
  
      const sellGrad = ctx.createLinearGradient(contactX - 20, 0, w, 0);
      SELL_COLORS.gradStops.forEach(s => sellGrad.addColorStop(s.pos, `rgba(${s.rgba})`));
      ctx.fillStyle = sellGrad;
      ctx.fill();
  
      // ── Wavy contact line ──
      ctx.beginPath();
      wavePts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.stroke();
  
      ctx.strokeStyle = buyCfg.lineGlow;
      ctx.lineWidth = 3;
      ctx.stroke();
  
      ctx.strokeStyle = "rgba(255,255,255,0.30)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
  
      // ── Particles ──
      const buyParticle = { r: buyCfg.particleR, g: buyCfg.particleG, b: buyCfg.particleB, gr: buyCfg.particleGlowR, gg: buyCfg.particleGlowG, gb: buyCfg.particleGlowB };
      const sellParticle = { r: SELL_COLORS.particleR, g: SELL_COLORS.particleG, b: SELL_COLORS.particleB, gr: SELL_COLORS.particleGlowR, gg: SELL_COLORS.particleGlowG, gb: SELL_COLORS.particleGlowB };
  
      const ep = wavePts[Math.floor(Math.random() * wavePts.length)];
      if (ep) particles.emit(ep.x, ep.y, h, buyRatio, buyParticle, sellParticle);
      if (Math.random() < 0.5) {
        const ep2 = wavePts[Math.floor(Math.random() * wavePts.length)];
        if (ep2) particles.emit(ep2.x, ep2.y, h, buyRatio, buyParticle, sellParticle);
      }
      particles.update();
      particles.draw(ctx);
  
      // ── Percentage labels ──
      const buyPct = Math.round(bar.current);
      const sellPct = 100 - buyPct;
  
      ctx.font = "700 11px system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "middle";
  
      if (contactX > 50) {
        ctx.textAlign = "left";
        ctx.fillStyle = `rgba(${buyCfg.pctR},${buyCfg.pctG},${buyCfg.pctB},${Math.min(0.8, buyRatio * 1.5)})`;
        ctx.fillText(`${buyPct}%`, 10, midY);
      }
  
      if (w - contactX > 50) {
        ctx.textAlign = "right";
        ctx.fillStyle = `rgba(${SELL_COLORS.pctR},${SELL_COLORS.pctG},${SELL_COLORS.pctB},${Math.min(0.8, (1 - buyRatio) * 1.5)})`;
        ctx.fillText(`${sellPct}%`, w - 10, midY);
      }
    }
  
    // ── Animation loop ──
    function animate() {
      time += 0.016;
      bars.forEach(drawBar);
      raf = requestAnimationFrame(animate);
    }
  
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      } else {
        if (!raf && bars.length) animate();
      }
    });
  
    // ── Render ──
    function renderCategories(categories, buyScores) {
      container.innerHTML = "";
      bars.length = 0;
  
      categories.forEach((cat, idx) => {
        const buy = buyScores[idx] || 50;
        const net = buy - 50;
        const netStr = net >= 0 ? `+${Math.round(net)}` : `${Math.round(net)}`;
        const netClass = net > 5 ? "flow-bullish" : net < -5 ? "flow-bearish" : "flow-neutral";
  
        const row = document.createElement("div");
        row.className = "flow-row";
        row.innerHTML = `
          <div class="flow-label">
            <span class="flow-label-name">${cat.name}</span>
            <span class="flow-label-sub">${cat.sub}</span>
          </div>
          <div class="flow-bar-wrap">
            <canvas class="flow-bar-canvas" id="flowBar${idx}"></canvas>
          </div>
          <span class="flow-net ${netClass}">${netStr}</span>
        `;
        container.appendChild(row);
  
        bars.push(makeBar(document.getElementById(`flowBar${idx}`), buy));
      });
  
      // Summary
      if (summaryEl) {
        const avg = buyScores.reduce((s, v) => s + v, 0) / buyScores.length;
        const net = avg - 50;
        if (net > 5) {
          summaryEl.textContent = `Buyers Dominate +${Math.round(net)}`;
          summaryEl.className = "flow-summary-value flow-val-bullish";
        } else if (net < -5) {
          summaryEl.textContent = `Sellers Dominate ${Math.round(net)}`;
          summaryEl.className = "flow-summary-value flow-val-bearish";
        } else {
          summaryEl.textContent = "Balanced";
          summaryEl.className = "flow-summary-value flow-val-neutral";
        }
      }
  
      if (!raf) animate();
    }
  
    // ── Fetch and compute ──
    async function fetchFlow(mode) {
      activeMode = mode;
      const cats = CATEGORIES[mode];
  
      let buyScores;
      try {
        const endpoint = mode === "stocks"
          ? "https://api.stockjelli.com/api/stocks?limit=30&mcapMin=100000000"
          : "https://api.stockjelli.com/api/crypto?limit=30&mcapMin=50000000";
  
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        const rows = data.rows || [];
  
        buyScores = cats.map(cat => {
          const filtered = rows.filter(cat.filter);
          return groupPressure(filtered, mode);
        });
      } catch (e) {
        console.warn("[FlowGauge] API error, fallback:", e);
        buyScores = cats.map(() => 40 + Math.random() * 30);
      }
  
      renderCategories(cats, buyScores);
    }
  
    // ── Sync with the existing Stocks/Crypto asset toggle in app.js ──
    // Listen for clicks on the same #assetControl segmented control
    const assetControl = document.getElementById("assetControl");
    if (assetControl) {
      assetControl.addEventListener("click", (e) => {
        const btn = e.target.closest(".segmented-btn");
        if (!btn) return;
        const mode = btn.dataset.value === "crypto" ? "crypto" : "stocks";
        fetchFlow(mode);
      });
    }
  
    // ── Handle resize ──
    window.addEventListener("resize", () => {
      bars.forEach(b => { b.current = b.target; });
    });
  
    // ── Init: match whatever mode is currently active ──
    const activeBtn = assetControl?.querySelector(".segmented-on");
    const initMode = activeBtn?.dataset?.value === "crypto" ? "crypto" : "stocks";
    fetchFlow(initMode);
  
    // ── Refresh every 60s alongside the main data ──
    setInterval(() => fetchFlow(activeMode), 60_000);
  
  })();





  
})();