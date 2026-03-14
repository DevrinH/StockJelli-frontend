///app.st frontend

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

  const CRYPTO_MCAP_MIN = 5e7;   // 50M (was 200M)
  const CRYPTO_MCAP_MAX = 1e11;  // 100B


    // Add these for stocks:
  const STOCK_MCAP_MIN = 1e8;    // 100M
  const STOCK_MCAP_MAX = 5e11;   // 500B

  // Track last visit for "new since last visit" markers
const LAST_VISIT_KEY = "stockjelli_last_visit";
const previousVisitTime = localStorage.getItem(LAST_VISIT_KEY) || null;
// Update last visit to NOW so next visit compares against this one
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
    const logVal = logMin + (logMax - logMin) * t;
    return Math.round(Math.pow(10, logVal));
  }


  function stockMcapFromDial(dial0to1000) {
    const t = clamp(dial0to1000, 0, 1000) / 1000;
    const logMin = Math.log10(STOCK_MCAP_MIN);
    const logMax = Math.log10(STOCK_MCAP_MAX);
    const logVal = logMin + (logMax - logMin) * t;
    return Math.round(Math.pow(10, logVal));
  }
  // ----------------------------
  // DOM refs (match your HTML)
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

  // Filter UI pieces you actually have
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

  // Price pill input (no id in HTML) - grab it by location
  const priceCard = filterEls.priceRange?.closest(".filter-card");
  const priceNum = priceCard?.querySelector(".pill .num") || null;
  const priceMetaLeft = priceCard?.querySelector(".filter-meta .muted:first-child") || null;
  const priceMetaRight = priceCard?.querySelector(".filter-meta .muted:last-child") || null;

  // Volume pill input (no id in HTML)
  const volCard = filterEls.volRange?.closest(".filter-card");
  const volNum = volCard?.querySelector(".pill .num") || null;
  const volMetaLeft = volCard?.querySelector(".filter-meta .muted:first-child") || null;
  const volMetaRight = volCard?.querySelector(".filter-meta .muted:last-child") || null;

  // Helper to format volume for display
  function fmtVolume(n) {
    if (!Number.isFinite(n)) return "0";
    if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
    return String(n);
  }

  // ----------------------------
  // Renderers
  // ----------------------------
  
  // Format volume as compact (248,448,229 → 248M)
  function fmtVolumeCompact(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    const v = Number(n);
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return String(Math.round(v));
  }

  // Generate the "sideways candle" range indicator HTML
  // Shows: L ──────●──────── H with dot position based on current price
  function renderRangeIndicator(low, high, current) {
    // If we don't have valid data, return empty
    if (low === null || high === null || current === null) {
      return '<span class="range-indicator range-na">—</span>';
    }
    
    const lo = Number(low);
    const hi = Number(high);
    const cur = Number(current);
    
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(cur)) {
      return '<span class="range-indicator range-na">—</span>';
    }
    
    // Calculate position (0 = at low, 1 = at high)
    let position = 0.5;
    if (hi !== lo) {
      position = (cur - lo) / (hi - lo);
      position = Math.max(0, Math.min(1, position)); // clamp 0-1
    }
    
    // Convert to percentage for CSS
    const pct = Math.round(position * 100);
    
    // Determine color class based on position
    // Near high (>70%) = bullish/green, near low (<30%) = bearish/red, middle = neutral
    let posClass = "range-mid";
    if (pct >= 70) posClass = "range-high";
    else if (pct <= 30) posClass = "range-low";
    
    return `
      <span class="range-indicator ${posClass}" title="L: ${fmtUsd(lo, 2)} | H: ${fmtUsd(hi, 2)} | Now: ${fmtUsd(cur, 2)}">
        <span class="range-track">
          <span class="range-dot" style="left: ${pct}%"></span>
        </span>
      </span>
    `;
  }

  // Generate news HTML with tier styling
  function renderNewsCell(news) {
    if (!Array.isArray(news) || news.length === 0) {
      return '<span class="news-none">—</span>';
    }
    
    // Get the best (lowest tier) news item
    const item = news[0];
    if (!item) return '<span class="news-none">—</span>';
    
    const source = item.source || "News";
    const tier = item.tier || 3;
    const tierClass = tier === 1 ? "news-tier1" : tier === 2 ? "news-tier2" : "news-tier3";
    
    if (item.url) {
      return `<a class="news-source ${tierClass}" href="${item.url}" target="_blank" rel="noopener" title="${item.title || source}">${source}</a>`;
    }
    return `<span class="news-source ${tierClass}" title="${item.title || ''}">${source}</span>`;
  }

  // "NEW" badge for tickers that entered since user's last visit
  function renderNewBadge(enteredAt) {
    if (!previousVisitTime || !enteredAt) return "";
    
    try {
      const enteredTime = new Date(enteredAt).getTime();
      const lastVisit = new Date(previousVisitTime).getTime();
      
      if (enteredTime > lastVisit) {
        return ' <span class="new-badge-corner" title="New since last visit"></span>';
      }
    } catch (e) {
      // Invalid date, skip
    }
    
    return "";
  }

// SJ Score cell renderer
// Top 3 rows show score, rest are blurred for non-subscribers
// SJ Score cell renderer
// Checks localStorage for subscriber status
function renderSJScore(score, idx) {
  if (score === null || score === undefined) return '<span class="sj-cell sj-na">—</span>';
  
  const s = Number(score);
  let tier = "sj-low";
  let icon = "";
  if (s >= 75) { tier = "sj-high"; icon = " 🔥"; }
  else if (s >= 60) { tier = "sj-mid"; }
  
  // Check if subscriber (unlocked)
  const isUnlocked = !!localStorage.getItem("sj_subscriber_email");
  
  // First 3 rows OR subscriber: always visible
  if (idx < 3 || isUnlocked) {
    return `<span class="sj-cell ${tier}" title="SJ Momentum Strength Score">${s}${icon}</span>`;
  }
  
  // Rows 4+: blurred with unlock prompt
  return `<span class="sj-cell sj-blurred-wrap">
    <span class="sj-blurred ${tier}">${s}${icon}</span>
    <button class="sj-unlock-btn" title="Unlock all SJ Scores">🔒</button>
  </span>`;
}

// ── Market Regime Indicator ──────────────────────────────────────────────
// ── REGIME CONFIG ────────────────────────────────────────────────────────────
// Each regime has a color, BPM (visual heartbeat speed), and EKG waveform params
const REGIME_CONFIG = {
  expansion: {
    color: "#22c55e",
    colorRgb: "34, 197, 94",
    bpm: 62,
    amplitude: 0.35,     // calm, smooth wave
    frequency: 0.07,
    spikeStrength: 0.25,
    noise: 0.02,
    label: "Expansion",
  },
  rotation: {
    color: "#3b82f6",
    colorRgb: "59, 130, 246",
    bpm: 78,
    amplitude: 0.45,
    frequency: 0.10,
    spikeStrength: 0.35,
    noise: 0.05,
    label: "Rotation",
  },
  caution: {
    color: "#f59e0b",
    colorRgb: "245, 158, 11",
    bpm: 95,
    amplitude: 0.55,
    frequency: 0.15,
    spikeStrength: 0.45,
    noise: 0.10,
    label: "Caution",
  },
  contraction: {
    color: "#ef4444",
    colorRgb: "239, 68, 68",
    bpm: 120,
    amplitude: 0.75,
    frequency: 0.22,
    spikeStrength: 0.6,
    noise: 0.18,
    label: "Contraction",
  },
};


