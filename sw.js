/**
 * StockJelli Service Worker — Web Push Notifications
 * ===================================================
 *
 * Place this file at the ROOT of your frontend domain:
 *   https://stockjelli.com/sw.js
 *
 * The service worker must be at the root to have scope over the entire site.
 * It handles incoming push events and notification click actions.
 */

/* eslint-env serviceworker */

// ── Push Event — Received notification from server ──
self.addEventListener("push", (event) => {
    if (!event.data) return;
  
    let payload;
    try {
      payload = event.data.json();
    } catch (e) {
      payload = {
        title: "StockJelli",
        body: event.data.text(),
        icon: "https://stockjelli.com/StockJelli-Logo.png",
      };
    }
  
    const options = {
      body: payload.body || "",
      icon: payload.icon || "https://stockjelli.com/StockJelli-Logo.png",
      badge: payload.badge || "https://stockjelli.com/favicon-32x32.png",
      tag: payload.tag || "sj-notification",
      renotify: payload.renotify !== false,
      requireInteraction: payload.requireInteraction || false,
      data: payload.data || {},
      // Vibration pattern: short buzz for momentum alert feel
      vibrate: [100, 50, 100],
      actions: [
        { action: "view", title: "View Chart" },
        { action: "dismiss", title: "Dismiss" },
      ],
    };
  
    event.waitUntil(
      self.registration.showNotification(payload.title || "StockJelli", options)
    );
  });
  
  // ── Notification Click — User tapped the notification ──
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
  
    const action = event.action;
    const data = event.notification.data || {};
  
    // Default: open the chart URL
    let url = data.url || "https://stockjelli.com";
  
    if (action === "dismiss") {
      return; // Just close
    }
  
    // Open or focus the URL
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
        // If a StockJelli tab is already open, focus it and navigate
        self.addEventListener("notificationclick", (event) => {
          event.notification.close();
        
          const action = event.action;
          const data = event.notification.data || {};
        
          let url = data.url || "https://stockjelli.com";
        
          if (action === "dismiss") {
            return;
          }
        
          const isInternal = url.includes("stockjelli.com");
        
          event.waitUntil(
            clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
              // Only reuse existing tab for StockJelli URLs
              if (isInternal) {
                for (const client of windowClients) {
                  if (client.url.includes("stockjelli.com")) {
                    client.navigate(url);
                    return client.focus();
                  }
                }
              }
              // External URLs (Robinhood, Webull, TradingView) always open new window
              return clients.openWindow(url);
            })
          );
        });
        // Otherwise open a new tab
        return clients.openWindow(url);
      })
    );
  });
  
  // ── Install & Activate — Standard service worker lifecycle ──
  self.addEventListener("install", (event) => {
    console.log("[sw] StockJelli service worker installed");
    self.skipWaiting();
  });
  
  self.addEventListener("activate", (event) => {
    console.log("[sw] StockJelli service worker activated");
    event.waitUntil(clients.claim());
  });