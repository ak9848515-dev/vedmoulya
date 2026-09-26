// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local Workspace — service (the domain API)
//
// The single object the Local Agent holds. It owns the in-memory grants:
//
//   authorize(absoluteRoot) → opaque workspaceId  (root NEVER returned)
//   list / get / entries / readFile / context / revoke
//
// Grants live in memory ONLY: an agent restart destroys every grant, so a
// workspace must be re-authorized by the user. Nothing is written to disk and
// the browser can never widen a grant (it only ever supplies a workspaceId).
//
// Every method is total (returns `WorkspaceResult`, never throws) and bounded by
// the workspace limits, including a per-operation timeout.
// ─────────────────────────────────────────────────────────────────────────────

import { WorkspaceAuthorizer, displayPathForRoot, labelForRoot } from './authorizer.js';
import { WorkspaceContextAssembler } from './context-assembler.js';
import type { WorkspaceFileSystem, WorkspaceHost } from './filesystem.js';
import { HARD_WORKSPACE_LIMITS, type WorkspaceError } from './types.js';
import { WorkspacePathResolver } from './path-resolver.js';
import { WorkspaceReader, type WorkspaceTarget } from './reader.js';
import { fail, ok } from './result.js';
import {
  DEFAULT_WORKSPACE_LIMITS,
  WORKSPACE_CAPABILITIES,
  type WorkspaceCapabilities,
  type WorkspaceContext,
  type WorkspaceContextOptions,
  type WorkspaceFileContent,
  type WorkspaceLimits,
  type WorkspaceListOptions,
  type WorkspaceListing,
  type WorkspaceReadOptions,
  type WorkspaceResult,
  type WorkspaceSummary,
} from './types.js';

export interface LocalWorkspaceServiceOptions {
  filesystem: WorkspaceFileSystem;
  host: WorkspaceHost;
  /** Operator-approved roots (VEDMOULYA_WORKSPACE_ROOTS). */
  allowedRoots?: readonly string[];
  deniedRoots?: readonly string[];
  limits?: Partial<WorkspaceLimits>;
  now?: () => Date;
  /** Injectable id source (tests). Defaults to a random UUID. */
  randomId?: () => string;
  /** Injectable label formatter (tests / hardening). Defaults to the root name. */
  labelFor?: (rootReal: string) => string;
}

interface WorkspaceGrant {
  id: string;
  label: string;
  displayPath: string;
  root: string;
  rootReal: string;
  authorizedAt: string;
  limits: WorkspaceLimits;
}

/**
 * A single-line, length-bounded message. Defensive against a pathological path
 * or OS error bubbling up: control characters are stripped and the result is
 * truncated, so a message can never become an exfiltration channel.
 */
const MAX_ERROR_MESSAGE = 300;
function safeMessage(value: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return cleaned.length > MAX_ERROR_MESSAGE ? `${cleaned.slice(0, MAX_ERROR_MESSAGE)}…` : cleaned;
}

/**
 * Belt-and-braces: the last gate before a failure crosses the domain boundary.
 * Guarantees a non-empty, bounded message and an optional bounded `path`.
 */
function sanitizeError(error: WorkspaceError): WorkspaceError {
  const clean: WorkspaceError = {
    kind: error.kind,
    message:
      error.message.trim() === '' ? 'The workspace operation failed.' : safeMessage(error.message),
  };
  if (error.path !== undefined) clean.path = safeMessage(error.path);
  return clean;
}

function unwrap<T>(result: WorkspaceResult<T>): WorkspaceResult<T> {
  return result.ok ? result : { ok: false, error: sanitizeError(result.error) };
}

/** Clamp a configured limit into [1, hard cap]; over-cap configuration is capped. */
function bounded(value: number, hardCap: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(Math.floor(value), hardCap);
}

