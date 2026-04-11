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

load_dotenv(dotenv_path=ENV_PATH)
api_key        = os.getenv("BINANCE_API_KEY")
api_secret     = os.getenv("BINANCE_API_SECRET")
email_sender   = os.getenv("EMAIL_USER")
email_password = os.getenv("EMAIL_PASSWORD")
email_receiver = os.getenv("EMAIL_RECEIVER")

# === Strategy Config (must match dispatcher.py exactly) ===
ATH_WINDOW_DAYS = 1825
MIN_DIP         = 0.15
ATH_BASE_USDT   = 25.0
ATH_MAX_USDT    = 1000.0
ATH_POW_N       = 2.1
ATH_MAX_RETAIN  = 5
MA_BASE_USDT    = 25.0
MA_TIERS = [
    (7,   1.0, "7d MA"),
    (30,  2.0, "30d MA"),
    (100, 3.0, "100d MA"),
    (200, 4.5, "200d MA"),
]
BUFFER = 1.10   # +10% price buffer

client = Client(api_key, api_secret)
print("📋 Sunday pre-check running...")


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


def read_retained():
    try:
        with open(RETAINED_FILE, "r") as f:
            return json.load(f).get("skipped_weeks", 0)
    except FileNotFoundError:
        return 0


# ── Fetch market data ─────────────────────────────────────────────────────────

btc_price   = float(client.get_symbol_ticker(symbol="BTCUSDT")['price'])
klines      = client.get_klines(symbol='BTCUSDT', interval='1d', limit=ATH_WINDOW_DAYS)
closes      = [float(k[4]) for k in klines]
highs       = [float(k[2]) for k in klines]
rolling_ath = max(highs)
dip_pct     = (rolling_ath - btc_price) / rolling_ath

ma_7   = sum(closes[-7:])   / 7
ma_30  = sum(closes[-30:])  / 30
ma_100 = sum(closes[-100:]) / 100
ma_200 = sum(closes[-200:]) / 200

retained = read_retained()

# ── USDT balance ──────────────────────────────────────────────────────────────

balances     = {a['asset']: float(a['free']) for a in client.get_account()['balances']}
usdt_balance = balances.get('USDT', 0.0)

print(f"💵 BTC: ${btc_price:,.2f}  |  ATH: ${rolling_ath:,.2f}  |  Dip: {dip_pct*100:.1f}%")
print(f"💼 USDT balance: ${usdt_balance:.2f}  |  Retained weeks: {retained}")

timestamp = datetime.now().strftime("%d.%m.%Y %H:%M")

# ── Route and estimate ────────────────────────────────────────────────────────

if dip_pct >= MIN_DIP:
    # ATH mode
    mode = "ATH"
    ratio        = min((dip_pct - MIN_DIP) / (1.0 - MIN_DIP), 1.0)
    pow_ratio    = ratio ** ATH_POW_N
    base_buy     = ATH_BASE_USDT + pow_ratio * (ATH_MAX_USDT - ATH_BASE_USDT)
    cap_ret      = min(retained, ATH_MAX_RETAIN)
    est_buy      = round(base_buy * (1 + cap_ret * 0.5), 2)
    recommended  = round(est_buy * BUFFER, 2)
    trigger_desc = f"BTC is {dip_pct*100:.1f}% below 5yr rolling ATH (≥15% threshold)"
    formula_desc = (f"  Base buy:    ${base_buy:,.2f}  (power curve at {dip_pct*100:.1f}% dip)\n"
                    f"  Retention:   {cap_ret} weeks (capped at {ATH_MAX_RETAIN}) → ×{1 + cap_ret*0.5:.1f}\n"
                    f"  Est. buy:    ${est_buy:,.2f}\n"
                    f"  +10% buffer: ${recommended:,.2f}  ← recommended minimum balance")

    # Also show what happens if price rises 10% before Monday (could exit buy zone)
    btc_10pct_up  = btc_price * 1.10
    dip_if_up     = (rolling_ath - btc_10pct_up) / rolling_ath
    if dip_if_up < MIN_DIP:
        price_warning = f"\n⚠️  If BTC rises 10% to ${btc_10pct_up:,.0f} by Monday it would exit the ATH buy zone (dip < 15%). MA mode would then apply instead."
    else:
        ratio_up  = min((dip_if_up - MIN_DIP) / (1.0 - MIN_DIP), 1.0)
        buy_up    = round((ATH_BASE_USDT + (ratio_up ** ATH_POW_N) * (ATH_MAX_USDT - ATH_BASE_USDT)) * (1 + cap_ret * 0.5), 2)
        price_warning = f"\n📈 If BTC rises 10% to ${btc_10pct_up:,.0f}: estimated buy drops to ${buy_up:,.2f}."

