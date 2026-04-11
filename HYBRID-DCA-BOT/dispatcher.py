import os
import json
from datetime import datetime
from dotenv import load_dotenv
from binance.client import Client
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import ssl

# === Paths ===
SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
REPO_DIR      = os.path.dirname(SCRIPT_DIR)
ENV_PATH      = os.path.join(REPO_DIR, "BTC-DCA-BOT", ".env")
RETAINED_FILE = os.path.join(SCRIPT_DIR, "retained.json")
RETRY_FILE    = os.path.join(SCRIPT_DIR, "retry.json")
ATH_LOG       = os.path.join(REPO_DIR, "ATH-DCA-BOT", "buy_log.json")
MA_LOG        = os.path.join(REPO_DIR, "BTC-DCA-BOT", "buy_log.json")

load_dotenv(dotenv_path=ENV_PATH)
api_key        = os.getenv("BINANCE_API_KEY")
api_secret     = os.getenv("BINANCE_API_SECRET")
email_sender   = os.getenv("EMAIL_USER")
email_password = os.getenv("EMAIL_PASSWORD")
email_receiver = os.getenv("EMAIL_RECEIVER")

# === Strategy Config ===
ATH_WINDOW_DAYS = 1825    # 5 years of daily candles
MIN_DIP         = 0.15    # ≥15% below rolling ATH → ATH mode; <15% → MA mode

# ATH mode
ATH_BASE_USDT  = 25.0
ATH_MAX_USDT   = 500.0
ATH_POW_N      = 2.1
ATH_MAX_RETAIN = 5        # retained-week cap for ATH mode only

# MA mode  (ordered: check cheapest tier first — price below 7d MA is most common)
MA_BASE_USDT = 25.0
MA_TIERS = [
    (7,   1.0, "7d MA"),
    (30,  2.0, "30d MA"),
    (100, 3.0, "100d MA"),
    (200, 4.5, "200d MA"),
]

client = Client(api_key, api_secret)
print("🌐 Hybrid Dispatcher — Binance LIVE")


# ── Helpers ──────────────────────────────────────────────────────────────────

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


def append_log(log_file, entry):
    """Append entry to a JSON array log file; returns full log list."""
    try:
        with open(log_file, "r+") as f:
            logs = json.load(f)
            logs.append(entry)
            f.seek(0)
            json.dump(logs, f, indent=2)
    except FileNotFoundError:
        logs = [entry]
        with open(log_file, "w") as f:
            json.dump(logs, f, indent=2)
    return logs


def read_retained():
    try:
        with open(RETAINED_FILE, "r") as f:
            return json.load(f).get("skipped_weeks", 0)
    except FileNotFoundError:
        return 0


def write_retained(n):
    with open(RETAINED_FILE, "w") as f:
        json.dump({"skipped_weeks": n}, f)


def write_retry_flag():
    """Save retry flag after an insufficient-balance failure. retry_dispatcher.py picks this up."""
    with open(RETRY_FILE, "w") as f:
        json.dump({"attempts_made": 0, "created_at": datetime.utcnow().isoformat()}, f)


# ── Market Data (single klines call) ─────────────────────────────────────────

klines = client.get_klines(symbol='BTCUSDT', interval='1d', limit=ATH_WINDOW_DAYS)
closes = [float(k[4]) for k in klines]
highs  = [float(k[2]) for k in klines]

btc_price   = float(client.get_symbol_ticker(symbol="BTCUSDT")['price'])
rolling_ath = max(highs)
dip_pct     = (rolling_ath - btc_price) / rolling_ath

ma_7   = sum(closes[-7:])   / 7
ma_30  = sum(closes[-30:])  / 30
ma_100 = sum(closes[-100:]) / 100
ma_200 = sum(closes[-200:]) / 200

print(f"💵 BTC Price:       ${btc_price:,.2f}")
print(f"📈 5yr Rolling ATH: ${rolling_ath:,.2f}")
print(f"📉 Dip from ATH:    {dip_pct * 100:.1f}%")
print(f"📊 MAs — 7d: ${ma_7:,.2f}  |  30d: ${ma_30:,.2f}  |  100d: ${ma_100:,.2f}  |  200d: ${ma_200:,.2f}")

retained  = read_retained()
timestamp = datetime.now().strftime("%d.%m.%Y %H:%M")
print(f"📦 Retained weeks: {retained}")


