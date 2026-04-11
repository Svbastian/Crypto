# BTC-DCA-BOT — Deprecated

This bot has been replaced by the **Hybrid DCA Dispatcher**.

`binance-DCA.py` and `retry_buy.py` are kept for reference but are **not active** in crontab.

The MA-mode buying logic from this bot lives on inside `HYBRID-DCA-BOT/dispatcher.py`.
MA-mode buys are still logged to `BTC-DCA-BOT/buy_log.json` by the hybrid dispatcher.

See `HYBRID-DCA-BOT/CONTEXT.md` for current setup documentation.
