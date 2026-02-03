# Configuration API Reference

## CLI Commands

### `mudpuppy config get`

Display the current configuration in JSON format.

```bash
mudpuppy config get

# Output:
# {
#   "version": "0.1.0",
#   "workspace": "/home/user/.mudpuppy",
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

# Set array (JSON)
mudpuppy config set telegram.pairedUsers '[123456,789012]'

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
# ✓ Workspace created at: /home/user/.mudpuppy
# ✓ Configuration saved
```

Creates:
- `~/.mudpuppy/` directory
- `~/.mudpuppy/config.json` with defaults
- `~/.mudpuppy/memory/` directory
- `~/.mudpuppy/agents/default/sessions/` directory

## Programmatic API

### `ConfigManager`

Main configuration management class.

#### Constructor

```typescript
import { ConfigManager } from 'mudpuppy';

const config = new ConfigManager();
```

**Behavior:**
- Loads config from `~/.mudpuppy/config.json`
- Creates default config if file doesn't exist
- Merges loaded config with defaults (handles missing fields)

#### Methods

##### `get(): Config`

Returns the entire configuration object.

```typescript
const cfg = config.get();
console.log(cfg.heartbeat.interval);  // 1800000
```

##### `set(key: string, value: any): void`

Sets a configuration value using dot notation.

```typescript
config.set('heartbeat.enabled', true);
config.set('heartbeat.interval', 60000);
config.set('telegram.pairedUsers', [123456, 789012]);
```

**Note:** Changes are in-memory only until `save()` is called.

##### `save(): void`

Saves the configuration to disk.

```typescript
config.set('heartbeat.enabled', true);
config.save();  // Writes to ~/.mudpuppy/config.json
```

**Throws:** Error if unable to write file.

##### `getWorkspacePath(...paths: string[]): string`

Returns an absolute path within the workspace.

```typescript
config.getWorkspacePath('memory');
// → /home/user/.mudpuppy/memory

config.getWorkspacePath('agents', 'default', 'sessions');
// → /home/user/.mudpuppy/agents/default/sessions

config.getWorkspacePath('memory', '2026-02-02.md');
// → /home/user/.mudpuppy/memory/2026-02-02.md
```

##### `ensureWorkspace(): void`

Creates the workspace directory and standard subdirectories if they don't exist.

```typescript
config.ensureWorkspace();
```

**Creates:**
- `~/.mudpuppy/`
- `~/.mudpuppy/memory/`
- `~/.mudpuppy/agents/default/sessions/`

## TypeScript Types

### `Config`

```typescript
interface Config {
  version: string;
  workspace: string;
  heartbeat: HeartbeatConfig;
  telegram: TelegramConfig;
  memory: MemoryConfig;
  security: SecurityConfig;
}
```

### `HeartbeatConfig`

```typescript
interface HeartbeatConfig {
  enabled: boolean;
  interval: number;  // milliseconds
  activeHours?: {
    start: string;   // "HH:MM"
    end: string;     // "HH:MM"
    timezone: string;  // IANA timezone
  };
  requireApproval: boolean;
  maxActionsPerBeat: number;
}
```

### `TelegramConfig`

```typescript
interface TelegramConfig {
  enabled: boolean;
  botToken?: string;
  pairedUsers: number[];
  enableGroups: boolean;
  notifyHeartbeat: boolean;
}
```

### `MemoryConfig`

```typescript
interface MemoryConfig {
  enabled: boolean;
  embeddingProvider: 'openai' | 'local';
  searchMode: 'hybrid' | 'vector' | 'keyword';
}
```

### `SecurityConfig`

```typescript
interface SecurityConfig {
  approvalRequired: boolean;
  auditLog: boolean;
  sandboxMode: 'off' | 'non-main' | 'all';
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
config.set('telegram.enabled', true);
config.set('memory.enabled', true);
config.set('heartbeat.enabled', true);

// Configure heartbeat
config.set('heartbeat.interval', 1800000);  // 30 minutes
config.set('heartbeat.activeHours', {
  start: '09:00',
  end: '23:00',
  timezone: 'America/Los_Angeles'
});

// Save changes
config.save();

// Get workspace paths
const memoryDir = config.getWorkspacePath('memory');
const sessionsDir = config.getWorkspacePath('agents', 'default', 'sessions');
```

## Error Handling

```typescript
try {
  config.set('heartbeat.interval', 60000);
  config.save();
} catch (error) {
  console.error('Failed to save config:', error);
}
```

Common errors:
- **Permission denied**: Can't write to `~/.mudpuppy/config.json`
- **Invalid JSON**: Malformed JSON in config value
- **Missing directory**: Parent directory doesn't exist (use `ensureWorkspace()`)