// ── REPLACE renderRegime() in app.js with this ──────────────────────────────
// Copy this function and replace the existing renderRegime(regime) in app.js

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

  // Update active segment (works with both old .regime-segment and new .pulse-regime-seg)
  bar.querySelectorAll("[data-regime]").forEach(seg => {
    seg.classList.toggle("regime-active", seg.dataset.regime === regimeKey);
  });

  // Update description
  if (desc) {
    desc.textContent = regime.description || "Analyzing market conditions…";
  }

  // Update BPM display
  if (bpmNumber) {
    bpmNumber.textContent = String(config.bpm);
  }

  // Set CSS custom property for pulse color
  if (pulseInner) {
    pulseInner.style.setProperty("--pulse-color", config.color);
  }
  if (bpmDot) {
    bpmDot.style.background = config.color;
    bpmDot.style.boxShadow = `0 0 6px ${config.color}80`;
  }

  // Start/update BPM dot flash
  if (bpmDot && config.bpm) {
    // Clear any existing interval
    if (window.__pulseBpmInterval) clearInterval(window.__pulseBpmInterval);
    const beatMs = (60 / config.bpm) * 1000;
    window.__pulseBpmInterval = setInterval(() => {
      bpmDot.classList.add("beat");
      setTimeout(() => bpmDot.classList.remove("beat"), beatMs * 0.3);
    }, beatMs);
  }

  // Notify EKG of regime change
  if (window.__pulseEkgSetRegime) {
    window.__pulseEkgSetRegime(regimeKey);
  }

  // Update subscriber detail (same as before)
  if (subDetail) {
    const isSubscriber = !!localStorage.getItem("sj_subscriber_email");

    if (isSubscriber) {
      const impactClass = regime.sjMultiplier > 1
        ? "regime-impact-positive"
        : regime.sjMultiplier < 1
          ? "regime-impact-negative"
          : "regime-impact-neutral";

      subDetail.innerHTML = `<span class="regime-sub-text ${impactClass}">${regime.sjImpactLabel || ""}</span>`;
    } else {
      subDetail.innerHTML = `
        <span class="regime-locked">
          🔒 SJ impact hidden · <a href="#" id="regimeUnlockLink">Unlock with alerts →</a>
        </span>
      `;

      const link = document.getElementById("regimeUnlockLink");
      if (link) {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const alertsBtn = document.getElementById("enableAlertsBtn");
          if (alertsBtn) alertsBtn.click();
        });
      }
    }
  }
}



  // Generate TradingView URL for a symbol
// Generate TradingView URL for a symbol (with affiliate link)
function getTradingViewUrl(symbol, type = "stock") {
  const affiliateId = "162729";
  if (type === "crypto") {
    // For crypto, link to the symbol page with affiliate
    return `https://www.tradingview.com/chart/?symbol=BINANCE:${symbol}USDT&aff_id=${affiliateId}`;
  }
  // For stocks, use default exchange detection with affiliate
  return `https://www.tradingview.com/chart/?symbol=${symbol}&aff_id=${affiliateId}`;
}

// Render ticker cell with TradingView hover tooltip (affiliate link)
function renderTickerCell(symbol, type = "stock", imageUrl = null) {
  const tvUrl = getTradingViewUrl(symbol, type);

  let logoHtml = "";
  if (type === "crypto" && imageUrl) {
    // Crypto: CoinGecko image URL from API response
    logoHtml = `<img class="ticker-logo" src="${imageUrl}" alt="" loading="lazy" onerror="this.dataset.failed='true'">`;
  } else if (type === "stock" && symbol && symbol !== "—") {
    // Stocks: FMP image CDN — free, no API key needed
    const fmpLogoUrl = `https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`;
    logoHtml = `<img class="ticker-logo" src="${fmpLogoUrl}" alt="" loading="lazy" onerror="this.dataset.failed='true'">`;
  }

  return `
    <span class="ticker-wrap">
      ${logoHtml}<span class="ticker-symbol">${symbol}</span>
      <a class="ticker-tv-link" href="${tvUrl}" target="_blank" rel="noopener" title="Open ${symbol} on TradingView">
        <span class="ticker-tv-tooltip">Open in TradingView ↗</span>
      </a>
    </span>
  `;
}

function renderWhaleIndicator(volume, avgVolume, marketCap, pctChange, rangePosition, mode) {
  if (!volume || !marketCap || marketCap === 0) return "";

  const pct = Math.abs(pctChange || 0);
  const rangePosVal = rangePosition ?? 0.5;
  const volMcapRatio = volume / marketCap;

  let isWhale = false;

  if (mode === "stock") {
    const rvol = (avgVolume && avgVolume > 0) ? (volume / avgVolume) : 0;
    isWhale = (
      rvol >= 5.0 &&
      volMcapRatio >= 0.03 &&
      pct >= 8 &&
      rangePosVal >= 0.50
    );
  } else if (mode === "crypto") {
    isWhale = (
      volMcapRatio >= 0.50 &&
      pct >= 10 &&
      rangePosVal >= 0.50
    );
  }

  if (!isWhale) return "";

  // Build tooltip with context
  const rvolText = (avgVolume && avgVolume > 0)
    ? `RVOL: ${(volume / avgVolume).toFixed(1)}x`
    : "";
  const volMcapText = `Vol/MCap: ${(volMcapRatio * 100).toFixed(1)}%`;
  const rangeText = `Range: ${Math.round(rangePosVal * 100)}%`;
  const tooltipParts = [rvolText, volMcapText, rangeText].filter(Boolean).join(" · ");

  return ` <span class="whale-indicator"><span class="liquidity-tooltip" style="--liq-color: rgba(96, 165, 250, 0.4)">Heavy flow detected — unusual institutional-level activity · ${tooltipParts}</span>🐋</span>`;
}

function renderSinceEntryAttrs(currentPrice, enteredPrice, enteredAt, symbol) {
  if (!enteredPrice || !currentPrice || !enteredAt) return "";
 
  const current = Number(currentPrice);
  const entry = Number(enteredPrice);
  if (!Number.isFinite(current) || !Number.isFinite(entry) || entry <= 0) return "";
 
  const sincePct = ((current - entry) / entry) * 100;
  if (Math.abs(sincePct) < 0.3) return "";
 
  const sign = sincePct >= 0 ? "+" : "";
  const sincePctText = `${sign}${sincePct.toFixed(1)}%`;
 
  // Format entry price
  let dec = 2;
  if (entry > 0 && entry < 0.01) {
    dec = Math.min(6, Math.max(2, Math.ceil(-Math.log10(entry)) + 1));
  }
  const entryPriceText = `$${entry.toFixed(dec)}`;
 
  // Time ago
  let timeAgoText = "";
  try {
    const diffMs = Date.now() - new Date(enteredAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) timeAgoText = "just now";
    else if (mins < 60) timeAgoText = `${mins}m ago`;
    else {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      timeAgoText = m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
    }
  } catch (e) {}
 
  // Build tooltip lines
  const line1 = `${sincePctText} since entering screener`;
 
  let line2 = "";
  if (symbol) {
    const peakPct = getPeakPct(symbol, entry);
    if (peakPct !== null && peakPct > sincePct + 0.5) {
      line2 = `Peak: +${peakPct.toFixed(1)}% since entry`;
    }
  }
 
  const line3 = `Entered at ${entryPriceText} · ${timeAgoText}`;
 
  const dir = sincePct >= 0 ? "up" : "down";
 
  // Single data attribute with all lines — CSS uses \A for line breaks
  // We separate lines with a pipe character, then CSS replaces in content
  // Actually simpler: just use data-entry-line1, data-entry-line2, data-entry-line3
  return ` data-entry-line1="${line1}" data-entry-line2="${line2}" data-entry-line3="${line3}" data-entry-color="${dir}"`;
}

// Track peak prices since page load (per symbol)
const peakSinceEntry = new Map();

