// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Governed Command Execution Tool (BLD-022)
//
// AUTONOMY-02: the ONLY sanctioned way a mission plan executes a test /
// build / verification command. It is NOT a raw shell escape hatch:
//
//   - The model chooses from a FIXED, explicit command catalog (allowlist).
//     It can NEVER supply an executable or a free-form shell string.
//   - Each catalog entry maps to a deterministic argv built from a
//     pre-audited template. Any per-command free argument (a workspace
//     relative path) is schema-validated and path-jailed inside the
//     operator-held mission workspace.
//   - The working directory is ALWAYS the workspace root (never
//     model-settable); resolveInside() rejects traversal and symlink escapes.
//   - Every invocation is bounded (timeout + output cap), rate-limited,
//     cancelled via the tool runtime AbortSignal, and audited through the
//     same governed ToolRegistry security chain as workspace_read/write.
//   - There is NO free-form shell string. POSIX spawns the fixed argv
//     directly (shell:false). Windows batch executables (npm/npx) cannot be
//     spawned without a shell, so they are invoked through cmd.exe with an
//     explicitly built, fully quoted command line derived ONLY from the
//     audited catalog argv + the jailed path — the model never supplies a
//     shell string, and any argv element containing a quote is REJECTED.
//   - A non-zero exit / timeout / malformed request throws a typed
//     ExecutorCommandError whose message carries the structured evidence
//     (exitCode, stdout, stderr, timedOut, durationMs). The governed
//     ToolRegistry maps that to ToolResult{ ok:false } so deterministic
//     command-kind verification sees a REAL failure — never a model
//     self-report and never a swallowed subprocess exit.
// ──────────────────────────────────────────────────────────────────

import * as path from 'node:path';
import { spawn } from 'node:child_process';
import type { ToolDefinition } from '@vedmoulya/services/ai/runtime/ToolRuntime';
import type { WorkspaceRootBinding } from './WorkspaceTools.js';

/** The governed command tool name. Registered ONLY via the governed registry. */
export const COMMAND_EXECUTION_TOOL = 'run_command';

/** Bounded default output capture (bytes per stream). */
export const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;

/** Default execution timeout (ms) — bounded. */
export const DEFAULT_COMMAND_TIMEOUT_MS = 15_000;

/**
 * The fixed, pre-audited command catalog the model may select from.
 * `fileArgName` marks the ONE optional workspace-relative argument a chosen
 * entry accepts; every other argv element is fixed and never model-controlled.
 */
export interface CommandSpec {
  id: string;
  description: string;
  argv: string[];
  fileArgName?: string;
  expect: 'ok';
}

export const COMMAND_CATALOG: readonly CommandSpec[] = [
  {
    id: 'npm_test',
    description: 'Run the workspace test suite (npm test) in the mission workspace.',
    argv: ['npm', 'test'],
    expect: 'ok',
  },
  {
    id: 'npm_test_file',
    description:
      'Run a single named test file (npm test -- <relative-test-file>) in the mission workspace.',
    argv: ['npm', 'test', '--'],
    fileArgName: 'testFile',
    expect: 'ok',
  },
  {
    id: 'npm_lint',
    description: 'Run the workspace linter (npm run lint) in the mission workspace.',
    argv: ['npm', 'run', 'lint'],
    expect: 'ok',
  },
  {
    id: 'npm_build',
    description: 'Run the workspace production build (npm run build) in the mission workspace.',
    argv: ['npm', 'run', 'build'],
    expect: 'ok',
  },
  {
    id: 'node_run',
    description: 'Run a single Node.js file (node <relative-file>) in the mission workspace.',
    argv: ['node'],
    fileArgName: 'scriptPath',
    expect: 'ok',
  },
];

const CATALOG_BY_ID: ReadonlyMap<string, CommandSpec> = new Map(
  COMMAND_CATALOG.map((spec) => [spec.id, spec]),
);

/** Structured, deterministic command result returned to the agent. */
export interface CommandExecutionResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
  success: boolean;
}

/** Typed failure — the governed ToolRegistry maps this to ToolResult.ok === false. */
export class ExecutorCommandError extends Error {
  readonly code = 'COMMAND_EXECUTION_FAILED';
  readonly result: CommandExecutionResult;

  constructor(result: CommandExecutionResult) {
    super(`command execution failed: ${JSON.stringify(result)}`);
    this.name = 'ExecutorCommandError';
    this.result = result;
  }
}

export interface CommandExecutionToolOptions {
  maxOutputBytes?: number;
  timeoutMs?: number;
  /** Explicit catalogue ids this runtime permits (defaults to the full catalog). */
  allow?: string[];
  /** Working-directory jail: a mission path relative to the workspace root. */
  cwd?: string;
}

