// =============================================================================
//  CLIENT-SIDE PATCH for the SJ Admin dashboard HTML
// =============================================================================
//
//  GOAL: stop shipping the secret in the page. The browser no longer KNOWS the
//  real key — it just holds whatever the user typed and forwards it to the
//  server, which is the thing that validates. If the user typed the wrong key,
//  the SERVER rejects the data request (401), and we show the auth gate again.
//
//  This is a drop-in replacement for the auth + fetch logic in the existing
//  dashboard <script>. Changes are marked. The key idea: there is no
//  ADMIN_KEY constant in the client anymore, and every fetch to a protected
//  endpoint includes the  x-sj-admin-key  header.
// =============================================================================

// ── 1. REMOVE this line entirely from the top of the IIFE: ──
//      const ADMIN_KEY = 'sjadmin2026';     <-- DELETE
//
//   Replace the auth-handling block with the version below.

// ----------------------------------------------------------------------------
//  AUTH: hold the key the user typed, validate it against the SERVER, not
//  against a hardcoded constant.
// ----------------------------------------------------------------------------
let adminKey = sessionStorage.getItem('sj_admin_key') || null;
// NOTE: sessionStorage (cleared when the tab closes) is a better default than
// localStorage for a credential. Use localStorage only if you want it to
// persist across sessions and accept the tradeoff.

const API = 'https://api.stockjelli.com';

// Central authed fetch — every protected call goes through this so the header
// is never forgotten.
async function authedFetch(path) {
  const res = await fetch(`${API}${path}`, {
    headers: adminKey ? { 'x-sj-admin-key': adminKey } : {},
  });
  if (res.status === 401 || res.status === 503) {
    // Key was wrong / missing / server not configured -> bounce to gate.
    adminKey = null;
    sessionStorage.removeItem('sj_admin_key');
    showAuthGate('Session expired or key invalid — re-enter admin key');
    throw new Error('unauthorized');
  }
  return res;
}

// Validate by actually hitting a cheap protected endpoint. If it 200s, the
// key is good; the server — not the client — made that decision.
async function tryAuth() {
  const k = document.getElementById('authKey').value.trim();
  if (!k) return;
  try {
    const res = await fetch(`${API}/api/weekly-report/weeks`, {
      headers: { 'x-sj-admin-key': k },
    });
    if (res.ok) {
      adminKey = k;
      sessionStorage.setItem('sj_admin_key', k);
      showDashboard();
    } else {
      document.getElementById('authError').style.display = 'block';
    }
  } catch (e) {
    document.getElementById('authError').style.display = 'block';
  }
}

function showAuthGate(msg) {
  document.getElementById('dashboard').classList.remove('visible');
  const gate = document.getElementById('authGate');
  gate.style.display = 'flex';
  if (msg) {
    const err = document.getElementById('authError');
    err.textContent = msg;
    err.style.display = 'block';
  }
}

// On load: if we have a saved key, verify it with the server before showing
// the dashboard (don't trust a stored key blindly).
(async function initAuth() {
  const urlKey = new URLSearchParams(window.location.search).get('key');
  const candidate = urlKey || adminKey;
  if (!candidate) return; // show gate, wait for input
  try {
    const res = await fetch(`${API}/api/weekly-report/weeks`, {
      headers: { 'x-sj-admin-key': candidate },
    });
    if (res.ok) {
      adminKey = candidate;
      sessionStorage.setItem('sj_admin_key', candidate);
      // Strip the key from the URL bar if it was passed as ?key=
      if (urlKey) history.replaceState({}, '', window.location.pathname);
      showDashboard();
    }
  } catch (e) { /* fall through to gate */ }
})();

// ----------------------------------------------------------------------------
//  2. EVERY existing  fetch(`${API}/api/...`)  CALL must become authedFetch.
//     Find/replace pattern across the file:
//
//        fetch(`${API}/api/weekly-report/weeks`)
//     -> authedFetch('/api/weekly-report/weeks')
//
//        fetch(`${API}/api/weekly-report?week=${currentWeek||''}`)
//     -> authedFetch(`/api/weekly-report?week=${currentWeek||''}`)
//
//        fetch(`${API}/api/notification-log?limit=500`)
//     -> authedFetch('/api/notification-log?limit=500')
//
//     This affects loadWeeks(), loadReport(), the leveraged panel
//     (fetchLeveragedData), the swing panel (fetchSwingData), the BTC regime
//     panel (fetchBrData), and the notif chart (fetchNotifData). All of them
//     currently call fetch(`${API}...`) directly — route them through
//     authedFetch so the header is always attached and 401s bounce to the gate.
// ----------------------------------------------------------------------------

// Example — the weeks loader becomes:
//
//   async function loadWeeks() {
//     try {
//       const res = await authedFetch('/api/weekly-report/weeks');
//       const data = await res.json();
//       ...
//     } catch (e) { /* authedFetch already handled 401 by showing the gate */ }
//   }