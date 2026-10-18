// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — bounded goal-pattern regression (S14 CodeQL remediation)
//
// js/polynomial-redos (CWE-1333): WORKSPACE_FILE_PATTERN used an UNBOUNDED
// `[\s\S]*` gap between the verb and the "workspace file <name>" marker, so a
// goal that repeats a verb made every occurrence re-scan the rest of the goal.
// The gap is now bounded; these tests pin both the behaviour (the target is
// still extracted) and the linear cost (an adversarial goal finishes fast).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { extractWorkspaceFileTarget } from '../adapters/WorkspaceDevTemplate.js';

describe('extractWorkspaceFileTarget — bounded scan', () => {
  it('still extracts the workspace file target from a normal goal', () => {
    const target = extractWorkspaceFileTarget(
      'Create the workspace file draft.md with content: hello world',
    );
    expect(target?.relativePath).toBe('draft.md');
    expect(target?.content).toContain('hello world');
  });

  it('never derives an escaping path from a traversal or absolute goal', () => {
    for (const goal of [
      'Create the workspace file ../escape.md',
      'Create the workspace file C:\\tmp\\x.md',
      'Create the workspace file /etc/passwd',
    ]) {
      const target = extractWorkspaceFileTarget(goal);
      if (target === undefined) continue;
      expect(target.relativePath).not.toContain('..');
      expect(target.relativePath).not.toContain('\\');
      expect(target.relativePath.startsWith('/')).toBe(false);
      expect(target.relativePath.startsWith(':')).toBe(false);
    }
  });

  it('stays linear on a goal that repeats the verb (polynomial-redos regression)', () => {
    // 20k repetitions of "create " used to force a quadratic re-scan each time.
    const adversarial = `${'create '.repeat(20_000)}summarize the release notes`;
    const started = performance.now();
    const target = extractWorkspaceFileTarget(adversarial);
    expect(performance.now() - started).toBeLessThan(2_000);
    // No marker inside the bounded window → no invented target.
    expect(target).toBeUndefined();
  });

  it('finds the marker when it sits inside the bounded window', () => {
    const goal = `Create ${'a'.repeat(500)} the workspace file report.md`;
    const target = extractWorkspaceFileTarget(goal);
    expect(target?.relativePath).toBe('report.md');
  });
});
