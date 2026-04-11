# Hybrid DCA Dispatcher — Context File

This file explains the full setup for Claude or any other reader picking up this project mid-session.

---

## What This Bot Does

The Hybrid Dispatcher replaces both the standalone `BTC-DCA-BOT` and `ATH-DCA-BOT`. Every Monday at 09:00 it fetches live market data, routes to the correct buying strategy, places a market order on Binance, logs the buy, and sends an email summary.

**Routing logic:**
- If BTC is ≥ 15% below the 5-year rolling ATH → **ATH mode**
- If BTC is < 15% below the 5-year rolling ATH → **MA mode**

Both modes share a **retained weeks counter** (`retained.json`). The counter resets to 0 after any successful buy from either mode. If no buy happens (no MA trigger, or ATH mode not active), retained increments by 1. Retained capital is deployed in the next successful buy.

---

## ATH Mode

**When:** BTC dip from 5yr rolling ATH ≥ 15%

**5yr rolling ATH:** Max daily high across the last 1,825 candles. Currently computes from live Binance data on every run.

**Buy size formula:**
```
ratio     = min((dip - 0.15) / (1.0 - 0.15), 1.0)
pow_ratio = ratio ^ 2.1          # power curve: slow at moderate dips, aggressive at crashes
base_buy  = $25 + pow_ratio × ($1000 - $25)
cap_ret   = min(retained_weeks, 5)          # ATH mode caps at 5 retained weeks
total_buy = base_buy × (1 + cap_ret × 0.5) # each retained week adds 0.5× of base
```

**Reference buy sizes at current market:**
- -15% from ATH: ~$25
- -30% from ATH: ~$50–60
- -50% from ATH: ~$180
- -70% from ATH: ~$500
- -90% from ATH: ~$975

**Logs to:** `ATH-DCA-BOT/buy_log.json`  
**Buy log fields:** timestamp, btc_bought, price, usdt_spent, rolling_ath, dip_pct, pow_ratio, buy_amount, base_buy, retained_weeks, note

---

## MA Mode

**When:** BTC dip < 15% from 5yr rolling ATH (near ATH, bull market phase)

**Tier logic** (first match wins, checked in order):
| Tier | Condition | Multiplier |
|------|-----------|-----------|
| 7d MA | price < 7d MA | 1× |
| 30d MA | price < 30d MA (but ≥ 7d MA) | 2× |
| 100d MA | price < 100d MA | 3× |
| 200d MA | price < 200d MA | 4.5× |

**Buy size formula:**
```
total_buy = $25 × multiplier × (retained_weeks + 1)
```
No cap on retained weeks in MA mode.

**No trigger:** If price is above all 4 MAs, no buy. retained += 1. Email sent.

**Logs to:** `BTC-DCA-BOT/buy_log.json`  
**Buy log fields:** timestamp, btc_bought, price, usdt_spent, units_requested, trigger, retainedWeeksIncluded, multiplier, formula, note

---

## Retry Logic

If a buy fails due to insufficient USDT balance:

1. **09:00** — `dispatcher.py` runs, detects insufficient balance, saves `retry.json`, sends email "retry in 4h"
2. **13:00** — `retry_dispatcher.py` runs, re-fetches all market data from scratch, attempts buy again
   - Success → buy placed, retained reset, `retry.json` deleted
   - Still insufficient → updates `retry.json` (attempts_made = 1), sends email "final retry at 17:00"
3. **17:00** — `retry_dispatcher.py` runs again (final attempt)
   - Success → buy placed, retained reset, `retry.json` deleted
   - Still insufficient → retained += 1, `retry.json` deleted, sends final failure email

**Important:** Each retry re-fetches live market data and recalculates everything fresh. The buy size and even the mode (ATH vs MA) can change between attempts.

**Special case:** If the retry runs in MA mode but BTC is now above all MAs (no longer in buy zone), `retry.json` is deleted without incrementing retained (the signal expired cleanly).

---

## Files in This Folder

