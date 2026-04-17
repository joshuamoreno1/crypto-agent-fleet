---
name: check-balance
description: Check wallet balances on Base (ETH + all configured tokens). Read-only, no risk.
model: sonnet
---

# Check Balance

## Steps

1. Use the `blockchain` MCP tool `get_balance` to fetch all token balances
2. Use the `prices` MCP tool `get_prices` with tokens "eth,usdc" to get current USD values
3. Calculate the total portfolio value in USD
4. Format and present the results clearly

## Output Format

```
💰 Portfolio Balance (Base)
━━━━━━━━━━━━━━━━━━━━━━━━━
ETH:  X.XXXX ($XX.XX)
USDC: XXX.XX ($XXX.XX)
WETH: X.XXXX ($XX.XX)
━━━━━━━━━━━━━━━━━━━━━━━━━
Total: $XXX.XX
```

## Notes
- Always show USD values alongside token amounts
- If a token balance is 0, still show it
- Include the current ETH gas price as a note
