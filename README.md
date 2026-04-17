# Crypto Agent Fleet

A fleet of AI agents that manage a crypto portfolio autonomously on **Base** (Ethereum L2) and **Polygon** (Polymarket prediction markets). Built on [Claude Code](https://claude.ai/code) with Agent Teams, custom MCP servers, and Telegram for communication.

Think of it as hiring a team of AI employees for your wallet: one analyzes markets, one manages risk, and one executes trades — all coordinated by a lead agent that reports to you via Telegram.

## What Does It Do?

The fleet runs 7 strategies automatically:

| Strategy | What It Does | Risk |
|----------|-------------|------|
| **Yield Farming** | Deposits your stablecoins (USDC) in lending protocols (Aave, Compound) to earn interest — like a savings account but on-chain | Low |
| **Technical Trading** | Buys/sells crypto tokens based on technical indicators (RSI, MACD, Bollinger Bands) | Medium |
| **Cross-DEX Arbitrage** | Finds price differences for the same token across exchanges (Uniswap, Aerodrome, Curve) and profits from the gap | Medium |
| **Perpetual Trading** | Trades forex (EUR/USD, GBP/USD), stocks (AAPL, TSLA, NVDA), commodities (gold, silver), and crypto with leverage via [gTrade](https://gains.trade) on Base | Medium-High |
| **Prediction Markets** | Bets on real-world outcomes on [Polymarket](https://polymarket.com) when there's a mathematical edge (e.g., "Will ETH hit $5k?") | Medium |
| **Airdrop Farming** | Interacts with new protocols that might reward early users with free tokens | Medium |
| **Staking** | Holds cbETH (staked ETH) for passive staking yield, optionally compounded via Aave | Low |

## How It Works

```
You (Telegram) <--> Overseer (Lead Agent, Opus)
                        |
              +---------+---------+
              v                   v
          Analyst              Trader
         (Sonnet)             (Sonnet)
      Monitors markets     Executes trades
```

1. **Overseer** (Opus) — The boss. Coordinates everything, evaluates risk, approves trades, and reports to you via Telegram
2. **Analyst** (Sonnet) — Watches markets, generates trading signals, scans for arbitrage opportunities and prediction market edge
3. **Trader** (Sonnet) — Executes approved trades on Base (DeFi) and Polygon (Polymarket). Never acts without Overseer approval

The decision flow: **Analyst detects signal -> Overseer evaluates + risk-checker -> Trader executes (if approved)**

Every trade goes through a **policy engine** that enforces spending limits, protocol allowlists, and requires your approval for anything above $10.

## Safety Features

- **Spending limits**: Max $10/trade, $20/day, $50/week — all configurable in `config/policy.json`
- **Allowlisted protocols only**: Uniswap, Aerodrome, Aave, Compound, Curve, gTrade — anything else requires your approval
- **Encrypted keystore**: Your private key is AES-256 encrypted, password only held in memory at runtime
- **Mandatory stop losses**: Every leveraged position (gTrade perpetuals) requires a stop loss — no exceptions
- **Auto-pause**: Trading stops automatically if win rate drops below 30% or cumulative losses exceed thresholds
- **Full audit log**: Every transaction is logged to `data/audit-log/` with timestamp, amount, tx hash, and result
- **Human-in-the-loop**: All trades above $10 and all new protocol interactions require your explicit Telegram approval

## Prerequisites

- **macOS** (Apple Silicon recommended)
- **[Bun](https://bun.sh/)** v1.3+ — JavaScript runtime
- **[Claude Code](https://claude.ai/code)** v2.1.32+ with a Claude Max subscription
- **A crypto wallet** (MetaMask or similar) funded with:
  - **USDC** on Base — trading capital (start with as little as $50)
  - **ETH** on Base — for gas fees (~$0.001 per tx, so $1 is plenty)
- **A Telegram bot** — free, takes 2 minutes to create

## Setup Guide

### 1. Clone and Install

```bash
git clone https://github.com/<YOUR_GITHUB_USERNAME>/crypto-agent-fleet.git
cd crypto-agent-fleet

# Install MCP server dependencies
cd mcp-servers/blockchain && bun install && cd ../..
cd mcp-servers/prices && bun install && cd ../..
cd mcp-servers/signer && bun install && cd ../..
cd mcp-servers/polymarket && bun install && cd ../..
```

### 2. Set Up Your Wallet

Export your MetaMask private key (Account Details -> Export Private Key) and encrypt it:

```bash
read -s -p "Paste your private key: " PK
echo "$PK" | openssl enc -aes-256-cbc -pbkdf2 -out keystore/wallet.key.enc
chmod 600 keystore/wallet.key.enc
unset PK
```

It will ask for a password — **remember it**, you'll need it every time you start the fleet.

Update `config/wallet.json` with your wallet address.

### 3. Create a Telegram Bot

1. Open Telegram, search for **@BotFather**, send `/newbot`
2. Pick a name and username for your bot
3. Save the **token** BotFather gives you

Find your **Telegram User ID**:
1. Search for **@userinfobot** on Telegram, send `/start`
2. It replies with your user ID (a number like `1234567890`)

Now update two files:
- `CLAUDE.md` — fill in your wallet address, Telegram chat ID, and bot username in the "Owner — Contact Info" section
- `scripts/start-fleet.sh` — replace `<YOUR_TELEGRAM_BOT_TOKEN>` with your bot token

### 4. Set Up Polymarket (Optional)

Skip this if you don't want prediction market trading.

1. **Bridge USDC** from Base to Polygon using [across.to](https://across.to)
2. **Get POL** for gas (~$0.10) via [QuickSwap](https://quickswap.exchange)
3. **Generate API credentials**:
   ```bash
   read -s "SIGNER_PASSWORD?Password: " && export SIGNER_PASSWORD
   node --experimental-strip-types mcp-servers/polymarket/gen-creds.ts
   ```
4. Add the output to your shell profile (`~/.zshrc`):
   ```bash
   export POLYMARKET_API_KEY="..."
   export POLYMARKET_API_SECRET="..."
   export POLYMARKET_PASSPHRASE="..."
   ```

> Polymarket is geoblocked in some countries. [Cloudflare WARP](https://1.1.1.1/) (free) works as a VPN.

### 5. Start the Fleet

```bash
./scripts/start-fleet.sh
```

It will ask for your keystore password, start Claude Code with the Telegram channel, create the Agent Team, run an initial portfolio scan, and start reporting to you via Telegram.

### 6. Talk to Your Fleet

Send messages to your Telegram bot:

| Message | What Happens |
|---------|-------------|
| "What's my balance?" | Full portfolio overview across Base and Polygon |
| "Swap $5 USDC to ETH" | Executes with policy check + your approval |
| "Any arbitrage opportunities?" | Cross-DEX price scan |
| "What are current yields?" | Aave/Compound APY comparison |
| "Open a long on EUR/USD" | gTrade perpetual with stop loss (requires approval) |
| "Scan Polymarket for crypto bets" | Prediction market edge analysis |
| "How's my P&L today?" | Daily profit/loss breakdown by strategy |

## Project Structure

```
crypto-agent-fleet/
├── CLAUDE.md                      # Agent instructions (the brain)
├── .mcp.json                      # MCP server configuration
├── .claude/
│   ├── settings.json              # Claude Code permissions reference
│   ├── agents/                    # Agent role definitions
│   │   ├── analyst.md             #   Market analysis teammate
│   │   ├── trader.md              #   Trade execution teammate
│   │   ├── risk-checker.md        #   Pre-trade risk evaluation
│   │   └── portfolio-analyzer.md  #   Portfolio P&L analysis
│   └── skills/                    # Strategy implementations
│       ├── technical-analysis.md  #   RSI, MACD, Bollinger signals
│       ├── swap-tokens.md         #   DEX token swaps
│       ├── yield-monitor.md       #   Lending APY monitoring
│       ├── arbitrage-scanner.md   #   Cross-DEX price scanning
│       ├── polymarket-trading.md  #   Prediction market edge trading
│       ├── latency-arbitrage.md   #   Spot vs Polymarket gaps
│       ├── airdrop-farming.md     #   Pre-token protocol interactions
│       ├── staking.md             #   ETH/cbETH staking
│       ├── check-balance.md       #   Read wallet balances
│       ├── post-trade-review.md   #   Post-trade logging + learning
│       ├── weekly-review.md       #   Weekly performance review
│       └── memory.md              #   Agent memory management
├── config/
│   ├── wallet.json                # Wallet address, tokens, contract addresses
│   ├── policy.json                # Spending limits, allowed protocols, risk params
│   └── strategy-playbook.md       # Strategy triggers and position sizing
├── mcp-servers/                   # Backend services (TypeScript + Bun)
│   ├── blockchain/index.ts        #   On-chain reads + tx encoding (Base)
│   ├── prices/index.ts            #   CoinGecko market data
│   ├── signer/index.ts            #   Transaction signing + policy enforcement
│   └── polymarket/index.ts        #   Polymarket CLOB API (Polygon)
├── data/
│   ├── audit-log/                 # Every signed transaction (JSONL, by date)
│   └── memory/
│       ├── lessons.md             # Mistakes the fleet won't repeat
│       ├── strategy-stats.json    # Win rates and P&L by strategy
│       ├── market-patterns.md     # Observed market behavior
│       └── trade-journal/         # Individual trade logs
├── keystore/
│   └── wallet.key.enc            # Your encrypted private key (AES-256)
└── scripts/
    ├── start-fleet.sh             # Start the fleet (edit with your bot token)
    └── init-prompt.txt            # Initial prompt that boots the Agent Team
```

## Customizing

**Spending limits** — Edit `config/policy.json` to change per-transaction, daily, and weekly limits.

**Allowed tokens** — Add tokens to `config/policy.json` under `allowed_tokens`. The fleet only trades tokens on this list.

**Strategy allocations** — Edit target allocations in `CLAUDE.md` under "Active Strategies" and in `config/strategy-playbook.md`.

**Language** — The fleet defaults to English. Change the language instruction in `CLAUDE.md` to have it report in any language.

**Leverage limits** — gTrade perpetual leverage caps are in `config/policy.json` under `perpetual_limits` (default: crypto 10x, forex 25x, commodities 10x, stocks 5x).

## How the Fleet Learns

The agents have a memory system — they learn from every trade and never repeat mistakes:

```
Trade executes -> post-trade-review logs result
              -> updates lessons.md (if error)
              -> updates strategy-stats.json (win/loss)
              -> writes to trade-journal/

Every Sunday -> weekly-review aggregates performance
            -> adjusts strategy parameters
            -> sends you a full report
```

If a strategy keeps losing, the fleet **automatically pauses it** and alerts you.

## Networks

| Network | Chain ID | Used For |
|---------|----------|----------|
| **Base** | 8453 | DeFi (yield, swaps, arbitrage, gTrade perpetuals) |
| **Polygon** | 137 | Prediction markets (Polymarket) |

## License

MIT
