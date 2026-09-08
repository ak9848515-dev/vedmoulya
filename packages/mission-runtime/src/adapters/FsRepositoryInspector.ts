// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Repository Inspection Adapter (BLD-022)
//
// Production RepositoryInspectionPort over the CONFIGURED workspace —
// through bounded, read-only filesystem inspection (no shell, no process
// spawn, no ToolRuntime bypass, no model reachability). Exposes ONLY the
// bounded structured information objective selection needs:
//   - failing checks known from the last RECORDED verification evidence
//     (injected — never re-run, never fabricated)
//   - incomplete workspace packages (package.json sanity)
//   - missing workspace-local integrations (@vedmoulya/* unresolved)
//   - TODO/FIXME markers (bounded scan, bounded snippets)
// Git identity (branch/revision) is exposed through inspectDetailed()
// — the frozen evidence type's gitStatus fields are only populated when
// genuinely known; they are never guessed.
// Security: every path is jailed inside the authorized workspace root;
// traversal outside is refused; scans are bounded (files, depth, size).
// ──────────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  RepositoryInspectionPort,
  RepositoryInspectionResult,
} from '@vedmoulya/mission-controller';

export interface FsRepositoryInspectorOptions {
  /** The authorized workspace root (operator-set). Required for safety. */
  defaultWorkspace?: string;
  /**
   * Last RECORDED verification evidence (wired from the checkpoint store /
   * execution memory by the composition). Returned strings become the
   * inspection's failing-checks signal — status "where available".
   */
  verificationEvidence?: () => string[];
  maxFiles?: number;
  maxTodos?: number;
  maxDepth?: number;
}

const DEFAULT_MAX_FILES = 400;
const DEFAULT_MAX_TODOS = 25;
const DEFAULT_MAX_DEPTH = 6;
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
]);
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.md', '.json']);
const TODO_PATTERN = /\b(TODO|FIXME)\b[:\s](.{0,120})/;

export class FsRepositoryInspector implements RepositoryInspectionPort {
  private readonly options: Required<
    Omit<FsRepositoryInspectorOptions, 'defaultWorkspace' | 'verificationEvidence'>
  > &
    FsRepositoryInspectorOptions;

  constructor(options: FsRepositoryInspectorOptions = {}) {
    this.options = {
      defaultWorkspace: options.defaultWorkspace,
      verificationEvidence: options.verificationEvidence,
      maxFiles: options.maxFiles ?? DEFAULT_MAX_FILES,
      maxTodos: options.maxTodos ?? DEFAULT_MAX_TODOS,
      maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    };
  }

  /** Resolve + jail the workspace path inside the authorized root. */
  private resolveWorkspace(workspacePath?: string): string {
    const authorized = this.options.defaultWorkspace;
    const requested = workspacePath ?? authorized;
    if (!requested) {
      throw new Error('no workspace configured for repository inspection');
    }
    const resolved = path.resolve(requested);
    if (authorized) {
      const authorizedResolved = path.resolve(authorized);
      if (resolved !== authorizedResolved && !resolved.startsWith(authorizedResolved + path.sep)) {
        throw new Error(`workspace path escapes the authorized root: ${workspacePath ?? ''}`);
      }
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(`workspace path is not a directory: ${resolved}`);
    }
    return resolved;
  }

  async inspectRepository(workspacePath?: string): Promise<RepositoryInspectionResult> {
    const root = this.resolveWorkspace(workspacePath);
    const todos = this.scanTodos(root);
    const incompletePackages = this.scanIncompletePackages(root);
    const missingIntegrations = this.scanMissingIntegrations(root);
    const failingTests = (this.options.verificationEvidence?.() ?? []).slice(0, DEFAULT_MAX_TODOS);
    return {
      failingTests,
      incompletePackages,
      missingIntegrations,
      todos,
      architecturalGaps: [],
    };
  }

