---
name: swap-tokens
description: Swap tokens on a DEX (Uniswap V3 or Aerodrome) on Base. Executes pre-approved swaps only.
model: sonnet
---

# Swap Tokens

## CRITICAL RULE: Use MCP tools, NOT scripts

**NEVER create Node/Python/bash scripts to execute swaps.**
Use EXCLUSIVELY the available MCP tools:
- `blockchain.*` to read on-chain data
- `prices.*` to get prices
- `signer.check_policy` to validate against policy
- `signer.sign_and_send` to sign and send transactions

The signer MCP accepts `data` (calldata hex) — you build the calldata with ethers.js ABI encoding inline and pass it to the signer.

## Pre-flight Checks

1. **Verify balances** — use `blockchain.get_balance` to confirm enough source tokens
2. **Get current prices** — use `prices.get_prices` to know current rates
3. **Check policy** — use `signer.check_policy(to=router_address, value_usd=amount, operation="swap")`
4. **Verify gas** — wallet needs ETH for gas. If 0 ETH, tell Overseer.

## Building Calldata

For Uniswap V3 `exactInputSingle`, build the calldata with ABI encoding.

**Swap parameters:**
- Router: `0x2626664c2603336E57B271c5C0b26F421741e481` (Uniswap V3 SwapRouter02)
- Function: `exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))`
- Fee tiers: 500 (0.05% — stablecoins/majors), 3000 (0.3%), 10000 (1%)
- For USDC/WETH use fee `500` (most liquid pool on Base)
- amountOutMinimum: current price * (1 - slippage). Max slippage: 1%
- sqrtPriceLimitX96: `0` (no limit)

**Token addresses (Base):**
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals)
- WETH: `0x4200000000000000000000000000000000000006` (18 decimals)
- DAI: `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb` (18 decimals)
- cbETH: `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` (18 decimals)

## Execution Flow (using MCP tools)

### Step 1: Approve (if ERC20 → Router)
```
signer.sign_and_send(
  to: "<token_address>",
  value_eth: "0",
  value_usd: 0,
  operation: "approve",
  data: "<approve_calldata_hex>",
  description: "Approve <amount> <token> for Uniswap V3 Router"
)
```
- Approval amount: **exact** (never infinite approval — blocked by policy)

### Step 2: Swap
```
signer.sign_and_send(
  to: "0x2626664c2603336E57B271c5C0b26F421741e481",
  value_eth: "0",
  value_usd: <amount_in_usd>,
  operation: "swap",
  data: "<swap_calldata_hex>",
  description: "Swap <amount> <tokenIn> → <tokenOut> on Uniswap V3"
)
```

### Step 3: Verify result
- `blockchain.get_balance` to confirm tokens received
- Report to Overseer: amount in, amount out, effective price, tx hash, explorer link

## Safety

- Max slippage: 1% (from policy.json)
- NEVER swap more than $10 without owner approval (policy.json: per_transaction_usd)
- ALWAYS check_policy before sign_and_send
- If the swap would cause >50% concentration in a single token → alert owner
- After each successful swap → run skill `post-trade-review`
