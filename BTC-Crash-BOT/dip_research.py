"""
BTC Dip Research Script — Hourly granularity via Binance public API
Analyzes ~3 years of 1h candles for detailed dip frequency and behavior.
"""

import requests
import pandas as pd
from datetime import datetime, timezone

pd.set_option('display.float_format', '{:.2f}'.format)

# === Fetch hourly BTC candles from Binance (no API key needed) ===
def fetch_binance_klines(symbol, interval, start_ms, end_ms=None):
    url = "https://api.binance.com/api/v3/klines"
    all_klines = []
    limit = 1000
    current_start = start_ms

    while True:
        params = {"symbol": symbol, "interval": interval, "startTime": current_start, "limit": limit}
        if end_ms:
            params["endTime"] = end_ms
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        if not data:
            break
        all_klines.extend(data)
        last_time = data[-1][0]
        if len(data) < limit:
            break
        current_start = last_time + 1

    return all_klines

print("📥 Fetching 3 years of 1h BTC candles from Binance...")
start_ms = int(datetime(2022, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
klines = fetch_binance_klines("BTCUSDT", "1h", start_ms)

df = pd.DataFrame(klines, columns=[
    'open_time','open','high','low','close','volume',
    'close_time','quote_vol','trades','taker_base','taker_quote','ignore'
])
df['time']  = pd.to_datetime(df['open_time'], unit='ms', utc=True)
df['price'] = df['close'].astype(float)
df['high']  = df['high'].astype(float)
df['low']   = df['low'].astype(float)
df = df[['time','price','high','low']].set_index('time')

print(f"   {len(df)} hourly candles ({df.index[0].date()} → {df.index[-1].date()})\n")

hours_total = len(df)
years = hours_total / 8760

# === Rolling highs (in hours) ===
df['high_24h'] = df['price'].rolling(24).max()
df['high_7d']  = df['price'].rolling(24*7).max()
df['high_30d'] = df['price'].rolling(24*30).max()

# === MA30 daily → approximate on hourly data (30*24 hours) ===
df['ma30'] = df['price'].rolling(24*30).mean()

# === Dip % from rolling highs ===
df['dip_24h'] = (df['price'] - df['high_24h']) / df['high_24h'] * 100
df['dip_7d']  = (df['price'] - df['high_7d'])  / df['high_7d']  * 100
df['dip_30d'] = (df['price'] - df['high_30d']) / df['high_30d'] * 100

df = df.dropna()

# ============================================================
# 1. DIP FREQUENCY — hourly view
# ============================================================
print("=" * 65)
print("1. DIP FREQUENCY (hours/year the price sits at each dip level)")
print("=" * 65)

thresholds = [-3, -5, -7, -10, -12, -15, -20, -25]
windows = {
    '24h high': 'dip_24h',
    '7d high':  'dip_7d',
    '30d high': 'dip_30d',
}

for label, col in windows.items():
    print(f"\n  From {label}:")
    print(f"  {'Dip ≥':<10} {'Hours in data':>14} {'Hours/year':>12} {'Days/year':>10}")
    print(f"  {'-'*50}")
    for t in thresholds:
        h = (df[col] <= t).sum()
        hpy = h / years
        dpy = hpy / 24
        print(f"  {str(t)+'%':<10} {h:>14} {hpy:>12.0f} {dpy:>10.1f}")

# ============================================================
# 2. WITH MA30 FILTER applied — what actually triggers
# ============================================================
print("\n" + "=" * 65)
print("2. WITH MA30 FILTER (price < MA30) — realistic trigger count")
print("=" * 65)

df_filtered = df[df['price'] < df['ma30']]
filter_pct = len(df_filtered) / len(df) * 100
print(f"\n  Hours with price below MA30: {len(df_filtered)} of {len(df)} ({filter_pct:.0f}%)")

print(f"\n  From 7d high (MA30 filtered):")
print(f"  {'Dip ≥':<10} {'Hours/year':>12} {'Days/year':>10} {'Buys/year*':>12}")
print(f"  {'-'*48}")
print(f"  * assuming 48h cooldown between buys")

for t in thresholds:
    col = 'dip_7d'
    triggered = df_filtered[df_filtered[col] <= t]
    hpy = len(triggered) / years

    # Estimate buys/year with 48h cooldown (simple approximation)
    buys = 0
    last_buy_hour = None
    for ts in triggered.index:
        if last_buy_hour is None or (ts - last_buy_hour).total_seconds() / 3600 >= 48:
            buys += 1
            last_buy_hour = ts
    buys_per_year = buys / years

    print(f"  {str(t)+'%':<10} {hpy:>12.0f} {hpy/24:>10.1f} {buys_per_year:>12.1f}")

# ============================================================
# 3. BIGGEST HOURLY DROPS (single candle)
# ============================================================
print("\n" + "=" * 65)
print("3. BIGGEST SINGLE-HOUR DROPS (top 20)")
print("=" * 65)
df['hourly_drop'] = df['price'].pct_change() * 100
top = df['hourly_drop'].nsmallest(20)
print(f"\n  {'Date & Hour':<22} {'Drop':>8}  {'Price':>12}")
print(f"  {'-'*46}")
for ts, val in top.items():
    price = df.loc[ts, 'price']
    print(f"  {str(ts)[:16]:<22} {val:>7.2f}%  ${price:>12,.0f}")

# ============================================================
# 4. HOW FAST do dips recover?
# ============================================================
print("\n" + "=" * 65)
print("4. DIP RECOVERY — median hours until price recovers to entry")
print("=" * 65)

prices = df['price'].values
times  = df.index

for t in [-7, -10, -15, -20]:
    col = 'dip_7d'
    hit_idx = df.index[df[col] <= t].tolist()

    recovery_hours = []
    i = 0
    while i < len(hit_idx):
        entry_ts   = hit_idx[i]
        entry_price = df.loc[entry_ts, 'price']
        # find next hour where price >= entry_price
        future = df[df.index > entry_ts]
        recovered = future[future['price'] >= entry_price]
        if not recovered.empty:
            hours = (recovered.index[0] - entry_ts).total_seconds() / 3600
            recovery_hours.append(hours)
        # skip ahead to avoid counting same episode multiple times
        while i < len(hit_idx) and hit_idx[i] <= entry_ts + pd.Timedelta(hours=48):
            i += 1

    if recovery_hours:
        s = pd.Series(recovery_hours)
        print(f"\n  Dip ≥{t}% from 7d high:")
        print(f"    Episodes:       {len(recovery_hours)}")
        print(f"    Median recovery: {s.median():.0f}h ({s.median()/24:.1f} days)")
        print(f"    Avg recovery:    {s.mean():.0f}h ({s.mean()/24:.1f} days)")
        print(f"    Never recovered: {(s > 8760).sum()} episodes (>1 year)")

print("\n✅ Done.")
