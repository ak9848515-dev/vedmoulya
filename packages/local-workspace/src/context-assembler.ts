// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local Workspace — context assembler
//
// Produce a bounded, DETERMINISTIC `WorkspaceContext` from an authorized
// workspace: a small set of well-known project files plus any explicitly
// focused paths. The output is structured data only — Phase 2 deliberately does
// NOT send it to Ollama/LM Studio. There is no embedding, no vector store and
// no retrieval: this is the foundation, not RAG.
//
// Selection order (stable):
//   1. well-known root files, in a fixed order (README*, package.json, …)
//   2. explicit focus paths, in the order supplied
//   3. nothing else — recursion and fan-out are intentionally absent
// ─────────────────────────────────────────────────────────────────────────────

import type { WorkspaceFileSystem } from './filesystem.js';
import { clampContextFiles } from './limits.js';
import { isIgnoredName } from './policy.js';
import type { WorkspacePathResolver } from './path-resolver.js';
import { ok } from './result.js';
import type { WorkspaceReader, WorkspaceTarget } from './reader.js';
import type {
  WorkspaceContext,
  WorkspaceContextFile,
  WorkspaceContextOptions,
  WorkspaceResult,
} from './types.js';

/** Maximum bytes of a single file included as an excerpt. */
const EXCERPT_BYTES = 8_000;

/** Fixed, deterministic order of well-known root files. */
const WELL_KNOWN = [
  'README',
  'README.md',
  'README.rst',
  'package.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
];

const README_PATTERN = /^readme(\.[a-z0-9]+)?$/i;

export interface WorkspaceContextAssemblerDeps {
  fs: WorkspaceFileSystem;
  resolver: WorkspacePathResolver;
  reader: WorkspaceReader;
  now: () => Date;
  /** The workspace label for the assembled context. Defaults to the id. */
  label?: string;
}

export class WorkspaceContextAssembler {
  private readonly deps: WorkspaceContextAssemblerDeps;
  /** The label written into the assembled context; the service sets it per grant. */
  label: string | undefined;

  constructor(deps: WorkspaceContextAssemblerDeps) {
    this.deps = deps;
    this.label = deps.label;
  }

  async assemble(
    target: WorkspaceTarget,
    options: WorkspaceContextOptions = {},
  ): Promise<WorkspaceResult<WorkspaceContext>> {
    const maxFiles = clampContextFiles(options.maxFiles, target.limits);
    const notes: string[] = [];
    let omittedCount = 0;

    const candidates = await this.candidates(target);
    const ordered = this.orderedCandidates(candidates, options.focus ?? []);

    const files: WorkspaceContextFile[] = [];
    let usedBytes = 0;

    for (const candidate of ordered) {
      if (files.length >= maxFiles) {
        omittedCount += 1;
        continue;
      }
      const resolved = await this.deps.resolver.resolveInside(
        target.root,
        target.rootReal,
        candidate,
        { expect: 'file' },
      );
      if (!resolved.ok) {
        omittedCount += 1;
        continue;
      }
      const budget = Math.max(
        1,
        Math.min(EXCERPT_BYTES, target.limits.maxContextBytes - usedBytes),
      );
      const read = await this.deps.reader.read(target, { path: candidate, maxBytes: budget });
      if (!read.ok) {
        omittedCount += 1;
        continue;
      }
      const value = read.value;
      if (value.encoding === 'binary' || value.content === undefined) {
        omittedCount += 1;
        continue;
      }
      if (usedBytes + value.content.length > target.limits.maxContextBytes) {
        omittedCount += 1;
        continue;
      }
      files.push({
        path: value.path,
        bytes: value.bytes,
        excerpt: value.content,
        truncated: value.truncated,
      });
      usedBytes += value.content.length;
    }

    if (omittedCount > 0) {
      notes.push(
        `${omittedCount} candidate file(s) were omitted (missing, binary, or over the context budget).`,
      );
    }
    if (files.some((file) => file.truncated)) {
      notes.push('Some excerpts were truncated to respect the context budget.');
    }
    notes.push('Workspace context is bounded and, in this phase, is never sent to a model.');

    return ok({
      workspaceId: target.id,
      label: this.label ?? target.id,
      generatedAt: this.deps.now().toISOString(),
      files,
      omittedCount,
      notes,
    });
  }

  /** Discover the root-level candidate files (bounded, no recursion). */
  private async candidates(target: WorkspaceTarget): Promise<string[]> {
    const children = await this.deps.fs.readdir(target.root);
    if (children === null) return [];
    const names = children
      .filter((child) => child.kind === 'file' && !isIgnoredName(child.name))
      .map((child) => child.name);
    const found: string[] = [];
    for (const name of names) {
      if (README_PATTERN.test(name) || WELL_KNOWN.includes(name)) found.push(name);
    }
    return found;
  }

  /** Deterministic ordering: well-known first, then focus, then the rest. */
  private orderedCandidates(candidates: string[], focus: readonly string[]): string[] {
    const ordered: string[] = [];
    const seen = new Set<string>();
    const push = (value: string): void => {
      const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');
      if (normalized === '' || seen.has(normalized)) return;
      seen.add(normalized);
      ordered.push(normalized);
    };

    for (const known of WELL_KNOWN) {
      if (candidates.includes(known)) push(known);
    }
    for (const name of candidates) {
      if (README_PATTERN.test(name)) push(name);
    }
    for (const item of focus) push(item);
    for (const name of [...candidates].sort((a, b) => a.localeCompare(b))) push(name);
    return ordered;
  }
}
