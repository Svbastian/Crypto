# Dashboard Setup

Two parts: the **API server** (Python/Flask) and the **React app** (static build).
Run both on the same machine as the bots (Raspberry Pi / Mac Mini).

---

## 1. API Server

Reads both buy logs, the hybrid retained counter, and fetches live BTC price from Binance.

### Install dependencies

```bash
cd Dashboard
pip3 install -r requirements.txt
```

### Run

```bash
python3 api_server.py
```

Runs on `http://localhost:5050`. Start in the background:

```bash
nohup python3 api_server.py >> api.log 2>&1 &
```

Or auto-start on reboot via cron:

```
@reboot /usr/bin/python3 /home/pi/Crypto/Dashboard/api_server.py >> /home/pi/Crypto/Dashboard/api.log 2>&1 &
```

### What the API reads

| Source file | Used for |
|---|---|
| `ATH-DCA-BOT/buy_log.json` | ATH-mode buy history |
| `BTC-DCA-BOT/buy_log.json` | MA-mode buy history |
| `HYBRID-DCA-BOT/retained.json` | Current retained weeks counter |
| Binance API | Live BTC price |

Serves everything at `GET /api/data`.

---

## 2. React App

### Install and build

```bash
cd Dashboard/app
npm install
npm run build
```

### Serve the built app

```bash
npm install -g serve
serve -s dist -l 3000
```

Open `http://localhost:3000` (or replace `localhost` with your Pi's IP to access from the network).

Auto-start on reboot:

```
@reboot npx serve -s /home/pi/Crypto/Dashboard/app/dist -l 3000 >> /home/pi/Crypto/Dashboard/serve.log 2>&1 &
```

---

## Live vs Demo mode

The dashboard has a **Live / Demo** toggle in the top-right corner.

| Mode | What it shows |
|---|---|
| Demo | 4yr backtest simulation of the hybrid dispatcher on real weekly BTC data (Apr 2022–Apr 2026) |
| Live | Real buy log data from `ATH-DCA-BOT/buy_log.json` and `BTC-DCA-BOT/buy_log.json` via the API |

If the API is unreachable in Live mode, the dashboard shows an "API offline" warning and falls back to demo data.

---

## Dev mode (local development)

```bash
cd Dashboard/app
npm run dev
```

Runs at `http://localhost:5173`. Point to a specific API host:

```bash
VITE_API_URL=http://192.168.1.x:5050 npm run dev
```

---

## Rebuilding after code changes

```bash
cd Dashboard/app
npm run build
pkill -f "serve -s"
serve -s dist -l 3000 &
```
