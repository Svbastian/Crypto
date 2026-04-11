# ATH-DCA Bot — Context File

This file explains the setup for Claude or any other reader picking up this project mid-session.

---

## Status: Standalone Scripts Present, NOT Active in Crontab

The standalone `ath_dca.py` and `retry_buy.py` in this folder are **not running**. The Hybrid Dispatcher (`HYBRID-DCA-BOT/dispatcher.py`) has replaced both standalone bots. ATH-mode buys are executed by the hybrid and logged here into `buy_log.json`.

Do NOT add `ath_dca.py` back to crontab — it would double-buy on ATH-mode weeks.

---

## What This Folder Is Used For

- **`buy_log.json`** — the authoritative ATH-mode buy log, written by the hybrid dispatcher
- **`ath_dca.py`** — kept for reference; contains the standalone ATH bot logic (same formula as hybrid uses)
- **`retry_buy.py`** — kept for reference; retry logic for the standalone bot (not needed, hybrid has its own retry)

---

## ATH-DCA Strategy (as implemented in the hybrid)

**Trigger:** BTC is ≥ 15% below the 5-year rolling ATH

**5yr rolling ATH:** Max daily high across the last 1,825 daily Binance candles. Recalculated fresh on every run.

**Buy size formula (power curve):**
```
ratio     = min((dip - 0.15) / (1.0 - 0.15), 1.0)
pow_ratio = ratio ^ 2.1
base_buy  = $25 + pow_ratio × ($1,000 - $25)
```

**Retention multiplier (ATH mode only, cap = 5 weeks):**
```
cap_ret   = min(retained_weeks, 5)
total_buy = base_buy × (1 + cap_ret × 0.5)
```
Each retained week adds 0.5× of base_buy on top of the current week's full buy. Cap prevents over-deployment during long ATH-inactive periods.

**Power curve behavior:**
| Dip from ATH | Approx buy size (no retention) |
|---|---|
| -15% | $25 |
| -25% | ~$45 |
| -40% | ~$130 |
| -55% | ~$300 |
| -70% | ~$530 |
| -85% | ~$820 |
| -90% | ~$975 |

---

## Buy Log Format (`buy_log.json`)

```json
{
  "timestamp": "2024-08-12T09:00:00.000000",
  "btc_bought": 0.000412,
  "price": 60500.00,
  "usdt_spent": 24.93,
  "rolling_ath": 69000.00,
  "dip_pct": 12.32,
  "pow_ratio": 0.0312,
  "buy_amount": 24.93,
  "base_buy": 24.93,
  "retained_weeks": 0,
  "note": "hybrid dispatcher — ATH mode"
}
```

For buys with retained weeks, `note` will show `"hybrid dispatcher — ATH mode (retry N)"` for retries.

---

## Relationship to Hybrid Dispatcher

The hybrid dispatcher (`HYBRID-DCA-BOT/dispatcher.py`) calls the ATH logic when:
- `dip_pct >= 0.15`

On success it writes to this folder's `buy_log.json` and resets `HYBRID-DCA-BOT/retained.json` to 0.

The **retained weeks** are shared with MA mode — if the MA bot buys, retained also resets. If ATH mode buys, retained also resets. The counter is at `HYBRID-DCA-BOT/retained.json`.

---

## Dashboard

The `AthDcaDashboard` tab in the React dashboard reads from this `buy_log.json` in live mode.  
In demo mode it uses pre-computed 4yr hybrid backtest data from `Dashboard/app/src/data/hybridBacktest.js` (ATH-mode buys only, with shared retention correctly simulated).

**4yr backtest ATH mode results:**
- 141 buys over 209 weeks (Apr 2022 – Apr 2026)
- Heavily active during 2022–2023 bear market when BTC was well below $69k ATH
- Less active after Nov 2024 when BTC set new ATH above $100k (new ATH reference shifts up)
