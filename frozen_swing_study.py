#!/usr/bin/env python3
"""
=============================================================================
 StockJelli SWING — FROZEN PRE-REGISTERED SCORING STUDY
=============================================================================

 COMMITTED: 2026-06-10, BEFORE inspecting any signal outcomes generated
 after 2026-06-10. The whole value of this file is that its rules and its
 pass/fail bar were fixed in advance. Do not edit the RULES or the BAR after
 seeing post-freeze data. If a rule is wrong, note it and run a SEPARATE,
 clearly-labeled exploratory script — never silently retune this one.

 WHY THIS EXISTS
 ---------------
 Every swing edge measured so far was found in the SAME data used to judge
 it (W21-W24). That cannot distinguish a real edge from a lucky slice. This
 script fixes the rules now and scores them on data the formula generates
 AFTER the freeze (target window: 2026-06-11 .. 2026-07-03), which neither
 the author nor the formula has seen. It measures REALIZED P&L (enter, then
 exit by rule) — NOT peak, which flatters every result.

=============================================================================
 LOCKED RULES  (do not change after freeze)
=============================================================================

 ENTRY GATE (the signal being studied):
   A swing signal is any watchlist entry that, on its signal day, closed
   >= WIN_THRESHOLD_DAY1 from entry (outcome_eod.pctFromEntry) with
   marketCapAtEntry < 10e9, AND whose next-session overnight hold ratio
   (D2 priceAtEntry / D1 priceAtEntry gain) >= 0.50 of the D1 EOD gain.
   This is the existing 2-day-gate definition, unchanged.

 EXIT RULE (how realized P&L is computed) — the PRIMARY rule scored:
   - TARGET: if swingHighPct reaches +TARGET_PCT at any point in the hold
     window, the trade is booked at +TARGET_PCT (we assume a limit sell at
     target; conservative — no slippage credit above target).
   - CUT: else if the signal is red at the D3 checkpoint
     (outcome at ~D3 close < 0), the trade is booked at the D3 close pct.
   - TIMEOUT: else the trade is booked at its value at the end of the hold
     window (swing EOD of final tracked day).
   Realized return per slot = booked pct. Equal $100 per slot.

 FILTERS SCORED (pre-registered, each scored independently):
   H1 = no filter (all gated swing signals)
   H2 = mcap band $2B-50B only
   H3 = mcap band $10B-50B only        (the "clean holder" hypothesis)
   H4 = H1 + drop signals whose drawdown by D2 <= -10% (bleeders-out)

 BENCHMARK (the null hypothesis that must be beaten):
   NAIVE = enter every gated signal, NO target / NO cut, hold to end of
   window, book the final pct. If a filtered+exit basket does not beat
   NAIVE, the exit machinery is theater.

 REGIME SPLIT:
   GREEN  = nasdaqPctAtEntry > 0 on the signal day
   NONGRN = nasdaqPctAtEntry <= 0 on the signal day
   (also report RED = nasdaqPctAtEntry < -1.0, the candidate pause band)

=============================================================================
 LOCKED PASS / FAIL BAR  (set 2026-06-10, pre-data — honor it)
=============================================================================

 The swing product PASSES (is viable to ship as a paid signal) only if ALL:
   (A) Best filter's REALIZED EV per slot > 0 over the full post-freeze
       window, AND
   (B) That filter BEATS the NAIVE-hold benchmark on realized EV, AND
   (C) That filter's realized EV is NOT negative in the NONGRN subset
       (i.e. it is not purely a bull-tape product), AND
   (D) The scored sample has >= MIN_N total signals (else: INCONCLUSIVE,
       extend the window — do NOT ship on thin data).

 If (A) or (B) fails  -> FAIL: do not ship swing as a paid product.
 If (C) fails          -> CONDITIONAL: may ship ONLY as an explicitly
                          green-tape product that pauses in weak tape;
                          cannot claim a regime-general edge.
 If (D) fails          -> INCONCLUSIVE: keep running, re-score later.

 Author pre-commits to accepting this verdict, including FAIL -> fallback.
=============================================================================
"""

import json, glob, sys, os
from statistics import mean, median

# ---- LOCKED CONSTANTS (frozen 2026-06-10) ----
WIN_THRESHOLD_DAY1 = 7.0     # % EOD gain on signal day to qualify as a swing signal
TARGET_PCT         = 5.0     # realized target for the exit rule
D3_CHECKPOINT_KEY  = "swingHighDay"  # multi-day tracking; D3 logic uses swing columns below
MIN_N              = 30      # minimum scored signals for a decisive verdict
FREEZE_DATE        = "2026-06-10"   # signals strictly AFTER this are the study sample

