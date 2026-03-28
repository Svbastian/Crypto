"""
Dashboard API Server
Serves live BTC price + real buy log data to the React dashboard.
Run this on the same machine as the bots (Raspberry Pi / Mac Mini).
"""

import json
import os
import requests
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# === Paths to bot log files (relative to this script) ===
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DCA_LOG    = os.path.join(BASE_DIR, '..', 'BTC-DCA-BOT',   'buy_log.json')
CRASH_LOG  = os.path.join(BASE_DIR, '..', 'BTC-Crash-BOT', 'crash_log.json')


def read_json(path):
    try:
        with open(os.path.normpath(path), 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


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


@app.route('/api/data')
def data():
    dca_buys   = read_json(DCA_LOG)
    crash_buys = read_json(CRASH_LOG)
    btc_price  = get_btc_price()

    return jsonify({
        'btcPrice':  btc_price,
        'dcaBuys':   dca_buys,
        'crashBuys': crash_buys,
    })


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    print("🚀 Dashboard API running at http://localhost:5050")
    app.run(host='0.0.0.0', port=5050)
