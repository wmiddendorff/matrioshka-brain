# Configuration API Reference

## CLI Commands

### `mudpuppy config get`

Display the current configuration in JSON format.

```bash
mudpuppy config get

# Output:
# {
#   "version": "2.0.0",
#   "telegram": { ... },
#   ...
# }
```

### `mudpuppy config set <key> <value>`

Set a configuration value using dot notation.

**Arguments:**
- `key` - Dot-separated path to config property (e.g., `heartbeat.interval`)
- `value` - New value (auto-parsed as boolean, number, JSON, or string)

**Examples:**

```bash
# Set number
mudpuppy config set heartbeat.interval 60000

# Set boolean
mudpuppy config set telegram.enabled true

# Set string
mudpuppy config set memory.embeddingProvider openai

# Set object (JSON)
mudpuppy config set heartbeat.activeHours '{"start":"09:00","end":"17:00","timezone":"America/Los_Angeles"}'
```

**Value Parsing Rules:**
- `"true"` → `true` (boolean)
- `"false"` → `false` (boolean)
- `"123"` → `123` (number)
- `"hello"` → `"hello"` (string)
- `'{"key":"value"}'` → `{key: "value"}` (JSON object)
- `'[1,2,3]'` → `[1,2,3]` (JSON array)

### `mudpuppy init`

Initialize the workspace and create default configuration.

```bash
mudpuppy init

# Output:
# Initializing Mudpuppy workspace...
# Created: /home/user/.mudpuppy
# Created: /home/user/.mudpuppy/workspace
# ...
```

Creates:
- `~/.mudpuppy/` directory
- `~/.mudpuppy/config.json` with defaults
- `~/.mudpuppy/workspace/` - Soul/identity files
- `~/.mudpuppy/workspace/memory/` - Daily logs
- `~/.mudpuppy/data/` - Database and sessions
- `~/.mudpuppy/data/sessions/` - Session transcripts
- `~/.mudpuppy/bot/` - Telegram bot daemon
- `~/.mudpuppy/tools/` - Tool documentation

## Programmatic API

### `ConfigManager`

Main configuration management class.

#### Constructor

```typescript
import { ConfigManager } from 'mudpuppy';

const config = new ConfigManager();
```

**Behavior:**
- Loads config from `~/.mudpuppy/config.json` (or `$MUDPUPPY_HOME/config.json`)
- Creates default config if file doesn't exist
- Merges loaded config with defaults (handles missing fields)

#### Methods

##### `get(): MudpuppyConfig`

Returns the entire configuration object.

```typescript
const cfg = config.get();
console.log(cfg.heartbeat.interval);  // 1800000
```

##### `getValue<T>(path: string): T | undefined`

Gets a configuration value using dot notation.

```typescript
const interval = config.getValue<number>('heartbeat.interval');
const enabled = config.getValue<boolean>('telegram.enabled');
```

##### `setValue(path: string, value: unknown): void`

Sets a configuration value using dot notation.

```typescript
config.setValue('heartbeat.enabled', true);
config.setValue('heartbeat.interval', 60000);
config.setValue('memory.hybridWeights', { vector: 0.8, keyword: 0.2 });
```

**Note:** Changes are in-memory only until `save()` is called.

##### `save(): void`

Saves the configuration to disk.

```typescript
config.setValue('heartbeat.enabled', true);
config.save();  // Writes to ~/.mudpuppy/config.json
```

**Throws:** Error if unable to write file.

##### `reset(): void`

Resets configuration to defaults (in-memory only).

```typescript
config.reset();
config.save();  // Save to persist reset
```

##### `getConfigPath(): string`

Returns the path to the config file.

```typescript
const path = config.getConfigPath();
// → /home/user/.mudpuppy/config.json
```

### Utility Functions

##### `getMudpuppyHome(): string`

Returns the Mudpuppy home directory.

```typescript
import { getMudpuppyHome } from 'mudpuppy';

const home = getMudpuppyHome();
// Uses $MUDPUPPY_HOME or defaults to ~/.mudpuppy
```

##### `resolvePath(relativePath: string): string`

Resolves a path relative to MUDPUPPY_HOME.

```typescript
import { resolvePath } from 'mudpuppy';

const configPath = resolvePath('config.json');
// → /home/user/.mudpuppy/config.json

const memoryPath = resolvePath('workspace/memory');
// → /home/user/.mudpuppy/workspace/memory
```

##### `initWorkspace(): { created: string[]; existed: string[] }`

