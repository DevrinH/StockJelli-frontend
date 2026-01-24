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

  // Volume pill input (no id in HTML)
  const volCard = filterEls.volRange?.closest(".filter-card");
  const volNum = volCard?.querySelector(".pill .num") || null;

  // ----------------------------
  // Renderers
  // ----------------------------
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

      let newsHtml = "—";
      if (Array.isArray(x.news) && x.news.length) {
        const item = x.news[0];
        if (item?.url) {
          newsHtml = `<a class="news-source" href="${item.url}" target="_blank" rel="noopener">${item.source || "News"}</a>`;
        } else {
          newsHtml = item?.source || "News";
        }
      }

      return `
        <tr>
          <td class="ticker">${x.symbol || "—"}</td>
          <td>${fmtUsd(x.price)}</td>
          <td class="${changeClass}">${fmtPct(pct)}</td>
          <td>${fmtNum(x.volume)}</td>
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

      return `
        <tr>
          <td class="ticker">${x.coinSymbol || "—"}</td>
          <td>${fmtUsd(x.price, priceDecimals)}</td>
          <td class="${changeClass}">${fmtPct(pct)}</td>
          <td>${fmtNum(x.volume)}</td>
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
  function setMcapUiForMode(mode) {
    if (!filterEls.mcapRange) return;

    if (mode === "crypto") {
      // dial: 0..1000
      if (filterEls.mcapLabel) filterEls.mcapLabel.textContent = "Market Cap (Min)";
      filterEls.mcapRange.min = "0";
      filterEls.mcapRange.max = "1000";
      filterEls.mcapRange.step = "1";

      filterEls.mcapPillStocks && (filterEls.mcapPillStocks.style.display = "none");
      filterEls.mcapPillCrypto && (filterEls.mcapPillCrypto.style.display = "");

      if (filterEls.mcapMetaRight) filterEls.mcapMetaRight.textContent = "$100B+";

      const dial = Number(filterEls.mcapRange.value || 0);
      lastCryptoMcapMin = cryptoMcapFromDial(dial); // <-- IMPORTANT: keep cache synced
      if (filterEls.mcapTextCrypto) {
        filterEls.mcapTextCrypto.textContent = `${fmtMoneyShort(lastCryptoMcapMin)}+`;
      }
      
    } else {
      // stocks: billions max
      if (filterEls.mcapLabel) filterEls.mcapLabel.textContent = "Market Cap (Max)";
      filterEls.mcapRange.min = "1";
      filterEls.mcapRange.max = "500";
      filterEls.mcapRange.step = "1";

      filterEls.mcapPillStocks && (filterEls.mcapPillStocks.style.display = "");
      filterEls.mcapPillCrypto && (filterEls.mcapPillCrypto.style.display = "none");

      if (filterEls.mcapMetaRight) filterEls.mcapMetaRight.textContent = "$0.3B";

      // sync to stocks pill
      if (filterEls.mcapNumStocks) filterEls.mcapNumStocks.value = String(filterEls.mcapRange.value);
    }
  }

  function setUiDefaultsForMode(mode) {
    const d = MODE_DEFAULTS[mode];

    if (filterEls.mcapRange && !filterEls.mcapRange.dataset.touched) {
      filterEls.mcapRange.value = mode === "crypto" ? String(d.mcapDial) : String(d.mcapMaxB);
    }
    if (filterEls.priceRange && !filterEls.priceRange.dataset.touched) {
      filterEls.priceRange.value = String(d.priceMax);
      if (priceNum) priceNum.value = String(d.priceMax);
    }
    if (filterEls.volRange && !filterEls.volRange.dataset.touched) {
      filterEls.volRange.value = String(d.volMin);
      if (volNum) volNum.value = String(d.volMin);
    }

    if (filterEls.newsRequiredChk) filterEls.newsRequiredChk.checked = !!d.newsRequired;

    setMcapUiForMode(mode);
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
  
      // Always recompute if null, otherwise reuse cached (for perfect UI/request consistency)
      if (!Number.isFinite(lastCryptoMcapMin)) {
        lastCryptoMcapMin = cryptoMcapFromDial(dial);
      }
  
      return { limit, pctMin, volMin, priceMax, mcapMin: lastCryptoMcapMin, newsRequired, dial };
    }
  
    // stocks
    const mcapMaxB = filterEls.mcapRange ? Number(filterEls.mcapRange.value) : d.mcapMaxB;
    const mcapMax = Math.round(clamp(mcapMaxB, 1, 500) * 1e9); // dollars
  
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
    filterEls.mcapRange.dataset.touched = "1";
  
    if (currentMode === "crypto") {
      const dial = Number(filterEls.mcapRange.value || 0);
      lastCryptoMcapMin = cryptoMcapFromDial(dial);
  
      if (filterEls.mcapTextCrypto) {
        filterEls.mcapTextCrypto.textContent = `${fmtMoneyShort(lastCryptoMcapMin)}+`;
      }
  
      console.log("[MCAP] dial=", dial, "mcapMin=", lastCryptoMcapMin);
    } else {
      // stocks: sync pill
      if (filterEls.mcapNumStocks) filterEls.mcapNumStocks.value = String(filterEls.mcapRange.value);
    }
  });
  

  // stocks-only: mcapNumStocks editable
  filterEls.mcapNumStocks?.addEventListener("input", () => {
    if (currentMode !== "stocks") return;
    if (!filterEls.mcapRange) return;
    const v = clamp(filterEls.mcapNumStocks.value, 1, 500);
    filterEls.mcapNumStocks.value = String(v);
    filterEls.mcapRange.value = String(v);
    filterEls.mcapRange.dataset.touched = "1";
  });

  // price sync (range <-> pill input)
  filterEls.priceRange?.addEventListener("input", () => {
    filterEls.priceRange.dataset.touched = "1";
    if (priceNum) priceNum.value = filterEls.priceRange.value;
  });
  priceNum?.addEventListener("input", () => {
    if (!filterEls.priceRange) return;
    const v = clamp(priceNum.value, Number(filterEls.priceRange.min || 1), Number(filterEls.priceRange.max || 5000));
    priceNum.value = String(v);
    filterEls.priceRange.value = String(v);
    filterEls.priceRange.dataset.touched = "1";
  });

  // volume sync
  filterEls.volRange?.addEventListener("input", () => {
    filterEls.volRange.dataset.touched = "1";
    if (volNum) volNum.value = filterEls.volRange.value;
  });
  volNum?.addEventListener("input", () => {
    if (!filterEls.volRange) return;
    const v = clamp(volNum.value, Number(filterEls.volRange.min || 0), Number(filterEls.volRange.max || 50_000_000));
    volNum.value = String(v);
    filterEls.volRange.value = String(v);
    filterEls.volRange.dataset.touched = "1";
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
    [filterEls.mcapRange, filterEls.priceRange, filterEls.volRange].forEach((el) => {
      if (el) delete el.dataset.touched;
    });
    setUiDefaultsForMode(currentMode);
    refreshOnce();
  });
})();
