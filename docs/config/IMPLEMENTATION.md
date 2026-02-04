# Configuration System - Implementation Details

## Architecture

The configuration system is intentionally simple and file-based:

```
ConfigManager
    ↓
~/.matrioshka-brain/config.json (JSON file)
    ↓
DEFAULT_CONFIG (fallback)
```

## File Format

**Location**: `~/.matrioshka-brain/config.json`
**Format**: JSON (pretty-printed with 2-space indent)
**Encoding**: UTF-8

Example:
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
    "hybridWeights": { "vector": 0.7, "keyword": 0.3 },
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

## Design Decisions

### Why JSON over YAML/TOML?

- **Native JavaScript support**: No parsing library needed
- **Type safety**: Works seamlessly with TypeScript interfaces
- **CLI compatibility**: Easy to manipulate with standard tools (`jq`)
- **Simplicity**: Everyone understands JSON

### Why File-Based over Environment Variables?

- **Persistent**: Settings survive across restarts
- **Editable**: Users can manually edit config.json
- **Structured**: Nested configuration with type checking
- **Discoverable**: Single file to find and modify

**However**: Secrets (API keys, tokens) use environment variables via `secrets.env` (gitignored).

### Why Home Directory?

- **User-scoped**: Each user has their own config
- **Predictable**: `~/.matrioshka-brain/` is standard Unix convention
- **Portable**: Works across different project directories
- **Persistent**: Not tied to project location

## Implementation Details

### Loading Sequence

1. Check if config file exists at `$MATRIOSHKA_BRAIN_HOME/config.json` or `~/.matrioshka-brain/config.json`
2. If exists: Read and parse JSON
3. Merge with `DEFAULT_CONFIG` using deep merge (handles missing fields from old versions)
4. If doesn't exist or parse fails: Use `DEFAULT_CONFIG`

```typescript
private load(): Matrioshka BrainConfig {
  if (existsSync(this.configPath)) {
    try {
      const content = readFileSync(this.configPath, 'utf-8');
      const loaded = JSON.parse(content);
      return this.mergeWithDefaults(loaded);
    } catch (error) {
      console.error(`Error loading config: ${error}`);
      return { ...DEFAULT_CONFIG };
    }
  }
  return { ...DEFAULT_CONFIG };
}

private mergeWithDefaults(loaded: Partial<Matrioshka BrainConfig>): Matrioshka BrainConfig {
  return {
    ...DEFAULT_CONFIG,
    ...loaded,
    telegram: { ...DEFAULT_CONFIG.telegram, ...loaded.telegram },
    memory: {
      ...DEFAULT_CONFIG.memory,
      ...loaded.memory,
      hybridWeights: {
        ...DEFAULT_CONFIG.memory.hybridWeights,
        ...loaded.memory?.hybridWeights,
      },
    },
    heartbeat: { ...DEFAULT_CONFIG.heartbeat, ...loaded.heartbeat },
    security: { ...DEFAULT_CONFIG.security, ...loaded.security },
  };
}
```

### Setting Values

Uses dot notation to navigate nested objects:

```typescript
public setValue(path: string, value: unknown): void {
  const parts = path.split('.');
  const lastPart = parts.pop();
  if (!lastPart) return;

  let current: any = this.config;

  // Navigate to parent object
  for (const part of parts) {
    if (!(part in current)) {
      current[part] = {};  // Create missing intermediate objects
    }
    current = current[part];
  }

  // Set the final value
  current[lastPart] = value;
}
```

**Example:**
- `setValue('heartbeat.interval', 60000)`
- Splits to: `['heartbeat', 'interval']`
- Navigates: `config` → `config.heartbeat`
- Sets: `config.heartbeat.interval = 60000`

### Saving

Atomicity is not guaranteed (no temp file + rename). This is acceptable because:
- Config changes are infrequent
- Corruption risk is low
- Manual recovery is easy (delete config.json, run `matrioshka-brain init`)

```typescript
save(): void {
  const dir = getMatrioshka BrainHome();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
}
```

### Workspace Management

The `initWorkspace()` function creates the directory structure:

```typescript
export function initWorkspace(): { created: string[]; existed: string[] } {
  const home = getMatrioshka BrainHome();
  const dirs = [
    '',                    // root
    'workspace',           // soul/identity files
    'workspace/memory',    // daily logs
    'data',                // database, sessions
    'data/sessions',       // session transcripts
    'bot',                 // telegram bot daemon
    'tools',               // tool documentation
  ];

  const created: string[] = [];
  const existed: string[] = [];

  for (const dir of dirs) {
    const path = join(home, dir);
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
      created.push(path);
    } else {
      existed.push(path);
    }
  }

  return { created, existed };
}
```

## Performance Characteristics

- **Load time**: <10ms (single file read + JSON.parse)
- **Save time**: <50ms (JSON.stringify + file write)
- **Memory usage**: ~10KB (entire config in memory)

## Thread Safety

**Not thread-safe**. The ConfigManager assumes:
- Single process (no concurrent access)
- CLI commands run sequentially
- Background tasks use read-only access

For multi-process scenarios (future), consider:
- File locking
- Watch for external changes
- Reload on modification

## Validation

Currently **no validation** on set values. Future improvements:
- Schema validation (Zod, JSON Schema)
- Type checking at runtime
- Range validation (e.g., interval > 0)

## Migration Strategy

When config format changes:
1. Keep `DEFAULT_CONFIG` updated with all fields
2. Merge loaded config with defaults (handles missing fields)
3. Optionally: Add migration functions for breaking changes

Example:
```typescript
// Version 0.2.0 adds new field
const DEFAULT_CONFIG = {
  version: '0.2.0',
  workspace: '...',
  newField: 'default',  // ← New field
  // ... existing fields
};

// Loaded config from 0.1.0 won't have newField
// Merge ensures it gets default value
```

## Error Handling

### Graceful Degradation

- **Load fails**: Use defaults, warn user
- **Parse fails**: Use defaults, warn user
- **Save fails**: Throw error (don't continue silently)

### User Experience

```bash
# If config.json is corrupted:
$ matrioshka-brain config get
Failed to load config from ~/.matrioshka-brain/config.json, using defaults: ...
{ ... DEFAULT_CONFIG ... }

# User can fix by re-initializing:
$ matrioshka-brain init
✓ Configuration saved
```

## Future Improvements

1. **Schema validation**: Validate config on load/set
2. **Config versioning**: Automatic migrations between versions
3. **Hot reload**: Watch config.json for external changes
4. **Config profiles**: Multiple named configurations
5. **Encryption**: Encrypt sensitive fields (not secrets, but maybe API endpoints)
6. **Config merge**: Allow environment-specific overrides
