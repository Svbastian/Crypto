# Crypto Bots — Setup Guide

Full setup for the **Hybrid DCA Dispatcher**, **Dashboard**, and **API server** on a fresh Raspberry Pi (or any machine).

---

## Architecture Overview

| Component | What it does |
|---|---|
| `HYBRID-DCA-BOT/dispatcher.py` | Weekly buy — routes to ATH or MA mode, buys, logs, emails |
| `HYBRID-DCA-BOT/retry_dispatcher.py` | Retry buy at 13:00 and 17:00 if 09:00 failed (insufficient balance) |
| `HYBRID-DCA-BOT/sunday_check.py` | Sunday pre-check — emails balance status + estimated buy with 10% buffer |
| `Dashboard/api_server.py` | Reads buy logs + live BTC price, serves `/api/data` on port 5050 |
| `Dashboard/app/dist` | Built React dashboard, served as static files on port 3000 |

**Disabled (commented out in crontab):**
- `BTC-DCA-BOT/binance-DCA.py` — replaced by hybrid dispatcher
- `BTC-Crash-BOT/crash_bot.py` — disabled

---

## 1. Clone the repo

```bash
git clone https://github.com/Svbastian/Crypto.git
cd Crypto
```

---

## 2. Install Python dependencies

```bash
pip3 install python-binance python-dotenv flask flask-cors requests
```

---

## 3. Create the .env file

The hybrid dispatcher and all bots read credentials from `BTC-DCA-BOT/.env`.

```bash
cp BTC-DCA-BOT/.env.example BTC-DCA-BOT/.env
nano BTC-DCA-BOT/.env
```

Fill in:

```
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
EMAIL_RECEIVER=receiver@email.com
```

> Use a Gmail **App Password**, not your regular password.
> Generate one at: Google Account → Security → 2-Step Verification → App Passwords

---

## 4. Create data files

```bash
# Hybrid dispatcher state
echo '{"skipped_weeks": 0}' > HYBRID-DCA-BOT/retained.json

# Buy logs (both bots log here; start empty)
echo '[]' > ATH-DCA-BOT/buy_log.json
echo '[]' > BTC-DCA-BOT/buy_log.json
```

---

## 5. Install Node.js and build the dashboard

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

cd Dashboard/app
npm install
npm run build
cd ../..
```

---

## 6. Set up cron jobs

```bash
crontab -e
```

Add:

```
# ── Hybrid DCA Dispatcher ─────────────────────────────────────────────────────
# Pre-check — every Sunday at 09:00 (24h before buy, emails balance estimate)
0 9 * * 0 /usr/bin/python3 /home/pi/Crypto/HYBRID-DCA-BOT/sunday_check.py >> /home/pi/Crypto/HYBRID-DCA-BOT/hybrid.log 2>&1

# Main buy — every Monday at 09:00
0 9 * * 1 /usr/bin/python3 /home/pi/Crypto/HYBRID-DCA-BOT/dispatcher.py >> /home/pi/Crypto/HYBRID-DCA-BOT/hybrid.log 2>&1

# Retry 1 — Monday 13:00 (4h after main; only acts if retry.json exists)
0 13 * * 1 /usr/bin/python3 /home/pi/Crypto/HYBRID-DCA-BOT/retry_dispatcher.py >> /home/pi/Crypto/HYBRID-DCA-BOT/hybrid.log 2>&1

# Retry 2 — Monday 17:00 (8h after main; final attempt — adds to retained if still fails)
0 17 * * 1 /usr/bin/python3 /home/pi/Crypto/HYBRID-DCA-BOT/retry_dispatcher.py >> /home/pi/Crypto/HYBRID-DCA-BOT/hybrid.log 2>&1

# ── Dashboard ─────────────────────────────────────────────────────────────────
# Start API server and dashboard on reboot
@reboot /usr/bin/python3 /home/pi/Crypto/Dashboard/api_server.py >> /home/pi/Crypto/Dashboard/api.log 2>&1 &
@reboot npx serve -s /home/pi/Crypto/Dashboard/app/dist -l 3000 >> /home/pi/Crypto/Dashboard/serve.log 2>&1 &
```

---

## 7. Start everything now (without rebooting)

```bash
python3 Dashboard/api_server.py &
npx serve -s Dashboard/app/dist -l 3000 &
```

---

## 8. Open the dashboard

```bash
hostname -I   # find your Pi's IP
```

Open in any browser on your network:

```
http://<pi-ip>:3000
```

Toggle **Live** in the top-right to switch from demo (backtest simulation) to live bot data.

---

## Updating after code changes

```bash
git pull
cd Dashboard/app
npm run build
cd ../..
pkill -f "serve -s"
npx serve -s Dashboard/app/dist -l 3000 &
```

The API server and bots pick up code changes automatically on their next run.

---

## How the hybrid dispatcher works

**Every Monday 09:00:**
1. Fetches live BTC price + 5yr rolling ATH + all MAs from Binance (single API call)
2. Routes: if dip ≥ 15% from ATH → **ATH mode**; if dip < 15% → **MA mode**
3. Calculates buy size using shared retained weeks counter (`HYBRID-DCA-BOT/retained.json`)
4. Places market order, logs to the relevant `buy_log.json`, emails summary
5. If insufficient balance: saves `retry.json`, schedules retries at 13:00 and 17:00

**Retry logic:**
- 13:00 — re-fetches live data, re-routes, attempts buy again (1st retry)
- 17:00 — same (2nd and final retry); if still failing: retained += 1, final email

**Sunday 09:00:** Read-only pre-check. Emails estimated buy size (with 10% price buffer) and current USDT balance so you can top up before Monday if needed.

See `HYBRID-DCA-BOT/CONTEXT.md` for full strategy documentation.
