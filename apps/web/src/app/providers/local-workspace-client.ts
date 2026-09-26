// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Local Workspace client (BROWSER side)
//
// The browser never touches the filesystem. It asks the Local Agent to
// authorize, list and read an explicitly user-selected folder, and the agent's
// `@vedmoulya/local-workspace` capability enforces every limit.
//
// HONESTY RULES
//   • Every call here NEVER throws: it returns a typed failure result, so a
//     missing Local Agent can never crash the app.
//   • Reads always carry a `workspaceId` — the browser can never supply a root,
//     so it cannot widen a grant. The agent returns only workspace-RELATIVE
//     paths.
//   • The workspace capability is independent of cloud providers and of local
//     runtime generation.
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkspaceCapabilitiesDTO {
  list: boolean;
  read: boolean;
  write: boolean;
  exec: boolean;
}

export interface WorkspaceLimitsDTO {
  maxFileBytes: number;
  maxListEntries: number;
  maxDepth: number;
  maxContextFiles: number;
  maxContextBytes: number;
  timeoutMs: number;
}

export interface WorkspaceSummaryDTO {
  id: string;
  label: string;
  displayPath: string;
  authorizedAt: string;
  capabilities: WorkspaceCapabilitiesDTO;
  limits: WorkspaceLimitsDTO;
}

export interface WorkspaceEntryDTO {
  name: string;
  path: string;
  kind: 'file' | 'directory' | 'symlink' | 'other';
  sizeBytes?: number;
  modifiedAt?: string;
  hidden: boolean;
}

export interface WorkspaceListingDTO {
  workspaceId: string;
  path: string;
  entries: WorkspaceEntryDTO[];
  truncated: boolean;
  ignoredCount: number;
  depthLimited: boolean;
}

export interface WorkspaceFileContentDTO {
  workspaceId: string;
  path: string;
  bytes: number;
  truncated: boolean;
  encoding: 'utf8' | 'binary';
  content?: string;
  contentOmittedReason?: string;
}

export interface WorkspaceContextFileDTO {
  path: string;
  bytes: number;
  excerpt: string;
  truncated: boolean;
}

export interface WorkspaceContextDTO {
  workspaceId: string;
  label: string;
  generatedAt: string;
  files: WorkspaceContextFileDTO[];
  omittedCount: number;
  notes: string[];
}

export interface WorkspaceErrorDTO {
  kind: string;
  message: string;
  path?: string;
}

export type WorkspaceClientResult<T> =
  { ok: true; value: T } | { ok: false; error: WorkspaceErrorDTO };

export interface WorkspaceCapabilitiesResponseDTO {
  available: boolean;
  capabilities: WorkspaceCapabilitiesDTO;
  limits?: WorkspaceLimitsDTO;
}

export interface WorkspaceClientOptions {
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 8_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function errorResult<T>(kind: string, message: string): WorkspaceClientResult<T> {
  return { ok: false, error: { kind, message } };
}

/** Map a failed response to a typed error (never OS text, never a raw root). */
async function failure<T>(response: Response, fallback: string): Promise<WorkspaceClientResult<T>> {
  let kind = 'IO_ERROR';
  let message = fallback;
  try {
    const body = asRecord((await response.json()) as unknown);
    const error = body !== null ? asRecord(body['error']) : null;
    if (error !== null) {
      if (typeof error['kind'] === 'string') kind = error['kind'];
      if (typeof error['message'] === 'string') message = error['message'];
    } else if (typeof body?.['error'] === 'string') {
      message = body['error'];
    }
  } catch {
    // Keep the fallback message.
  }
  return { ok: false, error: { kind, message } };
}

async function requestJson<T>(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fallback: string,
): Promise<WorkspaceClientResult<T>> {
  let response: Response;
  try {
    response = await fetchFn(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    return errorResult('AGENT_UNAVAILABLE', 'The Local Agent could not be reached.');
  }
  if (!response.ok) return failure<T>(response, fallback);
  try {
    const body = (await response.json()) as unknown;
    return { ok: true, value: body as T };
  } catch {
    return errorResult('INVALID_RESPONSE', 'The Local Agent returned an unexpected response.');
  }
}

/** Read the workspace capability (and whether it is available at all). */
export async function fetchWorkspaceCapabilities(
  agentUrl: string,
  options: WorkspaceClientOptions = {},
): Promise<WorkspaceClientResult<WorkspaceCapabilitiesResponseDTO>> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  return requestJson<WorkspaceCapabilitiesResponseDTO>(
    fetchFn,
    `${agentUrl}/workspaces/capabilities`,
    { method: 'GET', headers: { Accept: 'application/json' } },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    'The workspace capability could not be read.',
  );
}

/** Explicitly authorize a folder. The browser supplies the absolute root once. */
export async function authorizeWorkspace(
  agentUrl: string,
  root: string,
  options: WorkspaceClientOptions = {},
): Promise<WorkspaceClientResult<WorkspaceSummaryDTO>> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const result = await requestJson<{ workspace: WorkspaceSummaryDTO }>(
    fetchFn,
    `${agentUrl}/workspaces`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ root }),
    },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    'The folder could not be authorized.',
  );
  return result.ok ? { ok: true, value: result.value.workspace } : result;
}

