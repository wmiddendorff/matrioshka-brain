/**
 * Unified Diff Generator
 *
 * Simple LCS-based unified diff for comparing soul file changes.
 * No external dependencies needed - the files are small markdown.
 */

export interface DiffOptions {
  context?: number;
  fromLabel?: string;
  toLabel?: string;
}

interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

/**
 * Generate a unified diff between two strings.
 * Returns empty string if the strings are identical.
 */
export function unifiedDiff(oldText: string, newText: string, options: DiffOptions = {}): string {
  const { context = 3, fromLabel = 'a', toLabel = 'b' } = options;

  if (oldText === newText) return '';

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // Compute LCS table
  const lcs = computeLCS(oldLines, newLines);

  // Build edit script from LCS
  const edits = buildEdits(oldLines, newLines, lcs);

  // Group edits into hunks with context
  const hunks = groupHunks(edits, oldLines, newLines, context);

  if (hunks.length === 0) return '';

  // Format output
  const output: string[] = [];
  output.push(`--- ${fromLabel}`);
  output.push(`+++ ${toLabel}`);

  for (const hunk of hunks) {
    output.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`);
    output.push(...hunk.lines);
  }

  return output.join('\n');
}

/**
 * Compute LCS (Longest Common Subsequence) table.
 */
function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const table: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  return table;
}

type Edit = { type: 'equal'; oldIdx: number; newIdx: number }
  | { type: 'delete'; oldIdx: number }
  | { type: 'insert'; newIdx: number };

/**
 * Build an edit script from the LCS table.
 */
function buildEdits(oldLines: string[], newLines: string[], lcs: number[][]): Edit[] {
  const edits: Edit[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  // Trace back through the LCS table
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      edits.unshift({ type: 'equal', oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      edits.unshift({ type: 'insert', newIdx: j - 1 });
      j--;
    } else {
      edits.unshift({ type: 'delete', oldIdx: i - 1 });
      i--;
    }
  }

  return edits;
}

/**
 * Group edits into unified diff hunks with surrounding context lines.
 */
function groupHunks(
  edits: Edit[],
  oldLines: string[],
  newLines: string[],
  context: number
): DiffHunk[] {
  // Find ranges of changes (non-equal edits)
  const changeIndices: number[] = [];
  for (let i = 0; i < edits.length; i++) {
    if (edits[i].type !== 'equal') {
      changeIndices.push(i);
    }
  }

  if (changeIndices.length === 0) return [];

  // Group nearby changes into hunks
  const groups: number[][] = [];
  let currentGroup = [changeIndices[0]];

  for (let i = 1; i < changeIndices.length; i++) {
    // If the gap between changes is small enough, merge into same hunk
    const gap = changeIndices[i] - changeIndices[i - 1] - 1;
    if (gap <= context * 2) {
      currentGroup.push(changeIndices[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [changeIndices[i]];
    }
  }
  groups.push(currentGroup);

  // Build hunks with context
  const hunks: DiffHunk[] = [];

  for (const group of groups) {
    const firstChange = group[0];
    const lastChange = group[group.length - 1];

    const start = Math.max(0, firstChange - context);
    const end = Math.min(edits.length - 1, lastChange + context);

    const lines: string[] = [];
    let oldStart = 0;
    let newStart = 0;
    let oldCount = 0;
    let newCount = 0;
    let startSet = false;

    for (let i = start; i <= end; i++) {
      const edit = edits[i];
      if (edit.type === 'equal') {
        if (!startSet) {
          oldStart = edit.oldIdx + 1;
          newStart = edit.newIdx + 1;
          startSet = true;
        }
        lines.push(` ${oldLines[edit.oldIdx]}`);
        oldCount++;
        newCount++;
      } else if (edit.type === 'delete') {
        if (!startSet) {
          oldStart = edit.oldIdx + 1;
          newStart = (i + 1 < edits.length && edits[i + 1].type === 'insert')
            ? (edits[i + 1] as { type: 'insert'; newIdx: number }).newIdx + 1
            : 1;
          startSet = true;
        }
        lines.push(`-${oldLines[edit.oldIdx]}`);
        oldCount++;
      } else if (edit.type === 'insert') {
        if (!startSet) {
          oldStart = 1;
          newStart = edit.newIdx + 1;
          startSet = true;
        }
        lines.push(`+${newLines[edit.newIdx]}`);
        newCount++;
      }
    }

    hunks.push({ oldStart, oldCount, newStart, newCount, lines });
  }

  return hunks;
}
