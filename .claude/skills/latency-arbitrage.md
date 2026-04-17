---
name: latency-arbitrage
description: Detect and exploit price latency gaps between real-time crypto prices and Polymarket prediction market prices. Use when scanning for arbitrage opportunities on Polymarket.
model: opus
---

# Latency Arbitrage — Polymarket

## Concept
Polymarket updates prices slower than real-time feeds.
When BTC rises fast but Polymarket doesn't reflect it yet, there's an opportunity.

## When to Use
- Regular heartbeat (opportunity scan)
- Owner asks to "find arbitrage on Polymarket"
- High crypto volatility (moves > 3% in 1h)

## Detection Flow
1. `prices.get_prices(["bitcoin", "ethereum"])` — current spot price
2. `polymarket.list_markets(category="crypto", active=true)` — crypto markets
3. For each market of type "Token above $X":
   a. `polymarket.get_market_price(token_id)` — share price (= implied probability)
   b. Calculate real probability based on spot price vs threshold
   c. gap = real_prob - polymarket_prob
   d. If gap > configured threshold → OPPORTUNITY
4. `polymarket.get_order_book(token_id)` — verify liquidity
5. If sufficient liquidity → report to Overseer

## Thresholds
- Minimum gap to report: 5%
- Minimum gap to recommend trade: 10%
- Minimum order book liquidity: $500
- Max position: $5 USDC

## Risks
- Taker fees (~1-2%) reduce the edge
- Slippage in illiquid markets
- Polymarket anti-arbitrage measures
- With capital < $200, post-fee profit is marginal
- Edge decreases over time (more bots on Polymarket)

## Viability by Capital
- $50: Monitoring only + very selective trades (gap > 15%)
- $200: Viable with discipline (gap > 8%)
- $500+: Consistently profitable (gap > 5%)

## Rules
- ALWAYS verify order book liquidity before recommending
- ALWAYS calculate profit AFTER fees (taker ~1-2%)
- Market orders (FOK) for immediate execution
- Maximum 3 simultaneous arbitrage positions
- Stop-loss: if price moves 5% against you, close
- Log in data/memory/trade-journal/
