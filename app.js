(() => {
  if (window.__STOCKJELLI_APP_INIT__) return;
  window.__STOCKJELLI_APP_INIT__ = true;

  // ----------------------------
  // Config
  // ----------------------------
  const API_BASE = "https://api.stockjelli.com";
  const POLL_MS = 5_000;

  const MODE_DEFAULTS = {
    stocks: {
      limit: 15, pctMin: 4, volMin: 1_000_000, priceMax: 300, mcapDial: 0,
      newsRequired: false, highVolumeOnly: false,
    },
    crypto: {
      limit: 15, pctMin: 3, volMin: 1_000_000, priceMax: 300, mcapDial: 0,
      newsRequired: false, highVolumeOnly: false,
    },
  };

  const CRYPTO_MCAP_MIN = 5e7;
  const CRYPTO_MCAP_MAX = 1e11;
  const STOCK_MCAP_MIN = 1e8;
  const STOCK_MCAP_MAX = 5e11;

  // Track last visit for "new since last visit" markers
  const LAST_VISIT_KEY = "stockjelli_last_visit";
  const previousVisitTime = localStorage.getItem(LAST_VISIT_KEY) || null;
  localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());

  // Apply subscriber class to body
  if (localStorage.getItem("sj_subscriber_email")) {
    document.body.classList.add("sj-subscriber");
  }

  // ----------------------------
  // Helpers
  // ----------------------------
  async function apiGet(path) {
    const r = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`API ${path} -> ${r.status}`);
    return r.json();
  }

  function clamp(n, min, max) {
    const v = Number(n);
    if (!Number.isFinite(v)) return min;
    return Math.min(max, Math.max(min, v));
  }

  function classUpDown(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    return v >= 0 ? "up" : "down";
  }

  function fmtNum(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    return Number(n).toLocaleString();
  }

  function fmtUsd(n, decimals = 2) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "$—";
    return `$${Number(n).toFixed(decimals)}`;
  }

  function fmtPct(n, decimals = 2) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    const v = Number(n);
    const sign = v > 0 ? "+" : "";
    return `${sign}${v.toFixed(decimals)}%`;
  }

  function fmtCompactUsd(n, decimals = 1) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "$—";
    const v = Number(n);
    const abs = Math.abs(v);
    if (abs >= 1e12) return `$${(v / 1e12).toFixed(decimals)}T`;
    if (abs >= 1e9)  return `$${(v / 1e9).toFixed(decimals)}B`;
    if (abs >= 1e6)  return `$${(v / 1e6).toFixed(decimals)}M`;
    if (abs >= 1e3)  return `$${(v / 1e3).toFixed(decimals)}K`;
    return `$${v.toFixed(0)}`;
  }

  function fmtMoneyShort(n) {
    if (!Number.isFinite(n)) return "—";
    const abs = Math.abs(n);
    if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (abs >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
    if (abs >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
    return `$${Math.round(n).toLocaleString()}`;
  }

  function setSegmented(controlEl, value) {
    if (!controlEl) return;
    controlEl.querySelectorAll(".segmented-btn").forEach((btn) => {
      btn.classList.toggle("segmented-on", btn.dataset.value === value);
    });
  }

  function cryptoMcapFromDial(dial0to1000) {
    const t = clamp(dial0to1000, 0, 1000) / 1000;
    const logMin = Math.log10(CRYPTO_MCAP_MIN);
    const logMax = Math.log10(CRYPTO_MCAP_MAX);
    return Math.round(Math.pow(10, logMin + (logMax - logMin) * t));
  }

  function stockMcapFromDial(dial0to1000) {
    const t = clamp(dial0to1000, 0, 1000) / 1000;
    const logMin = Math.log10(STOCK_MCAP_MIN);
    const logMax = Math.log10(STOCK_MCAP_MAX);
    return Math.round(Math.pow(10, logMin + (logMax - logMin) * t));
  }

  // ----------------------------
  // DOM refs
  // ----------------------------
  const assetControl = document.getElementById("assetControl");
  const stocksTable = document.getElementById("stocksTable");
  const cryptoTable = document.getElementById("cryptoTable");
  const heroChartStocks = document.getElementById("heroChartStocks");
  const heroChartCrypto = document.getElementById("heroChartCrypto");
  const idxWrap = document.querySelector(".market-indices");
  const idxLeftLabel = document.getElementById("idxLeftLabel");
  const idxLeftValue = document.getElementById("idxLeftValue");
  const idxRightLabel = document.getElementById("idxRightLabel");
  const idxRightValue = document.getElementById("idxRightValue");
  let lastCryptoMcapMin = null;

  const filterEls = {
    mcapLabel: document.getElementById("mcapLabel"),
    mcapRange: document.getElementById("mcapRange"),
    mcapPillStocks: document.getElementById("mcapPillStocks"),
    mcapNumStocks: document.getElementById("mcapNumStocks"),
    mcapPillCrypto: document.getElementById("mcapPillCrypto"),
    mcapTextCrypto: document.getElementById("mcapTextCrypto"),
    mcapMetaLeft: document.getElementById("mcapMetaLeft"),
    mcapMetaRight: document.getElementById("mcapMetaRight"),
    priceRange: document.getElementById("priceRange"),
    volRange: document.getElementById("volRange"),
    newsRequiredChk: document.getElementById("newsRequiredChk"),
    highVolChk: document.getElementById("highVolChk"),
    applyBtn: document.getElementById("filtersApplyBtn"),
    resetBtn: document.getElementById("filtersResetBtn"),
  };

  const priceCard = filterEls.priceRange?.closest(".filter-card");
  const priceNum = priceCard?.querySelector(".pill .num") || null;
  const priceMetaLeft = priceCard?.querySelector(".filter-meta .muted:first-child") || null;
  const priceMetaRight = priceCard?.querySelector(".filter-meta .muted:last-child") || null;

  const volCard = filterEls.volRange?.closest(".filter-card");
  const volNum = volCard?.querySelector(".pill .num") || null;
  const volMetaLeft = volCard?.querySelector(".filter-meta .muted:first-child") || null;
  const volMetaRight = volCard?.querySelector(".filter-meta .muted:last-child") || null;

  function fmtVolume(n) {
    if (!Number.isFinite(n)) return "0";
    if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
    return String(n);
  }

  // ----------------------------
  // Renderers (cell-level)
  // ----------------------------

  function fmtVolumeCompact(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    const v = Number(n);
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return String(Math.round(v));
  }

  function renderRangeIndicator(low, high, current) {
    if (low === null || high === null || current === null)
      return '<span class="range-indicator range-na">—</span>';
    const lo = Number(low), hi = Number(high), cur = Number(current);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(cur))
      return '<span class="range-indicator range-na">—</span>';
    let position = 0.5;
    if (hi !== lo) position = Math.max(0, Math.min(1, (cur - lo) / (hi - lo)));
    const pct = Math.round(position * 100);
    const posClass = pct >= 70 ? "range-high" : pct <= 30 ? "range-low" : "range-mid";
    return `<span class="range-indicator ${posClass}" title="L: ${fmtUsd(lo, 2)} | H: ${fmtUsd(hi, 2)} | Now: ${fmtUsd(cur, 2)}"><span class="range-track"><span class="range-dot" style="left: ${pct}%"></span></span></span>`;
  }

  function renderNewsCell(news) {
    if (!Array.isArray(news) || news.length === 0) return '<span class="news-none">—</span>';
    const item = news[0];
    if (!item) return '<span class="news-none">—</span>';
    const source = item.source || "News";
    const tier = item.tier || 3;
    const tierClass = tier === 1 ? "news-tier1" : tier === 2 ? "news-tier2" : "news-tier3";
    if (item.url) return `<a class="news-source ${tierClass}" href="${item.url}" target="_blank" rel="noopener" title="${item.title || source}">${source}</a>`;
    return `<span class="news-source ${tierClass}" title="${item.title || ''}">${source}</span>`;
  }

  function renderNewBadge(enteredAt) {
    if (!previousVisitTime || !enteredAt) return "";
    try {
      if (new Date(enteredAt).getTime() > new Date(previousVisitTime).getTime())
        return ' <span class="new-badge-corner" title="New since last visit"></span>';
    } catch (e) {}
    return "";
  }

  function renderSJScore(score, idx) {
    if (score === null || score === undefined) return '<span class="sj-cell sj-na">—</span>';
    const s = Number(score);
    let tier = "sj-low", icon = "";
    if (s >= 75) { tier = "sj-high"; icon = " 🔥"; }
    else if (s >= 60) { tier = "sj-mid"; }
    const isUnlocked = !!localStorage.getItem("sj_subscriber_email");
    if (idx < 3 || isUnlocked)
      return `<span class="sj-cell ${tier}" title="SJ Momentum Strength Score">${s}${icon}</span>`;
    return `<span class="sj-cell sj-blurred-wrap"><span class="sj-blurred ${tier}">${s}${icon}</span><button class="sj-unlock-btn" title="Unlock all SJ Scores">🔒</button></span>`;
  }

  function renderOddsCell(odds) {
    if (!odds || odds.status === "gathering" || odds.status === "warming") {
      return '<span class="odds-pending" title="Gathering ~15 min of price action before odds appear">—</span>';
    }
    const tier = odds.bucket === "accelerating" ? "odds-accel"
               : odds.bucket === "climbing"     ? "odds-climb"
               :                                  "odds-fade";
    if (odds.status === "thin") {
      return `<span class="odds-pill ${tier}" title="${odds.label} momentum — not enough resolved history yet to show a rate">${odds.label}</span>`;
    }
    if (odds.status === "count") {
      return `<span class="odds-pill ${tier}" title="${odds.label}: ${odds.hits} of ${odds.n} similar entries cleared +3% cleanly"><span class="odds-frac">${odds.display}</span></span>`;
    }
    return `<span class="odds-pill ${tier}" title="${odds.label}: ${odds.hits} of ${odds.n} similar entries reached +3% before dipping -2%. Historical frequency, not a prediction."><span class="odds-pct">${odds.pct}%</span><span class="odds-tier">${odds.label}</span></span>`;
  }

  function renderMagnitudeCell(mag) {
    if (!mag || mag.status === "warming" || mag.status === "gathering") {
      return '<span class="mag-build" title="Building this name\u2019s 8-week move history">building</span>';
    }
    if (mag.status === "thin") {
      const disp = mag.display || `${mag.hits}/${mag.n}`;
      return `<span class="mag-pill mag-build" title="${mag.hits} of ${mag.n} recent entries made a big move (\u00b15% in ~3 days). Too few to show a rate yet.">${disp}</span>`;
    }
    if (mag.status === "count") {
      const disp = mag.display || `${mag.hits}/${mag.n}`;
      return `<span class="mag-pill mag-count" title="${mag.hits} of ${mag.n} recent entries made a big move (\u00b15% in ~3 days). Gathering more before showing a %."><span class="mag-frac">${disp}</span><span class="mag-tier">gathering</span></span>`;
    }
    // status === "ok" — resolved %, server-rounded to fives
    const hot = mag.pct >= 60 ? " mag-hot" : "";
    const disp = mag.display || `\u2248${mag.pct}%`;
    return `<span class="mag-pill mag-ok${hot}" title="Over the last 8 weeks, ${mag.symbol || "this name"} made a big move (\u00b15% in ~3 days) ${mag.hits} of ${mag.n} times. Direction-agnostic \u2014 not a prediction of up or down."><span class="mag-pct">${disp}</span><span class="mag-tier">big move</span></span>`;
  }

  // ── Market Regime Config ──
  const REGIME_CONFIG = {
    expansion:   { color: "#22c55e", colorRgb: "34, 197, 94",   bpm: 62,  amplitude: 0.35, frequency: 0.07, spikeStrength: 0.25, noise: 0.02, label: "Expansion" },
    rotation:    { color: "#3b82f6", colorRgb: "59, 130, 246",  bpm: 78,  amplitude: 0.45, frequency: 0.10, spikeStrength: 0.35, noise: 0.05, label: "Rotation" },
    caution:     { color: "#f59e0b", colorRgb: "245, 158, 11",  bpm: 95,  amplitude: 0.55, frequency: 0.15, spikeStrength: 0.45, noise: 0.10, label: "Caution" },
    contraction: { color: "#ef4444", colorRgb: "239, 68, 68",   bpm: 120, amplitude: 0.75, frequency: 0.22, spikeStrength: 0.6,  noise: 0.18, label: "Contraction" },
  };

  function renderRegime(regime) {
    const bar = document.getElementById("regimeBar");
    const desc = document.getElementById("regimeDescription");
    const subDetail = document.getElementById("regimeSubDetail");
    const bpmNumber = document.getElementById("pulseBpmNumber");
    const bpmDot = document.getElementById("pulseBpmDot");
    const pulseInner = document.querySelector(".pulse-inner");
    if (!bar || !regime) return;
    const regimeKey = regime.regime || "rotation";
    const config = REGIME_CONFIG[regimeKey] || REGIME_CONFIG.rotation;
    bar.querySelectorAll("[data-regime]").forEach(seg => seg.classList.toggle("regime-active", seg.dataset.regime === regimeKey));
    if (desc) desc.textContent = regime.description || "Analyzing market conditions…";
    if (bpmNumber) bpmNumber.textContent = String(config.bpm);
    if (pulseInner) pulseInner.style.setProperty("--pulse-color", config.color);
    if (bpmDot) { bpmDot.style.background = config.color; bpmDot.style.boxShadow = `0 0 6px ${config.color}80`; }
    if (bpmDot && config.bpm) {
      if (window.__pulseBpmInterval) clearInterval(window.__pulseBpmInterval);
      const beatMs = (60 / config.bpm) * 1000;
      window.__pulseBpmInterval = setInterval(() => {
        bpmDot.classList.add("beat");
        setTimeout(() => bpmDot.classList.remove("beat"), beatMs * 0.3);
      }, beatMs);
    }
    if (window.__pulseEkgSetRegime) window.__pulseEkgSetRegime(regimeKey);
    if (subDetail) {
      const isSubscriber = !!localStorage.getItem("sj_subscriber_email");
      if (isSubscriber) {
        const impactClass = regime.sjMultiplier > 1 ? "regime-impact-positive" : regime.sjMultiplier < 1 ? "regime-impact-negative" : "regime-impact-neutral";
        subDetail.innerHTML = `<span class="regime-sub-text ${impactClass}">${regime.sjImpactLabel || ""}</span>`;
      } else {
        subDetail.innerHTML = `<span class="regime-locked">🔒 SJ impact hidden · <a href="#" id="regimeUnlockLink">Unlock with alerts →</a></span>`;
        document.getElementById("regimeUnlockLink")?.addEventListener("click", (e) => { e.preventDefault(); document.getElementById("enableAlertsBtn")?.click(); });
      }
    }
  }

  function getTradingViewUrl(symbol, type = "stock") {
    const aff = "162729";
    return type === "crypto"
      ? `https://www.tradingview.com/chart/?symbol=BINANCE:${symbol}USDT&aff_id=${aff}`
      : `https://www.tradingview.com/chart/?symbol=${symbol}&aff_id=${aff}`;
  }

  const failedLogos = new Set();

  function renderTickerCell(symbol, type = "stock", imageUrl = null, exchange = null) {
    const url = window.getBrokerUrl
      ? window.getBrokerUrl(symbol, type, exchange)
      : (type === "crypto"
          ? `https://www.tradingview.com/chart/?symbol=BINANCE:${symbol}USDT&aff_id=162729`
          : `https://www.tradingview.com/chart/?symbol=${symbol}&aff_id=162729`);
    
    const tooltip = window.getBrokerTooltip
      ? window.getBrokerTooltip(symbol)
      : `Open ${symbol} on TradingView ↗`;

    let logoHtml = "";
    if (type === "crypto" && imageUrl && !failedLogos.has(imageUrl)) {
      logoHtml = `<img class="ticker-logo" src="${imageUrl}" alt="" loading="lazy" onerror="window.__sjLogoFailed(this, '${imageUrl}')">`;
    } else if (type === "stock" && symbol && symbol !== "—" && !failedLogos.has(symbol)) {
      const src = "https://financialmodelingprep.com/image-stock/" + encodeURIComponent(symbol) + ".png";
      logoHtml = `<img class="ticker-logo" src="${src}" alt="" loading="lazy" onerror="window.__sjLogoFailed(this, '${symbol}')">`;
    }
    return `<span class="ticker-wrap">${logoHtml}<span class="ticker-symbol">${symbol}</span><a class="ticker-tv-link" href="${url}" target="_blank" rel="noopener" title="${tooltip}"><span class="ticker-tv-tooltip">${tooltip}</span></a></span>`;
  }

  window.__sjLogoFailed = function(el, key) {
    failedLogos.add(key);
    el.remove();
  };

  function renderWhaleIndicator(volume, avgVolume, marketCap, pctChange, rangePosition, mode) {
    if (!volume || !marketCap || marketCap === 0) return "";
    const pct = Math.abs(pctChange || 0);
    const rangePosVal = rangePosition ?? 0.5;
    const volMcapRatio = volume / marketCap;
    let isWhale = false;
    if (mode === "stock") {
      const rvol = (avgVolume && avgVolume > 0) ? (volume / avgVolume) : 0;
      isWhale = rvol >= 5.0 && volMcapRatio >= 0.03 && pct >= 8 && rangePosVal >= 0.50;
    } else if (mode === "crypto") {
      isWhale = volMcapRatio >= 0.50 && pct >= 10 && rangePosVal >= 0.50;
    }
    if (!isWhale) return "";
    const rvolText = (avgVolume && avgVolume > 0) ? `RVOL: ${(volume / avgVolume).toFixed(1)}x` : "";
    const tooltipParts = [rvolText, `Vol/MCap: ${(volMcapRatio * 100).toFixed(1)}%`, `Range: ${Math.round(rangePosVal * 100)}%`].filter(Boolean).join(" · ");
    return ` <span class="whale-indicator"><span class="liquidity-tooltip" style="--liq-color: rgba(96, 165, 250, 0.4)">Heavy flow detected — unusual institutional-level activity · ${tooltipParts}</span>🐋</span>`;
  }

  // Track peak prices since page load
  const peakSinceEntry = new Map();
  function updatePeakPrice(symbol, price, enteredPrice) {
    if (!symbol || !price || !enteredPrice) return;
    const prev = peakSinceEntry.get(symbol);
    if (!prev || price > prev) peakSinceEntry.set(symbol, price);
  }
  function getPeakPct(symbol, enteredPrice) {
    if (!symbol || !enteredPrice) return null;
    const peak = peakSinceEntry.get(symbol);
    if (!peak || !Number.isFinite(peak) || enteredPrice <= 0) return null;
    const pct = ((peak - enteredPrice) / enteredPrice) * 100;
    return Math.abs(pct) >= 0.3 ? pct : null;
  }

  function renderSinceEntryAttrs(currentPrice, enteredPrice, enteredAt, symbol) {
    if (!enteredPrice || !currentPrice || !enteredAt) return "";
    const current = Number(currentPrice), entry = Number(enteredPrice);
    if (!Number.isFinite(current) || !Number.isFinite(entry) || entry <= 0) return "";
    const sincePct = ((current - entry) / entry) * 100;
    if (Math.abs(sincePct) < 0.3) return "";
    const sign = sincePct >= 0 ? "+" : "";
    let dec = 2;
    if (entry > 0 && entry < 0.01) dec = Math.min(6, Math.max(2, Math.ceil(-Math.log10(entry)) + 1));
    let timeAgoText = "";
    try {
      const mins = Math.floor((Date.now() - new Date(enteredAt).getTime()) / 60000);
      if (mins < 1) timeAgoText = "just now";
      else if (mins < 60) timeAgoText = `${mins}m ago`;
      else { const h = Math.floor(mins / 60), m = mins % 60; timeAgoText = m > 0 ? `${h}h ${m}m ago` : `${h}h ago`; }
    } catch (e) {}
    const line1 = `${sign}${sincePct.toFixed(1)}% since entering screener`;
    let line2 = "";
    if (symbol) { const pp = getPeakPct(symbol, entry); if (pp !== null && pp > sincePct + 0.5) line2 = `Peak: +${pp.toFixed(1)}% since entry`; }
    const line3 = `Entered at $${entry.toFixed(dec)} · ${timeAgoText}`;
    const dir = sincePct >= 0 ? "up" : "down";
    return ` data-entry-line1="${line1}" data-entry-line2="${line2}" data-entry-line3="${line3}" data-entry-color="${dir}"`;
  }

  function renderSinceEntryMobile(currentPrice, enteredPrice, enteredAt, symbol) {
    if (!enteredPrice || !currentPrice || !enteredAt) return "";
    const current = Number(currentPrice), entry = Number(enteredPrice);
    if (!Number.isFinite(current) || !Number.isFinite(entry) || entry <= 0) return "";
    const sincePct = ((current - entry) / entry) * 100;
    if (Math.abs(sincePct) < 0.3) return "";
    const sign = sincePct >= 0 ? "+" : "", dir = sincePct >= 0 ? "up" : "down";
    let peakStr = "";
    if (symbol) { const pp = getPeakPct(symbol, entry); if (pp !== null && pp > sincePct + 0.5) peakStr = ` · pk +${pp.toFixed(1)}%`; }
    let dec = 2;
    if (entry > 0 && entry < 0.01) dec = Math.min(6, Math.max(2, Math.ceil(-Math.log10(entry)) + 1));
    return `<span class="since-entry-mobile ${dir}">${sign}${sincePct.toFixed(1)}%${peakStr} · $${entry.toFixed(dec)}</span>`;
  }

  function renderVolumeFire() { return ""; }

  function renderRvol(volume, avgVolume, marketCap, mode) {
    if (!volume) return '<span class="rvol-normal">—</span>';
    if (mode === "stock") {
      if (avgVolume && avgVolume > 0) {
        const ratio = volume / avgVolume;
        let tier = "rvol-normal", suffix = "";
        if (ratio >= 3.0) { tier = "rvol-hot"; suffix = " 🔥"; }
        else if (ratio >= 1.5) { tier = "rvol-warm"; }
        return `<span class="${tier}" title="Volume is ${ratio.toFixed(1)}× the average">${ratio.toFixed(1)}x${suffix}</span>`;
      }
      return '<span class="rvol-normal" title="Average volume data unavailable">—</span>';
    }
    if (mode === "crypto" && marketCap && marketCap > 0) {
      const ratio = volume / marketCap;
      let tier = "rvol-normal", suffix = "";
      if (ratio >= 0.50) { tier = "rvol-hot"; suffix = " 🔥"; }
      else if (ratio >= 0.15) { tier = "rvol-warm"; }
      return `<span class="${tier}" title="24h volume is ${ratio.toFixed(2)}× market cap">${ratio.toFixed(1)}x${suffix}</span>`;
    }
    return '<span class="rvol-normal">—</span>';
  }

  function renderRvolRaw(volume, avgVolume, marketCap, mode) {
    if (!volume) return null;
    if (mode === "stock" && avgVolume && avgVolume > 0) return `${(volume / avgVolume).toFixed(1)}x`;
    if (mode === "crypto" && marketCap && marketCap > 0) return `${(volume / marketCap).toFixed(1)}x`;
    return null;
  }

  function renderLiquidityDot(volume, marketCap) {
    if (!volume || !marketCap || marketCap === 0) return "";
    const ratio = volume / marketCap;
    let level, color;
    if (ratio >= 0.50) { level = "High Liquidity"; color = "#22c55e"; }
    else if (ratio >= 0.10) { level = "Medium Liquidity"; color = "#f59e0b"; }
    else { level = "Low Liquidity — exit may cause slippage"; color = "#ef4444"; }
    return ` <span class="liquidity-wrap"><span class="liquidity-dot" style="--liq-color: ${color}"></span><span class="liquidity-tooltip" style="--liq-color: ${color}">${level} (Vol/MCap: ${(ratio * 100).toFixed(1)}%)</span></span>`;
  }

  // ══════════════════════════════════════════════════════════════════
  // FLIP ANIMATION ENGINE — Bar Chart Race Style Reordering
  // ══════════════════════════════════════════════════════════════════
  //
  // Instead of replacing innerHTML (which destroys DOM and kills
  // animation), we:
  //   1. Build desired row HTML keyed by symbol
  //   2. Record current row positions (FIRST)
  //   3. Reorder DOM: update existing rows, add new, remove stale
  //   4. Record new positions (LAST)
  //   5. Apply inverse transform (INVERT) then animate to 0 (PLAY)
  //
  // Rows slide smoothly to their new rank positions.
  // New rows fade in. Removed rows fade out.
  // ══════════════════════════════════════════════════════════════════

  const FLIP_DURATION = 450; // ms for row slide animation
  const FADE_DURATION = 300; // ms for new/removed row fade

  /**
   * FLIP-animate rows in a tbody.
   * @param {HTMLElement} tbody - the <tbody> element
   * @param {Array<{key: string, html: string, data: object}>} newRows
   *   key = unique identifier (symbol)
   *   html = full innerHTML for the <tr>
   *   data = { price, pct } for number animation
   */
  function flipUpdateRows(tbody, newRows) {
    if (!tbody) return;

    // Handle empty state
    if (!newRows || newRows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px 0; color:rgba(255,255,255,0.3); font-size:0.85rem;">No data matching filters</td></tr>`;
      return;
    }

    // Remove loading placeholder and any non-data rows
    tbody.querySelectorAll("tr:not([data-symbol])").forEach(tr => tr.remove());

    // --- FIRST: snapshot current positions ---
    const firstPositions = new Map();
    const existingRows = new Map();
    tbody.querySelectorAll("tr[data-symbol]").forEach(tr => {
      const sym = tr.dataset.symbol;
      firstPositions.set(sym, tr.getBoundingClientRect());
      existingRows.set(sym, tr);
    });

    const isFirstRender = existingRows.size === 0;

    // --- BUILD: create/update row elements ---
    const newKeys = new Set(newRows.map(r => r.key));
    const fragment = document.createDocumentFragment();
    const keptRows = new Map();

    for (const { key, html, data } of newRows) {
      let tr = existingRows.get(key);
      if (tr) {
        // Existing row — update contents with number animation
        const oldPrice = parseFloat(tr.querySelector(".price-cell")?.dataset.rawPrice) || null;
        const oldPct = parseFloat(tr.querySelector(".change-pct")?.dataset.rawPct) || null;

        tr.innerHTML = html;

        // Animate numbers if changed
        if (!isFirstRender && data) {
          const priceCell = tr.querySelector(".price-cell");
          const pctCell = tr.querySelector(".change-pct");
          if (priceCell && oldPrice !== null && data.price !== null && oldPrice !== data.price) {
            animateNumber(priceCell, oldPrice, data.price, 400, formatPrice);
            flashCell(priceCell, data.price > oldPrice ? "up" : "down");
          }
          if (pctCell && oldPct !== null && data.pct !== null && Math.abs(oldPct - data.pct) > 0.005) {
            animateNumber(pctCell, oldPct, data.pct, 400, formatPct);
            flashCell(pctCell, data.pct > oldPct ? "up" : "down");
          }
        }
        keptRows.set(key, tr);
      } else {
        // New row — create fresh
        tr = document.createElement("tr");
        tr.dataset.symbol = key;
        tr.innerHTML = html;
        if (!isFirstRender) {
          // Will fade in
          tr.style.opacity = "0";
          tr.style.transform = "translateX(-20px)";
        }
        keptRows.set(key, tr);
      }
    }

    // --- Remove stale rows with fade-out ---
    existingRows.forEach((tr, sym) => {
      if (!newKeys.has(sym)) {
        tr.style.transition = `opacity ${FADE_DURATION}ms ease, transform ${FADE_DURATION}ms ease`;
        tr.style.opacity = "0";
        tr.style.transform = "translateX(20px)";
        tr.style.pointerEvents = "none";
        setTimeout(() => tr.remove(), FADE_DURATION);
      }
    });

    // --- Reorder DOM to match new order ---
    for (const { key } of newRows) {
      const tr = keptRows.get(key);
      if (tr) tbody.appendChild(tr);
    }

    // --- LAST: record new positions ---
    if (!isFirstRender) {
      const lastPositions = new Map();
      tbody.querySelectorAll("tr[data-symbol]").forEach(tr => {
        lastPositions.set(tr.dataset.symbol, tr.getBoundingClientRect());
      });

      // --- INVERT + PLAY ---
      tbody.querySelectorAll("tr[data-symbol]").forEach(tr => {
        const sym = tr.dataset.symbol;
        const first = firstPositions.get(sym);
        const last = lastPositions.get(sym);

        if (first && last) {
          // Existing row that moved position
          const deltaY = first.top - last.top;
          if (Math.abs(deltaY) > 1) {
            // INVERT: place at old position
            tr.style.transition = "none";
            tr.style.transform = `translateY(${deltaY}px)`;
            tr.style.zIndex = "10";

            // Force reflow
            void tr.offsetHeight;

            // PLAY: animate to new position
            tr.style.transition = `transform ${FLIP_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
            tr.style.transform = "translateY(0)";

            // Cleanup
            const onEnd = () => {
              tr.style.transition = "";
              tr.style.transform = "";
              tr.style.zIndex = "";
              tr.removeEventListener("transitionend", onEnd);
            };
            tr.addEventListener("transitionend", onEnd);
          }
        } else if (!first && last) {
          // New row — fade in
          void tr.offsetHeight;
          tr.style.transition = `opacity ${FADE_DURATION}ms ease ${FLIP_DURATION * 0.3}ms, transform ${FADE_DURATION}ms ease ${FLIP_DURATION * 0.3}ms`;
          tr.style.opacity = "1";
          tr.style.transform = "translateX(0)";
          setTimeout(() => {
            tr.style.transition = "";
          }, FADE_DURATION + FLIP_DURATION * 0.3 + 50);
        }
      });
    }

    trimMobileDecimals();
  }

  // ══════════════════════════════════════════════════════════════════
  // Number Animation Helpers
  // ══════════════════════════════════════════════════════════════════

  function animateNumber(el, from, to, duration, formatter) {
    const start = performance.now();
    // Lock cell width during animation to prevent column breathing
    el.style.minWidth = el.offsetWidth + "px";
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatter(from + (to - from) * eased, to);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        // Release width lock once final value is painted
        el.style.minWidth = "";
      }
    }
    requestAnimationFrame(tick);
  }

  function flashCell(el, direction) {
    el.classList.remove("num-flash-up", "num-flash-down");
    requestAnimationFrame(() => {
      el.classList.add(direction === "up" ? "num-flash-up" : "num-flash-down");
      setTimeout(() => el.classList.remove("num-flash-up", "num-flash-down"), 650);
    });
  }

  function formatPrice(current, finalValue) {
    if (!Number.isFinite(current)) return "$—";
    let decimals = 2;
    if (Number.isFinite(finalValue) && finalValue > 0 && finalValue < 0.01) {
      decimals = Math.min(6, Math.max(2, Math.ceil(-Math.log10(finalValue)) + 1));
    }
    return `$${current.toFixed(decimals)}`;
  }

  function formatPct(current) {
    if (!Number.isFinite(current)) return "—";
    const decimals = window.innerWidth <= 640 ? 1 : 2;
    return `${current > 0 ? "+" : ""}${current.toFixed(decimals)}%`;
  }

  // ══════════════════════════════════════════════════════════════════
  // RENDER STOCKS — Uses FLIP engine
  // ══════════════════════════════════════════════════════════════════

  function renderStocks(rows) {
    const tbody = document.getElementById("stocksTbody");
    if (!tbody) return;

    if (!rows || rows.length === 0) {
      flipUpdateRows(tbody, []);
      return;
    }

    const medals = ["🥇", "🥈", "🥉"];

    const flipRows = rows.map((x, idx) => {
      const pct = x.pctChange;
      const changeClass = classUpDown(pct);
      const rangeHtml = renderRangeIndicator(x.dayLow ?? x.rangeLow, x.dayHigh ?? x.rangeHigh, x.price);
      const newsHtml = renderNewsCell(x.news);
      const tickerHtml = renderTickerCell(x.symbol || "—", "stock", null, x.exchange || null);
      if (x.enteredPrice) updatePeakPrice(x.symbol, x.price, x.enteredPrice);
      const entryAttrs = renderSinceEntryAttrs(x.price, x.enteredPrice, x.enteredAt, x.symbol);

      const html = `
        <td class="ticker">${tickerHtml}${idx < 3 ? ' <span class="ticker-medal">' + medals[idx] + '</span>' : ''}${renderNewBadge(x.enteredAt)}${window.sjShareBtn ? window.sjShareBtn(x.symbol, x.pctChange, fmtUsd(x.price), renderRvolRaw(x.volume, x.avgVolume, x.marketCap, 'stock'), 'stock') : ''}</td>
        <td class="price-cell" data-raw-price="${x.price ?? ''}">${fmtUsd(x.price)}</td>
        <td class="${changeClass}">
          <span class="change-wrap">
            <span class="change-pct${entryAttrs ? ' has-entry-tooltip' : ''}" data-raw-pct="${pct ?? ''}"${entryAttrs}>${fmtPct(pct)}</span>
            ${rangeHtml}
          </span>${renderSinceEntryMobile(x.price, x.enteredPrice, x.enteredAt, x.symbol)}
        </td>
        <td>${fmtVolumeCompact(x.volume)}${renderVolumeFire(x.volume, x.avgVolume, x.marketCap, "stock")}${renderWhaleIndicator(x.volume, x.avgVolume, x.marketCap, x.pctChange, x.rangePosition, "stock")}</td>
        <td class="rvol">${renderRvol(x.volume, x.avgVolume, x.marketCap, "stock")}</td>
        <td class="news">${newsHtml}</td>
        <td class="mag-cell">${renderMagnitudeCell(x.magnitudeOdds)}</td>
      `;

      return {
        key: x.symbol || `row-${idx}`,
        html,
        data: { price: x.price, pct },
      };
    });

    flipUpdateRows(tbody, flipRows);
    shortenMobileHeaders();
  }

  // ══════════════════════════════════════════════════════════════════
  // RENDER CRYPTO — Uses FLIP engine
  // ══════════════════════════════════════════════════════════════════

  function renderCrypto(rows) {
    const tbody = document.getElementById("cryptoTbody");
    if (!tbody) return;

    if (!rows || rows.length === 0) {
      flipUpdateRows(tbody, []);
      return;
    }

    const medals = ["🥇", "🥈", "🥉"];

    const flipRows = rows.map((x, idx) => {
      const pct = x.pctChange || 0;
      const changeClass = classUpDown(pct);

      let priceDecimals = 2;
      if (x.price !== null && x.price !== undefined) {
        const p = Number(x.price);
        if (p > 0 && p < 0.01) priceDecimals = Math.min(6, Math.max(2, Math.ceil(-Math.log10(p)) + 1));
      }

      const rangeHtml = renderRangeIndicator(x.low24h ?? x.rangeLow, x.high24h ?? x.rangeHigh, x.price);

      // ── Pump & Dump Warning ──
      let rugWarning = "";
      const mcap = x.marketCap || 0, vol = x.volume || 0, rangePos = x.rangePosition ?? 0.5;
      const volMcapRatio = mcap > 0 ? vol / mcap : 0;
      let warningLevel = 0, warningReasons = [];

      if (pct > 200 && rangePos < 0.25) { warningLevel = 2; warningReasons.push("extreme gain + crashed from highs"); }
      if (volMcapRatio > 1.5) { warningLevel = 2; warningReasons.push("volume exceeds 150% of market cap"); }
      if (pct > 100 && volMcapRatio > 0.8 && rangePos < 0.30) { warningLevel = 2; warningReasons.push("spike + heavy churn + fading"); }
      if (mcap > 0 && mcap < 50e6 && pct > 100) { warningLevel = Math.max(warningLevel, 2); warningReasons.push("micro cap + extreme gain"); }
      if (pct > 500) { warningLevel = 2; warningReasons.push("gain exceeds 500%"); }
      if (warningLevel === 0 && pct > 50 && rangePos < 0.25) { warningLevel = 1; warningReasons.push("significant gain but fading from highs"); }
      if (warningLevel === 0 && pct > 30 && volMcapRatio > 0.8 && rangePos < 0.40) { warningLevel = 1; warningReasons.push("heavy volume churn + weakening"); }
      if (warningLevel === 0 && mcap > 0 && mcap < 200e6 && pct > 60 && volMcapRatio > 0.5) { warningLevel = 1; warningReasons.push("small cap + large move + high volume ratio"); }
      if (warningLevel === 0 && volMcapRatio > 1.0) { warningLevel = 1; warningReasons.push("24h volume exceeds market cap"); }

      if (warningLevel >= 2) rugWarning = ` <span class="rug-warning rug-danger" title="⚠️ High risk: ${warningReasons.join("; ")}">⚠️</span>`;
      else if (warningLevel >= 1) rugWarning = ` <span class="rug-warning rug-caution" title="⚠️ Elevated risk: ${warningReasons.join("; ")}">⚠️</span>`;

      const tickerHtml = renderTickerCell(x.coinSymbol || "—", "crypto", x.image || null);
      if (x.enteredPrice) updatePeakPrice(x.coinSymbol, x.price, x.enteredPrice);
      const entryAttrs = renderSinceEntryAttrs(x.price, x.enteredPrice, x.enteredAt, x.coinSymbol);

      const html = `
        <td class="ticker">${tickerHtml}${idx < 3 ? ' <span class="ticker-medal">' + medals[idx] + '</span>' : ''}${rugWarning}${renderNewBadge(x.enteredAt)}${window.sjShareBtn ? window.sjShareBtn(x.coinSymbol, x.pctChange, fmtUsd(x.price, priceDecimals), renderRvolRaw(x.volume, null, x.marketCap, 'crypto'), 'crypto') : ''}</td>
        <td class="price-cell" data-raw-price="${x.price ?? ''}">${fmtUsd(x.price, priceDecimals)}</td>
        <td class="${changeClass}">
          <span class="change-wrap">
            <span class="change-pct${entryAttrs ? ' has-entry-tooltip' : ''}" data-raw-pct="${pct ?? ''}"${entryAttrs}>${fmtPct(pct)}</span>
            ${rangeHtml}
          </span>${renderSinceEntryMobile(x.price, x.enteredPrice, x.enteredAt, x.coinSymbol)}
        </td>
        <td>${fmtVolumeCompact(x.volume)}${renderVolumeFire(x.volume, null, x.marketCap, "crypto")}${renderWhaleIndicator(x.volume, null, x.marketCap, x.pctChange, x.rangePosition, "crypto") || renderLiquidityDot(x.volume, x.marketCap)}</td>
        <td class="rvol">${renderRvol(x.volume, null, x.marketCap, "crypto")}</td>
        <td>${fmtCompactUsd(x.marketCap, 1)}</td>
        <td class="sj">${renderOddsCell(x.continuationOdds)}</td>
      `;

      return {
        key: x.coinSymbol || `row-${idx}`,
        html,
        data: { price: x.price, pct },
      };
    });

    flipUpdateRows(tbody, flipRows);
    shortenMobileHeaders();
  }

  // ══════════════════════════════════════════════════════════════════
  // Mobile helpers
  // ══════════════════════════════════════════════════════════════════

  function trimMobileDecimals() {
    if (window.innerWidth > 640) return;
    document.querySelectorAll('.change-pct').forEach(el => {
      const match = el.textContent.trim().match(/^([+-]?)(\d+\.\d{2,})%$/);
      if (match) {
        const num = parseFloat(match[1] + match[2]);
        el.textContent = (num >= 0 ? '+' : '') + num.toFixed(1) + '%';
      }
    });
  }

  function shortenMobileHeaders() {
    if (window.innerWidth > 640) return;
    document.querySelectorAll('.stocks-table thead th').forEach(th => {
      const text = th.textContent.trim();
      if (text === '% Change 24h') th.textContent = '% Chg';
      if (text === '% Change')     th.textContent = '% Chg';
      if (text === 'Vol 24h')      th.textContent = 'Vol';
      if (text === 'Market Cap')   th.textContent = 'MCap';
    });
  }

  // ----------------------------
  // Header indices
  // ----------------------------
  function setIdxValue(el, pct) {
    if (!el) return;
    el.textContent = (pct === null || pct === undefined) ? "—" : fmtPct(pct);
    el.classList.remove("up", "down", "flat");
    const n = Number(pct);
    if (!Number.isFinite(n)) return;
    if (n > 0) el.classList.add("up");
    else if (n < 0) el.classList.add("down");
    else el.classList.add("flat");
  }

  function applyHeaderFromApi(data) {
    const leftLabel = data?.header?.left?.label;
    const rightLabel = data?.header?.right?.label;
    if (idxLeftLabel && leftLabel) idxLeftLabel.textContent = leftLabel;
    if (idxRightLabel && rightLabel) idxRightLabel.textContent = rightLabel;
    setIdxValue(idxLeftValue, data?.header?.left?.pct ?? data?.header?.btcPct ?? null);
    setIdxValue(idxRightValue, data?.header?.right?.pct ?? data?.header?.totalMarketPct ?? null);
    idxWrap?.classList.toggle("crypto", currentMode === "crypto");

    const marketSessionNotice = document.getElementById("marketClosedNotice");
    const marketSessionText = marketSessionNotice?.querySelector(".market-session-text");
    if (marketSessionNotice && currentMode === "stocks") {
      const session = data?.marketSession || "closed";
      marketSessionNotice.classList.remove("session-closed", "session-premarket", "session-afterhours", "session-open");
      if (session === "open") { marketSessionNotice.style.display = "none"; }
      else {
        marketSessionNotice.style.display = "flex";
        marketSessionNotice.classList.add(`session-${session}`);
        if (marketSessionText) {
          if (session === "premarket") marketSessionText.innerHTML = `Pre-Market — Live extended hours prices`;
          else if (session === "afterhours") marketSessionText.innerHTML = `After-Hours — Live extended hours prices`;
          else marketSessionText.textContent = data?.marketSessionLabel || "Market Closed";
        }
      }
    } else if (marketSessionNotice) { marketSessionNotice.style.display = "none"; }
  }

  // ----------------------------
  // Filters
  // ----------------------------
  const filterState = {
    stocks: { mcapTouched: false, mcapValue: MODE_DEFAULTS.stocks.mcapDial, priceTouched: false, priceValue: MODE_DEFAULTS.stocks.priceMax, volTouched: false, volValue: MODE_DEFAULTS.stocks.volMin, pctMinOverride: null },
    crypto: { mcapTouched: false, mcapValue: MODE_DEFAULTS.crypto.mcapDial, priceTouched: false, priceValue: MODE_DEFAULTS.crypto.priceMax, volTouched: false, volValue: MODE_DEFAULTS.crypto.volMin, pctMinOverride: null },
  };

  function setMcapUiForMode(mode) {
    if (!filterEls.mcapRange) return;
    filterEls.mcapRange.min = "0"; filterEls.mcapRange.max = "1000"; filterEls.mcapRange.step = "1";
    if (filterEls.mcapLabel) filterEls.mcapLabel.textContent = "Market Cap (Min)";
    if (filterEls.mcapPillStocks) filterEls.mcapPillStocks.style.display = "none";
    if (filterEls.mcapPillCrypto) filterEls.mcapPillCrypto.style.display = "";
    if (mode === "crypto") {
      if (filterEls.mcapMetaLeft) filterEls.mcapMetaLeft.textContent = "$50M";
      if (filterEls.mcapMetaRight) filterEls.mcapMetaRight.textContent = "$100B+";
      const dial = filterState.crypto.mcapTouched ? filterState.crypto.mcapValue : MODE_DEFAULTS.crypto.mcapDial;
      filterEls.mcapRange.value = String(dial);
      lastCryptoMcapMin = cryptoMcapFromDial(dial);
      if (filterEls.mcapTextCrypto) filterEls.mcapTextCrypto.textContent = `${fmtMoneyShort(lastCryptoMcapMin)}+`;
    } else {
      if (filterEls.mcapMetaLeft) filterEls.mcapMetaLeft.textContent = "$100M";
      if (filterEls.mcapMetaRight) filterEls.mcapMetaRight.textContent = "$500B";
      const dial = filterState.stocks.mcapTouched ? filterState.stocks.mcapValue : MODE_DEFAULTS.stocks.mcapDial;
      filterEls.mcapRange.value = String(dial);
      if (filterEls.mcapTextCrypto) filterEls.mcapTextCrypto.textContent = `${fmtMoneyShort(stockMcapFromDial(dial))}+`;
    }
  }

  function setPriceUiForMode(mode) {
    if (!filterEls.priceRange) return;
    const state = filterState[mode], d = MODE_DEFAULTS[mode];
    filterEls.priceRange.min = "1"; filterEls.priceRange.max = "5000"; filterEls.priceRange.step = "1";
    if (priceMetaLeft) priceMetaLeft.textContent = "$1";
    if (priceMetaRight) priceMetaRight.textContent = "$5,000";
    const price = state.priceTouched ? state.priceValue : d.priceMax;
    filterEls.priceRange.value = String(price);
    if (priceNum) priceNum.value = String(price);
  }

  function setVolumeUiForMode(mode) {
    if (!filterEls.volRange) return;
    const state = filterState[mode], d = MODE_DEFAULTS[mode];
    filterEls.volRange.min = "0"; filterEls.volRange.max = "50000000"; filterEls.volRange.step = "100000";
    if (volMetaLeft) volMetaLeft.textContent = "0";
    if (volMetaRight) volMetaRight.textContent = "50M";
    const vol = state.volTouched ? state.volValue : d.volMin;
    filterEls.volRange.value = String(vol);
    if (volNum) volNum.value = String(vol);
  }

  function setCatalystUiForMode(mode) {
    const catalystCard = document.querySelector(".filter-card .checklist")?.closest(".filter-card");
    if (!catalystCard) return;
    if (mode === "crypto") {
      catalystCard.classList.add("filter-card-disabled");
      catalystCard.querySelectorAll("input").forEach(i => i.disabled = true);
    } else {
      catalystCard.classList.remove("filter-card-disabled");
      catalystCard.querySelectorAll("input").forEach(i => i.disabled = false);
    }
  }

  function setUiDefaultsForMode(mode) {
    const d = MODE_DEFAULTS[mode];
    if (filterEls.newsRequiredChk) filterEls.newsRequiredChk.checked = !!d.newsRequired;
    if (filterEls.highVolChk) filterEls.highVolChk.checked = !!d.highVolumeOnly;
    setMcapUiForMode(mode);
    setPriceUiForMode(mode);
    setVolumeUiForMode(mode);
    setCatalystUiForMode(mode);
  }

  function readFiltersForMode(mode) {
    const d = MODE_DEFAULTS[mode];
    const limit = d.limit;
    const pctMin = filterState[mode].pctMinOverride ?? d.pctMin;
    const volMin = filterEls.volRange ? Number(filterEls.volRange.value) : d.volMin;
    const priceMax = filterEls.priceRange ? Number(filterEls.priceRange.value) : d.priceMax;
    const newsRequired = filterEls.newsRequiredChk ? !!filterEls.newsRequiredChk.checked : d.newsRequired;
    const dial = filterEls.mcapRange ? Number(filterEls.mcapRange.value) : d.mcapDial;
    const mcapMin = mode === "crypto" ? cryptoMcapFromDial(dial) : stockMcapFromDial(dial);
    if (mode === "crypto") lastCryptoMcapMin = mcapMin;
    return { limit, pctMin, volMin, priceMax, mcapMin, newsRequired, dial };
  }

  function buildApiPath(mode) {
    const f = readFiltersForMode(mode);
    const p = new URLSearchParams();
    p.set("limit", String(f.limit)); p.set("pctMin", String(f.pctMin)); p.set("volMin", String(f.volMin));
    p.set("priceMax", String(f.priceMax)); p.set("newsRequired", f.newsRequired ? "true" : "false");
    p.set("highVolumeOnly", f.highVolumeOnly ? "true" : "false"); p.set("mcapMin", String(f.mcapMin));
    return mode === "crypto" ? `/api/crypto?${p}` : `/api/stocks?${p}`;
  }

  // ---- wire filter inputs ----
  filterEls.mcapRange?.addEventListener("input", () => {
    const state = filterState[currentMode], dial = Number(filterEls.mcapRange.value || 0);
    state.mcapTouched = true; state.mcapValue = dial;
    if (currentMode === "crypto") {
      lastCryptoMcapMin = cryptoMcapFromDial(dial);
      if (filterEls.mcapTextCrypto) filterEls.mcapTextCrypto.textContent = `${fmtMoneyShort(lastCryptoMcapMin)}+`;
    } else {
      if (filterEls.mcapTextCrypto) filterEls.mcapTextCrypto.textContent = `${fmtMoneyShort(stockMcapFromDial(dial))}+`;
    }
  });

  filterEls.mcapNumStocks?.addEventListener("input", () => {
    if (currentMode !== "stocks" || !filterEls.mcapRange) return;
    const v = clamp(filterEls.mcapNumStocks.value, 1, 500);
    filterEls.mcapNumStocks.value = String(v); filterEls.mcapRange.value = String(v);
    filterState.stocks.mcapTouched = true; filterState.stocks.mcapValue = v;
  });

  filterEls.priceRange?.addEventListener("input", () => {
    const state = filterState[currentMode]; state.priceTouched = true; state.priceValue = Number(filterEls.priceRange.value);
    if (priceNum) priceNum.value = filterEls.priceRange.value;
  });
  priceNum?.addEventListener("input", () => {
    if (!filterEls.priceRange) return;
    const v = clamp(priceNum.value, 1, 5000); priceNum.value = String(v); filterEls.priceRange.value = String(v);
    filterState[currentMode].priceTouched = true; filterState[currentMode].priceValue = v;
  });

  filterEls.volRange?.addEventListener("input", () => {
    const state = filterState[currentMode]; state.volTouched = true; state.volValue = Number(filterEls.volRange.value);
    if (volNum) volNum.value = filterEls.volRange.value;
  });
  volNum?.addEventListener("input", () => {
    if (!filterEls.volRange) return;
    const v = clamp(volNum.value, 0, 50_000_000); volNum.value = String(v); filterEls.volRange.value = String(v);
    filterState[currentMode].volTouched = true; filterState[currentMode].volValue = v;
  });

  // ----------------------------
  // Polling + Mode switching
  // ----------------------------
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const isNorthAmerica = tz.startsWith("America/");
  let currentMode = isNorthAmerica ? "stocks" : "crypto";
  let pollTimer = null;

  async function refreshOnce() {
    try {
      let data;

      // On first call, consume prefetched data if available and mode matches
      if (window.__sjPrefetch && currentMode === window.__sjPrefetchMode) {
        try {
          data = await window.__sjPrefetch;
          window.__sjPrefetch = null; // consume once
          console.log("[StockJelli] Using prefetched data");
        } catch (e) {
          window.__sjPrefetch = null;
          // Fall through to normal fetch
        }
      }

      // Normal fetch (or prefetch failed/consumed)
      if (!data) {
        const path = buildApiPath(currentMode);
        data = await apiGet(path);
      }

      applyHeaderFromApi(data);
      let rows = data.rows;
      const highVolOnly = filterEls.highVolChk?.checked || false;
      if (highVolOnly && rows) {
        rows = rows.filter(r => {
          if (currentMode === "stocks") return r.avgVolume && r.avgVolume > 0 && (r.volume / r.avgVolume) >= 1.5;
          else return r.marketCap && r.marketCap > 0 && (r.volume / r.marketCap) >= 1.5;
        });
      }
      if (currentMode === "crypto") renderCrypto(rows);
      else renderStocks(rows);
      renderRegime(data.regime);
    } catch (e) { console.error("[StockJelli] refreshOnce failed:", e); }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    refreshOnce();
    pollTimer = setInterval(refreshOnce, POLL_MS);
  }

  function applyMode(mode) {
    currentMode = mode;
    setSegmented(assetControl, mode);
    if (stocksTable) stocksTable.style.display = mode === "stocks" ? "" : "none";
    if (cryptoTable) cryptoTable.style.display = mode === "crypto" ? "" : "none";
    const cryptoAttr = document.getElementById("cryptoAttribution");
    if (cryptoAttr) cryptoAttr.style.display = mode === "crypto" ? "" : "none";
    if (heroChartStocks) heroChartStocks.style.display = mode === "stocks" ? "" : "none";
    if (heroChartCrypto) heroChartCrypto.style.display = mode === "crypto" ? "" : "none";
    if (mode === "stocks") {
      if (idxLeftLabel) idxLeftLabel.textContent = "NASDAQ";
      if (idxRightLabel) idxRightLabel.textContent = "S&P 500";
    } else {
      if (idxLeftLabel) idxLeftLabel.textContent = "BTC";
      if (idxRightLabel) idxRightLabel.textContent = "Total Crypto Market";
    }
    if (idxLeftValue) idxLeftValue.textContent = "—";
    if (idxRightValue) idxRightValue.textContent = "—";
    setUiDefaultsForMode(mode);
    localStorage.setItem("sj_asset_mode", mode);
    shortenMobileHeaders();
    startPolling();
  }

  assetControl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    applyMode(btn.dataset.value === "crypto" ? "crypto" : "stocks");
  });

  const savedMode = localStorage.getItem("sj_asset_mode");
  applyMode(savedMode === "crypto" ? "crypto" : "stocks");

  filterEls.applyBtn?.addEventListener("click", () => refreshOnce());
  filterEls.resetBtn?.addEventListener("click", () => {
    const state = filterState[currentMode], d = MODE_DEFAULTS[currentMode];
    state.mcapTouched = false; state.mcapValue = d.mcapDial; state.priceTouched = false; state.priceValue = d.priceMax;
    state.volTouched = false; state.volValue = d.volMin; state.pctMinOverride = null;
    setUiDefaultsForMode(currentMode);
    refreshOnce();
  });

  // --- Filter Presets ---
  (function initFilterPresets() {
    const presetsRow = document.getElementById("filterPresets");
    const presetDefault = document.getElementById("presetDefault");
    const presetMidCap = document.getElementById("presetMidCap");
    const presetLargeCap = document.getElementById("presetLargeCap");
    if (!presetsRow) return;
    function updateVisibility() { presetsRow.style.display = currentMode === "stocks" ? "flex" : "none"; }
    const stocksTableEl = document.getElementById("stocksTable");
    if (stocksTableEl) new MutationObserver(updateVisibility).observe(stocksTableEl, { attributes: true, attributeFilter: ["style"] });
    updateVisibility();
    function setActive(btn) { [presetDefault, presetMidCap, presetLargeCap].forEach(b => b?.classList.remove("preset-active")); btn?.classList.add("preset-active"); }
    presetDefault?.addEventListener("click", () => {
      setActive(presetDefault);
      const state = filterState.stocks, d = MODE_DEFAULTS.stocks;
      state.mcapTouched = false; state.mcapValue = d.mcapDial; state.priceTouched = false; state.priceValue = d.priceMax;
      state.volTouched = false; state.volValue = d.volMin; state.pctMinOverride = null;
      setUiDefaultsForMode("stocks"); refreshOnce();
    });
    presetMidCap?.addEventListener("click", () => {
      setActive(presetMidCap);
      Object.assign(filterState.stocks, { mcapTouched: true, mcapValue: 270, priceTouched: true, priceValue: 5000, volTouched: true, volValue: 500_000, pctMinOverride: 3 });
      setMcapUiForMode("stocks"); setPriceUiForMode("stocks"); setVolumeUiForMode("stocks"); refreshOnce();
    });
    presetLargeCap?.addEventListener("click", () => {
      setActive(presetLargeCap);
      Object.assign(filterState.stocks, { mcapTouched: true, mcapValue: 541, priceTouched: true, priceValue: 5000, volTouched: true, volValue: 500_000, pctMinOverride: 3 });
      setMcapUiForMode("stocks"); setPriceUiForMode("stocks"); setVolumeUiForMode("stocks"); refreshOnce();
    });
  })();

  // ----------------------------
  // Legal modals
  // ----------------------------
  (function initLegalModals() {
    const privacyModal = document.getElementById("privacyModal"), termsModal = document.getElementById("termsModal");
    const closePrivacyBtn = document.getElementById("closePrivacyBtn"), closeTermsBtn = document.getElementById("closeTermsBtn");
    if (!privacyModal || !termsModal) return;
    function openM(m) { m.classList.add("is-open"); m.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; }
    function closeM(m) { m.classList.remove("is-open"); m.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; }
    document.getElementById("openPrivacyBtn")?.addEventListener("click", () => openM(privacyModal));
    document.getElementById("openTermsBtn")?.addEventListener("click", () => openM(termsModal));
    closePrivacyBtn?.addEventListener("click", () => closeM(privacyModal));
    closeTermsBtn?.addEventListener("click", () => closeM(termsModal));
    privacyModal.addEventListener("click", (e) => { if (e.target === privacyModal) closeM(privacyModal); });
    termsModal.addEventListener("click", (e) => { if (e.target === termsModal) closeM(termsModal); });
    document.addEventListener("keydown", (e) => { if (e.key !== "Escape") return; if (privacyModal.classList.contains("is-open")) closeM(privacyModal); if (termsModal.classList.contains("is-open")) closeM(termsModal); });
  })();

  // ----------------------------
  // About / Contact modals
  // ----------------------------
  (function initAboutContactModals() {
    const aboutModal = document.getElementById("aboutModal"), contactModal = document.getElementById("contactModal");
    function openM(m) { if (!m) return; m.classList.add("is-open"); m.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; }
    function closeM(m) { if (!m) return; m.classList.remove("is-open"); m.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; }
    document.getElementById("openAboutBtn")?.addEventListener("click", () => openM(aboutModal));
    document.getElementById("openContactBtn")?.addEventListener("click", () => openM(contactModal));
    document.getElementById("closeAboutBtn")?.addEventListener("click", () => closeM(aboutModal));
    document.getElementById("closeContactBtn")?.addEventListener("click", () => closeM(contactModal));
    document.getElementById("contactCancelBtn")?.addEventListener("click", () => closeM(contactModal));
    aboutModal?.addEventListener("click", (e) => { if (e.target === aboutModal) closeM(aboutModal); });
    contactModal?.addEventListener("click", (e) => { if (e.target === contactModal) closeM(contactModal); });

    document.getElementById("contactForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target), name = fd.get("name")?.trim(), email = fd.get("email")?.trim(), message = fd.get("message")?.trim();
      if (!name || !email || !message) { alert("Please fill in all fields."); return; }
      const btn = e.target.querySelector('button[type="submit"]'), orig = btn?.textContent;
      if (btn) { btn.disabled = true; btn.textContent = "Sending..."; }
      try {
        const res = await fetch(`${API_BASE}/api/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, message }) });
        const data = await res.json();
        if (res.ok) { alert("Thanks! Your message has been sent."); closeM(contactModal); e.target.reset(); }
        else alert(data.error || "Failed to send message. Please try again.");
      } catch { alert("Failed to send message. Please try again."); }
      finally { if (btn) { btn.disabled = false; btn.textContent = orig; } }
    });
  })();

  // ----------------------------
  // Drawer
  // ----------------------------
  (function initDrawer() {
    const menuBtn = document.getElementById("menuBtn"), drawer = document.getElementById("drawer"), overlay = document.getElementById("drawerOverlay"), closeBtn = document.getElementById("drawerClose");
    if (!drawer || !menuBtn) return;
    function open() { drawer.classList.add("is-open"); drawer.setAttribute("aria-hidden", "false"); overlay?.classList.add("is-open"); document.body.style.overflow = "hidden"; }
    function close() { drawer.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true"); overlay?.classList.remove("is-open"); document.body.style.overflow = ""; }
    menuBtn.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);
    overlay?.addEventListener("click", close);
    drawer.querySelectorAll("a.drawer-link").forEach(l => l.addEventListener("click", close));
    document.getElementById("drawerAboutBtn")?.addEventListener("click", () => { close(); const m = document.getElementById("aboutModal"); if (m) { m.classList.add("is-open"); m.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; } });
    document.getElementById("drawerContactBtn")?.addEventListener("click", () => { close(); const m = document.getElementById("contactModal"); if (m) { m.classList.add("is-open"); m.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; } });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("is-open")) close(); });
  })();

  // ----------------------------
  // SJ Score unlock modal
  // ----------------------------
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".sj-unlock-btn");
    if (!btn) return;
    const m = document.getElementById("sjUnlockModal");
    if (m) { m.classList.add("is-open"); m.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; setTimeout(() => document.getElementById("sjUnlockEmail")?.focus(), 100); }
  });

  (function initSjUnlockModal() {
    const modal = document.getElementById("sjUnlockModal"), closeBtn = document.getElementById("closeSjUnlockBtn");
    const verifyBtn = document.getElementById("sjUnlockVerifyBtn"), emailInput = document.getElementById("sjUnlockEmail");
    const errorEl = document.getElementById("sjUnlockError"), successEl = document.getElementById("sjUnlockSuccess");
    if (!modal) return;
    function close() { modal.classList.remove("is-open"); modal.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; }
    closeBtn?.addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("is-open")) close(); });
    document.getElementById("sjUnlockSubscribeLink")?.addEventListener("click", (e) => { e.preventDefault(); close(); document.getElementById("enableAlertsBtn")?.click(); });

    verifyBtn?.addEventListener("click", async () => {
      const email = (emailInput?.value || "").trim().toLowerCase();
      if (errorEl) errorEl.style.display = "none"; if (successEl) successEl.style.display = "none";
      if (!email || !email.includes("@")) { if (errorEl) { errorEl.textContent = "Please enter a valid email address."; errorEl.style.display = "block"; } return; }
      verifyBtn.disabled = true; verifyBtn.textContent = "Verifying...";
      try {
        const res = await fetch(`${API_BASE}/api/verify-subscriber?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data.active) {
          localStorage.setItem("sj_subscriber_email", email);
          if (successEl) { successEl.textContent = "✓ Verified! All SJ Scores are now unlocked."; successEl.style.display = "block"; }
          setTimeout(() => { close(); refreshOnce(); }, 1200);
        } else {
          if (errorEl) { errorEl.textContent = "No active subscription found for this email. Subscribe below to unlock."; errorEl.style.display = "block"; }
        }
      } catch { if (errorEl) { errorEl.textContent = "Verification failed. Please try again."; errorEl.style.display = "block"; } }
      finally { verifyBtn.disabled = false; verifyBtn.textContent = "Verify & Unlock"; }
    });
    emailInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") verifyBtn?.click(); });
  })();

  // ----------------------------
  // Notification banner
  // ----------------------------
  (function () {
    const DISMISS_KEY = 'sj_notif_banner_dismissed', WAITLIST_KEY = 'sj_notif_waitlist_joined';
    const banner = document.getElementById('notifBanner');
    if (!banner) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') { banner.classList.add('notif-dismissed'); return; }
    const savedEmail = localStorage.getItem(WAITLIST_KEY);
    if (savedEmail) showJoinedState(savedEmail);

    document.getElementById('notifBannerClose')?.addEventListener('click', () => {
      banner.classList.add('notif-banner-hiding');
      setTimeout(() => { banner.classList.add('notif-dismissed'); localStorage.setItem(DISMISS_KEY, '1'); }, 300);
    });

    const form = document.getElementById('notifWaitlistForm'), emailInput = document.getElementById('notifEmail'), submitBtn = document.getElementById('notifSubmitBtn');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMsg('Please enter a valid email.', 'error'); return; }
        submitBtn.disabled = true;
        const loadEl = submitBtn.querySelector('.notif-submit-loading'), textEl = submitBtn.querySelector('.notif-submit-text');
        if (textEl) textEl.style.display = 'none'; if (loadEl) loadEl.style.display = 'inline-flex';
        try {
          const res = await fetch(`${API_BASE}/api/notif-waitlist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
          if (res.ok) { localStorage.setItem(WAITLIST_KEY, email); showMsg("You're on the list!", 'success'); showJoinedState(email); }
          else { const d = await res.json().catch(() => ({})); showMsg(d.message || 'Something went wrong.', 'error'); }
        } catch { localStorage.setItem(WAITLIST_KEY, email); showMsg("You're on the list!", 'success'); showJoinedState(email); }
        finally { submitBtn.disabled = false; if (textEl) textEl.style.display = ''; if (loadEl) loadEl.style.display = 'none'; }
      });
    }

    function showMsg(text, type) {
      const el = document.getElementById('notifFormMsg'); if (!el) return;
      el.textContent = text; el.className = 'notif-form-msg ' + (type === 'success' ? 'msg-success' : 'msg-error'); el.style.display = 'block';
    }
    function showJoinedState(email) {
      if (!form) return;
      const [user, domain] = email.split('@');
      const masked = (user.length > 2 ? user[0] + '···' + user[user.length - 1] : user[0] + '···') + '@' + (domain || '');
      form.innerHTML = `<div style="display:flex;align-items:center;gap:6px;font-size:0.74rem;"><span style="color:#4ade80;">✓</span><span style="color:rgba(255,255,255,0.5);"><strong style="color:#4ade80;">You're on the list</strong> · ${masked}</span></div>`;
    }
  })();

})();