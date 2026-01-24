/* StockJelli app.js (clean rebuild)
   - Drawer menu
   - Alerts modal (3-step)
   - Stocks/Crypto toggle (tables + hero chart + header indices)
   - Polling + backend fetch
   - Mode-aware filters (stocks vs crypto)
   - Apply/Reset that actually affects the API call
*/

(() => {
  // ---- prevent double-init if app.js is included twice ----
  if (window.__STOCKJELLI_APP_INIT__) return;
  window.__STOCKJELLI_APP_INIT__ = true;

  // ----------------------------
  // Config
  // ----------------------------
  const API_BASE = "https://api.stockjelli.com";
  const POLL_MS = 60_000;

  // You can tune these anytime
  const MODE_DEFAULTS = {
    stocks: {
      limit: 15,
      pctMin: 4,
      volMin: 1_000_000,         // UI slider is 0..50M, so keep it realistic here
      priceMax: 300,             // UI slider
      mcapMaxB: 50,              // UI in billions
      newsRequired: true,
    },
    crypto: {
      limit: 15,
      pctMin: 3,
      volMin: 1_000_000,
      priceMax: 300,
      mcapDial: 0,               // 0 => 200M, 1000 => 100B
      newsRequired: false,
    },
  };

  // crypto dial mapping: 0..1000 => 200M..100B (log)
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
    const t = clamp(dial0to1000, 0, 1000) / 1000; // 0..1
    const logMin = Math.log10(CRYPTO_MCAP_MIN);
    const logMax = Math.log10(CRYPTO_MCAP_MAX);
    const logVal = logMin + (logMax - logMin) * t;
    return Math.round(Math.pow(10, logVal));
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

  const filterEls = {
    mcapLabel: document.getElementById("mcapLabel"),
    mcapRange: document.getElementById("mcapRange"),
    mcapNum: document.getElementById("mcapNum"),
    mcapMetaRight: document.getElementById("mcapMetaRight"),

    priceRange: document.getElementById("priceRange"),
    volRange: document.getElementById("volRange"),
    newsRequiredChk: document.getElementById("newsRequiredChk"),

    applyBtn: document.getElementById("filtersApplyBtn"),
    resetBtn: document.getElementById("filtersResetBtn"),
  };

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
  // Alerts Modal (3-step) (unchanged logic, safe no-op if missing)
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

    const state = { step: 1, preset: "balanced", session: "market" };

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

    openBtn.addEventListener("click", openModal);
    closeBtn?.addEventListener("click", closeModal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
    });

    toStep2Btn?.addEventListener("click", () => setStep(2));
    backToStep1Btn?.addEventListener("click", () => setStep(1));
    toStep3Btn?.addEventListener("click", () => setStep(3));
    backToStep2Btn?.addEventListener("click", () => setStep(2));
    finishBtn?.addEventListener("click", closeModal);

    presetControl?.addEventListener("click", (e) => {
      const btn = e.target.closest(".segmented-btn");
      if (!btn) return;
      state.preset = btn.dataset.value;
      setSegmentedLocal(presetControl, state.preset);
      if (presetHint) presetHint.textContent = presetHints[state.preset];
      if (summaryPreset) summaryPreset.textContent = labelPreset[state.preset];
      localStorage.setItem("sj_preset", state.preset);
    });

    sessionControl?.addEventListener("click", (e) => {
      const btn = e.target.closest(".segmented-btn");
      if (!btn) return;
      state.session = btn.dataset.value;
      setSegmentedLocal(sessionControl, state.session);
      if (summarySession) summarySession.textContent = labelSession[state.session];
      localStorage.setItem("sj_session", state.session);
    });

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
      tbody.innerHTML = `<tr><td class="ticker">—</td><td>$—</td><td>—</td><td>—</td><td class="news">—</td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map((x) => {
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
      })
      .join("");
  }

  function renderCrypto(rows) {
    const tbody = document.getElementById("cryptoTbody");
    if (!tbody) return;

    if (!rows || rows.length === 0) {
      tbody.innerHTML = `<tr><td class="ticker">—</td><td>$—</td><td>—</td><td>—</td><td>—</td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map((x) => {
        const pct = x.pctChange;
        const vol = x.volume;
        const mcap = x.marketCap;

        const priceDecimals =
          x.price !== null && x.price !== undefined && Number(x.price) < 1 ? 6 : 2;

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
  // Header indices updater (supports multiple shapes)
  // ----------------------------
  function formatPct(pct) {
    if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return "—";
    const n = Number(pct);
    const sign = n > 0 ? "+" : "";
    return `${sign}${n.toFixed(2)}%`;
  }

  function setIdxValue(el, pct) {
    if (!el) return;
    el.textContent = formatPct(pct);
    el.classList.remove("up", "down", "flat");
    const n = Number(pct);
    if (!Number.isFinite(n)) return;
    if (n > 0) el.classList.add("up");
    else if (n < 0) el.classList.add("down");
    else el.classList.add("flat");
  }

  function applyHeaderFromApi(data) {
    // If backend provides labels, use them. Otherwise keep your placeholders.
    const leftLabel = data?.header?.left?.label;
    const rightLabel = data?.header?.right?.label;
    if (idxLeftLabel && leftLabel) idxLeftLabel.textContent = leftLabel;
    if (idxRightLabel && rightLabel) idxRightLabel.textContent = rightLabel;

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

    setIdxValue(idxLeftValue, leftPct);
    setIdxValue(idxRightValue, rightPct);

    // optional: green labels for crypto mode via CSS class
    const isCrypto = currentMode === "crypto";
    idxWrap?.classList.toggle("crypto", isCrypto);
  }

  // ----------------------------
  // Filters (mode-aware)
  // ----------------------------
  function setMcapUiForMode(mode) {
    if (!filterEls.mcapRange) return;

    if (mode === "crypto") {
      // Market Cap (Min) log dial
      if (filterEls.mcapLabel) filterEls.mcapLabel.textContent = "Market Cap (Min)";
      filterEls.mcapRange.min = "0";
      filterEls.mcapRange.max = "1000";
      filterEls.mcapRange.step = "1";

      // switch mcapNum to text display (because crypto is not linear)
      if (filterEls.mcapNum) {
        filterEls.mcapNum.type = "text";
        filterEls.mcapNum.readOnly = true;
        filterEls.mcapNum.inputMode = "none";
      }

      if (filterEls.mcapMetaRight) filterEls.mcapMetaRight.textContent = "$100B+";

      // set display immediately
      const dollars = cryptoMcapFromDial(Number(filterEls.mcapRange.value || 0));
      if (filterEls.mcapNum) filterEls.mcapNum.value = `${fmtMoneyShort(dollars)}+`;

    } else {
      // Stocks: Market Cap (Max) in billions (linear)
      if (filterEls.mcapLabel) filterEls.mcapLabel.textContent = "Market Cap (Max)";
      filterEls.mcapRange.min = "1";
      filterEls.mcapRange.max = "500";
      filterEls.mcapRange.step = "1";

      if (filterEls.mcapNum) {
        filterEls.mcapNum.type = "number";
        filterEls.mcapNum.readOnly = false;
        filterEls.mcapNum.inputMode = "decimal";
        filterEls.mcapNum.min = "1";
        filterEls.mcapNum.max = "500";
      }

      if (filterEls.mcapMetaRight) filterEls.mcapMetaRight.textContent = "$0.3B";

      // sync number UI
      if (filterEls.mcapNum) filterEls.mcapNum.value = String(filterEls.mcapRange.value);
    }
  }

  function setUiDefaultsForMode(mode) {
    const d = MODE_DEFAULTS[mode];

    // clear "touched" if you want defaults on mode switch:
    // (we keep touched behavior so user doesn't lose a custom slider unless they press Reset)
    // If you want HARD switch, delete the "if (!dataset.touched)" checks.

    if (filterEls.mcapRange && !filterEls.mcapRange.dataset.touched) {
      filterEls.mcapRange.value = mode === "crypto" ? String(d.mcapDial) : String(d.mcapMaxB);
    }
    if (filterEls.priceRange && !filterEls.priceRange.dataset.touched) {
      filterEls.priceRange.value = String(d.priceMax);
    }
    if (filterEls.volRange && !filterEls.volRange.dataset.touched) {
      filterEls.volRange.value = String(d.volMin);
    }
    if (filterEls.newsRequiredChk) {
      filterEls.newsRequiredChk.checked = !!d.newsRequired;
    }

    setMcapUiForMode(mode);
  }

  function readFiltersForMode(mode) {
    const d = MODE_DEFAULTS[mode];

    const limit = d.limit;

    const pctMin = d.pctMin; // you can make this a UI control later

    const volMin = filterEls.volRange ? Number(filterEls.volRange.value) : d.volMin;
    const priceMax = filterEls.priceRange ? Number(filterEls.priceRange.value) : d.priceMax;

    const newsRequired =
      filterEls.newsRequiredChk ? !!filterEls.newsRequiredChk.checked : d.newsRequired;

    if (mode === "crypto") {
      const dial = filterEls.mcapRange ? Number(filterEls.mcapRange.value) : d.mcapDial;
      const mcapMin = cryptoMcapFromDial(dial);

      return { limit, pctMin, volMin, priceMax, mcapMin, newsRequired };
    }

    // stocks mode
    const mcapMaxB = filterEls.mcapRange ? Number(filterEls.mcapRange.value) : d.mcapMaxB;
    const mcapMax = Math.round(mcapMaxB * 1e9);

    return { limit, pctMin, volMin, priceMax, mcapMax, newsRequired };
  }

  function buildApiPath(mode) {
    const f = readFiltersForMode(mode);
    const p = new URLSearchParams();

    p.set("limit", String(f.limit));
    p.set("pctMin", String(f.pctMin));
    p.set("volMin", String(f.volMin));
    p.set("priceMax", String(f.priceMax));

    // mode-specific mcap
    if (mode === "crypto") p.set("mcapMin", String(f.mcapMin));
    else p.set("mcapMax", String(f.mcapMax));

    // safe to always send
    p.set("newsRequired", f.newsRequired ? "true" : "false");

    const path = mode === "crypto" ? `/api/crypto?${p.toString()}` : `/api/stocks?${p.toString()}`;

    // debugging (helps you verify backend is receiving what you think)
    console.debug("[StockJelli] API path:", path);

    return path;
  }

  // wire slider UI updates
  filterEls.mcapRange?.addEventListener("input", () => {
    filterEls.mcapRange.dataset.touched = "1";

    if (currentMode === "crypto") {
      const dollars = cryptoMcapFromDial(Number(filterEls.mcapRange.value));
      if (filterEls.mcapNum) filterEls.mcapNum.value = `${fmtMoneyShort(dollars)}+`;
    } else {
      if (filterEls.mcapNum) filterEls.mcapNum.value = String(filterEls.mcapRange.value);
    }
  });

  // stocks-only: allow typing billions
  filterEls.mcapNum?.addEventListener("input", () => {
    if (currentMode !== "stocks") return;
    if (!filterEls.mcapRange) return;

    const v = clamp(filterEls.mcapNum.value, 1, 500);
    filterEls.mcapNum.value = String(v);
    filterEls.mcapRange.value = String(v);
    filterEls.mcapRange.dataset.touched = "1";
  });

  [filterEls.priceRange, filterEls.volRange].forEach((el) => {
    el?.addEventListener("input", () => (el.dataset.touched = "1"));
  });

  // ----------------------------
  // Mode switching + Polling
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

    // tables
    if (stocksTable) stocksTable.style.display = mode === "stocks" ? "" : "none";
    if (cryptoTable) cryptoTable.style.display = mode === "crypto" ? "" : "none";

    // hero charts
    if (heroChartStocks) heroChartStocks.style.display = mode === "stocks" ? "" : "none";
    if (heroChartCrypto) heroChartCrypto.style.display = mode === "crypto" ? "" : "none";

    // placeholder header labels (backend can overwrite via applyHeaderFromApi)
    if (mode === "stocks") {
      if (idxLeftLabel) idxLeftLabel.textContent = "NASDAQ";
      if (idxRightLabel) idxRightLabel.textContent = "S&P 500";
    } else {
      if (idxLeftLabel) idxLeftLabel.textContent = "BTC";
      if (idxRightLabel) idxRightLabel.textContent = "Total Crypto Market";
    }
    if (idxLeftValue) idxLeftValue.textContent = "—";
    if (idxRightValue) idxRightValue.textContent = "—";

    // filter defaults + UI
    setUiDefaultsForMode(mode);

    // persist + poll
    localStorage.setItem("sj_asset_mode", mode);
    startPolling();
  }

  // toggle click
  assetControl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    const mode = btn.dataset.value === "crypto" ? "crypto" : "stocks";
    applyMode(mode);
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
    // clear touched so defaults apply cleanly
    [filterEls.mcapRange, filterEls.priceRange, filterEls.volRange].forEach((el) => {
      if (el) delete el.dataset.touched;
    });

    // reset to mode defaults
    setUiDefaultsForMode(currentMode);
    refreshOnce();
  });
})();