Initializes the workspace directory structure.

```typescript
import { initWorkspace } from 'mudpuppy';

const result = initWorkspace();
console.log('Created:', result.created);
console.log('Already existed:', result.existed);
```

##### `isWorkspaceInitialized(): boolean`

Checks if the workspace has been initialized.

```typescript
import { isWorkspaceInitialized } from 'mudpuppy';

if (!isWorkspaceInitialized()) {
  console.log('Run: mudpuppy init');
}
```

## TypeScript Types

### `MudpuppyConfig`

```typescript
interface MudpuppyConfig {
  version: string;
  telegram: TelegramConfig;
  memory: MemoryConfig;
  heartbeat: HeartbeatConfig;
  security: SecurityConfig;
}
```

### `TelegramConfig`

```typescript
interface TelegramConfig {
  enabled: boolean;
  allowGroups: boolean;
}
```

Note: Bot token is stored in `~/.mudpuppy/secrets.env`, not in config.

### `MemoryConfig`

```typescript
interface MemoryConfig {
  embeddingProvider: 'local' | 'openai' | 'none';
  embeddingModel: string;  // e.g., 'Xenova/all-MiniLM-L6-v2'
  hybridWeights: {
    vector: number;   // Weight for vector similarity (0-1)
    keyword: number;  // Weight for keyword matching (0-1)
  };
  autoIndex: boolean;
  indexInterval: number;  // milliseconds
}
```

### `HeartbeatConfig`

```typescript
interface HeartbeatConfig {
  enabled: boolean;
  interval: number;  // milliseconds (default: 1800000 = 30 min)
  activeHours?: {
    start: string;   // "HH:MM"
    end: string;     // "HH:MM"
    timezone: string;  // IANA timezone
  };
  maxActionsPerBeat: number;
  requireApproval: boolean;
}
```

### `SecurityConfig`

```typescript
interface SecurityConfig {
  approvalRequired: string[];  // Tool names requiring approval
  auditLog: boolean;
  maxMessageLength: number;
}
```

## Default Configuration

```json
{
  "version": "2.0.0",
  "telegram": {
    "enabled": false,
    "allowGroups": false
  },
  "memory": {
    "embeddingProvider": "local",
    "embeddingModel": "Xenova/all-MiniLM-L6-v2",
    "hybridWeights": {
      "vector": 0.7,
      "keyword": 0.3
    },
    "autoIndex": true,
    "indexInterval": 5000
  },
  "heartbeat": {
    "enabled": false,
    "interval": 1800000,
    "maxActionsPerBeat": 5,
    "requireApproval": true
  },
  "security": {
    "approvalRequired": ["soul_propose_update", "telegram_pair"],
    "auditLog": true,
    "maxMessageLength": 4096
  }
}
```

## MCP Tools

Configuration is also accessible via MCP tools:

### `config_get`

Get a configuration value.

```json
{
  "path": "telegram.enabled"
}
```

Returns the value at the specified path, or full config if path is omitted.

### `config_set`

Set a configuration value.

```json
{
  "path": "telegram.enabled",
  "value": true
}
```

## Examples

### Enable Telegram with Custom Interval

```bash
mudpuppy config set telegram.enabled true
mudpuppy config set heartbeat.enabled true
mudpuppy config set heartbeat.interval 3600000  # 1 hour
```

### Set Active Hours

```bash
mudpuppy config set heartbeat.activeHours '{"start":"09:00","end":"23:00","timezone":"America/Los_Angeles"}'
```

### Programmatic Configuration

```typescript
import { ConfigManager } from 'mudpuppy';

const config = new ConfigManager();

// Enable features
config.setValue('telegram.enabled', true);
config.setValue('heartbeat.enabled', true);

// Configure memory weights
config.setValue('memory.hybridWeights', {
  vector: 0.8,
  keyword: 0.2
});

// Configure heartbeat
config.setValue('heartbeat.interval', 1800000);  // 30 minutes
config.setValue('heartbeat.activeHours', {
  start: '09:00',
  end: '23:00',
  timezone: 'America/Los_Angeles'
});

// Save changes
config.save();
```

## Error Handling

```typescript
try {
  config.setValue('heartbeat.interval', 60000);
  config.save();
} catch (error) {
  console.error('Failed to save config:', error);
}
```

Common errors:
- **Permission denied**: Can't write to config file
- **Invalid JSON**: Malformed JSON in config value
- **Missing directory**: Parent directory doesn't exist (use `initWorkspace()`)