# ─────────────────────────────────────────────────────────────────────────────
# ATH MODE  —  dip ≥ 15% from rolling ATH
# ─────────────────────────────────────────────────────────────────────────────
if dip_pct >= MIN_DIP:
    print(f"\n🔀 Mode: ATH-DCA  ({dip_pct * 100:.1f}% below ATH)")

    ratio     = min((dip_pct - MIN_DIP) / (1.0 - MIN_DIP), 1.0)
    pow_ratio = ratio ** ATH_POW_N
    base_buy  = round(ATH_BASE_USDT + pow_ratio * (ATH_MAX_USDT - ATH_BASE_USDT), 2)

    # Retained weeks: full today's buy + each retained week adds 0.5× of base
    capped_retained = min(retained, ATH_MAX_RETAIN)
    total_buy       = round(base_buy * (1 + capped_retained * 0.5), 2)

    print(f"✅ ATH buy — base: ${base_buy:.2f}  ×  {1 + capped_retained * 0.5:.1f}  "
          f"({capped_retained} retained wks, capped at {ATH_MAX_RETAIN})  →  total: ${total_buy:.2f}")

    balances     = {a['asset']: float(a['free']) for a in client.get_account()['balances']}
    usdt_balance = balances.get('USDT', 0.0)
    print(f"💼 USDT balance: ${usdt_balance:.2f}")

    if usdt_balance < total_buy:
        print(f"❌ Insufficient balance. Needed: ${total_buy:.2f}, Available: ${usdt_balance:.2f}")
        write_retry_flag()
        send_email(
            "❌ Hybrid Bot — ATH Mode: Insufficient Balance (retry in 4h)",
            f"Insufficient balance for ATH-mode buy.\n\n"
            f"Needed:    ${total_buy:.2f}  (${base_buy:.2f} base × {1 + capped_retained * 0.5:.1f})\n"
            f"Available: ${usdt_balance:.2f}\n"
            f"Retained weeks (actual / capped): {retained} / {capped_retained}\n\n"
            f"BTC: ${btc_price:,.2f}  |  ATH: ${rolling_ath:,.2f}  |  Dip: {dip_pct * 100:.1f}%\n\n"
            f"Retry 1 at 13:00, Retry 2 at 17:00. If both fail, week is added to retained counter."
        )
    else:
        try:
            order = client.create_order(
                symbol='BTCUSDT', side='BUY', type='MARKET', quoteOrderQty=total_buy
            )
            executed_qty      = float(order['executedQty'])
            cummulative_quote = float(order['cummulativeQuoteQty'])
            print(f"📦 ATH order filled: {executed_qty:.6f} BTC for ${cummulative_quote:.2f}")

            log_entry = {
                "timestamp":       datetime.utcnow().isoformat(),
                "btc_bought":      executed_qty,
                "price":           btc_price,
                "usdt_spent":      cummulative_quote,
                "rolling_ath":     rolling_ath,
                "dip_pct":         round(dip_pct * 100, 2),
                "pow_ratio":       round(pow_ratio, 4),
                "buy_amount":      total_buy,
                "base_buy":        base_buy,
                "retained_weeks":  capped_retained,
                "note":            "hybrid dispatcher — ATH mode",
            }
            logs = append_log(ATH_LOG, log_entry)
            write_retained(0)
            print("📝 Logged to ATH-DCA-BOT/buy_log.json  |  Retained reset to 0")

            total_spent   = sum(e.get('usdt_spent', 0) for e in logs)
            total_btc     = sum(e.get('btc_bought', 0) for e in logs)
            average_price = total_spent / total_btc if total_btc else 0

            send_email(
                "✅ Hybrid Bot — ATH Buy Executed",
                f"🔻 ATH-DCA Mode — Buy Executed\n\n"
                f"💰 BTC Bought: {executed_qty:.6f} BTC\n"
                f"💵 Price: ${btc_price:,.2f}\n"
                f"🕒 Time: {timestamp}\n"
                f"📉 USDT Spent: ${cummulative_quote:.2f}\n"
                f"   └ Base: ${base_buy:.2f}  ×  {1 + capped_retained * 0.5:.1f}  ({capped_retained} retained wks)\n"
                f"📈 5yr Rolling ATH: ${rolling_ath:,.2f}\n"
                f"📉 Dip from ATH: {dip_pct * 100:.1f}%\n\n"
                f"⭐ ATH Bot Avg Buy Price: ${average_price:,.2f}\n"
                f"💸 ATH Bot Total Invested: ${total_spent:,.2f}"
            )
        except Exception as e:
            print(f"❌ ATH order failed: {e}")
            send_email("❌ Hybrid Bot — ATH Buy Failed", str(e))


