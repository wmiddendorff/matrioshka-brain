#!/bin/bash
# Matrioshka Brain Scheduler Runner
# This script is invoked by OS schedulers (cron, launchd, Task Scheduler)
# to run heartbeat tasks

set -e

# Change to workspace directory
WORKSPACE_DIR="${MATRIOSHKA_BRAIN_HOME:-$HOME/.matrioshka-brain}"
cd "$WORKSPACE_DIR" || exit 1

# Log execution
echo "[$(date)] Running heartbeat..." >> "$WORKSPACE_DIR/logs/scheduler.log"

# Detect which CLI to use (claude code vs codex)
if command -v claude &> /dev/null; then
  # Claude Code CLI available
  claude code --prompt "Run heartbeat tasks from HEARTBEAT.md" >> "$WORKSPACE_DIR/logs/scheduler.log" 2>&1
elif command -v codex &> /dev/null; then
  # Codex CLI available
  codex --prompt "Run heartbeat tasks from HEARTBEAT.md" >> "$WORKSPACE_DIR/logs/scheduler.log" 2>&1
else
  echo "ERROR: Neither 'claude code' nor 'codex' CLI found" >> "$WORKSPACE_DIR/logs/scheduler.log"
  exit 1
fi

echo "[$(date)] Heartbeat complete" >> "$WORKSPACE_DIR/logs/scheduler.log"
