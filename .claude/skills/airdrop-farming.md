---
name: airdrop-farming
description: Research and execute airdrop farming strategies — interact with pre-token protocols to qualify for airdrops
model: opus
---

# Airdrop Farming

## Strategy Overview

Interact with protocols that haven't launched a token yet to position for potential airdrops.
This is speculative — no guarantee of airdrop, but historically high ROI when it hits.

## Research Phase

### Identify Candidates
Use web search and DeFi analysis to find protocols that:
1. Have significant VC backing (a16z, Paradigm, Sequoia, etc.)
2. Have high TVL but no token
3. Have been live for 3+ months
4. Are on Base or accessible from Base
5. Have hinted at token launch or governance

### Evaluate Each Protocol
For each candidate, answer:
- Who backed them? (quality of investors)
- TVL and growth trend?
- Smart contracts audited?
- How long since launch?
- Any mentions of token, governance, or snapshot?
- Sybil detection criteria known?

### Risk Assessment
- Capital at risk: what's the minimum interaction cost?
- Lock-up: are funds locked or withdrawable?
- Smart contract risk: audited by whom?
- Probability of airdrop: low/medium/high

## Interaction Recipe Template

For each protocol, create a "recipe" — a repeatable set of interactions:

```
📋 Airdrop Recipe: [Protocol Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: Active / Completed / Expired
Capital required: $XX
Estimated gas: $XX total
Frequency: weekly / bi-weekly
Timeline: X weeks

Steps:
1. Bridge $XX to [chain] (if needed)
2. Swap $XX [token] on their DEX
3. Deposit $XX in their lending pool
4. Vote on governance proposal (if any)
5. Interact with X different features

Anti-Sybil notes:
- Use same wallet consistently
- Maintain activity over 3+ weeks
- Diversify interaction types
- Don't batch-interact (looks bot-like)
```

## Execution

The Trader executes recipe steps on schedule:
- Weekly interactions to maintain activity
- Track all interactions in audit log
- Monitor for snapshot announcements
- Alert owner immediately if token launch announced

## Post-Airdrop

When airdrop is announced:
1. Verify eligibility on their checker tool
2. Claim tokens when available
3. Assess: hold or sell?
4. Report to owner

## Safety
- Never commit more than 10% of portfolio to airdrop farming
- Only interact with audited protocols
- Funds should be withdrawable (avoid long lock-ups)
- Track gas costs — they add up over weeks
- This is speculative — treat it as lottery, not income
