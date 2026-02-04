# Soul/Identity Testing

## Test File

`tests/soul.test.ts` — 36 tests covering types, templates, diff, files, approval DB, and integration.

## Test Strategy

### Isolation

- **Soul Files**: Each test uses a temporary directory via `mkdtempSync()` with `MATRIOSHKA_BRAIN_HOME` env var override. Cleaned up in `afterEach`.
- **Approval DB**: Uses in-memory SQLite (`:memory:`) via `initApprovalDbFrom()`. No disk state between tests.

### Test Categories

#### Soul Types (1 test)
- `SOUL_FILE_MAP` contains all four file type mappings

#### Soul Templates (5 tests)
- Non-empty template for each file type
- Soul template contains core personality sections
- Identity template contains agent metadata
- Agents template contains safety rules
- User template contains placeholder sections

#### Unified Diff (9 tests)
- Identical content returns empty string
- Detects added lines
- Detects removed lines
- Detects changed lines
- Includes file labels in header
- Includes context lines
- Handles empty old text (all additions)
- Handles empty new text (all deletions)
- Includes hunk headers with correct format

#### Soul Files (7 tests)
- `getSoulFilePath` returns correct path
- `readSoulFile` creates file from template if missing
- `readSoulFile` returns existing file content
- `writeSoulFile` writes content to disk
- `ensureBootstrapFiles` creates all four files
- `ensureBootstrapFiles` does not overwrite existing files
- `readSoulFile` detects manual edits immediately

#### Approval Database (10 tests)
- `createApproval` returns approval with UUID
- `getApproval` returns null for missing ID
- `getApproval` returns existing approval
- `listPendingApprovals` returns only pending items
- `listPendingApprovals` filters by type
- `updateApprovalStatus` changes status
- `updateApprovalStatus` returns false for missing ID
- `expireOldApprovals` expires past-due items
- `expireOldApprovals` does not expire future items
- `expireOldApprovals` does not expire items without expiry

#### Approval Types (2 tests)
- `rowToApproval` converts database row correctly
- `rowToApproval` handles null expires_at

#### Integration (2 tests)
- Full flow: propose → approve → file updated on disk
- Full flow: propose → deny → file unchanged

## Running Tests

```bash
# Run all tests
npm test

# Run only soul tests
npx vitest run tests/soul.test.ts

# Watch mode
npx vitest tests/soul.test.ts
```

## Coverage Goals

| Area | Target | Current |
|------|--------|---------|
| Approval types | 100% | 100% |
| Approval DB CRUD | 100% | 100% |
| Soul types | 100% | 100% |
| Soul templates | 100% | 100% |
| Unified diff | 90%+ | ~95% |
| Soul files | 100% | 100% |
| MCP tools | Integration | Via integration tests |
| CLI commands | Manual | Manual testing |

## Manual Testing Checklist

- [ ] `matrioshka-brain init` creates bootstrap files in workspace/
- [ ] MCP tool `soul_read {file: "soul"}` returns SOUL.md content
- [ ] Edit SOUL.md manually → `soul_read` shows updated content
- [ ] `soul_propose_update` creates proposal with diff
- [ ] `matrioshka-brain soul list` shows pending proposal
- [ ] `matrioshka-brain soul show <id>` displays diff
- [ ] `matrioshka-brain soul approve <id>` updates file on disk
- [ ] `matrioshka-brain soul deny <id>` marks proposal as denied without changing file
