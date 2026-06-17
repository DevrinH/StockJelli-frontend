/**
 * StockJelli — Monitor Sparkline Cards (TQQQ + BTC)
 * =================================================
 * Two daily-trend sparkline cards, 10-day window, shadow-safe (NO regime pill).
 * Matches the concept layout: logo + title + "10-day" sub + big % "since [date]"
 * + stretch-to-fill daily sparkline. Coloring is a soft factual cue by sign
 * (coral if negative, teal if positive) — NOT an alarm-red/green verdict and
 * NOT a regime claim. The regime verdict stays in shadow until validated.
 *
 * USAGE:
 *   1. In the homepage HTML, give each monitor card an inner container:
 *        <div id="sjMonitorTqqq"></div>
 *        <div id="sjMonitorBtc"></div>
 *   2. Include this script. It fetches /api/monitor on load + every 5 min.
 *      The endpoint returns each asset's last-10-point series + pctSinceAnchor.
 */
(() => {
    if (window.__SJ_MONITOR_INIT__) return;
    window.__SJ_MONITOR_INIT__ = true;
  
    const API_BASE = "https://api.stockjelli.com";
    const POLL_MS = 5 * 60 * 1000;
    const WINDOW = 10; // points
  
    function fmtDate(d) {
      if (!d) return "—";
      const [y, m, day] = d.split('-');
      return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  
    function buildSpark(series, w, h, pad) {
      if (!series || series.length === 0) return null;
      if (series.length === 1) series = [series[0], series[0]];
      const prices = series.map(p => p.price);
      const min = Math.min(...prices), max = Math.max(...prices), range = (max - min) || 1, n = series.length;
      const x = i => pad + (i / Math.max(n - 1, 1)) * (w - 2 * pad);
      const y = v => (h - pad) - ((v - min) / range) * (h - 2 * pad);
      let line = '';
      series.forEach((p, i) => { line += (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(p.price).toFixed(1) + ' '; });
      const area = line + `L ${x(n - 1).toFixed(1)} ${h - pad} L ${x(0).toFixed(1)} ${h - pad} Z`;
      return { line: line.trim(), area, lastX: x(n - 1), lastY: y(series[n - 1].price) };
    }
  
    function logoHtml(sym) {
      if (sym === 'BTC') {
        return `<div class="sj-mon-logo" style="background:#f7931a;color:#fff;font-size:18px;border-radius:50%;">\u20bf</div>`;
      }
      return `<div class="sj-mon-logo" style="background:rgba(96,165,250,0.15);color:#60a5fa;font-size:12px;border-radius:9px;letter-spacing:-0.5px;">TQQQ</div>`;
    }
  
    function renderCard(el, d) {
      if (!el) return;
      let series = (d.series || []).slice(-WINDOW);
      if (series.length < 2) { el.innerHTML = ''; return; }
      const pct = ((series[series.length - 1].price - series[0].price) / series[0].price) * 100;
      const anchor = series[0].date;
      const isNeg = pct < 0;
      const stroke = isNeg ? '#f0997b' : '#5dcaa5';
      const W = 360, H = 104, PAD = 10;
      const sp = buildSpark(series, W, H, PAD);
      const gid = 'sjmon_' + d.symbol;
  
      el.innerHTML = `
        <div class="sj-mon-row">
          <div class="sj-mon-head">
            <div class="sj-mon-titlerow">${logoHtml(d.symbol)}<span class="sj-mon-title">${d.title}</span></div>
            <div class="sj-mon-sub">${d.symbol} \u00b7 10-day</div>
          </div>
          <div class="sj-mon-right">
            <div class="sj-mon-pctblock">
              <div class="sj-mon-pct" style="color:${stroke};">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</div>
              <div class="sj-mon-since">since ${fmtDate(anchor)}</div>
            </div>
            <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="sj-mon-svg" role="img" aria-label="${d.symbol} 10-day price trend">
              <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${stroke}" stop-opacity="0.20"/>
                <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
              </linearGradient></defs>
              <path d="${sp.area}" fill="url(#${gid})"/>
              <path d="${sp.line}" fill="none" stroke="${stroke}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>
              <circle cx="${sp.lastX.toFixed(1)}" cy="${sp.lastY.toFixed(1)}" r="4.5" fill="${stroke}"/>
            </svg>
          </div>
        </div>`;
    }
  
    async function refresh() {
      try {
        const r = await fetch(`${API_BASE}/api/monitor`, { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        if (data.tqqq) renderCard(document.getElementById('sjMonitorTqqq'), { ...data.tqqq, symbol: 'TQQQ', title: 'TQQQ Monitor' });
        if (data.btc)  renderCard(document.getElementById('sjMonitorBtc'),  { ...data.btc,  symbol: 'BTC',  title: 'Bitcoin Monitor' });
      } catch (e) { /* best-effort */ }
    }


    function getMode() {
        const m = localStorage.getItem('sj_asset_mode');
        return (m === 'crypto') ? 'crypto' : 'stocks';
      }
    
      function syncToToggle() {
        const mode = getMode();
        const tqqqEl = document.getElementById('sjMonitorTqqq');
        const btcEl  = document.getElementById('sjMonitorBtc');
        if (tqqqEl) tqqqEl.style.display = (mode === 'crypto') ? 'none' : '';
        if (btcEl)  btcEl.style.display  = (mode === 'crypto') ? '' : 'none';
      }
    
      // app.js writes sj_asset_mode synchronously inside applyMode() on every
      // toggle. Same-tab localStorage writes don't fire 'storage' events, so we
      // poll the value (cheap) and re-sync the instant it changes.
      let _lastMode = getMode();
      setInterval(() => {
        const m = getMode();
        if (m !== _lastMode) { _lastMode = m; syncToToggle(); }
      }, 250);
  
      refresh();
      syncToToggle();          // ← add this line
      setInterval(refresh, POLL_MS);




  })();