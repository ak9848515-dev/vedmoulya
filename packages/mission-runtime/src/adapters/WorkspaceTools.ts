// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Governed Workspace Tools (BLD-022)
//
// The ONLY sanctioned way a mission's plan touches the authorized
// workspace: bounded, path-jailed tools registered on the frozen
// ToolRegistry so EVERY call inherits the full security chain
// (capability → allow/deny → schema validation → timeout → rate limit
// → audit). There is NO bypass: the Mission Controller never touches
// the filesystem for mission work, the AI can only reach these tools
// through the agent engine → tool port → registry.execute, and the
// jail can never be widened by model output.
//
// The workspace root is operator-configured (composition option /
// setWorkspaceRoot) — never model-settable, never prompt-settable.
// ──────────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ToolDefinition } from '@vedmoulya/services/ai/runtime/ToolRuntime';

export const WORKSPACE_READ_TOOL = 'workspace_read';
export const WORKSPACE_WRITE_TOOL = 'workspace_write';

const DEFAULT_MAX_WRITE_BYTES = 64 * 1024;
const DEFAULT_MAX_READ_BYTES = 8 * 1024;

export interface WorkspaceToolOptions {
  maxWriteBytes?: number;
  maxReadBytes?: number;
  /**
   * Optional content policy: return a rejection reason to deny the write,
   * undefined to allow. Evaluated INSIDE the governed tool handler — a
   * policy denial is an ordinary denial, never a bypass.
   */
  contentPolicy?: (content: string) => string | undefined;
}

/**
 * Operator-held workspace root binding. The root is set ONLY through this
 * holder (composition option or setWorkspaceRoot) — the model has no path
 * to it. `undefined` means no workspace is authorized yet: tools deny.
 */
export class WorkspaceRootBinding {
  private root: string | undefined;

  setRoot(root: string): void {
    const resolved = path.resolve(root);
    if (!fs.statSync(resolved).isDirectory()) {
      throw new Error(`workspace root is not a directory: ${resolved}`);
    }
    this.root = resolved;
  }

  getRoot(): string | undefined {
    return this.root;
  }

  /** Resolve + jail-check a mission-relative path. Throws on any escape. */
  resolveInside(relativePath: string): string {
    const root = this.root;
    if (!root) {
      throw new Error('no workspace root is authorized for this runtime');
    }
    if (path.isAbsolute(relativePath)) {
      throw new Error(`absolute paths are not permitted: ${relativePath}`);
    }
    const resolved = path.resolve(root, relativePath);
    const jailed = resolved === root || resolved.startsWith(root + path.sep);
    if (!jailed) {
      throw new Error(`path escapes the authorized workspace: ${relativePath}`);
    }
    // Symlink hardening: a pre-existing symlink may not point outside.
    if (fs.existsSync(resolved)) {
      const real = fs.realpathSync(resolved);
      const realRoot = fs.realpathSync(root);
      if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
        throw new Error(`path resolves outside the authorized workspace: ${relativePath}`);
      }
    }
    return resolved;
  }
}

export interface WorkspaceTools {
  read: ToolDefinition;
  write: ToolDefinition;
}

export function createWorkspaceTools(
  binding: WorkspaceRootBinding,
  options: WorkspaceToolOptions = {},
): WorkspaceTools {
  const maxWriteBytes = options.maxWriteBytes ?? DEFAULT_MAX_WRITE_BYTES;
  const maxReadBytes = options.maxReadBytes ?? DEFAULT_MAX_READ_BYTES;

  const read: ToolDefinition = {
    name: WORKSPACE_READ_TOOL,
    description:
      'Reads a bounded text file from the authorized workspace (mission-relative path only).',
    capability: 'knowledge',
    inputSchema: {
      type: 'object',
      properties: {
        relativePath: { type: 'string', required: true, minLength: 1, maxLength: 300 },
        maxBytes: { type: 'number', minimum: 1, maximum: DEFAULT_MAX_READ_BYTES },
      },
      additionalProperties: false,
    },
    timeoutMs: 5_000,
    rateLimit: { max: 240, windowMs: 60_000 },
    handler: (args) => {
      const relativePath = String(args['relativePath']);
      const resolved = binding.resolveInside(relativePath);
      if (fs.statSync(resolved).size > maxReadBytes * 4) {
        throw new Error(`file exceeds the bounded read size: ${relativePath}`);
      }
      const raw = fs.readFileSync(resolved, 'utf8');
      const requested = Number(args['maxBytes'] ?? maxReadBytes);
      const cap = Math.min(
        maxReadBytes,
        Math.max(1, Number.isFinite(requested) ? requested : maxReadBytes),
      );
      const truncated = raw.length > cap;
      return {
        path: relativePath,
        bytes: raw.length,
        content: truncated ? raw.slice(0, cap) : raw,
        truncated,
      };
    },
  };

  const write: ToolDefinition = {
    name: WORKSPACE_WRITE_TOOL,
    description:
      'Writes bounded UTF-8 content to a file in the authorized workspace (mission-relative path only).',
    capability: 'productivity',
    inputSchema: {
      type: 'object',
      properties: {
        relativePath: { type: 'string', required: true, minLength: 1, maxLength: 300 },
        content: { type: 'string', required: true, minLength: 1, maxLength: maxWriteBytes },
      },
      additionalProperties: false,
    },
    timeoutMs: 5_000,
    rateLimit: { max: 120, windowMs: 60_000 },
    handler: (args) => {
      const relativePath = String(args['relativePath']);
      const content = String(args['content']);
      const resolved = binding.resolveInside(relativePath);
      const rejection = options.contentPolicy?.(content);
      if (rejection !== undefined) {
        throw new Error(`write rejected by workspace content policy: ${rejection}`);
      }
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      if (Buffer.byteLength(content, 'utf8') > maxWriteBytes) {
        throw new Error(`content exceeds the bounded write size: ${relativePath}`);
      }
      fs.writeFileSync(resolved, content, 'utf8');
      return { path: relativePath, bytes: Buffer.byteLength(content, 'utf8') };
    },
  };

  return { read, write };
}
