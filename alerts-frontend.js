/**
 * StockJelli Checkout Modal + Alert Performance — Frontend JavaScript
 * ====================================================================
 * 
 * April 2026 Launch — Multi-plan checkout flow + live alert display
 * 
 * UPDATED: Frequency options expanded to 1–8/day + Unlimited (stored as 99)
 * 
 * FEATURES:
 *   - Multi-step checkout (Plan → Configure → Review → Stripe)
 *   - Today's alert cards below screener (respects stocks/crypto toggle)
 *   - Stats bar above alerts (win rate, duds, avg peak)
 *   - Screener row highlights for alerted tickers
 *   - Link to full alert log page (/alert-log.html)
 *   - Real credentials fetch after Stripe redirect
 */

(() => {
  if (window.__STOCKJELLI_ALERTS_INIT__) return;
  window.__STOCKJELLI_ALERTS_INIT__ = true;

  const API_BASE = "https://api.stockjelli.com";

  const PLANS = {
    push:    { name: "Push Notifications", icon: "🔔", price: 5,  badge: "POPULAR",    badgeClass: "plan-badge-accent" },
    webhook: { name: "Webhook API",        icon: "⚡", price: 50, badge: "DEVELOPER",  badgeClass: "plan-badge-warn" },
    bundle:  { name: "Push + API Bundle",  icon: "🚀", price: 52, badge: "BEST VALUE", badgeClass: "plan-badge-green" },
  };

  const ASSET_LABELS = { stocks: "📈 Stocks", crypto: "🪙 Crypto", both: "⚡ Stocks + Crypto" };
  const ASSET_HINTS = { stocks: "US equities — signals during market hours (9:30 AM–4 PM ET)", crypto: "Top crypto by market cap — 24/7 signals", both: "Stocks during market hours + crypto 24/7" };
  const REGION_INFO = { americas: { label: "🌎 Americas", hint: "Alerts timed for US market hours (ET)" }, global: { label: "🌍 Global", hint: "Crypto-only alerts at convenient UTC times" } };

  // ═══════════════════════════════════════════════════════════════════
  // UPDATED: Frequency hints expanded to 1–8 + Unlimited (99)
  // ═══════════════════════════════════════════════════════════════════
  const FREQ_HINTS_AMERICAS = {
    1:  "First hour momentum alert (10:00 AM ET)",
    2:  "Morning + midday (10:00 AM, 12:30 PM ET)",
    3:  "Morning + midday + power hour (10:00, 12:30, 3:30 PM ET)",
    4:  "All core windows + evening crypto (10:00, 12:30, 3:30, 8:00 PM ET)",
    5:  "Adds opening momentum (9:15, 10:00, 12:30, 3:30, 8:00 PM ET)",
    6:  "Adds late morning (9:15, 10:00, 11:00, 12:30, 3:30, 8:00 PM ET)",
    7:  "Adds early afternoon (9:15, 10:00, 11:00, 12:30, 2:00, 3:30, 8:00 PM ET)",
    8:  "All windows including after-hours (9:15, 10:00, 11:00, 12:30, 2:00, 3:30, 5:00, 8:00 PM ET)",
    99: "Unlimited — every alert window, every signal",
  };

  const FREQ_HINTS_GLOBAL = {
    1:  "Morning crypto alert (8:00 AM UTC)",
    2:  "Morning + afternoon crypto (8:00 AM, 2:00 PM UTC)",
    3:  "All day crypto (8:00 AM, 2:00 PM, 8:00 PM UTC)",
    4:  "Adds early morning (4:00 AM, 8:00 AM, 2:00 PM, 8:00 PM UTC)",
    5:  "Adds late morning (4:00, 8:00, 11:00 AM, 2:00, 8:00 PM UTC)",
    6:  "Adds evening (4:00, 8:00, 11:00 AM, 2:00, 5:00, 8:00 PM UTC)",
    7:  "Adds late evening (4:00, 8:00, 11:00 AM, 2:00, 5:00, 8:00, 11:00 PM UTC)",
    8:  "All 8 windows across the day",
    99: "Unlimited — every alert window, every signal",
  };

  // Max frequency per region (updated from 4/3 to 8/8)
  const MAX_FREQ_AMERICAS = 8;
  const MAX_FREQ_GLOBAL = 8;

  let currentStep = 1, selectedPlan = null, selectedAssets = "both", selectedRegion = "americas", selectedFrequency = 1, userEmail = "", webhookUrl = "", autoExecValue = "";
  const acks = { ack1: false, ack2: false, ack3: false, ack4: false, ack5: false };

  const modal = document.getElementById("alertsModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const stepsEl = document.getElementById("checkoutSteps");
  const stepDots = modal?.querySelectorAll(".step-dot");
  const modalSteps = modal?.querySelectorAll(".modal-step");
  const planCards = modal?.querySelectorAll(".plan-card");
  const step1NextBtn = document.getElementById("step1NextBtn");
  const step1Hint = document.getElementById("step1Hint");
  const emailInput = document.getElementById("alertEmail");
  const emailError = document.getElementById("emailError");
  const assetTypeControl = document.getElementById("assetTypeControl");
  const assetTypeHint = document.getElementById("assetTypeHint");
  const regionControl = document.getElementById("regionControl");
  const regionHint = document.getElementById("regionHint");
  const frequencySection = document.getElementById("frequencySection");
  const frequencyControl = document.getElementById("frequencyControl");
  const frequencyHint = document.getElementById("frequencyHint");
  const webhookUrlSection = document.getElementById("webhookUrlSection");
  const webhookUrlInput = document.getElementById("webhookUrlInput");
  const webhookConsentCard = document.getElementById("webhookConsentCard");
  const consentItems = modal?.querySelectorAll(".consent-item");
  const autoExecGroup = document.getElementById("autoExecGroup");
  const autoTradeNotice = document.getElementById("autoTradeNotice");
  const step2BackBtn = document.getElementById("step2BackBtn");
  const step2NextBtn = document.getElementById("step2NextBtn");
  const step2Hint = document.getElementById("step2Hint");
  const configTitle = document.getElementById("configTitle");
  const step3BackBtn = document.getElementById("step3BackBtn");
  const stripeCheckoutBtn = document.getElementById("stripeCheckoutBtn");
  const closeSuccessBtn = document.getElementById("closeSuccessBtn");

  function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  function hasPush() { return selectedPlan === "push" || selectedPlan === "bundle"; }
  function hasWebhook() { return selectedPlan === "webhook" || selectedPlan === "bundle"; }
  function setSegmented(c, v) { if (!c) return; c.querySelectorAll(".segmented-btn").forEach(b => b.classList.toggle("segmented-on", b.dataset.value === v)); }

  // ═══════════════════════════════════════════════════════════════════
  // HELPER: Format frequency for display
  // ═══════════════════════════════════════════════════════════════════
  function fmtFreq(f) {
    if (f === 99 || f === "99") return "Unlimited";
    return `${f}/day`;
  }

  function showStep(step) {
    currentStep = step;
    if (stepDots) stepDots.forEach(d => { const s = Number(d.dataset.step); d.classList.remove("step-active", "step-complete"); if (s === step) d.classList.add("step-active"); else if (s < step) d.classList.add("step-complete"); });
    if (modalSteps) modalSteps.forEach(s => { s.hidden = s.dataset.step !== String(step); });
    const t = document.getElementById("checkoutTitle"), s = document.getElementById("checkoutSubtitle");
    if (t && s) { if (step === 1) { t.textContent = "Choose Your Plan"; s.textContent = "Momentum intelligence, delivered how you want it."; } else if (step === 2) { t.textContent = `Configure Your ${PLANS[selectedPlan]?.name || "Plan"}`; s.textContent = "Customize how you receive momentum data."; } else if (step === 3) { t.textContent = "Review Your Order"; s.textContent = "Confirm your settings before checkout."; } }
    if (stepsEl) stepsEl.classList.remove("hidden");
  }

  async function showSuccess() {
    if (modalSteps) modalSteps.forEach(s => { s.hidden = s.dataset.step !== "success"; });
    if (stepsEl) stepsEl.classList.add("hidden");
    const t = document.getElementById("checkoutTitle"), s = document.getElementById("checkoutSubtitle");
    if (t) t.textContent = ""; if (s) s.textContent = "";
    const apiKeyBlock = document.getElementById("successApiKeyBlock"), consentLogBlock = document.getElementById("successConsentLog"), successTitle = document.getElementById("successTitle"), successSubtitle = document.getElementById("successSubtitle");
    const savedEmail = userEmail || localStorage.getItem("sj_checkout_email") || "", savedPlan = selectedPlan || localStorage.getItem("sj_checkout_plan") || "push";
    if (savedEmail && (savedPlan === "webhook" || savedPlan === "bundle")) {
      try { const r = await fetch(`${API_BASE}/api/alerts/credentials?email=${encodeURIComponent(savedEmail)}`); const d = await r.json(); if (d.found && d.webhookSecret) { if (apiKeyBlock) { apiKeyBlock.style.display = ""; document.getElementById("successApiKey").textContent = d.webhookSecret; } if (consentLogBlock) { consentLogBlock.style.display = ""; document.getElementById("consentLogContent").innerHTML = `<span>timestamp:</span> ${new Date().toISOString()}<br><span>key:</span> ${d.webhookSecret.substring(0, 14)}...<br><span>tos_version:</span> 2026-04-19`; } if (successTitle) successTitle.textContent = "You're All Set!"; if (successSubtitle) successSubtitle.textContent = savedPlan === "bundle" ? "Push notifications + webhook API are both active." : "Your webhook API is live."; } else { showPushOnly(successTitle, successSubtitle, apiKeyBlock, consentLogBlock); } } catch (e) { showPushOnly(successTitle, successSubtitle, apiKeyBlock, consentLogBlock); }
    } else { showPushOnly(successTitle, successSubtitle, apiKeyBlock, consentLogBlock); }
    if (window.StockJelliPush?.isSupported?.() && savedEmail) window.StockJelliPush.subscribe(savedEmail).catch(() => {});
    localStorage.removeItem("sj_checkout_email"); localStorage.removeItem("sj_checkout_plan");
  }
  function showPushOnly(t, s, a, c) { if (a) a.style.display = "none"; if (c) c.style.display = "none"; if (t) t.textContent = "You're Subscribed!"; if (s) s.textContent = "Check your inbox for a welcome email. Your first alert arrives at the next scheduled time."; }

  document.getElementById("checkoutLoginBtn")?.addEventListener("click", () => { closeModal(); const am = document.getElementById("accountModal"); if (am) { am.classList.add("is-open"); am.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; } });

  function openModal() { if (!modal) return; modal.classList.add("is-open"); modal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; const p = new URLSearchParams(window.location.search); if (p.get("alerts") === "success") { showSuccess(); window.history.replaceState({}, "", window.location.pathname); } else showStep(1); }
  function closeModal() { if (!modal) return; modal.classList.remove("is-open"); modal.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; }

  // Step 1
  if (planCards) planCards.forEach(card => { card.addEventListener("click", () => { selectedPlan = card.dataset.plan; planCards.forEach(c => c.classList.toggle("plan-selected", c.dataset.plan === selectedPlan)); if (step1NextBtn) step1NextBtn.disabled = false; if (step1Hint) { step1Hint.textContent = `${PLANS[selectedPlan].name} — $${PLANS[selectedPlan].price}/mo`; step1Hint.style.color = "var(--green, #34d399)"; } }); });
  step1NextBtn?.addEventListener("click", () => { if (!selectedPlan) return; configureStep2(); showStep(2); emailInput?.focus(); });

  // Step 2
  function configureStep2() { if (frequencySection) frequencySection.style.display = hasPush() ? "" : "none"; if (webhookUrlSection) webhookUrlSection.style.display = hasWebhook() ? "" : "none"; if (webhookConsentCard) webhookConsentCard.style.display = hasWebhook() ? "" : "none"; if (consentItems) consentItems.forEach(i => i.classList.remove("checked")); Object.keys(acks).forEach(k => acks[k] = false); autoExecValue = ""; if (autoExecGroup) autoExecGroup.querySelectorAll("input").forEach(r => r.checked = false); if (autoTradeNotice) autoTradeNotice.classList.remove("visible"); if (configTitle) configTitle.textContent = `Configure Your ${PLANS[selectedPlan]?.name || "Plan"}`; applyFreqConstraints(); validateStep2(); }
  assetTypeControl?.addEventListener("click", e => { const b = e.target.closest(".segmented-btn"); if (!b) return; selectedAssets = b.dataset.value; setSegmented(assetTypeControl, selectedAssets); if (assetTypeHint) assetTypeHint.textContent = ASSET_HINTS[selectedAssets] || ""; });

  // ═══════════════════════════════════════════════════════════════════
  // UPDATED: Region change — no longer caps frequency at 3 for global
  // ═══════════════════════════════════════════════════════════════════
  regionControl?.addEventListener("click", e => {
    const b = e.target.closest(".segmented-btn");
    if (!b) return;
    selectedRegion = b.dataset.value;
    setSegmented(regionControl, selectedRegion);
    if (regionHint) regionHint.textContent = REGION_INFO[selectedRegion]?.hint || "";
    applyFreqConstraints();
    updateFreqHint();
  });

  frequencyControl?.addEventListener("click", e => { const b = e.target.closest(".segmented-btn"); if (!b || b.style.pointerEvents === "none") return; selectedFrequency = Number(b.dataset.value); setSegmented(frequencyControl, String(selectedFrequency)); updateFreqHint(); });

  // ═══════════════════════════════════════════════════════════════════
  // UPDATED: Apply frequency constraints based on region
  // Both regions now support 1–8 + unlimited. No buttons disabled.
  // ═══════════════════════════════════════════════════════════════════
  function applyFreqConstraints() {
    const maxFreq = selectedRegion === "global" ? MAX_FREQ_GLOBAL : MAX_FREQ_AMERICAS;
    if (frequencyControl) {
      frequencyControl.querySelectorAll(".segmented-btn").forEach(b => {
        const v = Number(b.dataset.value);
        // Only disable if value exceeds max (and isn't the unlimited option)
        const disabled = v !== 99 && v > maxFreq;
        b.style.opacity = disabled ? "0.35" : "";
        b.style.pointerEvents = disabled ? "none" : "";
      });
    }
    // If current selection exceeds max, clamp it
    if (selectedFrequency !== 99 && selectedFrequency > maxFreq) {
      selectedFrequency = maxFreq;
      setSegmented(frequencyControl, String(selectedFrequency));
    }
  }

  function updateFreqHint() {
    if (!frequencyHint) return;
    frequencyHint.textContent = (selectedRegion === "americas" ? FREQ_HINTS_AMERICAS : FREQ_HINTS_GLOBAL)[selectedFrequency] || "";
  }

  if (consentItems) consentItems.forEach(item => { item.addEventListener("click", e => { if (e.target.tagName === "A") return; const k = item.dataset.ack; if (!k) return; acks[k] = !acks[k]; item.classList.toggle("checked", acks[k]); validateStep2(); }); });
  if (autoExecGroup) autoExecGroup.querySelectorAll("input[name='auto_exec']").forEach(r => { r.addEventListener("change", () => { autoExecValue = r.value; if (autoTradeNotice) autoTradeNotice.classList.toggle("visible", autoExecValue === "yes" || autoExecValue === "exploring"); validateStep2(); }); });
  emailInput?.addEventListener("input", () => { if (emailError) emailError.style.display = "none"; validateStep2(); });
  function validateStep2() { const ok = emailInput && isValidEmail(emailInput.value.trim()); let wh = true; if (hasWebhook()) wh = Object.values(acks).every(Boolean) && !!autoExecValue; const ready = ok && wh; if (step2NextBtn) step2NextBtn.disabled = !ready; if (step2Hint) { if (!ok && emailInput?.value.trim()) { step2Hint.style.display = ""; step2Hint.textContent = "Enter a valid email"; step2Hint.style.color = "#f87171"; } else if (hasWebhook() && !wh) { step2Hint.style.display = ""; step2Hint.textContent = "Complete all acknowledgments"; step2Hint.style.color = "#f59e0b"; } else if (ready) { step2Hint.style.display = ""; step2Hint.textContent = "Ready"; step2Hint.style.color = "#34d399"; } else step2Hint.style.display = "none"; } }
  step2BackBtn?.addEventListener("click", () => showStep(1));
  step2NextBtn?.addEventListener("click", async () => { const e = emailInput?.value?.trim(); if (!e || !isValidEmail(e)) { if (emailError) emailError.style.display = "block"; emailInput?.focus(); return; } userEmail = e; webhookUrl = webhookUrlInput?.value?.trim() || ""; try { const r = await fetch(`${API_BASE}/api/alerts/status?email=${encodeURIComponent(e)}`); if (r.ok) { const d = await r.json(); if (d.subscribed) { alert("You're already subscribed!"); closeModal(); return; } } } catch {} populateReview(); showStep(3); });

  // ═══════════════════════════════════════════════════════════════════
  // Step 3 — UPDATED: Use fmtFreq() for frequency display
  // ═══════════════════════════════════════════════════════════════════
  function populateReview() {
    const p = PLANS[selectedPlan];
    if (!p) return;
    const el = id => document.getElementById(id);
    if (el("reviewPlanIcon")) el("reviewPlanIcon").textContent = p.icon;
    if (el("reviewPlanName")) el("reviewPlanName").textContent = p.name;
    const b = el("reviewPlanBadge");
    if (b) { b.textContent = p.badge; b.className = `plan-badge ${p.badgeClass}`; }
    if (el("reviewPlanPrice")) el("reviewPlanPrice").textContent = `$${p.price}`;
    if (el("summaryEmail")) el("summaryEmail").textContent = userEmail;
    if (el("summaryAssets")) el("summaryAssets").textContent = ASSET_LABELS[selectedAssets] || "—";
    if (el("summaryRegion")) el("summaryRegion").textContent = REGION_INFO[selectedRegion]?.label || "—";
    const fr = el("summaryFreqRow");
    if (fr) fr.style.display = hasPush() ? "" : "none";
    if (el("summaryFrequency")) {
      // UPDATED: Use fmtFreq helper, no more global cap at 3
      el("summaryFrequency").textContent = fmtFreq(selectedFrequency);
    }
    const wr = el("summaryWebhookRow"), ar = el("summaryAutoExecRow");
    if (wr) wr.style.display = hasWebhook() ? "" : "none";
    if (ar) ar.style.display = hasWebhook() ? "" : "none";
    if (el("summaryWebhook")) el("summaryWebhook").textContent = webhookUrl || "(later)";
    if (el("summaryAutoExec")) el("summaryAutoExec").textContent = autoExecValue || "—";
  }

  step3BackBtn?.addEventListener("click", () => showStep(2));

  // ═══════════════════════════════════════════════════════════════════
  // Stripe checkout — UPDATED: Send raw frequency value (1–8 or 99)
  // ═══════════════════════════════════════════════════════════════════
  stripeCheckoutBtn?.addEventListener("click", async () => {
    if (!userEmail || !selectedPlan) { showStep(1); return; }
    localStorage.setItem("sj_checkout_email", userEmail);
    localStorage.setItem("sj_checkout_plan", selectedPlan);
    stripeCheckoutBtn.disabled = true;
    stripeCheckoutBtn.textContent = "Redirecting to Stripe...";
    try {
      // UPDATED: Send selectedFrequency directly (no more global cap at 3)
      const r = await fetch(`${API_BASE}/api/alerts/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          plan: selectedPlan,
          assetTypes: selectedAssets,
          region: selectedRegion,
          alertFrequency: hasPush() ? selectedFrequency : 0,
          webhookUrl: hasWebhook() ? webhookUrl : undefined,
          tosVersion: "2026-04-19",
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      const { url } = await r.json();
      if (url) window.location.href = url;
      else throw new Error("No URL");
    } catch (err) {
      alert("Checkout failed. Please try again.");
      stripeCheckoutBtn.disabled = false;
      stripeCheckoutBtn.textContent = "Subscribe with Stripe →";
    }
  });

  // Triggers
  ["enableAlertsBtn", "inlineAlertBtn", "noClutterBtn"].forEach(id => document.getElementById(id)?.addEventListener("click", e => { e.preventDefault(); openModal(); }));
  closeModalBtn?.addEventListener("click", closeModal); closeSuccessBtn?.addEventListener("click", closeModal);
  modal?.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && modal?.classList.contains("is-open")) closeModal(); });
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("alerts") === "success") setTimeout(() => { openModal(); showSuccess(); window.history.replaceState({}, "", window.location.pathname); }, 300);
  else if (urlParams.get("alerts") === "cancelled") window.history.replaceState({}, "", window.location.pathname);
  setSegmented(assetTypeControl, "both"); setSegmented(regionControl, "americas"); setSegmented(frequencyControl, "1");

  // ═══════════════════════════════════════════════════════════════════════════
  // TODAY'S ALERTS — Notification Log Cards below screener
  // ═══════════════════════════════════════════════════════════════════════════

  let alertLogData = null;
  let alertedSymbolsToday = new Set();
  window.__sjAlertedSymbols = alertedSymbolsToday;

  async function fetchAlertLog() {
    try {
      const res = await fetch(`${API_BASE}/api/notification-log?limit=200`);
      if (!res.ok) return;
      alertLogData = await res.json();
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      alertedSymbolsToday.clear();
      for (const a of (alertLogData.notifications || [])) { if (a.date === today) alertedSymbolsToday.add(a.symbol); }
      window.__sjAlertedSymbols = alertedSymbolsToday;
      renderTodayAlerts();
      highlightAlertedRows();
    } catch (e) { console.warn("[alert-log] Fetch failed:", e.message); }
  }

  (function initFeaturedAlert() {
    const API_BASE = "https://api.stockjelli.com";
  
    function getCurrentMode() {
      return document.querySelector("#assetControl .segmented-on")?.dataset?.value || "stocks";
    }
  
    async function renderFeaturedAlert() {
      const wrap = document.getElementById("featuredAlertWrap");
      const el = document.getElementById("featuredAlert");
      if (!wrap || !el) return;
  
      try {
        const res = await fetch(`${API_BASE}/api/notification-log?limit=50`);
        if (!res.ok) return;
        const data = await res.json();
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
        const mode = getCurrentMode();
  
        let todayAlerts = (data.notifications || []).filter(a => a.date === today);
        if (mode === "stocks") todayAlerts = todayAlerts.filter(a => a.mode === "stocks");
        else if (mode === "crypto") todayAlerts = todayAlerts.filter(a => a.mode === "crypto");
  
        if (todayAlerts.length === 0) { wrap.style.display = "none"; return; }
  
        const withPeak = todayAlerts.filter(a => a.peakAfterPush != null);
        let best;
        if (withPeak.length > 0) {
          best = withPeak.reduce((a, b) => (b.peakAfterPush || 0) > (a.peakAfterPush || 0) ? b : a);
        } else {
          best = todayAlerts[0];
        }
  
        const peak = best.peakAfterPush;
        const isWin = peak != null && peak >= 3;
        const isDud = peak != null && peak < 3;
        const peakStr = peak != null ? `+${peak.toFixed(1)}%` : "tracking...";
        const peakColor = isWin ? "#4ade80" : isDud && peak >= 0 ? "#fbbf24" : isDud ? "#ef4444" : "rgba(255,255,255,0.4)";
        const resultIcon = peak == null ? "⏳" : isWin ? "✅" : "❌";
        const modeIcon = best.mode === "crypto" ? "🪙" : "📈";
        const tvUrl = best.mode === "crypto" ? `https://www.tradingview.com/chart/?symbol=BINANCE:${best.symbol}USDT&aff_id=162729` : `https://www.tradingview.com/chart/?symbol=${best.symbol}&aff_id=162729`;
        const priceAtPush = best.priceAtPush != null ? `$${best.priceAtPush.toFixed(2)}` : "$—";
        const peakPriceStr = best.peakAfterPushPrice ? `$${best.peakAfterPushPrice.toFixed(2)}` : "";
        const time = new Date(best.pushTimestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
        const tierLabel = best.tier === 2 ? "T2" : "";
        const ch = (best.channel || "CH1") + (tierLabel ? " " + tierLabel : "");
        const sj = best.sjScore || "—";
        const sjColor = sj >= 75 ? "#4ade80" : sj >= 60 ? "#e2e8f0" : "#64748b";
  
        const wP = todayAlerts.filter(a => a.peakAfterPush != null);
        const w3 = wP.filter(a => a.peakAfterPush >= 3).length;
        const wr = wP.length > 0 ? Math.round(w3 / wP.length * 100) : 0;
        const statsStr = wP.length > 0 ? `${w3}/${wP.length} hit +3% (${wr}%)` : `${todayAlerts.length} alert${todayAlerts.length !== 1 ? "s" : ""} today`;
  
        el.className = `featured-alert${isDud ? " featured-dud" : ""}`;
        el.innerHTML = `
          <div class="featured-alert-header-row">
            <span></span>
            <span>TICKER</span>
            <span>ALERT → PEAK</span>
            <span>MAX GAIN</span>
            <span>SCORE</span>
            <span>RESULT</span>
          </div>
          <div class="featured-alert-data-row">
            <span class="featured-alert-badge featured-alert-badge-live"><span class="featured-alert-badge-dot"></span>BEST</span>
            <a href="${tvUrl}" target="_blank" rel="noopener" class="featured-alert-ticker">${modeIcon} ${best.symbol}</a>
            <span class="featured-alert-prices">${priceAtPush}${peakPriceStr ? " → <span style='color:" + peakColor + "'>" + peakPriceStr + "</span>" : ""}</span>
            <span class="featured-alert-gain" style="color:${peakColor}">${peakStr}</span>
            <span class="featured-alert-score" style="color:${sjColor}">${sj}</span>
            <span class="featured-alert-result">${resultIcon}</span>
          </div>
          <div class="featured-alert-footer">
            <span class="featured-alert-meta">${ch} · ${time}</span>
            <a href="/alert-log.html" class="featured-alert-link">${statsStr} →</a>
          </div>
        `;
  
        wrap.style.display = "";
      } catch (e) {
        console.warn("[featured-alert] Error:", e.message);
      }
    }
  
    document.getElementById("assetControl")?.querySelectorAll(".segmented-btn").forEach(btn => {
      btn.addEventListener("click", () => setTimeout(renderFeaturedAlert, 100));
    });
  
    setTimeout(renderFeaturedAlert, 500);
    setInterval(renderFeaturedAlert, 60_000);
  })();

  function getCurrentAssetMode() {
    return document.querySelector("#assetControl .segmented-on")?.dataset?.value || "stocks";
  }

  function renderTodayAlerts() {
    const container = document.getElementById("alertCardsSection");
    if (!container || !alertLogData) return;

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const mode = getCurrentAssetMode();
    let todayAlerts = (alertLogData.notifications || []).filter(a => a.date === today);
    if (mode === "stocks") todayAlerts = todayAlerts.filter(a => a.mode === "stocks");
    else if (mode === "crypto") todayAlerts = todayAlerts.filter(a => a.mode === "crypto");

    const withPeak = todayAlerts.filter(a => a.peakAfterPush != null);
    const winners = withPeak.filter(a => a.peakAfterPush >= 3).length;
    const duds = withPeak.filter(a => a.peakAfterPush < 3).length;
    const neverRed = withPeak.filter(a => a.peakAfterPush >= 0).length;
    const avgPeak = withPeak.length > 0 ? Math.round(withPeak.reduce((s, a) => s + (a.peakAfterPush || 0), 0) / withPeak.length * 10) / 10 : 0;
    const winRate = withPeak.length > 0 ? Math.round((winners / withPeak.length) * 100) : 0;

    const statsEl = document.getElementById("alertCardsStats");
    const bodyEl = document.getElementById("alertCardsBody");
    const emptyEl = document.getElementById("alertCardsEmpty");

    const toggleEl = document.getElementById("alertCardsToggle");
    if (toggleEl) toggleEl.querySelectorAll(".segmented-btn").forEach(b => b.classList.toggle("segmented-on", b.dataset.value === mode));

    if (statsEl) {
      statsEl.innerHTML = todayAlerts.length === 0 ? "" : `
        <div class="alert-stat"><span class="alert-stat-val">${todayAlerts.length}</span><span class="alert-stat-lbl">Alerts</span></div>
        <div class="alert-stat"><span class="alert-stat-val" style="color:#22c55e">${winRate}%</span><span class="alert-stat-lbl">Hit +3%</span></div>
        <div class="alert-stat"><span class="alert-stat-val" style="color:#34d399">+${avgPeak}%</span><span class="alert-stat-lbl">Avg Peak</span></div>
        <div class="alert-stat"><span class="alert-stat-val" style="color:${duds === 0 ? '#22c55e' : '#ef4444'}">${duds}</span><span class="alert-stat-lbl">Duds</span></div>
        <div class="alert-stat"><span class="alert-stat-val" style="color:${neverRed === withPeak.length ? '#22c55e' : '#fbbf24'}">${neverRed}/${withPeak.length}</span><span class="alert-stat-lbl">Never Red</span></div>
      `;
    }

    if (bodyEl) {
      if (todayAlerts.length === 0) {
        bodyEl.innerHTML = "";
        if (emptyEl) { emptyEl.style.display = ""; emptyEl.textContent = `No ${mode} alerts today yet.`; }
      } else {
        if (emptyEl) emptyEl.style.display = "none";
        bodyEl.innerHTML = `
          <div class="alert-log-header-row">
            <span>TIME</span><span>TICKER</span><span>ALERT → PEAK</span><span>MAX GAIN</span><span>SCORE</span><span>RESULT</span>
          </div>
        ` + todayAlerts.map(a => {
          const pct = a.pctAtSignal || a.pct15m || a.pct30m || a.pct1h || 0;
          const peak = a.peakAfterPush != null ? Math.round(a.peakAfterPush * 10) / 10 : null;
          const isWin = peak != null && peak >= 3;
          const isDud = peak != null && peak < 3;
          const peakStr = peak != null ? `+${peak.toFixed(1)}%` : "—";
          const peakColor = isWin ? "#4ade80" : isDud && peak >= 0 ? "#fbbf24" : isDud ? "#ef4444" : "rgba(255,255,255,0.3)";
          const resultIcon = peak == null ? '<span style="color:rgba(255,255,255,0.15);font-size:0.7rem">⏳</span>' : isWin ? '<span style="background:rgba(34,197,94,0.15);padding:2px 5px;border-radius:4px">✅</span>' : '<span style="background:rgba(239,68,68,0.12);padding:2px 5px;border-radius:4px">❌</span>';
          const modeIcon = a.mode === "crypto" ? "🪙" : "📈";
          const time = new Date(a.pushTimestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
          const priceAtPush = a.priceAtPush != null ? `$${a.priceAtPush.toFixed(2)}` : "$—";
          const peakPriceStr = a.peakAfterPushPrice ? `$${a.peakAfterPushPrice.toFixed(2)}` : peakStr;
          const tvUrl = a.mode === "crypto" ? `https://www.tradingview.com/chart/?symbol=BINANCE:${a.symbol}USDT&aff_id=162729` : `https://www.tradingview.com/chart/?symbol=${a.symbol}&aff_id=162729`;
          const sj = a.sjScore || "—";
          const sjColor = sj >= 75 ? "#4ade80" : sj >= 60 ? "#e2e8f0" : "#64748b";

          return `
            <div class="alert-log-row">
              <span class="alert-log-time">${time}</span>
              <a href="${tvUrl}" target="_blank" rel="noopener" class="alert-log-ticker">${modeIcon} <strong>${a.symbol}</strong></a>
              <span class="alert-log-prices">${priceAtPush} → <span style="color:${peakColor}">${peakPriceStr}</span></span>
              <span class="alert-log-gain" style="color:${peakColor}">${peakStr}</span>
              <span class="alert-log-score" style="color:${sjColor}">${sj}</span>
              <span class="alert-log-result">${resultIcon}</span>
            </div>
          `;
        }).join("");
      }
    }

    const viewAllEl = document.getElementById("alertCardsViewAll");
    if (viewAllEl) {
      const total = (alertLogData.notifications || []).length;
      if (total > 0) { viewAllEl.style.display = ""; viewAllEl.innerHTML = `<a href="/alert-log.html" class="alert-view-all-link">Show all ${total} alerts →</a>`; }
      else viewAllEl.style.display = "none";
    }

    container.style.display = "";
  }

  function highlightAlertedRows() {
    if (!alertedSymbolsToday || alertedSymbolsToday.size === 0) return;
    document.querySelectorAll("#stocksTbody tr[data-symbol], #cryptoTbody tr[data-symbol]").forEach(tr => {
      const sym = tr.dataset.symbol;
      if (alertedSymbolsToday.has(sym)) {
        // Add pulsing class to the row
        if (!tr.classList.contains("sj-alerted")) {
          tr.classList.add("sj-alerted");
        }
        // Add ALERTED badge if not already there
        const tickerCell = tr.querySelector("td.ticker");
        if (tickerCell && !tickerCell.querySelector(".alerted-badge")) {
          const badge = document.createElement("span");
          badge.className = "alerted-badge";
          badge.innerHTML = "⚡ ALERTED";
          badge.title = "Momentum alert sent — check notification log";
          tickerCell.appendChild(badge);
        }
      } else {
        // Clean up if a row was previously alerted but no longer matches
        tr.classList.remove("sj-alerted");
        const oldBadge = tr.querySelector(".alerted-badge");
        if (oldBadge) oldBadge.remove();
      }
    });
  }

  const stocksTbody = document.getElementById("stocksTbody");
  const cryptoTbody = document.getElementById("cryptoTbody");
  if (stocksTbody) new MutationObserver(() => setTimeout(highlightAlertedRows, 50)).observe(stocksTbody, { childList: true });
  if (cryptoTbody) new MutationObserver(() => setTimeout(highlightAlertedRows, 50)).observe(cryptoTbody, { childList: true });

  document.addEventListener("click", e => {
    const btn = e.target.closest("#alertCardsToggle .segmented-btn");
    if (!btn) return;
    const mainToggle = document.getElementById("assetControl");
    if (mainToggle) { const t = mainToggle.querySelector(`[data-value="${btn.dataset.value}"]`); if (t) t.click(); }
    setTimeout(renderTodayAlerts, 100);
  });

  document.getElementById("assetControl")?.querySelectorAll(".segmented-btn").forEach(btn => {
    btn.addEventListener("click", () => setTimeout(renderTodayAlerts, 100));
  });

  fetchAlertLog();
  setInterval(fetchAlertLog, 60_000);

})();