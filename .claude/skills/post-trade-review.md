---
name: post-trade-review
description: Automatically run after every trade to log results, extract lessons, and update strategy stats. MUST run after every sign_and_send.
model: opus
---

# Post-Trade Review

This skill runs AUTOMATICALLY after every trade execution. It's the learning loop.

## Trigger

Run this after EVERY call to `signer.sign_and_send` that completes (success or failure).

## Step 1: Log to Trade Journal

Create/append to `data/memory/trade-journal/YYYY-MM-DD.jsonl`:

```json
{
  "timestamp": "<ISO timestamp>",
  "agent": "<which agent executed>",
  "strategy": "<yield_farming|trading|arbitrage|airdrop_farming|staking>",
  "action": "<swap|supply|withdraw|approve|stake|unstake>",
  "direction": "<buy|sell|deposit|withdraw|neutral>",
  "token_in": "<token sold/deposited>",
  "token_out": "<token bought/received>",
  "amount_in": <amount>,
  "amount_out": <amount>,
  "amount_usd": <USD value>,
  "entry_price": <price at execution>,
  "signal": {
    "source": "<manual|rsi|macd|bollinger|arbitrage_spread|yield_opportunity>",
    "confidence": "<1-5>",
    "details": "<signal description>"
  },
  "reasoning": "<why this trade was made — 1-2 sentences>",
  "tx_hash": "<hash>",
  "gas_cost_eth": <gas>,
  "gas_cost_usd": <gas in USD>,
  "status": "<success|reverted|failed>",
  "explorer_url": "<basescan link>"
}
```

## Step 2: Evaluate Outcome

### For completed trades (position closed):

Calculate P&L:
```
pnl_usd = exit_value - entry_value - gas_costs
pnl_pct = (pnl_usd / entry_value) * 100
```

Classify:
- **Win:** pnl_usd > 0
- **Loss:** pnl_usd < 0
- **Break-even:** -$0.50 < pnl_usd < $0.50

### For yield/staking (ongoing positions):

Calculate unrealized P&L:
```
unrealized_pnl = current_value - deposited_value
yield_earned = interest_accrued
```

## Step 3: Update Strategy Stats

Read `data/memory/strategy-stats.json`, update the relevant strategy:

```python
strategy.trades += 1
if pnl > 0:
    strategy.wins += 1
else:
    strategy.losses += 1

strategy.total_pnl_usd += pnl
strategy.win_rate = strategy.wins / strategy.trades
strategy.avg_profit_usd = total_profits / strategy.wins (if wins > 0)
strategy.avg_loss_usd = total_losses / strategy.losses (if losses > 0)

if pnl > strategy.best_trade_usd:
    strategy.best_trade_usd = pnl
if pnl < strategy.worst_trade_usd:
    strategy.worst_trade_usd = pnl
```

Write back to `data/memory/strategy-stats.json`.

## Step 4: Extract Lesson (if applicable)

A lesson MUST be written to `data/memory/lessons.md` if ANY of these are true:

| Condition | Required? |
|-----------|-----------|
| Loss > $5 | ✅ Always |
| Loss > 3% of position | ✅ Always |
| Transaction reverted | ✅ Always |
| Unexpected slippage > 2% | ✅ Always |
| Win but wrong reasoning | ⚠️ Recommended |
| First trade of a new strategy | ⚠️ Recommended |

### Lesson format:

```markdown
## YYYY-MM-DD — [Short descriptive title]
- **Estrategia:** [strategy name]
- **Qué pasó:** [1-2 sentences describing the trade]
- **Resultado:** [P&L in $ and %]
- **Señal original:** [what signal triggered this]
- **Qué salió mal:** [root cause — be specific]
- **Lección:** [what to do differently next time]
- **Regla nueva:** [optional — a concrete rule to add to behavior]
- **Stats al momento:** [win rate, total P&L of this strategy]
```

## Step 5: Check Adaptive Rules

After updating stats, check if any adaptive rules trigger:

```
IF trading.win_rate < 0.40 AND trading.trades >= 10:
    → Update trading.confluence_threshold = 4
    → Write lesson: "Trading win rate below 40%. Raising confluence to 4/5."
    → Alert owner: "⚠️ Trading strategy underperforming. Raised threshold."

IF trading.win_rate < 0.30 AND trading.trades >= 20:
    → Write lesson: "Trading win rate critical. PAUSING strategy."
    → Alert owner: "🔴 Trading PAUSED — win rate {X}% after {N} trades."

IF any_strategy.total_pnl_usd < -20:
    → PAUSE that strategy
    → Alert owner: "🔴 {Strategy} PAUSED — cumulative loss ${X}."

IF arbitrage.losses / arbitrage.trades > 0.30 AND arbitrage.trades >= 5:
    → Increase arbitrage.min_spread_threshold by 0.1
    → Write lesson: "Arbitrage loss rate too high. Raising spread threshold."
```

## Step 6: Report to Telegram

Send a concise trade report:

```
[emoji] Trade Executed
━━━━━━━━━━━━━━━━━━
Strategy: [name]
Action: [buy/sell/deposit]
Amount: $XX.XX
Result: [+/-]$X.XX ([+/-]X.X%)
Gas: $0.001
Tx: basescan.org/tx/0x...

📊 Strategy stats: X wins / Y losses (Z% win rate)
💰 Daily P&L: [+/-]$X.XX
```

If a lesson was extracted, add:
```
📝 Lesson learned: [1-line summary]
```
