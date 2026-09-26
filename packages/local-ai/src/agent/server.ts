// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local AI — Local Agent HTTP server
//
// A tiny loopback-only JSON API over the Local Agent. The browser talks to THIS
// (not to Ollama directly), which removes the CORS problem entirely: the agent
// runs on the user's machine and talks to the runtime over plain HTTP.
//
// SECURITY BOUNDARY (enforced here, not merely documented)
//   • Binds to 127.0.0.1 by default — never 0.0.0.0, so it is not reachable from
//     the network.
//   • Routes ONLY probe runtimes, list models and generate. There is no route
//     that touches the filesystem, the shell, the environment or the network
//     beyond the runtime endpoint.
//   • CORS is an explicit allow-list; an unknown web origin gets no CORS header
//     (the browser blocks it) instead of a wildcard.
// ─────────────────────────────────────────────────────────────────────────────

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { LocalAgent, UnknownLocalRuntimeError } from './agent.js';
import type { LocalChatMessage, LocalGenerateRequest } from '../types.js';
import type {
  LocalWorkspaceService,
  WorkspaceError,
  WorkspaceErrorKind,
} from '@vedmoulya/local-workspace';

export const DEFAULT_LOCAL_AGENT_PORT = 43_117;
export const DEFAULT_LOCAL_AGENT_HOST = '127.0.0.1';

/** Web origins allowed to call the agent. Local dev + the deployed app. */
export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://vedmoulya-web.vercel.app',
];

export interface LocalAgentServerOptions {
  agent: LocalAgent;
  allowedOrigins?: readonly string[];
  /**
   * The optional workspace capability. Runtime and workspace are INDEPENDENT: a
   * server without a workspace still serves every runtime route, and a workspace
   * failure can never affect runtime discovery or generation.
   */
  workspace?: LocalWorkspaceService;
}

const MAX_BODY_BYTES = 1_000_000;

function json(res: ServerResponse, status: number, payload: unknown, origin: string | null): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...corsHeaders(origin),
  });
  res.end(body);
}

