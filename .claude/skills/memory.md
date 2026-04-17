---
name: memory
description: Read and write agent memory — lessons learned, strategy stats, market patterns, and trade journal. ALWAYS read memory at session start.
model: sonnet
---

# Memory System

## On Session Start (MANDATORY)

Every time a new session starts, read these files in order:

1. `data/memory/lessons.md` — Past mistakes and learnings. **DO NOT REPEAT THESE MISTAKES.**
2. `data/memory/strategy-stats.json` — Performance stats per strategy. Adjust behavior based on win rates.
3. `data/memory/market-patterns.md` — Observed market patterns. Factor into decisions.
4. Last 3 days of `data/memory/trade-journal/` — Recent trade context.

## Reading Memory

```bash
# Lessons (most important — read FIRST)
cat data/memory/lessons.md

# Strategy performance
cat data/memory/strategy-stats.json

# Market patterns
cat data/memory/market-patterns.md

# Recent trades (last 3 days)
for f in $(ls data/memory/trade-journal/*.jsonl 2>/dev/null | tail -3); do
  echo "=== $(basename $f) ==="
  cat "$f"
done
```

## Writing to Trade Journal

After EVERY trade, append a JSONL entry to `data/memory/trade-journal/YYYY-MM-DD.jsonl`:

```json
{
  "timestamp": "2026-04-01T15:30:00Z",
  "agent": "trader",
  "strategy": "trading",
  "action": "swap",
  "direction": "buy",
  "token": "ETH",
  "amount_usd": 10.00,
  "entry_price": 2450.00,
  "signal": {
    "rsi": 28,
    "macd": "bullish_cross",
    "bollinger": "lower_band",
    "confluence": 3
  },
  "reasoning": "RSI oversold + MACD bullish cross + price at lower Bollinger. 3/5 confluence.",
  "tx_hash": "0xabc...",
  "status": "executed",
  "exit_price": null,
  "pnl_usd": null,
  "lesson": null
}
```

When the position is closed, append another entry with `exit_price`, `pnl_usd`, and `lesson` if applicable.

## Writing Lessons

When a trade results in a loss > $5 OR an unexpected outcome:

```markdown
## YYYY-MM-DD — [Short title]
- **What happened:** [Description of what happened]
- **Result:** [P&L and outcome]
- **Why:** [Root cause analysis]
- **Lesson:** [What to do differently]
- **New rule:** [If applicable — a concrete rule to follow]
```

Append to `data/memory/lessons.md` — NEVER overwrite existing lessons.

## Updating Strategy Stats

After each trade, update `data/memory/strategy-stats.json`:
- Increment `trades` count
- Update `wins`/`losses` based on P&L
- Recalculate `win_rate`, `avg_profit_usd`, `avg_loss_usd`
- Update `best_trade_usd` and `worst_trade_usd` if applicable

## Adaptive Behavior Rules

Based on strategy-stats.json, adjust behavior:

| Condition | Action |
|-----------|--------|
| Trading win_rate < 40% after 10+ trades | Raise confluence_threshold to 4/5 |
| Trading win_rate < 30% after 20+ trades | PAUSE trading strategy, alert owner |
| Arbitrage loss rate > 30% | Raise min_spread_threshold by 0.1% |
| Yield farming APY consistently < 2% | Consider moving to staking |
| Any strategy losing > $20 cumulative | PAUSE and alert owner |

## Market Patterns

When you observe a recurring pattern (same thing happens 3+ times):

```markdown
## [Token] — [Pattern name]
- Observed: [date range]
- Description: [what happens]
- Frequency: [how often]
- Confidence: [Low/Medium/High]
- Recommended action: [what to do about it]
```

Append to `data/memory/market-patterns.md`.
