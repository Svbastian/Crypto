# Raspberry Pi Setup Guide

Complete setup for the DCA bot, Crash bot, and Dashboard on a fresh Raspberry Pi.

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

## 3. Create your .env files

```bash
cp BTC-DCA-BOT/.env.example BTC-DCA-BOT/.env
nano BTC-DCA-BOT/.env
```

```bash
cp BTC-DCA-BOT/.env.example BTC-Crash-BOT/.env
nano BTC-Crash-BOT/.env
```

Fill in both files with your credentials:

```
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
EMAIL_RECEIVER=receiver@email.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
```

> For Gmail use an **App Password**, not your regular password.
> Generate one at: Google Account → Security → 2-Step Verification → App Passwords

---

## 4. Create bot data files

```bash
echo '{"skipped_weeks": 0}' > BTC-DCA-BOT/retained.json
echo '[]' > BTC-DCA-BOT/buy_log.json
echo '{"last_buy_at": null}' > BTC-Crash-BOT/crash_state.json
echo '[]' > BTC-Crash-BOT/crash_log.json
```

---

## 5. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## 6. Build the dashboard

```bash
cd Dashboard/app
npm install
npm run build
cd ../..
```

---

## 7. Set up cron jobs

```bash
crontab -e
```

Add the following lines (adjust the path if your username is not `pi`):

```
# DCA bot — every Monday at 9am
0 9 * * 1 python3 /home/pi/Crypto/BTC-DCA-BOT/binance-DCA.py

# Retry check — every day at 9am (only acts if a buy failed)
0 9 * * * python3 /home/pi/Crypto/BTC-DCA-BOT/retry_buy.py

# Crash bot — every hour
0 * * * * python3 /home/pi/Crypto/BTC-Crash-BOT/crash_bot.py

# Start API server on reboot
@reboot python3 /home/pi/Crypto/Dashboard/api_server.py &

# Start dashboard on reboot
@reboot npx serve -s /home/pi/Crypto/Dashboard/app/dist -l 3000 &
```

---

## 8. Start everything now (without rebooting)

```bash
python3 Dashboard/api_server.py &
npx serve -s Dashboard/app/dist -l 3000 &
```

---

## 9. Open the dashboard

Find your Pi's IP address:

```bash
hostname -I
```

Then open in any browser on your network:

```
http://<pi-ip>:3000
```

---

## How everything fits together

| Component | What it does | Port |
|---|---|---|
| `BTC-DCA-BOT/binance-DCA.py` | Weekly DCA buys, writes to `buy_log.json` | — |
| `BTC-DCA-BOT/retry_buy.py` | Daily retry if a buy failed due to low balance | — |
| `BTC-Crash-BOT/crash_bot.py` | Hourly crash dip buys, writes to `crash_log.json` | — |
| `Dashboard/api_server.py` | Reads log files + fetches live BTC price | 5050 |
| `Dashboard/app/dist` | Built React dashboard served as static files | 3000 |

---

## Updating after code changes

Pull the latest code and rebuild the dashboard:

```bash
git pull
cd Dashboard/app
npm run build
cd ../..
```

The API server and bots pick up changes automatically on the next run. To restart the dashboard server:

```bash
pkill -f "serve -s"
npx serve -s Dashboard/app/dist -l 3000 &
```
