// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local Workspace — public surface
//
//   Browser → Local Agent → LocalWorkspaceService → authorized read-only root
//
// This package owns ALL filesystem access. Runtime adapters must NEVER import it
// (see the architecture test in @vedmoulya/local-ai). Only the Local Agent
// composes a `LocalWorkspaceService` and calls its total domain API.
// ─────────────────────────────────────────────────────────────────────────────

// ── Types + constants ───────────────────────────────────────────────────────
export type {
  FileEncoding,
  WorkspaceCapabilities,
  WorkspaceContext,
  WorkspaceContextFile,
  WorkspaceContextOptions,
  WorkspaceEntry,
  WorkspaceEntryKind,
  WorkspaceError,
  WorkspaceErrorKind,
  WorkspaceFileContent,
  WorkspaceLimits,
  WorkspaceListOptions,
  WorkspaceListing,
  WorkspaceReadOptions,
  WorkspaceResult,
  WorkspaceSummary,
} from './types.js';
export {
  DEFAULT_WORKSPACE_LIMITS,
  HARD_WORKSPACE_LIMITS,
  WORKSPACE_CAPABILITIES,
} from './types.js';

// ── Result helpers ──────────────────────────────────────────────────────────
export { defaultMessage, fail, ok } from './result.js';

// ── Policy (pure) ───────────────────────────────────────────────────────────
export {
  BINARY_EXTENSIONS,
  IGNORED_NAMES,
  hasInvalidUtf8,
  isBinaryExtension,
  isIgnoredName,
  looksBinary,
} from './policy.js';

// ── Limits (pure) ───────────────────────────────────────────────────────────
export {
  clampContextFiles,
  clampDepth,
  clampFileBytes,
  clampListEntries,
  depthWasLimited,
} from './limits.js';

// ── Filesystem port + Node implementation ───────────────────────────────────
export type {
  WorkspaceDirEntry,
  WorkspaceFileStat,
  WorkspaceFileSystem,
  WorkspaceHost,
} from './filesystem.js';
export { NodeWorkspaceFileSystem, nodeHostFacts } from './filesystem.node.js';

// ── Containment ─────────────────────────────────────────────────────────────
export {
  isContained,
  normalizeForCompare,
  rejectionForRawPath,
  WorkspacePathResolver,
} from './path-resolver.js';
export type { ResolvedInside, WorkspacePathResolverOptions } from './path-resolver.js';

// ── Authorization ───────────────────────────────────────────────────────────
export { displayPathForRoot, labelForRoot, WorkspaceAuthorizer } from './authorizer.js';
export type { AuthorizedRoot, WorkspaceAuthorizerOptions } from './authorizer.js';

// ── Reader + context ────────────────────────────────────────────────────────
export { WorkspaceReader } from './reader.js';
export type { WorkspaceTarget } from './reader.js';
export { WorkspaceContextAssembler } from './context-assembler.js';
export type { WorkspaceContextAssemblerDeps } from './context-assembler.js';

// ── Domain service ──────────────────────────────────────────────────────────
export { LocalWorkspaceService } from './service.js';
export type { LocalWorkspaceServiceOptions } from './service.js';
