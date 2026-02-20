#!/bin/bash
# Install Matrioshka Brain orchestrator as a cron job
# Usage: ./install.sh [interval_minutes]

set -e

INTERVAL="${1:-10}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
NODE_BIN="${NODE_BIN:-$(which node)}"

if [ ! -f "$PROJECT_DIR/dist/cli/index.js" ]; then
  echo "Error: dist/cli/index.js not found. Run 'npm run build' first."
  exit 1
fi

CRON_LINE="*/${INTERVAL} * * * * cd ${PROJECT_DIR} && ${NODE_BIN} dist/cli/index.js orchestrate >> ~/.matrioshka-brain/logs/cron.log 2>&1"

# Check if already installed
if crontab -l 2>/dev/null | grep -q "matrioshka-brain.*orchestrate"; then
  echo "Existing cron job found. Replacing..."
  crontab -l 2>/dev/null | grep -v "matrioshka-brain.*orchestrate" | crontab -
fi

# Install
(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
echo "Installed cron job (every ${INTERVAL} minutes):"
echo "  $CRON_LINE"
