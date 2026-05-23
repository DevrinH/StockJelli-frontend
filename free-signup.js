(() => {
    if (window.__STOCKJELLI_FREE_SIGNUP_INIT__) return;
    window.__STOCKJELLI_FREE_SIGNUP_INIT__ = true;
  
    const API_BASE = "https://api.stockjelli.com";
  
    const modal = document.getElementById("freeSignupModal");
    const closeBtn = document.getElementById("closeFreeSignupBtn");
    const emailInput = document.getElementById("freeSignupEmail");
    const submitBtn = document.getElementById("freeSignupSubmitBtn");
    const errorEl = document.getElementById("freeSignupError");
    const successStep = document.getElementById("freeSignupSuccess");
    const formStep = document.getElementById("freeSignupForm");
    const doneBtn = document.getElementById("freeSignupDoneBtn");
  
    function openModal() {
      if (!modal) return;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      if (formStep) formStep.style.display = "";
      if (successStep) successStep.style.display = "none";
      if (errorEl) errorEl.style.display = "none";
      if (emailInput) emailInput.value = "";
      setTimeout(() => emailInput?.focus(), 100);
    }
  
    function closeModal() {
      if (!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  
    closeBtn?.addEventListener("click", closeModal);
    modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal?.classList.contains("is-open")) closeModal();
    });
    doneBtn?.addEventListener("click", closeModal);
  
    // Open triggers — any element with data-free-signup attribute
    document.querySelectorAll("[data-free-signup]").forEach(btn => {
      btn.addEventListener("click", (e) => { e.preventDefault(); openModal(); });
    });
  
    async function handleSubmit() {
      const email = (emailInput?.value || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError("Please enter a valid email address.");
        return;
      }
      if (errorEl) errorEl.style.display = "none";
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Signing up..."; }
  
      try {
        const res = await fetch(`${API_BASE}/api/free-signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
  
        if (!res.ok) { showError(data.message || "Something went wrong. Please try again."); return; }
        if (data.alreadyPaid) { showError(`You already have an active ${data.plan} subscription! No need for the free plan.`); return; }
  
        if (formStep) formStep.style.display = "none";
        if (successStep) successStep.style.display = "";
  
        localStorage.setItem("sj_subscriber_email", email);
        document.body.classList.add("sj-subscriber");
        const headerBtn = document.getElementById("headerLoginBtn");
        if (headerBtn) headerBtn.textContent = "Account";
  
        if (window.gtag) gtag("event", "free_signup", { method: "email", plan: "free" });
      } catch (err) {
        console.error("[free-signup] Error:", err);
        showError("Network error. Please check your connection and try again.");
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Get Free Alerts →"; }
      }
    }
  
    function showError(msg) {
      if (!errorEl) return;
      errorEl.textContent = msg;
      errorEl.style.display = "block";
    }
  
    submitBtn?.addEventListener("click", handleSubmit);
    emailInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") handleSubmit(); });
  
    // Handle ?upgrade=true from free alert emails
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgrade") === "true") {
      setTimeout(() => {
        const alertsBtn = document.getElementById("inlineAlertBtn") || document.getElementById("enableAlertsBtn");
        if (alertsBtn) alertsBtn.click();
      }, 500);
    }
    if (params.get("unsubscribed") === "true") {
      setTimeout(() => alert("You've been unsubscribed from free alerts. You can re-subscribe anytime."), 300);
    }
  
    // Wire "See plans" button in free modal to paid modal
    document.getElementById("freeToPayedBtn")?.addEventListener("click", () => {
      closeModal();
      setTimeout(() => {
        const alertsBtn = document.getElementById("inlineAlertBtn") || document.getElementById("enableAlertsBtn");
        if (alertsBtn) alertsBtn.click();
      }, 200);
    });
    document.getElementById("successUpgradeLink")?.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
      setTimeout(() => {
        const alertsBtn = document.getElementById("inlineAlertBtn") || document.getElementById("enableAlertsBtn");
        if (alertsBtn) alertsBtn.click();
      }, 200);
    });
  })();