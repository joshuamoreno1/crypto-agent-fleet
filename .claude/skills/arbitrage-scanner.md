---
name: arbitrage-scanner
description: Scan for price discrepancies between DEXs on Base for arbitrage opportunities
model: opus
---

# Arbitrage Scanner

## What to Scan

Compare prices for the same token pair across multiple DEXs on Base:

### DEX Sources
1. **Uniswap V3** — most liquid, reference price
2. **Aerodrome** — native Base DEX, sometimes different pricing
3. **SushiSwap** (if available on Base)
4. **Curve** — for stablecoin pairs

### Token Pairs to Monitor
- ETH/USDC
- WETH/USDC
- cbETH/ETH (liquid staking arb)
- DAI/USDC (stablecoin peg arb)

## How to Scan

For each pair and each DEX:
1. Query the router/quoter contract for a quote of a fixed amount (e.g., 1 ETH → USDC)
2. Compare prices across DEXs
3. Calculate spread = (highest_price - lowest_price) / lowest_price × 100
4. Estimate gas cost for BOTH legs of the trade (buy on cheap DEX + sell on expensive DEX)
5. Net profit = spread_value - gas_costs

## Opportunity Criteria

| Spread (post-gas) | Action |
|-------------------|--------|
| < 0.1% | Noise — ignore |
| 0.1% - 0.3% | Monitor — not worth the risk |
| 0.3% - 1.0% | Alert Overseer — potential opportunity |
| > 1.0% | Urgent alert — likely temporary, act fast |

## Alert Format

```
🔔 Arbitrage Detected
━━━━━━━━━━━━━━━━━━━━
Pair: ETH/USDC
Buy on: Aerodrome @ $2,448.30
Sell on: Uniswap V3 @ $2,455.80
Spread: 0.31% ($7.50 per ETH)
Gas (both legs): ~$0.02
Net profit at 1 ETH: ~$7.48
Net profit at 3 ETH: ~$22.44

⚠️ Slippage warning: check liquidity depth before executing
```

## Execution (if approved)

1. Check policy limits
2. Build multicall or sequential txs: buy on DEX A + sell on DEX B
3. Use tight slippage (0.3%) to protect against front-running
4. Execute as fast as possible — arb windows close quickly

## Limitations

- Our agents are slower than MEV bots (we go through an LLM)
- Focus on L2s where MEV competition is lower
- Best opportunities: stablecoin depegs, new pool launches, low-TVL pairs
- NOT suitable for high-frequency arb — that's bot territory

## Safety
- Never risk more than $50 on a single arb without approval
- Always verify liquidity depth before executing
- If execution fails on one leg, don't panic — report to owner
