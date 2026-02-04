/**
 * StockJelli Promo Toast
 * One-time, delayed notification for alert subscriptions
 */

(() => {
    if (window.__STOCKJELLI_PROMO_INIT__) return;
    window.__STOCKJELLI_PROMO_INIT__ = true;
  
    const STORAGE_KEY = "sj_promo_dismissed";
    const DELAY_MS = 12000; // 12 seconds
  
    // Don't show if already dismissed
    if (localStorage.getItem(STORAGE_KEY)) return;
  
    // Don't show if already subscribed (check URL or other indicator)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("alerts") === "success") return;
  
    function createToast() {
      const toast = document.createElement("div");
      toast.id = "promoToast";
      toast.className = "promo-toast";
      toast.innerHTML = `
        <button class="promo-toast-close" id="promoToastClose" aria-label="Close">×</button>
        <div class="promo-toast-icon">📬</div>
        <div class="promo-toast-content">
          <div class="promo-toast-title">Get Momentum Alerts</div>
          <div class="promo-toast-text">4x daily emails when stocks & crypto hit strict momentum criteria. No spam.</div>
        </div>
        <div class="promo-toast-actions">
          <button class="promo-toast-btn promo-toast-btn-primary" id="promoToastCta">$5/mo →</button>
          <button class="promo-toast-btn promo-toast-btn-ghost" id="promoToastDismiss">Maybe Later</button>
        </div>
      `;
      document.body.appendChild(toast);
  
      // Trigger animation after append
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          toast.classList.add("promo-toast-visible");
        });
      });
  
      // Event listeners
      const dismiss = () => {
        localStorage.setItem(STORAGE_KEY, "1");
        toast.classList.remove("promo-toast-visible");
        setTimeout(() => toast.remove(), 300);
      };
  
      const openAlerts = () => {
        dismiss();
        // Trigger the alerts modal
        const alertsBtn = document.getElementById("enableAlertsBtn");
        if (alertsBtn) alertsBtn.click();
      };
  
      document.getElementById("promoToastClose").addEventListener("click", dismiss);
      document.getElementById("promoToastDismiss").addEventListener("click", dismiss);
      document.getElementById("promoToastCta").addEventListener("click", openAlerts);
    }
  
    // Show after delay
    setTimeout(createToast, DELAY_MS);
  })();