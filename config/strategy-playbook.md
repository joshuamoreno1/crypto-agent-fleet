# Strategy Playbook — Cuándo usar cada estrategia

> **OBLIGATORIO**: Todos los agentes DEBEN leer este archivo al arrancar.
> El Overseer lo usa para decidir allocation. El Analyst para priorizar señales. El Trader para validar antes de ejecutar.

---

## 🏦 1. Yield Farming — El "CDT crypto"

**Qué es:** Depositar USDC en protocolos de lending (Aave, Compound) para ganar interés pasivo.

**Cuándo usarla:**
- **Siempre** — es la base estable del portfolio (target 40%)
- Cuando APY > 2% (por debajo no justifica el riesgo con montos pequeños)
- Como primera estrategia al arrancar

**Retorno esperado:** ~$0.27/mes con $80 al 4% APY. Bajo pero seguro.

---

## 📊 2. Technical Trading — Compra/venta por señales técnicas

**Qué es:** El Analyst calcula RSI, MACD, Bollinger Bands y genera señales. Si hay confluencia ≥ 3/5 indicadores, recomienda trade.

**Cuándo usarla:**
- Solo cuando hay señal fuerte (3+ indicadores alineados)
- Solo después de backtesting con Sharpe > 1.0
- **Nunca sin stop loss definido**

**Sizing:** 5-10% del portfolio por trade. Max 30% total en trading activo.

**Regla de sobreventa (aprobada 2026-03-30):**
- Si RSI < 30 → compra automática de $5 en ETH sin esperar confluencia completa
- Stop loss obligatorio: 5% (máx pérdida ~$0.25 por trade)
- Confluencia mínima bajada a 2/5 (antes 3/5) para trades normales
- Si win rate < 40% después de 10 trades → revertir a 3/5

**Retorno esperado:** ~$2-5/mes si las señales son buenas.

---

## ⚡ 3. Arbitrage — Comprar barato en un DEX, vender caro en otro

**Qué es:** Scanner compara precios entre Uniswap, Aerodrome, Curve cada 15 min.

**Cuándo usarla:**
- Cuando el spread post-gas > 0.3%
- En stablecoin depegs temporales (DAI/USDC)
- En pools nuevos donde los precios aún no están equilibrados
- Auto-aprobado si monto < $50

**Expectativa real:** $0-3/mes. Es oportunista — el costo de escanear es cero, así que cualquier captura es ganancia.

> ⚠️ **No compites con MEV bots.** Enfócate en pares con menos competencia en Base.

---

## 🎯 4. Airdrop Farming — Especulación con interacciones tempranas

**Qué es:** Interactuar semanalmente con protocolos sin token para calificar para futuros airdrops.

**Cuándo usarla:**
- Cuando el Analyst identifica protocolos con: VC tier 1, TVL > $10M, 3+ meses live, auditados, sin token
- Máximo 10% del portfolio ($20)
- Cadencia semanal: swap + deposit + vote para parecer usuario real (no bot)

**Retorno esperado:** $0 hasta que haya airdrop. Si llega, históricamente han sido $800-1,500+. Es lotería educada.

---

## 🔒 5. Staking & Liquid Staking — cbETH pasivo

**Qué es:** Comprar cbETH (ETH stakeado de Coinbase). Se aprecia ~3.5% APY automáticamente.

**Cuándo usarla:**
- Como posición pasiva de largo plazo (target 10%, max 30%)
- **Jugada simple:** Buy and hold cbETH
- **Jugada compuesta:** cbETH → Aave para doble yield (~5.1% APY)

**Retorno esperado:** ~$0.08/mes con $20 al 5%. Mínimo pero cero mantenimiento.

---

## 📈 7. Perpetual Trading — Forex, Commodities, Stocks & Crypto con leverage

**Qué es:** Abrir posiciones LONG o SHORT con leverage en gTrade (Gains Network) sobre Base.
En vez de comprar el activo, "apostás" a que sube (long) o baja (short) con un multiplicador.
Si ponés $5 con 10x leverage, es como si tuvieras $50 de exposición.

**Protocolo:** gTrade (Gains Network) — Diamond en Base: `0x6cD5aC19a07518A8092eEFfDA4f1174C72704eeb`
**Colateral:** USDC

