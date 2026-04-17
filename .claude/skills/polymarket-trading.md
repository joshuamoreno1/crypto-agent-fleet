---
name: polymarket-trading
description: Evaluate and trade prediction markets on Polymarket. Use when analyzing prediction market opportunities, calculating edge, or placing trades on Polymarket.
model: opus
---

# Polymarket Trading

## Qué es Polymarket
Mercado de predicciones en Polygon (chain 137). Compras shares de "Sí" o "No" en eventos.
Share ganadora paga $1.00, perdedora $0.00. El precio = probabilidad implícita.

## Cuándo usar este skill
- owner asks analizar un mercado de predicción
- Heartbeat detecta oportunidad en Polymarket
- Analyst identifica mercado con edge > 20%

## Flujo de evaluación
1. `polymarket.list_markets(category="crypto", active=true)` — buscar mercados
2. Para cada mercado interesante:
   a. `polymarket.get_market_price(token_id)` — precio actual
   b. `prices.get_prices(token)` — precio real del activo subyacente
   c. `prices.get_price_history(token, days=30)` — tendencia
   d. Calcular probabilidad real usando technical-analysis
   e. Calcular edge = probabilidad_real - precio_polymarket
3. Si edge > 20% → reportar al Overseer con recomendación

## Cálculo de probabilidad para mercados tipo "Token above $X by Date"
- Precio actual > threshold + 10%: prob 80-95%
- Precio actual > threshold: prob 55-80%
- Precio actual cerca (±5%): prob 40-60%
- Precio actual < threshold: prob 20-45%
- Precio actual < threshold - 10%: prob 5-20%

Ajustar por:
- Tendencia (+10% uptrend, -10% downtrend)
- Tiempo restante (más tiempo = más hacia 50%)
- Volatilidad (más vol = más hacia 50%)
- Eventos catalíticos

## Position Sizing (Half-Kelly)
- Kelly fraction = (edge / odds)
- Half-Kelly = Kelly / 2 (más conservador)
- Máximo por posición: $5 USDC
- Máximo total en Polymarket: $20 USDC
- Máximo posiciones simultáneas: 4

## Reglas
- SIEMPRE pedir owner approval antes de comprar shares
- SIEMPRE usar limit orders (excepto event-driven urgente)
- Edge mínimo: 20%
- Categorías permitidas: crypto, tech
- Liquidez mínima del mercado: $1,000
- Registrar TODO en data/memory/trade-journal/

## Monitoreo de posiciones
- Revisar posiciones cada 24h
- Re-evaluar probabilidades
- Si mercado cierra en < 48h → alert owner
- Si probabilidad cambió significativamente → reportar
