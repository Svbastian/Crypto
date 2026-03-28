import os
import json
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from binance.client import Client
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import ssl

# === Paths & Config ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(SCRIPT_DIR, ".env"))

STATE_FILE = os.path.join(SCRIPT_DIR, "crash_state.json")
LOG_FILE   = os.path.join(SCRIPT_DIR, "crash_log.json")

USDT_PER_UNIT = 25
COOLDOWN_HOURS = 48

TIERS = [
    {"label": "Tier 4 (-20%)", "threshold": -20, "units": 4.5},
    {"label": "Tier 3 (-15%)", "threshold": -15, "units": 3},
    {"label": "Tier 2 (-10%)", "threshold": -10, "units": 2},
    {"label": "Tier 1 (-7%)",  "threshold": -7,  "units": 1},
]

# === Binance & Email ===
api_key    = os.getenv("BINANCE_API_KEY")
api_secret = os.getenv("BINANCE_API_SECRET")
email_sender   = os.getenv("EMAIL_USER")
email_password = os.getenv("EMAIL_PASSWORD")
email_receiver = os.getenv("EMAIL_RECEIVER")

client = Client(api_key, api_secret)


def send_email(subject, body):
    try:
        msg = MIMEMultipart()
        msg['From'] = email_sender
        msg['To'] = email_receiver
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=context) as server:
            server.login(email_sender, email_password)
            server.send_message(msg)
        print("📧 Email sent")
    except Exception as e:
        print(f"❌ Failed to send email: {e}")


def get_moving_average(days):
    klines = client.get_historical_klines("BTCUSDT", Client.KLINE_INTERVAL_1DAY, f"{days} days ago UTC")
    closes = [float(k[4]) for k in klines]
    return sum(closes) / len(closes)


def get_7d_high():
    klines = client.get_historical_klines("BTCUSDT", Client.KLINE_INTERVAL_1DAY, "7 days ago UTC")
    return max(float(k[2]) for k in klines)  # k[2] = high


def load_state():
    try:
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"last_buy_at": None}


def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


# === Fetch Market Data ===
print(f"🕐 Running crash bot check — {datetime.now().strftime('%d.%m.%Y %H:%M')}")

btc_price = float(client.get_symbol_ticker(symbol="BTCUSDT")['price'])
ma30      = get_moving_average(30)
high_7d   = get_7d_high()
dip_pct   = (btc_price - high_7d) / high_7d * 100

print(f"💵 BTC Price:  ${btc_price:,.2f}")
print(f"📊 MA30:       ${ma30:,.2f}")
print(f"📈 7d High:    ${high_7d:,.2f}")
print(f"📉 Dip from 7d high: {dip_pct:.2f}%")

# === MA30 Filter — skip if price is above MA30 ===
if btc_price > ma30:
    print(f"⛔ Price is above MA30 (${ma30:,.2f}) — no buy, market too high.")
    exit(0)

# === Cooldown Check ===
state = load_state()
if state["last_buy_at"]:
    last_buy = datetime.fromisoformat(state["last_buy_at"])
    elapsed  = datetime.now(timezone.utc) - last_buy
    if elapsed < timedelta(hours=COOLDOWN_HOURS):
        remaining = COOLDOWN_HOURS - (elapsed.total_seconds() / 3600)
        print(f"⏳ Cooldown active — {remaining:.1f}h remaining. Skipping.")
        exit(0)

# === Tier Check ===
triggered_tier = None
for tier in TIERS:
    if dip_pct <= tier["threshold"]:
        triggered_tier = tier
        break  # TIERS sorted highest threshold first, take the biggest match

if not triggered_tier:
    print(f"✅ No dip threshold reached ({dip_pct:.2f}%). Nothing to do.")
    exit(0)

print(f"🚨 {triggered_tier['label']} triggered! Dip: {dip_pct:.2f}%")

# === Balance Check ===
quote_order_value = USDT_PER_UNIT * triggered_tier["units"]
balances  = {a['asset']: float(a['free']) for a in client.get_account()['balances']}
usdt_balance = balances.get('USDT', 0.0)

if usdt_balance < quote_order_value:
    print(f"❌ Insufficient balance. Needed: ${quote_order_value:.2f}, Available: ${usdt_balance:.2f}")
    send_email(
        "❌ Crash Bot - Insufficient Balance",
        f"Crash bot triggered but insufficient balance.\n\n"
        f"Tier:      {triggered_tier['label']}\n"
        f"Dip:       {dip_pct:.2f}%\n"
        f"Needed:    ${quote_order_value:.2f}\n"
        f"Available: ${usdt_balance:.2f}"
    )
    exit(0)

# === Execute Buy ===
try:
    order = client.create_order(
        symbol='BTCUSDT',
        side='BUY',
        type='MARKET',
        quoteOrderQty=round(quote_order_value, 2)
    )

    executed_qty      = float(order['executedQty'])
    cummulative_quote = float(order['cummulativeQuoteQty'])

    print(f"📦 BUY executed: {executed_qty:.6f} BTC for ${cummulative_quote:.2f}")

    # === Log ===
    log_entry = {
        "timestamp":   datetime.utcnow().isoformat(),
        "tier":        triggered_tier["label"],
        "dip_pct":     round(dip_pct, 2),
        "btc_bought":  executed_qty,
        "price":       btc_price,
        "usdt_spent":  cummulative_quote,
    }
    try:
        with open(LOG_FILE, "r+") as f:
            logs = json.load(f)
            logs.append(log_entry)
            f.seek(0)
            json.dump(logs, f, indent=2)
    except FileNotFoundError:
        with open(LOG_FILE, "w") as f:
            json.dump([log_entry], f, indent=2)

    # === Save cooldown ===
    save_state({"last_buy_at": datetime.now(timezone.utc).isoformat()})

    # === Summary Stats ===
    with open(LOG_FILE, "r") as f:
        logs = json.load(f)
    total_spent = sum(e.get('usdt_spent', 0) for e in logs)
    total_btc   = sum(e.get('btc_bought', 0) for e in logs)
    avg_price   = total_spent / total_btc if total_btc else 0

    timestamp = datetime.now().strftime("%d.%m.%Y %H:%M")
    send_email(
        f"✅ Crash Bot - Buy Executed ({triggered_tier['label']})",
        f"🚨 Crash Buy Executed\n\n"
        f"📉 Dip:         {dip_pct:.2f}% from 7d high\n"
        f"🎯 Tier:        {triggered_tier['label']}\n"
        f"💰 BTC Bought:  {executed_qty:.6f} BTC\n"
        f"💵 Price:       ${btc_price:,.2f}\n"
        f"📉 USDT Spent:  ${cummulative_quote:.2f}\n"
        f"🕒 Time:        {timestamp}\n\n"
        f"⭐ Avg Buy Price (crash bot): ${avg_price:,.2f}\n"
        f"💸 Total Invested (crash bot): ${total_spent:.2f}\n\n"
        f"⏳ Cooldown active for next {COOLDOWN_HOURS}h."
    )

except Exception as e:
    print(f"❌ Order failed: {e}")
    send_email("❌ Crash Bot - Order Failed", str(e))
