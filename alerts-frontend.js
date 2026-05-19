/**
 * StockJelli Checkout Modal + Alert Performance — Frontend JavaScript
 * ====================================================================
 * 
 * April 2026 Launch — Multi-plan checkout flow + live alert display
 * 
 * UPDATED: 
 *   - Frequency options expanded to 1–8/day + Unlimited (stored as 99)
 *   - initFeaturedAlert removed (dead code — #featuredAlertWrap no longer in HTML)
 *   - FLIP animation added to alert log rows (bar chart race reordering)
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
  function fmtFreq(f) { if (f === 99 || f === "99") return "Unlimited"; return `${f}/day`; }

  function showStep(step) {
    currentStep = step;
    if (stepDots) stepDots.forEach(d => { const s = Number(d.dataset.step); d.classList.remove("step-active", "step-complete"); if (s === step) d.classList.add("step-active"); else if (s < step) d.classList.add("step-complete"); });
    if (modalSteps) modalSteps.forEach(s => { s.hidden = s.dataset.step !== String(step); });
    if (stepsEl) stepsEl.classList.remove("hidden");
  }

  async function showSuccess() {
    if (modalSteps) modalSteps.forEach(s => { s.hidden = s.dataset.step !== "success"; });
    if (stepsEl) stepsEl.classList.add("hidden");
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

  regionControl?.addEventListener("click", e => {
    const b = e.target.closest(".segmented-btn"); if (!b) return;
    selectedRegion = b.dataset.value; setSegmented(regionControl, selectedRegion);
    if (regionHint) regionHint.textContent = REGION_INFO[selectedRegion]?.hint || "";
    applyFreqConstraints(); updateFreqHint();
  });

  frequencyControl?.addEventListener("click", e => { const b = e.target.closest(".segmented-btn"); if (!b || b.style.pointerEvents === "none") return; selectedFrequency = Number(b.dataset.value); setSegmented(frequencyControl, String(selectedFrequency)); updateFreqHint(); });

  function applyFreqConstraints() {
    const maxFreq = selectedRegion === "global" ? MAX_FREQ_GLOBAL : MAX_FREQ_AMERICAS;
    if (frequencyControl) {
      frequencyControl.querySelectorAll(".segmented-btn").forEach(b => {
        const v = Number(b.dataset.value);
        const disabled = v !== 99 && v > maxFreq;
        b.style.opacity = disabled ? "0.35" : "";
        b.style.pointerEvents = disabled ? "none" : "";
      });
    }
    if (selectedFrequency !== 99 && selectedFrequency > maxFreq) {
      selectedFrequency = maxFreq; setSegmented(frequencyControl, String(selectedFrequency));
    }
  }

  function updateFreqHint() { if (!frequencyHint) return; frequencyHint.textContent = (selectedRegion === "americas" ? FREQ_HINTS_AMERICAS : FREQ_HINTS_GLOBAL)[selectedFrequency] || ""; }

  if (consentItems) consentItems.forEach(item => { item.addEventListener("click", e => { if (e.target.tagName === "A") return; const k = item.dataset.ack; if (!k) return; acks[k] = !acks[k]; item.classList.toggle("checked", acks[k]); validateStep2(); }); });
  if (autoExecGroup) autoExecGroup.querySelectorAll("input[name='auto_exec']").forEach(r => { r.addEventListener("change", () => { autoExecValue = r.value; if (autoTradeNotice) autoTradeNotice.classList.toggle("visible", autoExecValue === "yes" || autoExecValue === "exploring"); validateStep2(); }); });
  emailInput?.addEventListener("input", () => { if (emailError) emailError.style.display = "none"; validateStep2(); });
  function validateStep2() { const ok = emailInput && isValidEmail(emailInput.value.trim()); let wh = true; if (hasWebhook()) wh = Object.values(acks).every(Boolean) && !!autoExecValue; const ready = ok && wh; if (step2NextBtn) step2NextBtn.disabled = !ready; if (step2Hint) { if (!ok && emailInput?.value.trim()) { step2Hint.style.display = ""; step2Hint.textContent = "Enter a valid email"; step2Hint.style.color = "#f87171"; } else if (hasWebhook() && !wh) { step2Hint.style.display = ""; step2Hint.textContent = "Complete all acknowledgments"; step2Hint.style.color = "#f59e0b"; } else if (ready) { step2Hint.style.display = ""; step2Hint.textContent = "Ready"; step2Hint.style.color = "#34d399"; } else step2Hint.style.display = "none"; } }
  step2BackBtn?.addEventListener("click", () => showStep(1));
  step2NextBtn?.addEventListener("click", async () => { const e = emailInput?.value?.trim(); if (!e || !isValidEmail(e)) { if (emailError) emailError.style.display = "block"; emailInput?.focus(); return; } userEmail = e; webhookUrl = webhookUrlInput?.value?.trim() || ""; try { const r = await fetch(`${API_BASE}/api/alerts/status?email=${encodeURIComponent(e)}`); if (r.ok) { const d = await r.json(); if (d.subscribed) { alert("You're already subscribed!"); closeModal(); return; } } } catch {} populateReview(); showStep(3); });

  // Step 3
  function populateReview() {
    const p = PLANS[selectedPlan]; if (!p) return;
    const el = id => document.getElementById(id);
    if (el("reviewPlanIcon")) el("reviewPlanIcon").textContent = p.icon;
    if (el("reviewPlanName")) el("reviewPlanName").textContent = p.name;
    const b = el("reviewPlanBadge"); if (b) { b.textContent = p.badge; b.className = `plan-badge ${p.badgeClass}`; }
    if (el("reviewPlanPrice")) el("reviewPlanPrice").textContent = `$${p.price}`;
    if (el("summaryEmail")) el("summaryEmail").textContent = userEmail;
    if (el("summaryAssets")) el("summaryAssets").textContent = ASSET_LABELS[selectedAssets] || "—";
    if (el("summaryRegion")) el("summaryRegion").textContent = REGION_INFO[selectedRegion]?.label || "—";
    const fr = el("summaryFreqRow"); if (fr) fr.style.display = hasPush() ? "" : "none";
    if (el("summaryFrequency")) el("summaryFrequency").textContent = fmtFreq(selectedFrequency);
    const wr = el("summaryWebhookRow"), ar = el("summaryAutoExecRow");
    if (wr) wr.style.display = hasWebhook() ? "" : "none";
    if (ar) ar.style.display = hasWebhook() ? "" : "none";
    if (el("summaryWebhook")) el("summaryWebhook").textContent = webhookUrl || "(later)";
    if (el("summaryAutoExec")) el("summaryAutoExec").textContent = autoExecValue || "—";
  }

  step3BackBtn?.addEventListener("click", () => showStep(2));

  // Stripe checkout
  stripeCheckoutBtn?.addEventListener("click", async () => {
    if (!userEmail || !selectedPlan) { showStep(1); return; }
    localStorage.setItem("sj_checkout_email", userEmail);
    localStorage.setItem("sj_checkout_plan", selectedPlan);
    stripeCheckoutBtn.disabled = true; stripeCheckoutBtn.textContent = "Redirecting to Stripe...";
    try {
      const r = await fetch(`${API_BASE}/api/alerts/create-checkout`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, plan: selectedPlan, assetTypes: selectedAssets, region: selectedRegion, alertFrequency: hasPush() ? selectedFrequency : 0, webhookUrl: hasWebhook() ? webhookUrl : undefined, tosVersion: "2026-04-19" }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      const { url } = await r.json();
      if (url) window.location.href = url; else throw new Error("No URL");
    } catch (err) { alert("Checkout failed. Please try again."); stripeCheckoutBtn.disabled = false; stripeCheckoutBtn.textContent = "Subscribe with Stripe →"; }
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
  // TODAY'S ALERTS — Notification Log with FLIP Animation
  // ═══════════════════════════════════════════════════════════════════════════

  const FLIP_DURATION = 450;
  const FADE_DURATION = 300;

  let alertLogData = null;
  let alertedSymbolsToday = new Set();
  window.__sjAlertedSymbols = alertedSymbolsToday;

  async function fetchAlertLog() {
    try {
      let data;

      // On first call, consume prefetched alert data if available
      if (window.__sjAlertPrefetch) {
        try {
          data = await window.__sjAlertPrefetch;
          window.__sjAlertPrefetch = null;
          console.log("[alert-log] Using prefetched data");
        } catch (e) {
          window.__sjAlertPrefetch = null;
        }
      }

      // Normal fetch (or prefetch failed/consumed)
      if (!data) {
        const res = await fetch(`${API_BASE}/api/notification-log?limit=500`);
        if (!res.ok) return;
        data = await res.json();
      }

      alertLogData = data;
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      alertedSymbolsToday.clear();
      for (const a of (alertLogData.notifications || [])) { if (a.date === today) alertedSymbolsToday.add(a.symbol); }
      window.__sjAlertedSymbols = alertedSymbolsToday;
      renderProofBar();
      renderTodayAlerts();
      highlightAlertedRows();
    } catch (e) { console.warn("[alert-log] Fetch failed:", e.message); }
  }

  /**
   * Render the all-time v2 proof bar — slim one-liner showing win rate,
   * avg peak, and alert count. Uses the same data fetchAlertLog already has.
   * Zero additional API calls.
   */
  function renderProofBar() {
    const bar = document.getElementById("alertProofBar");
    if (!bar || !alertLogData) return;

    const mode = getCurrentAssetMode();
    let all = alertLogData.notifications || [];
    if (mode === "stocks") all = all.filter(a => a.mode === "stocks");
    else if (mode === "crypto") all = all.filter(a => a.mode === "crypto");
    // v2 current: v2.1 for stocks, v2 for crypto
    const v2 = all.filter(a => a.formulaVersion === "v2.1" || (a.formulaVersion === "v2" && a.mode === "crypto"));
    const now = Date.now();
    // Exclude crypto alerts less than 6h old — still tracking, not yet judged
    const wp = v2.filter(a => {
      if (a.peakAfterPush == null) return false;
      if (a.mode === "crypto" && a.pushTimestamp && (now - new Date(a.pushTimestamp).getTime()) < 15 * 60 * 1000) return false;
      return true;
    });
    if (wp.length < 1) { bar.style.display = "none"; return; }

    const w3 = wp.filter(a => a.peakAfterPush >= 2.95).length;
    const wr = Math.round(w3 / wp.length * 100);
    const avg = Math.round(wp.reduce((s, a) => s + (a.peakAfterPush || 0), 0) / wp.length * 10) / 10;
    const nr = wp.filter(a => a.peakAfterPush >= 0).length;

    const days = new Set(v2.map(a => a.date)).size;

    const wrColor = wr >= 80 ? "#4ade80" : wr >= 65 ? "#fbbf24" : "#ef4444";
    const sep = '<span style="color:rgba(255,255,255,0.1)">·</span>';

    bar.innerHTML = `
      <span style="font-weight:700; color:${wrColor}">${wr}% hit +3%</span>
      ${sep}
      <span>${v2.length} alerts over ${days} days</span>
      ${sep}
      <span>+${avg}% avg peak</span>
      ${sep}
      <span style="color:${nr === wp.length ? '#4ade80' : 'rgba(255,255,255,0.35)'}">${nr}/${wp.length} never red</span>
      ${sep}
      <a href="/alert-log.html" style="color:rgba(77,163,255,0.7); text-decoration:none; font-weight:500;">Full log →</a>
    `;
    bar.style.display = "flex";
  }

  // ── initFeaturedAlert REMOVED — #featuredAlertWrap no longer exists in HTML ──
  // This eliminates a wasted /api/notification-log fetch on load + every 60s

  function getCurrentAssetMode() {
    return document.querySelector("#assetControl .segmented-on")?.dataset?.value || "stocks";
  }

  /**
   * FLIP-animate alert log rows.
   * Similar to screener FLIP but for .alert-log-row divs instead of <tr>.
   */
  function flipUpdateAlertRows(container, headerHtml, rowsData) {
    if (!container) return;

    // Snapshot existing row positions
    const firstPositions = new Map();
    const existingRows = new Map();
    container.querySelectorAll(".alert-log-row[data-alert-sym]").forEach(el => {
      const key = el.dataset.alertSym;
      firstPositions.set(key, el.getBoundingClientRect());
      existingRows.set(key, el);
    });

    const isFirstRender = existingRows.size === 0;
    const newKeys = new Set(rowsData.map(r => r.key));

    // Remove stale rows with fade-out
    existingRows.forEach((el, key) => {
      if (!newKeys.has(key)) {
        el.style.transition = `opacity ${FADE_DURATION}ms ease, transform ${FADE_DURATION}ms ease`;
        el.style.opacity = "0";
        el.style.transform = "translateX(20px)";
        el.style.pointerEvents = "none";
        setTimeout(() => el.remove(), FADE_DURATION);
      }
    });

    // Ensure header row exists
    let headerEl = container.querySelector(".alert-log-header-row");
    if (!headerEl && headerHtml) {
      container.insertAdjacentHTML("afterbegin", headerHtml);
      headerEl = container.querySelector(".alert-log-header-row");
    }

    // Build/update rows
    const keptRows = new Map();
    for (const { key, html } of rowsData) {
      let el = existingRows.get(key);
      if (el) {
        // Update existing row content
        el.innerHTML = html;
        keptRows.set(key, el);
      } else {
        // Create new row
        el = document.createElement("div");
        el.className = "alert-log-row";
        el.dataset.alertSym = key;
        el.innerHTML = html;
        if (!isFirstRender) {
          el.style.opacity = "0";
          el.style.transform = "translateX(-20px)";
        }
        keptRows.set(key, el);
      }
    }

    // Reorder DOM: append all rows after header in correct order
    for (const { key } of rowsData) {
      const el = keptRows.get(key);
      if (el) container.appendChild(el);
    }

    // FLIP animation (skip on first render)
    if (!isFirstRender) {
      const lastPositions = new Map();
      container.querySelectorAll(".alert-log-row[data-alert-sym]").forEach(el => {
        lastPositions.set(el.dataset.alertSym, el.getBoundingClientRect());
      });

      container.querySelectorAll(".alert-log-row[data-alert-sym]").forEach(el => {
        const key = el.dataset.alertSym;
        const first = firstPositions.get(key);
        const last = lastPositions.get(key);

        if (first && last) {
          const deltaY = first.top - last.top;
          if (Math.abs(deltaY) > 1) {
            el.style.transition = "none";
            el.style.transform = `translateY(${deltaY}px)`;
            el.style.zIndex = "10";
            void el.offsetHeight;
            el.style.transition = `transform ${FLIP_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
            el.style.transform = "translateY(0)";
            const onEnd = () => { el.style.transition = ""; el.style.transform = ""; el.style.zIndex = ""; el.removeEventListener("transitionend", onEnd); };
            el.addEventListener("transitionend", onEnd);
          }
        } else if (!first && last) {
          // New row — fade in
          void el.offsetHeight;
          el.style.transition = `opacity ${FADE_DURATION}ms ease ${FLIP_DURATION * 0.3}ms, transform ${FADE_DURATION}ms ease ${FLIP_DURATION * 0.3}ms`;
          el.style.opacity = "1";
          el.style.transform = "translateX(0)";
          setTimeout(() => { el.style.transition = ""; }, FADE_DURATION + FLIP_DURATION * 0.3 + 50);
        }
      });
    }
  }

  function renderTodayAlerts() {
    const container = document.getElementById("alertCardsSection");
    if (!container || !alertLogData) return;

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const mode = getCurrentAssetMode();
    
    const now24h = Date.now() - 24 * 60 * 60 * 1000;
let todayAlerts = (alertLogData.notifications || []).filter(a => {
  if (a.mode === "crypto" && a.pushTimestamp) {
    return new Date(a.pushTimestamp).getTime() >= now24h;
  }
  return a.date === today;
});
    if (mode === "stocks") todayAlerts = todayAlerts.filter(a => a.mode === "stocks");
    else if (mode === "crypto") todayAlerts = todayAlerts.filter(a => a.mode === "crypto");


    const now = Date.now();
    const withPeak = todayAlerts.filter(a => {
      if (a.peakAfterPush == null) return false;
      if (a.mode === "crypto" && a.peakAfterPush < 0 && a.pushTimestamp && (now - new Date(a.pushTimestamp).getTime()) < 15 * 60 * 1000) return false;
      return true;
    });
    
    const winners = withPeak.filter(a => a.peakAfterPush >= 2.95).length;
    const duds = withPeak.filter(a => a.peakAfterPush < 0).length;
    const neverRed = withPeak.filter(a => a.peakAfterPush >= 0).length;
    const avgPeak = withPeak.length > 0 ? Math.round(withPeak.reduce((s, a) => s + (a.peakAfterPush || 0), 0) / withPeak.length * 10) / 10 : 0;
    const winRate = withPeak.length > 0 ? Math.round((winners / withPeak.length) * 100) : 0;

    const statsEl = document.getElementById("alertCardsStats");
    const bodyEl = document.getElementById("alertCardsBody");
    const emptyEl = document.getElementById("alertCardsEmpty");

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

        const headerHtml = `<div class="alert-log-header-row"><span>TIME</span><span>TICKER</span><span>ALERT → PEAK</span><span>MAX GAIN</span><span>SCORE</span><span>RESULT</span></div>`;

        const rowsData = todayAlerts.map(a => {
          const peak = a.peakAfterPush != null ? Math.round(a.peakAfterPush * 10) / 10 : null;
          const isWin = peak != null && peak >= 2.95;
          const isDud = peak != null && peak < 3;
          const peakStr = peak != null ? `+${peak.toFixed(1)}%` : "—";
          const peakColor = isWin ? "#4ade80" : isDud && peak >= 0 ? "#fbbf24" : isDud ? "#ef4444" : "rgba(255,255,255,0.3)";
          const ageMs = a.pushTimestamp ? Date.now() - new Date(a.pushTimestamp).getTime() : Infinity;
          const isImmature = a.mode === "crypto" && peak !== null && peak < 0 && ageMs < 15 * 60 * 1000;
          const resultIcon = (peak == null || isImmature) ? '<span style="color:rgba(255,255,255,0.15);font-size:0.7rem">⏳</span>' : isWin ? '<span style="background:rgba(34,197,94,0.15);padding:2px 5px;border-radius:4px">✅</span>' : '<span style="background:rgba(239,68,68,0.12);padding:2px 5px;border-radius:4px">❌</span>';
          const modeIcon = a.mode === "crypto" ? "🪙" : "📈";
          const time = new Date(a.pushTimestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
          const priceAtPush = a.priceAtPush != null ? `$${a.priceAtPush.toFixed(2)}` : "$—";
          const peakPriceStr = a.peakAfterPushPrice ? `$${a.peakAfterPushPrice.toFixed(2)}` : peakStr;
          const tvUrl = window.getBrokerUrl
          ? window.getBrokerUrl(a.symbol, a.mode === "crypto" ? "crypto" : "stock", a.exchange || null)
          : (a.mode === "crypto"
              ? `https://www.tradingview.com/chart/?symbol=BINANCE:${a.symbol}USDT&aff_id=162729`
              : `https://www.tradingview.com/chart/?symbol=${a.symbol}&aff_id=162729`);
          const sj = a.sjScore || "—";
          const sjColor = sj >= 75 ? "#4ade80" : sj >= 60 ? "#e2e8f0" : "#64748b";

          return {
            key: `${a.symbol}-${a.pushTimestamp}`,
            html: `
              <span class="alert-log-time">${time}</span>
              <a href="${tvUrl}" target="_blank" rel="noopener" class="alert-log-ticker">${modeIcon} <strong>${a.symbol}</strong></a>
              <span class="alert-log-prices">${priceAtPush} → <span style="color:${peakColor}">${peakPriceStr}</span></span>
              <span class="alert-log-gain" style="color:${peakColor}">${peakStr}</span>
              <span class="alert-log-score" style="color:${sjColor}">${sj}</span>
              <span class="alert-log-result">${resultIcon}${a.tweetUrl ? `<a href="${a.tweetUrl}" target="_blank" rel="noopener" style="color:#fff;opacity:0.5;font-size:0.7rem;margin-left:5px;text-decoration:none;font-weight:700;" title="View on X">𝕏</a>` : ''}</span>
            `,
          };
        });

        flipUpdateAlertRows(bodyEl, headerHtml, rowsData);
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
        if (!tr.classList.contains("sj-alerted")) tr.classList.add("sj-alerted");
        const tickerCell = tr.querySelector("td.ticker");
        if (tickerCell && !tickerCell.querySelector(".alerted-badge")) {
          const badge = document.createElement("span");
          badge.className = "alerted-badge";
          badge.innerHTML = "⚡ ALERTED";
          badge.title = "Momentum alert sent — check notification log";
          tickerCell.appendChild(badge);
        }
      } else {
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
    btn.addEventListener("click", () => setTimeout(() => { renderProofBar(); renderTodayAlerts(); }, 100));
    
  });

  fetchAlertLog();
  setInterval(fetchAlertLog, 60_000);

})();