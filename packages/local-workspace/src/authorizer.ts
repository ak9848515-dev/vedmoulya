// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local Workspace — authorizer
//
// Authorization is EXPLICIT and one-time: the user supplies an absolute root,
// and this component decides whether it may become an authorized workspace.
//
// There is NO default root, `process.cwd()` is never used, and the home
// directory is never granted implicitly. Denied roots (filesystem/drive root,
// the user's home, Windows/System32, Program Files, /etc, /usr, /bin, /System,
// /Library, …) are refused. When `VEDMOULYA_WORKSPACE_ROOTS` is configured, the
// root must additionally be contained inside one of those operator-approved
// roots — an allow-list the browser can never widen.
//
// The returned `rootReal` is the realpath'd directory the grant stores; the
// browser never sees it.
// ─────────────────────────────────────────────────────────────────────────────

import type { WorkspaceFileSystem, WorkspaceHost } from './filesystem.js';
import { isContained, normalizeForCompare } from './path-resolver.js';
import { fail, ok } from './result.js';
import type { WorkspaceResult } from './types.js';

export interface WorkspaceAuthorizerOptions {
  filesystem: WorkspaceFileSystem;
  host: WorkspaceHost;
  /** Operator-approved roots from `VEDMOULYA_WORKSPACE_ROOTS` (optional). */
  allowedRoots?: readonly string[];
  /** Extra denied roots (tests / hardening). */
  deniedRoots?: readonly string[];
}

export interface AuthorizedRoot {
  /** The realpath'd absolute root the grant stores (never exposed). */
  rootReal: string;
}

/** A short, path-free label for the root (its final segment). */
export function labelForRoot(root: string): string {
  const normalized = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const segments = normalized.split('/');
  const last = segments[segments.length - 1];
  return last !== undefined && last !== '' ? last : normalized;
}

/**
 * An abbreviated display path. Home-relative when possible, otherwise anchored
 * to the final segment. NEVER the full absolute root.
 */
export function displayPathForRoot(
  root: string,
  homedir: string,
  caseInsensitive: boolean,
): string {
  const normalized = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const home = homedir.replace(/\\/g, '/').replace(/\/+$/, '');
  if (isContained(normalized, home, caseInsensitive)) {
    const relative = normalized.slice(home.length).replace(/^\/+/, '');
    return relative === '' ? '~' : `~/${relative}`;
  }
  const segments = normalized.split('/').filter((segment) => segment !== '');
  const last = segments[segments.length - 1] ?? normalized;
  const parent = segments[segments.length - 2];
  return parent !== undefined ? `…/${parent}/${last}` : `…/${last}`;
}

export class WorkspaceAuthorizer {
  private readonly fs: WorkspaceFileSystem;
  private readonly host: WorkspaceHost;
  private readonly allowedRoots: readonly string[];
  private readonly extraDenied: readonly string[];
  private readonly caseInsensitive: boolean;

  constructor(options: WorkspaceAuthorizerOptions) {
    this.fs = options.filesystem;
    this.host = options.host;
    this.allowedRoots = options.allowedRoots ?? [];
    this.extraDenied = options.deniedRoots ?? [];
    this.caseInsensitive = options.host.platform === 'win32';
  }

  /** The built-in denied roots; computed from injected host facts + the root. */
  private deniedRoots(root: string): string[] {
    const sep = '/';
    const env = this.host.env;
    const denied = new Set<string>();
    // Filesystem / drive root (`/`, `C:\`).
    const normalizedRoot = root.replace(/\\/g, '/');
    const driveMatch = /^([a-zA-Z]:)\//.exec(normalizedRoot);
    if (driveMatch?.[1] !== undefined) denied.add(`${driveMatch[1]}${sep}`);
    else denied.add(sep);
    // The user's home directory itself.
    denied.add(this.host.homedir);
    // Windows system locations. Read the keys EXPLICITLY rather than by computed
    // access, so no attacker-influenced string can ever select the property read.
    const windowsLocations = [
      env.SystemRoot,
      env.windir,
      env.ProgramFiles,
      env['ProgramFiles(x86)'],
      env.ProgramData,
    ];
    for (const value of windowsLocations) {
      if (typeof value === 'string' && value.trim() !== '') denied.add(value);
    }
    // POSIX system locations.
    for (const value of ['/etc', '/usr', '/bin', '/sbin', '/boot', '/dev', '/proc', '/sys']) {
      denied.add(value);
    }
    // macOS system locations.
    denied.add('/System');
    denied.add('/Library');
    // Windows system directories reachable via any root that IS one of them.
    const segments = normalizeForCompare(normalizedRoot, true).split('/');
    const lastSegment = segments[segments.length - 1] ?? '';
    if (
      ['windows', 'system32', 'syswow64', 'program files', 'program files (x86)'].includes(
        lastSegment,
      )
    ) {
      denied.add(root);
    }
    for (const extra of this.extraDenied) denied.add(extra);
    return [...denied];
  }

  /**
   * Decide whether an explicitly supplied absolute root may be authorized.
   * Returns the realpath'd root on success; a typed failure otherwise.
   */
  async authorizeRoot(rawRoot: unknown): Promise<WorkspaceResult<AuthorizedRoot>> {
    if (typeof rawRoot !== 'string' || rawRoot.trim() === '') {
      return fail('INVALID_REQUEST', 'An explicit workspace folder path is required.');
    }
    const root = rawRoot.trim();
    if (root.includes('\0')) return fail('INVALID_REQUEST', 'The workspace path is not valid.');

    // Must be an absolute path; a relative root would depend on a cwd default.
    const isAbsolute =
      root.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(root) || root.startsWith('\\\\');
    if (!isAbsolute) {
      return fail('INVALID_REQUEST', 'The workspace folder must be an absolute path.');
    }

    const stat = await this.fs.lstat(root);
    if (stat === null) {
      return fail('WORKSPACE_ROOT_UNAVAILABLE', 'That folder does not exist on this computer.');
    }
    if (stat.kind !== 'directory') {
      return fail('WORKSPACE_ROOT_UNAVAILABLE', 'That path is not a folder.');
    }

    const rootReal = await this.fs.realpath(root);
    if (rootReal === null) {
      return fail('WORKSPACE_ROOT_UNAVAILABLE', 'That folder could not be resolved.');
    }

    for (const denied of this.deniedRoots(root)) {
      if (isContained(rootReal, denied, this.caseInsensitive)) {
        return fail(
          'PATH_NOT_ALLOWED',
          'That folder is too broad to authorize. Choose a project folder instead.',
        );
      }
    }

    // Operator allow-list (VEDMOULYA_WORKSPACE_ROOTS), when configured.
    if (this.allowedRoots.length > 0) {
      let within = false;
      for (const allowed of this.allowedRoots) {
        const allowedReal = await this.fs.realpath(allowed);
        if (allowedReal !== null && isContained(rootReal, allowedReal, this.caseInsensitive)) {
          within = true;
          break;
        }
      }
      if (!within) {
        return fail(
          'PATH_NOT_ALLOWED',
          'That folder is outside the roots approved by this computer.',
        );
      }
    }

    return ok({ rootReal });
  }
}
