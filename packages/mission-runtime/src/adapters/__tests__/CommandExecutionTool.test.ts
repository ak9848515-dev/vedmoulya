// VedMoulya — Mission Runtime: Command Execution Tool Tests (AUTONOMY-03)
// BLD-022 — Tests for governed run_command tool: security, execution,
// structured results, integration with AgentExecutionEngine.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  createCommandExecutionTool,
  COMMAND_EXECUTION_TOOL,
  COMMAND_CATALOG,
  type CommandExecutionToolOptions,
} from '../CommandExecutionTool.js';
import { WorkspaceRootBinding } from '../WorkspaceTools.js';

const tempRoots: string[] = [];
function newWorkspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vedmoulya-command-test-'));
  tempRoots.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempRoots) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors on Windows due to file locking
    }
  }
});

function createTestTool(workspace: string, options?: CommandExecutionToolOptions) {
  const binding = new WorkspaceRootBinding();
  binding.setRoot(workspace);
  return createCommandExecutionTool(binding, options);
}

// Create a controller for tests that need to abort
function createAbortController(): { signal: AbortSignal; abort: () => void } {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    abort: () => controller.abort(),
  };
}

describe('AUTONOMY-03: Command Execution Tool', () => {
  describe('TEST 1 — BASIC COMMAND EXECUTION', () => {
    it('executes a harmless deterministic command and returns structured result', async () => {
      const workspace = newWorkspace();
      const scriptPath = path.join(workspace, 'hello.js');
      writeFileSync(scriptPath, 'console.log("hello");');

      const tool = createTestTool(workspace);
      const { signal } = createAbortController();

      const result = await tool.handler({ command: 'node_run', fileArg: 'hello.js' }, { signal });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('hello');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('TEST 2 — NON-ZERO EXIT', () => {
    it('returns structured failure for a command that exits non-zero', async () => {
      const workspace = newWorkspace();
      const scriptPath = path.join(workspace, 'fail.js');
      writeFileSync(scriptPath, 'process.exit(1);');

      const tool = createTestTool(workspace);
      const { signal } = createAbortController();

      await expect(
        tool.handler({ command: 'node_run', fileArg: 'fail.js' }, { signal }),
      ).rejects.toThrow();
    });
  });

  describe('TEST 3 — TIMEOUT ENFORCEMENT', () => {
    it('enforces timeout on long-running commands', async () => {
      const workspace = newWorkspace();
      const binding = new WorkspaceRootBinding();
      binding.setRoot(workspace);

      const tool = createCommandExecutionTool(binding, {
        timeoutMs: 100,
      });

      const scriptPath = path.join(workspace, 'slow.js');
      writeFileSync(scriptPath, 'const start = Date.now(); while (Date.now() - start < 500) {}');

      const { signal } = createAbortController();
      await expect(
        tool.handler({ command: 'node_run', fileArg: 'slow.js' }, { signal }),
      ).rejects.toThrow();
    });
  });

  describe('TEST 4 — WORKSPACE ESCAPE PREVENTION', () => {
    it('rejects attempts to access paths outside the workspace', async () => {
      const workspace = newWorkspace();
      const tool = createTestTool(workspace);
      const { signal } = createAbortController();

      // Using a relative path that escapes the workspace
      await expect(
        tool.handler({ command: 'node_run', fileArg: '../..' }, { signal }),
      ).rejects.toThrow(/path escapes|absolute paths are not permitted/);
    });

    it('rejects absolute paths', async () => {
      const workspace = newWorkspace();
      const tool = createTestTool(workspace);
      const { signal } = createAbortController();

      await expect(
        tool.handler({ command: 'node_run', fileArg: '/etc/passwd' }, { signal }),
      ).rejects.toThrow(/absolute paths are not permitted/);
    });
  });

  describe('TEST 5 — TOOL AUTHORIZATION', () => {
    it('rejects commands not in the allowlist', async () => {
      const workspace = newWorkspace();
      const tool = createTestTool(workspace);
      const { signal } = createAbortController();

      await expect(tool.handler({ command: 'unknown_command' }, { signal })).rejects.toThrow(
        /not on the governed allowlist/,
      );
    });

    it('respects custom allowlist', async () => {
      const workspace = newWorkspace();
      const binding = new WorkspaceRootBinding();
      binding.setRoot(workspace);

      const tool = createCommandExecutionTool(binding, {
        allow: ['node_run'],
      });

      const { signal } = createAbortController();
      await expect(tool.handler({ command: 'npm_test' }, { signal })).rejects.toThrow(
        /not on the governed allowlist/,
      );
    });
  });

  describe('TEST 6 — OUTPUT BOUNDING', () => {
    it('bounds stdout/stderr output', async () => {
      const workspace = newWorkspace();
      const binding = new WorkspaceRootBinding();
      binding.setRoot(workspace);

      const tool = createCommandExecutionTool(binding, {
        maxOutputBytes: 100,
      });

      const scriptPath = path.join(workspace, 'loud.js');
      writeFileSync(scriptPath, 'console.log("x".repeat(1000));');

      const { signal } = createAbortController();
      const result = await tool.handler({ command: 'node_run', fileArg: 'loud.js' }, { signal });

      expect(result.success).toBe(true);
      expect(result.stdout.length).toBeLessThanOrEqual(100);
    });
  });

  describe('TEST 7 — COMMAND CATALOG INTEGRITY', () => {
    it('has pre-audited command catalog with fixed argv', () => {
      expect(COMMAND_CATALOG.length).toBeGreaterThan(0);

      for (const spec of COMMAND_CATALOG) {
        expect(spec.id).toBeDefined();
        expect(spec.argv).toBeInstanceOf(Array);
        expect(spec.argv.length).toBeGreaterThan(0);

        for (const arg of spec.argv) {
          expect(arg).not.toContain('${');
          expect(arg).not.toContain('`');
        }
      }
    });
  });
});