/** List the currently authorized workspaces. */
export async function fetchWorkspaces(
  agentUrl: string,
  options: WorkspaceClientOptions = {},
): Promise<WorkspaceClientResult<WorkspaceSummaryDTO[]>> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const result = await requestJson<{ workspaces: WorkspaceSummaryDTO[] }>(
    fetchFn,
    `${agentUrl}/workspaces`,
    { method: 'GET', headers: { Accept: 'application/json' } },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    'The authorized workspaces could not be read.',
  );
  return result.ok ? { ok: true, value: result.value.workspaces } : result;
}

/** Revoke a workspace on the agent. */
export async function revokeWorkspace(
  agentUrl: string,
  workspaceId: string,
  options: WorkspaceClientOptions = {},
): Promise<WorkspaceClientResult<string>> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const result = await requestJson<{ revoked: string }>(
    fetchFn,
    `${agentUrl}/workspaces/${encodeURIComponent(workspaceId)}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    'The workspace could not be revoked.',
  );
  return result.ok ? { ok: true, value: result.value.revoked } : result;
}

/** List a directory inside an authorized workspace (bounded, relative paths). */
export async function fetchWorkspaceEntries(
  agentUrl: string,
  workspaceId: string,
  options: { path?: string; depth?: number; max?: number } & WorkspaceClientOptions = {},
): Promise<WorkspaceClientResult<WorkspaceListingDTO>> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const params = new URLSearchParams();
  if (options.path !== undefined && options.path !== '') params.set('path', options.path);
  if (options.depth !== undefined) params.set('depth', String(options.depth));
  if (options.max !== undefined) params.set('max', String(options.max));
  const query = params.toString();
  return requestJson<WorkspaceListingDTO>(
    fetchFn,
    `${agentUrl}/workspaces/${encodeURIComponent(workspaceId)}/entries${query === '' ? '' : `?${query}`}`,
    { method: 'GET', headers: { Accept: 'application/json' } },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    'The folder could not be listed.',
  );
}

/** Read one text file from an authorized workspace. */
export async function readWorkspaceFile(
  agentUrl: string,
  workspaceId: string,
  path: string,
  options: { maxBytes?: number } & WorkspaceClientOptions = {},
): Promise<WorkspaceClientResult<WorkspaceFileContentDTO>> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const params = new URLSearchParams({ path });
  if (options.maxBytes !== undefined) params.set('maxBytes', String(options.maxBytes));
  return requestJson<WorkspaceFileContentDTO>(
    fetchFn,
    `${agentUrl}/workspaces/${encodeURIComponent(workspaceId)}/file?${params.toString()}`,
    { method: 'GET', headers: { Accept: 'application/json' } },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    'The file could not be read.',
  );
}

/** Assemble bounded workspace context (never sent to a model in this phase). */
export async function assembleWorkspaceContext(
  agentUrl: string,
  workspaceId: string,
  options: { focus?: string[]; maxFiles?: number } & WorkspaceClientOptions = {},
): Promise<WorkspaceClientResult<WorkspaceContextDTO>> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  return requestJson<WorkspaceContextDTO>(
    fetchFn,
    `${agentUrl}/workspaces/${encodeURIComponent(workspaceId)}/context`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(options.focus !== undefined ? { focus: options.focus } : {}),
        ...(options.maxFiles !== undefined ? { maxFiles: options.maxFiles } : {}),
      }),
    },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    'The workspace context could not be assembled.',
  );
}
