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

    const stocksTable = document.getElementById("stocksTable");
    const cryptoTable = document.getElementById("cryptoTable");

  
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
      summaryPreset.textContent = labelPreset[state.preset];
      summarySession.textContent = labelSession[state.session];
      presetHint.textContent = presetHints[state.preset];
    }
  
    function setSegmented(controlEl, value) {
      controlEl.querySelectorAll(".segmented-btn").forEach((btn) => {
        btn.classList.toggle("segmented-on", btn.dataset.value === value);
      });
    }
  
    // Open/close handlers
    openBtn.addEventListener("click", openModal);
    closeBtn.addEventListener("click", closeModal);
  
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
      presetHint.textContent = presetHints[state.preset];
      summaryPreset.textContent = labelPreset[state.preset];
      // persist light prefs (placeholder)
      localStorage.setItem("sj_preset", state.preset);
    });
  
    // Session selection
    sessionControl?.addEventListener("click", (e) => {
      const btn = e.target.closest(".segmented-btn");
      if (!btn) return;
      state.session = btn.dataset.value;
      setSegmented(sessionControl, state.session);
      summarySession.textContent = labelSession[state.session];
      localStorage.setItem("sj_session", state.session);
    });
  
    // Load persisted prefs (placeholder)
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
  
  ////////

  const menuBtn = document.getElementById("menuBtn");
const drawer = document.getElementById("drawer");
const overlay = document.getElementById("drawerOverlay");
const closeBtn = document.getElementById("drawerClose");

function openDrawer(){
  drawer.classList.add("is-open");
  overlay.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closeDrawer(){
  drawer.classList.remove("is-open");
  overlay.classList.remove("is-open");
  document.body.style.overflow = "";
}

menuBtn.addEventListener("click", () => {
  drawer.classList.contains("is-open") ? closeDrawer() : openDrawer();
});

closeBtn.addEventListener("click", closeDrawer);
overlay.addEventListener("click", closeDrawer);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});


// === StockJelli API ===
const API_BASE = "https://api.stockjelli.com"; // backend lives here now

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


async function loadStocksOnce() {
  // TEMP: We will create this endpoint in the backend in Phase A-Backend step
  const data = await apiGet("/api/v1/stocks/momentum");
  renderStocks(data.rows || data);
}

async function loadCryptoOnce() {
  // TEMP: We will create this endpoint in the backend in Phase A-Backend step
  const data = await apiGet("/api/v1/crypto/momentum");
  renderCrypto(data.rows || data);
}

function startPolling(loadFn, ms = 60_000) {
  loadFn().catch(console.error);
  return setInterval(() => loadFn().catch(console.error), ms);
}



// ─────────────────────────────────────────────
// Asset mode: Stocks vs Crypto (Screener toggle)
// ─────────────────────────────────────────────
(function () {
  const assetControl = document.getElementById("assetControl");
  const newsRequiredChk = document.getElementById("newsRequiredChk");

  const idxWrap = document.querySelector(".market-indices");
  const idxLeftLabel = document.getElementById("idxLeftLabel");
  const idxRightLabel = document.getElementById("idxRightLabel");
  const idxLeftValue = document.getElementById("idxLeftValue");
  const idxRightValue = document.getElementById("idxRightValue");

  const heroChartStocks = document.getElementById("heroChartStocks");
  const heroChartCrypto = document.getElementById("heroChartCrypto");

  if (!assetControl || !newsRequiredChk) return;

  const DEFAULTS = {
    stocks: { newsRequired: true },
    crypto: { newsRequired: false }
  };

  function setSegmented(controlEl, value) {
    controlEl.querySelectorAll(".segmented-btn").forEach((btn) => {
      btn.classList.toggle("segmented-on", btn.dataset.value === value);
    });
  }

  function applyMode(mode) {
    setSegmented(assetControl, mode);

    // Catalyst default behavior
    newsRequiredChk.checked = !!DEFAULTS[mode].newsRequired;

    if (stocksTable && cryptoTable) {
      stocksTable.style.display = mode === "stocks" ? "" : "none";
      cryptoTable.style.display = mode === "crypto" ? "" : "none";
    }    

    // Header indices swap
    if (idxLeftLabel && idxRightLabel) {
      if (mode === "stocks") {
        idxLeftLabel.textContent = "NASDAQ";
        idxRightLabel.textContent = "S&P 500";

        // Keep whatever demo values you want
        // (Later we’ll update these from backend)
        idxLeftValue && (idxLeftValue.textContent = "+1.24%");
        idxRightValue && (idxRightValue.textContent = "-0.31%");

        idxWrap?.classList.remove("crypto");
      } else {
        idxLeftLabel.textContent = "BTC";
        idxRightLabel.textContent = "Total Crypto Market";

        // Demo values (swap later to real)
        idxLeftValue && (idxLeftValue.textContent = "+2.41%");
        idxRightValue && (idxRightValue.textContent = "+0.88%");

        // Make both green
        idxWrap?.classList.add("crypto");
      }
    }

    // Hero chart swap
    if (heroChartStocks && heroChartCrypto) {
      heroChartStocks.style.display = mode === "stocks" ? "" : "none";
      heroChartCrypto.style.display = mode === "crypto" ? "" : "none";
    }

    localStorage.setItem("sj_asset_mode", mode);

    // Later: refreshScreener(mode);
  }

  // init
  const saved = localStorage.getItem("sj_asset_mode");
  const mode = saved === "crypto" ? "crypto" : "stocks";
  applyMode(mode);

  // clicks
  assetControl.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    applyMode(btn.dataset.value);
  });
})();

