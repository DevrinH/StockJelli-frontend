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
  
  const menuBtn = document.getElementById("menuBtn");
const drawer = document.getElementById("drawer");
const overlay = document.getElementById("drawerOverlay");
const closeBtn = document.getElementById("drawerClose");

function openDrawer(){
  drawer.classList.add("is-open");
  overlay.hidden = false;
  drawer.setAttribute("aria-hidden", "false");
  menuBtn.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
}

function closeDrawer(){
  drawer.classList.remove("is-open");
  overlay.hidden = true;
  drawer.setAttribute("aria-hidden", "true");
  menuBtn.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

menuBtn?.addEventListener("click", () => {
  if (drawer.classList.contains("is-open")) closeDrawer();
  else openDrawer();
});

closeBtn?.addEventListener("click", closeDrawer);
overlay?.addEventListener("click", closeDrawer);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && drawer.classList.contains("is-open")) closeDrawer();
});

// Close drawer when clicking a link
drawer?.addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if (link) closeDrawer();
});