function updatePeakPrice(symbol, price, enteredPrice) {
  if (!symbol || !price || !enteredPrice) return;
  const prev = peakSinceEntry.get(symbol);
  if (!prev || price > prev) {
    peakSinceEntry.set(symbol, price);
  }
}

function getPeakPct(symbol, enteredPrice) {
  if (!symbol || !enteredPrice) return null;
  const peak = peakSinceEntry.get(symbol);
  if (!peak || !Number.isFinite(peak) || enteredPrice <= 0) return null;
  const pct = ((peak - enteredPrice) / enteredPrice) * 100;
  return Math.abs(pct) >= 0.3 ? pct : null;
}

function renderSinceEntryMobile(currentPrice, enteredPrice, enteredAt, symbol) {
  if (!enteredPrice || !currentPrice || !enteredAt) return "";
  const current = Number(currentPrice);
  const entry = Number(enteredPrice);
  if (!Number.isFinite(current) || !Number.isFinite(entry) || entry <= 0) return "";
  const sincePct = ((current - entry) / entry) * 100;
  if (Math.abs(sincePct) < 0.3) return "";
  const sign = sincePct >= 0 ? "+" : "";
  const dir = sincePct >= 0 ? "up" : "down";

  let peakStr = "";
  if (symbol) {
    const peakPct = getPeakPct(symbol, entry);
    if (peakPct !== null && peakPct > sincePct + 0.5) {
      peakStr = ` · pk +${peakPct.toFixed(1)}%`;
    }
  }

  let dec = 2;
  if (entry > 0 && entry < 0.01) {
    dec = Math.min(6, Math.max(2, Math.ceil(-Math.log10(entry)) + 1));
  }

  return `<span class="since-entry-mobile ${dir}">${sign}${sincePct.toFixed(1)}%${peakStr} · $${entry.toFixed(dec)}</span>`;
}


function renderStocks(rows) {
  const tbody = document.getElementById("stocksTbody");
  if (!tbody) return;
 
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td class="ticker">—</td><td>$—</td><td>—</td><td>—</td><td class="rvol">—</td><td class="news">—</td><td class="sj">—</td></tr>`;
    return;
  }
 
  const oldValues = snapshotTableValues(tbody);
  const medals = ["🥇", "🥈", "🥉"];
 
  tbody.innerHTML = rows.map((x, idx) => {
    const pct = x.pctChange;
    const changeClass = classUpDown(pct);
    const rangeHtml = renderRangeIndicator(x.dayLow ?? x.rangeLow, x.dayHigh ?? x.rangeHigh, x.price);
    const newsHtml = renderNewsCell(x.news);
    const tickerHtml = renderTickerCell(x.symbol || "—", "stock");
    if (x.enteredPrice) updatePeakPrice(x.symbol, x.price, x.enteredPrice);
    const entryAttrs = renderSinceEntryAttrs(x.price, x.enteredPrice, x.enteredAt, x.symbol);
 
    return `
      <tr data-symbol="${x.symbol || ''}">
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
        <td class="sj">${renderSJScore(x.sjScore, idx)}</td>
      </tr>
    `;
  }).join("");
 
  trimMobileDecimals();
  animateTableValues(tbody, oldValues);
}


// Liquidity indicator dot for crypto
function renderLiquidityDot(volume, marketCap) {
  if (!volume || !marketCap || marketCap === 0) return "";
  
  const ratio = volume / marketCap;
  
  let level, color;
  if (ratio >= 0.50) {
    level = "High Liquidity";
    color = "#22c55e"; // green
  } else if (ratio >= 0.10) {
    level = "Medium Liquidity";
    color = "#f59e0b"; // amber
  } else {
    level = "Low Liquidity — exit may cause slippage";
    color = "#ef4444"; // red
  }
  
  return ` <span class="liquidity-wrap"><span class="liquidity-dot" style="--liq-color: ${color}"></span><span class="liquidity-tooltip" style="--liq-color: ${color}">${level} (Vol/MCap: ${(ratio * 100).toFixed(1)}%)</span></span>`;
}

function renderCrypto(rows) {
  const tbody = document.getElementById("cryptoTbody");
  if (!tbody) return;
 
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td class="ticker">—</td><td>$—</td><td>—</td><td>—</td><td class="rvol">—</td><td>—</td><td class="sj">—</td></tr>`;
    return;
  }
 
  const oldValues = snapshotTableValues(tbody);
  const medals = ["🥇", "🥈", "🥉"];
 
  tbody.innerHTML = rows.map((x, idx) => {
    const pct = x.pctChange || 0;
    const changeClass = classUpDown(pct);
 
    let priceDecimals = 2;
    if (x.price !== null && x.price !== undefined) {
      const p = Number(x.price);
      if (p > 0 && p < 0.01) {
        priceDecimals = Math.max(2, Math.ceil(-Math.log10(p)) + 1);
        priceDecimals = Math.min(priceDecimals, 6);
      }
    }
 
    const rangeHtml = renderRangeIndicator(x.low24h ?? x.rangeLow, x.high24h ?? x.rangeHigh, x.price);
 
    let rugWarning = "";
    const mcap = x.marketCap || 0;
    const vol = x.volume || 0;
    const rangePos = x.rangePosition ?? 0.5;
    const volMcapRatio = mcap > 0 ? vol / mcap : 0;
 
    // ── Pump & Dump Warning Signals ──────────────────────────────
    // Tiered system: red ⚠️ for high confidence, yellow ⚠️ for caution
    //
    // KEY INSIGHT from W09-W11 data:
    //   Most real pump-and-dumps are +50-200%, not +1000%.
    //   The strongest signal is: big move + crashed range + high vol churn.
    //   That means it spiked, people dumped, and exit liquidity is drying up.
 
    let warningLevel = 0; // 0 = none, 1 = caution (yellow), 2 = danger (red)
    let warningReasons = [];
 
    // ── DANGER (red) — high confidence pump-and-dump ──
    
    // Massive gain, already crashed from highs
    if (pct > 200 && rangePos < 0.25) {
      warningLevel = 2;
      warningReasons.push("extreme gain + crashed from highs");
    }
    // Insane volume churn — vol > 150% of entire market cap
    if (volMcapRatio > 1.5) {
      warningLevel = 2;
      warningReasons.push("volume exceeds 150% of market cap");
    }
    // Classic dump pattern: big spike + heavy volume + price fading
    if (pct > 100 && volMcapRatio > 0.8 && rangePos < 0.30) {
      warningLevel = 2;
      warningReasons.push("spike + heavy churn + fading");
    }
    // Micro cap + extreme gain = almost always manipulation
    if (mcap > 0 && mcap < 50e6 && pct > 100) {
      warningLevel = Math.max(warningLevel, 2);
      warningReasons.push("micro cap + extreme gain");
    }
    // +500% on anything
    if (pct > 500) {
      warningLevel = 2;
      warningReasons.push("gain exceeds 500%");
    }
 
    // ── CAUTION (yellow) — elevated risk ──
 
    // Moderate spike that's already fading
    if (warningLevel === 0 && pct > 50 && rangePos < 0.25) {
      warningLevel = 1;
      warningReasons.push("significant gain but fading from highs");
    }
    // High volume churn on a moderate move
    if (warningLevel === 0 && pct > 30 && volMcapRatio > 0.8 && rangePos < 0.40) {
      warningLevel = 1;
      warningReasons.push("heavy volume churn + weakening");
    }
    // Small cap with big move and volume exceeding mcap
    if (warningLevel === 0 && mcap > 0 && mcap < 200e6 && pct > 60 && volMcapRatio > 0.5) {
      warningLevel = 1;
      warningReasons.push("small cap + large move + high volume ratio");
    }
    // Any coin where vol > mcap (regardless of % change)
    if (warningLevel === 0 && volMcapRatio > 1.0) {
      warningLevel = 1;
      warningReasons.push("24h volume exceeds market cap");
    }
 
    // Build the warning HTML
    if (warningLevel >= 2) {
      const reasonText = warningReasons.join("; ");
      rugWarning = ` <span class="rug-warning rug-danger" title="⚠️ High risk: ${reasonText}">⚠️</span>`;
    } else if (warningLevel >= 1) {
      const reasonText = warningReasons.join("; ");
      rugWarning = ` <span class="rug-warning rug-caution" title="⚠️ Elevated risk: ${reasonText}">⚠️</span>`;
    }
 
    const tickerHtml = renderTickerCell(x.coinSymbol || "—", "crypto", x.image || null);
    if (x.enteredPrice) updatePeakPrice(x.coinSymbol, x.price, x.enteredPrice);
    const entryAttrs = renderSinceEntryAttrs(x.price, x.enteredPrice, x.enteredAt, x.coinSymbol);
 
    return `
      <tr data-symbol="${x.coinSymbol || ''}">
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
        <td class="sj">${renderSJScore(x.sjScore, idx)}</td>
      </tr>
    `;
  }).join("");
 
  trimMobileDecimals();
  animateTableValues(tbody, oldValues);
}


