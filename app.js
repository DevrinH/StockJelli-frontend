/* StockJelli app.js
   - Drawer menu
   - Alerts modal (3-step)
   - Stocks/Crypto toggle (tables + hero chart + header indices)
   - Polling + backend fetch
   - Filters Apply/Reset wiring (mode-aware)
*/

(() => {
  // ----------------------------
  // Config
  // ----------------------------
  const API_BASE = "https://api.stockjelli.com";
  const POLL_MS = 60_000;

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

  // Crypto Market Cap dial: 0..1000 => 200M .. 100B
  function cryptoMcapFromDial(dial) {
    const t = clamp(dial, 0, 1000) / 1000; // 0..1
    const min = 2e8;  // 200M
    const max = 1e11; // 100B
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const logVal = logMin + (logMax - logMin) * t;
    return Math.round(Math.pow(10, logVal));
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

    function setSegmentedLocal(controlEl, value) {
      controlEl?.querySelectorAll(".segmented-btn").forEach((btn) => {
        btn.classList.toggle("segmented-on", btn.dataset.value === value);
      });
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
  // DOM refs
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

  // Filters
  const filterEls = {
    mcapRange: document.getElementById("mcapRange"),
    mcapNumStocks: document.getElementById("mcapNumStocks"),
    mcapTextCrypto: document.getElementById("mcapTextCrypto"),
    mcapPillStocks: document.getElementById("mcapPillStocks"),
    mcapPillCrypto: document.getElementById("mcapPillCrypto"),
    mcapLabel: document.getElementById("mcapLabel"),
    mcapMetaRight: document.getElementById("mcapMetaRight"),

    priceRange: document.getElementById("priceRange"),
    volRange: document.getElementById("volRange"),
    newsRequiredChk: document.getElementById("newsRequiredChk"),

    applyBtn: document.getElementById("filtersApplyBtn"),
    resetBtn: document.getElementById("filtersResetBtn"),
  };

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
  // Header indices from API
  // ----------------------------
  function setIdxValue(el, pct) {
    if (!el) return;
    el.textContent = fmtPct(pct);
    el.classList.remove("up", "down");
    const c = classUpDown(pct);
    if (c) el.classList.add(c);
  }

  function updateHeaderIndicesFromApi(data) {
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
  }

  // ----------------------------
  // Mode defaults
  // ----------------------------
  const MODE_DEFAULTS = {
    stocks: {
      // UI defaults (feel free to tune)
      mcapMaxB: 50,         // billions
      priceMax: 300,
      volMin: 1_000_000,    // slider is generic, backend will interpret
      newsRequired: true,
    },
    crypto: {
      mcapDial: 400,        // 0..1000
      priceMax: 300,        // still shown; you can ignore server-side
      volMin: 1_000_000,
      newsRequired: false,
    },
  };

  let currentMode = "stocks";
  let pollTimer = null;

  // ----------------------------
  // Market cap UI (mode-aware)
  // ----------------------------
  function setMcapUiForMode(mode) {
    if (!filterEls.mcapRange) return;

    if (mode === "crypto") {
      filterEls.mcapLabel && (filterEls.mcapLabel.textContent = "Market Cap (Min)");
      filterEls.mcapRange.min = "0";
      filterEls.mcapRange.max = "1000";

      if (!filterEls.mcapRange.dataset.touched) {
        filterEls.mcapRange.value = String(MODE_DEFAULTS.crypto.mcapDial);
      }

      filterEls.mcapPillStocks && (filterEls.mcapPillStocks.style.display = "none");
      filterEls.mcapPillCrypto && (filterEls.mcapPillCrypto.style.display = "");

      const dollars = cryptoMcapFromDial(Number(filterEls.mcapRange.value));
      filterEls.mcapTextCrypto && (filterEls.mcapTextCrypto.textContent = `${fmtMoneyShort(dollars)}+`);
      filterEls.mcapMetaRight && (filterEls.mcapMetaRight.textContent = "$100B+");
    } else {
      filterEls.mcapLabel && (filterEls.mcapLabel.textContent = "Market Cap (Max)");
      filterEls.mcapRange.min = "1";
      filterEls.mcapRange.max = "500";

      if (!filterEls.mcapRange.dataset.touched) {
        filterEls.mcapRange.value = String(MODE_DEFAULTS.stocks.mcapMaxB);
      }

      filterEls.mcapPillStocks && (filterEls.mcapPillStocks.style.display = "");
      filterEls.mcapPillCrypto && (filterEls.mcapPillCrypto.style.display = "none");

      filterEls.mcapNumStocks && (filterEls.mcapNumStocks.value = filterEls.mcapRange.value);
      filterEls.mcapMetaRight && (filterEls.mcapMetaRight.textContent = "$0.3B");
    }
  }

  filterEls.mcapRange?.addEventListener("input", () => {
    filterEls.mcapRange.dataset.touched = "1";
    if (currentMode === "crypto") {
      const dollars = cryptoMcapFromDial(Number(filterEls.mcapRange.value));
      if (filterEls.mcapTextCrypto) filterEls.mcapTextCrypto.textContent = `${fmtMoneyShort(dollars)}+`;
    } else {
      if (filterEls.mcapNumStocks) filterEls.mcapNumStocks.value = filterEls.mcapRange.value;
    }
  });

  filterEls.mcapNumStocks?.addEventListener("input", () => {
    if (currentMode !== "stocks") return;
    const v = clamp(filterEls.mcapNumStocks.value, 1, 500);
    filterEls.mcapNumStocks.value = v;
    if (filterEls.mcapRange) filterEls.mcapRange.value = String(v);
    filterEls.mcapRange.dataset.touched = "1";
  });

  // ----------------------------
  // Build API path from filters
  // ----------------------------
  function buildApiPath(mode) {
    const p = new URLSearchParams();
    p.set("limit", "15");

    const volMin = Number(filterEls.volRange?.value ?? 0);
    const priceMax = Number(filterEls.priceRange?.value ?? 0);

    if (mode === "crypto") {
      // crypto: mcapMin from log dial
      const dial = Number(filterEls.mcapRange?.value ?? 0);
      const mcapMin = cryptoMcapFromDial(dial);

      p.set("mcapMin", String(mcapMin));
      if (Number.isFinite(volMin) && volMin > 0) p.set("volMin", String(volMin));
      if (Number.isFinite(priceMax) && priceMax > 0) p.set("priceMax", String(priceMax));

      // intentionally false by default for crypto
      p.set("newsRequired", filterEls.newsRequiredChk?.checked ? "true" : "false");

      return `/api/crypto?${p.toString()}`;
    }

    // stocks: mcapMax in billions -> dollars
    const mcapMaxB = Number(filterEls.mcapRange?.value ?? 50);
    const mcapMax = Math.round(mcapMaxB * 1e9);

    p.set("mcapMax", String(mcapMax));
    if (Number.isFinite(volMin) && volMin > 0) p.set("volMin", String(volMin));
    if (Number.isFinite(priceMax) && priceMax > 0) p.set("priceMax", String(priceMax));

    p.set("newsRequired", filterEls.newsRequiredChk?.checked ? "true" : "false");

    return `/api/stocks?${p.toString()}`;
  }

  // ----------------------------
  // Polling + refresh
  // ----------------------------
  async function refreshOnce() {
    try {
      const path = buildApiPath(currentMode);
      const data = await apiGet(path);

      updateHeaderIndicesFromApi(data);

      if (currentMode === "crypto") renderCrypto(data.rows);
      else renderStocks(data.rows);
    } catch (e) {
      console.error("refreshOnce failed", e);
    }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    refreshOnce(); // immediate
    pollTimer = setInterval(refreshOnce, POLL_MS);
  }

  // ----------------------------
  // Apply mode (toggle)
  // ----------------------------
  function applyMode(mode) {
    currentMode = mode;

    // segmented UI
    setSegmented(assetControl, mode);

    // tables
    if (stocksTable) stocksTable.style.display = mode === "stocks" ? "" : "none";
    if (cryptoTable) cryptoTable.style.display = mode === "crypto" ? "" : "none";

    // hero charts
    if (heroChartStocks) heroChartStocks.style.display = mode === "stocks" ? "" : "none";
    if (heroChartCrypto) heroChartCrypto.style.display = mode === "crypto" ? "" : "none";

    // header labels
    if (idxLeftLabel && idxRightLabel) {
      if (mode === "stocks") {
        idxLeftLabel.textContent = "NASDAQ";
        idxRightLabel.textContent = "S&P 500";
        idxWrap?.classList.remove("crypto");
      } else {
        idxLeftLabel.textContent = "BTC";
        idxRightLabel.textContent = "Total Crypto Market";
        idxWrap?.classList.add("crypto");
      }
      // clear values until API returns
      if (idxLeftValue) idxLeftValue.textContent = "—";
      if (idxRightValue) idxRightValue.textContent = "—";
      idxLeftValue?.classList.remove("up", "down");
      idxRightValue?.classList.remove("up", "down");
    }

    // filter defaults per mode (only if not touched)
    const d = MODE_DEFAULTS[mode];

    if (filterEls.volRange && !filterEls.volRange.dataset.touched) {
      filterEls.volRange.value = String(d.volMin);
    }
    if (filterEls.priceRange && !filterEls.priceRange.dataset.touched) {
      filterEls.priceRange.value = String(d.priceMax);
    }

    // News required default differs by mode (always set)
    if (filterEls.newsRequiredChk) {
      filterEls.newsRequiredChk.checked = !!d.newsRequired;
    }

    // Market cap UI swap
    setMcapUiForMode(mode);

    // persist + poll
    localStorage.setItem("sj_asset_mode", mode);
    startPolling();
  }

  // toggle click
  assetControl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    applyMode(btn.dataset.value === "crypto" ? "crypto" : "stocks");
  });

  // mark touched for sliders so mode switch doesn’t overwrite user input
  [filterEls.mcapRange, filterEls.priceRange, filterEls.volRange].forEach((el) => {
    el?.addEventListener("input", () => (el.dataset.touched = "1"));
  });

  // ----------------------------
  // Apply / Reset
  // ----------------------------
  filterEls.applyBtn?.addEventListener("click", () => {
    refreshOnce();
  });

  filterEls.resetBtn?.addEventListener("click", () => {
    // clear touched so defaults apply again
    [filterEls.mcapRange, filterEls.priceRange, filterEls.volRange].forEach((el) => {
      if (el) delete el.dataset.touched;
    });

    // reset mode-specific defaults
    if (filterEls.priceRange) filterEls.priceRange.value = String(MODE_DEFAULTS[currentMode].priceMax);
    if (filterEls.volRange) filterEls.volRange.value = String(MODE_DEFAULTS[currentMode].volMin);

    // reset news default per mode
    if (filterEls.newsRequiredChk) {
      filterEls.newsRequiredChk.checked = !!MODE_DEFAULTS[currentMode].newsRequired;
    }

    // reset market cap per mode
    if (currentMode === "crypto") {
      if (filterEls.mcapRange) filterEls.mcapRange.value = String(MODE_DEFAULTS.crypto.mcapDial);
    } else {
      if (filterEls.mcapRange) filterEls.mcapRange.value = String(MODE_DEFAULTS.stocks.mcapMaxB);
      if (filterEls.mcapNumStocks) filterEls.mcapNumStocks.value = String(MODE_DEFAULTS.stocks.mcapMaxB);
    }

    setMcapUiForMode(currentMode);
    refreshOnce();
  });

  // ----------------------------
  // Init
  // ----------------------------
  const savedMode = localStorage.getItem("sj_asset_mode");
  applyMode(savedMode === "crypto" ? "crypto" : "stocks");
})();
