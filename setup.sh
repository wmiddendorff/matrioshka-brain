#!/usr/bin/env bash
set -euo pipefail

# Mudpuppy Setup Script
# Installs dependencies, builds the project, initializes the workspace,
# and generates a machine-specific .mcp.json for Claude Code.

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
MUDPUPPY_HOME="${MUDPUPPY_HOME:-$HOME/.mudpuppy}"

echo "=== Mudpuppy Setup ==="
echo ""
echo "Project root:  $PROJECT_ROOT"
echo "Workspace:     $MUDPUPPY_HOME"
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

echo "[4/5] Initializing workspace at $MUDPUPPY_HOME..."
MUDPUPPY_HOME="$MUDPUPPY_HOME" node "$PROJECT_ROOT/dist/cli/index.js" init 2>&1 || true

# --- Generate .mcp.json ---

echo "[5/5] Generating .mcp.json..."
cat > "$PROJECT_ROOT/.mcp.json" <<EOF
{
  "mcpServers": {
    "mudpuppy": {
      "command": "node",
      "args": ["$PROJECT_ROOT/dist/mcp-server.js"],
      "env": {
        "MUDPUPPY_HOME": "$MUDPUPPY_HOME"
      }
    }
  }
}
EOF

echo ""
echo "=== Setup Complete ==="
echo ""
echo "MCP config:    $PROJECT_ROOT/.mcp.json"
echo "Workspace:     $MUDPUPPY_HOME"
echo "CLI:           node $PROJECT_ROOT/dist/cli/index.js --help"
echo ""

# --- Optional: Telegram bot token ---

if [ ! -f "$MUDPUPPY_HOME/secrets.env" ] || ! grep -q "TELEGRAM_BOT_TOKEN" "$MUDPUPPY_HOME/secrets.env" 2>/dev/null; then
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
