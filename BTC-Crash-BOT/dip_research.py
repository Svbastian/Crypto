"""
BTC Dip Research Script
Analyzes historical BTC price data to find:
- How often dips of various sizes occur
- Over what timeframes they happen
- At what MA levels they occur (to inform a "price too high" filter)
"""

import yfinance as yf
import pandas as pd

pd.set_option('display.float_format', '{:.2f}'.format)

# === Fetch 5 years of daily BTC data ===
print("📥 Fetching BTC historical data (5 years, daily)...")
btc = yf.download("BTC-USD", period="5y", interval="1d", auto_adjust=True, progress=False)
btc = btc[['Close']].copy()
btc.columns = ['price']
btc.index = pd.to_datetime(btc.index)
print(f"   {len(btc)} daily candles loaded ({btc.index[0].date()} → {btc.index[-1].date()})\n")

# === Moving Averages ===
btc['ma7']   = btc['price'].rolling(7).mean()
btc['ma30']  = btc['price'].rolling(30).mean()
btc['ma100'] = btc['price'].rolling(100).mean()
btc['ma200'] = btc['price'].rolling(200).mean()

# === Rolling Highs (reference points for dip calculation) ===
btc['high_7d']  = btc['price'].rolling(7).max()
btc['high_30d'] = btc['price'].rolling(30).max()
btc['high_90d'] = btc['price'].rolling(90).max()

# === Dip % from rolling highs ===
btc['dip_from_7d']  = (btc['price'] - btc['high_7d'])  / btc['high_7d']  * 100
btc['dip_from_30d'] = (btc['price'] - btc['high_30d']) / btc['high_30d'] * 100
btc['dip_from_90d'] = (btc['price'] - btc['high_90d']) / btc['high_90d'] * 100

btc = btc.dropna()
years = (btc.index[-1] - btc.index[0]).days / 365.25

# ============================================================
# 1. DIP FREQUENCY TABLE
# ============================================================
print("=" * 60)
print("1. DIP FREQUENCY (how often each dip size occurs per year)")
print("=" * 60)

thresholds = [-3, -5, -7, -10, -15, -20, -25, -30]
windows = {
    '7d high':  'dip_from_7d',
    '30d high': 'dip_from_30d',
    '90d high': 'dip_from_90d',
}

rows = []
for label, col in windows.items():
    for t in thresholds:
        days_below = (btc[col] <= t).sum()
        occurrences_per_year = days_below / years
        rows.append({
            'Reference':     label,
            'Dip ≥':         f"{t}%",
            'Days in data':  days_below,
            'Days/year':     round(occurrences_per_year, 1),
        })

df_freq = pd.DataFrame(rows)
for label in windows:
    subset = df_freq[df_freq['Reference'] == label]
    print(f"\n  From {label}:")
    print(f"  {'Dip ≥':<10} {'Days in data':>14} {'Days/year':>10}")
    print(f"  {'-'*36}")
    for _, row in subset.iterrows():
        print(f"  {row['Dip ≥']:<10} {row['Days in data']:>14} {row['Days/year']:>10}")

# ============================================================
# 2. WHEN DIPS HAPPEN — MA CONTEXT
# ============================================================
print("\n" + "=" * 60)
print("2. MA CONTEXT — where is price vs MAs when big dips hit")
print("   (helps decide the 'price too high' filter)")
print("=" * 60)

dip_events = btc[btc['dip_from_30d'] <= -10].copy()
dip_events['above_ma7']   = dip_events['price'] > dip_events['ma7']
dip_events['above_ma30']  = dip_events['price'] > dip_events['ma30']
dip_events['above_ma100'] = dip_events['price'] > dip_events['ma100']
dip_events['above_ma200'] = dip_events['price'] > dip_events['ma200']

total = len(dip_events)
print(f"\n  During days with ≥10% dip from 30d high ({total} days total):")
print(f"  Price still above MA7:   {dip_events['above_ma7'].sum():>4} days ({dip_events['above_ma7'].mean()*100:.0f}%)")
print(f"  Price still above MA30:  {dip_events['above_ma30'].sum():>4} days ({dip_events['above_ma30'].mean()*100:.0f}%)")
print(f"  Price still above MA100: {dip_events['above_ma100'].sum():>4} days ({dip_events['above_ma100'].mean()*100:.0f}%)")
print(f"  Price still above MA200: {dip_events['above_ma200'].sum():>4} days ({dip_events['above_ma200'].mean()*100:.0f}%)")

# ============================================================
# 3. DIP CLUSTERS — how many consecutive days does a dip last
# ============================================================
print("\n" + "=" * 60)
print("3. DIP DURATION — how many days does each dip level persist")
print("=" * 60)

for t in [-5, -10, -15, -20]:
    col = 'dip_from_30d'
    in_dip = btc[col] <= t
    # Find cluster lengths
    clusters = []
    count = 0
    for v in in_dip:
        if v:
            count += 1
        else:
            if count > 0:
                clusters.append(count)
                count = 0
    if count > 0:
        clusters.append(count)

    if clusters:
        s = pd.Series(clusters)
        print(f"\n  Dip ≥{t}% from 30d high:")
        print(f"    Episodes:    {len(clusters)}")
        print(f"    Avg length:  {s.mean():.1f} days")
        print(f"    Max length:  {s.max()} days")
        print(f"    Median:      {s.median():.1f} days")

# ============================================================
# 4. BIGGEST SINGLE-DAY DROPS
# ============================================================
print("\n" + "=" * 60)
print("4. BIGGEST SINGLE-DAY DROPS (top 15)")
print("=" * 60)
btc['daily_change'] = btc['price'].pct_change() * 100
top_drops = btc['daily_change'].nsmallest(15)
print(f"\n  {'Date':<14} {'Drop':>8}  {'Price':>10}")
print(f"  {'-'*36}")
for date, val in top_drops.items():
    price = btc.loc[date, 'price']
    print(f"  {str(date.date()):<14} {val:>7.2f}%  ${price:>10,.0f}")

print("\n✅ Research complete. Use this data to design your crash bot tiers.")