/** Race an operation against its timeout budget, never throwing. */
async function withTimeout<T>(
  work: Promise<WorkspaceResult<T>>,
  ms: number,
): Promise<WorkspaceResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<WorkspaceResult<T>>((resolve) => {
    timer = setTimeout(() => {
      resolve(fail('LIMIT_EXCEEDED', 'The workspace operation timed out.'));
    }, ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export class LocalWorkspaceService {
  private readonly host: WorkspaceHost;
  private readonly authorizer: WorkspaceAuthorizer;
  private readonly reader: WorkspaceReader;
  private readonly assembler: WorkspaceContextAssembler;
  private readonly now: () => Date;
  private readonly randomId: () => string;
  private readonly labelFor: (rootReal: string) => string;
  private readonly limits: WorkspaceLimits;
  private readonly grants = new Map<string, WorkspaceGrant>();
  private readonly revoked = new Set<string>();

  constructor(options: LocalWorkspaceServiceOptions) {
    this.host = options.host;
    this.now = options.now ?? ((): Date => new Date());
    const randomId = options.randomId;
    this.randomId = randomId ?? ((): string => this.newRandomId());
    this.labelFor = options.labelFor ?? ((rootReal: string): string => labelForRoot(rootReal));
    this.limits = { ...DEFAULT_WORKSPACE_LIMITS, ...options.limits };
    const caseInsensitive = options.host.platform === 'win32';
    this.authorizer = new WorkspaceAuthorizer({
      filesystem: options.filesystem,
      host: this.host,
      ...(options.allowedRoots !== undefined ? { allowedRoots: options.allowedRoots } : {}),
      ...(options.deniedRoots !== undefined ? { deniedRoots: options.deniedRoots } : {}),
    });
    const resolver = new WorkspacePathResolver(options.filesystem, {
      separator: options.host.separator,
      caseInsensitive,
    });
    this.reader = new WorkspaceReader(options.filesystem, resolver);
    this.assembler = new WorkspaceContextAssembler({
      fs: options.filesystem,
      resolver,
      reader: this.reader,
      now: this.now,
    });
  }

  /**
   * A random, opaque id that is never derived from the authorized path.
   *
   * `globalThis.crypto` is read defensively: the type graph (lib ES2022 / Node
   * types) guarantees it, but an older or embedded runtime may still lack it, so
   * the bundled fallback stays reachable rather than dead code.
   */
  private newRandomId(): string {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for hosts without WebCrypto
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    return `ws-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }

  /** The workspace capability descriptor (read-only by construction). */
  capabilities(): WorkspaceCapabilities {
    return { ...WORKSPACE_CAPABILITIES };
  }

  /**
   * Limits clamped into their valid range for newly authorized workspaces.
   * Configuration can never raise a limit above a hard cap.
   */
  limitsSnapshot(): WorkspaceLimits {
    return this.applyLimits({ ...DEFAULT_WORKSPACE_LIMITS, ...this.limits });
  }

  private applyLimits(limits: WorkspaceLimits): WorkspaceLimits {
    return {
      maxFileBytes: bounded(
        limits.maxFileBytes,
        HARD_WORKSPACE_LIMITS.maxFileBytes,
        DEFAULT_WORKSPACE_LIMITS.maxFileBytes,
      ),
      maxListEntries: bounded(
        limits.maxListEntries,
        HARD_WORKSPACE_LIMITS.maxListEntries,
        DEFAULT_WORKSPACE_LIMITS.maxListEntries,
      ),
      maxDepth: bounded(
        limits.maxDepth,
        HARD_WORKSPACE_LIMITS.maxDepth,
        DEFAULT_WORKSPACE_LIMITS.maxDepth,
      ),
      maxContextFiles: bounded(
        limits.maxContextFiles,
        limits.maxContextFiles,
        DEFAULT_WORKSPACE_LIMITS.maxContextFiles,
      ),
      maxContextBytes: bounded(
        limits.maxContextBytes,
        limits.maxContextBytes,
        DEFAULT_WORKSPACE_LIMITS.maxContextBytes,
      ),
      timeoutMs: bounded(limits.timeoutMs, limits.timeoutMs, DEFAULT_WORKSPACE_LIMITS.timeoutMs),
    };
  }

  /** Explicitly authorize an absolute root. The root is never returned. */
  async authorize(root: unknown): Promise<WorkspaceResult<WorkspaceSummary>> {
    const authorized = await this.authorizer.authorizeRoot(root);
    if (!authorized.ok) return unwrap(authorized);
    const grant: WorkspaceGrant = {
      id: this.randomId(),
      label: this.labelFor(authorized.value.rootReal),
      displayPath: displayPathForRoot(
        authorized.value.rootReal,
        this.host.homedir,
        this.host.platform === 'win32',
      ),
      root: authorized.value.rootReal,
      rootReal: authorized.value.rootReal,
      authorizedAt: this.now().toISOString(),
      limits: this.limitsSnapshot(),
    };
    this.grants.set(grant.id, grant);
    this.revoked.delete(grant.id);
    return ok(this.summary(grant));
  }

  /** All live grants (never the roots). */
  list(): WorkspaceSummary[] {
    return [...this.grants.values()].map((grant) => this.summary(grant));
  }

  /** One grant summary. */
  get(id: unknown): WorkspaceResult<WorkspaceSummary> {
    const found = this.requireGrant(id);
    return found.ok ? ok(this.summary(found.value)) : found;
  }

  /** Revoke a grant. Its id is remembered so later access is honest. */
  revoke(id: unknown): WorkspaceResult<{ id: string }> {
    if (typeof id !== 'string' || id === '') {
      return fail('INVALID_REQUEST', 'A workspace id is required.');
    }
    if (!this.grants.has(id)) {
      return this.revoked.has(id)
        ? fail('WORKSPACE_REVOKED', 'That workspace has been revoked.')
        : fail('WORKSPACE_NOT_AUTHORIZED', 'That workspace is not authorized on this computer.');
    }
    this.grants.delete(id);
    this.revoked.add(id);
    return ok({ id });
  }

  entries(
    id: unknown,
    options: WorkspaceListOptions = {},
  ): Promise<WorkspaceResult<WorkspaceListing>> {
    const found = this.requireGrant(id);
    if (!found.ok) return Promise.resolve(found);
    const target = this.target(found.value);
    return this.guard(this.reader.list(target, options), found.value.limits.timeoutMs);
  }

  readFile(
    id: unknown,
    options: WorkspaceReadOptions,
  ): Promise<WorkspaceResult<WorkspaceFileContent>> {
    const found = this.requireGrant(id);
    if (!found.ok) return Promise.resolve(found);
    const target = this.target(found.value);
    return this.guard(this.reader.read(target, options), found.value.limits.timeoutMs);
  }

  context(
    id: unknown,
    options: WorkspaceContextOptions = {},
  ): Promise<WorkspaceResult<WorkspaceContext>> {
    const found = this.requireGrant(id);
    if (!found.ok) return Promise.resolve(found);
    const target = this.target(found.value);
    this.assembler.label = found.value.label;
    return this.guard(this.assembler.assemble(target, options), found.value.limits.timeoutMs);
  }

  /** Run a bounded operation, timing it out and sanitizing any failure. */
  private async guard<T>(
    work: Promise<WorkspaceResult<T>>,
    timeoutMs: number,
  ): Promise<WorkspaceResult<T>> {
    return unwrap(await withTimeout(work, timeoutMs));
  }

  private requireGrant(id: unknown): WorkspaceResult<WorkspaceGrant> {
    if (typeof id !== 'string' || id === '') {
      return fail('INVALID_REQUEST', 'A workspace id is required.');
    }
    const grant = this.grants.get(id);
    if (grant !== undefined) return ok(grant);
    if (this.revoked.has(id)) {
      return fail('WORKSPACE_REVOKED', 'That workspace has been revoked.');
    }
    return fail('WORKSPACE_NOT_AUTHORIZED', 'That workspace is not authorized on this computer.');
  }

  private target(grant: WorkspaceGrant): WorkspaceTarget {
    return {
      id: grant.id,
      root: grant.root,
      rootReal: grant.rootReal,
      limits: grant.limits,
    };
  }

  private summary(grant: WorkspaceGrant): WorkspaceSummary {
    return {
      id: grant.id,
      label: grant.label,
      displayPath: grant.displayPath,
      authorizedAt: grant.authorizedAt,
      capabilities: { ...WORKSPACE_CAPABILITIES },
      limits: { ...grant.limits },
    };
  }
}
