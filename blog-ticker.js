/* ============================================
   blog-ticker.js — Pulse ticker for blog pages
   Drop this in your frontend root alongside style.css
   Include in blog pages: <script src="/blog-ticker.js" defer></script>
   ============================================ */

   (function initBlogTicker() {
    // Measure header for sticky offset
    const header = document.querySelector(".header");
    if (header) {
      function measure() {
        document.documentElement.style.setProperty("--header-h", header.getBoundingClientRect().height + "px");
      }
      measure();
      window.addEventListener("resize", measure);
      if (document.fonts?.ready) document.fonts.ready.then(measure);
    }
  
    const ticker = document.getElementById("pulseTicker");
    const track = document.getElementById("pulseTickerTrack");
    if (!ticker || !track) return;
  
    function fmtPct(n) {
      if (n == null) return "—";
      return `${n > 0 ? "+" : ""}${Number(n).toFixed(1)}%`;
    }
  
    function isUSMarketOpen() {
      const now = new Date();
      const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
      const day = et.getDay();
      const h = et.getHours(), m = et.getMinutes();
      const mins = h * 60 + m;
      return day >= 1 && day <= 5 && mins >= 570 && mins < 960;
    }
  
    function buildPulseSummary(stocks, crypto, isMarketOpen) {
      const allStocks = (stocks || []).filter(r => r.pctChange > 0).sort((a, b) => b.pctChange - a.pctChange);
      const allCrypto = (crypto || []).filter(r => r.pctChange > 0).sort((a, b) => b.pctChange - a.pctChange);
      const totalMovers = allStocks.length + allCrypto.length;
  
      if (totalMovers === 0) {
        return isMarketOpen ? "Scanning for momentum…" : "Markets closed · Watching crypto";
      }
  
      const allMovers = [
        ...allStocks.map(r => ({ sym: r.symbol, pct: r.pctChange })),
        ...allCrypto.map(r => ({ sym: r.coinSymbol || r.symbol, pct: r.pctChange })),
      ].sort((a, b) => b.pct - a.pct);
  
      const leader = allMovers[0];
      const parts = [];
      if (!isMarketOpen) parts.push("Market closed");
  
      if (allStocks.length > 0 && allCrypto.length > 0) {
        parts.push(`${allStocks.length} stocks & ${allCrypto.length} crypto moving, led by ${leader.sym} (${fmtPct(leader.pct)})`);
      } else if (allStocks.length > 0) {
        parts.push(`${allStocks.length} stocks moving, led by ${leader.sym} (${fmtPct(leader.pct)})`);
      } else {
        parts.push(`${allCrypto.length} crypto still moving, led by ${leader.sym} (${fmtPct(leader.pct)})`);
      }
      return parts.join(" · ");
    }
  
    function buildItems(stocks, crypto, isMarketOpen) {
      const items = [];
      const summary = buildPulseSummary(stocks, crypto, isMarketOpen);
      items.push(`<span class="ticker-pulse-text"><span class="ticker-pulse-dot"></span>${summary}</span>`);
      items.push(`<span class="ticker-separator"></span>`);
  
      const medals = ["🥇", "🥈", "🥉"];
      const topS = (stocks || []).filter(r => r.pctChange > 0).sort((a, b) => b.pctChange - a.pctChange).slice(0, 8);
      for (let i = 0; i < topS.length; i++) {
        const s = topS[i];
        const medal = i < 3 ? `<span class="ticker-medal">${medals[i]}</span> ` : "";
        items.push(`<span class="ticker-item">${medal}<span class="ticker-item-symbol">${s.symbol}</span> <span class="ticker-item-pct up">${fmtPct(s.pctChange)}</span></span>`);
      }
  
      if (topS.length > 0 && crypto?.length > 0) items.push(`<span class="ticker-separator"></span>`);
  
      const topC = (crypto || []).filter(r => r.pctChange > 0).sort((a, b) => b.pctChange - a.pctChange).slice(0, 8);
      for (let i = 0; i < topC.length; i++) {
        const c = topC[i];
        const medal = i < 3 ? `<span class="ticker-medal">${medals[i]}</span> ` : "";
        items.push(`<span class="ticker-item">${medal}<span class="ticker-item-symbol">${c.coinSymbol || c.symbol}</span> <span class="ticker-item-pct up">${fmtPct(c.pctChange)}</span></span>`);
      }
      return items;
    }
  
    async function fetchTicker() {
      try {
        const [s, c] = await Promise.all([
          fetch("https://api.stockjelli.com/api/stocks?limit=20&mcapMin=100000000", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch("https://api.stockjelli.com/api/crypto?limit=20&mcapMin=50000000", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
  
        // Update header indices if present
        const idxLeftVal = document.getElementById("idxLeftValue");
        const idxRightVal = document.getElementById("idxRightValue");
        if (s?.header) {
          if (idxLeftVal && s.header.left?.pct != null) {
            const pct = s.header.left.pct;
            idxLeftVal.textContent = `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
            idxLeftVal.className = `idx-value ${pct >= 0 ? "up" : "down"}`;
          }
          if (idxRightVal && s.header.right?.pct != null) {
            const pct = s.header.right.pct;
            idxRightVal.textContent = `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
            idxRightVal.className = `idx-value ${pct >= 0 ? "up" : "down"}`;
          }
        }
  
        const items = buildItems(s?.rows, c?.rows, isUSMarketOpen());
        if (items.length <= 2) {
          items.push(`<span class="ticker-pulse-text"><span class="ticker-pulse-dot"></span>Scanning for momentum…</span>`);
        }
        const onePass = items.join("");
  
        const viewW = window.innerWidth || 1920;
        track.innerHTML = onePass;
        const contentW = track.scrollWidth || viewW;
        const repeats = Math.max(3, Math.ceil((viewW * 2.5) / contentW));
        track.innerHTML = onePass.repeat(repeats);
  
        ticker.style.display = "";
        requestAnimationFrame(() => {
          const onePassEl = document.createElement("div");
          onePassEl.style.cssText = "display:inline-flex;visibility:hidden;position:absolute";
          onePassEl.innerHTML = onePass;
          track.parentNode.appendChild(onePassEl);
          const onePassW = onePassEl.scrollWidth;
          onePassEl.remove();
  
          track.style.setProperty("--ticker-scroll", `-${onePassW}px`);
          const dur = Math.max(12, onePassW / 45);
          track.style.animationDuration = `${dur}s`;
          track.style.animationName = "tickerScroll";
          track.style.animationTimingFunction = "linear";
          track.style.animationIterationCount = "infinite";
        });
      } catch (e) {
        console.warn("[blog-ticker] Fetch failed:", e.message);
      }
    }
  
    fetchTicker();
    setInterval(fetchTicker, 60_000);
  })();