// ──────────────────────────────────────────────────────────────────────
// 4. NEW: Animated number transitions
//
//    snapshotTableValues() — captures current values before re-render
//    animateTableValues()  — compares old vs new, runs count animation
//
//    The system works by:
//    - Before innerHTML replacement, we snapshot {symbol → {price, pct}}
//    - After innerHTML replacement, we find matching rows by data-symbol
//    - If a value changed, we animate from old → new over 400ms
//    - We also flash green (up) or red (down) briefly
// ──────────────────────────────────────────────────────────────────────

function snapshotTableValues(tbody) {
  const map = new Map();
  if (!tbody) return map;

  tbody.querySelectorAll("tr[data-symbol]").forEach(tr => {
    const sym = tr.dataset.symbol;
    if (!sym) return;

    const priceCell = tr.querySelector(".price-cell");
    const pctCell = tr.querySelector(".change-pct");

    map.set(sym, {
      price: parseFloat(priceCell?.dataset.rawPrice) || null,
      pct: parseFloat(pctCell?.dataset.rawPct) || null,
    });
  });

  return map;
}

function animateTableValues(tbody, oldValues) {
  if (!tbody || !oldValues || oldValues.size === 0) return;

  tbody.querySelectorAll("tr[data-symbol]").forEach(tr => {
    const sym = tr.dataset.symbol;
    if (!sym) return;

    const old = oldValues.get(sym);
    if (!old) return; // new row, no animation needed

    const priceCell = tr.querySelector(".price-cell");
    const pctCell = tr.querySelector(".change-pct");

    // Animate price
    const newPrice = parseFloat(priceCell?.dataset.rawPrice);
    if (priceCell && old.price !== null && Number.isFinite(newPrice) && old.price !== newPrice) {
      animateNumber(priceCell, old.price, newPrice, 400, formatPrice);
      flashCell(priceCell, newPrice > old.price ? "up" : "down");
    }

    // Animate percentage
    const newPct = parseFloat(pctCell?.dataset.rawPct);
    if (pctCell && old.pct !== null && Number.isFinite(newPct) && Math.abs(old.pct - newPct) > 0.005) {
      animateNumber(pctCell, old.pct, newPct, 400, formatPct);
      flashCell(pctCell, newPct > old.pct ? "up" : "down");
    }
  });
}

/**
 * Animate a number from `from` to `to` inside `el` over `duration` ms.
 * Uses ease-out cubic for smooth deceleration.
 * `formatter` converts the current number to display string.
 */
function animateNumber(el, from, to, duration, formatter) {
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / duration);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = from + (to - from) * eased;
    el.textContent = formatter(current, to);
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

/**
 * Flash a cell green or red briefly on change
 */
function flashCell(el, direction) {
  // Remove any existing flash class
  el.classList.remove("num-flash-up", "num-flash-down");
  // Force reflow to restart animation
  void el.offsetWidth;
  el.classList.add(direction === "up" ? "num-flash-up" : "num-flash-down");
  // Clean up after animation
  setTimeout(() => {
    el.classList.remove("num-flash-up", "num-flash-down");
  }, 650);
}

/**
 * Format price for animation display.
 * Uses the final value's decimal precision to stay consistent.
 */
function formatPrice(current, finalValue) {
  if (!Number.isFinite(current)) return "$—";
  // Match decimals to the final value
  let decimals = 2;
  if (Number.isFinite(finalValue) && finalValue > 0 && finalValue < 0.01) {
    decimals = Math.max(2, Math.ceil(-Math.log10(finalValue)) + 1);
    decimals = Math.min(decimals, 6);
  }
  return `$${current.toFixed(decimals)}`;
}

/**
 * Format percentage for animation display.
 */
function formatPct(current, finalValue) {
  if (!Number.isFinite(current)) return "—";
  // On mobile use 1 decimal, desktop use 2
  const decimals = window.innerWidth <= 640 ? 1 : 2;
  const sign = current > 0 ? "+" : "";
  return `${sign}${current.toFixed(decimals)}%`;
}





// Volume fire emoji — shows when volume is elevated vs average
function renderVolumeFire(volume, avgVolume, marketCap, mode) {
  return "";
}

// RVOL (Relative Volume) cell renderer
// Stocks: volume / avgVolume → "3.2x"
// Crypto: volume / marketCap → "42%"
function renderRvol(volume, avgVolume, marketCap, mode) {
  if (!volume) return '<span class="rvol-normal">—</span>';

  if (mode === "stock") {
    // Prefer avgVolume ratio if available
    if (mode === "stock") {
      if (avgVolume && avgVolume > 0) {
        const ratio = volume / avgVolume;
        let tier = "rvol-normal";
        let suffix = "";
        if (ratio >= 3.0) { tier = "rvol-hot"; suffix = " 🔥"; }
        else if (ratio >= 1.5) { tier = "rvol-warm"; }
        return `<span class="${tier}" title="Volume is ${ratio.toFixed(1)}× the average">${ratio.toFixed(1)}x${suffix}</span>`;
      }
      // No avgVolume available — show dash instead of misleading vol/mcap ratio
      return '<span class="rvol-normal" title="Average volume data unavailable">—</span>';
    }
    // Fallback: vol/mcap ratio
    if (marketCap && marketCap > 0) {
      const ratio = volume / marketCap;
      let tier = "rvol-normal";
      let suffix = "";
      if (ratio >= 0.05) { tier = "rvol-hot"; suffix = " 🔥"; }
      else if (ratio >= 0.01) { tier = "rvol-warm"; }
      return `<span class="${tier}" title="Volume is ${(ratio * 100).toFixed(1)}% of market cap">${ratio.toFixed(1)}x${suffix}</span>`;
    }
  }

  if (mode === "crypto" && marketCap && marketCap > 0) {
    const ratio = volume / marketCap;
    let tier = "rvol-normal";
    let suffix = "";
    if (ratio >= 0.50) { tier = "rvol-hot"; suffix = " 🔥"; }
    else if (ratio >= 0.15) { tier = "rvol-warm"; }
    return `<span class="${tier}" title="24h volume is ${ratio.toFixed(2)}× market cap">${ratio.toFixed(1)}x${suffix}</span>`;
  }

  return '<span class="rvol-normal">—</span>';
}