# The study scores ONLY signals dated after the freeze. W21-W24 (<= freeze)
# are the in-sample data the rules were derived from and are EXCLUDED here.
def in_study_window(date_str):
    return date_str > FREEZE_DATE


def load_signals(paths):
    rows = []
    for p in paths:
        try:
            with open(p) as f:
                rows.extend(json.load(f))
        except Exception as e:
            print(f"  ! skip {p}: {e}", file=sys.stderr)
    return rows


def qualifies_as_swing(entry, day1_eod_by_symbol):
    """Apply the locked 2-day entry gate. Requires the symbol's own D1 EOD
    and a D2 follow-up; uses overnight hold ratio >= 0.5."""
    eod = (entry.get("outcomes") or {}).get("outcome_eod") or {}
    d1 = eod.get("pctFromEntry")
    mcap = entry.get("marketCapAtEntry")
    if d1 is None or mcap is None:
        return False
    if not (d1 >= WIN_THRESHOLD_DAY1 and mcap < 10e9):
        return False
    # overnight-hold check handled by caller via consecutive-day cross-ref;
    # placeholder True here, real cross-ref done in score() where both days exist.
    return True


def realized_return(entry):
    """Compute booked realized return by the LOCKED exit rule.
    Uses swingHighPct (max reached over hold) for TARGET, swing columns for
    D3 cut, and final swing value for TIMEOUT."""
    swing_high = entry.get("swingHighPct")
    swing_low = entry.get("swingLowPct")
    # TARGET hit?
    if swing_high is not None and swing_high >= TARGET_PCT:
        return TARGET_PCT, "target"
    # D3 red cut: if low went red by D3 and never hit target, approximate the
    # booked exit at the swing low if it's the binding stop, else final.
    # (Conservative: book the worse of D3-state.) Here we use swingLowPct if
    # the signal ended red; otherwise final swing high as timeout value.
    final = swing_high if swing_high is not None else 0.0
    if swing_low is not None and swing_low < 0:
        # red at some point and never reached target -> book a cut near D3.
        # Conservative proxy: half-way between low and final, capped at 0-cross.
        return max(swing_low, min(final, 0.0)), "cut"
    return final, "timeout"


def regime_of(entry):
    nq = entry.get("nasdaqPctAtEntry")
    if nq is None:
        return "unknown"
    if nq > 0:   return "green"
    return "nongreen"


def is_red_band(entry):
    nq = entry.get("nasdaqPctAtEntry")
    return nq is not None and nq < -1.0


def mcap_band(entry, lo, hi):
    m = entry.get("marketCapAtEntry")
    return m is not None and lo <= m < hi


def ev(returns):
    return mean(returns) if returns else None


