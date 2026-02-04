/**
 * Soul & Approval Module Tests
 *
 * Tests for types, templates, diff generation, file operations,
 * approval database, and integration (propose → approve → verify).
 * Uses temp directories and in-memory SQLite for isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ============================================
// Soul Types
// ============================================

describe('Soul Types', () => {
  it('SOUL_FILE_MAP contains all four files', async () => {
    const { SOUL_FILE_MAP } = await import('../src/soul/types.js');
    expect(SOUL_FILE_MAP.soul).toBe('SOUL.md');
    expect(SOUL_FILE_MAP.identity).toBe('IDENTITY.md');
    expect(SOUL_FILE_MAP.agents).toBe('AGENTS.md');
    expect(SOUL_FILE_MAP.user).toBe('USER.md');
    expect(Object.keys(SOUL_FILE_MAP)).toHaveLength(4);
  });
});

// ============================================
// Soul Templates
// ============================================

describe('Soul Templates', () => {
  it('returns non-empty template for each file type', async () => {
    const { getDefaultTemplate } = await import('../src/soul/templates.js');

    for (const file of ['soul', 'identity', 'agents', 'user'] as const) {
      const template = getDefaultTemplate(file);
      expect(template.length).toBeGreaterThan(0);
      expect(template).toContain('#');
    }
  });

  it('soul template contains core personality sections', async () => {
    const { getDefaultTemplate } = await import('../src/soul/templates.js');
    const template = getDefaultTemplate('soul');
    expect(template).toContain('# Soul');
    expect(template).toContain('## Core Essence');
    expect(template).toContain('## Communication Style');
    expect(template).toContain('## Boundaries');
  });

  it('identity template contains agent metadata', async () => {
    const { getDefaultTemplate } = await import('../src/soul/templates.js');
    const template = getDefaultTemplate('identity');
    expect(template).toContain('# Identity');
    expect(template).toContain('AI Companion');
  });

  it('agents template contains safety rules', async () => {
    const { getDefaultTemplate } = await import('../src/soul/templates.js');
    const template = getDefaultTemplate('agents');
    expect(template).toContain('## Safety Rules');
    expect(template).toContain('## Memory Protocol');
  });

  it('user template contains placeholder sections', async () => {
    const { getDefaultTemplate } = await import('../src/soul/templates.js');
    const template = getDefaultTemplate('user');
    expect(template).toContain('# User Profile');
    expect(template).toContain('## Preferences');
  });
});

// ============================================
// Unified Diff
// ============================================

describe('Unified Diff', () => {
  it('returns empty string for identical content', async () => {
    const { unifiedDiff } = await import('../src/soul/diff.js');
    expect(unifiedDiff('hello\n', 'hello\n')).toBe('');
  });

  it('detects added lines', async () => {
    const { unifiedDiff } = await import('../src/soul/diff.js');
    const diff = unifiedDiff('line1\nline2\n', 'line1\nline2\nline3\n');
    expect(diff).toContain('+line3');
  });

  it('detects removed lines', async () => {
    const { unifiedDiff } = await import('../src/soul/diff.js');
    const diff = unifiedDiff('line1\nline2\nline3\n', 'line1\nline3\n');
    expect(diff).toContain('-line2');
  });

  it('detects changed lines', async () => {
    const { unifiedDiff } = await import('../src/soul/diff.js');
    const diff = unifiedDiff('hello world\n', 'hello mars\n');
    expect(diff).toContain('-hello world');
    expect(diff).toContain('+hello mars');
  });

  it('includes file labels in header', async () => {
    const { unifiedDiff } = await import('../src/soul/diff.js');
    const diff = unifiedDiff('a\n', 'b\n', {
      fromLabel: 'current/SOUL.md',
      toLabel: 'proposed/SOUL.md',
    });
    expect(diff).toContain('--- current/SOUL.md');
    expect(diff).toContain('+++ proposed/SOUL.md');
  });

  it('includes context lines', async () => {
    const { unifiedDiff } = await import('../src/soul/diff.js');
    const old = 'line1\nline2\nline3\nline4\nline5\n';
    const updated = 'line1\nline2\nchanged\nline4\nline5\n';
    const diff = unifiedDiff(old, updated, { context: 1 });
    expect(diff).toContain(' line2');
    expect(diff).toContain('-line3');
    expect(diff).toContain('+changed');
    expect(diff).toContain(' line4');
  });

  it('handles empty old text (all additions)', async () => {
    const { unifiedDiff } = await import('../src/soul/diff.js');
    const diff = unifiedDiff('', 'new content\n');
    expect(diff).toContain('+new content');
  });

  it('handles empty new text (all deletions)', async () => {
    const { unifiedDiff } = await import('../src/soul/diff.js');
    const diff = unifiedDiff('old content\n', '');
    expect(diff).toContain('-old content');
  });

  it('includes hunk headers', async () => {
    const { unifiedDiff } = await import('../src/soul/diff.js');
    const diff = unifiedDiff('a\n', 'b\n');
    expect(diff).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
  });
});

// ============================================
// Soul Files (with temp directory)
// ============================================

describe('Soul Files', () => {
  let tempDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'matrioshka-brain-soul-test-'));
    originalEnv = process.env.MATRIOSHKA_BRAIN_HOME;
    process.env.MATRIOSHKA_BRAIN_HOME = tempDir;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MATRIOSHKA_BRAIN_HOME = originalEnv;
    } else {
      delete process.env.MATRIOSHKA_BRAIN_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('getSoulFilePath returns correct path', async () => {
    const { getSoulFilePath } = await import('../src/soul/files.js');
    const path = getSoulFilePath('soul');
    expect(path).toBe(join(tempDir, 'workspace', 'SOUL.md'));
  });

  it('readSoulFile creates file from template if missing', async () => {
    const { readSoulFile } = await import('../src/soul/files.js');
    const result = readSoulFile('soul');
    expect(result.file).toBe('soul');
    expect(result.content).toContain('# Soul');
    expect(result.lastModified).toBeGreaterThan(0);
  });

  it('readSoulFile returns existing file content', async () => {
    const { readSoulFile, getSoulFilePath } = await import('../src/soul/files.js');
    const { mkdirSync } = await import('fs');

    const filePath = getSoulFilePath('user');
    mkdirSync(join(tempDir, 'workspace'), { recursive: true });
    writeFileSync(filePath, '# Custom User\nHello!');

    const result = readSoulFile('user');
    expect(result.content).toBe('# Custom User\nHello!');
  });

  it('writeSoulFile writes content to disk', async () => {
    const { writeSoulFile, getSoulFilePath } = await import('../src/soul/files.js');

    writeSoulFile('identity', '# New Identity\nTest');
    const content = readFileSync(getSoulFilePath('identity'), 'utf-8');
    expect(content).toBe('# New Identity\nTest');
  });

  it('ensureBootstrapFiles creates all four files', async () => {
    const { ensureBootstrapFiles, getSoulFilePath } = await import('../src/soul/files.js');

    ensureBootstrapFiles();

    for (const file of ['soul', 'identity', 'agents', 'user'] as const) {
      expect(existsSync(getSoulFilePath(file))).toBe(true);
    }
  });

  it('ensureBootstrapFiles does not overwrite existing files', async () => {
    const { ensureBootstrapFiles, getSoulFilePath } = await import('../src/soul/files.js');
    const { mkdirSync } = await import('fs');

    // Create a custom SOUL.md first
    mkdirSync(join(tempDir, 'workspace'), { recursive: true });
    writeFileSync(getSoulFilePath('soul'), '# Custom Soul');

    ensureBootstrapFiles();

    const content = readFileSync(getSoulFilePath('soul'), 'utf-8');
    expect(content).toBe('# Custom Soul');
  });

  it('readSoulFile detects manual edits immediately', async () => {
    const { readSoulFile, getSoulFilePath } = await import('../src/soul/files.js');

    // First read (creates from template)
    const first = readSoulFile('soul');
    expect(first.content).toContain('# Soul');

    // Manually edit the file
    writeFileSync(getSoulFilePath('soul'), '# Manually Edited Soul\nNew content');

    // Second read should see the manual edit
    const second = readSoulFile('soul');
    expect(second.content).toBe('# Manually Edited Soul\nNew content');
  });
});

// ============================================
// Approval Database
// ============================================

describe('Approval Database', () => {
  let db: Database.Database;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    const { initApprovalDbFrom } = await import('../src/approval/db.js');
    initApprovalDbFrom(db);
  });

  afterEach(async () => {
    const { closeApprovalDb } = await import('../src/approval/db.js');
    closeApprovalDb();
  });

  it('createApproval returns approval with UUID', async () => {
    const { createApproval } = await import('../src/approval/db.js');
    const approval = createApproval(db, 'soul_update', { file: 'soul', reason: 'test' });

    expect(approval.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(approval.type).toBe('soul_update');
    expect(approval.status).toBe('pending');
    expect(approval.payload).toEqual({ file: 'soul', reason: 'test' });
  });

  it('getApproval returns null for missing ID', async () => {
    const { getApproval } = await import('../src/approval/db.js');
    expect(getApproval(db, 'nonexistent')).toBeNull();
  });

  it('getApproval returns existing approval', async () => {
    const { createApproval, getApproval } = await import('../src/approval/db.js');
    const created = createApproval(db, 'soul_update', { data: 'hello' });
    const fetched = getApproval(db, created.id);

    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.payload).toEqual({ data: 'hello' });
  });

  it('listPendingApprovals returns only pending items', async () => {
    const { createApproval, updateApprovalStatus, listPendingApprovals } = await import('../src/approval/db.js');

    const a1 = createApproval(db, 'soul_update', { n: 1 });
    const a2 = createApproval(db, 'soul_update', { n: 2 });
    createApproval(db, 'soul_update', { n: 3 });

    updateApprovalStatus(db, a1.id, 'approved');
    updateApprovalStatus(db, a2.id, 'denied');

    const pending = listPendingApprovals(db);
    expect(pending).toHaveLength(1);
    expect(pending[0].payload).toEqual({ n: 3 });
  });

  it('listPendingApprovals filters by type', async () => {
    const { createApproval, listPendingApprovals } = await import('../src/approval/db.js');

    createApproval(db, 'soul_update', { n: 1 });
    createApproval(db, 'telegram_pair', { n: 2 });

    const soulOnly = listPendingApprovals(db, 'soul_update');
    expect(soulOnly).toHaveLength(1);
    expect(soulOnly[0].type).toBe('soul_update');
  });

  it('updateApprovalStatus changes status', async () => {
    const { createApproval, getApproval, updateApprovalStatus } = await import('../src/approval/db.js');

    const created = createApproval(db, 'soul_update', {});
    updateApprovalStatus(db, created.id, 'approved');

    const fetched = getApproval(db, created.id);
    expect(fetched!.status).toBe('approved');
  });

  it('updateApprovalStatus returns false for missing ID', async () => {
    const { updateApprovalStatus } = await import('../src/approval/db.js');
    expect(updateApprovalStatus(db, 'nonexistent', 'approved')).toBe(false);
  });

  it('expireOldApprovals expires past-due items', async () => {
    const { createApproval, getApproval, expireOldApprovals } = await import('../src/approval/db.js');

    const pastExpiry = Date.now() - 60000; // 1 minute ago
    const approval = createApproval(db, 'soul_update', {}, pastExpiry);

    const expired = expireOldApprovals(db);
    expect(expired).toBe(1);

    const fetched = getApproval(db, approval.id);
    expect(fetched!.status).toBe('expired');
  });

  it('expireOldApprovals does not expire future items', async () => {
    const { createApproval, expireOldApprovals } = await import('../src/approval/db.js');

    const futureExpiry = Date.now() + 3600000; // 1 hour from now
    createApproval(db, 'soul_update', {}, futureExpiry);

    const expired = expireOldApprovals(db);
    expect(expired).toBe(0);
  });

  it('expireOldApprovals does not expire items without expiry', async () => {
    const { createApproval, expireOldApprovals } = await import('../src/approval/db.js');

    createApproval(db, 'soul_update', {}); // no expiry

    const expired = expireOldApprovals(db);
    expect(expired).toBe(0);
  });
});

// ============================================
// Approval Types
// ============================================

describe('Approval Types', () => {
  it('rowToApproval converts database row correctly', async () => {
    const { rowToApproval } = await import('../src/approval/types.js');

    const row = {
      id: 'test-id',
      type: 'soul_update',
      payload: '{"file":"soul"}',
      created_at: 1000,
      expires_at: 2000,
      status: 'pending',
    };

    const approval = rowToApproval(row);
    expect(approval.id).toBe('test-id');
    expect(approval.type).toBe('soul_update');
    expect(approval.payload).toEqual({ file: 'soul' });
    expect(approval.createdAt).toBe(1000);
    expect(approval.expiresAt).toBe(2000);
    expect(approval.status).toBe('pending');
  });

  it('rowToApproval handles null expires_at', async () => {
    const { rowToApproval } = await import('../src/approval/types.js');

    const row = {
      id: 'test-id',
      type: 'soul_update',
      payload: '{}',
      created_at: 1000,
      expires_at: null,
      status: 'approved',
    };

    const approval = rowToApproval(row);
    expect(approval.expiresAt).toBeNull();
    expect(approval.status).toBe('approved');
  });
});

// ============================================
// Integration: Propose → Approve → Verify
// ============================================

describe('Integration: Soul Proposal Flow', () => {
  let tempDir: string;
  let originalEnv: string | undefined;
  let db: Database.Database;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'matrioshka-brain-soul-int-'));
    originalEnv = process.env.MATRIOSHKA_BRAIN_HOME;
    process.env.MATRIOSHKA_BRAIN_HOME = tempDir;

    // Set up approval DB in memory
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    const { initApprovalDbFrom } = await import('../src/approval/db.js');
    initApprovalDbFrom(db);
  });

  afterEach(async () => {
    const { closeApprovalDb } = await import('../src/approval/db.js');
    closeApprovalDb();

    if (originalEnv !== undefined) {
      process.env.MATRIOSHKA_BRAIN_HOME = originalEnv;
    } else {
      delete process.env.MATRIOSHKA_BRAIN_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('propose → approve → file updated on disk', async () => {
    const { readSoulFile, writeSoulFile, ensureBootstrapFiles } = await import('../src/soul/files.js');
    const { unifiedDiff } = await import('../src/soul/diff.js');
    const { SOUL_FILE_MAP } = await import('../src/soul/types.js');
    const { createApproval, getApproval, updateApprovalStatus } = await import('../src/approval/db.js');

    // Step 1: Ensure bootstrap files exist
    ensureBootstrapFiles();

    // Step 2: Read current content
    const current = readSoulFile('soul');
    expect(current.content).toContain('# Soul');

    // Step 3: Propose an update
    const newContent = '# Soul\n\n## Core Essence\nI am now evolved.\n';
    const diff = unifiedDiff(current.content, newContent, {
      fromLabel: `current/${SOUL_FILE_MAP.soul}`,
      toLabel: `proposed/${SOUL_FILE_MAP.soul}`,
    });
    expect(diff).not.toBe('');

    const approval = createApproval(db, 'soul_update', {
      file: 'soul',
      filename: SOUL_FILE_MAP.soul,
      newContent,
      reason: 'Testing evolution',
      diff,
    });
    expect(approval.status).toBe('pending');

    // Step 4: Approve the proposal
    const payload = approval.payload as { file: 'soul' | 'agents'; newContent: string };
    writeSoulFile(payload.file, payload.newContent);
    updateApprovalStatus(db, approval.id, 'approved');

    // Step 5: Verify file was updated
    const updated = readSoulFile('soul');
    expect(updated.content).toBe(newContent);

    const fetchedApproval = getApproval(db, approval.id);
    expect(fetchedApproval!.status).toBe('approved');
  });

  it('propose → deny → file unchanged', async () => {
    const { readSoulFile, ensureBootstrapFiles } = await import('../src/soul/files.js');
    const { createApproval, getApproval, updateApprovalStatus } = await import('../src/approval/db.js');

    ensureBootstrapFiles();
    const original = readSoulFile('soul');

    const approval = createApproval(db, 'soul_update', {
      file: 'soul',
      newContent: '# Denied Change\n',
      reason: 'Testing denial',
    });

    updateApprovalStatus(db, approval.id, 'denied');

    // File should be unchanged
    const afterDeny = readSoulFile('soul');
    expect(afterDeny.content).toBe(original.content);

    const fetchedApproval = getApproval(db, approval.id);
    expect(fetchedApproval!.status).toBe('denied');
  });
});