// Returns plain text RVOL for tweet (e.g. "3.2x") — no HTML
function renderRvolRaw(volume, avgVolume, marketCap, mode) {
  if (!volume) return null;
  if (mode === "stock" && avgVolume && avgVolume > 0) {
    return `${(volume / avgVolume).toFixed(1)}x`;
  }
  if (mode === "crypto" && marketCap && marketCap > 0) {
    return `${(volume / marketCap).toFixed(1)}x`;
  }
  return null;
}

/**
 * Mobile: trim percent-change values to 1 decimal place
 * Drop this into app.js wherever you build/update table rows,
 * or call it after each data refresh.
 *
 * Example usage:
 *   if (window.innerWidth <= 640) trimMobileDecimals();
 */
function trimMobileDecimals() {
  if (window.innerWidth > 640) return;

  document.querySelectorAll('.change-pct').forEach(el => {
    const text = el.textContent.trim();
    // Match patterns like +34.36% or -2.15%
    const match = text.match(/^([+-]?)(\d+\.\d{2,})%$/);
    if (match) {
      const num = parseFloat(match[1] + match[2]);
      el.textContent = (num >= 0 ? '+' : '') + num.toFixed(1) + '%';
    }
  });
}

/** Mobile: shorten table header labels */
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

// Run after each table render / data refresh
// You can also integrate this directly into your renderStocksTable / renderCryptoTable functions

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
  
    const leftPct = data?.header?.left?.pct ?? data?.header?.btcPct ?? null;
    const rightPct = data?.header?.right?.pct ?? data?.header?.totalMarketPct ?? null;
  
    setIdxValue(idxLeftValue, leftPct);
    setIdxValue(idxRightValue, rightPct);
  
    idxWrap?.classList.toggle("crypto", currentMode === "crypto");
    
    // Market session indicator (stocks only)
    const marketSessionNotice = document.getElementById("marketClosedNotice");
    const marketSessionText = marketSessionNotice?.querySelector(".market-session-text");
  
    if (marketSessionNotice && currentMode === "stocks") {
      const session = data?.marketSession || "closed";
      
      // Remove all session classes
      marketSessionNotice.classList.remove("session-closed", "session-premarket", "session-afterhours", "session-open");
      
      if (session === "open") {
        // Hide when market is open
        marketSessionNotice.style.display = "none";
      } else {
// NEW:
marketSessionNotice.style.display = "flex";
marketSessionNotice.classList.add(`session-${session}`);

if (marketSessionText) {
  const affiliateId = "162729";
  const tvLink = `https://www.tradingview.com/markets/stocks-usa/market-movers-active/?aff_id=${affiliateId}`;
  
  if (session === "premarket") {
    marketSessionText.innerHTML = `Pre-Market — Live extended hours prices`;
  } else if (session === "afterhours") {
    marketSessionText.innerHTML = `After-Hours — Live extended hours prices`;
  } else {
    marketSessionText.textContent = data?.marketSessionLabel || "Market Closed";
  }
}
      }
    } else if (marketSessionNotice) {
      // Hide for crypto (24/7 market)
      marketSessionNotice.style.display = "none";
    }
  }

  // ----------------------------
  // Filters (mode-aware, matches HTML)
  // ----------------------------
  
  // Track separate touched states and values for each mode
  const filterState = {
    stocks: {
      mcapTouched: false,
      mcapValue: MODE_DEFAULTS.stocks.mcapDial,
      priceTouched: false,
      priceValue: MODE_DEFAULTS.stocks.priceMax,
      volTouched: false,
      volValue: MODE_DEFAULTS.stocks.volMin,
      pctMinOverride: null,
    },
    crypto: {
      mcapTouched: false,
      mcapValue: MODE_DEFAULTS.crypto.mcapDial,
      priceTouched: false,
      priceValue: MODE_DEFAULTS.crypto.priceMax,
      volTouched: false,
      volValue: MODE_DEFAULTS.crypto.volMin,
      pctMinOverride: null,
    },
  };

  function setMcapUiForMode(mode) {
    if (!filterEls.mcapRange) return;
  
    // Both modes now use dial: 0..1000 (logarithmic scale)
    filterEls.mcapRange.min = "0";
    filterEls.mcapRange.max = "1000";
    filterEls.mcapRange.step = "1";
  
    if (mode === "crypto") {
      if (filterEls.mcapLabel) filterEls.mcapLabel.textContent = "Market Cap (Min)";
      
      // Show crypto pill, hide stocks pill
      if (filterEls.mcapPillStocks) filterEls.mcapPillStocks.style.display = "none";
      if (filterEls.mcapPillCrypto) filterEls.mcapPillCrypto.style.display = "";
  
      // Update meta labels for crypto
      if (filterEls.mcapMetaLeft) filterEls.mcapMetaLeft.textContent = "$50M";
      if (filterEls.mcapMetaRight) filterEls.mcapMetaRight.textContent = "$100B+";
  
      const dial = filterState.crypto.mcapTouched 
        ? filterState.crypto.mcapValue 
        : MODE_DEFAULTS.crypto.mcapDial;
      
      filterEls.mcapRange.value = String(dial);
      lastCryptoMcapMin = cryptoMcapFromDial(dial);
      
      if (filterEls.mcapTextCrypto) {
        filterEls.mcapTextCrypto.textContent = `${fmtMoneyShort(lastCryptoMcapMin)}+`;
      }
      
    } else {
      // Stocks - now also uses log dial for MIN market cap
      if (filterEls.mcapLabel) filterEls.mcapLabel.textContent = "Market Cap (Min)";
  
      // Show stocks pill (reuse crypto pill style), hide the old stocks pill
      if (filterEls.mcapPillStocks) filterEls.mcapPillStocks.style.display = "none";
      if (filterEls.mcapPillCrypto) filterEls.mcapPillCrypto.style.display = "";
  
      // Update meta labels for stocks
      if (filterEls.mcapMetaLeft) filterEls.mcapMetaLeft.textContent = "$100M";
      if (filterEls.mcapMetaRight) filterEls.mcapMetaRight.textContent = "$500B";
  
      const dial = filterState.stocks.mcapTouched 
        ? filterState.stocks.mcapValue 
        : MODE_DEFAULTS.stocks.mcapDial;
      
      filterEls.mcapRange.value = String(dial);
      
      // Use the crypto text element for stocks too
      if (filterEls.mcapTextCrypto) {
        filterEls.mcapTextCrypto.textContent = `${fmtMoneyShort(stockMcapFromDial(dial))}+`;
      }
    }
  }

  function setPriceUiForMode(mode) {
    if (!filterEls.priceRange) return;

    const state = filterState[mode];
    const d = MODE_DEFAULTS[mode];

    // Price filter config (same for both modes currently, but can diverge)
    const priceMin = 1;
    const priceMax = 5000;

    filterEls.priceRange.min = String(priceMin);
    filterEls.priceRange.max = String(priceMax);
    filterEls.priceRange.step = "1";

    // Update meta labels
    if (priceMetaLeft) priceMetaLeft.textContent = `$${priceMin}`;
    if (priceMetaRight) priceMetaRight.textContent = `$${priceMax.toLocaleString()}`;

    // Set current value
    const price = state.priceTouched ? state.priceValue : d.priceMax;
    filterEls.priceRange.value = String(price);
    if (priceNum) priceNum.value = String(price);
  }

  function setVolumeUiForMode(mode) {
    if (!filterEls.volRange) return;

    const state = filterState[mode];
    const d = MODE_DEFAULTS[mode];

    // Volume filter config (same for both modes currently)
    const volMin = 0;
    const volMax = 50_000_000;

    filterEls.volRange.min = String(volMin);
    filterEls.volRange.max = String(volMax);
    filterEls.volRange.step = "100000";

    // Update meta labels
    if (volMetaLeft) volMetaLeft.textContent = "0";
    if (volMetaRight) volMetaRight.textContent = "50M";

    // Set current value
    const vol = state.volTouched ? state.volValue : d.volMin;
    filterEls.volRange.value = String(vol);
    if (volNum) volNum.value = String(vol);
  }

  function setUiDefaultsForMode(mode) {
    const d = MODE_DEFAULTS[mode];

    // News required checkbox
    if (filterEls.newsRequiredChk) {
      filterEls.newsRequiredChk.checked = !!d.newsRequired;
    }
    if (filterEls.highVolChk) {
      filterEls.highVolChk.checked = !!d.highVolumeOnly;
    }
    // Update all filter UIs for the current mode
    setMcapUiForMode(mode);
    setPriceUiForMode(mode);
    setVolumeUiForMode(mode);
    
    // Disable/enable catalyst filter card for crypto mode
    setCatalystUiForMode(mode);
  }
  
  function setCatalystUiForMode(mode) {
    // Find the catalyst filter card (it's the one with the checklist)
    const catalystCard = document.querySelector(".filter-card .checklist")?.closest(".filter-card");
    if (!catalystCard) return;
    
    if (mode === "crypto") {
      // Disable the catalyst card for crypto
      catalystCard.classList.add("filter-card-disabled");
      catalystCard.querySelectorAll("input").forEach(input => {
        input.disabled = true;
      });
    } else {
      // Enable the catalyst card for stocks
      catalystCard.classList.remove("filter-card-disabled");
      catalystCard.querySelectorAll("input").forEach(input => {
        input.disabled = false;
      });
    }
  }

  function readFiltersForMode(mode) {
    const d = MODE_DEFAULTS[mode];
  
    const highVolumeOnly = filterEls.highVolChk ? !!filterEls.highVolChk.checked : false;
  
    const limit = d.limit;
    const pctMin = filterState[mode].pctMinOverride ?? d.pctMin;
  
    const volMin = filterEls.volRange ? Number(filterEls.volRange.value) : d.volMin;
    const priceMax = filterEls.priceRange ? Number(filterEls.priceRange.value) : d.priceMax;
  
    const newsRequired = filterEls.newsRequiredChk
      ? !!filterEls.newsRequiredChk.checked
      : d.newsRequired;
  
    if (mode === "crypto") {
      const dial = filterEls.mcapRange ? Number(filterEls.mcapRange.value) : d.mcapDial;
      const mcapMin = cryptoMcapFromDial(dial);
      lastCryptoMcapMin = mcapMin;
      return { limit, pctMin, volMin, priceMax, mcapMin, newsRequired, dial };
    }
  
    // Stocks - now uses mcapMin from dial (no mcapMax)
    const dial = filterEls.mcapRange ? Number(filterEls.mcapRange.value) : d.mcapDial;
    const mcapMin = stockMcapFromDial(dial);
    
    return { limit, pctMin, volMin, priceMax, mcapMin, newsRequired, dial };
  }
  

  function buildApiPath(mode) {
    const f = readFiltersForMode(mode);
    if (!f) throw new Error("readFiltersForMode returned nothing");
  
    const p = new URLSearchParams();
    p.set("limit", String(f.limit));
    p.set("pctMin", String(f.pctMin));
    p.set("volMin", String(f.volMin));
    p.set("priceMax", String(f.priceMax));
    p.set("newsRequired", f.newsRequired ? "true" : "false");
    p.set("highVolumeOnly", f.highVolumeOnly ? "true" : "false");
    
    // Both modes now use mcapMin
    p.set("mcapMin", String(f.mcapMin));
  
    const path = mode === "crypto"
      ? `/api/crypto?${p.toString()}`
      : `/api/stocks?${p.toString()}`;
  
    console.log("[StockJelli] mode:", mode, "filters:", f, "path:", path);
    return path;
  }
  

  // ---- wire inputs / touch markers ----
  filterEls.mcapRange?.addEventListener("input", () => {
    const state = filterState[currentMode];
    const dial = Number(filterEls.mcapRange.value || 0);
    
    state.mcapTouched = true;
    state.mcapValue = dial;
    
    if (currentMode === "crypto") {
      lastCryptoMcapMin = cryptoMcapFromDial(dial);
      if (filterEls.mcapTextCrypto) {
        filterEls.mcapTextCrypto.textContent = `${fmtMoneyShort(lastCryptoMcapMin)}+`;
      }
    } else {
      if (filterEls.mcapTextCrypto) {
        filterEls.mcapTextCrypto.textContent = `${fmtMoneyShort(stockMcapFromDial(dial))}+`;
      }
    }
  });
  

  // stocks-only: mcapNumStocks editable
  filterEls.mcapNumStocks?.addEventListener("input", () => {
    if (currentMode !== "stocks") return;
    if (!filterEls.mcapRange) return;
    const v = clamp(filterEls.mcapNumStocks.value, 1, 500);
    filterEls.mcapNumStocks.value = String(v);
    filterEls.mcapRange.value = String(v);
    filterState.stocks.mcapTouched = true;
    filterState.stocks.mcapValue = v;
  });

  // price sync (range <-> pill input)
  filterEls.priceRange?.addEventListener("input", () => {
    const state = filterState[currentMode];
    state.priceTouched = true;
    state.priceValue = Number(filterEls.priceRange.value);
    if (priceNum) priceNum.value = filterEls.priceRange.value;
  });
  
  priceNum?.addEventListener("input", () => {
    if (!filterEls.priceRange) return;
    const v = clamp(priceNum.value, Number(filterEls.priceRange.min || 1), Number(filterEls.priceRange.max || 5000));
    priceNum.value = String(v);
    filterEls.priceRange.value = String(v);
    const state = filterState[currentMode];
    state.priceTouched = true;
    state.priceValue = v;
  });

  // volume sync
  filterEls.volRange?.addEventListener("input", () => {
    const state = filterState[currentMode];
    state.volTouched = true;
    state.volValue = Number(filterEls.volRange.value);
    if (volNum) volNum.value = filterEls.volRange.value;
  });
  
  volNum?.addEventListener("input", () => {
    if (!filterEls.volRange) return;
    const v = clamp(volNum.value, Number(filterEls.volRange.min || 0), Number(filterEls.volRange.max || 50_000_000));
    volNum.value = String(v);
    filterEls.volRange.value = String(v);
    const state = filterState[currentMode];
    state.volTouched = true;
    state.volValue = v;
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
      const path = buildApiPath(currentMode);
      const data = await apiGet(path);
      applyHeaderFromApi(data);
      
      let rows = data.rows;
      
      // Client-side high volume filter
// Client-side RVOL filter
const highVolOnly = filterEls.highVolChk?.checked || false;
if (highVolOnly && rows) {
    rows = rows.filter(r => {
        if (currentMode === "stocks") {
            return r.avgVolume && r.avgVolume > 0 && (r.volume / r.avgVolume) >= 1.5;
        } else {
            return r.marketCap && r.marketCap > 0 && (r.volume / r.marketCap) >= 1.5;
        }
    });
}
      data.rows = rows;
      
      if (currentMode === "crypto") renderCrypto(data.rows);
      else renderStocks(data.rows);
      renderRegime(data.regime);
    } catch (e) {
      console.error("[StockJelli] refreshOnce failed:", e);
    }
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

    // CoinGecko attribution — show only on crypto tab
    const cryptoAttr = document.getElementById("cryptoAttribution");
    if (cryptoAttr) cryptoAttr.style.display = mode === "crypto" ? "" : "none";

    if (heroChartStocks) heroChartStocks.style.display = mode === "stocks" ? "" : "none";
    if (heroChartCrypto) heroChartCrypto.style.display = mode === "crypto" ? "" : "none";

    // baseline labels (backend will overwrite on refresh)
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
    shortenMobileHeaders();  // ← HERE
    startPolling();
  }

  assetControl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    applyMode(btn.dataset.value === "crypto" ? "crypto" : "stocks");
  });

  // init


  const savedMode = localStorage.getItem("sj_asset_mode");
  applyMode(savedMode === "crypto" ? "crypto" : "stocks");

  // apply/reset
  filterEls.applyBtn?.addEventListener("click", () => refreshOnce());

  filterEls.resetBtn?.addEventListener("click", () => {
    const state = filterState[currentMode];
    const d = MODE_DEFAULTS[currentMode];
    
    state.mcapTouched = false;
    state.mcapValue = currentMode === "crypto" ? d.mcapDial : d.mcapMaxB;
    state.priceTouched = false;
    state.priceValue = d.priceMax;
    state.volTouched = false;
    state.volValue = d.volMin;
    state.pctMinOverride = null;
    
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

  function updateVisibility() {
    presetsRow.style.display = currentMode === "stocks" ? "flex" : "none";
  }
  const stocksTableEl = document.getElementById("stocksTable");
  if (stocksTableEl) {
    new MutationObserver(updateVisibility).observe(stocksTableEl, { attributes: true, attributeFilter: ["style"] });
  }
  updateVisibility();

  function setActive(btn) {
    [presetDefault, presetMidCap, presetLargeCap].forEach(b => b?.classList.remove("preset-active"));
    btn?.classList.add("preset-active");
  }

  presetDefault?.addEventListener("click", () => {
    setActive(presetDefault);
    const state = filterState.stocks;
    const d = MODE_DEFAULTS.stocks;
    state.mcapTouched = false;
    state.mcapValue = d.mcapDial;
    state.priceTouched = false;
    state.priceValue = d.priceMax;
    state.volTouched = false;
    state.volValue = d.volMin;
    state.pctMinOverride = null;
    setUiDefaultsForMode("stocks");
    refreshOnce();
  });

  presetMidCap?.addEventListener("click", () => {
    setActive(presetMidCap);
    filterState.stocks.mcapTouched = true;
    filterState.stocks.mcapValue = 270;
    filterState.stocks.priceTouched = true;
    filterState.stocks.priceValue = 5000;
    filterState.stocks.volTouched = true;
    filterState.stocks.volValue = 500_000;
    filterState.stocks.pctMinOverride = 3;
    setMcapUiForMode("stocks");
    setPriceUiForMode("stocks");
    setVolumeUiForMode("stocks");
    refreshOnce();
  });

  presetLargeCap?.addEventListener("click", () => {
    setActive(presetLargeCap);
    filterState.stocks.mcapTouched = true;
    filterState.stocks.mcapValue = 541;
    filterState.stocks.priceTouched = true;
    filterState.stocks.priceValue = 5000;
    filterState.stocks.volTouched = true;
    filterState.stocks.volValue = 500_000;
    filterState.stocks.pctMinOverride = 3;
    setMcapUiForMode("stocks");
    setPriceUiForMode("stocks");
    setVolumeUiForMode("stocks");
    refreshOnce();
  });
})();

  // ----------------------------
  // Legal modals (Privacy / Terms)
  // ----------------------------
  (function initLegalModals() {
    const privacyModal = document.getElementById("privacyModal");
    const termsModal = document.getElementById("termsModal");

    const openPrivacyBtn = document.getElementById("openPrivacyBtn");
    const openTermsBtn = document.getElementById("openTermsBtn");

    const closePrivacyBtn = document.getElementById("closePrivacyBtn");
    const closeTermsBtn = document.getElementById("closeTermsBtn");

    if (!privacyModal || !termsModal) return;

    function openModal(modalEl) {
      modalEl.classList.add("is-open");
      modalEl.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closeModal(modalEl) {
      modalEl.classList.remove("is-open");
      modalEl.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    openPrivacyBtn?.addEventListener("click", () => openModal(privacyModal));
    openTermsBtn?.addEventListener("click", () => openModal(termsModal));

    closePrivacyBtn?.addEventListener("click", () => closeModal(privacyModal));
    closeTermsBtn?.addEventListener("click", () => closeModal(termsModal));

    // Click outside closes
    privacyModal.addEventListener("click", (e) => {
      if (e.target === privacyModal) closeModal(privacyModal);
    });
    termsModal.addEventListener("click", (e) => {
      if (e.target === termsModal) closeModal(termsModal);
    });

    // ESC closes whichever is open
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (privacyModal.classList.contains("is-open")) closeModal(privacyModal);
      if (termsModal.classList.contains("is-open")) closeModal(termsModal);
    });
  })();

  // ----------------------------
  // About / Contact modals
  // ----------------------------
  (function initAboutContactModals() {
    const aboutModal = document.getElementById("aboutModal");
    const contactModal = document.getElementById("contactModal");

    const openAboutBtn = document.getElementById("openAboutBtn");
    const openContactBtn = document.getElementById("openContactBtn");

    const closeAboutBtn = document.getElementById("closeAboutBtn");
    const closeContactBtn = document.getElementById("closeContactBtn");
    const contactCancelBtn = document.getElementById("contactCancelBtn");

    function openModalSafe(modalEl) {
      if (!modalEl) return;
      modalEl.classList.add("is-open");
      modalEl.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closeModalSafe(modalEl) {
      if (!modalEl) return;
      modalEl.classList.remove("is-open");
      modalEl.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    openAboutBtn?.addEventListener("click", () => openModalSafe(aboutModal));
    openContactBtn?.addEventListener("click", () => openModalSafe(contactModal));

    closeAboutBtn?.addEventListener("click", () => closeModalSafe(aboutModal));
    closeContactBtn?.addEventListener("click", () => closeModalSafe(contactModal));
    contactCancelBtn?.addEventListener("click", () => closeModalSafe(contactModal));

    aboutModal?.addEventListener("click", (e) => {
      if (e.target === aboutModal) closeModalSafe(aboutModal);
    });

    contactModal?.addEventListener("click", (e) => {
      if (e.target === contactModal) closeModalSafe(contactModal);
    });

    // Contact form placeholder (no backend yet)
    const contactForm = document.getElementById("contactForm");
    contactForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const formData = new FormData(contactForm);
      const name = formData.get("name")?.trim();
      const email = formData.get("email")?.trim();
      const message = formData.get("message")?.trim();
      
      if (!name || !email || !message) {
        alert("Please fill in all fields.");
        return;
      }
      
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }
      
      try {
        const res = await fetch(`${API_BASE}/api/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, message }),
        });
        
        const data = await res.json();
        
        if (res.ok) {
          alert("Thanks! Your message has been sent.");
          closeModalSafe(contactModal);
          contactForm.reset();
        } else {
          alert(data.error || "Failed to send message. Please try again.");
        }
      } catch (err) {
        console.error("Contact form error:", err);
        alert("Failed to send message. Please try again.");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  })();

// ----------------------------
  // Drawer (burger menu)
  // ----------------------------
  (function initDrawer() {
    const menuBtn = document.getElementById("menuBtn");
    const drawer = document.getElementById("drawer");
    const drawerOverlay = document.getElementById("drawerOverlay");
    const drawerClose = document.getElementById("drawerClose");
    const drawerAboutBtn = document.getElementById("drawerAboutBtn");
    const drawerContactBtn = document.getElementById("drawerContactBtn");

    if (!drawer || !menuBtn) return;

    function openDrawer() {
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
      drawerOverlay?.classList.add("is-open");
      document.body.style.overflow = "hidden";
    }

    function closeDrawer() {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
      drawerOverlay?.classList.remove("is-open");
      document.body.style.overflow = "";
    }

    menuBtn.addEventListener("click", openDrawer);
    drawerClose?.addEventListener("click", closeDrawer);
    drawerOverlay?.addEventListener("click", closeDrawer);

    // Close drawer when clicking a link
    drawer.querySelectorAll("a.drawer-link").forEach(link => {
      link.addEventListener("click", closeDrawer);
    });

    // About button in drawer
    drawerAboutBtn?.addEventListener("click", () => {
      closeDrawer();
      const aboutModal = document.getElementById("aboutModal");
      if (aboutModal) {
        aboutModal.classList.add("is-open");
        aboutModal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
      }
    });

    // Contact button in drawer
    drawerContactBtn?.addEventListener("click", () => {
      closeDrawer();
      const contactModal = document.getElementById("contactModal");
      if (contactModal) {
        contactModal.classList.add("is-open");
        contactModal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
      }
    });

    // ESC to close drawer
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) {
        closeDrawer();
      }
    });


  })();


// SJ Score unlock — open alerts modal (subscription flow)
// SJ Score unlock — open SJ unlock modal (NOT the subscribe modal)
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".sj-unlock-btn");
  if (!btn) return;
  
  const sjModal = document.getElementById("sjUnlockModal");
  if (sjModal) {
    sjModal.classList.add("is-open");
    sjModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    // Focus the email input
    const emailInput = document.getElementById("sjUnlockEmail");
    if (emailInput) setTimeout(() => emailInput.focus(), 100);
  }
});

// SJ Unlock modal — close handlers
(function initSjUnlockModal() {
  const modal = document.getElementById("sjUnlockModal");
  const closeBtn = document.getElementById("closeSjUnlockBtn");
  const verifyBtn = document.getElementById("sjUnlockVerifyBtn");
  const emailInput = document.getElementById("sjUnlockEmail");
  const errorEl = document.getElementById("sjUnlockError");
  const successEl = document.getElementById("sjUnlockSuccess");
  const subscribeLink = document.getElementById("sjUnlockSubscribeLink");
  
  if (!modal) return;
  
  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  
  closeBtn?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });
  
  // Subscribe link → close this modal, open alerts modal
  subscribeLink?.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal();
    const alertsBtn = document.getElementById("enableAlertsBtn");
    if (alertsBtn) alertsBtn.click();
  });
  
  // Verify button
  verifyBtn?.addEventListener("click", async () => {
    const email = (emailInput?.value || "").trim().toLowerCase();
    
    // Hide previous messages
    if (errorEl) errorEl.style.display = "none";
    if (successEl) successEl.style.display = "none";
    
    if (!email || !email.includes("@")) {
      if (errorEl) {
        errorEl.textContent = "Please enter a valid email address.";
        errorEl.style.display = "block";
      }
      return;
    }
    
    // Show loading state
    verifyBtn.disabled = true;
    verifyBtn.textContent = "Verifying...";
    
    try {
      const res = await fetch(`${API_BASE}/api/verify-subscriber?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      
      if (data.active) {
        // Save to localStorage
        localStorage.setItem("sj_subscriber_email", email);
        
        if (successEl) {
          successEl.textContent = "✓ Verified! All SJ Scores are now unlocked.";
          successEl.style.display = "block";
        }
        
        // Force re-render to unblur all scores
        setTimeout(() => {
          closeModal();
          // Trigger a refresh to re-render with unblurred scores
          refreshOnce();
        }, 1200);
        
      } else {
        if (errorEl) {
          errorEl.textContent = "No active subscription found for this email. Subscribe below to unlock.";
          errorEl.style.display = "block";
        }
      }
    } catch (err) {
      console.error("[sj-unlock] Verification error:", err);
      if (errorEl) {
        errorEl.textContent = "Verification failed. Please try again.";
        errorEl.style.display = "block";
      }
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = "Verify & Unlock";
    }
  });
  
  // Enter key submits
  emailInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") verifyBtn?.click();
  });
})();