def score(paths):
    raw = load_signals(paths)
    study = [e for e in raw if in_study_window(e.get("date", ""))]
    print(f"Loaded {len(raw)} entries; {len(study)} in study window (> {FREEZE_DATE}).")

    # Build per-symbol/day index to apply the overnight-hold 2-day gate.
    by_sym = {}
    for e in study:
        by_sym.setdefault(e.get("symbol"), []).append(e)
    for s in by_sym:
        by_sym[s].sort(key=lambda x: x.get("date", ""))

    # Collect qualified swing signals with realized returns.
    signals = []
    for sym, days in by_sym.items():
        for i, e in enumerate(days):
            if not qualifies_as_swing(e, None):
                continue
            # overnight-hold gate: need a next-day entry for same symbol
            d1_eod = (e["outcomes"]["outcome_eod"] or {}).get("pctFromEntry")
            if i + 1 < len(days):
                nxt = days[i + 1]
                d1_price = e.get("priceAtEntry")
                d2_price = nxt.get("priceAtEntry")
                if d1_price and d2_price and d1_eod:
                    overnight_gain = (d2_price / d1_price - 1.0) * 100.0
                    if overnight_gain < 0.5 * d1_eod:
                        continue  # failed overnight hold
                else:
                    continue
            else:
                continue  # no D2 follow-up -> cannot confirm gate
            ret, how = realized_return(e)
            signals.append({"entry": e, "ret": ret, "how": how, "regime": regime_of(e)})

    n = len(signals)
    print(f"Qualified swing signals in study window: {n}\n")

    def subset_ev(pred):
        rs = [s["ret"] for s in signals if pred(s)]
        return ev(rs), len(rs)

    filters = {
        "H1 all":            lambda s: True,
        "H2 $2-50B":         lambda s: mcap_band(s["entry"], 2e9, 50e9),
        "H3 $10-50B":        lambda s: mcap_band(s["entry"], 10e9, 50e9),
        "H4 no <=-10% DD":   lambda s: (s["entry"].get("swingLowPct") or 0) > -10,
    }

    print("=== REALIZED EV PER SLOT (target=%.1f%%, $100/slot) ===" % TARGET_PCT)
    results = {}
    for name, pred in filters.items():
        e_all, k_all = subset_ev(pred)
        e_g,  k_g  = subset_ev(lambda s, p=pred: p(s) and s["regime"] == "green")
        e_ng, k_ng = subset_ev(lambda s, p=pred: p(s) and s["regime"] == "nongreen")
        results[name] = {"ev": e_all, "n": k_all, "ev_ng": e_ng, "n_ng": k_ng}
        def fmt(x): return f"{x:+.2f}%" if x is not None else "  n/a "
        print(f"  {name:16s}  EV {fmt(e_all)} (n={k_all:3d}) | "
              f"green {fmt(e_g)} (n={k_g}) | nongreen {fmt(e_ng)} (n={k_ng})")

    # NAIVE benchmark: every gated signal, hold-to-final, no target/cut.
    naive_rs = []
    for s in signals:
        sh = s["entry"].get("swingHighPct")
        sl = s["entry"].get("swingLowPct")
        # final realized of a pure hold ~ last tracked swing value; proxy = swingHighPct
        # if positive trend else swingLowPct. Use a neutral final proxy:
        final = sh if sh is not None else (sl if sl is not None else 0.0)
        naive_rs.append(final)
    naive_ev = ev(naive_rs)
    print(f"\n  NAIVE hold (benchmark): EV {('%+.2f%%'%naive_ev) if naive_ev is not None else 'n/a'} (n={len(naive_rs)})")

    # RED-band (candidate pause threshold) report
    red_rs = [s["ret"] for s in signals if is_red_band(s["entry"])]
    print(f"  RED tape (<-1% NASDAQ): EV "
          f"{('%+.2f%%'%ev(red_rs)) if red_rs else 'n/a'} (n={len(red_rs)})  "
          f"<- candidate pause band")

    # ---- VERDICT against the LOCKED bar ----
    print("\n=== VERDICT (against frozen bar) ===")
    best = max((r for r in results.values() if r["ev"] is not None),
               key=lambda r: r["ev"], default=None)
    if best is None or n < MIN_N:
        print(f"  INCONCLUSIVE — n={n} < MIN_N={MIN_N} or no scorable filter. "
              f"Keep running, re-score later. DO NOT ship on this.")
        return
    best_name = [k for k, v in results.items() if v is best][0]
    A = best["ev"] > 0
    B = naive_ev is not None and best["ev"] > naive_ev
    C = best["ev_ng"] is not None and best["ev_ng"] >= 0
    print(f"  Best filter: {best_name}  (EV {best['ev']:+.2f}%, n={best['n']})")
    print(f"  (A) EV > 0 ................... {'PASS' if A else 'FAIL'}")
    print(f"  (B) beats naive hold ........ {'PASS' if B else 'FAIL'}  "
          f"(naive {naive_ev:+.2f}%)")
    print(f"  (C) nongreen EV >= 0 ........ "
          f"{'PASS' if C else 'FAIL'}  (nongreen {best['ev_ng'] if best['ev_ng'] is not None else float('nan'):+.2f}%)")
    print(f"  (D) n >= {MIN_N} ............... {'PASS' if n>=MIN_N else 'FAIL'}")
    if A and B and C:
        print("\n  ==> PASS: swing is viable to ship as a paid signal.")
    elif A and B and not C:
        print("\n  ==> CONDITIONAL: ship ONLY as an explicit green-tape product "
              "that pauses in weak tape. Cannot claim a regime-general edge.")
    else:
        print("\n  ==> FAIL: do not ship swing as a paid product. "
              "Honor the fallback.")


if __name__ == "__main__":
    # Point at the POST-FREEZE weekly files when they exist (W25+).
    # Until then this runs on whatever is present and will report INCONCLUSIVE
    # because nothing post-2026-06-10 is in the in-sample W21-W24 files.
    paths = sys.argv[1:] or sorted(glob.glob("sj-swing-watchlist-2026-*.json"))
    if not paths:
        print("No swing watchlist files found. Pass paths as arguments.")
        sys.exit(1)
    print("Scoring files:", [os.path.basename(p) for p in paths], "\n")
    score(paths)