---
name: swap-tokens
description: Swap tokens on a DEX (Uniswap V3 or Aerodrome) on Base. Executes pre-approved swaps only.
model: sonnet
---

# Swap Tokens

## ⚠️ REGLA CRÍTICA: Usar MCP tools, NO scripts

**NUNCA crear scripts Node/Python/bash para ejecutar swaps.**
Usa EXCLUSIVAMENTE las MCP tools disponibles:
- `blockchain.*` para leer datos on-chain
- `prices.*` para obtener precios
- `signer.check_policy` para validar contra policy
- `signer.sign_and_send` para firmar y enviar transacciones

El signer MCP acepta `data` (calldata hex) — tú construyes el calldata con ethers.js ABI encoding inline y se lo pasas al signer.

## Pre-flight Checks

1. **Verify balances** — use `blockchain.get_balance` to confirm enough source tokens
2. **Get current prices** — use `prices.get_prices` to know current rates
3. **Check policy** — use `signer.check_policy(to=router_address, value_usd=amount, operation="swap")`
4. **Verify gas** — wallet needs ETH for gas. If 0 ETH, tell Overseer.

## Building Calldata

Para Uniswap V3 `exactInputSingle`, construye el calldata con ABI encoding.

**Parámetros del swap:**
- Router: `0x2626664c2603336E57B271c5C0b26F421741e481` (Uniswap V3 SwapRouter02)
- Function: `exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))`
- Fee tiers: 500 (0.05% — stablecoins/majors), 3000 (0.3%), 10000 (1%)
- Para USDC/WETH usar fee `500` (pool más líquido en Base)
- amountOutMinimum: precio actual * (1 - slippage). Max slippage: 1%
- sqrtPriceLimitX96: `0` (sin límite)

**Token addresses (Base):**
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals)
- WETH: `0x4200000000000000000000000000000000000006` (18 decimals)
- DAI: `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb` (18 decimals)
- cbETH: `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` (18 decimals)

## Execution Flow (usando MCP tools)

### Paso 1: Approve (si es ERC20 → Router)
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
- Approval amount: **exacto** (nunca infinite approval — está bloqueado por policy)

### Paso 2: Swap
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

### Paso 3: Verificar resultado
- `blockchain.get_balance` para confirmar tokens recibidos
- Reportar al Overseer: amount in, amount out, effective price, tx hash, explorer link

## Safety

- Max slippage: 1% (from policy.json)
- NUNCA swapear más de $10 sin owner approval (policy.json: per_transaction_usd)
- SIEMPRE check_policy antes de sign_and_send
- Si el swap causaría >50% concentración en un token → alert owner
- Después de cada swap exitoso → ejecutar skill `post-trade-review`