/* ============================================
   NOTIFICATION BETA BANNER — JS
   
   Add via <script src="notif-banner.js" defer>
   or paste at the bottom of app.js.
   ============================================ */

   (function () {
    'use strict';
  
    const DISMISS_KEY = 'sj_notif_banner_dismissed';
    const WAITLIST_KEY = 'sj_notif_waitlist_joined';
  
    const banner = document.getElementById('notifBanner');
    if (!banner) return;
  
    // ── Already dismissed? Hide immediately ──
    if (localStorage.getItem(DISMISS_KEY) === '1') {
      banner.classList.add('notif-dismissed');
      return;
    }
  
    // ── Already on waitlist? Show "You're on the list" state ──
    const savedEmail = localStorage.getItem(WAITLIST_KEY);
    if (savedEmail) {
      showJoinedState(savedEmail);
    }
  
    // ── Dismiss handler ──
    const closeBtn = document.getElementById('notifBannerClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        banner.classList.add('notif-banner-hiding');
        setTimeout(() => {
          banner.classList.add('notif-dismissed');
          localStorage.setItem(DISMISS_KEY, '1');
        }, 300);
      });
    }
  
    // ── Form submit handler ──
    const form = document.getElementById('notifWaitlistForm');
    const emailInput = document.getElementById('notifEmail');
    const submitBtn = document.getElementById('notifSubmitBtn');
    const msgEl = document.getElementById('notifFormMsg');
  
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
  
        const email = emailInput.value.trim();
        if (!email || !isValidEmail(email)) {
          showMsg('Please enter a valid email.', 'error');
          return;
        }
  
        // Disable button, show loading
        submitBtn.disabled = true;
        submitBtn.querySelector('.notif-submit-text').style.display = 'none';
        submitBtn.querySelector('.notif-submit-loading').style.display = 'inline-flex';
  
        try {
          // ── POST to your backend endpoint ──
          // Replace this URL with your actual waitlist endpoint
          const res = await fetch('https://api.stockjelli.com/api/notif-waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
  
          if (res.ok) {
            localStorage.setItem(WAITLIST_KEY, email);
            showMsg("You're on the list! We'll notify you when the beta launches.", 'success');
            showJoinedState(email);
          } else {
            const data = await res.json().catch(() => ({}));
            showMsg(data.message || 'Something went wrong. Try again.', 'error');
          }
        } catch (err) {
          // ── Fallback: save locally even if endpoint isn't wired yet ──
          console.warn('Waitlist endpoint not available, saving locally:', err);
          localStorage.setItem(WAITLIST_KEY, email);
          showMsg("You're on the list! We'll email you when the beta launches.", 'success');
          showJoinedState(email);
        } finally {
          submitBtn.disabled = false;
          submitBtn.querySelector('.notif-submit-text').style.display = '';
          submitBtn.querySelector('.notif-submit-loading').style.display = 'none';
        }
      });
    }
  
    // ── Helpers ──
  
    function isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
  
    function showMsg(text, type) {
      if (!msgEl) return;
      msgEl.textContent = text;
      msgEl.className = 'notif-form-msg ' + (type === 'success' ? 'msg-success' : 'msg-error');
      msgEl.style.display = 'block';
    }
  
    function showJoinedState(email) {
      // Replace the form with a compact "you're in" confirmation
      if (!form) return;
      form.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; font-size: 0.74rem;">
          <span style="color: #4ade80;">✓</span>
          <span style="color: rgba(255,255,255,0.5);">
            <strong style="color: #4ade80;">You're on the list</strong>
            &middot; ${maskEmail(email)}
          </span>
        </div>
      `;
    }
  
    function maskEmail(email) {
      const [user, domain] = email.split('@');
      if (!domain) return email;
      const masked = user.length > 2
        ? user[0] + '···' + user[user.length - 1]
        : user[0] + '···';
      return masked + '@' + domain;
    }
  
  })();










})();