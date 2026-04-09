from binance.client import Client
import os, json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv('/Users/laetsche/Crypto/BTC-DCA-BOT/.env')
client = Client(os.getenv('BINANCE_API_KEY'), os.getenv('BINANCE_API_SECRET'))

# Fetch 5 years of weekly candles (260 weeks)
klines = client.get_klines(symbol='BTCUSDT', interval='1w', limit=260)

weeks = []
for k in klines:
    weeks.append({
        'date':  datetime.utcfromtimestamp(k[0] // 1000).strftime('%Y-%m-%d'),
        'open':  float(k[1]),
        'high':  float(k[2]),
        'low':   float(k[3]),
        'close': float(k[4]),
    })

# Compute rolling 5yr ATH at each week (max high from start up to that week)
for i, w in enumerate(weeks):
    w['rolling_ath'] = max(x['high'] for x in weeks[:i+1])

# Output as compact JSON for embedding in the React component
print(json.dumps(weeks, separators=(',', ':')))
