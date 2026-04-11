/**
 * StockJelli Account / Preferences Modal
 * =======================================
 * 
 * Lets existing subscribers:
 *   - Verify identity via email
 *   - Change asset types (stocks / crypto / both)
 *   - Change region (americas / global)
 *   - Change alert frequency (1-4/day)
 *   - Update webhook URL (webhook/bundle plans)
 *   - Access Stripe billing portal
 *   - See upgrade prompt (push → bundle)
 * 
 * Load after alerts-frontend.js:
 *   <script src="account.js" defer></script>
 */

(() => {
    if (window.__STOCKJELLI_ACCOUNT_INIT__) return;
    window.__STOCKJELLI_ACCOUNT_INIT__ = true;
  
    const API_BASE = "https://api.stockjelli.com";
    const STORAGE_KEY = "sj_subscriber_email";
  
    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIG
    // ═══════════════════════════════════════════════════════════════════════════
  
    const PLAN_DISPLAY = {
      push:    { name: "Push Notifications", icon: "🔔" },
      webhook: { name: "Webhook API",        icon: "⚡" },
      bundle:  { name: "Push + API Bundle",  icon: "🚀" },
    };
  
    const ASSET_HINTS = {
      stocks: "US equities — signals during market hours",
      crypto: "Top crypto by market cap — 24/7",
      both:   "Stocks during market hours + crypto 24/7",
    };
  
    const REGION_HINTS = {
      americas: "Alert times in Eastern Time (ET)",
      global:   "Alert times in UTC for international traders",
    };
  
    const FREQ_HINTS_AMERICAS = {
      1: "First hour (10:00 AM ET)",
      2: "Morning + midday (10:00, 12:30 PM ET)",
      3: "Morning + midday + power hour (10:00, 12:30, 3:30 PM ET)",
      4: "All windows + evening crypto",
    };
  
    const FREQ_HINTS_GLOBAL = {
      1: "Morning crypto (8:00 AM UTC)",
      2: "Morning + afternoon (8:00 AM, 2:00 PM UTC)",
      3: "All day crypto (8:00 AM, 2:00 PM, 8:00 PM UTC)",
      4: "Same as 3 — 3 is optimal for crypto",
    };
  
    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════
  
    let verifiedEmail = localStorage.getItem(STORAGE_KEY) || "";
    let currentPrefs = null; // populated after fetch
  
    // ═══════════════════════════════════════════════════════════════════════════
    // DOM REFS
    // ═══════════════════════════════════════════════════════════════════════════
  
    const modal = document.getElementById("accountModal");
    const closeBtn = document.getElementById("closeAccountBtn");
  
    // Login step
    const loginStep = document.getElementById("accountLoginStep");
    const emailInput = document.getElementById("accountEmailInput");
    const emailError = document.getElementById("accountEmailError");
    const verifyBtn = document.getElementById("accountVerifyBtn");
    const subscribeLink = document.getElementById("accountSubscribeLink");
  
    // Prefs step
    const prefsStep = document.getElementById("accountPrefsStep");
    const planIcon = document.getElementById("accountPlanIcon");
    const planName = document.getElementById("accountPlanName");
    const planEmail = document.getElementById("accountPlanEmail");
    const planBadge = document.getElementById("accountPlanBadge");
  
    const assetControl = document.getElementById("accountAssetControl");
    const assetHint = document.getElementById("accountAssetHint");
    const regionControl = document.getElementById("accountRegionControl");
    const regionHint = document.getElementById("accountRegionHint");
    const freqSection = document.getElementById("accountFreqSection");
    const freqControl = document.getElementById("accountFreqControl");
    const freqHint = document.getElementById("accountFreqHint");
    const webhookSection = document.getElementById("accountWebhookSection");
    const webhookInput = document.getElementById("accountWebhookInput");
  
    const saveBtn = document.getElementById("accountSaveBtn");
    const saveMsg = document.getElementById("accountSaveMsg");
    const upgradePrompt = document.getElementById("accountUpgradePrompt");
    const upgradeBtn = document.getElementById("accountUpgradeBtn");
    const signOutBtn = document.getElementById("accountSignOutBtn");
  
    // Drawer button
    const drawerAccountBtn = document.getElementById("drawerAccountBtn");
  
    // ═══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════════
  
    function isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
  
    function setSegmented(controlEl, value) {
      if (!controlEl) return;
      controlEl.querySelectorAll(".segmented-btn").forEach(btn => {
        btn.classList.toggle("segmented-on", btn.dataset.value === value);
      });
    }
  
    function getSegmented(controlEl) {
      if (!controlEl) return null;
      const active = controlEl.querySelector(".segmented-on");
      return active?.dataset.value || null;
    }
  
    function showMsg(text, type) {
      if (!saveMsg) return;
      saveMsg.textContent = text;
      saveMsg.style.display = "block";
      saveMsg.style.color = type === "success" ? "var(--green, #34d399)" : "var(--red, #ef4444)";
      if (type === "success") {
        setTimeout(() => { saveMsg.style.display = "none"; }, 3000);
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
  
      // If we have a stored email, try auto-verify
      if (verifiedEmail) {
        emailInput.value = verifiedEmail;
        loadPreferences(verifiedEmail);
      } else {
        showLoginStep();
      }
    }
  
    function closeModal() {
      if (!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  
    function showLoginStep() {
      if (loginStep) loginStep.style.display = "";
      if (prefsStep) prefsStep.style.display = "none";
      if (emailError) emailError.style.display = "none";
    }
  
    function showPrefsStep() {
      if (loginStep) loginStep.style.display = "none";
      if (prefsStep) prefsStep.style.display = "";
    }
  
    // ═══════════════════════════════════════════════════════════════════════════
    // DRAWER BUTTON — show "Account" if subscriber, else show "Subscribe"
    // ═══════════════════════════════════════════════════════════════════════════
  
    function updateDrawerButton() {
      if (!drawerAccountBtn) return;
      const isSubscriber = !!localStorage.getItem(STORAGE_KEY);
      drawerAccountBtn.textContent = isSubscriber ? "Account" : "Subscribe";
    }
  
    updateDrawerButton();
  
    // ═══════════════════════════════════════════════════════════════════════════
    // API
    // ═══════════════════════════════════════════════════════════════════════════
  
    async function fetchPreferences(email) {
      const res = await fetch(`${API_BASE}/api/alerts/preferences?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    }
  
    async function savePreferences(email, prefs) {
      const res = await fetch(`${API_BASE}/api/alerts/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...prefs }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      return res.json();
    }
  
    // ═══════════════════════════════════════════════════════════════════════════
    // LOAD PREFERENCES
    // ═══════════════════════════════════════════════════════════════════════════
  
    async function loadPreferences(email) {
      if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.textContent = "Verifying...";
      }
  
      try {
        const data = await fetchPreferences(email);
  
        if (!data.active) {
          if (emailError) {
            emailError.textContent = "No active subscription found for this email.";
            emailError.style.display = "block";
          }
          showLoginStep();
          return;
        }
  
        // Store verified email
        verifiedEmail = email;
        localStorage.setItem(STORAGE_KEY, email);
        document.body.classList.add("sj-subscriber");
        currentPrefs = data;
  
        // Populate plan bar
        const plan = data.plan || "push";
        const planInfo = PLAN_DISPLAY[plan] || PLAN_DISPLAY.push;
        if (planIcon) planIcon.textContent = planInfo.icon;
        if (planName) planName.textContent = planInfo.name;
        if (planEmail) planEmail.textContent = email;
        if (planBadge) planBadge.textContent = "ACTIVE";
  
        // Set controls to current values
        setSegmented(assetControl, data.assetTypes || "both");
        setSegmented(regionControl, data.region || "americas");
        setSegmented(freqControl, String(data.alertFrequency || 1));
        if (webhookInput) webhookInput.value = data.webhookUrl || "";
  
        // Update hints
        updateAssetHint();
        updateRegionHint();
        updateFreqHint();
  
        // Show/hide sections based on plan
        const showPush = plan === "push" || plan === "bundle";
        const showWebhook = plan === "webhook" || plan === "bundle";
        if (freqSection) freqSection.style.display = showPush ? "" : "none";
        if (webhookSection) webhookSection.style.display = showWebhook ? "" : "none";
  
        // Upgrade prompt for push-only subscribers
        if (upgradePrompt) {
          upgradePrompt.style.display = plan === "push" ? "" : "none";
        }
  
        showPrefsStep();

        // Auto-subscribe to push if not already subscribed
if (window.StockJelliPush && window.StockJelliPush.isSupported()) {
  window.StockJelliPush.isSubscribed().then(subscribed => {
    if (!subscribed) {
      window.StockJelliPush.subscribe(email).then(result => {
        console.log("[account] Push subscribe:", result);
      }).catch(err => {
        console.warn("[account] Push subscribe failed:", err);
      });
    }
  });
}
        updateDrawerButton();
  
      } catch (err) {
        console.error("[account] Load error:", err);
        if (emailError) {
          emailError.textContent = "Could not verify this email. Please try again.";
          emailError.style.display = "block";
        }
        showLoginStep();
      } finally {
        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.textContent = "Access Account →";
        }
      }
    }
  
    // ═══════════════════════════════════════════════════════════════════════════
    // EVENT HANDLERS
    // ═══════════════════════════════════════════════════════════════════════════
  
    // Open modal triggers
    drawerAccountBtn?.addEventListener("click", () => {
      // Close the drawer first
      const drawer = document.getElementById("drawer");
      const drawerOverlay = document.getElementById("drawerOverlay");
      if (drawer) {
        drawer.classList.remove("is-open");
        drawer.setAttribute("aria-hidden", "true");
      }
      if (drawerOverlay) drawerOverlay.classList.remove("is-open");
      document.body.style.overflow = "";
  
      // If not a subscriber, open the checkout modal instead
      const isSubscriber = !!localStorage.getItem(STORAGE_KEY);
      if (!isSubscriber) {
        const alertsBtn = document.getElementById("enableAlertsBtn");
        if (alertsBtn) alertsBtn.click();
        return;
      }
  
      openModal();
    });
  
    // Close
    closeBtn?.addEventListener("click", closeModal);
    modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal?.classList.contains("is-open")) closeModal();
    });
  
    // Verify email
    verifyBtn?.addEventListener("click", () => {
      const email = (emailInput?.value || "").trim().toLowerCase();
      if (!email || !isValidEmail(email)) {
        if (emailError) {
          emailError.textContent = "Please enter a valid email address.";
          emailError.style.display = "block";
        }
        return;
      }
      if (emailError) emailError.style.display = "none";
      loadPreferences(email);
    });
  
    emailInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") verifyBtn?.click();
    });
  
    // Subscribe link → open checkout modal
    subscribeLink?.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
      const alertsBtn = document.getElementById("enableAlertsBtn");
      if (alertsBtn) alertsBtn.click();
    });
  
    // Asset type control
    assetControl?.addEventListener("click", (e) => {
      const btn = e.target.closest(".segmented-btn");
      if (!btn) return;
      setSegmented(assetControl, btn.dataset.value);
      updateAssetHint();
    });
  
    // Region control
    regionControl?.addEventListener("click", (e) => {
      const btn = e.target.closest(".segmented-btn");
      if (!btn) return;
      setSegmented(regionControl, btn.dataset.value);
      updateRegionHint();
      updateFreqHint();
  
      // Cap freq at 3 for global
      const region = btn.dataset.value;
      const currentFreq = Number(getSegmented(freqControl) || 1);
      if (region === "global" && currentFreq > 3) {
        setSegmented(freqControl, "3");
      }
  
      // Disable 4th button for global
      if (freqControl) {
        freqControl.querySelectorAll(".segmented-btn").forEach(b => {
          if (b.dataset.value === "4") {
            b.style.opacity = region === "global" ? "0.35" : "";
            b.style.pointerEvents = region === "global" ? "none" : "";
          }
        });
      }
    });
  
    // Frequency control
    freqControl?.addEventListener("click", (e) => {
      const btn = e.target.closest(".segmented-btn");
      if (!btn || btn.style.pointerEvents === "none") return;
      setSegmented(freqControl, btn.dataset.value);
      updateFreqHint();
    });
  
    function updateAssetHint() {
      if (assetHint) assetHint.textContent = ASSET_HINTS[getSegmented(assetControl)] || "";
    }
  
    function updateRegionHint() {
      if (regionHint) regionHint.textContent = REGION_HINTS[getSegmented(regionControl)] || "";
    }
  
    function updateFreqHint() {
      const region = getSegmented(regionControl) || "americas";
      const freq = getSegmented(freqControl) || "1";
      const hints = region === "americas" ? FREQ_HINTS_AMERICAS : FREQ_HINTS_GLOBAL;
      if (freqHint) freqHint.textContent = hints[freq] || "";
    }
  
    // Save preferences
    saveBtn?.addEventListener("click", async () => {
      if (!verifiedEmail) return;
  
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      if (saveMsg) saveMsg.style.display = "none";
  
      const region = getSegmented(regionControl) || "americas";
      let freq = Number(getSegmented(freqControl) || 1);
      if (region === "global" && freq > 3) freq = 3;
  
      const prefs = {
        assetTypes: getSegmented(assetControl) || "both",
        region: region,
        alertFrequency: freq,
        webhookUrl: webhookInput?.value?.trim() || null,
      };
  
      try {
        await savePreferences(verifiedEmail, prefs);
        showMsg("✓ Preferences saved! Changes take effect on your next alert.", "success");
      } catch (err) {
        console.error("[account] Save error:", err);
        showMsg("Failed to save. Please try again.", "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Preferences";
      }
    });
  
    // Sign out
    signOutBtn?.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      document.body.classList.remove("sj-subscriber");
      verifiedEmail = "";
      currentPrefs = null;
      updateDrawerButton();
      showLoginStep();
      if (emailInput) emailInput.value = "";
    });
  
    // Upgrade button → open checkout modal with bundle pre-selected
    upgradeBtn?.addEventListener("click", () => {
      closeModal();
      // Open checkout modal — the user will need to select Bundle manually
      // (or you can pre-select it by dispatching a click after open)
      const alertsBtn = document.getElementById("enableAlertsBtn");
      if (alertsBtn) alertsBtn.click();
    });
  
  })();