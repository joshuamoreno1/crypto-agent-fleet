# Strategy Playbook — When to use each strategy

> **MANDATORY**: All agents MUST read this file on startup.
> The Overseer uses it to decide allocation. The Analyst to prioritize signals. The Trader to validate before executing.

---

## 🏦 1. Yield Farming — The "crypto savings account"

**What it is:** Deposit USDC into lending protocols (Aave, Compound) to earn passive interest.

**When to use it:**
- **Always** — it's the stable base of the portfolio (target 40%)
- When APY > 2% (below that it doesn't justify the risk with small amounts)
- As the first strategy to deploy on launch

**Expected return:** ~$0.27/month with $80 at 4% APY. Low but safe.

---

## 📊 2. Technical Trading — Buy/sell based on technical signals

**What it is:** The Analyst calculates RSI, MACD, Bollinger Bands and generates signals. If confluence >= 3/5 indicators, it recommends a trade.

**When to use it:**
- Only when there's a strong signal (3+ indicators aligned)
- Only after backtesting with Sharpe > 1.0
- **Never without a defined stop loss**

**Sizing:** 5-10% of portfolio per trade. Max 30% total in active trading.

**Oversold rule (approved 2026-03-30):**
- If RSI < 30 → auto-buy $5 in ETH without waiting for full confluence
- Mandatory stop loss: 5% (max loss ~$0.25 per trade)
- Minimum confluence lowered to 2/5 (previously 3/5) for normal trades
- If win rate < 40% after 10 trades → revert to 3/5

**Expected return:** ~$2-5/month if signals are good.

---

## ⚡ 3. Arbitrage — Buy cheap on one DEX, sell expensive on another

**What it is:** Scanner compares prices between Uniswap, Aerodrome, Curve every 15 min.

**When to use it:**
- When spread post-gas > 0.3%
- During temporary stablecoin depegs (DAI/USDC)
- In new pools where prices haven't yet equilibrated
- Auto-approved if amount < $50

**Realistic expectation:** $0-3/month. It's opportunistic — scanning costs zero, so any capture is profit.

> ⚠️ **You can't compete with MEV bots.** Focus on pairs with less competition on Base.

---

## 🎯 4. Airdrop Farming — Speculating with early interactions

**What it is:** Interact weekly with pre-token protocols to qualify for future airdrops.

**When to use it:**
- When the Analyst identifies protocols with: tier-1 VC backing, TVL > $10M, 3+ months live, audited, no token
- Max 10% of portfolio ($20)
- Weekly cadence: swap + deposit + vote to look like a real user (not a bot)

**Expected return:** $0 until airdrop happens. Historically, airdrops have been $800-1,500+. It's an educated lottery.

---

## 🔒 5. Staking & Liquid Staking — Passive cbETH

**What it is:** Buy cbETH (Coinbase-staked ETH). It appreciates ~3.5% APY automatically.

**When to use it:**
- As a passive long-term position (target 10%, max 30%)
- **Simple play:** Buy and hold cbETH
- **Compounding play:** cbETH → Aave for double yield (~5.1% APY)

**Expected return:** ~$0.08/month with $20 at 5%. Minimal but zero maintenance.

---

## 📈 7. Perpetual Trading — Forex, Commodities, Stocks & Crypto with leverage

**What it is:** Open LONG or SHORT positions with leverage on gTrade (Gains Network) on Base.
Instead of buying the asset, you "bet" that it goes up (long) or down (short) with a multiplier.
If you put $5 with 10x leverage, it's as if you had $50 of exposure.

**Protocol:** gTrade (Gains Network) — Diamond on Base: `0x6cD5aC19a07518A8092eEFfDA4f1174C72704eeb`
**Collateral:** USDC

**Available pairs:**
- **Forex:** EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, NZD/USD, USD/CAD, EUR/GBP, EUR/JPY
- **Commodities:** Gold (XAU/USD), Silver (XAG/USD)
- **Stocks:** AAPL, TSLA, NVDA, GOOGL, AMZN, META, MSFT
- **Indices:** SPX500 (S&P 500)
- **Crypto:** BTC, ETH, SOL, LINK, DOGE and 40+ more

**When to use it:**

| Scenario | Action | Suggested pair |
|---|---|---|
| Weak USD (BTC + gold rising) | LONG EUR/USD, LONG XAU/USD | 21, 90 |
| Strong USD (DXY rising) | SHORT EUR/USD | 21 |
| Strong tech earnings | LONG NVDA or TSLA post-report | 65, 63 |
| Geopolitical crisis / uncertainty | LONG XAU/USD (gold = safe haven) | 90 |
| ETH oversold (RSI < 30) | LONG ETH/USD with leverage instead of spot | 1 |
| Clear forex trend (4h+ timeframe) | Follow the trend with 10-25x | 21-30 |
| Sideways market with no trend | DO NOT trade perps — funding eats into returns | — |

**Sizing and limits:**
- Max collateral per position: $5 USDC
- Max total in perps: $20 USDC collateral
- Max concurrent positions: 4
- Max leverage by group: crypto 10x, forex 25x, commodities 10x, stocks 5x
- **ALWAYS with stop loss** — max 5% distance from entry price
- Max loss per trade: ~$2.50 (with SL at 5% and $5 collateral at 10x)

**Fees (very cheap on gTrade):**
- Forex: ~0.008% per open/close (practically free)
- Crypto: ~0.08%
- Commodities: ~0.04%
- Stocks: ~0.08%

**Expected return:** $5-15/month with good technical + macro analysis. High risk, high reward.
A forex trade at 10x that moves 0.5% in your favor = 5% profit on collateral.

**⚠️ Specific risks:**
- With leverage, losses are also multiplied. 10x leverage + 10% against you = total loss.
- Forex closes on weekends — there can be a gap on Monday.
- Stocks only move during market hours (9:30-16:00 ET) but gTrade allows 24/7 trading.
- Funding fees accumulate over time — don't leave positions open for days without reason.

**Adaptive rule:**
- If win rate < 40% after 10 perp trades → lower leverage to 3x max
- If cumulative loss in perps > $10 → PAUSE perpetuals, alert owner

---

## 🎛️ 6. Portfolio Management — The meta-strategy

**What it is:** The Overseer manages allocation across ALL strategies. Rebalances weekly.

**When it acts:**
- If a strategy deviates > 10% from target → rebalance
- If USDC reserve < 5% → withdraw from yield to replenish
- Daily P&L report at 20:00 COT
- Weekly review on Sundays

**Target allocation:**

| Strategy | Target |
|---|---|
| Trading (spot) | 40% |
| Perpetuals (gTrade) | 20% |
| Arbitrage | 5% |
| Airdrop | 5% |
| Prediction Markets | 10% |
| USDC Reserve | 10% |
| Yield/Staking | 10% (when owner activates it) |

---

## 💡 TL;DR — Which to use and when

| Situation | Strategy |
|---|---|
| "I want safe passive returns" | **Yield Farming** |
| "ETH looks like it's going up/down" | **Technical Trading** (spot) or **Perpetuals** (with leverage) |
| "The dollar is weak / strong" | **Perpetuals** — EUR/USD, GBP/USD |
| "There's a crisis / uncertainty" | **Perpetuals** — LONG XAU/USD (gold) |
| "Tech stocks will rise post-earnings" | **Perpetuals** — LONG NVDA, TSLA |
| "There's a price difference between DEXs" | **Arbitrage** |
| "This new protocol looks good and has no token" | **Airdrop Farming** |
| "I want to bet on a binary outcome" | **Polymarket** (prediction markets) |
| "Is my portfolio balanced?" | **Portfolio Management** |
