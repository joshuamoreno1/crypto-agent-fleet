---
name: staking
description: Manage ETH staking and liquid staking positions (Lido, Rocket Pool, Coinbase cbETH). Executes pre-approved operations.
model: sonnet
---

# Staking & Liquid Staking

## What is Staking?

Lock ETH to secure the network and earn ~3-5% APY. With liquid staking, you get a receipt token (stETH, rETH, cbETH) that can be used in DeFi while your ETH is staked.

## Available on Base

| Protocol | Token | Est. APY | How |
|----------|-------|----------|-----|
| Coinbase (cbETH) | cbETH | ~3.5% | Buy cbETH on DEX (already liquid) |
| Lido (wstETH) | wstETH | ~3.8% | Bridge wstETH from Ethereum or buy on DEX |

## Strategy: Staking + DeFi Composability

The real yield comes from COMBINING staking with DeFi:

1. **Simple staking:** Buy cbETH → hold → earn ~3.5% APY
2. **Staking + lending:** Buy cbETH → supply to Aave → earn staking APY + lending APY
3. **Staking + LP:** Buy cbETH → provide cbETH/ETH liquidity on Aerodrome → earn staking + LP fees

## Execution

### Buy cbETH (simplest)
1. Use `swap-tokens` skill to swap ETH → cbETH on Uniswap/Aerodrome
2. cbETH auto-accrues value vs ETH over time
3. No further action needed

### Supply cbETH to Aave (intermediate)
1. Swap ETH → cbETH
2. Approve cbETH for Aave Pool
3. Supply cbETH to Aave
4. Earn: staking APY + Aave supply APY

## Monitoring

- Track cbETH/ETH ratio (should slowly increase)
- Monitor Aave supply APY for cbETH
- Alert if cbETH depegs > 1% from fair value

## Safety
- cbETH is the safest option on Base (Coinbase-backed)
- wstETH requires bridging from Ethereum (extra risk + cost)
- Never stake more than 30% of portfolio
- Monitor for slashing events (rare but possible)
