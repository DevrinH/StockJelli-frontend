/**
 * StockJelli — Broker Link Preference
 * ====================================
 * 
 * Stores user's preferred broker in localStorage.
 * All ticker links route through getBrokerUrl().
 * 
 * Picker renders inline below the hero tagline — visible
 * on the front page without opening any menu.
 * 
 * Supported brokers:
 *   - tradingview (default, preserves affiliate ID)
 *   - robinhood
 *   - webull (requires exchange prefix for stocks)
 */

(() => {
    if (window.__SJ_BROKER_LINK_INIT__) return;
    window.__SJ_BROKER_LINK_INIT__ = true;
  
    const STORAGE_KEY = "sj_broker";
    const TV_AFF_ID = "162729";
  
    // ── Broker URL Builders ──
  
    const BROKERS = {
      tradingview: {
        label: "TradingView",
        icon: "📊",
        stock: (sym) =>
          `https://www.tradingview.com/chart/?symbol=${sym}&aff_id=${TV_AFF_ID}`,
        crypto: (sym) =>
          `https://www.tradingview.com/chart/?symbol=BINANCE:${sym.replace(/USDT?$/i, "")}USDT&aff_id=${TV_AFF_ID}`,
        tooltip: (sym) => `Open ${sym} in TradingView ↗`,
      },
      robinhood: {
        label: "Robinhood",
        icon: "🪶",
        stock: (sym) => `https://robinhood.com/stocks/${sym}`,
        crypto: (sym) =>
          `https://robinhood.com/crypto/${sym.replace(/USDT?$/i, "")}`,
        tooltip: (sym) => `Open ${sym} in Robinhood ↗`,
      },
      webull: {
        label: "Webull",
        icon: "🐂",
        stock: (sym, exchange) => {
          const ex = (exchange || "NASDAQ").toUpperCase();
          return `https://www.webull.com/quote/${ex.toLowerCase()}-${sym.toLowerCase()}`;
        },
        crypto: (sym) =>
          `https://www.webull.com/crypto/${sym.replace(/USDT?$/i, "")}-USD`,
        tooltip: (sym) => `Open ${sym} in Webull ↗`,
      },
    };
  
    // ── Public API ──
  
    function getSelectedBroker() {
      const saved = localStorage.getItem(STORAGE_KEY);
      return BROKERS[saved] ? saved : "tradingview";
    }
  
    function setSelectedBroker(key) {
      if (!BROKERS[key]) return;
      localStorage.setItem(STORAGE_KEY, key);
      window.dispatchEvent(
        new CustomEvent("sj:broker-changed", { detail: { broker: key } })
      );
    }
  
    function getBrokerUrl(symbol, type, exchange) {
      const broker = BROKERS[getSelectedBroker()];
      return type === "crypto"
        ? broker.crypto(symbol)
        : broker.stock(symbol, exchange);
    }
  
    function getBrokerLabel() {
      return BROKERS[getSelectedBroker()].label;
    }
  
    function getBrokerTooltip(symbol) {
      return BROKERS[getSelectedBroker()].tooltip(symbol);
    }
  
    // ── Inline Picker — below hero-compact ──
  
    function initBrokerPicker() {
      const hero = document.querySelector(".hero-compact .container .hero-compact-inner");
      if (!hero) return;
  
      const bar = document.createElement("div");
      bar.className = "broker-bar";
      bar.innerHTML = `
        <span class="broker-bar-label">Open tickers in</span>
        <div class="broker-bar-options" id="brokerPickerOptions">
          <button class="broker-chip" data-broker="tradingview" type="button">
            <span class="broker-chip-icon">📊</span>
            <span class="broker-chip-name">TradingView</span>
          </button>
          <button class="broker-chip" data-broker="robinhood" type="button">
            <span class="broker-chip-icon">🪶</span>
            <span class="broker-chip-name">Robinhood</span>
          </button>
          <button class="broker-chip" data-broker="webull" type="button">
            <span class="broker-chip-icon">🐂</span>
            <span class="broker-chip-name">Webull</span>
          </button>
        </div>
      `;
  
      hero.appendChild(bar);
      updatePickerUI();
  
      document.getElementById("brokerPickerOptions")?.addEventListener("click", (e) => {
        const btn = e.target.closest(".broker-chip");
        if (!btn) return;
        setSelectedBroker(btn.dataset.broker);
        updatePickerUI();
      });
    }
  
    function updatePickerUI() {
      const current = getSelectedBroker();
      document.querySelectorAll(".broker-chip").forEach((btn) => {
        btn.classList.toggle("broker-chip-active", btn.dataset.broker === current);
      });
    }
  
    window.addEventListener("sj:broker-changed", updatePickerUI);
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initBrokerPicker);
    } else {
      initBrokerPicker();
    }
  
    // ── Expose globally ──
    window.getBrokerUrl = getBrokerUrl;
    window.getBrokerLabel = getBrokerLabel;
    window.getBrokerTooltip = getBrokerTooltip;
    window.getSelectedBroker = getSelectedBroker;
    window.setSelectedBroker = setSelectedBroker;
  })();