---
name: weekly-review
description: Run every Sunday — aggregate weekly performance, extract meta-lessons, adjust strategy parameters, and send report to owner
model: opus
---

# Weekly Review

Run every Sunday at 20:00 COT (or manually when owner asks for a review).

## Step 1: Aggregate Weekly Data

Read all trade journal entries from the last 7 days:

```bash
# Get last 7 days of trade journals
for i in $(seq 0 6); do
  date_str=$(date -v-${i}d +%Y-%m-%d 2>/dev/null || date -d "-${i} days" +%Y-%m-%d)
  file="data/memory/trade-journal/${date_str}.jsonl"
  if [ -f "$file" ]; then
    cat "$file"
  fi
done
```

Calculate per-strategy:
- Total trades
- Win/loss count and rate
- Total P&L (realized + unrealized)
- Average trade size
- Best and worst trade
- Gas costs

Calculate portfolio-wide:
- Total portfolio value (current)
- Weekly change ($ and %)
- Portfolio allocation vs target (from policy.json)
- Total gas spent

## Step 2: Performance Analysis

### Strategy Rankings

Rank strategies by risk-adjusted return:

```
Sharpe-like ratio = (avg_return - 0) / std_dev_returns
```

For each strategy, assess:

| Metric | Good | Okay | Bad |
|--------|------|------|-----|
| Win rate | > 60% | 40-60% | < 40% |
| Avg win / Avg loss | > 2.0 | 1.0-2.0 | < 1.0 |
| Max drawdown | < 5% | 5-10% | > 10% |
| Gas as % of P&L | < 5% | 5-20% | > 20% |

### Identify Patterns

Look for recurring patterns in the week's trades:
- Same mistake happening multiple times?
- Time-of-day patterns (certain hours more profitable)?
- Token-specific patterns?
- Correlation with market conditions (volatility, volume)?

## Step 3: Meta-Lessons

Based on the week's data, extract higher-level learnings:

```markdown
## Week of YYYY-MM-DD — Weekly Meta-Lesson
- **Best performer:** [strategy] (+$X.XX, X% win rate)
- **Worst performer:** [strategy] (-$X.XX, X% win rate)
- **Key insight:** [1-2 sentences about what the data shows]
- **Adjustment:** [specific parameter change, if any]
```

Append to `data/memory/lessons.md`.

## Step 4: Adjust Strategy Parameters

Based on performance data, recommend (or auto-apply if within bounds):

### Auto-adjustable parameters:
- `trading.confluence_threshold`: raise if win rate < 40%, lower if > 70%
- `arbitrage.min_spread_threshold`: raise if loss rate > 30%
- Strategy allocation: shift 5% from worst to best performer (within policy limits)

### Require owner approval:
- Pausing a strategy entirely
- Adding a new protocol to allowlist
- Changing spending limits
- Allocation shifts > 10%

Update `data/memory/strategy-stats.json` with:
```json
{
  "weekly_reviews": [
    {
      "week_of": "2026-04-07",
      "total_trades": 15,
      "total_pnl_usd": 3.42,
      "portfolio_value_usd": 203.42,
      "portfolio_change_pct": 1.71,
      "best_strategy": "yield_farming",
      "worst_strategy": "trading",
      "adjustments_made": ["Raised trading confluence to 4/5"],
      "gas_total_usd": 0.05
    }
  ]
}
```

## Step 5: Weekly Report to owner

Send via Telegram:

```
📊 Weekly Report — Week of [date]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 Portfolio: $XXX.XX (+/-$X.XX, +/-X.X%)

Strategy Breakdown:
  🌾 Yield Farming: +$X.XX (X trades, X% win)
  📈 Trading:       +/-$X.XX (X trades, X% win)
  🔄 Arbitrage:     +/-$X.XX (X trades, X% win)
  🪂 Airdrops:      $X.XX gas spent, X interactions
  🥩 Staking:       +$X.XX yield earned

Allocation (actual → target):
  Yield: XX% → 40%
  Trading: XX% → 20%
  Arb: XX% → 10%
  Airdrops: XX% → 10%
  Staking: XX% → 10%
  Reserve: XX% → 10%

Gas total: $X.XX
Trades: XX total | XX wins | XX losses

📝 Lessons this week: X new
🔧 Adjustments: [list or "none"]

Top lesson: "[most important learning]"
```

## Step 6: Cleanup

- Archive trade journals older than 30 days to `data/memory/trade-journal/archive/`
- Consolidate duplicate lessons in `lessons.md`
- Remove market patterns with confidence "Low" older than 30 days

## Emergency Triggers

If the weekly review reveals:
- Portfolio down > 15% from peak → **PAUSE ALL STRATEGIES** + alert owner
- Any single strategy lost > $30 cumulative → **PAUSE that strategy** + alert owner
- Gas costs > 10% of total P&L → flag inefficiency, reduce trade frequency
