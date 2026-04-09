"""
Fetches ~6 years of daily BTC data from Binance and produces:
  1. A console comparison of all 3 strategies over the 4yr backtest
  2. weekly_4yr.json  — weekly entries with price + all MAs + rolling ATH
  3. daily_4yr.json   — daily entries with price + 7d high + MA30 (for Crash Bot)
"""
import os, json, math
from datetime import datetime, timedelta
from dotenv import load_dotenv
from binance.client import Client

load_dotenv('/Users/laetsche/Crypto/BTC-DCA-BOT/.env')
client = Client(os.getenv('BINANCE_API_KEY'), os.getenv('BINANCE_API_SECRET'))

# ── Fetch daily candles from 2016-01-01 (enough for 5yr ATH + 200d MA) ──
print("Fetching daily BTC data from Binance...")
klines = client.get_historical_klines("BTCUSDT", "1d", "1 Jan 2016")
print(f"  Got {len(klines)} daily candles")

dates  = [datetime.utcfromtimestamp(k[0]//1000).strftime('%Y-%m-%d') for k in klines]
highs  = [float(k[2]) for k in klines]
closes = [float(k[4]) for k in klines]

def ma(series, end_idx, days):
    start = max(0, end_idx - days + 1)
    window = series[start:end_idx + 1]
    if len(window) < days:
        return None
    return round(sum(window) / len(window), 2)

def rolling_max(series, end_idx, days):
    start = max(0, end_idx - days + 1)
    return max(series[start:end_idx + 1])

BACKTEST_START = '2022-04-09'
BACKTEST_END   = dates[-1]

# ── Build daily dataset ───────────────────────────────────────────────────
print("Computing MAs and ATH for each day...")
daily = []
for i, date in enumerate(dates):
    if date < BACKTEST_START:
        continue
    entry = {
        'date':        date,
        'close':       round(closes[i], 2),
        'high':        round(highs[i], 2),
        'ma7':         ma(closes, i, 7),
        'ma30':        ma(closes, i, 30),
        'ma100':       ma(closes, i, 100),
        'ma200':       ma(closes, i, 200),
        'high7':       round(rolling_max(highs, i, 7), 2),    # 7-day high for Crash Bot
        'ath5yr':      round(rolling_max(highs, i, 1825), 2), # 5yr rolling ATH for ATH-DCA
    }
    daily.append(entry)

print(f"  Daily entries in backtest: {len(daily)} ({daily[0]['date']} → {daily[-1]['date']})")

# ── Build weekly dataset (every 7th day) ─────────────────────────────────
weekly = [daily[i] for i in range(0, len(daily), 7)]
print(f"  Weekly entries: {len(weekly)}")

# ── Save JSON files ───────────────────────────────────────────────────────
with open('/tmp/daily_4yr.json', 'w') as f:
    json.dump(daily, f, separators=(',', ':'))
with open('/tmp/weekly_4yr.json', 'w') as f:
    json.dump(weekly, f, separators=(',', ':'))
print("  Saved daily_4yr.json and weekly_4yr.json")

# ═══════════════════════════════════════════════════════════════════════════
# STRATEGY SIMULATIONS
# ═══════════════════════════════════════════════════════════════════════════
CURRENT_PRICE = closes[-1]

# ── 1. MA-Tier DCA Bot (weekly) ───────────────────────────────────────────
BASE = 25
retained = 0
inv_dca, btc_dca, buys_dca = 0, 0, []

for w in weekly:
    retained += 1
    p, m7, m30, m100, m200 = w['close'], w['ma7'], w['ma30'], w['ma100'], w['ma200']
    if None in (m7, m30, m100, m200) or p >= m7:
        continue
    if   p < m200: mult, label = 4.5, '200d MA'
    elif p < m100: mult, label = 3,   '100d MA'
    elif p < m30:  mult, label = 2,   '30d MA'
    else:          mult, label = 1,   '7d MA'
    usdt = BASE * mult * retained
    inv_dca += usdt; btc_dca += usdt / p
    buys_dca.append({'date': w['date'], 'usdt': usdt, 'price': p, 'trigger': label})
    retained = 0

avg_dca  = inv_dca / btc_dca
pnl_dca  = btc_dca * CURRENT_PRICE - inv_dca
pct_dca  = pnl_dca / inv_dca * 100

# ── 2. ATH-DCA Bot (weekly) ───────────────────────────────────────────────
MIN_DIP = 0.15; BASE_ATH = 25; MAX_ATH = 1000; LOG_K = 10
inv_ath, btc_ath, buys_ath = 0, 0, []

for w in weekly:
    p, ath = w['close'], w['ath5yr']
    dip = (ath - p) / ath
    if dip < MIN_DIP:
        continue
    ratio     = min((dip - MIN_DIP) / (1.0 - MIN_DIP), 1.0)
    log_ratio = math.log1p(ratio * LOG_K) / math.log1p(LOG_K)
    usdt      = round(BASE_ATH + log_ratio * (MAX_ATH - BASE_ATH), 2)
    inv_ath += usdt; btc_ath += usdt / p
    buys_ath.append({'date': w['date'], 'usdt': usdt, 'price': p, 'dip': dip*100})

avg_ath = inv_ath / btc_ath
pnl_ath = btc_ath * CURRENT_PRICE - inv_ath
pct_ath = pnl_ath / inv_ath * 100

# ── 3. Crash Bot (daily) ──────────────────────────────────────────────────
TIERS = [
    {'min_dip': 0.07,  'usdt': 25.00,  'label': 'Tier 1 (-7%)'},
    {'min_dip': 0.10,  'usdt': 50.00,  'label': 'Tier 2 (-10%)'},
    {'min_dip': 0.15,  'usdt': 75.00,  'label': 'Tier 3 (-15%)'},
    {'min_dip': 0.20,  'usdt': 112.50, 'label': 'Tier 4 (-20%)'},
]
inv_crash, btc_crash, buys_crash = 0, 0, []
last_buy_date = None

for d in daily:
    p, m30, high7 = d['close'], d['ma30'], d['high7']
    if m30 is None:
        continue
    # MA30 filter — only buy in bear market conditions
    if p >= m30:
        continue
    # 48h cooldown
    if last_buy_date:
        days_since = (datetime.strptime(d['date'], '%Y-%m-%d') - datetime.strptime(last_buy_date, '%Y-%m-%d')).days
        if days_since < 2:
            continue
    # Find triggered tier
    dip_from_high = (high7 - p) / high7
    triggered = None
    for tier in reversed(TIERS):
        if dip_from_high >= tier['min_dip']:
            triggered = tier
            break
    if not triggered:
        continue
    inv_crash += triggered['usdt']; btc_crash += triggered['usdt'] / p
    buys_crash.append({'date': d['date'], 'usdt': triggered['usdt'], 'price': p, 'tier': triggered['label'], 'dip': dip_from_high*100})
    last_buy_date = d['date']

avg_crash = inv_crash / btc_crash if btc_crash else 0
pnl_crash = btc_crash * CURRENT_PRICE - inv_crash
pct_crash = pnl_crash / inv_crash * 100 if inv_crash else 0

# ── Print results ─────────────────────────────────────────────────────────
print(f"\n{'':=<65}")
print(f"  4-YEAR BACKTEST: Apr 2022 → {BACKTEST_END}  (BTC now ${CURRENT_PRICE:,.0f})")
print(f"{'':=<65}")
print(f"\n{'Metric':<30} {'MA-Tier DCA':>10} {'ATH-Log DCA':>11} {'Crash Bot':>10}")
print(f"{'-'*65}")
print(f"{'Buys triggered':<30} {len(buys_dca):>10} {len(buys_ath):>11} {len(buys_crash):>10}")
print(f"{'Total invested':<30} ${inv_dca:>8,.0f} ${inv_ath:>9,.0f} ${inv_crash:>8,.0f}")
print(f"{'BTC accumulated':<30} {btc_dca:>10.5f} {btc_ath:>11.5f} {btc_crash:>10.5f}")
print(f"{'Avg buy price':<30} ${avg_dca:>8,.0f} ${avg_ath:>9,.0f} ${avg_crash:>8,.0f}")
print(f"{'Position value':<30} ${btc_dca*CURRENT_PRICE:>8,.0f} ${btc_ath*CURRENT_PRICE:>9,.0f} ${btc_crash*CURRENT_PRICE:>8,.0f}")
print(f"{'P/L (USD)':<30} ${pnl_dca:>8,.0f} ${pnl_ath:>9,.0f} ${pnl_crash:>8,.0f}")
print(f"{'P/L (%)':<30} {pct_dca:>9.1f}% {pct_ath:>10.1f}% {pct_crash:>9.1f}%")
print(f"{'Avg buy size':<30} ${inv_dca/len(buys_dca):>8,.0f} ${inv_ath/len(buys_ath):>9,.0f} ${inv_crash/len(buys_crash):>8,.0f}")
print(f"{'Biggest single buy':<30} ${max(b['usdt'] for b in buys_dca):>8,.0f} ${max(b['usdt'] for b in buys_ath):>9,.0f} ${max(b['usdt'] for b in buys_crash):>8,.0f}")
print(f"\n── At previous ATH (~$109k) ──")
print(f"{'Position value @ $109k':<30} ${btc_dca*109000:>8,.0f} ${btc_ath*109000:>9,.0f} ${btc_crash*109000:>8,.0f}")
print(f"{'P/L % @ $109k':<30} {(btc_dca*109000-inv_dca)/inv_dca*100:>9.1f}% {(btc_ath*109000-inv_ath)/inv_ath*100:>10.1f}% {(btc_crash*109000-inv_crash)/inv_crash*100:>9.1f}%")
print(f"\n── Crash Bot tier breakdown ──")
for tier in TIERS:
    count = sum(1 for b in buys_crash if b['tier'] == tier['label'])
    print(f"  {tier['label']}: {count} buys")
