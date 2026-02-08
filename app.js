///app.st frontend

(() => {
  if (window.__STOCKJELLI_APP_INIT__) return;
  window.__STOCKJELLI_APP_INIT__ = true;

  // ----------------------------
  // Config
  // ----------------------------
  const API_BASE = "https://api.stockjelli.com";
  const POLL_MS = 60_000;

  const MODE_DEFAULTS = {
    stocks: {
      limit: 15,
      pctMin: 4,
      volMin: 1_000_000,
      priceMax: 300,
      mcapDial: 0,        // Changed from mcapMaxB to mcapDial (like crypto)
      newsRequired: false,
    },
    crypto: {
      limit: 15,
      pctMin: 3,
      volMin: 1_000_000,
      priceMax: 300,
      mcapDial: 0,      // 0..1000 (log dial)
      newsRequired: false,
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
      return ' <span class="new-badge-wrap"><span class="new-badge">NEW</span><span class="new-badge-tooltip">New since last visit</span></span>';
    }
  } catch (e) {
    // Invalid date, skip
  }
  
  return "";
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
function renderTickerCell(symbol, type = "stock") {
  const tvUrl = getTradingViewUrl(symbol, type);
  return `
    <span class="ticker-wrap">
      <span class="ticker-symbol">${symbol}</span>
      <a class="ticker-tv-link" href="${tvUrl}" target="_blank" rel="noopener" title="Open ${symbol} on TradingView">
        <span class="ticker-tv-tooltip">Open in TradingView ↗</span>
      </a>
    </span>
  `;
}

  function renderStocks(rows) {
    const tbody = document.getElementById("stocksTbody");
    if (!tbody) return;

    if (!rows || rows.length === 0) {
      tbody.innerHTML = `<tr><td class="ticker">—</td><td>$—</td><td>—</td><td>—</td><td class="news">—</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((x) => {
      const pct = x.pctChange;
      const changeClass = classUpDown(pct);
      
      // Range indicator using day low/high
      const rangeHtml = renderRangeIndicator(x.dayLow ?? x.rangeLow, x.dayHigh ?? x.rangeHigh, x.price);
      
      // News with tier styling
      const newsHtml = renderNewsCell(x.news);
      
      // Ticker with TradingView link
      const tickerHtml = renderTickerCell(x.symbol || "—", "stock");

      return `
        <tr>
        <td class="ticker">${renderTickerCell(x.symbol || "—", "stock")}${renderNewBadge(x.enteredAt)}</td>
         <td>${fmtUsd(x.price)}</td>
          <td class="${changeClass}">
            <span class="change-wrap">
              <span class="change-pct">${fmtPct(pct)}</span>
              ${rangeHtml}
            </span>
          </td>
          <td>${fmtVolumeCompact(x.volume)}</td>
          <td class="news">${newsHtml}</td>
        </tr>
      `;
    }).join("");
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
    tbody.innerHTML = `<tr><td class="ticker">—</td><td>$—</td><td>—</td><td>—</td><td>—</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((x) => {
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

    const isExtremeGain = pct > 500;
    const isMassiveGain = pct > 1000;
    const isCrashedRange = rangePos < 0.20;
    const isHighVolRatio = mcap > 0 && (vol / mcap) > 1.0;
    const isMediumVolRatio = mcap > 0 && (vol / mcap) > 0.5;

    const showWarning =
      isMassiveGain ||
      (isExtremeGain && isCrashedRange) ||
      (isExtremeGain && isHighVolRatio) ||
      (isCrashedRange && isMediumVolRatio) ||
      (pct > 200 && isCrashedRange && isMediumVolRatio);

    if (showWarning) {
      rugWarning = ' <span class="rug-warning" title="⚠️ Elevated risk: extreme move and/or unusual volume vs market cap">⚠️</span>';
    }

    const tickerHtml = renderTickerCell(x.coinSymbol || "—", "crypto");

    return `
      <tr>
      <td class="ticker">${tickerHtml}${rugWarning}${renderNewBadge(x.enteredAt)}</td>
        <td>${fmtUsd(x.price, priceDecimals)}</td>
        <td class="${changeClass}">
          <span class="change-wrap">
            <span class="change-pct">${fmtPct(pct)}</span>
            ${rangeHtml}
          </span>
        </td>
        <td>${fmtVolumeCompact(x.volume)}${renderLiquidityDot(x.volume, x.marketCap)}</td>
        <td>${fmtCompactUsd(x.marketCap, 1)}</td>
      </tr>
    `;
  }).join("");
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
    marketSessionText.innerHTML = `Pre-Market — Showing last close · <a href="${tvLink}" target="_blank" rel="noopener" class="session-tv-link">Check live pre-market on TradingView ↗</a>`;
  } else if (session === "afterhours") {
    marketSessionText.innerHTML = `After-Hours — Showing last close · <a href="${tvLink}" target="_blank" rel="noopener" class="session-tv-link">Check live after-hours on TradingView ↗</a>`;
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
      mcapValue: MODE_DEFAULTS.stocks.mcapDial,  // Now uses dial
      priceTouched: false,
      priceValue: MODE_DEFAULTS.stocks.priceMax,
      volTouched: false,
      volValue: MODE_DEFAULTS.stocks.volMin,
    },
    crypto: {
      mcapTouched: false,
      mcapValue: MODE_DEFAULTS.crypto.mcapDial,
      priceTouched: false,
      priceValue: MODE_DEFAULTS.crypto.priceMax,
      volTouched: false,
      volValue: MODE_DEFAULTS.crypto.volMin,
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
  
    const limit = d.limit;
    const pctMin = d.pctMin;
  
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
  let currentMode = "stocks";
  let pollTimer = null;

  async function refreshOnce() {
    try {
      const path = buildApiPath(currentMode);
      const data = await apiGet(path);

      applyHeaderFromApi(data);

      if (currentMode === "crypto") renderCrypto(data.rows);
      else renderStocks(data.rows);
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
    // Reset state for current mode
    const state = filterState[currentMode];
    const d = MODE_DEFAULTS[currentMode];
    
    state.mcapTouched = false;
    state.mcapValue = currentMode === "crypto" ? d.mcapDial : d.mcapMaxB;
    state.priceTouched = false;
    state.priceValue = d.priceMax;
    state.volTouched = false;
    state.volValue = d.volMin;
    
    setUiDefaultsForMode(currentMode);
    refreshOnce();
  });

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
/* ============================================
   StockJelli Homepage Updates — JS Additions
   
   Add this code to the END of your existing app.js,
   inside the main IIFE (before the final })(); )
   
   Two additions:
   1. Live timestamp that counts up since last refresh
   2. Inline alert CTA button wiring
   ============================================ */


// ----------------------------
// 1. Live Timestamp Updater
// ----------------------------
// Tracks when data was last fetched and shows "Updated Xs ago" / "Updated Xm ago"
// This replaces the static "Updates every 1 min" badge.

(function initLiveTimestamp() {
  const timestampEl = document.getElementById("liveTimestamp");
  const badgeEl = timestampEl?.closest(".live-update-badge");
  if (!timestampEl) return;

  let lastRefreshTime = Date.now();

  // Update the display every second
  function updateTimestampDisplay() {
    const elapsed = Math.floor((Date.now() - lastRefreshTime) / 1000);

    if (elapsed < 5) {
      timestampEl.textContent = "just now";
    } else if (elapsed < 60) {
      timestampEl.textContent = `${elapsed}s ago`;
    } else {
      const mins = Math.floor(elapsed / 60);
      timestampEl.textContent = `${mins}m ago`;
    }
  }

  setInterval(updateTimestampDisplay, 1000);

  // Hook into the existing refreshOnce function to reset the timer.
  // We do this by patching the global fetch to detect our API calls.
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
    const promise = originalFetch.apply(this, args);

    // Detect StockJelli API calls completing successfully
    if (url.includes("api.stockjelli.com/api/stocks") || url.includes("api.stockjelli.com/api/crypto")) {
      promise.then((res) => {
        if (res.ok) {
          lastRefreshTime = Date.now();
          // Brief flash to indicate fresh data
          if (badgeEl) {
            badgeEl.classList.add("just-updated");
            setTimeout(() => badgeEl.classList.remove("just-updated"), 1500);
          }
        }
      }).catch(() => {});
    }

    return promise;
  };
})();


// ----------------------------
// 2. Inline Alert CTA Wiring
// ----------------------------
// The inline alert button (between screener table and filters)
// opens the same alerts modal as the main "Enable Alerts" button.

(function initInlineAlertCta() {
  const inlineBtn = document.getElementById("inlineAlertBtn");
  if (!inlineBtn) return;

  inlineBtn.addEventListener("click", () => {
    const alertsBtn = document.getElementById("enableAlertsBtn");
    if (alertsBtn) alertsBtn.click();
  });
})();

/* ============================================
   StockJelli — All Feature JS Additions
   
   Append inside your app.js IIFE (before the closing })(); )
   
   Features:
   1. Scrolling Pulse Ticker (fetches /api/pulse + /api/stocks + /api/crypto)
   2. Live Timestamp Updater
   3. Inline Alert CTA wiring
   4. Yesterday's Top Movers (fetches /api/yesterday)
   5. Bookmark Prompt
   ============================================ */
/* ============================================
   StockJelli — All Feature JS Additions
   
   Append inside your app.js IIFE (before the closing })(); )
   REPLACES all previously appended JS blocks.
   ============================================ */


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

  // Generate pulse summary from actual live data
  // Rows are already filtered by the backend — just use what we get
  function buildPulseSummary(stocks, crypto, isMarketOpen) {
    const allStocks = (stocks || []).filter(r => r.pctChange > 0).sort((a,b) => b.pctChange - a.pctChange);
    const allCrypto = (crypto || []).filter(r => r.pctChange > 0).sort((a,b) => b.pctChange - a.pctChange);
    const totalMovers = allStocks.length + allCrypto.length;

    if (totalMovers === 0) {
      return isMarketOpen ? "Scanning for momentum…" : "Markets closed · Watching crypto";
    }

    // Merge and find absolute leader
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

    // Build pulse summary from actual data
    const summary = buildPulseSummary(stocks, crypto, isMarketOpen);
    items.push(`<span class="ticker-pulse-text"><span class="ticker-pulse-dot"></span>${summary}</span>`);
    items.push(`<span class="ticker-separator"></span>`);

    // Show up to 8 stocks — all positive movers the API returned
    const medals = ["🥇", "🥈", "🥉"];
    const topS = (stocks || []).filter(r => r.pctChange > 0).sort((a,b) => b.pctChange - a.pctChange).slice(0, 8);
    for (let i = 0; i < topS.length; i++) {
      const s = topS[i];
      const medal = i < 3 ? `<span class="ticker-medal">${medals[i]}</span> ` : "";
      items.push(`<span class="ticker-item">${medal}<span class="ticker-item-symbol">${s.symbol}</span> <span class="ticker-item-pct up">${fmtPct(s.pctChange)}</span></span>`);
    }

    if (topS.length > 0 && crypto?.length > 0) items.push(`<span class="ticker-separator"></span>`);

    // Show up to 8 crypto — all positive movers the API returned
    const topC = (crypto || []).filter(r => r.pctChange > 0).sort((a,b) => b.pctChange - a.pctChange).slice(0, 8);
    for (let i = 0; i < topC.length; i++) {
      const c = topC[i];
      const medal = i < 3 ? `<span class="ticker-medal">${medals[i]}</span> ` : "";
      items.push(`<span class="ticker-item">${medal}<span class="ticker-item-symbol">${c.coinSymbol || c.symbol}</span> <span class="ticker-item-pct up">${fmtPct(c.pctChange)}</span></span>`);
    }

    return items;
  }

  // Detect if US stock market is currently open
  function isUSMarketOpen() {
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = et.getDay();
    const h = et.getHours(), m = et.getMinutes();
    const mins = h * 60 + m;
    // Mon–Fri, 9:30 AM – 4:00 PM ET
    return day >= 1 && day <= 5 && mins >= 570 && mins < 960;
  }

  async function fetchTicker() {
    try {
      // Read current filter values from the page if available, otherwise use relaxed defaults
      // This ensures the ticker matches what the user sees in the table
      const stockMcap = document.getElementById("mcapSlider")?.value || 100000000;
      const cryptoMcap = 50000000; // Low enough to catch small-cap movers like SKR

      const [s, c] = await Promise.all([
        fetch(`https://api.stockjelli.com/api/stocks?limit=20&mcapMin=${stockMcap}`, {cache:"no-store"}).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`https://api.stockjelli.com/api/crypto?limit=20&mcapMin=${cryptoMcap}`, {cache:"no-store"}).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const items = buildItems(s?.rows, c?.rows, isUSMarketOpen());
      if (items.length <= 2) {
        items.push(`<span class="ticker-pulse-text"><span class="ticker-pulse-dot"></span>Scanning for momentum…</span>`);
      }
      const onePass = items.join("");

      // Repeat content enough times to fill wide screens (min 3x)
      const viewW = window.innerWidth || 1920;
      track.innerHTML = onePass;
      const contentW = track.scrollWidth || viewW;
      const repeats = Math.max(3, Math.ceil((viewW * 2.5) / contentW));
      track.innerHTML = onePass.repeat(repeats);

      ticker.style.display = "";
      requestAnimationFrame(() => {
        // Calculate one pass width and set scroll distance
        const onePassEl = document.createElement("div");
        onePassEl.style.cssText = "display:inline-flex;visibility:hidden;position:absolute";
        onePassEl.innerHTML = onePass;
        track.parentNode.appendChild(onePassEl);
        const onePassW = onePassEl.scrollWidth;
        onePassEl.remove();

        // Set the scroll distance to exactly one pass
        track.style.setProperty("--ticker-scroll", `-${onePassW}px`);
        // Speed: ~45px/sec
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
    // Re-trigger the tableIn animation by briefly removing and re-adding it
    const wrap = document.querySelector(".table-wrap");
    if (wrap) {
      wrap.style.animation = "none";
      wrap.offsetHeight; // force reflow
      wrap.style.animation = "";
    }
  });
})();


// 4. YESTERDAY'S TOP MOVERS (always visible, respects Stocks/Crypto toggle)
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

  // Remove toggle behavior — always open
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

      // Limit to 6 each
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













})();