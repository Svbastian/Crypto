# Raspberry Pi Setup Guide

## 1. Clone the repo

```bash
git clone https://github.com/Svbastian/Crypto.git
cd Crypto/BTC-DCA-BOT
```

## 2. Install Python dependencies

```bash
pip3 install python-binance python-dotenv
```

## 3. Create your .env file

```bash
cp .env.example .env
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

> For Gmail, use an **App Password**, not your regular password.
> Generate one at: Google Account → Security → 2-Step Verification → App Passwords

## 4. Create the data files

```bash
echo '{"skipped_weeks": 0}' > retained.json
echo '[]' > buy_log.json
```

## 5. Set up cron jobs

```bash
crontab -e
```

Add these two lines (replace the path with your actual path):

```
# Main DCA script — every Monday at 9am
0 9 * * 1 python3 /home/pi/Crypto/BTC-DCA-BOT/binance-DCA.py

# Retry check — every day at 9am (only acts if a buy failed)
0 9 * * * python3 /home/pi/Crypto/BTC-DCA-BOT/retry_buy.py
```

## 6. Test run (dry run without placing a real order)

```bash
python3 binance-DCA.py
```

## How it works

| File | Purpose |
|---|---|
| `binance-DCA.py` | Main script, runs weekly via cron |
| `retry_buy.py` | Retry script, runs daily, only acts if `retry.json` exists |
| `retained.json` | Tracks skipped weeks between buys |
| `buy_log.json` | Full purchase history |
| `retry.json` | Created on insufficient balance, deleted after retry |
| `.env` | Your API keys and email credentials (never committed to git) |
