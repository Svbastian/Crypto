"""
Dashboard API Server
Serves live BTC price + real buy log data + historical chart data to the React dashboard.
"""

import json
import os
from datetime import datetime, timezone
import requests
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app', 'dist')

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='')
CORS(app)

BASE_DIR         = os.path.dirname(os.path.abspath(__file__))
DCA_LOG          = os.path.join(BASE_DIR, '..', 'BTC-DCA-BOT',   'buy_log.json')
CRASH_LOG        = os.path.join(BASE_DIR, '..', 'BTC-Crash-BOT', 'crash_log.json')
RETAINED_FILE    = os.path.join(BASE_DIR, '..', 'BTC-DCA-BOT',   'retained.json')
CRASH_STATE_FILE = os.path.join(BASE_DIR, '..', 'BTC-Crash-BOT', 'crash_state.json')


def read_json(path):
    try:
        with open(os.path.normpath(path), 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def read_skipped_weeks():
    try:
        with open(os.path.normpath(RETAINED_FILE), 'r') as f:
            return json.load(f).get('skipped_weeks', 0)
    except (FileNotFoundError, json.JSONDecodeError):
        return 0


def read_crash_state():
    try:
        with open(os.path.normpath(CRASH_STATE_FILE), 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {'last_buy_at': None}


def get_btc_price():
    try:
        resp = requests.get(
            'https://api.binance.com/api/v3/ticker/price',
            params={'symbol': 'BTCUSDT'},
            timeout=5
        )
        return float(resp.json()['price'])
    except Exception:
        return None


def get_chart_data(dca_buys, crash_buys=None):
    try:
        resp = requests.get(
            'https://api.binance.com/api/v3/klines',
            params={'symbol': 'BTCUSDT', 'interval': '1d', 'limit': 200},
            timeout=10
        )
        klines = resp.json()
    except Exception:
        return []

    prices = []
    for k in klines:
        date = datetime.fromtimestamp(k[0] / 1000, tz=timezone.utc).strftime('%Y-%m-%d')
        prices.append({'date': date, 'close': float(k[4])})

    closes = [p['close'] for p in prices]

    # Build DCA avg buy price map
    buy_map = {}
    total_invested = 0.0
    total_btc = 0.0
    for buy in sorted(dca_buys, key=lambda x: x.get('timestamp', x.get('time', ''))):
        total_invested += buy.get('usdt_spent', buy.get('usdtSpent', 0))
        total_btc += buy.get('btc_bought', buy.get('btcBought', 0))
        date = (buy.get('timestamp', buy.get('time', '')) or '')[:10]
        if total_btc > 0:
            buy_map[date] = total_invested / total_btc

    # Build crash buy date set for markers
    crash_buy_dates = set()
    for buy in (crash_buys or []):
        date = (buy.get('timestamp', '') or '')[:10]
        if date:
            crash_buy_dates.add(date)

    result = []
    running_avg = None
    for i, p in enumerate(prices):
        def ma(n, idx=i):
            if idx < n - 1:
                return None
            return sum(closes[idx - n + 1:idx + 1]) / n

        if p['date'] in buy_map:
            running_avg = buy_map[p['date']]

        result.append({
            'date':           p['date'],
            'btcPrice':       p['close'],
            'ma7':            ma(7),
            'ma30':           ma(30),
            'ma100':          ma(100),
            'ma200':          ma(200),
            'avgBuyPrice':    running_avg,
            'crashBuyMarker': p['close'] if p['date'] in crash_buy_dates else None,
        })

    return result


@app.route('/api/data')
def data():
    dca_buys      = read_json(DCA_LOG)
    crash_buys    = read_json(CRASH_LOG)
    btc_price     = get_btc_price()
    chart_data    = get_chart_data(dca_buys, crash_buys)
    skipped_weeks = read_skipped_weeks()
    crash_state   = read_crash_state()

    return jsonify({
        'btcPrice':     btc_price,
        'dcaBuys':      dca_buys,
        'crashBuys':    crash_buys,
        'chartData':    chart_data,
        'skippedWeeks': skipped_weeks,
        'crashState':   crash_state,
    })


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    target = os.path.join(STATIC_DIR, path)
    if path and os.path.exists(target):
        return send_from_directory(STATIC_DIR, path)
    return send_from_directory(STATIC_DIR, 'index.html')


if __name__ == '__main__':
    print("Dashboard API running at http://localhost:5050")
    app.run(host='0.0.0.0', port=5050)