/** CORS headers for an allow-listed origin, or nothing for an unknown one. */
function corsHeaders(origin: string | null): Record<string, string> {
  if (origin === null) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

function resolveOrigin(req: IncomingMessage, allowed: readonly string[]): string | null {
  const header = req.headers.origin;
  if (typeof header !== 'string' || header.trim() === '') return null;
  return allowed.includes(header) ? header : null;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new Error('Request body too large');
    chunks.push(buffer);
  }
  if (total === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/** Parse and validate a generation request body (never trusts the wire). */
function parseGenerateRequest(body: unknown): LocalGenerateRequest | null {
  const record = asRecord(body);
  if (record === null) return null;
  const rawMessages = record['messages'];
  if (!Array.isArray(rawMessages)) return null;
  const messages: LocalChatMessage[] = [];
  for (const entry of rawMessages) {
    const message = asRecord(entry);
    if (message === null) return null;
    const role = message['role'];
    const content = message['content'];
    if (typeof content !== 'string') return null;
    if (role !== 'system' && role !== 'user' && role !== 'assistant') return null;
    messages.push({ role, content });
  }
  const modelId = typeof record['modelId'] === 'string' ? record['modelId'] : undefined;
  const maxTokens = typeof record['maxTokens'] === 'number' ? record['maxTokens'] : undefined;
  const timeoutMs = typeof record['timeoutMs'] === 'number' ? record['timeoutMs'] : undefined;
  return {
    ...(modelId !== undefined ? { modelId } : {}),
    messages,
    ...(maxTokens !== undefined ? { maxTokens } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  };
}

/** Map a typed workspace failure to an honest HTTP status (no OS detail). */
function workspaceStatus(kind: WorkspaceErrorKind): number {
  switch (kind) {
    case 'INVALID_REQUEST':
    case 'PATH_IS_NOT_DIRECTORY':
      return 400;
    case 'PATH_NOT_ALLOWED':
      return 403;
    case 'WORKSPACE_NOT_AUTHORIZED':
    case 'WORKSPACE_REVOKED':
    case 'WORKSPACE_ROOT_UNAVAILABLE':
    case 'PATH_NOT_FOUND':
      return 404;
    case 'FILE_TOO_LARGE':
      return 413;
    case 'BINARY_FILE':
      return 415;
    case 'LIMIT_EXCEEDED':
      return 429;
    case 'IO_ERROR':
      return 500;
    default:
      return 400;
  }
}

/** Serialize a typed workspace failure without leaking absolute paths. */
function workspaceErrorBody(error: WorkspaceError): { error: WorkspaceError } {
  const safe: WorkspaceError = { kind: error.kind, message: error.message };
  if (error.path !== undefined) safe.path = error.path;
  return { error: safe };
}

/** Parse an optional JSON body into a record (never trusts the wire). */
function optionalRecord(body: unknown): Record<string, unknown> | null {
  if (body === undefined) return {};
  return asRecord(body);
}

/** Parse a positive integer from a query string value or a JSON body value. */
function parsePositiveInt(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

/** Parse an optional array of strings (workspace focus paths). */
function parseStringArray(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const values = raw.filter((entry): entry is string => typeof entry === 'string');
  return values.length > 0 ? values : undefined;
}

/** Parse the bounded listing query (`path`, `depth`, `max`). */
function parseListQuery(url: URL): { path?: string; depth?: number; max?: number } {
  const path = url.searchParams.get('path');
  const depth = parsePositiveInt(url.searchParams.get('depth'));
  const max = parsePositiveInt(url.searchParams.get('max'));
  return {
    ...(path !== null ? { path } : {}),
    ...(depth !== undefined ? { depth } : {}),
    ...(max !== undefined ? { max } : {}),
  };
}

/**
 * Build the Local Agent HTTP server. The server itself is transport only: all
 * decisions live in `LocalAgent` (runtime) and `LocalWorkspaceService`
 * (workspace), so every surface sees the same truth.
 */
export function createLocalAgentServer(options: LocalAgentServerOptions): Server {
  const { agent, workspace } = options;
  const allowed = options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  const capabilities: string[] = ['runtime', ...(workspace !== undefined ? ['workspace'] : [])];

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const origin = resolveOrigin(req, allowed);
    const method = req.method ?? 'GET';
    if (method === 'OPTIONS') {
      res.writeHead(204, { ...corsHeaders(origin) });
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${DEFAULT_LOCAL_AGENT_HOST}`);
    const segments = url.pathname.split('/').filter((segment) => segment !== '');

    try {
      if (segments.length === 0) {
        json(res, 200, { name: 'VedMoulya Local Agent', ...agent.health(), capabilities }, origin);
        return;
      }
      if (segments.length === 1 && segments[0] === 'health' && method === 'GET') {
        json(res, 200, { ...agent.health(), capabilities }, origin);
        return;
      }
      if (segments.length === 1 && segments[0] === 'runtimes' && method === 'GET') {
        json(res, 200, { runtimes: agent.listRuntimes() }, origin);
        return;
      }

      if (segments[0] === 'runtimes' && segments.length >= 3) {
        const runtimeId = segments[1] ?? '';
        const action = segments[2] ?? '';
        const rest = segments.slice(3).map((segment) => decodeURIComponent(segment));

        if (action === 'status' && method === 'GET') {
          const modelId = url.searchParams.get('modelId') ?? undefined;
          json(
            res,
            200,
            await agent.status(runtimeId, modelId !== undefined ? { modelId } : {}),
            origin,
          );
          return;
        }
        if (action === 'models' && rest.length === 0 && method === 'GET') {
          json(res, 200, { models: await agent.listModels(runtimeId) }, origin);
          return;
        }
        if (action === 'models' && rest.length > 0 && method === 'GET') {
          json(res, 200, { model: await agent.getModel(runtimeId, rest.join('/')) }, origin);
          return;
        }
        if (action === 'generate' && method === 'POST') {
          const request = parseGenerateRequest(await readJsonBody(req));
          if (request === null) {
            json(res, 400, { error: 'Invalid generation request' }, origin);
            return;
          }
          json(res, 200, await agent.generate(runtimeId, request), origin);
          return;
        }
        if (action === 'verify' && method === 'POST') {
          const body = asRecord((await readJsonBody(req)) ?? {});
          const modelId = typeof body?.['modelId'] === 'string' ? body['modelId'] : undefined;
          json(
            res,
            200,
            await agent.verify(runtimeId, modelId !== undefined ? { modelId } : {}),
            origin,
          );
          return;
        }
        if (action === 'stream' && method === 'POST') {
          const request = parseGenerateRequest(await readJsonBody(req));
          if (request === null) {
            json(res, 400, { error: 'Invalid generation request' }, origin);
            return;
          }
          res.writeHead(200, {
            'content-type': 'application/x-ndjson; charset=utf-8',
            'cache-control': 'no-store',
            ...corsHeaders(origin),
          });
          for await (const chunk of agent.stream(runtimeId, request)) {
            res.write(`${JSON.stringify(chunk)}\n`);
          }
          res.end();
          return;
        }
      }

      // ── Workspace capability (independent of runtimes) ──────────────────
      if (segments[0] === 'workspaces') {
        const sendWorkspaceError = (error: WorkspaceError): void => {
          json(res, workspaceStatus(error.kind), workspaceErrorBody(error), origin);
        };

        if (workspace === undefined) {
          if (segments.length === 2 && segments[1] === 'capabilities' && method === 'GET') {
            json(
              res,
              200,
              {
                available: false,
                capabilities: { list: false, read: false, write: false, exec: false },
              },
              origin,
            );
            return;
          }
          json(res, 503, { error: 'The workspace capability is not available.' }, origin);
          return;
        }

        if (segments.length === 2 && segments[1] === 'capabilities' && method === 'GET') {
          json(
            res,
            200,
            {
              available: true,
              capabilities: workspace.capabilities(),
              limits: workspace.limitsSnapshot(),
            },
            origin,
          );
          return;
        }

        if (segments.length === 1 && method === 'GET') {
          json(res, 200, { workspaces: workspace.list() }, origin);
          return;
        }

        if (segments.length === 1 && method === 'POST') {
          const body = asRecord(await readJsonBody(req));
          if (body === null) {
            json(
              res,
              400,
              workspaceErrorBody({
                kind: 'INVALID_REQUEST',
                message: 'An explicit folder is required.',
              }),
              origin,
            );
            return;
          }
          const result = await workspace.authorize(body['root']);
          if (!result.ok) sendWorkspaceError(result.error);
          else json(res, 200, { workspace: result.value }, origin);
          return;
        }

        if (segments.length === 2) {
          const id = decodeURIComponent(segments[1] ?? '');
          if (method === 'GET') {
            const result = workspace.get(id);
            if (!result.ok) sendWorkspaceError(result.error);
            else json(res, 200, { workspace: result.value }, origin);
            return;
          }
          if (method === 'DELETE') {
            const result = workspace.revoke(id);
            if (!result.ok) sendWorkspaceError(result.error);
            else json(res, 200, { revoked: result.value.id }, origin);
            return;
          }
        }

        if (segments.length >= 3) {
          const id = decodeURIComponent(segments[1] ?? '');
          const action = segments[2] ?? '';
          if (action === 'entries' && method === 'GET') {
            const result = await workspace.entries(id, parseListQuery(url));
            if (!result.ok) sendWorkspaceError(result.error);
            else json(res, 200, result.value, origin);
            return;
          }
          if (action === 'tree' && method === 'GET') {
            const depth = parsePositiveInt(url.searchParams.get('depth'));
            const result = await workspace.entries(id, {
              depth: depth ?? 2,
            });
            if (!result.ok) sendWorkspaceError(result.error);
            else json(res, 200, result.value, origin);
            return;
          }
          if (action === 'file' && method === 'GET') {
            const path = url.searchParams.get('path');
            const maxBytes = parsePositiveInt(url.searchParams.get('maxBytes'));
            const result = await workspace.readFile(id, {
              path: path ?? '',
              ...(maxBytes !== undefined ? { maxBytes } : {}),
            });
            if (!result.ok) sendWorkspaceError(result.error);
            else json(res, 200, result.value, origin);
            return;
          }
          if (action === 'context' && method === 'POST') {
            const body = optionalRecord(await readJsonBody(req));
            if (body === null) {
              sendWorkspaceError({ kind: 'INVALID_REQUEST', message: 'Invalid context request.' });
              return;
            }
            const focus = parseStringArray(body['focus']);
            const maxFiles = parsePositiveInt(body['maxFiles']);
            const result = await workspace.context(id, {
              ...(focus !== undefined ? { focus } : {}),
              ...(maxFiles !== undefined ? { maxFiles } : {}),
            });
            if (!result.ok) sendWorkspaceError(result.error);
            else json(res, 200, result.value, origin);
            return;
          }
        }

        json(res, 404, { error: 'Not found' }, origin);
        return;
      }

      json(res, 404, { error: 'Not found' }, origin);
    } catch (error) {
      if (error instanceof UnknownLocalRuntimeError) {
        json(res, 404, { error: error.message }, origin);
        return;
      }
      json(
        res,
        500,
        { error: error instanceof Error ? error.message : 'Local Agent error' },
        origin,
      );
    }
  };

  return createServer((req, res) => {
    void handle(req, res);
  });
}

export interface StartedLocalAgent {
  server: Server;
  port: number;
  host: string;
  url: string;
  close: () => Promise<void>;
}

/**
 * Start the agent server on a loopback host. Resolves once listening, so a CLI
 * (and a test) can await a real bound socket instead of guessing.
 */
export function startLocalAgentServer(
  options: LocalAgentServerOptions & { port?: number; host?: string },
): Promise<StartedLocalAgent> {
  const host = options.host ?? DEFAULT_LOCAL_AGENT_HOST;
  const port = options.port ?? DEFAULT_LOCAL_AGENT_PORT;
  const server = createLocalAgentServer(options);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      const boundPort = typeof address === 'object' && address !== null ? address.port : port;
      resolve({
        server,
        port: boundPort,
        host,
        url: `http://${host}:${boundPort}`,
        close: () =>
          new Promise<void>((done, fail) => {
            server.close((error) => {
              if (error) fail(error);
              else done();
            });
          }),
      });
    });
  });
}