/** Windows batch-script executables that require a shell to be spawned. */
const WIN32_BATCH_EXECUTABLES: ReadonlySet<string> = new Set(['npm', 'npx', 'pnpm', 'yarn']);

/** Rejects shell metacharacters in a controlled command line (fail closed). */
function assertSafeWin32Arg(arg: string): string {
  if (arg.includes('"') || /[\r\n]/.test(arg)) {
    throw new Error('command argument contains a forbidden quote/newline character — rejected');
  }
  return arg;
}

/**
 * Spawn the governed child. POSIX: the fixed argv directly (shell:false).
 * Windows: npm/npx are batch scripts that Node cannot spawn without a shell
 * (EINVAL since the CVE-2024-27980 hardening), so the audited argv is
 * re-joined into ONE explicitly quoted command line and handed to cmd.exe
 * with verbatim arguments. The model never supplies a shell string; every
 * element originates from the fixed catalog or the path jail.
 */
function spawnGovernedChild(
  file: string,
  rest: string[],
  options: RunGovernedProcessOptions,
): ReturnType<typeof spawn> {
  const stdio: Array<'ignore' | 'pipe'> = ['ignore', 'pipe', 'pipe'];
  if (process.platform === 'win32') {
    const base = path
      .basename(file)
      .replace(/\.cmd$/i, '')
      .toLowerCase();
    if (WIN32_BATCH_EXECUTABLES.has(base)) {
      const line = [file, ...rest].map(assertSafeWin32Arg).join(' ');
      const comspec = process.env.comspec ?? 'cmd.exe';
      return spawn(comspec, ['/d', '/s', '/c', `"${line}"`], {
        cwd: options.cwd,
        windowsVerbatimArguments: true,
        env: { ...process.env, CI: '1' },
        stdio,
      });
    }
  }
  return spawn(file, rest, {
    cwd: options.cwd,
    shell: false,
    env: { ...process.env, CI: '1' },
    stdio,
  });
}

interface RunGovernedProcessOptions {
  argv: string[];
  cwd: string;
  timeoutMs: number;
  maxOutputBytes: number;
  signal: AbortSignal;
}

/**
 * Run ONE governed process with a bounded timeout and a bounded, truncated
 * stdout/stderr capture. Returns a deterministic structured result; the
 * caller decides whether a non-zero exit / timeout throws ExecutorCommandError.
 * No shell is used and the child is killed on timeout or cancellation.
 */
export async function runGovernedProcess(
  options: RunGovernedProcessOptions,
): Promise<CommandExecutionResult> {
  const startedAt = Date.now();
  // Remove timedOut flag; timeout will set exitCode to 124 directly
  // const timedOut = false; // removed

  let exitCode = 1;
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  const stdoutCap = { size: 0, truncated: false };
  const stderrCap = { size: 0, truncated: false };

  const append = (
    chunk: Buffer,
    target: Buffer[],
    cap: { size: number; truncated: boolean },
  ): void => {
    const remaining = options.maxOutputBytes - cap.size;
    if (remaining <= 0) {
      cap.truncated = true;
      return;
    }
    const slice = chunk.subarray(0, Math.min(remaining, chunk.length));
    target.push(slice);
    cap.size += slice.length;
    if (chunk.length > remaining) {
      cap.truncated = true;
    }
  };

  const [file, ...rest] = options.argv;
  if (file === undefined || file.trim() === '') {
    throw new Error('command argv must declare an executable');
  }

  const child = spawnGovernedChild(file, rest, options);

  let settled: (() => void) | undefined;
  const exited = new Promise<void>((resolve) => {
    settled = resolve;
  });

  child.stdout?.on('data', (chunk: Buffer): void => {
    append(chunk, stdout, stdoutCap);
  });

  child.stderr?.on('data', (chunk: Buffer): void => {
    append(chunk, stderr, stderrCap);
  });
  child.on('error', (_: Error): void => {
    // Treat spawn error as a generic failure with exitCode 1
    exitCode = 1;
    settled?.();
  });
  child.on('exit', (code: number | null): void => {
    exitCode = code ?? 1;
    settled?.();
  });

  const killChild = (): void => {
    // Indicate timeout via exitCode 124
    exitCode = 124;
    child.kill();
  };
  if (options.signal.aborted) {
    killChild();
  } else {
    options.signal.addEventListener('abort', killChild, { once: true });
  }
  const timer = setTimeout(killChild, options.timeoutMs);

  await exited;
  clearTimeout(timer);
  options.signal.removeEventListener('abort', killChild);

  const outBuf = Buffer.concat(stdout);
  const errBuf = Buffer.concat(stderr);
  // Determine final exit code (fallback to 1 if not set)
  const finalExitCode: number = exitCode;
  // Determine success based on final exit code
  const success = finalExitCode === 0;
  // Determine timedOut flag from final exit code
  const timedOut = finalExitCode === 124;
  return {
    command: options.argv.join(' '),
    exitCode: finalExitCode,
    stdout: outBuf.toString('utf8', 0, Math.min(stdoutCap.size, outBuf.length)),
    stderr: errBuf.toString('utf8', 0, Math.min(stderrCap.size, errBuf.length)),
    timedOut,
    durationMs: Date.now() - startedAt,
    success,
  };
}

