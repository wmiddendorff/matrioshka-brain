# Configuration System

The configuration system manages all settings for Matrioshka Brain, providing a centralized JSON-based configuration with type safety and validation.

## Overview

- **Location**: `~/.matrioshka-brain/config.json`
- **Format**: JSON with TypeScript types
- **Scope**: Global settings for all features
- **Management**: Via CLI or programmatic API

## Quick Start

```bash
# Initialize workspace and create default config
matrioshka-brain init

# View current configuration
matrioshka-brain config get

# Set a configuration value
matrioshka-brain config set heartbeat.interval 60000

# Set boolean value
matrioshka-brain config set telegram.enabled true

# Set array value (JSON)
matrioshka-brain config set telegram.pairedUsers '[123456,789012]'
```

## Configuration Structure

```typescript
interface Config {
  version: string;
  workspace: string;  // Default: ~/.matrioshka-brain

  heartbeat: {
    enabled: boolean;
    interval: number;  // milliseconds
    activeHours?: {
      start: string;
      end: string;
      timezone: string;
    };
    requireApproval: boolean;
    maxActionsPerBeat: number;
  };

  telegram: {
    enabled: boolean;
    botToken?: string;
    pairedUsers: number[];
    enableGroups: boolean;
    notifyHeartbeat: boolean;
  };

  memory: {
    enabled: boolean;
    embeddingProvider: 'openai' | 'local';
    searchMode: 'hybrid' | 'vector' | 'keyword';
  };

  security: {
    approvalRequired: boolean;
    auditLog: boolean;
    sandboxMode: 'off' | 'non-main' | 'all';
  };
}
```

## Default Configuration

All features are **disabled by default** (opt-in security model):

```json
{
  "version": "0.1.0",
  "workspace": "~/.matrioshka-brain",
  "heartbeat": {
    "enabled": false,
    "interval": 1800000,
    "requireApproval": true,
    "maxActionsPerBeat": 10
  },
  "telegram": {
    "enabled": false,
    "pairedUsers": [],
    "enableGroups": false,
    "notifyHeartbeat": true
  },
  "memory": {
    "enabled": false,
    "embeddingProvider": "local",
    "searchMode": "hybrid"
  },
  "security": {
    "approvalRequired": true,
    "auditLog": true,
    "sandboxMode": "off"
  }
}
```

## Programmatic Usage

```typescript
import { ConfigManager } from 'matrioshka-brain';

const config = new ConfigManager();

// Get entire config
const cfg = config.get();
console.log(cfg.heartbeat.interval);

// Set value
config.set('heartbeat.enabled', true);
config.save();

// Get workspace paths
const memoryPath = config.getWorkspacePath('memory');
const agentPath = config.getWorkspacePath('agents', 'default');

// Ensure workspace exists
config.ensureWorkspace();
```

## File Locations

- **Config**: `~/.matrioshka-brain/config.json`
- **Workspace**: `~/.matrioshka-brain/`
- **Memory**: `~/.matrioshka-brain/memory/`
- **Sessions**: `~/.matrioshka-brain/agents/default/sessions/`
- **Secrets**: `~/.matrioshka-brain/secrets.env` (gitignored)

## Security Considerations

- Config file is **not encrypted** (contains no secrets)
- Secrets (bot tokens, API keys) stored separately in `secrets.env`
- All approval flags default to `true` (safe by default)
- Sandbox mode defaults to `off` (can be enabled per phase)

## CLI Commands

See [API.md](./API.md) for full CLI reference.

## See Also

- [API Documentation](./API.md)
- [Implementation Details](./IMPLEMENTATION.md)
- [Testing Strategy](./TESTING.md)