let stocksTimer = null;
let cryptoTimer = null;

function showStocksMode() {
  document.getElementById("stocksTable")?.style && (document.getElementById("stocksTable").style.display = "");
  document.getElementById("cryptoTable")?.style && (document.getElementById("cryptoTable").style.display = "none");

  // stop crypto polling
  if (cryptoTimer) clearInterval(cryptoTimer);

  // start stocks polling
  stocksTimer = startPolling(loadStocksOnce, 60_000);
}

function showCryptoMode() {
  document.getElementById("stocksTable")?.style && (document.getElementById("stocksTable").style.display = "none");
  document.getElementById("cryptoTable")?.style && (document.getElementById("cryptoTable").style.display = "");

  // stop stocks polling
  if (stocksTimer) clearInterval(stocksTimer);

  // start crypto polling
  cryptoTimer = startPolling(loadCryptoOnce, 60_000);
}

// TODO: wire these to your actual toggle buttons/segmented control.
// For now, default to Stocks.
showStocksMode();

// ------------------------------
// Phase A: Toggle (Stocks / Crypto)
// ------------------------------
const assetControl = document.getElementById("assetControl");

const stocksTable = document.getElementById("stocksTable");
const cryptoTable = document.getElementById("cryptoTable");

const heroStocks = document.getElementById("heroChartStocks");
const heroCrypto = document.getElementById("heroChartCrypto");

// Header indices
const idxLeftLabel = document.getElementById("idxLeftLabel");
const idxLeftValue = document.getElementById("idxLeftValue");
const idxRightLabel = document.getElementById("idxRightLabel");
const idxRightValue = document.getElementById("idxRightValue");

function setSegmented(controlEl, value) {
  if (!controlEl) return;
  controlEl.querySelectorAll(".segmented-btn").forEach((btn) => {
    btn.classList.toggle("segmented-on", btn.dataset.value === value);
  });
}

// Optional: persist choice
function getSavedAsset() {
  return localStorage.getItem("sj_asset") || "stocks";
}
function saveAsset(v) {
  localStorage.setItem("sj_asset", v);
}

// CSS helper: make crypto values green
function setCryptoIndexStyle(isCrypto) {
  // For crypto: both values green
  if (isCrypto) {
    idxLeftValue?.classList.remove("down");
    idxRightValue?.classList.remove("down");
    idxLeftValue?.classList.add("up");
    idxRightValue?.classList.add("up");
  }
  // For stocks: leave as-is (you can later wire real values)
}

function applyAssetMode(mode) {
  currentMode = mode; // uses your Phase A variable

  const isCrypto = mode === "crypto";

  // Tables
  if (stocksTable) stocksTable.style.display = isCrypto ? "none" : "";
  if (cryptoTable) cryptoTable.style.display = isCrypto ? "" : "none";

  // Hero charts
  if (heroStocks) heroStocks.style.display = isCrypto ? "none" : "";
  if (heroCrypto) heroCrypto.style.display = isCrypto ? "" : "none";

  // Header indices labels
  if (idxLeftLabel) idxLeftLabel.textContent = isCrypto ? "BTC" : "NASDAQ";
  if (idxRightLabel) idxRightLabel.textContent = isCrypto ? "Total Crypto Market" : "S&P 500";

  // Header indices values (placeholder values for now)
  // Later Phase B: you’ll fetch actual BTC change / total mkt change
  if (idxLeftValue) idxLeftValue.textContent = isCrypto ? "+—%" : "+1.24%";
  if (idxRightValue) idxRightValue.textContent = isCrypto ? "+—%" : "-0.31%";

  setCryptoIndexStyle(isCrypto);

  // Kick an immediate refresh for the newly selected mode
  refreshActive();
}

if (assetControl) {
  assetControl.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    const v = btn.dataset.value; // "stocks" or "crypto"
    setSegmented(assetControl, v);
    saveAsset(v);
    applyAssetMode(v);
  });

  // Init from saved
  const initial = getSavedAsset();
  setSegmented(assetControl, initial);
  applyAssetMode(initial);
}
