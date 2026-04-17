import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

// @polymarket/clob-client uses @noble/hashes with ESM subpath exports
// that Bun can't resolve at startup. Dynamic import defers loading until
// a trading tool is actually called — read-only tools work without it.

const CLOB_BASE = "https://clob.polymarket.com";
const GAMMA_BASE = "https://gamma-api.polymarket.com";

// --- Decrypt private key from keystore (same mechanism as signer MCP) ---
function decryptPrivateKey(): `0x${string}` {
  const configDir = resolve(import.meta.dir, "../../config");
  const walletConfig = JSON.parse(readFileSync(resolve(configDir, "wallet.json"), "utf-8"));
  const keystorePath = resolve(configDir, walletConfig.wallet.keystore_path);
  const password = process.env.SIGNER_PASSWORD;
  if (!password) throw new Error("SIGNER_PASSWORD not set");
  const result = execSync(
    `openssl enc -aes-256-cbc -pbkdf2 -d -in "${keystorePath}" -pass env:SIGNER_PASSWORD`,
    { encoding: "utf-8", timeout: 5000, env: { ...process.env, SIGNER_PASSWORD: password } }
  ).trim();
  return `0x${result}` as `0x${string}`;
}

// --- Polymarket Trading Auth (dynamic import to avoid Bun ESM issue) ---
const TRADING_NOT_CONFIGURED_ERROR =
  "Polymarket trading not configured. Set POLYMARKET_API_KEY, POLYMARKET_API_SECRET, POLYMARKET_PASSPHRASE (and SIGNER_PASSWORD for wallet signing).";

async function getTradingClient(): Promise<any | null> {
  const apiKey = process.env.POLYMARKET_API_KEY;
  const secret = process.env.POLYMARKET_API_SECRET;
  const passphrase = process.env.POLYMARKET_PASSPHRASE;

  if (!apiKey || !secret || !passphrase) return null;

  let privateKey: `0x${string}`;
  try {
    privateKey = decryptPrivateKey();
  } catch {
    return null;
  }

  // Dynamic imports — only loaded when trading tools are called
  const { ClobClient } = await import("@polymarket/clob-client");
  const { createWalletClient, http } = await import("viem");
  const { polygon } = await import("viem/chains");
  const { privateKeyToAccount } = await import("viem/accounts");

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain: polygon, transport: http() });
  const creds = { key: apiKey, secret, passphrase };
  return new ClobClient(CLOB_BASE, 137, walletClient, creds);
}

async function apiFetch(url: string): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e: any) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

const server = new McpServer({
  name: "polymarket-mcp",
  version: "1.0.0",
});

