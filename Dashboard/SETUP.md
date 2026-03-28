# Dashboard Setup

Two parts: the **API server** (Python) and the **React app** (Node.js).
Run both on the same machine as your bots (Raspberry Pi / Mac Mini).

---

## 1. API Server

The API server reads the real bot log files and fetches the live BTC price from Binance.

### Install dependencies

```bash
cd Dashboard
pip3 install -r requirements.txt
```

### Run

```bash
python3 api_server.py
```

Runs on `http://localhost:5050`. Keep it running in the background:

```bash
nohup python3 api_server.py &
```

Or add it to cron so it starts on reboot:

```bash
crontab -e
```
```
@reboot python3 /home/pi/Crypto/Dashboard/api_server.py
```

---

## 2. React App

### Install and build

```bash
cd Dashboard/app
npm install
npm run build
```

### Serve the built app

Install a simple static file server:

```bash
npm install -g serve
```

Run it:

```bash
serve -s dist -l 3000
```

Open `http://localhost:3000` (or replace `localhost` with your Pi/Mini IP to access from another device on your network).

Auto-start on reboot via cron:

```bash
@reboot serve -s /home/pi/Crypto/Dashboard/app/dist -l 3000
```

---

## How live data works

| Component | What it does |
|---|---|
| `api_server.py` | Reads `BTC-DCA-BOT/buy_log.json` and `BTC-Crash-BOT/crash_log.json`, fetches BTC price from Binance, serves everything at `/api/data` |
| React dashboard | Fetches `/api/data` on load and every 60 seconds, auto-refreshes |
| Fallback | If the API is unreachable the dashboard shows mock data with an "API offline" warning |

---

## Dev mode (local development)

```bash
cd Dashboard/app
npm run dev
```

Runs at `http://localhost:5173`. Point it to a different API server:

```bash
VITE_API_URL=http://192.168.1.x:5050 npm run dev
```
