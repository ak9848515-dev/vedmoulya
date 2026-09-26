// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local Workspace — limit clamping
//
// ONE place decides how a requested bound becomes an ACTUAL bound:
//
//   requested  →  clamp to the workspace limit  →  clamp to the hard cap
//
// The hard caps (maxFileBytes = 8 MiB, maxListEntries = 2000, maxDepth = 8) are
// absolute: no caller, however privileged, can exceed them, and no limit can be
// raised above them by configuration. Limits are never silently exceeded — a
// caller always learns it was bounded via `truncated` / `depthLimited`.
//
// Pure module: no filesystem, no environment, no platform checks.
// ─────────────────────────────────────────────────────────────────────────────

import { HARD_WORKSPACE_LIMITS, type WorkspaceLimits } from './types.js';

/** Clamp a requested byte budget to the workspace limit and the hard cap. */
export function clampFileBytes(requested: number | undefined, limits: WorkspaceLimits): number {
  const ceiling = Math.min(limits.maxFileBytes, HARD_WORKSPACE_LIMITS.maxFileBytes);
  if (requested === undefined) return ceiling;
  return Math.max(1, Math.min(Math.floor(requested), ceiling));
}

/** Clamp a requested entry count to the workspace limit and the hard cap. */
export function clampListEntries(requested: number | undefined, limits: WorkspaceLimits): number {
  const ceiling = Math.min(
    Math.max(1, Math.floor(limits.maxListEntries)),
    HARD_WORKSPACE_LIMITS.maxListEntries,
  );
  if (requested === undefined) return ceiling;
  return Math.max(1, Math.min(Math.floor(requested), ceiling));
}

/** Clamp a requested recursion depth to the workspace limit and the hard cap. */
export function clampDepth(requested: number | undefined, limits: WorkspaceLimits): number {
  const ceiling = Math.min(
    Math.max(1, Math.floor(limits.maxDepth)),
    HARD_WORKSPACE_LIMITS.maxDepth,
  );
  if (requested === undefined) return 1;
  return Math.max(1, Math.min(Math.floor(requested), ceiling));
}

/** Clamp a requested context-file count to the workspace limit. */
export function clampContextFiles(requested: number | undefined, limits: WorkspaceLimits): number {
  const ceiling = Math.max(1, Math.floor(limits.maxContextFiles));
  if (requested === undefined) return ceiling;
  return Math.max(1, Math.min(Math.floor(requested), ceiling));
}

/** True when the requested depth had to be reduced to fit the cap. */
export function depthWasLimited(requested: number | undefined, limits: WorkspaceLimits): boolean {
  if (requested === undefined) return false;
  return Math.floor(requested) > clampDepth(requested, limits);
}