/**
 * Resolve a catalog id + optional jailed relative file argument into a
 * deterministic argv + cwd. Throws (fail-closed) on unknown ids, unexpected
 * free arguments, or any path that escapes the operator-held workspace.
 */
export function resolveCommandSpec(
  id: string,
  binding: WorkspaceRootBinding,
  args: Record<string, unknown>,
): { argv: string[]; cwd: string } {
  const spec = CATALOG_BY_ID.get(id);
  if (!spec) {
    throw new Error(`unknown command id "${id}" — not on the governed allowlist`);
  }
  const root = binding.getRoot();
  if (!root) {
    throw new Error('no workspace root is authorized for this runtime');
  }
  let argv = [...spec.argv];
  if (spec.fileArgName) {
    const raw = args[spec.fileArgName];
    if (raw !== undefined) {
      if (typeof raw !== 'string' || raw.length === 0 || raw.length > 300) {
        throw new Error(`command argument "${spec.fileArgName}" must be a non-empty string`);
      }
      // Path-jail the single allowed free argument (throws on escape).
      argv = [...argv, binding.resolveInside(raw)];
    }
  }
  return { argv, cwd: root };
}

/**
 * Create the governed command tool bound to an operator-held workspace root.
 * The model can never pass an executable or a shell string — only a catalog
 * id and (for entries that declare one) a single jailed relative path.
 * A non-zero exit or a timeout throws ExecutorCommandError so the governed
 * ToolRegistry reports ok:false with the structured evidence attached.
 */
export function createCommandExecutionTool(
  binding: WorkspaceRootBinding,
  options: CommandExecutionToolOptions = {},
): ToolDefinition<Record<string, unknown>, CommandExecutionResult> {
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const allowed: ReadonlySet<string> = new Set(options.allow ?? COMMAND_CATALOG.map((s) => s.id));
  const timeoutMs = options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;

  return {
    name: COMMAND_EXECUTION_TOOL,
    description:
      'Runs one pre-audited, allowlisted command family (npm test / npm run lint / npm run build / node <file>) inside the authorized mission workspace and returns a deterministic structured result. Fails closed on unknown commands, escape paths, or non-zero exits.',
    capability: 'productivity',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          required: true,
          enum: COMMAND_CATALOG.map((spec) => spec.id),
          description:
            'The allowlisted command catalog id. The agent never supplies an executable or a shell string.',
        },
        fileArg: {
          type: 'string',
          required: false,
          maxLength: 300,
          description:
            'Optional workspace-relative file argument (only valid for catalog entries that declare one, e.g. npm_test_file / node_run).',
        },
      },
      additionalProperties: false,
    },
    timeoutMs,
    rateLimit: { max: 60, windowMs: 60_000 },
    handler: async (args, ctx): Promise<CommandExecutionResult> => {
      const id = args.command;
      if (typeof id !== 'string' || !allowed.has(id)) {
        throw new Error(`command "${String(id)}" is not on the governed allowlist`);
      }
      const spec = CATALOG_BY_ID.get(id);
      const fileArgInput: Record<string, unknown> = {};
      if (spec?.fileArgName) {
        const rawFileArg = args.fileArg;
        if (rawFileArg !== undefined) {
          // Pass the single allowed free argument under the catalog entry's
          // declared arg name (e.g. testFile / scriptPath).
          fileArgInput[spec.fileArgName] = rawFileArg;
        }
      }
      let argv: string[];
      let cwd: string;
      try {
        const resolved = resolveCommandSpec(id, binding, fileArgInput);
        argv = resolved.argv;
        cwd = resolved.cwd;
      } catch (error) {
        // Fail closed: a malformed/escape-path request never spawns a process.
        throw new Error(
          `command request rejected: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const result = await runGovernedProcess({
        argv,
        cwd,
        timeoutMs,
        maxOutputBytes,
        signal: ctx.signal,
      });
      if (result.timedOut || result.exitCode !== 0) {
        throw new ExecutorCommandError(result);
      }
      return result;
    },
  };
}
