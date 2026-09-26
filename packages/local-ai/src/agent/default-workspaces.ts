// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local AI — default Local Workspace composition
//
// The ONE place the default workspace capability is wired. It composes the
// secure, read-only `@vedmoulya/local-workspace` service with the Node
// filesystem port and the operator allow-list:
//
//   VEDMOULYA_WORKSPACE_ROOTS  — optional, comma-separated absolute roots. When
//   set, an authorized workspace must be contained inside one of them.
//
// Workspace grants live in memory only, so a restart requires re-authorization.
// Runtime adapters never import the workspace package; only the agent does.
// ─────────────────────────────────────────────────────────────────────────────

import {
  LocalWorkspaceService,
  NodeWorkspaceFileSystem,
  nodeHostFacts,
  type LocalWorkspaceServiceOptions,
} from '@vedmoulya/local-workspace';

/** Parse the operator-approved roots from the environment (never from a request). */
export function resolveWorkspaceAllowedRoots(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const raw = env['VEDMOULYA_WORKSPACE_ROOTS'];
  if (raw === undefined || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

export interface DefaultLocalWorkspaceOptions {
  env?: Record<string, string | undefined>;
  allowedRoots?: readonly string[];
  limits?: LocalWorkspaceServiceOptions['limits'];
}

/** Build the default, in-memory workspace service for the Local Agent. */
export function createDefaultLocalWorkspaceService(
  options: DefaultLocalWorkspaceOptions = {},
): LocalWorkspaceService {
  const env = options.env ?? process.env;
  return new LocalWorkspaceService({
    filesystem: new NodeWorkspaceFileSystem(),
    host: nodeHostFacts(env),
    allowedRoots: options.allowedRoots ?? resolveWorkspaceAllowedRoots(env),
    ...(options.limits !== undefined ? { limits: options.limits } : {}),
  });
}
