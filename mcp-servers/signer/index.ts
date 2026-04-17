import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { readFileSync, appendFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

// --- Config ---
const configDir = resolve(import.meta.dir, "../../config");
const walletConfig = JSON.parse(readFileSync(resolve(configDir, "wallet.json"), "utf-8"));

// Hot-reload policy.json on every check so runtime edits take effect immediately
function loadPolicy() {
  return JSON.parse(readFileSync(resolve(configDir, "policy.json"), "utf-8"));
}
let policyConfig = loadPolicy();

const auditLogDir = resolve(import.meta.dir, "../../data/audit-log");
if (!existsSync(auditLogDir)) mkdirSync(auditLogDir, { recursive: true });

// --- Decrypt private key ---
function decryptPrivateKey(): `0x${string}` {
  const keystorePath = resolve(configDir, walletConfig.wallet.keystore_path);

  const password = process.env.SIGNER_PASSWORD;
  if (!password) {
    throw new Error(
      "SIGNER_PASSWORD environment variable not set. " +
        "Start the signer with: SIGNER_PASSWORD=<password> bun run index.ts"
    );
  }

  try {
    const result = execSync(
      `openssl enc -aes-256-cbc -pbkdf2 -d -in "${keystorePath}" -pass env:SIGNER_PASSWORD`,
      { encoding: "utf-8", timeout: 5000 }
    ).trim();

    return `0x${result}` as `0x${string}`;
  } catch (e: any) {
    throw new Error(`Failed to decrypt keystore: ${e.message}`);
  }
}

// --- Audit logging ---
function auditLog(entry: Record<string, any>) {
  const date = new Date().toISOString().split("T")[0];
  const logFile = resolve(auditLogDir, `${date}.jsonl`);
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
  appendFileSync(logFile, line + "\n");
}

// --- Daily spending tracker ---
// Operations that count as "spending" (acquiring new assets)
const SPENDING_OPERATIONS = ["swap", "supply", "transfer", "approve", "place_order"];
// Operations that recover existing capital (should NOT count toward daily limit)
const NON_SPENDING_OPERATIONS = ["withdraw"];

let dailySpendUsd = 0;
let lastResetDate = new Date().toISOString().split("T")[0];

function isSpendingOperation(operation: string): boolean {
  return !NON_SPENDING_OPERATIONS.includes(operation.toLowerCase());
}

function checkAndResetDaily() {
  const today = new Date().toISOString().split("T")[0];
  if (today !== lastResetDate) {
    dailySpendUsd = 0;
    lastResetDate = today;
  }
}

// --- Policy check ---
interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

function checkPolicy(params: { to: string; value_usd: number; operation: string }): PolicyResult {
  // Hot-reload policy so runtime edits take effect without restart
  policyConfig = loadPolicy();
  checkAndResetDaily();

  // Withdrawals (recovering own capital) skip spending limits
  if (isSpendingOperation(params.operation)) {
    if (params.value_usd > policyConfig.spending_limits.per_transaction_usd) {
      return {
        allowed: false,
        reason: `Transaction value $${params.value_usd} exceeds per-tx limit of $${policyConfig.spending_limits.per_transaction_usd}. Requires owner approval.`,
      };
    }

    if (dailySpendUsd + params.value_usd > policyConfig.spending_limits.daily_usd) {
      return {
        allowed: false,
        reason: `Would exceed daily limit. Spent today: $${dailySpendUsd}, this tx: $${params.value_usd}, limit: $${policyConfig.spending_limits.daily_usd}. Requires owner approval.`,
      };
    }
  }

  const isAllowedProtocol = policyConfig.allowed_protocols.some(
    (p: any) => p.address != null && p.address.toLowerCase() === params.to.toLowerCase()
  );
  const isOwnWallet = params.to.toLowerCase() === walletConfig.wallet.address.toLowerCase();

  if (!isAllowedProtocol && !isOwnWallet) {
    return {
      allowed: false,
      reason: `Target address ${params.to} is not in the allowed protocols list. Requires owner approval.`,
    };
  }

  if (policyConfig.blocked_operations.includes(params.operation)) {
    return { allowed: false, reason: `Operation "${params.operation}" is blocked by policy.` };
  }

  return { allowed: true };
}

// --- Initialize account (lazy — don't crash at startup) ---
let account: ReturnType<typeof privateKeyToAccount> | null = null;
let walletClient: ReturnType<typeof createWalletClient> | null = null;
let publicClient: ReturnType<typeof createPublicClient> | null = null;
let initError: string | null = null;

function ensureInitialized(): void {
  if (account) return; // already initialized
  try {
    const privateKey = decryptPrivateKey();
    account = privateKeyToAccount(privateKey);
    publicClient = createPublicClient({ chain: base, transport: http(walletConfig.network.rpc_url) });
    walletClient = createWalletClient({ account, chain: base, transport: http(walletConfig.network.rpc_url) });
    auditLog({ agent: "signer", action: "startup", wallet: account.address, status: "ok" });
    initError = null;
  } catch (e: any) {
    initError = e.message;
    throw new Error(`Signer not ready: ${e.message}`);
  }
}

// Try to initialize at startup, but don't crash if it fails
try { ensureInitialized(); } catch (_) {}

// --- MCP Server ---
const server = new McpServer({ name: "signer-mcp", version: "1.0.0" });

server.tool(
  "check_policy",
  "Check if a transaction would be allowed by the spending policy (dry-run, does not execute)",
  {
    to: z.string().describe("Target address"),
    value_usd: z.number().describe("Estimated value of the transaction in USD"),
    operation: z.string().describe("Type of operation: swap, supply, withdraw, transfer, approve"),
  },
  async ({ to, value_usd, operation }) => {
    const result = checkPolicy({ to, value_usd, operation });
    auditLog({ agent: "signer", action: "policy_check", to, value_usd, operation, result: result.allowed ? "allowed" : "blocked", reason: result.reason });

    return {
      content: [
        {
          type: "text" as const,
          text: result.allowed
            ? `✅ Policy check PASSED. Transaction is within limits.\n  To: ${to}\n  Value: $${value_usd}\n  Operation: ${operation}\n  Daily spent: $${dailySpendUsd}/$${policyConfig.spending_limits.daily_usd}`
            : `❌ Policy check FAILED.\n  ${result.reason}\n  Daily spent: $${dailySpendUsd}/$${policyConfig.spending_limits.daily_usd}`,
        },
      ],
    };
  }
);

server.tool(
  "sign_and_send",
  "Sign and send a transaction on Base. Validates against policy first.",
  {
    to: z.string().describe("Target contract or wallet address"),
    value_eth: z.string().default("0").describe("ETH value to send (e.g. '0.01')"),
    value_usd: z.number().describe("Estimated USD value (for policy check)"),
    operation: z.string().describe("Operation type: swap, supply, transfer, approve"),
    data: z.string().optional().describe("Hex-encoded calldata for contract interaction"),
    description: z.string().describe("Human-readable description of the transaction"),
  },
  async ({ to, value_eth, value_usd, operation, data, description }) => {
    try { ensureInitialized(); } catch (e: any) {
      return { content: [{ type: "text" as const, text: `❌ Signer not ready: ${e.message}` }], isError: true };
    }
    const policy = checkPolicy({ to, value_usd, operation });
    if (!policy.allowed) {
      auditLog({ agent: "signer", action: "tx_blocked", to, value_usd, operation, description, reason: policy.reason });
      return {
        content: [{ type: "text" as const, text: `❌ Transaction BLOCKED by policy.\n${policy.reason}\n\nDescription: ${description}` }],
      };
    }

    auditLog({ agent: "signer", action: "tx_signing", to, value_eth, value_usd, operation, description, status: "pending" });

    try {
      const txParams: any = { to: to as `0x${string}`, value: parseEther(value_eth) };
      if (data) txParams.data = data as `0x${string}`;

      const hash = await walletClient.sendTransaction(txParams);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });

      // Only count spending operations toward the daily limit
      if (isSpendingOperation(operation)) {
        dailySpendUsd += value_usd;
      }

      auditLog({
        agent: "signer", action: "tx_confirmed", hash, to, value_eth, value_usd,
        operation, description, block: Number(receipt.blockNumber),
        gas_used: Number(receipt.gasUsed), status: receipt.status === "success" ? "success" : "reverted",
        counted_as_spend: isSpendingOperation(operation),
      });

      const explorerUrl = `${walletConfig.network.explorer}/tx/${hash}`;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              receipt.status === "success" ? `✅ Transaction CONFIRMED` : `⚠️ Transaction REVERTED`,
              ``,
              `  Description: ${description}`,
              `  Hash: ${hash}`,
              `  Block: ${receipt.blockNumber}`,
              `  Gas used: ${receipt.gasUsed}`,
              `  Value: ${value_eth} ETH (~$${value_usd})`,
              `  Explorer: ${explorerUrl}`,
              ``,
              `  Daily spend: $${dailySpendUsd}/$${policyConfig.spending_limits.daily_usd}`,
            ].join("\n"),
          },
        ],
      };
    } catch (error: any) {
      auditLog({ agent: "signer", action: "tx_failed", to, value_eth, value_usd, operation, description, error: error.message });
      return {
        content: [{ type: "text" as const, text: `❌ Transaction FAILED\n  Error: ${error.message}\n  Description: ${description}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_audit_log",
  "Get the audit log for today or a specific date",
  {
    date: z.string().optional().describe("Date in YYYY-MM-DD format. Defaults to today."),
  },
  async ({ date }) => {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const logFile = resolve(auditLogDir, `${targetDate}.jsonl`);

    try {
      if (!existsSync(logFile)) {
        return { content: [{ type: "text" as const, text: `No audit log found for ${targetDate}.` }] };
      }

      const content = readFileSync(logFile, "utf-8");
      const lines = content.trim().split("\n");
      const entries = lines.map((l) => JSON.parse(l));

      const summary = entries
        .map((e: any) => `[${e.timestamp}] ${e.action}: ${e.description || e.status || ""} ${e.hash ? `(${e.hash.slice(0, 10)}...)` : ""}`)
        .join("\n");

      return { content: [{ type: "text" as const, text: `Audit log for ${targetDate} (${entries.length} entries):\n\n${summary}` }] };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error reading audit log: ${error.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
