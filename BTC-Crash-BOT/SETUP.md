# Crash Bot — Setup Guide

## 1. Clone & navigate

```bash
git clone https://github.com/Svbastian/Crypto.git
cd Crypto/BTC-Crash-BOT
```

## 2. Install dependencies

```bash
pip3 install python-binance python-dotenv
```

## 3. Create your .env file

```bash
cp ../BTC-DCA-BOT/.env.example .env
nano .env
```

Fill in your values:

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

## 4. Create data files

```bash
echo '{"last_buy_at": null}' > crash_state.json
echo '[]' > crash_log.json
```

## 5. Set up cron job

```bash
crontab -e
```

Add this line (replace path with your actual path):

```
# Crash bot — checks every hour
0 * * * * python3 /home/pi/Crypto/BTC-Crash-BOT/crash_bot.py
```

## How it works

**MA30 filter** — if price is above the 30-day moving average the bot does nothing. This prevents buying dips during bull runs when the price is already elevated.

**Tiers** — based on how far price has dropped from the 7-day high:

| Dip from 7d high | Units | USDT spent |
|---|---|---|
| ≥ -10% | 2x | $50 |
| ≥ -15% | 3x | $75 |
| ≥ -20% | 4.5x | $112.50 |

**48h cooldown** — after any buy the bot waits 48 hours before buying again.

**Typical dip timeline** — based on 3 years of hourly data, a -10% dip from the 7d high takes a median of 11 days to develop, so the hourly check will always catch it in time.

## Files

| File | Purpose |
|---|---|
| `crash_bot.py` | Main bot, runs every hour via cron |
| `crash_state.json` | Tracks last buy time for cooldown |
| `crash_log.json` | Full purchase history |
| `dip_research.py` | Research script used to calibrate tiers — not needed in production |
| `.env` | API keys and email credentials (never committed to git) |
