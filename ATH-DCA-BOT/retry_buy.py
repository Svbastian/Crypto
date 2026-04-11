import os
import json
from datetime import datetime
from dotenv import load_dotenv
from binance.client import Client
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import ssl

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH   = os.path.join(SCRIPT_DIR, ".env")
LOG_FILE   = os.path.join(SCRIPT_DIR, "buy_log.json")
RETRY_FILE = os.path.join(SCRIPT_DIR, "retry.json")

load_dotenv(dotenv_path=ENV_PATH)
api_key        = os.getenv("BINANCE_API_KEY")
api_secret     = os.getenv("BINANCE_API_SECRET")
email_sender   = os.getenv("EMAIL_USER")
email_password = os.getenv("EMAIL_PASSWORD")
email_receiver = os.getenv("EMAIL_RECEIVER")

# === ATH-DCA Strategy Config (must match ath_dca.py) ===
ATH_WINDOW_DAYS = 1825
MIN_DIP         = 0.15
BASE_USDT       = 25.0
MAX_USDT        = 1000.0
POW_N           = 2.1

# === No pending retry → nothing to do ===
if not os.path.exists(RETRY_FILE):
    print("✅ No pending retry. Exiting.")
    exit(0)

# Always clear the flag — no infinite retry loops
os.remove(RETRY_FILE)
print("🔁 Pending retry found — re-running full buy logic with current market data...")

client = Client(api_key, api_secret)


def send_email(subject, body):
    try:
        msg = MIMEMultipart()
        msg['From']    = email_sender
        msg['To']      = email_receiver
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=context) as server:
            server.login(email_sender, email_password)
            server.send_message(msg)
        print("📧 Email sent")
    except Exception as e:
        print(f"❌ Failed to send email: {e}")


# === Fetch current market data ===
btc_price   = float(client.get_symbol_ticker(symbol="BTCUSDT")['price'])
klines      = client.get_klines(symbol='BTCUSDT', interval='1d', limit=ATH_WINDOW_DAYS)
rolling_ath = max(float(k[2]) for k in klines)
dip_pct     = (rolling_ath - btc_price) / rolling_ath

print(f"💵 BTC price: ${btc_price:,.2f}")
print(f"📈 5yr rolling ATH: ${rolling_ath:,.2f}")
print(f"📉 Dip from ATH: {dip_pct * 100:.1f}%")

# === Check if still in buy zone ===
if dip_pct < MIN_DIP:
    print(f"⏭️  Price is only {dip_pct * 100:.1f}% below ATH — no longer in buy zone. Retry cancelled.")
    send_email(
        "ℹ️ ATH-DCA - Retry Cancelled (no longer in buy zone)",
        f"The scheduled retry was cancelled because BTC is no longer 15%+ below ATH.\n\n"
        f"BTC Price: ${btc_price:,.2f}\n"
        f"5yr Rolling ATH: ${rolling_ath:,.2f}\n"
        f"Dip: {dip_pct * 100:.1f}%"
    )
    exit(0)

# === Recalculate buy size from scratch ===
ratio      = min((dip_pct - MIN_DIP) / (1.0 - MIN_DIP), 1.0)
pow_ratio  = ratio ** POW_N
buy_amount = round(BASE_USDT + pow_ratio * (MAX_USDT - BASE_USDT), 2)

print(f"✅ Buy signal — ratio: {ratio:.2f}, buy size: ${buy_amount:.2f}")

# === Check balance ===
balances     = {a['asset']: float(a['free']) for a in client.get_account()['balances']}
usdt_balance = balances.get('USDT', 0.0)
print(f"💼 USDT balance: ${usdt_balance:.2f}")

if usdt_balance < buy_amount:
    print(f"❌ Still insufficient balance. Needed: ${buy_amount:.2f}, Available: ${usdt_balance:.2f}")
    send_email(
        "❌ ATH-DCA - Retry Failed (still insufficient balance)",
        f"Retry buy failed — balance still insufficient.\n\n"
        f"Needed: ${buy_amount:.2f}, Available: ${usdt_balance:.2f}\n"
        f"Dip from ATH: {dip_pct * 100:.1f}%\n"
        f"Rolling ATH (5yr): ${rolling_ath:,.2f}\n\n"
        f"The buy has been cancelled. Top up your USDT balance."
    )
    exit(0)

# === Execute Buy ===
try:
    print("🚀 Placing retry BUY order...")

    order = client.create_order(
        symbol='BTCUSDT',
        side='BUY',
        type='MARKET',
        quoteOrderQty=buy_amount
    )

    executed_qty      = float(order['executedQty'])
    cummulative_quote = float(order['cummulativeQuoteQty'])

    print(f"📦 Retry order filled: {executed_qty:.6f} BTC for ${cummulative_quote:.2f}")

    # === Log ===
    log_entry = {
        "timestamp":   datetime.utcnow().isoformat(),
        "btc_bought":  executed_qty,
        "price":       btc_price,
        "usdt_spent":  cummulative_quote,
        "rolling_ath": rolling_ath,
        "dip_pct":     round(dip_pct * 100, 2),
        "pow_ratio":   round(pow_ratio, 4),
        "buy_amount":  buy_amount,
        "note":        "retry buy",
    }

    try:
        with open(LOG_FILE, "r+") as f:
            logs = json.load(f)
            logs.append(log_entry)
            f.seek(0)
            json.dump(logs, f, indent=2)
    except FileNotFoundError:
        logs = [log_entry]
        with open(LOG_FILE, "w") as f:
            json.dump(logs, f, indent=2)

    print("📝 Logged to buy_log.json")

    # === Summary Stats ===
    total_spent   = sum(e.get('usdt_spent', 0) for e in logs)
    total_btc     = sum(e.get('btc_bought', 0) for e in logs)
    average_price = total_spent / total_btc if total_btc else 0
    timestamp     = datetime.now().strftime("%d.%m.%Y %H:%M")

    send_email(
        "✅ ATH-DCA - Retry Buy Executed",
        f"🔁 Retry BTC Purchase Executed\n\n"
        f"💰 BTC Bought: {executed_qty:.6f} BTC\n"
        f"💵 Price: ${btc_price:,.2f}\n"
        f"🕒 Time: {timestamp}\n"
        f"📉 USDT Spent: ${cummulative_quote:.2f}\n"
        f"📈 5yr Rolling ATH: ${rolling_ath:,.2f}\n"
        f"📉 Dip from ATH: {dip_pct * 100:.1f}%\n\n"
        f"⭐ Average Buy Price: ${average_price:,.2f}\n"
        f"💸 Total Invested: ${total_spent:,.2f}"
    )

except Exception as e:
    print(f"❌ Retry order failed: {e}")
    send_email("❌ ATH-DCA - Retry Buy Failed", str(e))
