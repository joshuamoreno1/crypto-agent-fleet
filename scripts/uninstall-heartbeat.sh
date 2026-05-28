#!/usr/bin/env zsh
# Uninstall the Crypto Agent Fleet heartbeat launchd job.

PLIST="$HOME/Library/LaunchAgents/com.crypto-agent-fleet.heartbeat.plist"
TARGET="/usr/local/bin/crypto-agent-fleet-heartbeat"

launchctl unload "$PLIST" 2>/dev/null
sudo rm -f "$TARGET"

echo "✅ Heartbeat uninstalled."
echo "Verify: launchctl list | grep crypto-agent-fleet  (should be empty)"
