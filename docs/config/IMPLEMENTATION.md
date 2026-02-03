# Configuration System - Implementation Details

## Architecture

The configuration system is intentionally simple and file-based:

```
ConfigManager
    ↓
~/.mudpuppy/config.json (JSON file)
    ↓
DEFAULT_CONFIG (fallback)
```

## File Format

**Location**: `~/.mudpuppy/config.json`
**Format**: JSON (pretty-printed with 2-space indent)
**Encoding**: UTF-8

Example:
```json
{
  "version": "0.1.0",
  "workspace": "/home/user/.mudpuppy",
  "heartbeat": {
    "enabled": false,
    "interval": 1800000
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
- **Predictable**: `~/.mudpuppy/` is standard Unix convention
- **Portable**: Works across different project directories
- **Persistent**: Not tied to project location

## Implementation Details

### Loading Sequence

1. Check if `~/.mudpuppy/config.json` exists
2. If exists: Read and parse JSON
3. Merge with `DEFAULT_CONFIG` (handles missing fields from old versions)
4. If doesn't exist or parse fails: Use `DEFAULT_CONFIG`

```typescript
private load(): Config {
  if (!existsSync(this.configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const data = readFileSync(this.configPath, 'utf-8');
    const loaded = JSON.parse(data);
    return { ...DEFAULT_CONFIG, ...loaded };  // Merge with defaults
  } catch (error) {
    console.warn(`Failed to load config, using defaults:`, error);
    return DEFAULT_CONFIG;
  }
}
```

### Setting Values

Uses dot notation to navigate nested objects:

```typescript
public set(key: string, value: any): void {
  const keys = key.split('.');
  let current: any = this.config;

  // Navigate to parent object
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};  // Create missing intermediate objects
    }
    current = current[keys[i]];
  }

  // Set the final value
  current[keys[keys.length - 1]] = value;
}
```

**Example:**
- `set('heartbeat.interval', 60000)`
- Splits to: `['heartbeat', 'interval']`
- Navigates: `config` → `config.heartbeat`
- Sets: `config.heartbeat.interval = 60000`

### Saving

Atomicity is not guaranteed (no temp file + rename). This is acceptable because:
- Config changes are infrequent
- Corruption risk is low
- Manual recovery is easy (delete config.json, run `mudpuppy init`)

```typescript
public save(): void {
  const dir = join(homedir(), '.mudpuppy');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(
    this.configPath,
    JSON.stringify(this.config, null, 2),  // Pretty-print
    'utf-8'
  );
}
```

### Workspace Management

```typescript
public ensureWorkspace(): void {
  // Create main workspace
  if (!existsSync(this.config.workspace)) {
    mkdirSync(this.config.workspace, { recursive: true });
  }

  // Create standard subdirectories
  const dirs = ['memory', 'agents/default/sessions'];
  for (const dir of dirs) {
    const path = this.getWorkspacePath(dir);
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }
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
$ mudpuppy config get
Failed to load config from ~/.mudpuppy/config.json, using defaults: ...
{ ... DEFAULT_CONFIG ... }

# User can fix by re-initializing:
$ mudpuppy init
✓ Configuration saved
```

## Future Improvements

1. **Schema validation**: Validate config on load/set
2. **Config versioning**: Automatic migrations between versions
3. **Hot reload**: Watch config.json for external changes
4. **Config profiles**: Multiple named configurations
5. **Encryption**: Encrypt sensitive fields (not secrets, but maybe API endpoints)
6. **Config merge**: Allow environment-specific overrides