| File | Purpose |
|------|---------|
| `dispatcher.py` | Main weekly script — routes, buys, logs |
| `retry_dispatcher.py` | Retry script — runs at 13:00 and 17:00 on Mondays |
| `retained.json` | Shared retained weeks counter `{"skipped_weeks": N}` |
| `retry.json` | Temporary flag when a buy failed due to insufficient balance `{"attempts_made": N, "created_at": "..."}` |
| `sunday_check.py` | Read-only pre-check — runs Sunday 09:00, emails balance status + estimated buy with 10% buffer |
| `hybrid.log` | All stdout/stderr from cron runs |
| `CONTEXT.md` | This file |

---

## Related Folders

| Folder | Role |
|--------|------|
| `BTC-DCA-BOT/` | Source of `.env` credentials + MA mode buy log (`buy_log.json`) |
| `ATH-DCA-BOT/` | ATH mode buy log (`buy_log.json`). Standalone `ath_dca.py` still exists but is NOT in crontab — hybrid replaced it |
| `BTC-Crash-BOT/` | Disabled. Crash bot is commented out of crontab |
| `Dashboard/` | React dashboard that reads both buy logs and displays live/demo data |

---

## Cron Schedule

```
# Pre-check — every Sunday at 09:00 (24h before buy)
0 9 * * 0 python3 HYBRID-DCA-BOT/sunday_check.py

# Main buy — every Monday at 09:00
0 9 * * 1 python3 HYBRID-DCA-BOT/dispatcher.py

# Retry 1 — Monday 13:00
0 13 * * 1 python3 HYBRID-DCA-BOT/retry_dispatcher.py

# Retry 2 — Monday 17:00 (final)
0 17 * * 1 python3 HYBRID-DCA-BOT/retry_dispatcher.py
```

---

## Environment Variables (from BTC-DCA-BOT/.env)

```
BINANCE_API_KEY
BINANCE_API_SECRET
EMAIL_USER
EMAIL_PASSWORD
EMAIL_RECEIVER
```

---

## Dashboard Integration

The dashboard (`Dashboard/app/src/`) reads the buy logs from both bots:
- `ATH-DCA-BOT/buy_log.json` → shown in ATH-DCA dashboard tab
- `BTC-DCA-BOT/buy_log.json` → shown in MA-DCA dashboard tab
- Both combined → shown in Summary dashboard

In demo mode, all three dashboards simulate the hybrid dispatcher logic using 4yr real weekly BTC data (Apr 2022 – Apr 2026), pre-computed in `Dashboard/app/src/data/hybridBacktest.js`.

### Live mode chart sync

In live mode, all chart dots (buy markers) and the running avg buy price line are built exclusively from the real buy logs — never from the backtest simulation data.

**Date alignment:** `hybridBacktest.js` weekly entries fall on Saturdays (the backtest started on 2022-04-09). The real bot buys happen on Mondays. These dates never match exactly, so a **forward-scan** is used:

```
for each Saturday entry in hybridWeekly:
    include all real buys with date <= this Saturday
    → last included buy sets the dot marker and updates running avg
after the loop:
    any buys after the last Saturday are appended as extra chart points
```

This means each Monday buy is attributed to the next Saturday's chart slot, giving the correct visual position. The running avg buy price line steps up at each real buy and is held flat between buys using `connectNulls`.

**Per dashboard:**
- `BtcSummaryDashboard.jsx` — `avgLine` in live mode: forward-scans `liveData.dcaBuys` + `liveData.athBuys`
- `AthDcaDashboard.jsx` — `liveChartData` useMemo: forward-scans `liveData.athBuys`
- `BtcDcaDashboard.jsx` — `liveChartData` useMemo: forward-scans `liveData.dcaBuys`

If a buy falls after the last hybridWeekly entry (i.e. more recent than the backtest end date), it is appended as a new chart point using the buy's actual price as the BTC price.

**Backtest results (4yr):**
- 141 ATH mode buys, 41 MA mode buys, 27 no-buy weeks
- $33,693 total invested, 1.327 BTC accumulated
- Avg buy price: $25,382 | P/L: +165% at $67,300
