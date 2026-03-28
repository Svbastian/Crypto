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
load_dotenv(dotenv_path=os.path.join(SCRIPT_DIR, ".env"))

RETRY_FILE = os.path.join(SCRIPT_DIR, "retry.json")
LOG_FILE = os.path.join(SCRIPT_DIR, "buy_log.json")
RETAINED_FILE = os.path.join(SCRIPT_DIR, "retained.json")

api_key = os.getenv("BINANCE_API_KEY")
api_secret = os.getenv("BINANCE_API_SECRET")
email_sender = os.getenv("EMAIL_USER")
email_password = os.getenv("EMAIL_PASSWORD")
email_receiver = os.getenv("EMAIL_RECEIVER")
email_port = int(os.getenv("EMAIL_PORT"))

client = Client(api_key, api_secret)

# === No pending retry → nothing to do ===
if not os.path.exists(RETRY_FILE):
    print("✅ No pending retry. Exiting.")
    exit(0)

with open(RETRY_FILE, "r") as f:
    retry = json.load(f)

quote_order_value = retry["quote_order_value"]
total_weeks = retry["total_weeks"]
skipped_weeks_at_failure = retry["skipped_weeks_at_failure"]

print(f"🔁 Retrying failed buy of ${quote_order_value:.2f}...")


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


# === Check Balance ===
balances = {asset['asset']: float(asset['free']) for asset in client.get_account()['balances']}
usdt_balance = balances.get('USDT', 0.0)

if usdt_balance < quote_order_value:
    print(f"❌ Still insufficient balance. Needed: ${quote_order_value:.2f}, Available: ${usdt_balance:.2f}")
    send_email(
        "❌ Binance DCA - Retry Failed (Insufficient Balance)",
        f"Retry buy also failed due to insufficient balance.\n"
        f"Needed: ${quote_order_value:.2f}, Available: ${usdt_balance:.2f}\n\n"
        f"The pending buy has been cancelled. Skipped weeks remain unchanged."
    )
    # Clear retry so it doesn't loop forever
    os.remove(RETRY_FILE)
    exit(0)

# === Execute Buy ===
try:
    btc_price = float(client.get_symbol_ticker(symbol="BTCUSDT")['price'])

    order = client.create_order(
        symbol='BTCUSDT',
        side='BUY',
        type='MARKET',
        quoteOrderQty=round(quote_order_value, 2)
    )

    executed_qty = float(order['executedQty'])
    cummulative_quote = float(order['cummulativeQuoteQty'])

    print(f"📦 Retry BUY executed! {executed_qty:.6f} BTC for ${cummulative_quote:.2f}")

    # === Log ===
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "btc_bought": executed_qty,
        "price": btc_price,
        "usdt_spent": cummulative_quote,
        "units_requested": total_weeks,
        "note": "retry buy"
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

    # === Reset skipped weeks ===
    with open(RETAINED_FILE, "w") as f:
        json.dump({"skipped_weeks": 0}, f)

    # === Summary Stats ===
    with open(LOG_FILE, "r") as f:
        logs = json.load(f)
    total_spent = sum(e.get('usdt_spent', 0) for e in logs)
    total_btc = sum(e.get('btc_bought', 0) for e in logs)
    average_price = total_spent / total_btc if total_btc else 0

    timestamp = datetime.now().strftime("%d.%m.%Y %H:%M")
    send_email(
        "✅ Binance DCA - Retry Buy Executed",
        f"🔁 Retry BTC Purchase Executed\n\n"
        f"💰 BTC Bought: {executed_qty:.6f} BTC\n"
        f"💵 Price: ${btc_price:.2f}\n"
        f"🕒 Time: {timestamp}\n"
        f"📉 USDT Spent: ${cummulative_quote:.2f}\n"
        f"⭐ Average Buy Price: ${average_price:.2f}\n"
        f"💸 Total Invested: ${total_spent:.2f}"
    )

    # === Clear retry ===
    os.remove(RETRY_FILE)

except Exception as e:
    print(f"❌ Retry order FAILED: {e}")
    send_email("❌ Binance DCA - Retry Buy Failed", str(e))
    os.remove(RETRY_FILE)
