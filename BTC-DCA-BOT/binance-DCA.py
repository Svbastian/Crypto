import os
import json
from datetime import datetime
from dotenv import load_dotenv
from binance.client import Client
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import ssl

load_dotenv()  # ✅ This loads variables from .env

# === Paths and Config ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(SCRIPT_DIR, ".env")
load_dotenv(dotenv_path=ENV_PATH)
RETAINED_FILE = os.path.join(SCRIPT_DIR, "retained.json")
LOG_FILE = os.path.join(SCRIPT_DIR, "buy_log.json")

# === Load .env ===
load_dotenv(dotenv_path=ENV_PATH)
api_key = os.getenv("BINANCE_API_KEY")
api_secret = os.getenv("BINANCE_API_SECRET")
email_sender = os.getenv("EMAIL_USER")
email_password = os.getenv("EMAIL_PASSWORD")
email_receiver = os.getenv("EMAIL_RECEIVER")
email_host = os.getenv("EMAIL_HOST")
email_port = int(os.getenv("EMAIL_PORT"))

# === Initialize Client ===
client = Client(api_key, api_secret)
print(f"🌐 Using Binance LIVE endpoint")

# === Email Helper ===
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
        print("❌ Failed to send email:")
        print(e)

# === Get BTC Price ===
btc_price = float(client.get_symbol_ticker(symbol="BTCUSDT")['price'])
print(f"Current BTC price: ${btc_price:.2f}")

# === Calculate Moving Averages ===
def get_moving_average(days):
    klines = client.get_historical_klines("BTCUSDT", Client.KLINE_INTERVAL_1DAY, f"{days} days ago UTC")
    closes = [float(kline[4]) for kline in klines]
    return sum(closes) / len(closes)

ma_7 = get_moving_average(7)
ma_30 = get_moving_average(30)
ma_100 = get_moving_average(100)
ma_200 = get_moving_average(200)

print(f"7-day MA:   ${ma_7:.2f}")
print(f"30-day MA:  ${ma_30:.2f}")
print(f"100-day MA: ${ma_100:.2f}")
print(f"200-day MA: ${ma_200:.2f}")

# === Buy Decision ===
should_buy = False
base_unit = 0

if btc_price < ma_7:
    should_buy = True
    base_unit = 1
elif btc_price < ma_30:
    should_buy = True
    base_unit = 2
elif btc_price < ma_100:
    should_buy = True
    base_unit = 3
elif btc_price < ma_200:
    should_buy = True
    base_unit = 4.5

# === Load Skipped Weeks ===
try:
    with open(RETAINED_FILE, "r") as f:
        skipped_weeks = json.load(f).get("skipped_weeks", 0)
except FileNotFoundError:
    skipped_weeks = 0

# === Execute Buy ===
if should_buy:
    total_weeks = skipped_weeks + 1
    total_to_buy = base_unit * total_weeks
    usdt_per_unit = 25
    quote_order_value = usdt_per_unit * total_to_buy

    # === Check Balance ===
    balances = {asset['asset']: float(asset['free']) for asset in client.get_account()['balances']}
    usdt_balance = balances.get('USDT', 0.0)

    if usdt_balance < quote_order_value:
        # Save retry job so retry_buy.py can attempt again in 24h
        retry_data = {
            "quote_order_value": quote_order_value,
            "base_unit": base_unit,
            "total_weeks": total_weeks,
            "skipped_weeks_at_failure": skipped_weeks,
            "failed_at": datetime.utcnow().isoformat()
        }
        with open(os.path.join(SCRIPT_DIR, "retry.json"), "w") as f:
            json.dump(retry_data, f, indent=2)

        subject = "❌ Binance DCA - Insufficient Balance"
        body = (
            f"Insufficient balance to execute buy.\n"
            f"Needed: ${quote_order_value:.2f}, Available: ${usdt_balance:.2f}\n"
            f"BTC Units Attempted: {total_to_buy}\n\n"
            f"A retry has been scheduled for 24h from now."
        )
        send_email(subject, body)
        print(subject)
    else:
        try:
            print("🚀 Preparing LIVE BUY order...")

            order = client.create_order(
                symbol='BTCUSDT',
                side='BUY',
                type='MARKET',
                quoteOrderQty=round(quote_order_value, 2)
            )

            executed_qty = float(order['executedQty'])
            cummulative_quote = float(order['cummulativeQuoteQty'])

            print("📦 LIVE BUY order placed!")
            print(order)

            # === Logging ===
            log_entry = {
                "timestamp": datetime.utcnow().isoformat(),
                "btc_bought": executed_qty,
                "price": btc_price,
                "usdt_spent": cummulative_quote,
                "units_requested": total_to_buy
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

            print("📝 Logged live buy to buy_log.json")

            # === Summary Stats ===
            total_spent = sum(entry.get('usdt_spent', 0) for entry in logs)
            total_btc = sum(entry.get('btc_bought', 0) for entry in logs)
            average_price = total_spent / total_btc if total_btc else 0

            timestamp = datetime.now().strftime("%d.%m.%Y %H:%M")
            body = (
                f"🚨 LIVE BTC Purchase Executed\n\n"
                f"💰 BTC Bought: {executed_qty:.6f} BTC\n"
                f"💵 Price: ${btc_price:.2f}\n"
                f"🕒 Time: {timestamp}\n"
                f"📉 USDT Spent: ${cummulative_quote:.2f}\n"
                f"📦 Units Requested: {total_to_buy}\n"
                f"⭐ Average Buy Price: ${average_price:.2f}\n"
                f"💸 Total Invested: ${total_spent:.2f}"
            )
            send_email(subject="✅ Binance DCA - LIVE Buy Executed", body=body)

            # === Reset Skipped Weeks ===
            with open(RETAINED_FILE, "w") as f:
                json.dump({"skipped_weeks": 0}, f)

        except Exception as e:
            print("❌ LIVE order FAILED:")
            print(e)
            send_email("❌ Binance DCA - LIVE Buy Failed", str(e))

else:
    skipped_weeks += 1
    print("❌ No buy signal this week. Skipping.")
    print(f"⏳ Skipped weeks now: {skipped_weeks}")
    with open(RETAINED_FILE, "w") as f:
        json.dump({"skipped_weeks": skipped_weeks}, f)
