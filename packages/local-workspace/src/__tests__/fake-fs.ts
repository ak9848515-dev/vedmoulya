// An in-memory `WorkspaceFileSystem` double. Security logic is exercised against
// this — never against the real disk — so containment, symlink refusal, limits
// and timeouts are deterministic.

import type { WorkspaceDirEntry, WorkspaceFileStat, WorkspaceFileSystem } from '../filesystem.js';

interface FakeNode {
  kind: 'file' | 'directory' | 'symlink';
  name: string;
  bytes?: Uint8Array;
  target?: string;
  mtime: string;
}

export function normalizePath(raw: string): string {
  const joined = raw.replace(/\\/g, '/').replace(/\/+/g, '/');
  return joined.length > 1 ? joined.replace(/\/+$/, '') : joined;
}

const DEFAULT_MTIME = '2024-01-01T00:00:00.000Z';

export class FakeWorkspaceFileSystem implements WorkspaceFileSystem {
  private readonly nodes = new Map<string, FakeNode>();
  private readonly caseInsensitive: boolean;

  constructor(options: { caseInsensitive?: boolean } = {}) {
    this.caseInsensitive = options.caseInsensitive ?? false;
  }

  private key(path: string): string {
    const normalized = normalizePath(path);
    return this.caseInsensitive ? normalized.toLowerCase() : normalized;
  }

  addDirectory(path: string): this {
    const normalized = normalizePath(path);
    this.ensureParents(normalized);
    this.nodes.set(this.key(normalized), {
      kind: 'directory',
      name: normalized.split('/').pop() ?? normalized,
      mtime: DEFAULT_MTIME,
    });
    return this;
  }

  /** Auto-create ancestor directories so fixtures stay terse and readable. */
  private ensureParents(normalized: string): void {
    const segments = normalized.split('/').filter((segment) => segment !== '');
    let current = '';
    for (const segment of segments.slice(0, -1)) {
      current = `${current}/${segment}`;
      const key = this.key(current);
      if (!this.nodes.has(key)) {
        this.nodes.set(key, { kind: 'directory', name: segment, mtime: DEFAULT_MTIME });
      }
    }
  }

  addFile(path: string, content: string | Uint8Array, mtime = DEFAULT_MTIME): this {
    const normalized = normalizePath(path);
    this.ensureParents(normalized);
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    this.nodes.set(this.key(normalized), {
      kind: 'file',
      name: normalized.split('/').pop() ?? normalized,
      bytes,
      mtime,
    });
    return this;
  }

  addSymlink(path: string, target: string): this {
    const normalized = normalizePath(path);
    this.ensureParents(normalized);
    this.nodes.set(this.key(normalized), {
      kind: 'symlink',
      name: normalized.split('/').pop() ?? normalized,
      target,
      mtime: DEFAULT_MTIME,
    });
    return this;
  }

  async lstat(path: string): Promise<WorkspaceFileStat | null> {
    const node = this.nodes.get(this.key(path));
    if (node === undefined) return null;
    return {
      kind: node.kind,
      sizeBytes: node.bytes?.length ?? 0,
      modifiedAt: node.mtime,
      hidden: node.name.startsWith('.'),
    };
  }

  async realpath(path: string): Promise<string | null> {
    return this.resolve(path, 0);
  }

  private resolve(path: string, depth: number): string | null {
    if (depth > 40) return null;
    const normalized = normalizePath(path);
    // A Windows drive prefix (`C:/…`) is the first component, not a name.
    const drive = /^([a-zA-Z]):\//.exec(normalized);
    const rest = drive !== null ? normalized.slice(drive[0].length) : normalized;
    const segments = rest.split('/').filter((segment) => segment !== '');
    let current = drive !== null ? drive[0].slice(0, -1) : '';
    let index = 0;
    while (index < segments.length) {
      const segment = segments[index] ?? '';
      const candidate = current === '' ? `/${segment}` : `${current}/${segment}`;
      const node = this.nodes.get(this.key(candidate));
      if (node === undefined) return null;
      if (node.kind === 'symlink') {
        // Resolve the link, then CONTINUE walking the REMAINING segments from
        // the resolved location (a link may appear mid-path).
        const target = node.target ?? '';
        const base = candidate.slice(0, candidate.lastIndexOf('/'));
        const absoluteTarget = target.startsWith('/') ? target : `${base}/${target}`;
        const resolved = this.resolve(absoluteTarget, depth + 1);
        if (resolved === null) return null;
        current = resolved === '/' ? '' : resolved;
      } else {
        current = candidate;
      }
      index += 1;
    }
    return current === '' ? '/' : current;
  }

  async readdir(path: string): Promise<WorkspaceDirEntry[] | null> {
    const baseKey = this.key(path);
    const node = this.nodes.get(baseKey);
    if (node === undefined || node.kind !== 'directory') return null;
    const entries: WorkspaceDirEntry[] = [];
    for (const [key, child] of this.nodes.entries()) {
      if (key === baseKey) continue;
      const parentPrefix = baseKey === '/' ? '/' : `${baseKey}/`;
      if (!key.startsWith(parentPrefix)) continue;
      const remainder = key.slice(parentPrefix.length);
      if (remainder === '' || remainder.includes('/')) continue;
      entries.push({
        name: child.name,
        kind: child.kind,
        ...(child.kind === 'file' ? { sizeBytes: child.bytes?.length ?? 0 } : {}),
        ...(child.kind !== 'symlink' ? { modifiedAt: child.mtime } : {}),
      });
    }
    return entries;
  }

  async readPrefix(path: string, maxBytes: number): Promise<Uint8Array | null> {
    const node = this.nodes.get(this.key(path));
    if (node === undefined || node.kind !== 'file' || node.bytes === undefined) return null;
    return node.bytes.slice(0, maxBytes);
  }
}
