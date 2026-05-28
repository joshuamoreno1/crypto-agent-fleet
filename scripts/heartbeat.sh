#!/usr/bin/env zsh
# Heartbeat for Crypto Agent Fleet
# Sends a periodic prompt to the Overseer via the Telegram bot.
# Compatible with Agent Teams + Telegram channel running together.
#
# Edit BOT_TOKEN and CHAT_ID below with your values (same ones used in
# start-fleet.sh and CLAUDE.md). Install via install-heartbeat.sh (macOS launchd).

BOT_TOKEN="<YOUR_TELEGRAM_BOT_TOKEN>"
CHAT_ID="<YOUR_TELEGRAM_CHAT_ID>"

HOUR=$(date +%H)
MINUTE=$(date +%M)
DAY_OF_WEEK=$(date +%u)  # 1=Mon, 7=Sun

# Pick the message based on the time of day
if [[ $HOUR -eq 8 && $MINUTE -lt 30 ]]; then
  MSG="🌅 MORNING HEARTBEAT: Run the daily checklist:
1. Read data/memory/ for context from the previous day
2. Full portfolio scan (balances + prices + P&L)
3. Review buy/sell opportunities on current and new tokens
4. Scan technical signals on every token we hold
5. Cross-DEX arbitrage scan
6. Polymarket: review open positions, P&L, and markets near resolution
7. Polymarket: scan trending markets with edge > 5%
Reply here with an executive summary."

elif [[ $HOUR -eq 20 && $MINUTE -lt 30 ]]; then
  MSG="📊 DAILY CLOSE HEARTBEAT: Generate the P&L report:
1. Full portfolio scan
2. Summary of trades executed today
3. P&L by strategy (include Polymarket)
4. Updated win rate
5. Polymarket: open positions, markets that resolved today
6. Lessons learned → save to data/memory/lessons.md
Send the full report here."

elif [[ $DAY_OF_WEEK -eq 7 && $HOUR -eq 10 && $MINUTE -lt 30 ]]; then
  MSG="📋 WEEKLY HEARTBEAT: Run weekly-review:
1. Aggregated weekly performance
2. Current allocation vs targets in policy.json
3. Best and worst strategy of the week (include Polymarket)
4. Polymarket: review positions — any to close/adjust?
5. Polymarket: new opportunities this week with edge > 5%
6. Parameter adjustments if needed
Send the weekly report here."

else
  MSG="💓 HEARTBEAT: Quick checklist:
1. Any new technical signals on tokens we hold?
2. Any arbitrage opportunities?
3. Any new tokens/memecoins worth a look?
4. Polymarket: any new markets with edge > 5%?
5. Polymarket: any open position close to resolution?
If something is actionable → evaluate → execute if approved.
Silence = all OK."
fi

# Send via Telegram Bot API
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d chat_id="${CHAT_ID}" \
  -d text="${MSG}" > /dev/null
