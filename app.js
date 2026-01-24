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
      mcapMaxB: 50,     // billions
      newsRequired: true,
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

  const CRYPTO_MCAP_MIN = 2e8;   // 200M
  const CRYPTO_MCAP_MAX = 1e11;  // 100B

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

  // Generate TradingView URL for a symbol
  function getTradingViewUrl(symbol, type = "stock") {
    // TradingView URL format
    if (type === "crypto") {
      // For crypto, use BINANCE or COINBASE prefix
      return `https://www.tradingview.com/chart/?symbol=BINANCE:${symbol}USDT`;
    }
    // For stocks, use default exchange detection
    return `https://www.tradingview.com/chart/?symbol=${symbol}`;
  }

  // Render ticker cell with TradingView hover tooltip
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
          <td class="ticker">${tickerHtml}</td>
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

  function renderCrypto(rows) {
    const tbody = document.getElementById("cryptoTbody");
    if (!tbody) return;

    if (!rows || rows.length === 0) {
      tbody.innerHTML = `<tr><td class="ticker">—</td><td>$—</td><td>—</td><td>—</td><td>—</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((x) => {
      const pct = x.pctChange;
      const changeClass = classUpDown(pct);

      const priceDecimals =
        x.price !== null && x.price !== undefined && Number(x.price) < 1 ? 6 : 2;
      
      // Range indicator using 24h low/high
      const rangeHtml = renderRangeIndicator(x.low24h ?? x.rangeLow, x.high24h ?? x.rangeHigh, x.price);
      
      // Ticker with TradingView link
      const tickerHtml = renderTickerCell(x.coinSymbol || "—", "crypto");

      return `
        <tr>
          <td class="ticker">${tickerHtml}</td>
          <td>${fmtUsd(x.price, priceDecimals)}</td>
          <td class="${changeClass}">
            <span class="change-wrap">
              <span class="change-pct">${fmtPct(pct)}</span>
              ${rangeHtml}
            </span>
          </td>
          <td>${fmtVolumeCompact(x.volume)}</td>
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
  }

  // ----------------------------
  // Filters (mode-aware, matches HTML)
  // ----------------------------
  
  // Track separate touched states and values for each mode
  const filterState = {
    stocks: {
      mcapTouched: false,
      mcapValue: MODE_DEFAULTS.stocks.mcapMaxB,
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

    if (mode === "crypto") {
      // dial: 0..1000 (logarithmic scale from $200M to $100B)
      if (filterEls.mcapLabel) filterEls.mcapLabel.textContent = "Market Cap (Min)";
      filterEls.mcapRange.min = "0";
      filterEls.mcapRange.max = "1000";
      filterEls.mcapRange.step = "1";

      // Show crypto pill, hide stocks pill
      if (filterEls.mcapPillStocks) filterEls.mcapPillStocks.style.display = "none";
      if (filterEls.mcapPillCrypto) filterEls.mcapPillCrypto.style.display = "";

      // Update meta labels for crypto
      if (filterEls.mcapMetaLeft) filterEls.mcapMetaLeft.textContent = "$200M";
      if (filterEls.mcapMetaRight) filterEls.mcapMetaRight.textContent = "$100B+";

      // Get the current dial value (either from state or slider)
      const dial = filterState.crypto.mcapTouched 
        ? filterState.crypto.mcapValue 
        : MODE_DEFAULTS.crypto.mcapDial;
      
      filterEls.mcapRange.value = String(dial);
      lastCryptoMcapMin = cryptoMcapFromDial(dial);
      
      if (filterEls.mcapTextCrypto) {
        filterEls.mcapTextCrypto.textContent = `${fmtMoneyShort(lastCryptoMcapMin)}+`;
      }
      
    } else {
      // stocks: 1-500 = billions max
      if (filterEls.mcapLabel) filterEls.mcapLabel.textContent = "Market Cap (Max)";
      filterEls.mcapRange.min = "1";
      filterEls.mcapRange.max = "500";
      filterEls.mcapRange.step = "1";

      // Show stocks pill, hide crypto pill
      if (filterEls.mcapPillStocks) filterEls.mcapPillStocks.style.display = "";
      if (filterEls.mcapPillCrypto) filterEls.mcapPillCrypto.style.display = "none";

      // Update meta labels for stocks (showing the range endpoints: 1B to 500B)
      if (filterEls.mcapMetaLeft) filterEls.mcapMetaLeft.textContent = "$1B";
      if (filterEls.mcapMetaRight) filterEls.mcapMetaRight.textContent = "$500B";

      // Get the current value (either from state or default)
      const mcapB = filterState.stocks.mcapTouched 
        ? filterState.stocks.mcapValue 
        : MODE_DEFAULTS.stocks.mcapMaxB;
      
      filterEls.mcapRange.value = String(mcapB);
      if (filterEls.mcapNumStocks) filterEls.mcapNumStocks.value = String(mcapB);
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
  
      // Always recompute from current dial value for consistency
      const mcapMin = cryptoMcapFromDial(dial);
      lastCryptoMcapMin = mcapMin;
  
      return { limit, pctMin, volMin, priceMax, mcapMin, newsRequired, dial };
    }
  
    // stocks
    const mcapMaxB = filterEls.mcapRange ? Number(filterEls.mcapRange.value) : d.mcapMaxB;
    const mcapMax = Math.round(clamp(mcapMaxB, 1, 500) * 1e9); // convert to dollars
  
    return { limit, pctMin, volMin, priceMax, mcapMax, newsRequired, mcapMaxB };
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
  
    if (mode === "crypto") {
      p.set("mcapMin", String(f.mcapMin));
    } else {
      p.set("mcapMax", String(f.mcapMax));
    }
  
    const path = mode === "crypto"
      ? `/api/crypto?${p.toString()}`
      : `/api/stocks?${p.toString()}`;
  
    console.log("[StockJelli] mode:", mode, "filters:", f, "path:", path);
    return path;
  }
  

  // ---- wire inputs / touch markers ----
  filterEls.mcapRange?.addEventListener("input", () => {
    const state = filterState[currentMode];
    
    if (currentMode === "crypto") {
      const dial = Number(filterEls.mcapRange.value || 0);
      state.mcapTouched = true;
      state.mcapValue = dial;
      lastCryptoMcapMin = cryptoMcapFromDial(dial);
  
      if (filterEls.mcapTextCrypto) {
        filterEls.mcapTextCrypto.textContent = `${fmtMoneyShort(lastCryptoMcapMin)}+`;
      }
  
      console.log("[MCAP] crypto dial=", dial, "mcapMin=", lastCryptoMcapMin);
    } else {
      // stocks: sync pill
      const mcapB = Number(filterEls.mcapRange.value || 50);
      state.mcapTouched = true;
      state.mcapValue = mcapB;
      if (filterEls.mcapNumStocks) filterEls.mcapNumStocks.value = String(mcapB);
      
      console.log("[MCAP] stocks mcapMaxB=", mcapB);
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
  // Legal modals (Privacy / Terms) - ADDED ONLY
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
})();

    // About / Contact
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
    contactForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      alert("Thanks! Your message is noted (placeholder). Wire /api/contact next.");
      closeModalSafe(contactModal);
      contactForm.reset();
    });