else:
    # MA mode — find active tier
    ma_values = {7: ma_7, 30: ma_30, 100: ma_100, 200: ma_200}
    found_tier = None
    for days, mult, label in MA_TIERS:
        if btc_price < ma_values[days]:
            found_tier = (mult, label)
            break

    if found_tier:
        mode = "MA"
        multiplier, trigger_label = found_tier
        total_weeks  = retained + 1
        est_buy      = round(MA_BASE_USDT * multiplier * total_weeks, 2)
        recommended  = round(est_buy * BUFFER, 2)
        ma_val_for_trigger = {label: ma_values[days] for days, _, label in MA_TIERS}[trigger_label]
        trigger_desc = f"BTC (${btc_price:,.2f}) is below {trigger_label} (${ma_val_for_trigger:,.2f})"
        formula_desc = (f"  Trigger:     {trigger_label} (price below MA)\n"
                        f"  Multiplier:  {multiplier}×\n"
                        f"  Weeks:       {total_weeks} ({retained} retained + 1 current)\n"
                        f"  Est. buy:    ${est_buy:,.2f}  ({total_weeks} × $25 × {multiplier})\n"
                        f"  +10% buffer: ${recommended:,.2f}  ← recommended minimum balance")
        price_warning = f"\n📈 If BTC rises 10% to ${btc_price * 1.10:,.0f}: may exit {trigger_label} zone — buy size could decrease or a different tier could apply."
    else:
        # No trigger currently active
        mode = "NONE"
        est_buy     = 0
        recommended = 0
        trigger_desc = "BTC is above all moving averages and within 15% of ATH — no buy expected"
        formula_desc = (f"  No MA trigger active at current price.\n"
                        f"  If this holds Monday: no buy, retained increments to {retained + 1}.\n"
                        f"  No USDT needed unless price drops before Monday.")
        price_warning = (f"\n  7d MA:   ${ma_7:,.2f}  (need price below this to trigger cheapest tier)\n"
                         f"  30d MA:  ${ma_30:,.2f}\n"
                         f"  100d MA: ${ma_100:,.2f}\n"
                         f"  200d MA: ${ma_200:,.2f}")

# ── Balance assessment ────────────────────────────────────────────────────────

if mode == "NONE":
    balance_status = "✅ No buy expected — no top-up needed."
    subject_status = "⏭️ No Buy Expected"
elif usdt_balance >= recommended:
    shortfall      = 0
    balance_status = f"✅ Balance sufficient — ${usdt_balance:.2f} available, ${recommended:.2f} recommended."
    subject_status = "✅ Balance OK"
else:
    shortfall      = round(recommended - usdt_balance, 2)
    balance_status = f"⚠️  Top-up recommended — ${usdt_balance:.2f} available, ${recommended:.2f} needed. Deposit at least ${shortfall:.2f} before Monday 09:00."
    subject_status = f"⚠️ Top Up ${shortfall:.2f}"

print(f"📊 Mode: {mode}  |  Est. buy: ${est_buy:.2f}  |  Recommended: ${recommended:.2f}")
print(balance_status)

# ── Build and send email ──────────────────────────────────────────────────────

body = f"""📋 Weekly Pre-Check — Sunday {timestamp}
{'─' * 52}

MARKET SNAPSHOT
  BTC Price:      ${btc_price:,.2f}
  5yr Rolling ATH: ${rolling_ath:,.2f}
  Dip from ATH:   {dip_pct*100:.1f}%
  Mode:           {mode}-DCA{"  (" + trigger_desc + ")" if mode != "NONE" else "  (" + trigger_desc + ")"}

  7d MA:   ${ma_7:,.2f}
  30d MA:  ${ma_30:,.2f}
  100d MA: ${ma_100:,.2f}
  200d MA: ${ma_200:,.2f}

RETAINED WEEKS: {retained}

ESTIMATED BUY (if conditions hold until Monday 09:00)
{formula_desc}
{price_warning}

YOUR BALANCE
  USDT available: ${usdt_balance:,.2f}

{balance_status}
{'─' * 52}
Prices can change before the buy. The +10% buffer accounts for upward price movement.
The bot recalculates everything fresh at 09:00 Monday using live market data.
"""

subject = f"📋 Hybrid Bot Pre-Check — {subject_status} — {datetime.now().strftime('%a %d %b')}"
send_email(subject, body)
print("✅ Pre-check complete.")
