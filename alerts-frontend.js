/**
 * StockJelli Alerts Modal - Frontend JavaScript
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
    const frequencyControl = document.getElementById("frequencyControl");
    
    const toStep2Btn = document.getElementById("toStep2Btn");
    const backToStep1Btn = document.getElementById("backToStep1Btn");
    const stripeCheckoutBtn = document.getElementById("stripeCheckoutBtn");
    const closeSuccessBtn = document.getElementById("closeSuccessBtn");
    
    const summaryEmail = document.getElementById("summaryEmail");
    const summaryFrequency = document.getElementById("summaryFrequency");
    
    const stepDots = document.querySelectorAll(".step-dot");
    const modalSteps = document.querySelectorAll(".modal-step");
  
    // State
    let currentStep = 1;
    let selectedFrequency = 1;
    let userEmail = "";
  
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
      document.querySelector(".steps")?.classList.add("hidden");
    }
  
    function openModal() {
      if (!modal) return;
      modal.setAttribute("aria-hidden", "false");
      modal.classList.add("modal-open");
      document.body.style.overflow = "hidden";
      
      const params = new URLSearchParams(window.location.search);
      if (params.get("alerts") === "success") {
        showSuccess();
        window.history.replaceState({}, "", window.location.pathname);
      } else {
        showStep(1);
        document.querySelector(".steps")?.classList.remove("hidden");
      }
    }
  
    function closeModal() {
      if (!modal) return;
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("modal-open");
      document.body.style.overflow = "";
    }
  
    function setFrequency(value) {
      selectedFrequency = Number(value);
      frequencyControl?.querySelectorAll(".segmented-btn").forEach(btn => {
        btn.classList.toggle("segmented-on", btn.dataset.value === String(value));
      });
    }
  
    // API
    async function createCheckoutSession(email) {
      const res = await fetch(`${API_BASE}/api/alerts/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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
    enableAlertsBtn?.addEventListener("click", openModal);
    closeModalBtn?.addEventListener("click", closeModal);
    closeSuccessBtn?.addEventListener("click", closeModal);
    
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal?.getAttribute("aria-hidden") === "false") {
        closeModal();
      }
    });
  
    frequencyControl?.addEventListener("click", (e) => {
      const btn = e.target.closest(".segmented-btn");
      if (btn) setFrequency(btn.dataset.value);
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
      
      const status = await checkStatus(email);
      if (status.subscribed) {
        alert("You're already subscribed! Check your email for alerts.");
        closeModal();
        return;
      }
      
      if (summaryEmail) summaryEmail.textContent = email;
      if (summaryFrequency) summaryFrequency.textContent = `${selectedFrequency} alert${selectedFrequency > 1 ? 's' : ''}/day`;
      
      showStep(2);
    });
  
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
        const { url } = await createCheckoutSession(userEmail);
        if (url) {
          window.location.href = url;
        } else {
          throw new Error("No checkout URL");
        }
      } catch (err) {
        alert("Failed to start checkout. Please try again.");
        stripeCheckoutBtn.disabled = false;
        stripeCheckoutBtn.textContent = "Subscribe with Stripe →";
      }
    });
  
    // Check URL on load for success redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("alerts") === "success") {
      setTimeout(() => {
        openModal();
        showSuccess();
        window.history.replaceState({}, "", window.location.pathname);
      }, 500);
    }
  })();