  /** Bounded recursive collection of text files (never enters excluded dirs). */
  private collectFiles(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string, depth: number): void => {
      if (depth > this.options.maxDepth || out.length >= this.options.maxFiles) return;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (out.length >= this.options.maxFiles) return;
        if (entry.name.startsWith('.') && entry.name !== '.git') continue;
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, depth + 1);
        } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name))) {
          out.push(full);
        }
      }
    };
    walk(root, 0);
    return out.slice(0, this.options.maxFiles);
  }

  private scanTodos(root: string): string[] {
    const todos: string[] = [];
    for (const file of this.collectFiles(root)) {
      let content: string;
      try {
        if (fs.statSync(file).size > 200_000) continue;
        content = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const lines = content.split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        const match = TODO_PATTERN.exec(lines[index] ?? '');
        if (match) {
          const relative = path.relative(root, file).split(path.sep).join('/');
          todos.push(`${relative}:${String(index + 1)}: ${match[0].slice(0, 140)}`);
          if (todos.length >= this.options.maxTodos) return todos;
        }
      }
    }
    return todos;
  }

  /** Workspace-local package.json sanity (bounded to known layout roots). */
  private scanIncompletePackages(root: string): string[] {
    const incomplete: string[] = [];
    const candidates = [root, path.join(root, 'packages'), path.join(root, 'services')].map(
      (dir) => ({ dir, depth: 0 }),
    );
    const visited = new Set<string>();
    while (candidates.length > 0) {
      const next = candidates.shift();
      if (!next || next.depth > 2 || visited.has(next.dir)) continue;
      visited.add(next.dir);
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(next.dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || EXCLUDED_DIRS.has(entry.name)) continue;
        const manifestPath = path.join(next.dir, entry.name, 'package.json');
        if (!fs.existsSync(manifestPath)) continue;
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
            name?: string;
            version?: string;
            scripts?: Record<string, string>;
          };
          const label = path.relative(root, path.dirname(manifestPath)).split(path.sep).join('/');
          const problems: string[] = [];
          if (!manifest.name) problems.push('missing name');
          if (!manifest.version) problems.push('missing version');
          const scripts = manifest.scripts ?? {};
          if (!scripts['build'] && !scripts['test']) problems.push('no build/test scripts');
          if (problems.length > 0) {
            incomplete.push(`${label}: ${problems.join(', ')}`);
          }
        } catch {
          incomplete.push(
            `${path.relative(root, manifestPath).split(path.sep).join('/')}: unparseable package.json`,
          );
        }
        if (incomplete.length >= DEFAULT_MAX_TODOS) return incomplete;
      }
    }
    return incomplete;
  }

  /** Workspace-local @vedmoulya/* dependencies that do not resolve. */
  private scanMissingIntegrations(root: string): string[] {
    const workspaceDirs = new Set<string>();
    for (const base of ['packages', 'services', 'apps']) {
      const baseDir = path.join(root, base);
      try {
        for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
          if (entry.isDirectory()) workspaceDirs.add(entry.name);
        }
      } catch {
        // Base directory absent — nothing to add.
      }
    }
    const missing: string[] = [];
    for (const file of this.collectFiles(root)) {
      if (path.basename(file) !== 'package.json') continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const deps = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
        for (const dep of deps) {
          if (!dep.startsWith('@vedmoulya/')) continue;
          const name = dep.slice('@vedmoulya/'.length);
          if (!workspaceDirs.has(name) && !fs.existsSync(path.join(root, name))) {
            const label = path.relative(root, file).split(path.sep).join('/');
            const entry = `${label}: ${dep} does not resolve inside the workspace`;
            if (!missing.includes(entry)) missing.push(entry);
          }
        }
      } catch {
        continue;
      }
      if (missing.length >= DEFAULT_MAX_TODOS) return missing;
    }
    return missing;
  }

  /**
   * Richer bounded detail beyond the frozen port shape: workspace identity,
   * git branch/revision (read-only .git file parsing) and scan bounds.
   * Branch/revision are exposed here — the frozen gitStatus evidence fields
   * stay empty unless genuinely known (clean/modifiedFiles are never guessed).
   */
  inspectDetailed(workspacePath?: string): {
    identity: { name?: string; version?: string };
    git?: { branch: string; revision?: string };
    scannedFiles: number;
    root: string;
  } {
    const root = this.resolveWorkspace(workspacePath);
    let identity: { name?: string; version?: string } = {};
    try {
      identity = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
        name?: string;
        version?: string;
      };
    } catch {
      // No/broken root manifest — identity stays empty (honest).
    }
    const headPath = path.join(root, '.git', 'HEAD');
    let git: { branch: string; revision?: string } | undefined;
    if (fs.existsSync(headPath)) {
      const head = fs.readFileSync(headPath, 'utf8').trim();
      const match = /^ref: (refs\/heads\/.+)$/.exec(head);
      if (match?.[1]) {
        const refPath = path.join(root, '.git', match[1]);
        git = {
          branch: match[1].slice('refs/heads/'.length),
          revision: fs.existsSync(refPath) ? fs.readFileSync(refPath, 'utf8').trim() : undefined,
        };
      }
    }
    return {
      identity,
      git,
      scannedFiles: this.collectFiles(root).length,
      root,
    };
  }
}
