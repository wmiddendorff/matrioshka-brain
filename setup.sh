#!/usr/bin/env bash
set -euo pipefail

# Matrioshka Brain Setup Script
# Installs dependencies, builds the project, initializes the workspace,
# and generates a machine-specific .mcp.json for Claude Code.
#
# Usage:
#   ./setup.sh              Default setup
#   ./setup.sh --profile sales    Sales assistant profile

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
MATRIOSHKA_BRAIN_HOME="${MATRIOSHKA_BRAIN_HOME:-$HOME/.matrioshka-brain}"
PROFILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./setup.sh [--profile sales]"
      exit 1
      ;;
  esac
done

echo "=== Matrioshka Brain Setup ==="
echo ""
echo "Project root:  $PROJECT_ROOT"
echo "Workspace:     $MATRIOSHKA_BRAIN_HOME"
if [ -n "$PROFILE" ]; then
  echo "Profile:       $PROFILE"
fi
echo ""

# --- Prerequisites ---

check_command() {
  if ! command -v "$1" &>/dev/null; then
    echo "ERROR: '$1' is required but not found."
    echo "Install it and re-run this script."
    exit 1
  fi
}

check_command node
check_command npm

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "ERROR: Node.js >= 18 is required (found v$(node -v | sed 's/v//'))"
  exit 1
fi

echo "[1/5] Prerequisites OK (Node $(node -v), npm $(npm -v))"

# --- Install dependencies ---

echo "[2/5] Installing dependencies..."
cd "$PROJECT_ROOT"
npm install --no-fund --no-audit 2>&1 | tail -1

# --- Build ---

echo "[3/5] Building project..."
npm run build 2>&1 | tail -1

# --- Initialize workspace ---

echo "[4/5] Initializing workspace at $MATRIOSHKA_BRAIN_HOME..."
MATRIOSHKA_BRAIN_HOME="$MATRIOSHKA_BRAIN_HOME" node "$PROJECT_ROOT/dist/cli/index.js" init 2>&1 || true

# Apply profile-specific configuration
if [ "$PROFILE" = "sales" ]; then
  echo "[4.1/5] Applying sales assistant profile..."
  
  # Copy sales profile templates to workspace
  cp "$PROJECT_ROOT/src/soul/profiles/sales/SOUL.md" "$MATRIOSHKA_BRAIN_HOME/workspace/SOUL.md"
  cp "$PROJECT_ROOT/src/soul/profiles/sales/AGENTS.md" "$MATRIOSHKA_BRAIN_HOME/workspace/AGENTS.md"
  cp "$PROJECT_ROOT/src/soul/profiles/sales/HEARTBEAT.md" "$MATRIOSHKA_BRAIN_HOME/workspace/HEARTBEAT.md"
  
  echo "Sales assistant profile installed."
  echo ""
  echo "Required plugins: gmail (or outlook), pipedrive"
  echo "Run plugin setup:"
  echo "  node $PROJECT_ROOT/dist/cli/index.js plugins add gmail"
  echo "  node $PROJECT_ROOT/dist/cli/index.js plugins add pipedrive"
  echo ""
fi

# --- Generate .mcp.json ---

echo "[5/5] Generating .mcp.json..."
cat > "$PROJECT_ROOT/.mcp.json" <<EOF
{
  "mcpServers": {
    "matrioshka-brain": {
      "command": "node",
      "args": ["$PROJECT_ROOT/dist/mcp-server.js"],
      "env": {
        "MATRIOSHKA_BRAIN_HOME": "$MATRIOSHKA_BRAIN_HOME"
      }
    }
  }
}
EOF

echo ""
echo "=== Setup Complete ==="
echo ""
echo "MCP config:    $PROJECT_ROOT/.mcp.json"
echo "Workspace:     $MATRIOSHKA_BRAIN_HOME"
echo "CLI:           node $PROJECT_ROOT/dist/cli/index.js --help"
echo ""

# --- Optional: Telegram bot token ---

if [ ! -f "$MATRIOSHKA_BRAIN_HOME/secrets.env" ] || ! grep -q "TELEGRAM_BOT_TOKEN" "$MATRIOSHKA_BRAIN_HOME/secrets.env" 2>/dev/null; then
  echo "Optional: Set up Telegram bot integration."
  echo "If you have a bot token from @BotFather, run:"
  echo ""
  echo "  node $PROJECT_ROOT/dist/cli/index.js telegram set-token"
  echo ""
fi

echo "To start the Telegram bot daemon:"
echo "  node $PROJECT_ROOT/dist/cli/index.js telegram start"
echo ""
echo "To use with Claude Code, open this project in Claude Code."
echo "The .mcp.json will be detected automatically."
echo ""

if [ "$PROFILE" = "sales" ]; then
  echo "=== Sales Assistant Next Steps ==="
  echo ""
  echo "1. Install required plugins:"
  echo "   node $PROJECT_ROOT/dist/cli/index.js plugins add gmail"
  echo "   node $PROJECT_ROOT/dist/cli/index.js plugins add pipedrive"
  echo ""
  echo "2. Generate .mcp.json with plugins:"
  echo "   node $PROJECT_ROOT/dist/cli/index.js plugins config"
  echo ""
  echo "3. Add plugin entries to .mcp.json mcpServers section"
  echo ""
  echo "4. Set up autonomous scheduling (optional):"
  echo "   node $PROJECT_ROOT/dist/cli/index.js schedule add"
  echo ""
  echo "5. Copy skill to Claude Code:"
  echo "   mkdir -p ~/.claude/skills/sales-assistant"
  echo "   cp $PROJECT_ROOT/skills/sales-assistant/SKILL.md ~/.claude/skills/sales-assistant/"
  echo ""
fi
