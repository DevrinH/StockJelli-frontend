/**
 * StockJelli Alerts Modal - Frontend JavaScript
 * Updated with region selector (Americas vs Global)
 */

(() => {
  if (window.__STOCKJELLI_ALERTS_INIT__) return;
  window.__STOCKJELLI_ALERTS_INIT__ = true;

  const API_BASE = "https://api.stockjelli.com";

  // DOM Elements
  const modal = document.getElementById("alertsModal");
  const enableAlertsBtn = document.getElementById("enableAlertsBtn");
  const closeModalBtn = document.getElementById("closeModalBtn");
  
  const emailInput = document.getElementById("alertEmail");
  const emailError = document.getElementById("emailError");
  const regionControl = document.getElementById("regionControl");
  const regionHint = document.getElementById("regionHint");
  const frequencyControl = document.getElementById("frequencyControl");
  const frequencyHint = document.getElementById("frequencyHint");
  
  const toStep2Btn = document.getElementById("toStep2Btn");
  const backToStep1Btn = document.getElementById("backToStep1Btn");
  const stripeCheckoutBtn = document.getElementById("stripeCheckoutBtn");
  const closeSuccessBtn = document.getElementById("closeSuccessBtn");
  
  const summaryEmail = document.getElementById("summaryEmail");
  const summaryRegion = document.getElementById("summaryRegion");
  const summaryFrequency = document.getElementById("summaryFrequency");
  
  const stepDots = document.querySelectorAll("#alertsModal .step-dot");
  const modalSteps = document.querySelectorAll("#alertsModal .modal-step");

  // State
  let currentStep = 1;
  let selectedRegion = "americas";
  let selectedFrequency = 1;
  let userEmail = "";

  // Region descriptions
  const regionInfo = {
    americas: {
      label: "🌎 Americas",
      description: "Stocks + Crypto alerts timed for US market hours (ET)",
    },
    global: {
      label: "🌍 Global",
      description: "Crypto-only alerts at convenient UTC times (8 AM, 2 PM, 8 PM)",
    },
  };

  // Frequency descriptions for Americas
  const frequencyInfoAmericas = {
    1: "First hour momentum alert (10:00 AM ET)",
    2: "First hour + midday alerts (10:00 AM, 12:30 PM ET)",
    3: "First hour + midday + power hour (10:00, 12:30, 3:30 PM ET)",
    4: "All day coverage + evening crypto (10:00, 12:30, 3:30, 8:00 PM ET)",
  };

  // Frequency descriptions for Global
  const frequencyInfoGlobal = {
    1: "Morning crypto alert (8:00 AM UTC)",
    2: "Morning + afternoon crypto (8:00 AM, 2:00 PM UTC)",
    3: "Morning + afternoon + evening crypto (8:00 AM, 2:00 PM, 8:00 PM UTC)",
    4: "Same as 3 alerts (crypto is 24/7, 3 is optimal)",
  };

  // Helpers
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function showStep(step) {
    currentStep = step;
    
    stepDots.forEach(dot => {
      const dotStep = Number(dot.dataset.step);
      dot.classList.remove("step-active", "step-complete");
      if (dotStep === step) dot.classList.add("step-active");
      else if (dotStep < step) dot.classList.add("step-complete");
    });
    
    modalSteps.forEach(section => {
      section.hidden = section.dataset.step !== String(step);
    });
  }

  function showSuccess() {
    modalSteps.forEach(section => {
      section.hidden = section.dataset.step !== "success";
    });
    const stepsEl = modal?.querySelector(".steps");
    if (stepsEl) stepsEl.classList.add("hidden");
  }

  function openModal() {
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    
    // Check if returning from successful Stripe checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get("alerts") === "success") {
      showSuccess();
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      showStep(1);
      const stepsEl = modal?.querySelector(".steps");
      if (stepsEl) stepsEl.classList.remove("hidden");
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function setRegion(value) {
    selectedRegion = value;
    regionControl?.querySelectorAll(".segmented-btn").forEach(btn => {
      btn.classList.toggle("segmented-on", btn.dataset.value === value);
    });
    
    // Update hint text
    if (regionHint) {
      regionHint.textContent = regionInfo[value]?.description || "";
    }
    
    // Update frequency hint based on region
    updateFrequencyHint();
  }

  function setFrequency(value) {
    selectedFrequency = Number(value);
    
    // Cap at 3 for global (crypto-only doesn't need 4)
    if (selectedRegion === "global" && selectedFrequency > 3) {
      selectedFrequency = 3;
    }
    
    frequencyControl?.querySelectorAll(".segmented-btn").forEach(btn => {
      const btnValue = Number(btn.dataset.value);
      btn.classList.toggle("segmented-on", btnValue === selectedFrequency);
      
      // Disable 4th option for global
      if (selectedRegion === "global" && btnValue === 4) {
        btn.style.opacity = "0.4";
        btn.style.pointerEvents = "none";
      } else {
        btn.style.opacity = "";
        btn.style.pointerEvents = "";
      }
    });
    
    updateFrequencyHint();
  }

  function updateFrequencyHint() {
    if (!frequencyHint) return;
    
    const hints = selectedRegion === "americas" ? frequencyInfoAmericas : frequencyInfoGlobal;
    frequencyHint.textContent = hints[selectedFrequency] || "";
  }

  // API
  async function createCheckoutSession(email, region, frequency) {
    const res = await fetch(`${API_BASE}/api/alerts/create-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, region, alertFrequency: frequency }),
    });
    if (!res.ok) throw new Error("Failed to create checkout");
    return res.json();
  }

  async function checkStatus(email) {
    const res = await fetch(`${API_BASE}/api/alerts/status?email=${encodeURIComponent(email)}`);
    if (!res.ok) return { subscribed: false };
    return res.json();
  }

  // Event Handlers
  enableAlertsBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
  });

  document.getElementById("inlineAlertBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
  });
  
  closeModalBtn?.addEventListener("click", closeModal);
  closeSuccessBtn?.addEventListener("click", closeModal);
  
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("is-open")) {
      closeModal();
    }
  });

  // Region selector
  regionControl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (btn) {
      setRegion(btn.dataset.value);
      // Re-apply frequency to handle the 4th option disable
      setFrequency(selectedFrequency);
    }
  });

  // Frequency selector
  frequencyControl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (btn && btn.style.pointerEvents !== "none") {
      setFrequency(btn.dataset.value);
    }
  });

  // Step 1 → Step 2
  toStep2Btn?.addEventListener("click", async () => {
    const email = emailInput?.value?.trim();
    
    if (!email || !isValidEmail(email)) {
      if (emailError) emailError.style.display = "block";
      emailInput?.focus();
      return;
    }
    
    if (emailError) emailError.style.display = "none";
    userEmail = email;
    
    // Check if already subscribed
    try {
      const status = await checkStatus(email);
      if (status.subscribed) {
        alert("You're already subscribed! Check your email for alerts.");
        closeModal();
        return;
      }
    } catch (err) {
      console.warn("Status check failed:", err);
    }
    
    // Update summary
    if (summaryEmail) summaryEmail.textContent = email;
    if (summaryRegion) summaryRegion.textContent = regionInfo[selectedRegion]?.label || selectedRegion;
    if (summaryFrequency) {
      const freq = selectedRegion === "global" && selectedFrequency > 3 ? 3 : selectedFrequency;
      summaryFrequency.textContent = `${freq} alert${freq > 1 ? 's' : ''}/day`;
    }
    
    showStep(2);
  });

  // Back button
  backToStep1Btn?.addEventListener("click", () => showStep(1));

  // Stripe Checkout
  stripeCheckoutBtn?.addEventListener("click", async () => {
    if (!userEmail) {
      showStep(1);
      return;
    }
    
    stripeCheckoutBtn.disabled = true;
    stripeCheckoutBtn.textContent = "Redirecting to Stripe...";
    
    try {
      const freq = selectedRegion === "global" && selectedFrequency > 3 ? 3 : selectedFrequency;
      const { url } = await createCheckoutSession(userEmail, selectedRegion, freq);
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("No checkout URL");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Failed to start checkout. Please try again.");
      stripeCheckoutBtn.disabled = false;
      stripeCheckoutBtn.textContent = "Subscribe with Stripe →";
    }
  });

  // Check URL on page load for success redirect from Stripe
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
  setRegion("americas");
  setFrequency(1);
})();