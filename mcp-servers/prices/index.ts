import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// Simple in-memory cache (30s TTL) to avoid CoinGecko rate limits on fleet startup
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 30_000;

async function cgFetch(path: string): Promise<any> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const url = `${COINGECKO_BASE}${path}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 3000));
        continue;
      }
      if (!res.ok) throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      cache.set(path, { data, ts: Date.now() });
      return data;
    } catch (e: any) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

const TOKEN_IDS: Record<string, string> = {
  // Short aliases
  eth: "ethereum",
  weth: "weth",
  usdc: "usd-coin",
  dai: "dai",
  cbeth: "coinbase-wrapped-staked-eth",
  btc: "bitcoin",
  aero: "aerodrome-finance",
  pol: "matic-network",
  matic: "matic-network",
  sol: "solana",
  bnb: "binancecoin",
  // Full names → CoinGecko IDs (pass-through already works, these make it explicit)
  ethereum: "ethereum",
  bitcoin: "bitcoin",
  solana: "solana",
  polygon: "matic-network",
};

function resolveTokenId(input: string): string {
  const lower = input.toLowerCase();
  return TOKEN_IDS[lower] || lower;
}

const server = new McpServer({
  name: "prices-mcp",
  version: "1.0.0",
});

server.tool(
  "get_prices",
  "Get current prices for one or more tokens in USD",
  {
    tokens: z.string().describe("Comma-separated list of token symbols (e.g. 'eth,usdc,dai')"),
  },
  async ({ tokens }) => {
    try {
      const tokenList = tokens.split(",").map((t) => t.trim());
      const ids = tokenList.map(resolveTokenId).join(",");

      const data = await cgFetch(
        `/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
      );

      const lines: string[] = ["Current Prices (USD):", ""];

      for (const symbol of tokenList) {
        const id = resolveTokenId(symbol);
        const info = data[id];
        if (info && info.usd != null) {
          const change = info.usd_24h_change != null
            ? ` (${info.usd_24h_change > 0 ? "+" : ""}${info.usd_24h_change.toFixed(2)}% 24h)`
            : "";
          const mcap = info.usd_market_cap != null
            ? ` | MCap: $${(info.usd_market_cap / 1e9).toFixed(2)}B`
            : "";
          lines.push(`${symbol.toUpperCase()}: $${Number(info.usd).toLocaleString()}${change}${mcap}`);
        } else {
          lines.push(`${symbol.toUpperCase()}: not found (tried id: ${id})`);
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error fetching prices: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_price_history",
  "Get price history for a token over the last N days",
  {
    token: z.string().describe("Token symbol or CoinGecko ID (e.g. 'eth')"),
    days: z.number().min(1).max(365).default(7).describe("Number of days of history (1-365)"),
  },
  async ({ token, days }) => {
    try {
      const id = resolveTokenId(token);
      const data = await cgFetch(`/coins/${id}/market_chart?vs_currency=usd&days=${days}`);

      const prices = data.prices as [number, number][];

      if (!prices || prices.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No price data found for ${token} (id: ${id})` }],
        };
      }

      const values = prices.map(([, p]) => p);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const first = values[0];
      const last = values[values.length - 1];
      const change = ((last - first) / first) * 100;

      const step = Math.max(1, Math.floor(prices.length / 10));
      const samples = prices
        .filter((_, i) => i % step === 0 || i === prices.length - 1)
        .map(
          ([ts, p]) =>
            `  ${new Date(ts).toISOString().split("T")[0]}: $${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        );

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `${token.toUpperCase()} — Last ${days} days:`,
              ``,
              `  Start: $${first.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              `  End:   $${last.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              `  Change: ${change > 0 ? "+" : ""}${change.toFixed(2)}%`,
              `  Min:   $${min.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              `  Max:   $${max.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              `  Avg:   $${avg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              ``,
              `Sample prices:`,
              ...samples,
            ].join("\n"),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error fetching history: ${error.message}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
