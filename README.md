# Crypto Agent Fleet

A fleet of AI agents that manage a crypto portfolio autonomously on **Base** (Ethereum L2) and **Polygon** (for prediction markets). Built on [Claude Code](https://claude.ai/code) with Agent Teams, custom MCP servers, and Telegram for communication.

Think of it as hiring a team of AI employees for your wallet: one analyzes markets, one manages risk, and one executes trades — all coordinated by a lead agent that reports to you via Telegram.

## What Does It Do?

The fleet runs 6 strategies automatically:

| Strategy | What It Does | Risk |
|----------|-------------|------|
| **Yield Farming** | Deposits your stablecoins (USDC) in lending protocols (Aave, Compound) to earn interest — like a savings account but on-chain | Low |
| **Technical Trading** | Buys/sells tokens based on technical indicators (RSI, MACD, etc.) | Medium |
| **Cross-DEX Arbitrage** | Finds price differences for the same token across exchanges and profits from the gap | Medium |
| **Airdrop Farming** | Interacts with new protocols that might reward early users with free tokens | Medium |
| **Staking** | Holds cbETH (staked ETH) for passive staking yield | Low |
| **Perpetual Trading** | Trades forex, stocks, crypto, and commodities with leverage via gTrade | Medium-High |
| **Prediction Markets** | Bets on real-world outcomes (elections, crypto milestones) on Polymarket when there's a mathematical edge | Medium |

## How It Works

```
You (Telegram) ←→ Overseer (Lead Agent, Opus)
                      ↕
              ┌───────┴───────┐
              ↓               ↓
         Analyst          Trader
        (Sonnet)          (Sonnet)
     Monitors markets   Executes trades
```

1. **Overseer** (Opus) — The boss. Coordinates everything, evaluates risk, approves trades, and reports to you via Telegram
2. **Analyst** (Sonnet) — Watches markets 24/7, generates trading signals, scans for arbitrage
3. **Trader** (Sonnet) — Executes approved trades. Never acts without Overseer approval

Every trade goes through a **policy engine** that enforces spending limits, protocol allowlists, and requires your approval for anything above $10.

## Safety Features

- **Spending limits**: Max $10/trade, $20/day, $50/week — configurable in `config/policy.json`
- **Allowlisted protocols only**: Uniswap, Aerodrome, Aave, Compound, Curve, gTrade
- **Encrypted keystore**: Your private key is AES-256 encrypted, password never stored
- **Mandatory stop losses**: Every leveraged position requires a stop loss
- **Auto-pause**: Trading stops automatically if win rate drops below 30% or losses exceed thresholds
- **Full audit log**: Every transaction is logged with timestamp, amount, tx hash, and result

## Prerequisites

You need:
- **macOS** (Apple Silicon recommended)
- **[Bun](https://bun.sh/)** v1.3+ — JavaScript runtime (like Node.js but faster)
- **[Claude Code](https://claude.ai/code)** v2.1.32+ — requires a Claude Max subscription ($100/month)
- **A crypto wallet** (MetaMask or similar) funded with:
  - **USDC** on Base — this is the trading capital (start with as little as $50)
  - **ETH** on Base — for gas fees (transaction costs, ~$0.001 each, so $1 is plenty)
- **A Telegram bot** — free, takes 2 minutes to create (instructions below)

## Setup Guide (Step by Step)

### 1. Clone This Repo

```bash
git clone https://github.com/<YOUR_GITHUB_USERNAME>/crypto-agent-fleet.git
cd crypto-agent-fleet
```

### 2. Install Dependencies

Each MCP server (the backend services the agents use) needs its own dependencies:

```bash
cd mcp-servers/blockchain && bun install && cd ../..
cd mcp-servers/prices && bun install && cd ../..
cd mcp-servers/signer && bun install && cd ../..
cd mcp-servers/polymarket && bun install && cd ../..
```

### 3. Set Up Your Wallet

You need your wallet's private key. In MetaMask: Account Details → Export Private Key.

**Encrypt it** (so it's not stored in plain text):

```bash
read -s -p "Paste your private key: " PK
echo "$PK" | openssl enc -aes-256-cbc -pbkdf2 -out keystore/wallet.key.enc
chmod 600 keystore/wallet.key.enc
unset PK
```

It will ask you for a password — **remember this password**, you'll need it every time you start the fleet.

Then update `config/wallet.json` with your wallet address:

```json
{
  "wallet": {
    "address": "0xYOUR_WALLET_ADDRESS_HERE"
  }
}
```

### 4. Create a Telegram Bot

This is how the agents talk to you. It's free and takes 2 minutes:

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Pick a name (e.g., "My Crypto Fleet")
4. Pick a username (e.g., `my_crypto_fleet_bot`)
5. BotFather gives you a **token** — save it, you'll need it next

Then find your **Telegram User ID**:
1. Search for **@userinfobot** on Telegram
2. Send `/start` — it replies with your user ID (a number like `1234567890`)

Update `CLAUDE.md` with your bot username, user ID, and wallet address in the "Owner — Contact Info" section.

### 5. Configure the Start Script

Copy the template and add your Telegram bot token:

```bash
cp scripts/templates/start-fleet.sh.template scripts/start-fleet.sh
chmod +x scripts/start-fleet.sh
```

Edit `scripts/start-fleet.sh` and replace `<YOUR_TELEGRAM_BOT_TOKEN>` with the token from step 4.

### 6. Set Up Polymarket (Optional)

If you want the fleet to trade on prediction markets:

1. **Bridge USDC** from Base to Polygon using [across.to](https://across.to)
2. **Get POL** for gas (~$0.10 worth) — use [QuickSwap](https://quickswap.exchange)
3. **Generate API credentials**:
   ```bash
   read -s "SIGNER_PASSWORD?Password: " && export SIGNER_PASSWORD
   node --experimental-strip-types mcp-servers/polymarket/gen-creds.ts
   ```
4. Add the output to `~/.zshrc`:
   ```bash
   export POLYMARKET_API_KEY="..."
   export POLYMARKET_API_SECRET="..."
   export POLYMARKET_PASSPHRASE="..."
   ```

> Polymarket is geoblocked in some countries. Use [Cloudflare WARP](https://1.1.1.1/) (free VPN) if needed.

### 7. Start the Fleet

```bash
./scripts/start-fleet.sh
```

It will:
1. Ask for your keystore password
2. Start Claude Code with the Telegram channel
3. Create the Agent Team (Overseer + Analyst + Trader)
4. Run an initial portfolio scan
5. Start reporting to you via Telegram

### 8. Talk to Your Fleet

Send messages to your Telegram bot:

- **"What's my balance?"** → Full portfolio overview
- **"Any arbitrage opportunities?"** → Cross-DEX scan
- **"What are current yields?"** → Aave/Compound APYs
- **"Swap $5 USDC to ETH"** → Executes with policy check
- **"Scan Polymarket for crypto bets"** → Prediction market analysis
- **"How's my P&L today?"** → Daily profit/loss report

## Project Structure

```
crypto-agent-fleet/
├── CLAUDE.md                    # Agent instructions (brain of the fleet)
├── .mcp.json                    # MCP server configuration
├── .claude/
│   ├── settings.json            # Claude Code permissions (reference)
│   ├── agents/                  # Agent definitions (who does what)
│   │   ├── analyst.md           #   Market analysis teammate
│   │   ├── trader.md            #   Trade execution teammate
│   │   ├── risk-checker.md      #   Pre-trade risk evaluation
│   │   └── portfolio-analyzer.md#   Portfolio composition + P&L
│   └── skills/                  # Strategy implementations (how to do it)
│       ├── check-balance.md     #   Read wallet balances
│       ├── swap-tokens.md       #   DEX swaps
│       ├── yield-monitor.md     #   Monitor lending APYs
│       ├── technical-analysis.md#   RSI, MACD, Bollinger signals
│       ├── arbitrage-scanner.md #   Cross-DEX price scanning
│       ├── airdrop-farming.md   #   Pre-token protocol interactions
│       ├── staking.md           #   ETH/cbETH staking
│       ├── polymarket-trading.md#   Prediction market edge trading
│       ├── latency-arbitrage.md #   Spot vs Polymarket price gaps
│       ├── post-trade-review.md #   After every trade: log + learn
│       ├── weekly-review.md     #   Sunday: aggregate + adjust
│       └── memory.md            #   Read/write agent memory
├── config/
│   ├── wallet.json              # Wallet address, tokens, protocols
│   ├── policy.json              # Spending limits, risk parameters
│   └── strategy-playbook.md     # Strategy triggers and sizing rules
├── mcp-servers/                 # Backend services (TypeScript)
│   ├── blockchain/              #   On-chain data + transaction encoding
│   ├── prices/                  #   CoinGecko market data
│   ├── signer/                  #   Transaction signing + policy enforcement
│   └── polymarket/              #   Polymarket prediction markets API
├── data/
│   ├── audit-log/               # Every signed transaction (auto-generated)
│   └── memory/
│       ├── lessons.md           # Mistakes the fleet won't repeat
│       ├── strategy-stats.json  # Win rates and P&L by strategy
│       ├── market-patterns.md   # Observed market behavior
│       └── trade-journal/       # Individual trade logs
├── keystore/
│   └── wallet.key.enc           # Your encrypted private key
└── scripts/
    └── templates/               # Script templates (no secrets)
```

## Customizing

### Adjust Spending Limits

Edit `config/policy.json`:

```json
{
  "per_transaction_usd": 10,
  "daily_limit_usd": 20,
  "weekly_limit_usd": 50
}
```

### Add New Tokens

Add to `config/policy.json` under `allowed_tokens`. The agents will only trade tokens on this list.

### Change Strategy Allocations

Edit the target allocations in `CLAUDE.md` under "Active Strategies" and in `config/strategy-playbook.md`.

### Change Language

The fleet speaks Spanish by default (it was built for a Spanish-speaking user). To change it, update the language instruction in `CLAUDE.md`.

## Network Details

| Property | Value |
|----------|-------|
| Chain | Base (Ethereum L2) |
| Chain ID | 8453 |
| RPC | `https://mainnet.base.org` |
| Gas cost | ~$0.001 per transaction |

## How the Fleet Learns

The agents have a memory system that makes them smarter over time:

```
Trade happens → post-trade-review skill logs the result
             → if error: writes lesson to lessons.md
             → updates strategy-stats.json (win/loss tracking)
             → writes to trade-journal/

Every Sunday → weekly-review aggregates the week
            → adjusts strategy parameters
            → reports to you
```

If a strategy keeps losing, the fleet **automatically pauses it** and alerts you.

## License

MIT
