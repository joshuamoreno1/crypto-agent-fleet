# Lessons Learned — Crypto Agent Fleet

_This file is the error memory. Agents read it at startup to avoid repeating mistakes._

_Format: date, what happened, result, lesson, new rule (if applicable)._

---

<!-- Example lesson:

## 2026-01-15 — Swap fee tier on Uniswap V3 (Base)

**What happened:** Swap USDC→WETH failed twice with fee tier 500 ("Too little received").
**Result:** Worked with fee tier 3000.
**Lesson:** On Base, the USDC/WETH pool with fee 500 has low liquidity or high spread. Use fee tier 3000.
**Rule:** For encode_swap USDC→WETH, use fee 3000 by default.

-->

<!-- Lessons are added automatically via the post-trade-review skill -->
