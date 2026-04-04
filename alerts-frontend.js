/**
 * StockJelli Checkout Modal — Frontend JavaScript
 * ================================================
 * 
 * April 2026 Launch — Multi-plan checkout flow
 * 
 * Plans:
 *   push     — $5/mo  (Push Notifications)
 *   webhook  — $30/mo (Webhook API)
 *   bundle   — $32/mo (Push + API)
 * 
 * Steps:
 *   1. Choose Plan
 *   2. Configure (email, assets, region, frequency, webhook consent)
 *   3. Review & Checkout → Stripe
 * 
 * Replaces the previous alerts-frontend.js entirely.
 */

(() => {
  if (window.__STOCKJELLI_ALERTS_INIT__) return;
  window.__STOCKJELLI_ALERTS_INIT__ = true;

  const API_BASE = "https://api.stockjelli.com";

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAN CONFIG
  // ═══════════════════════════════════════════════════════════════════════════

  const PLANS = {
    push:    { name: "Push Notifications", icon: "🔔", price: 5,  badge: "POPULAR",    badgeClass: "plan-badge-accent" },
    webhook: { name: "Webhook API",        icon: "⚡", price: 30, badge: "DEVELOPER",  badgeClass: "plan-badge-warn" },
    bundle:  { name: "Push + API Bundle",  icon: "🚀", price: 32, badge: "BEST VALUE", badgeClass: "plan-badge-green" },
  };

  const ASSET_LABELS = {
    stocks: "📈 Stocks",
    crypto: "🪙 Crypto",
    both:   "⚡ Stocks + Crypto",
  };

  const ASSET_HINTS = {
    stocks: "US equities — signals during market hours (9:30 AM–4 PM ET)",
    crypto: "Top crypto by market cap — 24/7 signals",
    both:   "Stocks during market hours + crypto 24/7",
  };

  const REGION_INFO = {
    americas: { label: "🌎 Americas",  hint: "Alerts timed for US market hours (ET)" },
    global:   { label: "🌍 Global",    hint: "Crypto-only alerts at convenient UTC times" },
  };

  const FREQ_HINTS_AMERICAS = {
    1: "First hour momentum alert (10:00 AM ET)",
    2: "Morning + midday (10:00 AM, 12:30 PM ET)",
    3: "Morning + midday + power hour (10:00, 12:30, 3:30 PM ET)",
    4: "All windows + evening crypto (10:00, 12:30, 3:30, 8:00 PM ET)",
  };

  const FREQ_HINTS_GLOBAL = {
    1: "Morning crypto alert (8:00 AM UTC)",
    2: "Morning + afternoon crypto (8:00 AM, 2:00 PM UTC)",
    3: "All day crypto (8:00 AM, 2:00 PM, 8:00 PM UTC)",
    4: "Same as 3 (crypto is 24/7, 3 is optimal)",
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  let currentStep = 1;
  let selectedPlan = null;    // "push" | "webhook" | "bundle"
  let selectedAssets = "both";
  let selectedRegion = "americas";
  let selectedFrequency = 1;
  let userEmail = "";
  let webhookUrl = "";
  let autoExecValue = "";
  const acks = { ack1: false, ack2: false, ack3: false, ack4: false, ack5: false };

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM REFS
  // ═══════════════════════════════════════════════════════════════════════════

  const modal = document.getElementById("alertsModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const stepsEl = document.getElementById("checkoutSteps");
  const stepDots = modal?.querySelectorAll(".step-dot");
  const modalSteps = modal?.querySelectorAll(".modal-step");

  // Step 1
  const planCards = modal?.querySelectorAll(".plan-card");
  const step1NextBtn = document.getElementById("step1NextBtn");
  const step1Hint = document.getElementById("step1Hint");

  // Step 2
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

  // Step 3
  const step3BackBtn = document.getElementById("step3BackBtn");
  const stripeCheckoutBtn = document.getElementById("stripeCheckoutBtn");

  // Success
  const closeSuccessBtn = document.getElementById("closeSuccessBtn");

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function hasPush() {
    return selectedPlan === "push" || selectedPlan === "bundle";
  }

  function hasWebhook() {
    return selectedPlan === "webhook" || selectedPlan === "bundle";
  }

  function setSegmented(controlEl, value) {
    if (!controlEl) return;
    controlEl.querySelectorAll(".segmented-btn").forEach(btn => {
      btn.classList.toggle("segmented-on", btn.dataset.value === value);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  function showStep(step) {
    currentStep = step;

    if (stepDots) {
      stepDots.forEach(dot => {
        const s = Number(dot.dataset.step);
        dot.classList.remove("step-active", "step-complete");
        if (s === step) dot.classList.add("step-active");
        else if (s < step) dot.classList.add("step-complete");
      });
    }

    if (modalSteps) {
      modalSteps.forEach(section => {
        section.hidden = section.dataset.step !== String(step);
      });
    }

    // Update title/subtitle per step
    const titleEl = document.getElementById("checkoutTitle");
    const subtitleEl = document.getElementById("checkoutSubtitle");
    if (titleEl && subtitleEl) {
      if (step === 1) {
        titleEl.textContent = "Choose Your Plan";
        subtitleEl.textContent = "Momentum intelligence, delivered how you want it.";
      } else if (step === 2) {
        titleEl.textContent = `Configure Your ${PLANS[selectedPlan]?.name || "Plan"}`;
        subtitleEl.textContent = "Customize how you receive momentum data.";
      } else if (step === 3) {
        titleEl.textContent = "Review Your Order";
        subtitleEl.textContent = "Confirm your settings before checkout.";
      }
    }

    // Show/hide steps indicator
    if (stepsEl) stepsEl.classList.remove("hidden");
  }

  function showSuccess() {
    if (modalSteps) {
      modalSteps.forEach(section => {
        section.hidden = section.dataset.step !== "success";
      });
    }
    if (stepsEl) stepsEl.classList.add("hidden");

    const titleEl = document.getElementById("checkoutTitle");
    const subtitleEl = document.getElementById("checkoutSubtitle");
    if (titleEl) titleEl.textContent = "";
    if (subtitleEl) subtitleEl.textContent = "";

    // Show API key block for webhook plans
    const apiKeyBlock = document.getElementById("successApiKeyBlock");
    const consentLogBlock = document.getElementById("successConsentLog");
    const successTitle = document.getElementById("successTitle");
    const successSubtitle = document.getElementById("successSubtitle");

    if (hasWebhook()) {
      // Generate mock API key (real key comes from backend in production)
      const chars = "abcdef0123456789";
      let key = "sj_wh_";
      for (let i = 0; i < 24; i++) key += chars[Math.floor(Math.random() * chars.length)];

      if (apiKeyBlock) {
        apiKeyBlock.style.display = "";
        document.getElementById("successApiKey").textContent = key;
      }
      if (consentLogBlock) {
        consentLogBlock.style.display = "";
        const logEl = document.getElementById("consentLogContent");
        if (logEl) {
          logEl.innerHTML = `
            <span>timestamp:</span> ${new Date().toISOString()}<br>
            <span>key:</span> ${key.substring(0, 10)}...<br>
            <span>auto_execution:</span> ${autoExecValue}<br>
            <span>acks:</span> 5/5 accepted<br>
            <span>tos_version:</span> 2026-03-23
          `;
        }
      }
      if (successTitle) successTitle.textContent = "You're All Set!";
      if (successSubtitle) {
        successSubtitle.textContent = selectedPlan === "bundle"
          ? "Push notifications + webhook API are both active."
          : "Your webhook API is live. Signals will be delivered to your endpoint.";
      }
    } else {
      if (apiKeyBlock) apiKeyBlock.style.display = "none";
      if (consentLogBlock) consentLogBlock.style.display = "none";
      if (successTitle) successTitle.textContent = "You're Subscribed!";
      if (successSubtitle) successSubtitle.textContent = "Check your inbox for a welcome email. Your first alert arrives at the next scheduled time.";
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL OPEN / CLOSE
  // ═══════════════════════════════════════════════════════════════════════════

  function openModal() {
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // Check for Stripe success redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("alerts") === "success") {
      showSuccess();
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      showStep(1);
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: PLAN SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  if (planCards) {
    planCards.forEach(card => {
      card.addEventListener("click", () => {
        selectedPlan = card.dataset.plan;
        planCards.forEach(c => c.classList.toggle("plan-selected", c.dataset.plan === selectedPlan));
        if (step1NextBtn) step1NextBtn.disabled = false;
        if (step1Hint) {
          step1Hint.textContent = `${PLANS[selectedPlan].name} — $${PLANS[selectedPlan].price}/mo`;
          step1Hint.style.color = "var(--green, #34d399)";
        }
      });
    });
  }

  step1NextBtn?.addEventListener("click", () => {
    if (!selectedPlan) return;
    configureStep2ForPlan();
    showStep(2);
    emailInput?.focus();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  function configureStep2ForPlan() {
    // Show/hide sections based on plan
    if (frequencySection) {
      frequencySection.style.display = hasPush() ? "" : "none";
    }
    if (webhookUrlSection) {
      webhookUrlSection.style.display = hasWebhook() ? "" : "none";
    }
    if (webhookConsentCard) {
      webhookConsentCard.style.display = hasWebhook() ? "" : "none";
    }

    // Reset webhook consent state
    if (consentItems) {
      consentItems.forEach(item => item.classList.remove("checked"));
    }
    Object.keys(acks).forEach(k => acks[k] = false);
    autoExecValue = "";
    if (autoExecGroup) {
      autoExecGroup.querySelectorAll("input").forEach(r => r.checked = false);
    }
    if (autoTradeNotice) autoTradeNotice.classList.remove("visible");

    // Update config title
    if (configTitle) {
      configTitle.textContent = `Configure Your ${PLANS[selectedPlan]?.name || "Plan"}`;
    }

    validateStep2();
  }

  // Asset type selector
  assetTypeControl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    selectedAssets = btn.dataset.value;
    setSegmented(assetTypeControl, selectedAssets);
    if (assetTypeHint) assetTypeHint.textContent = ASSET_HINTS[selectedAssets] || "";
  });

  // Region selector
  regionControl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    selectedRegion = btn.dataset.value;
    setSegmented(regionControl, selectedRegion);
    if (regionHint) regionHint.textContent = REGION_INFO[selectedRegion]?.hint || "";
    updateFrequencyHint();

    // Cap frequency at 3 for global
    if (selectedRegion === "global" && selectedFrequency > 3) {
      selectedFrequency = 3;
      setSegmented(frequencyControl, String(selectedFrequency));
    }

    // Disable 4th option for global
    if (frequencyControl) {
      frequencyControl.querySelectorAll(".segmented-btn").forEach(btn => {
        if (btn.dataset.value === "4") {
          btn.style.opacity = selectedRegion === "global" ? "0.35" : "";
          btn.style.pointerEvents = selectedRegion === "global" ? "none" : "";
        }
      });
    }
  });

  // Frequency selector
  frequencyControl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn || btn.style.pointerEvents === "none") return;
    selectedFrequency = Number(btn.dataset.value);
    setSegmented(frequencyControl, String(selectedFrequency));
    updateFrequencyHint();
  });

  function updateFrequencyHint() {
    if (!frequencyHint) return;
    const hints = selectedRegion === "americas" ? FREQ_HINTS_AMERICAS : FREQ_HINTS_GLOBAL;
    frequencyHint.textContent = hints[selectedFrequency] || "";
  }

  // Webhook consent items
  if (consentItems) {
    consentItems.forEach(item => {
      item.addEventListener("click", (e) => {
        // Don't toggle if clicking a link
        if (e.target.tagName === "A") return;
        const ackKey = item.dataset.ack;
        if (!ackKey) return;
        acks[ackKey] = !acks[ackKey];
        item.classList.toggle("checked", acks[ackKey]);
        validateStep2();
      });
    });
  }

  // Auto-execution radio
  if (autoExecGroup) {
    autoExecGroup.querySelectorAll("input[name='auto_exec']").forEach(radio => {
      radio.addEventListener("change", () => {
        autoExecValue = radio.value;
        if (autoTradeNotice) {
          autoTradeNotice.classList.toggle("visible", autoExecValue === "yes" || autoExecValue === "exploring");
        }
        validateStep2();
      });
    });
  }

  // Email input validation on change
  emailInput?.addEventListener("input", () => {
    if (emailError) emailError.style.display = "none";
    validateStep2();
  });

  function validateStep2() {
    const emailOk = emailInput && isValidEmail(emailInput.value.trim());
    let webhookOk = true;

    if (hasWebhook()) {
      const allAcks = Object.values(acks).every(Boolean);
      const execOk = !!autoExecValue;
      webhookOk = allAcks && execOk;
    }

    const ready = emailOk && webhookOk;

    if (step2NextBtn) step2NextBtn.disabled = !ready;

    if (step2Hint) {
      if (!emailOk && emailInput?.value.trim()) {
        step2Hint.style.display = "";
        step2Hint.textContent = "Enter a valid email address";
        step2Hint.style.color = "var(--red, #f87171)";
      } else if (hasWebhook() && !webhookOk) {
        step2Hint.style.display = "";
        step2Hint.textContent = "Complete all acknowledgments and usage disclosure to continue";
        step2Hint.style.color = "var(--warn, #f59e0b)";
      } else if (ready) {
        step2Hint.style.display = "";
        step2Hint.textContent = "Ready to continue";
        step2Hint.style.color = "var(--green, #34d399)";
      } else {
        step2Hint.style.display = "none";
      }
    }
  }

  step2BackBtn?.addEventListener("click", () => showStep(1));

  step2NextBtn?.addEventListener("click", async () => {
    const email = emailInput?.value?.trim();
    if (!email || !isValidEmail(email)) {
      if (emailError) emailError.style.display = "block";
      emailInput?.focus();
      return;
    }

    userEmail = email;
    webhookUrl = webhookUrlInput?.value?.trim() || "";

    // Check if already subscribed
    try {
      const res = await fetch(`${API_BASE}/api/alerts/status?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.subscribed) {
          alert("You're already subscribed! Check your email for alerts.");
          closeModal();
          return;
        }
      }
    } catch (err) {
      console.warn("[checkout] Status check failed:", err);
    }

    populateReview();
    showStep(3);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: REVIEW
  // ═══════════════════════════════════════════════════════════════════════════

  function populateReview() {
    const plan = PLANS[selectedPlan];
    if (!plan) return;

    // Plan header
    const icon = document.getElementById("reviewPlanIcon");
    const name = document.getElementById("reviewPlanName");
    const badge = document.getElementById("reviewPlanBadge");
    const price = document.getElementById("reviewPlanPrice");
    if (icon) icon.textContent = plan.icon;
    if (name) name.textContent = plan.name;
    if (badge) { badge.textContent = plan.badge; badge.className = `plan-badge ${plan.badgeClass}`; }
    if (price) price.textContent = `$${plan.price}`;

    // Summary rows
    const el = (id) => document.getElementById(id);
    if (el("summaryEmail")) el("summaryEmail").textContent = userEmail;
    if (el("summaryAssets")) el("summaryAssets").textContent = ASSET_LABELS[selectedAssets] || "—";
    if (el("summaryRegion")) el("summaryRegion").textContent = REGION_INFO[selectedRegion]?.label || "—";

    // Frequency (push/bundle only)
    const freqRow = document.getElementById("summaryFreqRow");
    if (freqRow) freqRow.style.display = hasPush() ? "" : "none";
    if (el("summaryFrequency")) {
      const freq = selectedRegion === "global" && selectedFrequency > 3 ? 3 : selectedFrequency;
      el("summaryFrequency").textContent = `${freq} alert${freq > 1 ? "s" : ""}/day`;
    }

    // Webhook rows
    const webhookRow = document.getElementById("summaryWebhookRow");
    const autoExecRow = document.getElementById("summaryAutoExecRow");
    if (webhookRow) webhookRow.style.display = hasWebhook() ? "" : "none";
    if (autoExecRow) autoExecRow.style.display = hasWebhook() ? "" : "none";
    if (el("summaryWebhook")) el("summaryWebhook").textContent = webhookUrl || "(configure later)";
    if (el("summaryAutoExec")) el("summaryAutoExec").textContent = autoExecValue || "—";
  }

  step3BackBtn?.addEventListener("click", () => showStep(2));

  // ═══════════════════════════════════════════════════════════════════════════
  // STRIPE CHECKOUT
  // ═══════════════════════════════════════════════════════════════════════════

  stripeCheckoutBtn?.addEventListener("click", async () => {
    // Gate: block checkout until April 20, 2026 midnight ET
    const launchDate = new Date("2026-04-20T00:00:00-04:00");
    if (Date.now() < launchDate.getTime()) {
      alert("Subscriptions go live April 20th! Join the push notification waitlist to be first in line.");
      return;
    }

    if (!userEmail || !selectedPlan) {
      showStep(1);
      return;
    }

    stripeCheckoutBtn.disabled = true;
    stripeCheckoutBtn.textContent = "Redirecting to Stripe...";

    try {
      const freq = selectedRegion === "global" && selectedFrequency > 3 ? 3 : selectedFrequency;

      const payload = {
        email: userEmail,
        plan: selectedPlan,
        assetTypes: selectedAssets,
        region: selectedRegion,
        alertFrequency: hasPush() ? freq : 0,
        webhookUrl: hasWebhook() ? webhookUrl : undefined,
        autoExecution: hasWebhook() ? autoExecValue : undefined,
        acknowledgments: hasWebhook() ? Object.keys(acks) : undefined,
        tosVersion: "2026-03-23",
      };

      const res = await fetch(`${API_BASE}/api/alerts/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Checkout failed");
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      console.error("[checkout] Error:", err);
      alert("Failed to start checkout. Please try again.");
      stripeCheckoutBtn.disabled = false;
      stripeCheckoutBtn.textContent = "Subscribe with Stripe →";
    }
  });
  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL TRIGGERS
  // ═══════════════════════════════════════════════════════════════════════════

  // All the existing trigger buttons
  const triggers = [
    "enableAlertsBtn",
    "inlineAlertBtn",
    "noClutterBtn",
  ];

  triggers.forEach(id => {
    document.getElementById(id)?.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    });
  });

  closeModalBtn?.addEventListener("click", closeModal);
  closeSuccessBtn?.addEventListener("click", closeModal);

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("is-open")) closeModal();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-OPEN ON STRIPE REDIRECT
  // ═══════════════════════════════════════════════════════════════════════════

  const params = new URLSearchParams(window.location.search);
  if (params.get("alerts") === "success") {
    setTimeout(() => {
      openModal();
      showSuccess();
      window.history.replaceState({}, "", window.location.pathname);
    }, 300);
  } else if (params.get("alerts") === "cancelled") {
    window.history.replaceState({}, "", window.location.pathname);
  }

  // Initialize defaults
  setSegmented(assetTypeControl, "both");
  setSegmented(regionControl, "americas");
  setSegmented(frequencyControl, "1");

})();