// ============================================================
// StockJelli Frontend (app.js) — CLEAN SINGLE VERSION
// ============================================================

// ------------------------------------------------------------
// Alerts Modal (3-step)
// ------------------------------------------------------------
(function () {
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

    // toggle sections
    document.querySelectorAll(".modal-step").forEach((el) => {
      const s = Number(el.getAttribute("data-step"));
      el.hidden = s !== step;
    });

    // step dots
    document.querySelectorAll(".step-dot").forEach((dot) => {
      const s = Number(dot.getAttribute("data-step"));
      dot.classList.toggle("step-active", s === step);
    });

    // summaries
    if (summaryPreset) summaryPreset.textContent = labelPreset[state.preset];
    if (summarySession) summarySession.textContent = labelSession[state.session];
    if (presetHint) presetHint.textContent = presetHints[state.preset];
  }

  function setSegmented(controlEl, value) {
    if (!controlEl) return;
    controlEl.querySelectorAll(".segmented-btn").forEach((btn) => {
      btn.classList.toggle("segmented-on", btn.dataset.value === value);
    });
  }

  // Open/close handlers
  openBtn.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);

  // Close when clicking outside modal
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // ESC to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  // Step nav
  toStep2Btn?.addEventListener("click", () => setStep(2));
  backToStep1Btn?.addEventListener("click", () => setStep(1));
  toStep3Btn?.addEventListener("click", () => setStep(3));
  backToStep2Btn?.addEventListener("click", () => setStep(2));
  finishBtn?.addEventListener("click", closeModal);

  // Preset selection
  presetControl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    state.preset = btn.dataset.value;
    setSegmented(presetControl, state.preset);
    if (presetHint) presetHint.textContent = presetHints[state.preset];
    if (summaryPreset) summaryPreset.textContent = labelPreset[state.preset];
    localStorage.setItem("sj_preset", state.preset);
  });

  // Session selection
  sessionControl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    state.session = btn.dataset.value;
    setSegmented(sessionControl, state.session);
    if (summarySession) summarySession.textContent = labelSession[state.session];
    localStorage.setItem("sj_session", state.session);
  });

  // Load persisted prefs
  const savedPreset = localStorage.getItem("sj_preset");
  const savedSession = localStorage.getItem("sj_session");
  if (savedPreset && labelPreset[savedPreset]) {
    state.preset = savedPreset;
    setSegmented(presetControl, state.preset);
  }
  if (savedSession && labelSession[savedSession]) {
    state.session = savedSession;
    setSegmented(sessionControl, state.session);
  }

  // Placeholder buttons
  googleSignInBtn?.addEventListener("click", () => {
    alert("Google Sign-In will be wired on the DigitalOcean backend (OAuth).");
  });

  stripeCheckoutBtn?.addEventListener("click", () => {
    alert("Stripe Checkout will be wired next (create session + webhook).");
  });

  // initial sync
  setStep(1);
})();


// ------------------------------------------------------------
// Drawer menu
// ------------------------------------------------------------
(function () {
  const menuBtn = document.getElementById("menuBtn");
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("drawerOverlay");
  const drawerCloseBtn = document.getElementById("drawerClose");

  if (!menuBtn || !drawer || !overlay) return;

  function openDrawer() {
    drawer.classList.add("is-open");
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  menuBtn.addEventListener("click", () => {
    drawer.classList.contains("is-open") ? closeDrawer() : openDrawer();
  });

  drawerCloseBtn?.addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });
})();


// ------------------------------------------------------------
// API helpers
// ------------------------------------------------------------
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

function classUpDown(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return "";
  return v >= 0 ? "up" : "down";
}


