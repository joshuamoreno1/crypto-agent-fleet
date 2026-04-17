---
name: latency-arbitrage
description: Detect and exploit price latency gaps between real-time crypto prices and Polymarket prediction market prices. Use when scanning for arbitrage opportunities on Polymarket.
model: opus
---

# Latency Arbitrage — Polymarket

## Concepto
Polymarket actualiza precios más lento que feeds en tiempo real.
Cuando BTC sube rápido pero Polymarket no lo refleja, hay oportunidad.

## Cuándo usar
- Heartbeat regular (scan de oportunidades)
- owner asks "busca arbitraje en Polymarket"
- Volatilidad alta en crypto (movimientos > 3% en 1h)

## Flujo de detección
1. `prices.get_prices(["bitcoin", "ethereum"])` — precio spot actual
2. `polymarket.list_markets(category="crypto", active=true)` — mercados crypto
3. Para cada mercado tipo "Token above $X":
   a. `polymarket.get_market_price(token_id)` — precio share (= prob implícita)
   b. Calcular probabilidad real basada en precio spot vs threshold
   c. gap = prob_real - prob_polymarket
   d. Si gap > threshold configurado → OPORTUNIDAD
4. `polymarket.get_order_book(token_id)` — verificar liquidez
5. Si liquidez suficiente → reportar al Overseer

## Thresholds
- Gap mínimo para reportar: 5%
- Gap mínimo para recomendar trade: 10%
- Liquidez mínima en order book: $500
- Max posición: $5 USDC

## Riesgos
- Fees de taker (~1-2%) reducen el edge
- Slippage en mercados poco líquidos
- Polymarket anti-arbitrage measures
- Con capital < $200, el profit post-fees es marginal
- Edge se reduce con el tiempo (más bots en Polymarket)

## Viabilidad por capital
- $50: Solo monitoreo + trades muy selectivos (gap > 15%)
- $200: Viable con disciplina (gap > 8%)
- $500+: Rentable consistentemente (gap > 5%)

## Reglas
- SIEMPRE verificar liquidez del order book antes de recomendar
- SIEMPRE calcular profit DESPUÉS de fees (taker ~1-2%)
- Market orders (FOK) para ejecución inmediata
- Máximo 3 posiciones de arbitraje simultáneas
- Stop-loss: si price se mueve 5% en contra, cerrar
- Registrar en data/memory/trade-journal/
