# Configuration System - Testing Strategy

## Test Coverage

**Location**: `tests/config.test.ts`
**Framework**: Vitest
**Current Coverage**: 4 tests, all passing

## Test Strategy

### Unit Tests

Focus on ConfigManager methods in isolation:

1. **Default config creation** - Verify defaults when file doesn't exist
2. **Setting values** - Test dot notation and value assignment
3. **Workspace creation** - Verify directory structure
4. **Nested paths** - Test complex nested configuration

### Integration Tests

Test CLI commands end-to-end:

1. **`matrioshka-brain init`** - Creates workspace and config
2. **`matrioshka-brain config get`** - Displays current config
3. **`matrioshka-brain config set`** - Updates and persists changes

### Edge Cases

- Corrupted config.json (invalid JSON)
- Missing config.json (first run)
- Permission denied (can't write)
- Invalid key paths (non-existent nested keys)
- Type coercion (string "true" → boolean true)

## Current Test Suite

### Test 1: Default Config Creation

```typescript
it('should create default config when file does not exist', () => {
  const config = new ConfigManager();
  const cfg = config.get();

  expect(cfg.version).toBe('0.1.0');
  expect(cfg.heartbeat.enabled).toBe(false);
  expect(cfg.telegram.enabled).toBe(false);
  expect(cfg.security.approvalRequired).toBe(true);
});
```

**Purpose**: Verify fallback to defaults when no config file exists.

### Test 2: Set and Get Values

```typescript
it('should set and get config values', () => {
  const config = new ConfigManager();

  config.set('heartbeat.enabled', true);
  expect(config.get().heartbeat.enabled).toBe(true);

  config.set('heartbeat.interval', 60000);
  expect(config.get().heartbeat.interval).toBe(60000);
});
```

**Purpose**: Verify dot notation works for setting nested values.

### Test 3: Workspace Creation

```typescript
it('should create workspace directories', () => {
  const config = new ConfigManager();
  config.ensureWorkspace();

  const workspace = config.get().workspace;
  expect(existsSync(workspace)).toBe(true);
  expect(existsSync(config.getWorkspacePath('memory'))).toBe(true);
  expect(existsSync(config.getWorkspacePath('agents/default/sessions'))).toBe(true);
});
```

**Purpose**: Verify workspace directory structure is created correctly.

### Test 4: Nested Config Paths

```typescript
it('should handle nested config paths', () => {
  const config = new ConfigManager();

  config.set('telegram.pairedUsers', [123456, 789012]);
  expect(config.get().telegram.pairedUsers).toEqual([123456, 789012]);
});
```

**Purpose**: Verify complex nested values (arrays, objects) work correctly.

## Test Isolation

Each test uses a separate workspace to avoid conflicts:

```typescript
const testWorkspace = join(homedir(), '.matrioshka-brain-test');

beforeEach(() => {
  // Clean up test workspace before each test
  if (existsSync(testWorkspace)) {
    rmSync(testWorkspace, { recursive: true, force: true });
  }
});

afterEach(() => {
  // Clean up test workspace after each test
  if (existsSync(testWorkspace)) {
    rmSync(testWorkspace, { recursive: true, force: true });
  }
});
```

## Manual Testing Checklist

### First Run Experience

- [ ] Run `matrioshka-brain init` in clean environment
- [ ] Verify `~/.matrioshka-brain/` created
- [ ] Verify `config.json` has correct defaults
- [ ] Verify subdirectories created

### Config Get/Set

- [ ] `matrioshka-brain config get` displays JSON
- [ ] `matrioshka-brain config set heartbeat.enabled true` works
- [ ] `matrioshka-brain config set heartbeat.interval 60000` works
- [ ] `matrioshka-brain config set telegram.pairedUsers '[123,456]'` works
- [ ] Changes persist after CLI exit
- [ ] Manual edits to config.json are respected

### Error Handling

- [ ] Corrupt `config.json` → warns and uses defaults
- [ ] Missing parent directory → creates automatically
- [ ] Invalid key path → sets anyway (creates intermediate objects)
- [ ] Permission denied → throws error with helpful message

### Value Parsing

- [ ] String "true" → boolean true
- [ ] String "false" → boolean false
- [ ] String "123" → number 123
- [ ] String "hello" → string "hello"
- [ ] String '{"key":"value"}' → object {key: "value"}
- [ ] String '[1,2,3]' → array [1,2,3]

## Performance Testing

### Load Time

```bash
time matrioshka-brain config get
# Should be <100ms
```

### Save Time

```bash
time matrioshka-brain config set heartbeat.interval 60000
# Should be <100ms
```

## Future Test Coverage

### Missing Tests (TODO)

1. **Persistence**: Verify save() writes to disk correctly
2. **Merge behavior**: Test default merging with loaded config
3. **Invalid JSON**: Test corrupted config.json handling
4. **Permission errors**: Test read/write permission issues
5. **Concurrent access**: Test multiple ConfigManager instances
6. **Migration**: Test config version upgrades
7. **Type validation**: Test invalid value types

### Integration Tests (TODO)

1. Full CLI workflow: init → set → get → verify file
2. Config changes reflected in other modules
3. Workspace paths used correctly by other components

### Property-Based Tests (TODO)

Use property testing to verify:
- Any valid key path can be set
- Any JSON-serializable value can be stored
- Set/get round-trips correctly
- Config always serializes to valid JSON

Example with fast-check:
```typescript
import fc from 'fast-check';

it('should round-trip any JSON value', () => {
  fc.assert(
    fc.property(
      fc.jsonValue(),
      (value) => {
        const config = new ConfigManager();
        config.set('test.value', value);
        expect(config.get().test.value).toEqual(value);
      }
    )
  );
});
```

## Test Metrics

**Target Coverage**: 90%+ line coverage
**Current Coverage**: Not measured (add `npm run test:coverage`)

**Key Metrics**:
- Line coverage
- Branch coverage
- Function coverage
- Integration test count

## Running Tests

```bash
# Run all tests
npm run test

# Watch mode (during development)
npm run test:watch

# Coverage report
npm run test:coverage

# Single test file
npx vitest tests/config.test.ts
```

## CI/CD Integration

Tests should run on:
- Every commit
- Every pull request
- Before deployment
- Scheduled nightly

Example GitHub Actions:
```yaml
- name: Run tests
  run: npm run test

- name: Check coverage
  run: npm run test:coverage
```
