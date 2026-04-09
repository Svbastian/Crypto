from binance.client import Client
import os, json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv('/Users/laetsche/Crypto/BTC-DCA-BOT/.env')
client = Client(os.getenv('BINANCE_API_KEY'), os.getenv('BINANCE_API_SECRET'))

# Fetch 2yr + 200 extra days of daily candles so 200d MA is accurate from day 1
klines = client.get_klines(symbol='BTCUSDT', interval='1d', limit=1100)
closes = [(datetime.utcfromtimestamp(k[0]//1000).strftime('%Y-%m-%d'), float(k[4])) for k in klines]

def moving_avg(data, end_idx, days):
    start = max(0, end_idx - days + 1)
    window = [c[1] for c in data[start:end_idx + 1]]
    if len(window) < days:
        return None
    return round(sum(window) / len(window), 2)

# Find where 2yr backtest starts
two_yr_idx = next(i for i, (d, _) in enumerate(closes) if d >= '2024-04-07')

results = []
i = two_yr_idx
while i < len(closes):
    date, price = closes[i]
    results.append({
        'date':     date,
        'btcPrice': round(price, 2),
        'ma7':      moving_avg(closes, i, 7),
        'ma30':     moving_avg(closes, i, 30),
        'ma100':    moving_avg(closes, i, 100),
        'ma200':    moving_avg(closes, i, 200),
    })
    i += 7  # weekly steps

print(json.dumps(results, separators=(',', ':')))
