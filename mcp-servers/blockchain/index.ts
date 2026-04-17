import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createPublicClient, http, formatEther, formatUnits, encodeFunctionData, parseUnits } from "viem";
import { base, polygon } from "viem/chains";
import { readFileSync } from "fs";
import { resolve } from "path";

// --- Config ---
const configPath = resolve(import.meta.dir, "../../config/wallet.json");
const config = JSON.parse(readFileSync(configPath, "utf-8"));
const walletAddress = config.wallet.address as `0x${string}`;
const tokens = config.tokens;

// --- Viem Clients ---
const client = createPublicClient({
  chain: base,
  transport: http(config.network.rpc_url),
});

// Polygon client for Polymarket balance checks
const polygonClient = createPublicClient({
  chain: polygon,
  transport: http("https://polygon-bor-rpc.publicnode.com"),
});

// --- ERC20 ABI (mínimo para balanceOf y decimals) ---
const erc20Abi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// --- MCP Server ---
const server = new McpServer({
  name: "blockchain-mcp",
  version: "1.0.0",
});

// Tool: get_balance
server.tool(
  "get_balance",
  "Get ETH and token balances for the wallet on Base",
  {
    token: z
      .string()
      .optional()
      .describe(
        "Token symbol (ETH, USDC, WETH, etc). Leave empty for all balances."
      ),
  },
  async ({ token }) => {
    try {
      const results: string[] = [];

      if (!token || token.toUpperCase() === "ETH") {
        const ethBalance = await client.getBalance({ address: walletAddress });
        results.push(`ETH: ${formatEther(ethBalance)} ETH`);
      }

      const tokenEntries = Object.entries(tokens).filter(
        ([symbol, info]: [string, any]) => {
          if (info.address === "native") return false;
          if (token && token.toUpperCase() !== symbol.toUpperCase()) return false;
          return true;
        }
      );

      for (const [symbol, info] of tokenEntries as [string, any][]) {
        try {
          const balance = await client.readContract({
            address: info.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletAddress],
          });
          results.push(`${symbol}: ${formatUnits(balance as bigint, info.decimals)}`);
        } catch (e: any) {
          results.push(`${symbol}: Error reading balance — ${e.message}`);
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Wallet: ${walletAddress}\nNetwork: Base (${config.network.chain_id})\n\n${results.join("\n")}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: get_polygon_balance
server.tool(
  "get_polygon_balance",
  "Get USDC and POL (gas) balances on Polygon network for the wallet. Use this for Polymarket capital overview.",
  {},
  async () => {
    try {
      // POL (native gas token)
      const polBalance = await polygonClient.getBalance({ address: walletAddress });

      // USDC on Polygon (native, not bridged)
      const USDC_POLYGON = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
      const USDC_POLYGON_BRIDGED = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

      let usdcBalance = 0n;
      let usdcBridgedBalance = 0n;

      try {
        usdcBalance = await polygonClient.readContract({
          address: USDC_POLYGON as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [walletAddress],
        }) as bigint;
      } catch {}

      try {
        usdcBridgedBalance = await polygonClient.readContract({
          address: USDC_POLYGON_BRIDGED as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [walletAddress],
        }) as bigint;
      } catch {}

      const polFormatted = parseFloat(formatEther(polBalance)).toFixed(4);
      const usdcFormatted = parseFloat(formatUnits(usdcBalance, 6)).toFixed(2);
      const usdcBridgedFormatted = parseFloat(formatUnits(usdcBridgedBalance, 6)).toFixed(2);
      const totalUsdc = (parseFloat(usdcFormatted) + parseFloat(usdcBridgedFormatted)).toFixed(2);

      const lines = [
        `Wallet: ${walletAddress}`,
        `Network: Polygon (137)`,
        ``,
        `POL (gas): ${polFormatted}`,
        `USDC (native): ${usdcFormatted}`,
        `USDC (bridged): ${usdcBridgedFormatted}`,
        `USDC total: $${totalUsdc}`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error fetching Polygon balance: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: get_gas_estimate
server.tool(
  "get_gas_estimate",
  "Get current gas price on Base",
  {},
  async () => {
    try {
      const gasPrice = await client.getGasPrice();
      const gasPriceGwei = Number(gasPrice) / 1e9;
      const swapGas = 150000n;
      const transferGas = 21000n;
      const approveGas = 46000n;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Gas Price: ${gasPriceGwei.toFixed(4)} gwei`,
              ``,
              `Estimated costs:`,
              `  Transfer ETH: ~${formatEther(gasPrice * transferGas)} ETH`,
              `  Token approval: ~${formatEther(gasPrice * approveGas)} ETH`,
              `  Swap (DEX): ~${formatEther(gasPrice * swapGas)} ETH`,
              ``,
              `Base L2 fees are extremely cheap.`,
            ].join("\n"),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: get_token_info
server.tool(
  "get_token_info",
  "Get info about a token by address on Base",
  {
    address: z.string().describe("Token contract address"),
  },
  async ({ address }) => {
    try {
      const tokenAddress = address as `0x${string}`;

      const [symbol, decimals, balance] = await Promise.all([
        client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "symbol" }),
        client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "decimals" }),
        client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress] }),
      ]);

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Token: ${symbol}`,
              `Address: ${address}`,
              `Decimals: ${decimals}`,
              `Your balance: ${formatUnits(balance as bigint, Number(decimals))} ${symbol}`,
            ].join("\n"),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// --- Uniswap V3 ABIs ---
const swapRouterAbi = [
  {
    inputs: [
      {
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "exactInputSingle",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;

const erc20ApproveAbi = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Tool: get_allowance
server.tool(
  "get_allowance",
  "Check ERC20 token allowance for a spender (e.g., router)",
  {
    token_address: z.string().describe("ERC20 token contract address"),
    spender: z.string().describe("Spender address (e.g., Uniswap Router)"),
  },
  async ({ token_address, spender }) => {
    try {
      const allowance = await client.readContract({
        address: token_address as `0x${string}`,
        abi: erc20ApproveAbi,
        functionName: "allowance",
        args: [walletAddress, spender as `0x${string}`],
      });

      // Find token decimals
      const decimals = await client.readContract({
        address: token_address as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
      });

      return {
        content: [{
          type: "text" as const,
          text: `Allowance: ${formatUnits(allowance as bigint, Number(decimals))}\nToken: ${token_address}\nSpender: ${spender}\nRaw: ${(allowance as bigint).toString()}`,
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Tool: encode_approve
server.tool(
  "encode_approve",
  "Encode an ERC20 approve transaction. Returns calldata hex to pass to signer.sign_and_send",
  {
    token_address: z.string().describe("ERC20 token to approve"),
    spender: z.string().describe("Address to approve (e.g., Uniswap Router)"),
    amount: z.string().describe("Amount to approve (human readable, e.g., '5.0')"),
    decimals: z.number().describe("Token decimals (6 for USDC, 18 for WETH/DAI)"),
  },
  async ({ token_address, spender, amount, decimals }) => {
    try {
      const amountWei = parseUnits(amount, decimals);
      const data = encodeFunctionData({
        abi: erc20ApproveAbi,
        functionName: "approve",
        args: [spender as `0x${string}`, amountWei],
      });

      return {
        content: [{
          type: "text" as const,
          text: [
            `✅ Approve calldata encoded`,
            ``,
            `To (token): ${token_address}`,
            `Spender: ${spender}`,
            `Amount: ${amount} (${amountWei.toString()} wei)`,
            ``,
            `Use with signer.sign_and_send:`,
            `  to: "${token_address}"`,
            `  data: "${data}"`,
            `  value_eth: "0"`,
            `  value_usd: 0`,
            `  operation: "approve"`,
          ].join("\n"),
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Tool: encode_swap
server.tool(
  "encode_swap",
  "Encode a Uniswap V3 exactInputSingle swap. Returns calldata hex to pass to signer.sign_and_send",
  {
    token_in: z.string().describe("Input token address"),
    token_out: z.string().describe("Output token address"),
    amount_in: z.string().describe("Amount to swap (human readable, e.g., '5.0')"),
    decimals_in: z.number().describe("Input token decimals (6 for USDC, 18 for WETH)"),
    min_amount_out: z.string().describe("Minimum output amount (human readable, with slippage applied)"),
    decimals_out: z.number().describe("Output token decimals"),
    fee: z.number().default(500).describe("Pool fee tier: 500 (0.05%), 3000 (0.3%), 10000 (1%). Default 500 for majors."),
  },
  async ({ token_in, token_out, amount_in, decimals_in, min_amount_out, decimals_out, fee }) => {
    try {
      const amountInWei = parseUnits(amount_in, decimals_in);
      const minOutWei = parseUnits(min_amount_out, decimals_out);

      const router = config.protocols?.uniswap_v3?.router || "0x2626664c2603336E57B271c5C0b26F421741e481";

      const data = encodeFunctionData({
        abi: swapRouterAbi,
        functionName: "exactInputSingle",
        args: [{
          tokenIn: token_in as `0x${string}`,
          tokenOut: token_out as `0x${string}`,
          fee,
          recipient: walletAddress,
          amountIn: amountInWei,
          amountOutMinimum: minOutWei,
          sqrtPriceLimitX96: 0n,
        }],
      });

      return {
        content: [{
          type: "text" as const,
          text: [
            `✅ Swap calldata encoded`,
            ``,
            `Router: ${router}`,
            `Swap: ${amount_in} (tokenIn) → min ${min_amount_out} (tokenOut)`,
            `Fee tier: ${fee} (${fee / 10000}%)`,
            ``,
            `Use with signer.sign_and_send:`,
            `  to: "${router}"`,
            `  data: "${data}"`,
            `  value_eth: "0"`,
            `  value_usd: <amount_in_usd>`,
            `  operation: "swap"`,
          ].join("\n"),
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// --- Aave V3 ABI ---
const aaveV3Abi = [
  { name: "supply",   type: "function", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }, { name: "onBehalfOf", type: "address" }, { name: "referralCode", type: "uint16" }], outputs: [] },
  { name: "withdraw", type: "function", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }, { name: "to", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "borrow",   type: "function", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }, { name: "interestRateMode", type: "uint256" }, { name: "referralCode", type: "uint16" }, { name: "onBehalfOf", type: "address" }], outputs: [] },
  { name: "repay",    type: "function", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }, { name: "interestRateMode", type: "uint256" }, { name: "onBehalfOf", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

// Tool: encode_aave
server.tool(
  "encode_aave",
  "Encode an Aave V3 Pool call (supply, withdraw, borrow, repay). Returns calldata hex to pass to signer.sign_and_send. Aave V3 Pool on Base: 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
  {
    action: z.enum(["supply", "withdraw", "borrow", "repay"]).describe("Aave action"),
    asset: z.string().describe("Token address (e.g. USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)"),
    amount: z.string().describe("Human-readable amount (e.g. '10.0')"),
    decimals: z.number().describe("Token decimals (6 for USDC, 18 for WETH)"),
    interest_rate_mode: z.number().optional().default(2).describe("For borrow/repay: 1=stable, 2=variable. Default 2."),
  },
  async ({ action, asset, amount, decimals, interest_rate_mode }) => {
    try {
      const pool = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5" as `0x${string}`;
      const amountWei = parseUnits(amount, decimals);
      const wallet = walletAddress;
      let data: `0x${string}`;

      if (action === "supply") {
        data = encodeFunctionData({ abi: aaveV3Abi, functionName: "supply", args: [asset as `0x${string}`, amountWei, wallet, 0] });
      } else if (action === "withdraw") {
        data = encodeFunctionData({ abi: aaveV3Abi, functionName: "withdraw", args: [asset as `0x${string}`, amountWei, wallet] });
      } else if (action === "borrow") {
        data = encodeFunctionData({ abi: aaveV3Abi, functionName: "borrow", args: [asset as `0x${string}`, amountWei, BigInt(interest_rate_mode), 0, wallet] });
      } else {
        data = encodeFunctionData({ abi: aaveV3Abi, functionName: "repay", args: [asset as `0x${string}`, amountWei, BigInt(interest_rate_mode), wallet] });
      }

      return {
        content: [{
          type: "text" as const,
          text: [
            `✅ Aave V3 ${action} calldata encoded`,
            ``,
            `Pool: ${pool}`,
            `Asset: ${asset}`,
            `Amount: ${amount} (${amountWei} wei)`,
            ``,
            `Use with signer.sign_and_send:`,
            `  to: "${pool}"`,
            `  data: "${data}"`,
            `  value_eth: "0"`,
            `  operation: "${action}"`,
          ].join("\n"),
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// --- Aerodrome Router ABI (addLiquidity / removeLiquidity / swapExactTokensForTokens) ---
const aerodromeRouterAbi = [
  { name: "addLiquidity", type: "function", inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }, { name: "stable", type: "bool" }, { name: "amountADesired", type: "uint256" }, { name: "amountBDesired", type: "uint256" }, { name: "amountAMin", type: "uint256" }, { name: "amountBMin", type: "uint256" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
  { name: "removeLiquidity", type: "function", inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }, { name: "stable", type: "bool" }, { name: "liquidity", type: "uint256" }, { name: "amountAMin", type: "uint256" }, { name: "amountBMin", type: "uint256" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint256" }] },
] as const;

// Tool: encode_aerodrome
server.tool(
  "encode_aerodrome",
  "Encode an Aerodrome router call (addLiquidity, removeLiquidity). Returns calldata hex to pass to signer.sign_and_send. Aerodrome Router on Base: 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
  {
    action: z.enum(["addLiquidity", "removeLiquidity"]).describe("Aerodrome action"),
    token_a: z.string().describe("Token A address"),
    token_b: z.string().describe("Token B address"),
    stable: z.boolean().default(false).describe("True for stable pool (correlated assets), false for volatile"),
    amount_a: z.string().describe("Amount of token A (human readable)"),
    amount_b: z.string().describe("Amount of token B (human readable) — for addLiquidity"),
    decimals_a: z.number().describe("Token A decimals"),
    decimals_b: z.number().describe("Token B decimals"),
    liquidity: z.string().optional().describe("LP token amount for removeLiquidity (human readable, 18 decimals)"),
    slippage_pct: z.number().default(0.5).describe("Slippage tolerance in percent (default 0.5%)"),
  },
  async ({ action, token_a, token_b, stable, amount_a, amount_b, decimals_a, decimals_b, liquidity, slippage_pct }) => {
    try {
      const router = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43" as `0x${string}`;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 min
      const slippage = 1 - slippage_pct / 100;
      let data: `0x${string}`;

      if (action === "addLiquidity") {
        const amtA = parseUnits(amount_a, decimals_a);
        const amtB = parseUnits(amount_b, decimals_b);
        const minA = BigInt(Math.floor(Number(amtA) * slippage));
        const minB = BigInt(Math.floor(Number(amtB) * slippage));
        data = encodeFunctionData({ abi: aerodromeRouterAbi, functionName: "addLiquidity", args: [token_a as `0x${string}`, token_b as `0x${string}`, stable, amtA, amtB, minA, minB, walletAddress, deadline] });
      } else {
        const liq = parseUnits(liquidity || "0", 18);
        data = encodeFunctionData({ abi: aerodromeRouterAbi, functionName: "removeLiquidity", args: [token_a as `0x${string}`, token_b as `0x${string}`, stable, liq, 0n, 0n, walletAddress, deadline] });
      }

      return { content: [{ type: "text" as const, text: `✅ Aerodrome ${action} encoded\n\nRouter: ${router}\nPool: ${stable ? "Stable" : "Volatile"}\n\nUse with signer.sign_and_send:\n  to: "${router}"\n  data: "${data}"\n  value_eth: "0"\n  operation: "${action}"` }] };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// --- gTrade (Gains Network) Diamond ABI ---
// Diamond on Base: 0x6cD5aC19a07518A8092eEFfDA4f1174C72704eeb
// Collateral: USDC (index 1) on Base
// All calls go through the Diamond proxy — facets handle routing internally.

const gTradeDiamond = "0x6cD5aC19a07518A8092eEFfDA4f1174C72704eeb" as `0x${string}`;

// Trade struct (ITradingStorage.Trade) — matches gTrade v9.2+ on Base
// openPrice, tp, sl use 1e10 precision. collateralAmount uses token decimals (1e6 for USDC).
// leverage is stored as value * 1e3 (e.g., 5x → 5000).
const gTradeOpenTradeAbi = [
  {
    name: "openTrade",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "_trade",
        type: "tuple",
        components: [
          { name: "user", type: "address" },
          { name: "index", type: "uint32" },
          { name: "pairIndex", type: "uint16" },
          { name: "leverage", type: "uint24" },
          { name: "long", type: "bool" },
          { name: "isOpen", type: "bool" },
          { name: "collateralIndex", type: "uint8" },
          { name: "tradeType", type: "uint8" },
          { name: "collateralAmount", type: "uint120" },
          { name: "openPrice", type: "uint64" },
          { name: "tp", type: "uint64" },
          { name: "sl", type: "uint64" },
          { name: "isCounterTrade", type: "bool" },
          { name: "positionSizeToken", type: "uint160" },
          { name: "__placeholder", type: "uint24" },
        ],
      },
      { name: "_maxSlippageP", type: "uint16" },
      { name: "_referrer", type: "address" },
    ],
    outputs: [],
  },
] as const;

const gTradeCloseAbi = [
  {
    name: "closeTradeMarket",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_index", type: "uint32" },
      { name: "_expectedPrice", type: "uint64" },
    ],
    outputs: [],
  },
] as const;

const gTradeUpdateSlAbi = [
  {
    name: "updateSl",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_index", type: "uint32" },
      { name: "_newSl", type: "uint64" },
    ],
    outputs: [],
  },
] as const;

const gTradeUpdateTpAbi = [
  {
    name: "updateTp",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_index", type: "uint32" },
      { name: "_newTp", type: "uint64" },
    ],
    outputs: [],
  },
] as const;

// gTrade pair indexes — key pairs for quick reference
// Full list: https://backend-base.gains.trade/trading-variables
const GTRADE_PAIRS: Record<string, { index: number; group: string }> = {
  // Crypto
  "BTC/USD":   { index: 0, group: "crypto" },
  "ETH/USD":   { index: 1, group: "crypto" },
  "LINK/USD":  { index: 2, group: "crypto" },
  "DOGE/USD":  { index: 3, group: "crypto" },
  "SOL/USD":   { index: 33, group: "crypto" },
  // Forex
  "EUR/USD":   { index: 21, group: "forex" },
  "GBP/USD":   { index: 23, group: "forex" },
  "USD/JPY":   { index: 24, group: "forex" },
  "USD/CHF":   { index: 25, group: "forex" },
  "AUD/USD":   { index: 26, group: "forex" },
  "NZD/USD":   { index: 27, group: "forex" },
  "USD/CAD":   { index: 28, group: "forex" },
  "EUR/GBP":   { index: 29, group: "forex" },
  "EUR/JPY":   { index: 30, group: "forex" },
  // Commodities
  "XAU/USD":   { index: 90, group: "commodities" },
  "XAG/USD":   { index: 91, group: "commodities" },
  // Stocks (major)
  "AAPL/USD":  { index: 58, group: "stocks" },
  "TSLA/USD":  { index: 63, group: "stocks" },
  "GOOGL/USD": { index: 60, group: "stocks" },
  "NVDA/USD":  { index: 65, group: "stocks" },
  "AMZN/USD":  { index: 59, group: "stocks" },
  "META/USD":  { index: 64, group: "stocks" },
  "MSFT/USD":  { index: 61, group: "stocks" },
  // Indices
  "SPX500":    { index: 57, group: "indices" },
};

// Helper: convert price to gTrade 1e10 format
function priceToGtrade(price: number): bigint {
  return BigInt(Math.round(price * 1e10));
}

// Tool: encode_gtrade_open
server.tool(
  "encode_gtrade_open",
  `Encode a gTrade perpetual trade (open position). Supports crypto, forex, commodities, stocks.
gTrade Diamond on Base: ${gTradeDiamond}. Collateral: USDC (approve first).
Available pairs: ${Object.keys(GTRADE_PAIRS).join(", ")}. For other pairs, use pair_index directly.
Prices use 1e10 precision internally. Pass human-readable prices — encoding is automatic.`,
  {
    pair: z.string().optional().describe("Pair name like 'EUR/USD', 'BTC/USD', 'XAU/USD', 'TSLA/USD'. Use this OR pair_index."),
    pair_index: z.number().optional().describe("Direct pair index (0=BTC, 1=ETH, 21=EUR/USD, etc). Use if pair name not in the list."),
    long: z.boolean().describe("true = long (bet price goes up), false = short (bet price goes down)"),
    collateral_usdc: z.string().describe("USDC collateral amount (e.g., '5.0'). This is how much you risk."),
    leverage: z.number().min(2).max(1000).describe("Leverage multiplier (e.g., 5 for 5x). Forex allows up to 1000x, crypto up to 150x."),
    open_price: z.number().describe("Expected entry price (human readable, e.g., 1.0850 for EUR/USD, 75000 for BTC)"),
    take_profit: z.number().optional().describe("Take profit price (0 or omit = no TP)"),
    stop_loss: z.number().optional().describe("Stop loss price (0 or omit = no SL). STRONGLY recommended."),
    trade_type: z.number().default(0).describe("0 = MARKET (execute now), 1 = LIMIT (execute at open_price), 2 = STOP"),
    max_slippage_pct: z.number().default(1.0).describe("Max slippage in percent (e.g., 1.0 = 1%). Default 1%."),
  },
  async ({ pair, pair_index, long, collateral_usdc, leverage, open_price, take_profit, stop_loss, trade_type, max_slippage_pct }) => {
    try {
      // Resolve pair index
      let resolvedPairIndex: number;
      let pairName: string;

      if (pair && GTRADE_PAIRS[pair.toUpperCase()]) {
        resolvedPairIndex = GTRADE_PAIRS[pair.toUpperCase()].index;
        pairName = pair.toUpperCase();
      } else if (pair_index !== undefined) {
        resolvedPairIndex = pair_index;
        pairName = Object.entries(GTRADE_PAIRS).find(([_, v]) => v.index === pair_index)?.[0] || `Pair #${pair_index}`;
      } else {
        return { content: [{ type: "text" as const, text: `Error: Provide either 'pair' (e.g., 'EUR/USD') or 'pair_index' (e.g., 21)` }], isError: true };
      }

      const collateralWei = parseUnits(collateral_usdc, 6); // USDC has 6 decimals
      const leverageScaled = leverage * 1000; // gTrade stores leverage * 1e3
      const openPriceScaled = priceToGtrade(open_price);
      const tpScaled = take_profit ? priceToGtrade(take_profit) : 0n;
      const slScaled = stop_loss ? priceToGtrade(stop_loss) : 0n;
      const maxSlippageBps = Math.round(max_slippage_pct * 100); // 1% = 100 bps (gTrade uses 1e2 percent precision: 1% = 100)

      // Position size = collateral * leverage (in USDC terms for display)
      const positionSize = parseFloat(collateral_usdc) * leverage;

      const tradeStruct = {
        user: walletAddress,
        index: 0, // auto-assigned by contract
        pairIndex: resolvedPairIndex,
        leverage: leverageScaled,
        long,
        isOpen: true,
        collateralIndex: 1, // USDC on Base
        tradeType: trade_type,
        collateralAmount: collateralWei,
        openPrice: openPriceScaled,
        tp: tpScaled,
        sl: slScaled,
        isCounterTrade: false,
        positionSizeToken: 0n, // auto-calculated by contract
        __placeholder: 0,
      };

      const data = encodeFunctionData({
        abi: gTradeOpenTradeAbi,
        functionName: "openTrade",
        args: [
          tradeStruct,
          maxSlippageBps,
          "0x0000000000000000000000000000000000000000" as `0x${string}`, // no referrer
        ],
      });

      const group = GTRADE_PAIRS[pairName]?.group || "unknown";

      return {
        content: [{
          type: "text" as const,
          text: [
            `✅ gTrade openTrade calldata encoded`,
            ``,
            `📊 ${pairName} ${long ? "LONG 📈" : "SHORT 📉"} (${group})`,
            `  Collateral: ${collateral_usdc} USDC`,
            `  Leverage: ${leverage}x`,
            `  Position size: ~$${positionSize.toFixed(2)}`,
            `  Entry price: ${open_price}`,
            `  Take profit: ${take_profit || "none"}`,
            `  Stop loss: ${stop_loss || "none"}`,
            `  Type: ${["MARKET", "LIMIT", "STOP"][trade_type]}`,
            `  Max slippage: ${max_slippage_pct}%`,
            ``,
            `⚠️ IMPORTANT: Approve USDC to gTrade Diamond first if not done:`,
            `  Use encode_approve with spender: "${gTradeDiamond}"`,
            ``,
            `Use with signer.sign_and_send:`,
            `  to: "${gTradeDiamond}"`,
            `  data: "${data}"`,
            `  value_eth: "0"`,
            `  value_usd: ${parseFloat(collateral_usdc)}`,
            `  operation: "open_trade"`,
          ].join("\n"),
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error encoding gTrade open: ${error.message}` }], isError: true };
    }
  }
);

// Tool: encode_gtrade_close
server.tool(
  "encode_gtrade_close",
  `Encode a gTrade close trade at market. Closes an existing perpetual position.
gTrade Diamond on Base: ${gTradeDiamond}.`,
  {
    trade_index: z.number().describe("Index of the trade to close (from get_gtrade_trades or open trade response)"),
    expected_price: z.number().describe("Expected closing price (human readable). Used for slippage protection."),
  },
  async ({ trade_index, expected_price }) => {
    try {
      const data = encodeFunctionData({
        abi: gTradeCloseAbi,
        functionName: "closeTradeMarket",
        args: [trade_index, priceToGtrade(expected_price)],
      });

      return {
        content: [{
          type: "text" as const,
          text: [
            `✅ gTrade closeTradeMarket calldata encoded`,
            ``,
            `  Trade index: ${trade_index}`,
            `  Expected price: ${expected_price}`,
            ``,
            `Use with signer.sign_and_send:`,
            `  to: "${gTradeDiamond}"`,
            `  data: "${data}"`,
            `  value_eth: "0"`,
            `  value_usd: 0`,
            `  operation: "close_trade"`,
          ].join("\n"),
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error encoding gTrade close: ${error.message}` }], isError: true };
    }
  }
);

// Tool: encode_gtrade_update_sl
server.tool(
  "encode_gtrade_update_sl",
  `Update stop loss on an existing gTrade perpetual position.
gTrade Diamond on Base: ${gTradeDiamond}.`,
  {
    trade_index: z.number().describe("Index of the trade to update"),
    new_sl: z.number().describe("New stop loss price (human readable). Set to 0 to remove SL."),
  },
  async ({ trade_index, new_sl }) => {
    try {
      const data = encodeFunctionData({
        abi: gTradeUpdateSlAbi,
        functionName: "updateSl",
        args: [trade_index, priceToGtrade(new_sl)],
      });

      return {
        content: [{
          type: "text" as const,
          text: [
            `✅ gTrade updateSl calldata encoded`,
            ``,
            `  Trade index: ${trade_index}`,
            `  New stop loss: ${new_sl === 0 ? "REMOVED" : new_sl}`,
            ``,
            `Use with signer.sign_and_send:`,
            `  to: "${gTradeDiamond}"`,
            `  data: "${data}"`,
            `  value_eth: "0"`,
            `  value_usd: 0`,
            `  operation: "update_sl"`,
          ].join("\n"),
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Tool: encode_gtrade_update_tp
server.tool(
  "encode_gtrade_update_tp",
  `Update take profit on an existing gTrade perpetual position.
gTrade Diamond on Base: ${gTradeDiamond}.`,
  {
    trade_index: z.number().describe("Index of the trade to update"),
    new_tp: z.number().describe("New take profit price (human readable). Set to 0 to remove TP."),
  },
  async ({ trade_index, new_tp }) => {
    try {
      const data = encodeFunctionData({
        abi: gTradeUpdateTpAbi,
        functionName: "updateTp",
        args: [trade_index, priceToGtrade(new_tp)],
      });

      return {
        content: [{
          type: "text" as const,
          text: [
            `✅ gTrade updateTp calldata encoded`,
            ``,
            `  Trade index: ${trade_index}`,
            `  New take profit: ${new_tp === 0 ? "REMOVED" : new_tp}`,
            ``,
            `Use with signer.sign_and_send:`,
            `  to: "${gTradeDiamond}"`,
            `  data: "${data}"`,
            `  value_eth: "0"`,
            `  value_usd: 0`,
            `  operation: "update_tp"`,
          ].join("\n"),
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Tool: get_gtrade_trades
server.tool(
  "get_gtrade_trades",
  "Fetch open trades for our wallet from gTrade backend API on Base. Read-only.",
  {},
  async () => {
    try {
      const url = `https://backend-base.gains.trade/open-trades/${walletAddress}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        return { content: [{ type: "text" as const, text: `Error fetching trades: HTTP ${resp.status}` }], isError: true };
      }
      const trades = await resp.json();

      if (!Array.isArray(trades) || trades.length === 0) {
        return { content: [{ type: "text" as const, text: `No open gTrade positions for ${walletAddress}` }] };
      }

      // Build human-readable summary
      const pairLookup = Object.fromEntries(Object.entries(GTRADE_PAIRS).map(([name, v]) => [v.index, name]));
      const lines = trades.map((t: any, i: number) => {
        // API returns nested: { trade: { ... }, tradeInfo: { ... } }
        const tr = t.trade || t;
        const pairName = pairLookup[tr.pairIndex] || `Pair #${tr.pairIndex}`;
        const direction = tr.long ? "LONG 📈" : "SHORT 📉";
        const collateral = tr.collateralAmount ? (Number(tr.collateralAmount) / 1e6).toFixed(2) : "?";
        const leverage = tr.leverage ? (Number(tr.leverage) / 1000).toFixed(0) : "?";
        const openPrice = tr.openPrice ? (Number(tr.openPrice) / 1e10).toFixed(6) : "?";
        const tp = tr.tp && Number(tr.tp) > 0 ? (Number(tr.tp) / 1e10).toFixed(6) : "none";
        const sl = tr.sl && Number(tr.sl) > 0 ? (Number(tr.sl) / 1e10).toFixed(6) : "none";
        return `[${tr.index}] ${pairName} ${direction} | ${collateral} USDC × ${leverage}x | Entry: ${openPrice} | TP: ${tp} | SL: ${sl}`;
      });

      return {
        content: [{
          type: "text" as const,
          text: [
            `📊 Open gTrade Positions (${trades.length})`,
            `Wallet: ${walletAddress}`,
            ``,
            ...lines,
            ``,
            `Raw data available for detailed analysis.`,
          ].join("\n"),
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error fetching gTrade trades: ${error.message}` }], isError: true };
    }
  }
);

// Tool: get_gtrade_pairs
server.tool(
  "get_gtrade_pairs",
  "List available gTrade trading pairs with their indexes, grouped by category. Use to find pair_index for encode_gtrade_open.",
  {
    group: z.string().optional().describe("Filter by group: 'crypto', 'forex', 'commodities', 'stocks', 'indices'. Leave empty for all."),
  },
  async ({ group }) => {
    const entries = Object.entries(GTRADE_PAIRS)
      .filter(([_, v]) => !group || v.group === group.toLowerCase())
      .sort((a, b) => a[1].index - b[1].index);

    const lines = entries.map(([name, v]) => `  ${v.index.toString().padStart(3)} | ${name.padEnd(10)} | ${v.group}`);

    return {
      content: [{
        type: "text" as const,
        text: [
          `📋 gTrade Pairs${group ? ` (${group})` : ""} — ${entries.length} pairs`,
          ``,
          `Index | Pair       | Group`,
          `------+------------+--------`,
          ...lines,
          ``,
          `For the full 450+ pair list: https://backend-base.gains.trade/trading-variables`,
          `Use pair_index with encode_gtrade_open to open positions.`,
        ].join("\n"),
      }],
    };
  }
);

// --- Compound V3 Comet ABI ---
const compoundCometAbi = [
  { name: "supply",   type: "function", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "withdraw", type: "function", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "borrowBalanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

// Tool: encode_compound
server.tool(
  "encode_compound",
  "Encode a Compound V3 Comet call (supply, withdraw). Returns calldata hex to pass to signer.sign_and_send. Compound V3 USDC on Base: 0xb125E6687d4313864e53df431d5425969c15Eb2F",
  {
    action: z.enum(["supply", "withdraw"]).describe("Compound action"),
    asset: z.string().describe("Token address to supply/withdraw"),
    amount: z.string().describe("Human-readable amount"),
    decimals: z.number().describe("Token decimals"),
  },
  async ({ action, asset, amount, decimals }) => {
    try {
      const comet = "0xb125E6687d4313864e53df431d5425969c15Eb2F" as `0x${string}`;
      const amountWei = parseUnits(amount, decimals);
      const data = encodeFunctionData({ abi: compoundCometAbi, functionName: action, args: [asset as `0x${string}`, amountWei] });

      return { content: [{ type: "text" as const, text: `✅ Compound V3 ${action} encoded\n\nComet: ${comet}\nAsset: ${asset}\nAmount: ${amount}\n\nUse with signer.sign_and_send:\n  to: "${comet}"\n  data: "${data}"\n  value_eth: "0"\n  operation: "${action}"` }] };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// --- Start ---
const transport = new StdioServerTransport();
await server.connect(transport);
