import os
import json
from datetime import datetime
from dotenv import load_dotenv
from binance.client import Client
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import ssl

# === Paths and Config ===
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
ENV_PATH    = os.path.join(SCRIPT_DIR, ".env")
LOG_FILE    = os.path.join(SCRIPT_DIR, "buy_log.json")
RETRY_FILE  = os.path.join(SCRIPT_DIR, "retry.json")

load_dotenv(dotenv_path=ENV_PATH)
api_key        = os.getenv("BINANCE_API_KEY")
api_secret     = os.getenv("BINANCE_API_SECRET")
email_sender   = os.getenv("EMAIL_USER")
email_password = os.getenv("EMAIL_PASSWORD")
email_receiver = os.getenv("EMAIL_RECEIVER")

# === ATH-DCA Strategy Config ===
ATH_WINDOW_DAYS = 1825   # 5 years of daily candles
MIN_DIP         = 0.15   # start buying at -15% below rolling ATH
BASE_USDT       = 25.0   # minimum buy at trigger (-15%)
MAX_USDT        = 500.0  # maximum buy (approached at extreme crashes ~-90%)
POW_N           = 2.1    # power curve exponent — slow start, accelerates at deep crashes
# Scaling: power curve ratio^2.1 — stays cheap at moderate dips (-30%: ~$50),
# ramps hard at extreme crashes (-70%: ~$400, -90%: ~$775)

# === Initialize Client ===
client = Client(api_key, api_secret)
print("🌐 Using Binance LIVE endpoint")

# === Email Helper ===
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

# === Get Current BTC Price ===
btc_price = float(client.get_symbol_ticker(symbol="BTCUSDT")['price'])
print(f"💵 Current BTC price: ${btc_price:,.2f}")

# === Calculate 5-Year Rolling ATH ===
klines      = client.get_klines(symbol='BTCUSDT', interval='1d', limit=ATH_WINDOW_DAYS)
rolling_ath = max(float(k[2]) for k in klines)  # k[2] = daily high
print(f"📈 5-year rolling ATH: ${rolling_ath:,.2f}")

# === Calculate Dip from ATH ===
dip_pct = (rolling_ath - btc_price) / rolling_ath
print(f"📉 Dip from ATH: {dip_pct * 100:.1f}%")

# === Buy Decision ===
if dip_pct < MIN_DIP:
    print(f"⏭️  Price is only {dip_pct * 100:.1f}% below ATH — below {MIN_DIP * 100:.0f}% threshold. No buy.")
else:
    # Power curve scaling: slow at moderate dips, accelerates hard at extreme crashes
    ratio      = min((dip_pct - MIN_DIP) / (1.0 - MIN_DIP), 1.0)
    pow_ratio  = ratio ** POW_N  # maps 0→0, 1→1 with slow start, fast end
    buy_amount = BASE_USDT + pow_ratio * (MAX_USDT - BASE_USDT)
    buy_amount = round(buy_amount, 2)

    print(f"✅ Buy signal — ratio: {ratio:.2f}, buy size: ${buy_amount:.2f}")

    # === Check Balance ===
    balances     = {a['asset']: float(a['free']) for a in client.get_account()['balances']}
    usdt_balance = balances.get('USDT', 0.0)
    print(f"💼 USDT balance: ${usdt_balance:.2f}")

    if usdt_balance < buy_amount:
        # Save retry flag — retry_buy.py will re-run full logic tomorrow
        with open(RETRY_FILE, "w") as f:
            json.dump({"failed_at": datetime.utcnow().isoformat()}, f)
        subject = "❌ ATH-DCA - Insufficient Balance (retry scheduled)"
        body    = (
            f"Insufficient balance to execute buy.\n"
            f"Needed: ${buy_amount:.2f}, Available: ${usdt_balance:.2f}\n"
            f"Dip from ATH: {dip_pct * 100:.1f}%\n"
            f"Rolling ATH (5yr): ${rolling_ath:,.2f}\n\n"
            f"A retry has been scheduled for tomorrow at 09:30."
        )
        send_email(subject, body)
        print(subject)
    else:
        try:
            print("🚀 Placing LIVE BUY order...")

            order = client.create_order(
                symbol='BTCUSDT',
                side='BUY',
                type='MARKET',
                quoteOrderQty=buy_amount
            )

            executed_qty      = float(order['executedQty'])
            cummulative_quote = float(order['cummulativeQuoteQty'])

            print(f"📦 Order filled: {executed_qty:.6f} BTC for ${cummulative_quote:.2f}")

            # === Log the Buy ===
            log_entry = {
                "timestamp":   datetime.utcnow().isoformat(),
                "btc_bought":  executed_qty,
                "price":       btc_price,
                "usdt_spent":  cummulative_quote,
                "rolling_ath": rolling_ath,
                "dip_pct":     round(dip_pct * 100, 2),
                "pow_ratio":   round(pow_ratio, 4),
                "buy_amount":  buy_amount,
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

            body = (
                f"✅ ATH-DCA Buy Executed\n\n"
                f"💰 BTC Bought: {executed_qty:.6f} BTC\n"
                f"💵 Price: ${btc_price:,.2f}\n"
                f"🕒 Time: {timestamp}\n"
                f"📉 USDT Spent: ${cummulative_quote:.2f}\n"
                f"📈 5yr Rolling ATH: ${rolling_ath:,.2f}\n"
                f"📉 Dip from ATH: {dip_pct * 100:.1f}%\n"
                f"⚖️  Scale Ratio: {ratio * 100:.0f}%\n\n"
                f"⭐ Average Buy Price: ${average_price:,.2f}\n"
                f"💸 Total Invested: ${total_spent:,.2f}"
            )
            send_email(subject="✅ ATH-DCA - Buy Executed", body=body)

        except Exception as e:
            print(f"❌ Order failed: {e}")
            send_email("❌ ATH-DCA - Buy Failed", str(e))
