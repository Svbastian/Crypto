# Crash Bot — Raspberry Pi Setup

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

(Same credentials as the DCA bot — you can reuse them.)

## 4. Create data files

```bash
echo '{"last_buy_at": null}' > crash_state.json
echo '[]' > crash_log.json
```

## 5. Cron setup

```bash
crontab -e
```

```
# Crash bot — checks every hour
0 * * * * python3 /home/pi/Crypto/BTC-Crash-BOT/crash_bot.py
```

## How it works

| Condition | Units | USDT spent |
|---|---|---|
| Price < MA30 AND dip ≥ -7% from 7d high  | 1x   | $25     |
| Price < MA30 AND dip ≥ -10% from 7d high | 2x   | $50     |
| Price < MA30 AND dip ≥ -15% from 7d high | 3x   | $75     |
| Price < MA30 AND dip ≥ -20% from 7d high | 4.5x | $112.50 |

- **MA30 filter**: skips buy entirely if price is above MA30 (prevents buying during bull run dips)
- **48h cooldown**: after any buy, bot waits 48h before buying again
- Runs hourly via cron

## Files

| File | Purpose |
|---|---|
| `crash_bot.py` | Main bot, runs hourly |
| `crash_state.json` | Tracks last buy timestamp for cooldown |
| `crash_log.json` | Full purchase history |
| `dip_research.py` | Research script (not needed for production) |
| `.env` | API keys and email credentials (never committed) |
