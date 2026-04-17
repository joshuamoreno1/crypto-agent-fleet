---
name: technical-analysis
description: Analyze tokens using technical indicators (RSI, MACD, Bollinger Bands) and generate trading signals
model: opus
---

# Technical Analysis

## Indicators to Calculate

Using `prices.get_price_history` as data source, write and execute Python/TypeScript scripts to calculate:

### RSI (Relative Strength Index) — 14 periods
- RSI < 30: Oversold (potential buy signal)
- RSI > 70: Overbought (potential sell signal)
- RSI 30-70: Neutral

### MACD (Moving Average Convergence Divergence)
- MACD line: EMA(12) - EMA(26)
- Signal line: EMA(9) of MACD
- Bullish cross: MACD crosses above signal
- Bearish cross: MACD crosses below signal

### Bollinger Bands — 20 periods, 2 std dev
- Price at lower band: potential buy
- Price at upper band: potential sell
- Band squeeze: volatility expansion incoming

### Volume Analysis
- Volume spike + price move = confirmation
- Volume decline + price move = weak move

## Signal Generation

A signal requires confluence of 2+ indicators:

| Confluence Score | Signal | Action |
|-----------------|--------|--------|
| 4-5/5 | Strong BUY/SELL | Recommend with high confidence |
| 3/5 | Moderate signal | Recommend with caveats |
| 1-2/5 | Weak signal | Monitor, don't act |

## Signal Report Format

```
📊 Technical Signal Report
Token: ETH (4H timeframe)
━━━━━━━━━━━━━━━━━━━━━━━━━
RSI(14): 28 — Oversold ✅
MACD: Bearish exhaustion ✅
Bollinger: At lower band ✅
Volume: Declining ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━
Confluence: 3/4 BUY
Entry: $2,380-2,400
Stop Loss: $2,320 (-2.5%)
Take Profit: $2,520 (+5.2%)
Risk/Reward: 2.08

Recommendation: BUY with moderate confidence
Size: 5% of portfolio ($XX)
```

## Backtesting

Before recommending a new strategy, backtest it:
1. Write a script that applies the strategy to historical data
2. Run over at least 30 days of history
3. Report: win rate, avg profit/loss, max drawdown, Sharpe ratio
4. Only recommend strategies with Sharpe > 1.0

## Safety
- Technical analysis is NOT a guarantee — always include disclaimers
- Never recommend more than 20% of portfolio on a single trade
- Stop losses are mandatory for every trade recommendation
- If backtesting shows negative expectancy → do not recommend
