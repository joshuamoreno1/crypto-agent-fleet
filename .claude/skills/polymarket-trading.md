---
name: polymarket-trading
description: Evaluate and trade prediction markets on Polymarket. Use when analyzing prediction market opportunities, calculating edge, or placing trades on Polymarket.
model: opus
---

# Polymarket Trading

## What is Polymarket
A prediction market on Polygon (chain 137). You buy shares of "Yes" or "No" on events.
Winning shares pay $1.00, losing shares pay $0.00. The price = implied probability.

## When to Use This Skill
- Owner asks to analyze a prediction market
- Heartbeat detects an opportunity on Polymarket
- Analyst identifies a market with edge > 20%

## Evaluation Flow
1. `polymarket.list_markets(category="crypto", active=true)` — find markets
2. For each interesting market:
   a. `polymarket.get_market_price(token_id)` — current price
   b. `prices.get_prices(token)` — real price of the underlying asset
   c. `prices.get_price_history(token, days=30)` — trend
   d. Calculate real probability using technical-analysis
   e. Calculate edge = real_probability - polymarket_price
3. If edge > 20% → report to Overseer with recommendation

## Probability Calculation for "Token above $X by Date" Markets
- Current price > threshold + 10%: prob 80-95%
- Current price > threshold: prob 55-80%
- Current price close (±5%): prob 40-60%
- Current price < threshold: prob 20-45%
- Current price < threshold - 10%: prob 5-20%

Adjust for:
- Trend (+10% uptrend, -10% downtrend)
- Time remaining (more time = closer to 50%)
- Volatility (more vol = closer to 50%)
- Catalytic events

## Position Sizing (Half-Kelly)
- Kelly fraction = (edge / odds)
- Half-Kelly = Kelly / 2 (more conservative)
- Max per position: $5 USDC
- Max total on Polymarket: $20 USDC
- Max concurrent positions: 4

## Rules
- ALWAYS request owner approval before buying shares
- ALWAYS use limit orders (except for urgent event-driven trades)
- Minimum edge: 20%
- Allowed categories: crypto, tech
- Minimum market liquidity: $1,000
- Log EVERYTHING in data/memory/trade-journal/

## Position Monitoring
- Review positions every 24h
- Re-evaluate probabilities
- If market closes in < 48h → alert owner
- If probability changed significantly → report