**Pares disponibles:**
- **Forex:** EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, NZD/USD, USD/CAD, EUR/GBP, EUR/JPY
- **Commodities:** Oro (XAU/USD), Plata (XAG/USD)
- **Stocks:** AAPL, TSLA, NVDA, GOOGL, AMZN, META, MSFT
- **Índices:** SPX500 (S&P 500)
- **Crypto:** BTC, ETH, SOL, LINK, DOGE y 40+ más

**Cuándo usarla:**

| Escenario | Acción | Pair sugerido |
|---|---|---|
| USD débil (BTC+oro subiendo) | LONG EUR/USD, LONG XAU/USD | 21, 90 |
| USD fuerte (DXY subiendo) | SHORT EUR/USD | 21 |
| Earnings de tech fuertes | LONG NVDA o TSLA post-report | 65, 63 |
| Crisis geopolítica / incertidumbre | LONG XAU/USD (oro = refugio) | 90 |
| ETH oversold (RSI < 30) | LONG ETH/USD con leverage en vez de spot | 1 |
| Trend claro en forex (4h+ timeframe) | Seguir tendencia con 10-25x | 21-30 |
| Mercado lateral sin tendencia | NO operar perps — el funding te come | — |

**Sizing y límites:**
- Max colateral por posición: $5 USDC
- Max total en perps: $20 USDC de colateral
- Max posiciones simultáneas: 4
- Leverage max por grupo: crypto 10x, forex 25x, commodities 10x, stocks 5x
- **SIEMPRE con stop loss** — max 5% de distancia al precio de entrada
- Max pérdida por trade: ~$2.50 (con SL al 5% y $5 colateral a 10x)

**Fees (super baratos en gTrade):**
- Forex: ~0.008% por apertura/cierre (prácticamente gratis)
- Crypto: ~0.08%
- Commodities: ~0.04%
- Stocks: ~0.08%

**Retorno esperado:** $5-15/mes con buen análisis técnico + macro. Alto riesgo, alto reward.
Un trade de forex a 10x que se mueva 0.5% a tu favor = 5% de ganancia sobre colateral.

**⚠️ Riesgos específicos:**
- Con leverage, las pérdidas también se multiplican. 10x leverage + 10% en contra = pierdes todo.
- Forex cierra fines de semana — puede haber gap el lunes.
- Stocks solo se mueven en market hours (9:30-16:00 ET) pero gTrade permite operar 24/7.
- Funding fees se acumulan con el tiempo — no dejar posiciones abiertas por días sin razón.

**Regla adaptativa:**
- Si win rate < 40% después de 10 trades de perps → bajar leverage a 3x max
- Si pérdida acumulada en perps > $10 → PAUSAR perpetuals, alert owner

---

## 🎛️ 6. Portfolio Management — La meta-estrategia

**Qué es:** El Overseer gestiona la asignación entre TODAS las estrategias. Rebalancea semanalmente.

**Cuándo actúa:**
- Si una estrategia se desvía > 10% del target → rebalancear
- Si USDC reserve < 5% → retirar de yield para reponer
- Daily P&L report a las 20:00 COT
- Weekly review los domingos

**Target allocation:**

| Estrategia | Target |
|---|---|
| Trading (spot) | 40% |
| Perpetuals (gTrade) | 20% |
| Arbitrage | 5% |
| Airdrop | 5% |
| Prediction Markets | 10% |
| USDC Reserve | 10% |
| Yield/Staking | 10% (when owner activates it) |

---

## 💡 TL;DR — Cuál usar y cuándo

| Situación | Estrategia |
|---|---|
| "Quiero ganar algo seguro sin hacer nada" | **Yield Farming** |
| "ETH parece que va a subir/bajar" | **Technical Trading** (spot) o **Perpetuals** (con leverage) |
| "El dólar está débil / fuerte" | **Perpetuals** — EUR/USD, GBP/USD |
| "Hay crisis / incertidumbre" | **Perpetuals** — LONG XAU/USD (oro) |
| "Las acciones tech van a subir post-earnings" | **Perpetuals** — LONG NVDA, TSLA |
| "Hay diferencia de precio entre DEXs" | **Arbitrage** |
| "Este protocolo nuevo pinta bien y no tiene token" | **Airdrop Farming** |
| "Quiero apostar a un resultado binario" | **Polymarket** (prediction markets) |
| "¿Mi portfolio está balanceado?" | **Portfolio Management** |
