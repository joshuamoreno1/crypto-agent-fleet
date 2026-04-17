#!/usr/bin/env zsh
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "🚀 Starting Crypto Agent Fleet..."
echo ""

# Ask for signer password
read -s "SIGNER_PASSWORD?🔑 Signer password: "
echo ""
export SIGNER_PASSWORD
export TELEGRAM_BOT_TOKEN="<YOUR_TELEGRAM_BOT_TOKEN>"
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

# Kill previous bot instances (avoids 409 Conflict — zombie shows typing but can't respond)
pkill -9 -f "plugin:telegram@claude-plugins-official" 2>/dev/null || true
pkill -9 -f "external_plugins/telegram" 2>/dev/null || true
sleep 3

# Load nvm and use Node 22 (claude 2.1.86+ requires this version)
source "$NVM_DIR/nvm.sh" && nvm use 22 --silent

echo "📡 Starting Claude Code with Agent Team..."
echo ""

INIT_PROMPT=$(cat "$REPO_DIR/scripts/init-prompt.txt")

claude --model claude-opus-4-6 --channels plugin:telegram@claude-plugins-official -- "$INIT_PROMPT"