server.tool(
  "list_markets",
  "List prediction markets from Polymarket. Returns market question, outcomes, prices, volume, and liquidity.",
  {
    category: z.string().optional().describe("Category/tag to filter by (e.g. 'crypto', 'politics')"),
    active: z.union([z.boolean(), z.string()]).optional().default(true).transform(v => v === true || v === "true").describe("Only show active markets (true/false)"),
    limit: z.union([z.number(), z.string()]).optional().default(20).transform(v => Math.min(100, Math.max(1, Number(v)))).describe("Number of markets to return (1-100, default 20)"),
    query: z.string().optional().describe("Search query to filter markets by title"),
  },
  async ({ category, active, limit, query }) => {
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("active", String(active));
      if (category) params.set("tag", category);

      params.set("order", "volume");
      params.set("ascending", "false");
      params.set("closed", "false");

      const data = await apiFetch(`${GAMMA_BASE}/markets?${params.toString()}`);
      let markets = Array.isArray(data) ? data : [];

      if (query) {
        const q = query.toLowerCase();
        markets = markets.filter((m: any) =>
          m.question?.toLowerCase().includes(q) || m.slug?.toLowerCase().includes(q)
        );
      }

      if (markets.length === 0) {
        return { content: [{ type: "text" as const, text: "No markets found matching criteria." }] };
      }

      const lines: string[] = [`Polymarket — ${markets.length} markets found:`, ""];

      for (const m of markets) {
        lines.push(`📊 ${m.question}`);
        lines.push(`   Slug: ${m.slug || "N/A"}`);
        lines.push(`   Outcomes: ${m.outcomes || "N/A"} | Prices: ${m.outcomePrices || "N/A"}`);
        lines.push(`   Volume: $${Number(m.volume || 0).toLocaleString()}`);
        lines.push(`   Liquidity: $${Number(m.liquidity || 0).toLocaleString()}`);
        lines.push(`   End Date: ${m.endDate || "N/A"}`);
        lines.push(`   Active: ${m.active}`);
        lines.push(`   Condition ID: ${m.conditionId || "N/A"}`);
        lines.push(`   CLOB Token IDs: ${m.clobTokenIds || "N/A"}`);
        lines.push("");
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error listing markets: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_market",
  "Get details for a single Polymarket market by slug (from list_markets/search_markets output)",
  {
    slug: z.string().describe("The market slug (e.g. 'maduro-guilty-of-all-counts')"),
  },
  async ({ slug }) => {
    try {
      const data = await apiFetch(`${GAMMA_BASE}/markets?slug=${encodeURIComponent(slug)}`);
      const markets = Array.isArray(data) ? data : [];

      if (markets.length === 0) {
        return { content: [{ type: "text" as const, text: `No market found for slug: ${slug}` }] };
      }

      const m = markets[0];
      const lines: string[] = [
        `📊 ${m.question}`,
        `   Slug: ${m.slug || "N/A"}`,
        `   Outcomes: ${m.outcomes || "N/A"} | Prices: ${m.outcomePrices || "N/A"}`,
        `   Volume: $${Number(m.volume || 0).toLocaleString()}`,
        `   Liquidity: $${Number(m.liquidity || 0).toLocaleString()}`,
        `   End Date: ${m.endDate || "N/A"}`,
        `   Active: ${m.active}`,
        `   Condition ID: ${m.conditionId || "N/A"}`,
        `   CLOB Token IDs: ${m.clobTokenIds || "N/A"}`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error fetching market: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_market_price",
  "Get current midpoint price, best bid/ask, and spread for a Polymarket token",
  {
    token_id: z.string().describe("The CLOB token ID for the outcome"),
  },
  async ({ token_id }) => {
    try {
      // Use dedicated /price, /midpoint, /spread endpoints (not /book which serves stale data)
      const [midData, bidData, askData, spreadData, lastTradeData] = await Promise.all([
        apiFetch(`${CLOB_BASE}/midpoint?token_id=${token_id}`),
        apiFetch(`${CLOB_BASE}/price?token_id=${token_id}&side=SELL`).catch(() => null),
        apiFetch(`${CLOB_BASE}/price?token_id=${token_id}&side=BUY`).catch(() => null),
        apiFetch(`${CLOB_BASE}/spread?token_id=${token_id}`).catch(() => null),
        apiFetch(`${CLOB_BASE}/last-trade-price?token_id=${token_id}`).catch(() => null),
      ]);

      const mid = midData?.mid ?? midData?.midpoint ?? midData;
      const price = typeof mid === "object" ? JSON.stringify(mid) : mid;
      const pct = (Number(price) * 100).toFixed(1);

      const bidPrice = bidData?.price ?? bidData ?? "N/A";
      const askPrice = askData?.price ?? askData ?? "N/A";
      const spread = spreadData?.spread ?? spreadData ?? (
        bidPrice !== "N/A" && askPrice !== "N/A"
          ? (Number(askPrice) - Number(bidPrice)).toFixed(4)
          : "N/A"
      );
      const lastTrade = lastTradeData?.price ?? lastTradeData ?? "N/A";

      const lines = [
        `Midpoint price: ${price}`,
        `Implied probability: ${pct}%`,
        `Best bid (sell price): ${bidPrice}`,
        `Best ask (buy price): ${askPrice}`,
        `Spread: ${spread}`,
        `Last trade: ${lastTrade}`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error fetching midpoint: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_order_book",
  "Get the order book for a Polymarket token",
  {
    token_id: z.string().describe("The CLOB token ID for the outcome"),
    depth: z.number().optional().default(5).describe("Number of levels to show"),
  },
  async ({ token_id, depth }) => {
    try {
      // Fetch both the order book and live prices (book endpoint can serve stale data)
      const [data, bidData, askData, midData] = await Promise.all([
        apiFetch(`${CLOB_BASE}/book?token_id=${token_id}`),
        apiFetch(`${CLOB_BASE}/price?token_id=${token_id}&side=SELL`).catch(() => null),
        apiFetch(`${CLOB_BASE}/price?token_id=${token_id}&side=BUY`).catch(() => null),
        apiFetch(`${CLOB_BASE}/midpoint?token_id=${token_id}`).catch(() => null),
      ]);

      const bids = (data?.bids || []).slice(0, depth);
      const asks = (data?.asks || []).slice(0, depth);

      const liveBid = bidData?.price ?? bidData ?? "N/A";
      const liveAsk = askData?.price ?? askData ?? "N/A";
      const mid = midData?.mid ?? midData?.midpoint ?? midData ?? "N/A";

      const lines: string[] = [
        `Order Book (top ${depth} levels):`,
        `⚡ Live prices — Bid: ${liveBid} | Ask: ${liveAsk} | Mid: ${mid}`,
        `⚠️ Note: /book endpoint may show stale data. Live prices above are authoritative.`,
        "",
      ];

      lines.push("BIDS:");
      if (bids.length === 0) {
        lines.push("  (none)");
      } else {
        for (const b of bids) {
          lines.push(`  $${b.price} — ${b.size} shares`);
        }
      }

      lines.push("");
      lines.push("ASKS:");
      if (asks.length === 0) {
        lines.push("  (none)");
      } else {
        for (const a of asks) {
          lines.push(`  $${a.price} — ${a.size} shares`);
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error fetching order book: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_price_history",
  "Get price history for a Polymarket token",
  {
    token_id: z.string().describe("The CLOB token ID for the outcome"),
    interval: z.enum(["1d", "1w", "1m", "all"]).optional().default("1w").describe("Time interval"),
    fidelity: z.number().optional().default(60).describe("Number of data points to return"),
  },
  async ({ token_id, interval, fidelity }) => {
    try {
      const data = await apiFetch(
        `${CLOB_BASE}/prices-history?market=${token_id}&interval=${interval}&fidelity=${fidelity}`
      );

      const history = Array.isArray(data?.history) ? data.history : Array.isArray(data) ? data : [];

      if (history.length === 0) {
        return { content: [{ type: "text" as const, text: "No price history found." }] };
      }

      const lines: string[] = [`Price History (interval: ${interval}, ${history.length} points):`, ""];

      const step = Math.max(1, Math.floor(history.length / 20));
      const samples = history.filter((_: any, i: number) => i % step === 0 || i === history.length - 1);

      for (const point of samples) {
        const ts = point.t ? new Date(point.t * 1000).toISOString() : point.timestamp || "?";
        const price = point.p ?? point.price ?? "?";
        lines.push(`  ${ts}: $${price}`);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error fetching price history: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "search_markets",
  "Search Polymarket markets by text query",
  {
    query: z.string().describe("Search text"),
  },
  async ({ query }) => {
    try {
      const data = await apiFetch(
        `${GAMMA_BASE}/markets?limit=100&closed=false&order=volume&ascending=false`
      );
      const q = query.toLowerCase();
      const matches = (Array.isArray(data) ? data : []).filter(
        (m: any) => m.question?.toLowerCase().includes(q)
      );

      if (matches.length === 0) {
        return { content: [{ type: "text" as const, text: `No markets found matching "${query}".` }] };
      }

      const lines: string[] = [`Search results for "${query}" — ${matches.length} matches:`, ""];

      for (const m of matches) {
        lines.push(`📊 ${m.question}`);
        lines.push(`   Prices: ${m.outcomePrices || "N/A"}`);
        lines.push(`   Volume: $${Number(m.volume || 0).toLocaleString()}`);
        lines.push(`   End Date: ${m.endDate || "N/A"}`);
        lines.push("");
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error searching markets: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// --- Trading Tools (Fase 2) ---

server.tool(
  "place_order",
  "Place a buy or sell order on Polymarket CLOB",
  {
    token_id: z.string().describe("The CLOB token ID for the outcome"),
    side: z.enum(["BUY", "SELL"]).describe("Order side"),
    price: z.number().min(0).max(1).describe("Price per share (0-1, represents probability)"),
    size: z.number().min(0).describe("Number of shares"),
    order_type: z.enum(["GTC", "FOK", "GTD"]).optional().default("GTC").describe("Order type: GTC (good til cancelled), FOK (fill or kill), GTD (good til date)"),
  },
  async ({ token_id, side, price, size, order_type }) => {
    const client = await getTradingClient();
    if (!client) {
      return { content: [{ type: "text" as const, text: TRADING_NOT_CONFIGURED_ERROR }], isError: true };
    }

    try {
      const { Side, OrderType } = await import("@polymarket/clob-client");
      const orderSide = side === "BUY" ? Side.BUY : Side.SELL;
      const ot = order_type === "FOK" ? OrderType.FOK : order_type === "GTD" ? OrderType.GTD : OrderType.GTC;

      const resp = await client.createAndPostOrder(
        { tokenID: token_id, price, side: orderSide, size },
        undefined,
        ot as any,
      );

      const lines = [
        "Order placed successfully:",
        `  Order ID: ${resp?.orderID || resp?.id || JSON.stringify(resp)}`,
        `  Side: ${side}`,
        `  Price: $${price}`,
        `  Size: ${size} shares`,
        `  Type: ${order_type}`,
        `  Status: ${resp?.status || "submitted"}`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error placing order: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "cancel_order",
  "Cancel an open order on Polymarket CLOB",
  {
    order_id: z.string().describe("The order ID to cancel"),
  },
  async ({ order_id }) => {
    const client = await getTradingClient();
    if (!client) {
      return { content: [{ type: "text" as const, text: TRADING_NOT_CONFIGURED_ERROR }], isError: true };
    }

    try {
      const resp = await client.cancelOrder({ orderID: order_id });
      return {
        content: [{ type: "text" as const, text: `Order ${order_id} cancelled successfully.\n${JSON.stringify(resp)}` }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error cancelling order: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_orders",
  "List orders on Polymarket CLOB (open by default)",
  {
    status: z.enum(["open", "filled", "cancelled"]).optional().default("open").describe("Filter by order status"),
  },
  async ({ status }) => {
    const client = await getTradingClient();
    if (!client) {
      return { content: [{ type: "text" as const, text: TRADING_NOT_CONFIGURED_ERROR }], isError: true };
    }

    try {
      if (status === "open") {
        const orders = await client.getOpenOrders();
        if (!orders || orders.length === 0) {
          return { content: [{ type: "text" as const, text: "No open orders." }] };
        }

        const lines: string[] = [`Open orders (${orders.length}):`, ""];
        for (const o of orders) {
          lines.push(`  Order ${o.id}: ${o.side} ${o.original_size} @ $${o.price} — ${o.status} (market: ${o.market})`);
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      // For filled/cancelled, use getTrades as proxy
      const trades = await client.getTrades();
      const filtered = trades.filter((t) =>
        status === "filled" ? t.status === "MATCHED" : t.status === "CANCELLED"
      );

      if (filtered.length === 0) {
        return { content: [{ type: "text" as const, text: `No ${status} orders found.` }] };
      }

      const lines: string[] = [`${status} orders (${filtered.length}):`, ""];
      for (const t of filtered.slice(0, 20)) {
        lines.push(`  ${t.id}: ${t.side} ${t.size} @ $${t.price} — ${t.status} (${t.match_time})`);
      }
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error fetching orders: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_positions",
  "List current open positions (market exposure) on Polymarket",
  {},
  async () => {
    const client = await getTradingClient();
    if (!client) {
      return { content: [{ type: "text" as const, text: TRADING_NOT_CONFIGURED_ERROR }], isError: true };
    }

    try {
      // Derive positions from open orders and filled trades
      const [openOrders, trades] = await Promise.all([
        client.getOpenOrders(),
        client.getTrades(),
      ]);

      const positions = new Map<string, { side: string; size: number; avgPrice: number; count: number }>();

      for (const t of trades.filter((t) => t.status === "MATCHED")) {
        const key = t.asset_id;
        const existing = positions.get(key) || { side: t.side, size: 0, avgPrice: 0, count: 0 };
        const tradeSize = Number(t.size);
        const tradePrice = Number(t.price);

        if (t.side === "BUY") {
          existing.avgPrice = (existing.avgPrice * existing.size + tradePrice * tradeSize) / (existing.size + tradeSize);
          existing.size += tradeSize;
        } else {
          existing.size -= tradeSize;
        }
        existing.count++;
        existing.side = existing.size >= 0 ? "LONG" : "SHORT";
        positions.set(key, existing);
      }

      // Filter out zero positions
      const active = [...positions.entries()].filter(([, p]) => Math.abs(p.size) > 0.001);

      if (active.length === 0 && (!openOrders || openOrders.length === 0)) {
        return { content: [{ type: "text" as const, text: "No open positions or pending orders." }] };
      }

      const lines: string[] = [];

      if (active.length > 0) {
        lines.push(`Positions (${active.length}):`, "");
        for (const [assetId, p] of active) {
          lines.push(`  ${assetId}: ${p.side} ${Math.abs(p.size).toFixed(2)} shares @ avg $${p.avgPrice.toFixed(4)}`);
        }
      }

      if (openOrders && openOrders.length > 0) {
        lines.push("", `Pending orders (${openOrders.length}):`, "");
        for (const o of openOrders) {
          lines.push(`  ${o.id}: ${o.side} ${o.original_size} @ $${o.price} (${o.status})`);
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error fetching positions: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// --- On-chain CTF balance check (ERC-1155) ---
const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"; // Polymarket CTF on Polygon
const POLYGON_RPC = "https://polygon-bor-rpc.publicnode.com";
const WALLET_ADDRESS = "<YOUR_WALLET_ADDRESS>";

server.tool(
  "get_ctf_balance",
  "Check on-chain balance of Conditional Token (CTF/ERC-1155) shares on Polygon. Use this to verify if Polymarket shares are in the wallet.",
  {
    token_id: z.string().describe("The CLOB token ID for the outcome (YES or NO)"),
  },
  async ({ token_id }) => {
    try {
      // ERC-1155 balanceOf(address,uint256) selector: 0x00fdd58e
      const paddedAddress = WALLET_ADDRESS.slice(2).toLowerCase().padStart(64, "0");
      // Convert token_id (decimal string) to hex, pad to 32 bytes
      const tokenIdHex = BigInt(token_id).toString(16).padStart(64, "0");
      const calldata = `0x00fdd58e${paddedAddress}${tokenIdHex}`;

      const res = await fetch(POLYGON_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [{ to: CTF_CONTRACT, data: calldata }, "latest"],
          id: 1,
        }),
      });

      const json = await res.json() as any;
      if (json.error) {
        return { content: [{ type: "text" as const, text: `RPC error: ${json.error.message ?? JSON.stringify(json.error)}` }], isError: true };
      }
      if (!json.result || json.result === "0x") {
        return { content: [{ type: "text" as const, text: `CTF Balance: 0 shares (no balance found for this token_id on contract ${CTF_CONTRACT})` }] };
      }

      const rawBalance = BigInt(json.result);
      // CTF shares use 6 decimals (same as USDC.e collateral)
      const balance = Number(rawBalance) / 1e6;

      return {
        content: [{
          type: "text" as const,
          text: `CTF Balance for token ${token_id.slice(0, 20)}...${token_id.slice(-10)}:\n  Raw: ${rawBalance.toString()}\n  Shares: ${balance.toFixed(6)}\n  Contract: ${CTF_CONTRACT} (Polygon)`,
        }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error checking CTF balance: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// --- Approve CTF tokens for selling on Polymarket ---
const EXCHANGE_CONTRACT = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const NEG_RISK_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";

server.tool(
  "approve_sell",
  "Approve the Polymarket exchange to transfer your CTF shares (required before selling). Only needs to be done once.",
  {},
  async () => {
    let privateKey: `0x${string}`;
    try {
      privateKey = decryptPrivateKey();
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error decrypting key: ${e.message}` }], isError: true };
    }

    try {
      const { createWalletClient, http, encodeFunctionData } = await import("viem");
      const { polygon } = await import("viem/chains");
      const { privateKeyToAccount } = await import("viem/accounts");

      const account = privateKeyToAccount(privateKey);
      const walletClient = createWalletClient({ account, chain: polygon, transport: http(POLYGON_RPC) });

      const abi = [{
        name: "setApprovalForAll",
        type: "function" as const,
        inputs: [
          { name: "operator", type: "address" as const },
          { name: "approved", type: "bool" as const },
        ],
        outputs: [],
        stateMutability: "nonpayable" as const,
      }] as const;

      const { createPublicClient } = await import("viem");
      const publicClient = createPublicClient({ chain: polygon, transport: http(POLYGON_RPC) });

      // Approve Exchange first, wait for confirmation, then Neg Risk Exchange
      const tx1 = await walletClient.writeContract({
        address: CTF_CONTRACT as `0x${string}`,
        abi,
        functionName: "setApprovalForAll",
        args: [EXCHANGE_CONTRACT as `0x${string}`, true],
      });

      await publicClient.waitForTransactionReceipt({ hash: tx1 });

      const tx2 = await walletClient.writeContract({
        address: CTF_CONTRACT as `0x${string}`,
        abi,
        functionName: "setApprovalForAll",
        args: [NEG_RISK_EXCHANGE as `0x${string}`, true],
      });

      return {
        content: [{
          type: "text" as const,
          text: [
            "CTF sell approval granted:",
            `  Exchange (${EXCHANGE_CONTRACT}): tx ${tx1}`,
            `  Neg Risk Exchange (${NEG_RISK_EXCHANGE}): tx ${tx2}`,
            "",
            "You can now sell shares on Polymarket.",
          ].join("\n"),
        }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error approving: ${error.message}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
