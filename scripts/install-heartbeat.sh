#!/usr/bin/env zsh
# Install the Crypto Agent Fleet heartbeat as a macOS launchd job.
#
# Prereqs:
#   1. Edit scripts/heartbeat.sh with your TELEGRAM_BOT_TOKEN and chat_id.
#   2. Copy scripts/heartbeat.plist to ~/Library/LaunchAgents/com.crypto-agent-fleet.heartbeat.plist
#      and edit it (see the comment at the top of the plist).
#   3. Run this script.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.crypto-agent-fleet.heartbeat.plist"
TARGET="/usr/local/bin/crypto-agent-fleet-heartbeat"

if [[ ! -f "$PLIST" ]]; then
  echo "❌ $PLIST not found."
  echo "   Copy scripts/heartbeat.plist there and edit the placeholders first."
  exit 1
fi

# Copy the script to a system path. A symlink doesn't work because macOS TCC
# treats ~/Documents as protected for launchd.
echo "📋 Copying heartbeat.sh → $TARGET"
sudo cp "$SCRIPT_DIR/heartbeat.sh" "$TARGET"
sudo chmod +x "$TARGET"

# Unload if already loaded
launchctl unload "$PLIST" 2>/dev/null

# Load
launchctl load "$PLIST"

echo "✅ Heartbeat installed (launchd). Runs every 30 minutes."
echo ""
echo "Verify:    launchctl list | grep crypto-agent-fleet"
echo "Logs:      tail -f /tmp/crypto-agent-fleet-heartbeat.log"
echo "Uninstall: ./scripts/uninstall-heartbeat.sh"