# ─────────────────────────────────────────────────────────────────────────────
# MA MODE  —  dip < 15% from rolling ATH
# ─────────────────────────────────────────────────────────────────────────────
else:
    print(f"\n🔀 Mode: MA-DCA  ({dip_pct * 100:.1f}% below ATH — within 15% zone)")

    ma_values  = {7: ma_7, 30: ma_30, 100: ma_100, 200: ma_200}
    multiplier    = None
    trigger_label = None

    for days, mult, label in MA_TIERS:
        if btc_price < ma_values[days]:
            multiplier    = mult
            trigger_label = label
            break

    if multiplier is None:
        # ── No MA trigger — increment retained weeks ──────────────────────────
        retained += 1
        write_retained(retained)
        print(f"⏭️  No MA trigger. BTC above all MAs. Retained weeks → {retained}")
        send_email(
            "⏭️ Hybrid Bot — No Buy This Week",
            f"No buy signal this week.\n\n"
            f"BTC (${btc_price:,.2f}) is above all moving averages and within 15% of ATH.\n\n"
            f"7d MA:   ${ma_7:,.2f}\n"
            f"30d MA:  ${ma_30:,.2f}\n"
            f"100d MA: ${ma_100:,.2f}\n"
            f"200d MA: ${ma_200:,.2f}\n\n"
            f"Dip from ATH: {dip_pct * 100:.1f}%\n"
            f"Retained weeks now: {retained}"
        )
    else:
        # ── MA buy ────────────────────────────────────────────────────────────
        total_weeks = retained + 1
        total_buy   = round(MA_BASE_USDT * multiplier * total_weeks, 2)
        print(f"✅ MA buy — trigger: {trigger_label}, mult: {multiplier}×, "
              f"weeks: {total_weeks}, total: ${total_buy:.2f}")

        balances     = {a['asset']: float(a['free']) for a in client.get_account()['balances']}
        usdt_balance = balances.get('USDT', 0.0)
        print(f"💼 USDT balance: ${usdt_balance:.2f}")

        if usdt_balance < total_buy:
            print(f"❌ Insufficient balance. Needed: ${total_buy:.2f}, Available: ${usdt_balance:.2f}")
            write_retry_flag()
            send_email(
                "❌ Hybrid Bot — MA Mode: Insufficient Balance (retry in 4h)",
                f"Insufficient balance for MA-mode buy.\n\n"
                f"Needed:    ${total_buy:.2f}  ({total_weeks} wks × $25 × {multiplier}×)\n"
                f"Available: ${usdt_balance:.2f}\n"
                f"Trigger:   {trigger_label}\n\n"
                f"BTC: ${btc_price:,.2f}  |  Dip from ATH: {dip_pct * 100:.1f}%\n\n"
                f"Retry 1 at 13:00, Retry 2 at 17:00. If both fail, week is added to retained counter."
            )
        else:
            try:
                order = client.create_order(
                    symbol='BTCUSDT', side='BUY', type='MARKET', quoteOrderQty=total_buy
                )
                executed_qty      = float(order['executedQty'])
                cummulative_quote = float(order['cummulativeQuoteQty'])
                print(f"📦 MA order filled: {executed_qty:.6f} BTC for ${cummulative_quote:.2f}")

                log_entry = {
                    "timestamp":             datetime.utcnow().isoformat(),
                    "btc_bought":            executed_qty,
                    "price":                 btc_price,
                    "usdt_spent":            cummulative_quote,
                    "units_requested":       multiplier * total_weeks,
                    "trigger":               trigger_label,
                    "retainedWeeksIncluded": total_weeks,
                    "multiplier":            multiplier,
                    "formula":               f"{total_weeks} × 25 × {multiplier}",
                    "note":                  "hybrid dispatcher — MA mode",
                }
                logs = append_log(MA_LOG, log_entry)
                write_retained(0)
                print("📝 Logged to BTC-DCA-BOT/buy_log.json  |  Retained reset to 0")

                total_spent   = sum(e.get('usdt_spent', 0) for e in logs)
                total_btc     = sum(e.get('btc_bought', 0) for e in logs)
                average_price = total_spent / total_btc if total_btc else 0

                send_email(
                    f"✅ Hybrid Bot — MA Buy Executed ({trigger_label})",
                    f"📊 MA-DCA Mode — Buy Executed\n\n"
                    f"💰 BTC Bought: {executed_qty:.6f} BTC\n"
                    f"💵 Price: ${btc_price:,.2f}\n"
                    f"🕒 Time: {timestamp}\n"
                    f"📉 USDT Spent: ${cummulative_quote:.2f}\n"
                    f"   └ Formula: {total_weeks} wks × $25 × {multiplier}×  ({trigger_label})\n\n"
                    f"7d MA:   ${ma_7:,.2f}\n"
                    f"30d MA:  ${ma_30:,.2f}\n"
                    f"100d MA: ${ma_100:,.2f}\n"
                    f"200d MA: ${ma_200:,.2f}\n\n"
                    f"Dip from ATH: {dip_pct * 100:.1f}%\n\n"
                    f"⭐ MA Bot Avg Buy Price: ${average_price:,.2f}\n"
                    f"💸 MA Bot Total Invested: ${total_spent:,.2f}"
                )
            except Exception as e:
                print(f"❌ MA order failed: {e}")
                send_email("❌ Hybrid Bot — MA Buy Failed", str(e))
