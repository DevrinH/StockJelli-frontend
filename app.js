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
  
    if (idxLeftLabel && header.left?.label) idxLeftLabel.textContent = header.left.label;
    if (idxRightLabel && header.right?.label) idxRightLabel.textContent = header.right.label;
  
    if (idxLeftValue) {
      idxLeftValue.textContent = fmtPct(header.left?.pct);
      idxLeftValue.classList.remove("up", "down");
      idxLeftValue.classList.add(classUpDown(header.left?.pct));
    }
  
    if (idxRightValue) {
      idxRightValue.textContent = fmtPct(header.right?.pct);
      idxRightValue.classList.remove("up", "down");
      idxRightValue.classList.add(classUpDown(header.right?.pct));
    }
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
        const changeClass = classUpDown(x.pct_change);
        const newsHtml = x.news_source_url
          ? `<a class="news-source" href="${x.news_source_url}" target="_blank" rel="noopener">${x.news_source || "Source"}</a>`
          : x.news_source || "—";

        return `
          <tr>
            <td class="ticker">${x.ticker || "—"}</td>
            <td>${fmtUsd(x.price)}</td>
            <td class="${changeClass}">${fmtPct(x.pct_change)}</td>
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
        const changeClass = classUpDown(x.pct_change_24h);
        return `
          <tr>
            <td class="ticker">${x.symbol || x.coin || "—"}</td>
            <td>${fmtUsd(x.price)}</td>
            <td class="${changeClass}">${fmtPct(x.pct_change_24h)}</td>
            <td>${fmtNum(x.volume_24h)}</td>
            <td>${fmtUsd(x.market_cap, 0)}</td>
          </tr>
        `;
      })
      .join("");
  }

  // ----------------------------
  // Filters -> query params (Phase A plumbing)
  // ----------------------------
  const filterEls = {
    mcapRange: document.getElementById("mcapRange"),
    mcapNum: document.getElementById("mcapNum"), // optional, if you add it
    priceRange: document.getElementById("priceRange"),
    volRange: document.getElementById("volRange"),
    newsRequiredChk: document.getElementById("newsRequiredChk"),

    applyBtn: document.getElementById("filtersApplyBtn"),
    resetBtn: document.getElementById("filtersResetBtn"),
  };

  function readFilters() {
    const mcapMaxB = filterEls.mcapRange ? clamp(filterEls.mcapRange.value, 1, 500) : 50;
    const priceMax = filterEls.priceRange ? clamp(filterEls.priceRange.value, 1, 5000) : 300;
    const volMin = filterEls.volRange ? clamp(filterEls.volRange.value, 0, 50_000_000) : 1_000_000;
    const newsRequired = filterEls.newsRequiredChk ? !!filterEls.newsRequiredChk.checked : true;

    return { mcapMaxB, priceMax, volMin, newsRequired };
  }

  function buildStocksPath() {
    const f = readFilters();
    const params = new URLSearchParams();
    params.set("mcap_max_b", String(f.mcapMaxB));
    params.set("price_max", String(f.priceMax));
    params.set("vol_min", String(f.volMin));
    params.set("news_required", f.newsRequired ? "1" : "0");
    return `/api/v1/stocks/momentum?${params.toString()}`;
  }

  function buildCryptoPath() {
    const f = readFilters();
    const params = new URLSearchParams();
    params.set("price_max", String(f.priceMax));
    params.set("vol_min", String(f.volMin));
    return `/api/v1/crypto/momentum?${params.toString()}`;
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
      if (currentMode === "stocks") await loadStocksOnce();
      else await loadCryptoOnce();
    } catch (e) {
      console.error(e);
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
