# Mudpuppy 🐾

Security-hardened autonomous AI agent extending Claude Code with persistent memory, evolving personality, and controlled autonomous execution.

Named after the adorable aquatic salamander that never stops learning and evolving.

## Status

**Current Phase:** Phase 1 - Telegram Integration
**Version:** 0.1.0

See [PROGRESS.md](./PROGRESS.md) for detailed development status.

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Initialize Workspace

```bash
node dist/cli/index.js init
```

This creates the workspace at `~/.openclaw-clone/` with:
- Configuration file (`config.json`)
- Memory directory
- Agent sessions directory

### Development

```bash
# Build the project
npm run build

# Run tests
npm run test

# Watch mode for development
npm run dev -- <command>
npm run build:watch

# Test coverage
npm run test:coverage
```

### CLI Commands

```bash
# Show help
node dist/cli/index.js --help

# Show version
node dist/cli/index.js --version

# Initialize workspace
node dist/cli/index.js init

# Get configuration
node dist/cli/index.js config get

# Set configuration
node dist/cli/index.js config set heartbeat.interval 60000
```

Or if installed globally: `mudpuppy init`, `mudpuppy start`, etc.

## Project Structure

```
mudpuppy/
├── src/
│   ├── cli/           # CLI entry point
│   ├── config.ts      # Configuration system
│   ├── memory/        # Memory persistence (Phase 3)
│   ├── soul/          # Soul/Identity system (Phase 2)
│   ├── autonomy/      # Heartbeat engine (Phase 4)
│   ├── telegram/      # Telegram integration (Phase 1)
│   ├── tools/         # Agent tools
│   └── security/      # Approval & audit systems
├── tests/             # Test suite
├── templates/         # Bootstrap file templates
└── dist/              # Compiled output
```

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Guidance for AI assistants working on this project
- [PRD.md](./PRD.md) - Product Requirements Document
- [PROGRESS.md](./PROGRESS.md) - Development progress tracking

## Phase 0 Complete ✓

- [x] TypeScript project setup
- [x] Build tooling (tsc)
- [x] Testing framework (vitest)
- [x] Basic CLI structure
- [x] Configuration system
- [x] Git repository initialized

## Next: Phase 1 - Telegram Integration

Focus on getting basic Telegram bot working for remote testing and interaction.

## License

MIT
