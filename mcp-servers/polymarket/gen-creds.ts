#!/usr/bin/env bun
/**
 * gen-polymarket-creds.ts
 *
 * Generates Polymarket API credentials (key, secret, passphrase)
 * using the encrypted wallet keystore — does not require the private key in plaintext.
 *
 * Uso:
 *   read -s "SIGNER_PASSWORD?🔑 Signer password: " && export SIGNER_PASSWORD
 *   bun run scripts/gen-polymarket-creds.ts
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

// Compatible with both Bun (import.meta.dir) and Node (fileURLToPath)
const __dirname = typeof (import.meta as any).dir !== "undefined"
  ? (import.meta as any).dir
  : dirname(fileURLToPath(import.meta.url));

const REPO_DIR = resolve(__dirname, "../..");
const configDir = resolve(REPO_DIR, "config");
const walletConfig = JSON.parse(readFileSync(resolve(configDir, "wallet.json"), "utf-8"));

// --- Decrypt private key from keystore ---
function decryptPrivateKey(): `0x${string}` {
  const keystorePath = resolve(configDir, walletConfig.wallet.keystore_path);
  const password = process.env.SIGNER_PASSWORD;

  if (!password) {
    console.error("❌ SIGNER_PASSWORD is not set.");
    console.error("   Run: read -s \"SIGNER_PASSWORD?🔑 Signer password: \" && export SIGNER_PASSWORD");
    process.exit(1);
  }

  try {
    const result = execSync(
      `openssl enc -aes-256-cbc -pbkdf2 -d -in "${keystorePath}" -pass env:SIGNER_PASSWORD`,
      { encoding: "utf-8", timeout: 5000, env: { ...process.env, SIGNER_PASSWORD: password } }
    ).trim();
    return `0x${result}` as `0x${string}`;
  } catch {
    console.error("❌ Could not decrypt keystore. Wrong password?");
    process.exit(1);
  }
}

// --- Main ---
console.log("\n🔑 Generating Polymarket credentials...\n");

const privateKey = decryptPrivateKey();

// Dynamic imports to avoid Bun ESM resolution issues with @noble/hashes
const { ClobClient } = await import("@polymarket/clob-client");
const { createWalletClient, http } = await import("viem");
const { polygon } = await import("viem/chains");
const { privateKeyToAccount } = await import("viem/accounts");

const account = privateKeyToAccount(privateKey);
console.log(`   Wallet: ${account.address}`);

const walletClient = createWalletClient({ account, chain: polygon, transport: http() });
const client = new ClobClient("https://clob.polymarket.com", 137, walletClient);

try {
  // nonce=0 → deterministic derivation (same creds every time)
  const creds = await client.createApiKey(0);

  console.log("\n✅ Credentials generated. Add this to ~/.zshrc:\n");
  console.log(`export POLYMARKET_API_KEY="${creds.key}"`);
  console.log(`export POLYMARKET_API_SECRET="${creds.secret}"`);
  console.log(`export POLYMARKET_PASSPHRASE="${creds.passphrase}"`);
  console.log("\nThen run: source ~/.zshrc\n");
} catch (e: any) {
  console.error(`\n❌ Error generando credentials: ${e.message}`);
  console.error("   Possible cause: Polymarket geo-block. Make sure WARP is active.");
  process.exit(1);
}
