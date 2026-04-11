/**
 * StockJelli Push Notification Client
 * ====================================
 *
 * Frontend JavaScript for requesting push notification permission
 * and registering the subscription with the backend.
 *
 * Add this to your existing frontend JS, or load as a separate script.
 *
 * USAGE:
 *   1. Include this script on stockjelli.com
 *   2. Call initPushNotifications() after the user subscribes
 *   3. Or attach to a "Enable Push Notifications" button
 *
 * REQUIREMENTS:
 *   - sw.js must be at https://stockjelli.com/sw.js
 *   - HTTPS required (push doesn't work on HTTP)
 *   - For iOS: user must "Add to Home Screen" first
 */

(() => {
    if (window.__SJ_PUSH_INIT__) return;
    window.__SJ_PUSH_INIT__ = true;
  
    const API_BASE = "https://api.stockjelli.com";
  
    // ── Check browser support ──
    function isPushSupported() {
      return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    }
  
    // ── Get current permission state ──
    function getPushPermission() {
      if (!("Notification" in window)) return "unsupported";
      return Notification.permission; // "default", "granted", "denied"
    }
  
    // ── Register service worker ──
    async function registerServiceWorker() {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service workers not supported");
      }
  
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
  
      // Wait for the service worker to be active
      if (registration.installing) {
        await new Promise((resolve) => {
          registration.installing.addEventListener("statechange", (e) => {
            if (e.target.state === "activated") resolve();
          });
        });
      }
  
      return registration;
    }
  
    // ── Request permission and subscribe ──
    async function subscribeToPush(email) {
      if (!isPushSupported()) {
        return { success: false, error: "Push notifications are not supported in this browser." };
      }
  
      if (!email) {
        return { success: false, error: "Email is required to enable push notifications." };
      }
  
      try {
        // 1. Register service worker
        const registration = await registerServiceWorker();
  
        // 2. Get VAPID public key from server
        const vapidRes = await fetch(`${API_BASE}/api/push/vapid-key`);
        if (!vapidRes.ok) {
          return { success: false, error: "Push notifications are not yet available." };
        }
        const { vapidPublicKey } = await vapidRes.json();
  
        // 3. Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          return {
            success: false,
            error: permission === "denied"
              ? "Notifications were blocked. Please enable them in your browser settings."
              : "Notification permission was not granted.",
          };
        }
  
        // 4. Subscribe to push
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
  
        // 5. Send subscription to backend
        const subJson = subscription.toJSON();
        const res = await fetch(`${API_BASE}/api/push/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            subscription: {
              endpoint: subJson.endpoint,
              keys: {
                p256dh: subJson.keys.p256dh,
                auth: subJson.keys.auth,
              },
            },
          }),
        });
  
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { success: false, error: err.error || "Failed to register push subscription." };
        }
  
        console.log("[push] Subscription registered successfully");
        return { success: true, message: "Push notifications enabled! You'll receive alerts during market hours." };
  
      } catch (err) {
        console.error("[push] Subscription failed:", err);
        return { success: false, error: err.message || "An error occurred enabling push notifications." };
      }
    }
  
    // ── Send test push ──
    async function sendTestPush(email) {
      try {
        const res = await fetch(`${API_BASE}/api/push/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        const data = await res.json();
        return data;
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  
    // ── Unsubscribe ──
    async function unsubscribeFromPush(email) {
      try {
        // Unsubscribe from browser
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
  
        // Remove from backend
        await fetch(`${API_BASE}/api/push/unsubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
  
        return { success: true, message: "Push notifications disabled." };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  
    // ── Check if currently subscribed ──
    async function isPushSubscribed() {
      try {
        if (!isPushSupported()) return false;
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return !!subscription;
      } catch {
        return false;
      }
    }
  
    // ── VAPID key conversion helper ──
    function urlBase64ToUint8Array(base64String) {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }
  
    // ── Expose globally ──
    window.StockJelliPush = {
      isSupported: isPushSupported,
      getPermission: getPushPermission,
      subscribe: subscribeToPush,
      unsubscribe: unsubscribeFromPush,
      isSubscribed: isPushSubscribed,
      sendTest: sendTestPush,
    };
  
    // ── Auto-register service worker on page load (doesn't request permission) ──
    if (isPushSupported()) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  })();