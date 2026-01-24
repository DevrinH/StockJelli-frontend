/* StockJelli app.js
   - Drawer menu
   - Alerts modal (3-step)
   - Stocks/Crypto toggle (tables + hero chart + header indices)
   - Polling + backend fetch
   - Filters Apply/Reset plumbing
*/

(() => {
  // ----------------------------
  // Helpers
  // ----------------------------
  const API_BASE = "https://api.stockjelli.com";

  async function apiGet(path) {
    const r = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`API ${path} -> ${r.status}`);
    return r.json();
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

  function setHeaderFromApi(header) {
    if (!header) return;
  
    const idxLeftLabel = document.getElementById("idxLeftLabel");
    const idxLeftValue = document.getElementById("idxLeftValue");
    const idxRightLabel = document.getElementById("idxRightLabel");
    const idxRightValue = document.getElementById("idxRightValue");
  
    // labels
    if (idxLeftLabel && header.left?.label) idxLeftLabel.textContent = header.left.label;
    if (idxRightLabel && header.right?.label) idxRightLabel.textContent = header.right.label;
  
    // values + up/down color
    if (idxLeftValue) {
      idxLeftValue.textContent = fmtPct(header.left?.pct);
      idxLeftValue.classList.remove("up", "down");
      const c = classUpDown(header.left?.pct);
      if (c) idxLeftValue.classList.add(c);
    }
  
    if (idxRightValue) {
      idxRightValue.textContent = fmtPct(header.right?.pct);
      idxRightValue.classList.remove("up", "down");
      const c = classUpDown(header.right?.pct);
      if (c) idxRightValue.classList.add(c);
    }
  
    // OPTIONAL: make crypto labels green (letters) regardless
    // (You asked: "crypto indice letters should be green")
    // This assumes you toggle idxWrap.classList.add("crypto") in applyMode for crypto.
    const idxWrap = document.querySelector(".market-indices");
    const isCrypto = idxWrap?.classList.contains("crypto");
  
    if (idxLeftLabel) {
      idxLeftLabel.classList.toggle("crypto-label", !!isCrypto);
    }
    if (idxRightLabel) {
      idxRightLabel.classList.toggle("crypto-label", !!isCrypto);
    }
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
  
  function classUpDown(n) {
    const v = Number(n);
    if (Number.isNaN(v)) return "";
    return v >= 0 ? "up" : "down";
  }

  function clamp(n, min, max) {
    const v = Number(n);
    if (Number.isNaN(v)) return min;
    return Math.min(max, Math.max(min, v));
  }

  function setSegmented(controlEl, value) {
    if (!controlEl) return;
    controlEl.querySelectorAll(".segmented-btn").forEach((btn) => {
      btn.classList.toggle("segmented-on", btn.dataset.value === value);
    });
  }

  function fmtMoneyShort(n) {
    if (!Number.isFinite(n)) return "—";
    const abs = Math.abs(n);
    if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (abs >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
    if (abs >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
    return `$${Math.round(n).toLocaleString()}`;
  }
  
  // sliderValue: 0..1000  ->  mcapMin: 2e8 .. 1e11
  function cryptoMcapFromSlider(sliderValue) {
    const t = clamp(sliderValue, 0, 1000) / 1000;      // 0..1
    const min = 2e8;                                    // 200M
    const max = 1e11;                                   // 100B
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const logVal = logMin + (logMax - logMin) * t;
    return Math.round(Math.pow(10, logVal));
  }
  

  // ----------------------------
  // Drawer Menu
  // ----------------------------
  const menuBtn = document.getElementById("menuBtn");
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("drawerOverlay");
  const drawerClose = document.getElementById("drawerClose");

  function openDrawer() {
    drawer?.classList.add("is-open");
    overlay?.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    drawer?.classList.remove("is-open");
    overlay?.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  menuBtn?.addEventListener("click", () => {
    if (!drawer) return;
    drawer.classList.contains("is-open") ? closeDrawer() : openDrawer();
  });

  drawerClose?.addEventListener("click", closeDrawer);
  overlay?.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  // ----------------------------
  // Alerts Modal (3-step)
  // ----------------------------
  (function initModal() {
    const modal = document.getElementById("alertsModal");
    const openBtn = document.getElementById("enableAlertsBtn");
    const closeBtn = document.getElementById("closeModalBtn");

    const toStep2Btn = document.getElementById("toStep2Btn");
    const backToStep1Btn = document.getElementById("backToStep1Btn");
    const toStep3Btn = document.getElementById("toStep3Btn");
    const backToStep2Btn = document.getElementById("backToStep2Btn");
    const finishBtn = document.getElementById("finishBtn");

    const presetControl = document.getElementById("presetControl");
    const sessionControl = document.getElementById("sessionControl");
    const presetHint = document.getElementById("presetHint");

    const summaryPreset = document.getElementById("summaryPreset");
    const summarySession = document.getElementById("summarySession");

    const stripeCheckoutBtn = document.getElementById("stripeCheckoutBtn");
    const googleSignInBtn = document.getElementById("googleSignInBtn");

    if (!modal || !openBtn) return;

    const state = {
      step: 1,
      preset: "balanced",
      session: "market",
    };

    const presetHints = {
      balanced: "Default: best signal-to-noise.",
      conservative: "Fewer alerts. Higher confidence setups.",
      aggressive: "More alerts. Lower threshold. More noise.",
    };

    const labelPreset = {
      balanced: "Balanced",
      conservative: "Conservative",
      aggressive: "Aggressive",
    };

    const labelSession = {
      market: "Market",
      premarket: "Pre-market",
      afterhours: "After-hours",
    };

    function openModal() {
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      setStep(1);
    }

    function closeModal() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function setStep(step) {
      state.step = step;

      document.querySelectorAll(".modal-step").forEach((el) => {
        const s = Number(el.getAttribute("data-step"));
        el.hidden = s !== step;
      });

      document.querySelectorAll(".step-dot").forEach((dot) => {
        const s = Number(dot.getAttribute("data-step"));
        dot.classList.toggle("step-active", s === step);
      });

      if (summaryPreset) summaryPreset.textContent = labelPreset[state.preset];
      if (summarySession) summarySession.textContent = labelSession[state.session];
      if (presetHint) presetHint.textContent = presetHints[state.preset];
    }

    function setSegmentedLocal(controlEl, value) {
      controlEl?.querySelectorAll(".segmented-btn").forEach((btn) => {
        btn.classList.toggle("segmented-on", btn.dataset.value === value);
      });
    }

    // open/close
    openBtn.addEventListener("click", openModal);
    closeBtn?.addEventListener("click", closeModal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
    });

    // steps
    toStep2Btn?.addEventListener("click", () => setStep(2));
    backToStep1Btn?.addEventListener("click", () => setStep(1));
    toStep3Btn?.addEventListener("click", () => setStep(3));
    backToStep2Btn?.addEventListener("click", () => setStep(2));
    finishBtn?.addEventListener("click", closeModal);

    // preset selection
    presetControl?.addEventListener("click", (e) => {
      const btn = e.target.closest(".segmented-btn");
      if (!btn) return;
      state.preset = btn.dataset.value;
      setSegmentedLocal(presetControl, state.preset);
      if (presetHint) presetHint.textContent = presetHints[state.preset];
      if (summaryPreset) summaryPreset.textContent = labelPreset[state.preset];
      localStorage.setItem("sj_preset", state.preset);
    });

    // session selection
    sessionControl?.addEventListener("click", (e) => {
      const btn = e.target.closest(".segmented-btn");
      if (!btn) return;
      state.session = btn.dataset.value;
      setSegmentedLocal(sessionControl, state.session);
      if (summarySession) summarySession.textContent = labelSession[state.session];
      localStorage.setItem("sj_session", state.session);
    });

    // load saved
    const savedPreset = localStorage.getItem("sj_preset");
    const savedSession = localStorage.getItem("sj_session");
    if (savedPreset && labelPreset[savedPreset]) {
      state.preset = savedPreset;
      setSegmentedLocal(presetControl, state.preset);
    }
    if (savedSession && labelSession[savedSession]) {
      state.session = savedSession;
      setSegmentedLocal(sessionControl, state.session);
    }

    googleSignInBtn?.addEventListener("click", () => {
      alert("Google Sign-In will be wired on the backend (OAuth).");
    });

    stripeCheckoutBtn?.addEventListener("click", () => {
      alert("Stripe Checkout will be wired next (create session + webhook).");
    });

    setStep(1);
  })();

  // ----------------------------
  // Renderers
  // ----------------------------
  function renderStocks(rows) {
    const tbody = document.getElementById("stocksTbody");
    if (!tbody) return;
  
    if (!rows || rows.length === 0) {
      tbody.innerHTML = `
        <tr><td class="ticker">—</td><td>$—</td><td>—</td><td>—</td><td class="news">—</td></tr>
      `;
      return;
    }
  
    tbody.innerHTML = rows
      .map((x) => {
        const pct = x.pctChange;
        const changeClass = classUpDown(pct);
  
        // news: backend returns news: [{title,source,url,publishedAt}]
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
      })
      .join("");
  }
  

  function renderCrypto(rows) {
    const tbody = document.getElementById("cryptoTbody");
    if (!tbody) return;
  
    if (!rows || rows.length === 0) {
      tbody.innerHTML = `
        <tr><td class="ticker">—</td><td>$—</td><td>—</td><td>—</td><td>—</td></tr>
      `;
      return;
    }
  
    tbody.innerHTML = rows
      .map((x) => {
        const pct = x.pctChange;        // ✅ new field
        const vol = x.volume;           // ✅ new field
        const mcap = x.marketCap;       // ✅ new field
  
        // use dynamic decimals for sub-$1 coins
        const priceDecimals = x.price !== null && x.price !== undefined && Number(x.price) < 1 ? 6 : 2;
  
        const changeClass = classUpDown(pct);
  
        return `
          <tr>
            <td class="ticker">${x.coinSymbol || "—"}</td>
            <td>${fmtUsd(x.price, priceDecimals)}</td>
            <td class="${changeClass}">${fmtPct(pct)}</td>
            <td>${fmtNum(vol)}</td>
            <td>${fmtCompactUsd(mcap, 1)}</td>
          </tr>
        `;
      })
      .join("");
  }
  

  // ----------------------------
  // Filters -> query params (Phase A plumbing)
  // ----------------------------
// ----------------------------
// Filters -> query params (D-1 real wiring)
// ----------------------------
const filterEls = {
  // NOTE: re-interpret mcapRange as "min" in billions
  mcapMinRange: document.getElementById("mcapRange"),
  mcapMinNum: document.getElementById("mcapNum"), // optional

  priceMaxRange: document.getElementById("priceRange"),
  volMinRange: document.getElementById("volRange"),

  newsRequiredChk: document.getElementById("newsRequiredChk"),

  applyBtn: document.getElementById("filtersApplyBtn"),
  resetBtn: document.getElementById("filtersResetBtn"),
};

const MODE_DEFAULTS = {
  stocks: {
    limit: 15,
    pctMin: 4,
    volMin: 10_000_000,
    mcapMin: 1_000_000_000,
    mcapMax: 500_000_000_000,
    priceMin: 2,
    priceMax: null,
    newsRequired: true,
  },
  crypto: {
    limit: 15,
    pctMin: 3,
    volMin: 100_000_000,
    mcapMin: 1_000_000_000,
    mcapMax: null,
    priceMin: null,
    priceMax: null,
    newsRequired: false,
  },
};

// --- Market cap min ---
let mcapMin = d.mcapMin;

if (mode === "crypto") {
  // mcapRange is a 0..1000 log dial
  const dial = filterEls.mcapMinRange ? Number(filterEls.mcapMinRange.value) : 0;
  mcapMin = cryptoMcapFromSlider(dial);
} else {
  // stocks: keep your existing behavior (billions slider -> dollars)
  const mcapMinB = filterEls.mcapMinRange ? Number(filterEls.mcapMinRange.value) : 1;
  mcapMin = Number.isFinite(mcapMinB) ? Math.round(mcapMinB * 1e9) : d.mcapMin;
}

function updateMcapDisplayForMode(mode) {
  if (!filterEls.mcapMinRange) return;

  if (mode === "crypto") {
    const dial = Number(filterEls.mcapMinRange.value);
    const dollars = cryptoMcapFromSlider(dial);

    // Show as "$200M+" style
    if (filterEls.mcapMinNum) filterEls.mcapMinNum.value = `${fmtMoneyShort(dollars)}+`;
    else {
      // if you don’t have mcapNum, you can update a label span instead
    }
  } else {
    // stocks: slider is billions
    const b = Number(filterEls.mcapMinRange.value);
    if (filterEls.mcapMinNum) filterEls.mcapMinNum.value = `$ ${b}B`;
  }
}
filterEls.mcapMinRange?.addEventListener("input", () => updateMcapDisplayForMode(currentMode));


function buildApiPath(mode) {
  const f = readFiltersForMode(mode);
  const p = new URLSearchParams();

  p.set("limit", String(Math.min(15, f.limit || 15)));
  p.set("pctMin", String(f.pctMin));
  p.set("volMin", String(f.volMin));
  p.set("mcapMin", String(f.mcapMin));

  if (f.mcapMax !== null && f.mcapMax !== undefined) p.set("mcapMax", String(f.mcapMax));
  if (f.priceMin !== null && f.priceMin !== undefined) p.set("priceMin", String(f.priceMin));
  if (f.priceMax !== null && f.priceMax !== undefined) p.set("priceMax", String(f.priceMax));

  // Only meaningful for stocks right now, but safe to send always
  p.set("newsRequired", f.newsRequired ? "true" : "false");

  return mode === "crypto"
    ? `/api/crypto?${p.toString()}`
    : `/api/stocks?${p.toString()}`;
}

// Optional sync for market cap number input
function syncMcapNumberFromRange() {
  if (!filterEls.mcapMinRange || !filterEls.mcapMinNum) return;
  filterEls.mcapMinNum.value = filterEls.mcapMinRange.value;
}

if (filterEls.mcapMinRange && filterEls.mcapMinNum) {
  filterEls.mcapMinRange.addEventListener("input", syncMcapNumberFromRange);
  filterEls.mcapMinNum.addEventListener("input", () => {
    const v = clamp(filterEls.mcapMinNum.value, 0, 500);
    filterEls.mcapMinNum.value = v;
    filterEls.mcapMinRange.value = v;
  });
  syncMcapNumberFromRange();
}



  // Optional sync for market cap number input
  function syncMcapNumberFromRange() {
    if (!filterEls.mcapRange || !filterEls.mcapNum) return;
    filterEls.mcapNum.value = filterEls.mcapRange.value;
  }

  if (filterEls.mcapRange && filterEls.mcapNum) {
    filterEls.mcapRange.addEventListener("input", syncMcapNumberFromRange);
    filterEls.mcapNum.addEventListener("input", () => {
      const v = clamp(filterEls.mcapNum.value, 1, 500);
      filterEls.mcapNum.value = v;
      filterEls.mcapRange.value = v;
    });
    syncMcapNumberFromRange();
  }

  // ----------------------------
  // Polling + mode switching
  // ----------------------------
  const assetControl = document.getElementById("assetControl");

  const stocksTable = document.getElementById("stocksTable");
  const cryptoTable = document.getElementById("cryptoTable");

  const heroChartStocks = document.getElementById("heroChartStocks");
  const heroChartCrypto = document.getElementById("heroChartCrypto");

  const idxWrap = document.querySelector(".market-indices");
  const idxLeftLabel = document.getElementById("idxLeftLabel");
  const idxRightLabel = document.getElementById("idxRightLabel");
  const idxLeftValue = document.getElementById("idxLeftValue");
  const idxRightValue = document.getElementById("idxRightValue");

  const DEFAULTS = {
    stocks: { newsRequired: true },
    crypto: { newsRequired: false },
  };

  let currentMode = "stocks";
  let pollTimer = null;

  async function loadStocksOnce() {
    const data = await apiGet(buildStocksPath());   // <-- uses your existing function
    setHeaderFromApi(data.header);
    renderStocks(data.rows);                        // <-- always rows array
  }
  
  async function loadCryptoOnce() {
    const data = await apiGet(buildCryptoPath());   // <-- uses your existing function
    setHeaderFromApi(data.header);
    renderCrypto(data.rows);                        // <-- always rows array
  }
  
  

  async function refreshOnce() {
    try {
      const path = buildApiPath(currentMode);
      const data = await apiGet(path);
  
      // header should always reflect the current mode’s endpoint
      updateHeaderIndicesFromApi(data);
  
      if (currentMode === "crypto") renderCrypto(data.rows);
      else renderStocks(data.rows);
    } catch (e) {
      console.error("refreshOnce failed", e);
    }
  }
  
  

  function startPollingForMode() {
    if (pollTimer) clearInterval(pollTimer);
    refreshOnce(); // immediate
    pollTimer = setInterval(refreshOnce, 60_000);
  }

  function applyMode(mode) {
    currentMode = mode;
    setSegmented(assetControl, mode);
    setUiDefaultsForMode(mode);
    startPollingForMode();


    // default checkbox behavior
    if (filterEls.newsRequiredChk) {
      filterEls.newsRequiredChk.checked = !!DEFAULTS[mode].newsRequired;
    }

    // tables
    if (stocksTable) stocksTable.style.display = mode === "stocks" ? "" : "none";
    if (cryptoTable) cryptoTable.style.display = mode === "crypto" ? "" : "none";

    // hero charts
    if (heroChartStocks) heroChartStocks.style.display = mode === "stocks" ? "" : "none";
    if (heroChartCrypto) heroChartCrypto.style.display = mode === "crypto" ? "" : "none";

    // header indices swap
    if (idxLeftLabel && idxRightLabel) {
      if (mode === "stocks") {
        idxLeftLabel.textContent = "NASDAQ";
        idxRightLabel.textContent = "S&P 500";
        if (idxLeftValue) idxLeftValue.textContent = "—";
        if (idxRightValue) idxRightValue.textContent = "—";
        idxWrap?.classList.remove("crypto");
      } else {
        idxLeftLabel.textContent = "BTC";
        idxRightLabel.textContent = "Total Crypto Market";
        if (idxLeftValue) idxLeftValue.textContent = "—";
        if (idxRightValue) idxRightValue.textContent = "—";
        idxWrap?.classList.add("crypto");
      }
      
    }

    localStorage.setItem("sj_asset_mode", mode);

    // poll correct endpoint
    startPollingForMode();
  }

  function setUiDefaultsForMode(mode) {
    const d = MODE_DEFAULTS[mode];
  
    // If you want hard switch every time, remove the "if (!...dataset.touched)" checks.
    if (filterEls.mcapMinRange && !filterEls.mcapMinRange.dataset.touched) {
      filterEls.mcapMinRange.value = Math.round(d.mcapMin / 1e9);
    }
    if (filterEls.priceMaxRange && !filterEls.priceMaxRange.dataset.touched) {
      filterEls.priceMaxRange.value = d.priceMax ?? 300;
    }
    if (filterEls.volMinRange && !filterEls.volMinRange.dataset.touched) {
      filterEls.volMinRange.value = d.volMin;
    }
    if (filterEls.newsRequiredChk) {
      filterEls.newsRequiredChk.checked = !!d.newsRequired;
    }
  
    // keep optional number input synced
    syncMcapNumberFromRange();
  }
  
  // mark touched if user changes sliders
  [filterEls.mcapMinRange, filterEls.priceMaxRange, filterEls.volMinRange].forEach((el) => {
    el?.addEventListener("input", () => (el.dataset.touched = "1"));
  });
  

  // toggle click
  assetControl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    applyMode(btn.dataset.value);
  });

  // init mode
  const savedMode = localStorage.getItem("sj_asset_mode");
  applyMode(savedMode === "crypto" ? "crypto" : "stocks");

  // ----------------------------
  // Apply / Reset buttons
  // ----------------------------
  filterEls.applyBtn?.addEventListener("click", () => {
    refreshOnce();
  });

  filterEls.resetBtn?.addEventListener("click", () => {
    // reset ranges (tune these however you want)
    if (filterEls.mcapRange) filterEls.mcapRange.value = 50;
    if (filterEls.mcapNum) filterEls.mcapNum.value = 50;
    if (filterEls.priceRange) filterEls.priceRange.value = 300;
    if (filterEls.volRange) filterEls.volRange.value = 1_000_000;

    // defaults depend on mode
    if (filterEls.newsRequiredChk) {
      filterEls.newsRequiredChk.checked = (currentMode === "stocks");
    }

    refreshOnce();
  });

})();
function formatPct(pct) {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return "—";
  const n = Number(pct);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function setIdxValue(el, pct) {
  if (!el) return;
  el.textContent = formatPct(pct);

  // reset classes
  el.classList.remove("up", "down", "flat");

  const n = Number(pct);
  if (!Number.isFinite(n)) return;

  if (n > 0) el.classList.add("up");
  else if (n < 0) el.classList.add("down");
  else el.classList.add("flat");
}

function updateHeaderIndicesFromApi(data) {
  // supports BOTH shapes:
  // - data.header.left.pct / data.header.right.pct
  // - compat aliases (btcPct / totalMarketPct), if present
  const leftPct =
    data?.header?.left?.pct ??
    data?.header?.btcPct ??
    data?.header?.leftPct ??
    null;

  const rightPct =
    data?.header?.right?.pct ??
    data?.header?.totalMarketPct ??
    data?.header?.rightPct ??
    null;

  setIdxValue(document.getElementById("idxLeftValue"), leftPct);
  setIdxValue(document.getElementById("idxRightValue"), rightPct);
}
