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



// ── 7. MOMENTUM RIVER v3 — Targeted visual upgrades (performance-safe) ──────
// Replaces previous river.js in feature-additions.js
// 
// Changes from v1:
// - Tightened color hierarchy (strong=teal-green, moderate=desaturated, weak=amber/red)
// - Bearish particles: slower speed + heavier glow
// - "Current" brightness gradient across center of river
// - Particles brighten in center, dim at edges
// - No ctx.filter, no radial gradients per frame, no parallax layers

(function initMomentumRiver() {
    const moversCanvas = document.getElementById("riverMoversCanvas");
    const benchCanvas  = document.getElementById("riverBenchCanvas");
    const moversLabels = document.getElementById("riverMoversLabels");
    const benchLabels  = document.getElementById("riverBenchLabels");
    const moversWrap   = document.getElementById("riverMoversWrap");
    const benchWrap    = document.getElementById("riverBenchWrap");
    const moversLabel  = document.getElementById("riverMoversLabel");
    const benchLabel   = document.getElementById("riverBenchLabel");
  
    if (!moversCanvas || !benchCanvas) return;
  
    const moversCtx = moversCanvas.getContext("2d");
    const benchCtx  = benchCanvas.getContext("2d");
  
    let activeMode = "crypto";
    let moversLanes = [];
    let benchLanes = [];
    let raf = null;
    let time = 0;
  
    const MIN_LANE_H = 30;
    const MAX_MOVERS = 10;
    const LANE_GAP = 1;
  
    // ═══════════════════════════════════════════════════════════════════════════
    // COLOR HIERARCHY — strong=teal-green, moderate=desaturated, weak=amber/red
    // ═══════════════════════════════════════════════════════════════════════════
  
    function moverColor(pct, mode, alpha) {
      if (mode === "crypto") {
        if (pct >= 12) return `rgba(34, 255, 160, ${alpha})`;   // brilliant teal-green (earned)
        if (pct >= 8)  return `rgba(50, 230, 170, ${alpha})`;   // strong teal
        if (pct >= 5)  return `rgba(59, 200, 210, ${alpha})`;   // teal-blue
        if (pct >= 3)  return `rgba(80, 180, 200, ${alpha})`;   // blue, less saturated
        if (pct >= 0)  return `rgba(100, 160, 180, ${alpha})`;  // cool desaturated
        if (pct >= -3) return `rgba(210, 150, 90, ${alpha})`;   // warm amber
        return `rgba(220, 85, 70, ${alpha})`;                    // red
      } else {
        if (pct >= 12) return `rgba(34, 255, 130, ${alpha})`;
        if (pct >= 8)  return `rgba(60, 230, 120, ${alpha})`;
        if (pct >= 5)  return `rgba(80, 210, 130, ${alpha})`;
        if (pct >= 3)  return `rgba(110, 190, 140, ${alpha})`;
        if (pct >= 0)  return `rgba(130, 170, 150, ${alpha})`;
        if (pct >= -3) return `rgba(210, 140, 90, ${alpha})`;
        return `rgba(220, 85, 70, ${alpha})`;
      }
    }
  
    // Benchmarks: muted, intentionally "heavier" feel
    function benchColorFn(pct, alpha) {
      if (pct >= 0.5) return `rgba(70, 130, 120, ${alpha})`;
      if (pct >= 0)   return `rgba(90, 120, 140, ${alpha})`;
      if (pct >= -1)  return `rgba(170, 115, 85, ${alpha})`;
      return `rgba(200, 85, 70, ${alpha})`;
    }
  
    // ═══════════════════════════════════════════════════════════════════════════
    // PARTICLES — simple, no blur, bearish = slower + heavier glow
    // ═══════════════════════════════════════════════════════════════════════════
  
    function createParticles(lane, isBench) {
      const particles = [];
      const count = Math.floor(lane.h * 0.65) + 8;
  
      for (let i = 0; i < count; i++) {
        const size = 0.8 + Math.random() * 2.4;
        const alpha = 0.1 + Math.random() * 0.35;
        // Bearish particles: slower, slightly bigger glow radius
        const isBearish = lane.pct < 0;
        const speedMult = isBearish
          ? (0.25 + Math.random() * 0.45)   // slow
          : (0.5 + Math.random() * 0.9);    // normal
  
        particles.push({
          x: Math.random() * 2000,
          y: lane.y + 3 + Math.random() * (lane.h - 6),
          size,
          alpha,
          speedMult,
          isBearish,
          glowExtra: isBearish ? 1.5 : 0,  // heavier glow for bearish
          wobblePhase: Math.random() * Math.PI * 2,
        });
      }
  
      return particles;
    }
  
    // ═══════════════════════════════════════════════════════════════════════════
    // LANE BUILDING
    // ═══════════════════════════════════════════════════════════════════════════
  
    function buildLanes(data, isBench) {
      return data.map((d, i) => ({
        sym: d.sym,
        pct: d.pct,
        vol: d.vol || 0.5,
        speed: Math.max(0.3, Math.abs(d.pct) / 100 * 8 + 0.4),
        direction: d.pct >= 0 ? 1 : -1,
        isBench,
        y: 0, h: 0,
        wavePhase: Math.random() * Math.PI * 2,
        particles: [],
      }));
    }
  
    function layoutLanes(lanes, canvasEl, isBench) {
      if (!lanes.length) { canvasEl.style.height = "0px"; return; }
  
      const totalVol = lanes.reduce((s, l) => s + l.vol, 0) || 1;
      let yOff = 0;
  
      lanes.forEach(l => {
        const fraction = l.vol / totalVol;
        l.h = Math.max(MIN_LANE_H, MIN_LANE_H + fraction * 90);
        l.y = yOff;
        yOff += l.h + LANE_GAP;
        l.particles = createParticles(l, isBench);
      });
  
      canvasEl.style.height = (yOff - LANE_GAP) + "px";
    }
  
    // ═══════════════════════════════════════════════════════════════════════════
    // LABELS — with count-up animation on % values
    // ═══════════════════════════════════════════════════════════════════════════
  
    function buildLabelsDOM(lanes, labelEl) {
      labelEl.innerHTML = "";
      lanes.forEach(l => {
        const div = document.createElement("div");
        div.className = "river-lane-label";
        div.style.height = l.h + "px";
  
        const pctSpan = document.createElement("span");
        pctSpan.className = `river-lane-pct ${l.pct >= 0 ? "up" : "down"}`;
  
        div.innerHTML = `<span class="river-lane-sym">${l.sym}</span>`;
        div.appendChild(pctSpan);
        labelEl.appendChild(div);
  
        // Count-up animation
        const target = l.pct;
        const sign = target >= 0 ? "+" : "";
        const duration = 800;
        const start = performance.now();
  
        function tick(now) {
          const elapsed = now - start;
          const progress = Math.min(1, elapsed / duration);
          // Ease-out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = target * eased;
          pctSpan.textContent = `${current >= 0 ? "+" : ""}${current.toFixed(1)}%`;
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }
  
    // ═══════════════════════════════════════════════════════════════════════════
    // DRAW ENGINE — no blur, no per-frame radial gradients
    // ═══════════════════════════════════════════════════════════════════════════
  
    function drawLanes(lanes, canvas, ctx, mode, isBench) {
      const dpr = window.devicePixelRatio || 1;
      const wrap = canvas.parentElement;
      const w = wrap.clientWidth;
      const h = parseInt(canvas.style.height) || 100;
      if (w === 0 || h === 0) return;
  
      const cw = Math.round(w * dpr);
      const ch = Math.round(h * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
  
      const colorFn = isBench
        ? (pct, a) => benchColorFn(pct, a)
        : (pct, a) => moverColor(pct, mode, a);
  
      // ── Benchmark: darker wash ──
      if (isBench) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
        ctx.fillRect(0, 0, w, h);
      }
  
      // ── "Current" gradient — brightness lift in center ──
      if (!isBench) {
        const currentGrad = ctx.createLinearGradient(0, 0, w, 0);
        currentGrad.addColorStop(0, "rgba(255,255,255,0)");
        currentGrad.addColorStop(0.3, "rgba(255,255,255,0.008)");
        currentGrad.addColorStop(0.5, "rgba(255,255,255,0.02)");
        currentGrad.addColorStop(0.7, "rgba(255,255,255,0.008)");
        currentGrad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = currentGrad;
        ctx.fillRect(0, 0, w, h);
      }
  
      lanes.forEach(l => {
        const midY = l.y + l.h / 2;
        const absPct = Math.abs(l.pct);
  
        // ── Lane band — soft horizontal gradient ──
        const bandAlpha = isBench ? 0.02 : (0.02 + Math.min(0.04, absPct / 100 * 0.25));
        const bandGrad = ctx.createLinearGradient(0, l.y, 0, l.y + l.h);
        bandGrad.addColorStop(0, "rgba(255,255,255,0.003)");
        bandGrad.addColorStop(0.35, colorFn(l.pct, bandAlpha));
        bandGrad.addColorStop(0.65, colorFn(l.pct, bandAlpha));
        bandGrad.addColorStop(1, "rgba(255,255,255,0.003)");
        ctx.fillStyle = bandGrad;
        ctx.fillRect(0, l.y, w, l.h);
  
        // ── Straight lane border (clean line, not wavy) ──
        ctx.strokeStyle = "rgba(255,255,255,0.025)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, l.y);
        ctx.lineTo(w, l.y);
        ctx.stroke();
  
        // ── Chevrons drifting with stream ──
        if (!isBench && absPct >= 2) {
          const chevronSpacing = 220;
          const chevronAlpha = Math.min(0.07, absPct / 100 * 0.3 + 0.012);
          ctx.fillStyle = colorFn(l.pct, chevronAlpha);
          ctx.font = `600 ${Math.max(11, l.h * 0.28)}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
  
          const chevChar = l.direction > 0 ? "›  ›  ›" : "‹  ‹  ‹";
          const offset = (time * l.speed * l.direction * 35) % chevronSpacing;
          for (let x = 130 + offset; x < w + chevronSpacing; x += chevronSpacing) {
            ctx.fillText(chevChar, x, midY);
          }
        }
  
        // ── PARTICLES ──
        l.particles.forEach(p => {
          p.x += l.speed * l.direction * p.speedMult;
  
          const wy = Math.sin(p.x * 0.005 + time * 0.8 + p.wobblePhase) * 2.5;
  
          // Wrap
          if (l.direction > 0 && p.x > w + 30) p.x = -30;
          if (l.direction < 0 && p.x < -30) p.x = w + 30;
  
          const drawY = Math.max(l.y + 2, Math.min(l.y + l.h - 2, p.y + wy));
  
          // ── Current brightness — brighten in center, dim at edges ──
          let currentBoost = 0;
          if (!isBench) {
            const centerDist = Math.abs(p.x - w * 0.5) / (w * 0.5);
            currentBoost = (1 - centerDist) * 0.1;
          }
  
          const effectiveAlpha = Math.min(0.9, p.alpha + currentBoost);
  
          // Glow ring (heavier for bearish)
          const glowRadius = p.size + 1.2 + p.glowExtra;
          ctx.beginPath();
          ctx.arc(p.x, drawY, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = colorFn(l.pct, effectiveAlpha * (p.isBearish ? 0.15 : 0.1));
          ctx.fill();
  
          // Core dot
          ctx.beginPath();
          ctx.arc(p.x, drawY, p.size, 0, Math.PI * 2);
          ctx.fillStyle = colorFn(l.pct, effectiveAlpha);
          ctx.fill();
        });
      });
    }
  
    // ═══════════════════════════════════════════════════════════════════════════
    // ANIMATION LOOP
    // ═══════════════════════════════════════════════════════════════════════════
  
    function animate() {
      time += 0.016;
      drawLanes(moversLanes, moversCanvas, moversCtx, activeMode, false);
      drawLanes(benchLanes, benchCanvas, benchCtx, activeMode, true);
      raf = requestAnimationFrame(animate);
    }
  
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      } else {
        if (!raf && (moversLanes.length || benchLanes.length)) animate();
      }
    });
  
    // ═══════════════════════════════════════════════════════════════════════════
    // DATA FETCH
    // ═══════════════════════════════════════════════════════════════════════════
  
    async function fetchRiver(mode) {
      activeMode = mode;
  
      if (moversLabel) moversLabel.textContent = mode === "crypto" ? "Top Crypto Movers" : "Top Stock Movers";
      if (benchLabel)  benchLabel.textContent  = mode === "crypto" ? "Market Context · BTC & Total Crypto" : "Market Context · S&P 500 & NASDAQ";
  
      let moversData = [];
      let benchData = [];
  
      try {
        const endpoint = mode === "stocks"
          ? "https://api.stockjelli.com/api/stocks?limit=15&mcapMin=100000000"
          : "https://api.stockjelli.com/api/crypto?limit=15&mcapMin=50000000";
  
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        const rows = (data.rows || [])
          .filter(r => r.pctChange > 0)
          .sort((a, b) => b.pctChange - a.pctChange)
          .slice(0, MAX_MOVERS);
  
        const maxVol = Math.max(...rows.map(r => r.volume || 0), 1);
  
        moversData = rows.map(r => ({
          sym: mode === "crypto" ? (r.coinSymbol || r.symbol) : r.symbol,
          pct: r.pctChange || 0,
          vol: Math.max(0.15, (r.volume || 0) / maxVol),
        }));
  
        // Benchmarks from header
        if (mode === "crypto") {
          const btcPct = parseFloat(document.getElementById("idxLeftValue")?.textContent) || 0;
          const totalPct = parseFloat(document.getElementById("idxRightValue")?.textContent) || 0;
          benchData = [
            { sym: "BTC", pct: btcPct, vol: 0.6 },
            { sym: "Total Crypto", pct: totalPct, vol: 0.4 },
          ];
        } else {
          const nasdaqPct = parseFloat(document.getElementById("idxLeftValue")?.textContent) || 0;
          const spPct = parseFloat(document.getElementById("idxRightValue")?.textContent) || 0;
          benchData = [
            { sym: "NASDAQ", pct: nasdaqPct, vol: 0.5 },
            { sym: "S&P 500", pct: spPct, vol: 0.5 },
          ];
        }
      } catch (e) {
        console.warn("[MomentumRiver] API error, fallback:", e);
        moversData = [
          { sym: "SOL", pct: 12.4, vol: 0.85 },
          { sym: "PEPE", pct: 24.7, vol: 0.7 },
          { sym: "DOGE", pct: 8.1, vol: 0.65 },
          { sym: "ADA", pct: 5.5, vol: 0.55 },
          { sym: "NEAR", pct: 9.8, vol: 0.45 },
          { sym: "LINK", pct: 4.2, vol: 0.5 },
        ];
        benchData = [
          { sym: "BTC", pct: 1.8, vol: 0.6 },
          { sym: "Total Crypto", pct: 0.5, vol: 0.4 },
        ];
      }
  
      moversLanes = buildLanes(moversData, false);
      benchLanes  = buildLanes(benchData, true);
  
      layoutLanes(moversLanes, moversCanvas, false);
      layoutLanes(benchLanes, benchCanvas, true);
  
      buildLabelsDOM(moversLanes, moversLabels);
      buildLabelsDOM(benchLanes, benchLabels);
  
      if (!raf) animate();
    }
  
    // ── Sync with asset toggle ──
    const assetControl = document.getElementById("assetControl");
    if (assetControl) {
      assetControl.addEventListener("click", (e) => {
        const btn = e.target.closest(".segmented-btn");
        if (!btn) return;
        fetchRiver(btn.dataset.value === "crypto" ? "crypto" : "stocks");
      });
    }
  
    // ── Resize ──
    window.addEventListener("resize", () => {
      if (moversLanes.length) layoutLanes(moversLanes, moversCanvas, false);
      if (benchLanes.length)  layoutLanes(benchLanes, benchCanvas, true);
    });
  
    // ── Init ──
    const activeBtn = assetControl?.querySelector(".segmented-on");
    const initMode = activeBtn?.dataset?.value === "crypto" ? "crypto" : "stocks";
    fetchRiver(initMode);
  
    setInterval(() => fetchRiver(activeMode), 60_000);
  })();




  
})();