// ------------------------------------------------------------
// Renderers
// ------------------------------------------------------------
function renderStocks(rows) {
  const tbody = document.getElementById("stocksTbody");
  if (!tbody) return;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `
      <tr><td class="ticker">—</td><td>$—</td><td>—</td><td>—</td><td class="news">—</td></tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((x) => {
    const changeClass = classUpDown(x.pct_change);
    const newsHtml = x.news_source_url
      ? `<a class="news-source" href="${x.news_source_url}" target="_blank" rel="noopener">${x.news_source || "Source"}</a>`
      : (x.news_source || "—");

    return `
      <tr>
        <td class="ticker">${x.ticker || "—"}</td>
        <td>${fmtUsd(x.price)}</td>
        <td class="${changeClass}">${fmtPct(x.pct_change)}</td>
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
    tbody.innerHTML = `
      <tr><td class="ticker">BTC</td><td>$—</td><td>—</td><td>—</td><td>—</td></tr>
      <tr><td class="ticker">ETH</td><td>$—</td><td>—</td><td>—</td><td>—</td></tr>
      <tr><td class="ticker">SOL</td><td>$—</td><td>—</td><td>—</td><td>—</td></tr>
      <tr><td class="ticker">XRP</td><td>$—</td><td>—</td><td>—</td><td>—</td></tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((x) => {
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
  }).join("");
}


// ------------------------------------------------------------
// Loaders
// ------------------------------------------------------------
async function loadStocksOnce() {
  const data = await apiGet("/api/v1/stocks/momentum");
  renderStocks(data.rows || data);
}

async function loadCryptoOnce() {
  const data = await apiGet("/api/v1/crypto/momentum");
  renderCrypto(data.rows || data);
}


// ------------------------------------------------------------
// Phase A: ONE Toggle + ONE Polling loop
// ------------------------------------------------------------
(function () {
  const assetControl = document.getElementById("assetControl");

  const stocksTableEl = document.getElementById("stocksTable");
  const cryptoTableEl = document.getElementById("cryptoTable");

  const heroStocksEl = document.getElementById("heroChartStocks");
  const heroCryptoEl = document.getElementById("heroChartCrypto");

  const idxWrapEl = document.querySelector(".market-indices");
  const idxLeftLabelEl = document.getElementById("idxLeftLabel");
  const idxLeftValueEl = document.getElementById("idxLeftValue");
  const idxRightLabelEl = document.getElementById("idxRightLabel");
  const idxRightValueEl = document.getElementById("idxRightValue");

  if (!assetControl) {
    // still load stocks once so page isn't blank
    loadStocksOnce().catch(console.error);
    return;
  }

  let pollTimer = null;
  let mode = "stocks"; // "stocks" | "crypto"

  function setSegmentedUI(value) {
    assetControl.querySelectorAll(".segmented-btn").forEach((btn) => {
      btn.classList.toggle("segmented-on", btn.dataset.value === value);
    });
  }

  function setCryptoHeaderStyle(isCrypto) {
    // Add class on wrapper; CSS can color it green
    idxWrapEl?.classList.toggle("crypto", isCrypto);

    // Also make both values "up" class so they appear green even without wrapper CSS
    if (isCrypto) {
      idxLeftValueEl?.classList.remove("down");
      idxRightValueEl?.classList.remove("down");
      idxLeftValueEl?.classList.add("up");
      idxRightValueEl?.classList.add("up");
    }
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async function refreshOnce() {
    try {
      if (mode === "crypto") await loadCryptoOnce();
      else await loadStocksOnce();
    } catch (e) {
      console.error(e);
    }
  }

  function startPolling() {
    stopPolling();
    refreshOnce();
    pollTimer = setInterval(refreshOnce, 60_000);
  }

  function applyMode(nextMode) {
    mode = nextMode;

    // tables
    if (stocksTableEl) stocksTableEl.style.display = mode === "stocks" ? "" : "none";
    if (cryptoTableEl) cryptoTableEl.style.display = mode === "crypto" ? "" : "none";

    // hero charts
    if (heroStocksEl) heroStocksEl.style.display = mode === "stocks" ? "" : "none";
    if (heroCryptoEl) heroCryptoEl.style.display = mode === "crypto" ? "" : "none";

    // indices labels + placeholder values (Phase B later: real values)
    if (mode === "stocks") {
      if (idxLeftLabelEl) idxLeftLabelEl.textContent = "NASDAQ";
      if (idxRightLabelEl) idxRightLabelEl.textContent = "S&P 500";
      if (idxLeftValueEl) idxLeftValueEl.textContent = "+1.24%";
      if (idxRightValueEl) idxRightValueEl.textContent = "-0.31%";
      idxWrapEl?.classList.remove("crypto");
    } else {
      if (idxLeftLabelEl) idxLeftLabelEl.textContent = "BTC";
      if (idxRightLabelEl) idxRightLabelEl.textContent = "Total Crypto Market";
      if (idxLeftValueEl) idxLeftValueEl.textContent = "+—%";
      if (idxRightValueEl) idxRightValueEl.textContent = "+—%";
      idxWrapEl?.classList.add("crypto");
    }

    setCryptoHeaderStyle(mode === "crypto");

    // segmented UI + persistence
    setSegmentedUI(mode);
    localStorage.setItem("sj_asset_mode", mode);

    // polling
    startPolling();
  }

  // init
  const saved = localStorage.getItem("sj_asset_mode");
  applyMode(saved === "crypto" ? "crypto" : "stocks");

  // click handler
  assetControl.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    applyMode(btn.dataset.value);
  });
})();
