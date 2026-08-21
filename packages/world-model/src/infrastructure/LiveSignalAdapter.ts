// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · LiveSignalAdapter (SPRINT-034)
//
// An OPERATOR-CONFIGURABLE live signal source implementing the existing
// WorldSignalSourcePort. It is the only production adapter the world model
// ships — and it is inert until an operator configures it (env, server-side
// only; credentials NEVER reach the browser).
//
// Safety rules (source content is UNTRUSTED):
//   • payloads are bounded (MAX_PAYLOAD_BYTES) — oversized bodies are ERROR;
//   • titles/descriptions are sanitized (control chars stripped, scripts
//     removed, lengths bounded) — external content is DATA, never markup,
//     never instructions, never AUTHORIZATION;
//   • a signal carries NO authority fields — it can never authorize, never
//     trigger execution (EVIDENCE only);
//   • provenance is required where available (source, sourceId/URL,
//     retrievedAt, publishedAt) — a signal without provenance is refused;
//   • status is honest: AVAILABLE only when the source answered; UNAVAILABLE
//     when not configured; ERROR when configured but failed — never AVAILABLE
//     for an unavailable source.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  WorldSignal,
  WorldSignalKind,
  WorldSignalSourceStatus,
} from '../types/world-types.js';
import type { WorldSignalSourcePort } from '../contracts/world-ports.js';

export const MAX_PAYLOAD_BYTES = 256 * 1024; // 256 KB — bounded, never unbounded
export const MAX_SIGNALS_PER_KIND = 25;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 1000;

export interface LiveSignalAdapterConfig {
  /** Optional base URL of the operator's JSON signal endpoint. When unset the
   *  adapter reports UNAVAILABLE (never a fake AVAILABLE). */
  baseUrl?: string;
  /** Optional server-side bearer token (never exposed to the browser). */
  token?: string;
  /** Kinds this source may answer (closed vocabulary). Empty = any kind. */
  kinds?: WorldSignalKind[];
  /** Override the global fetch (hermetic tests). */
  fetchFn?: typeof fetch;
  now?: () => string;
}

interface RawSignal {
  id?: string;
  title?: unknown;
  description?: unknown;
  kind?: unknown;
  url?: unknown;
  sourceId?: unknown;
  publishedAt?: unknown;
}

/** Sanitize untrusted external content: strip control chars + script blocks,
 *  bound the length. Returns plain text only — never markup. */
export function sanitizeExternalText(value: string, max: number): string {
  const stripped = value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.slice(0, max);
}

/** Normalize the source's reported kind against the closed vocabulary —
 *  unknown kinds map to the kind the caller asked for (never invented). */
function normalizeKind(raw: unknown, requested: WorldSignalKind): WorldSignalKind {
  if (typeof raw !== 'string') return requested;
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  const valid: WorldSignalKind[] = [
    'market_trends',
    'startup_ideas',
    'technology_releases',
    'ai_model_releases',
    'open_source_projects',
    'pricing_changes',
    'customer_demand',
    'competitor_changes',
    'regulatory_changes',
    'job_market',
    'content_trends',
  ];
  return (valid as string[]).includes(normalized) ? (normalized as WorldSignalKind) : requested;
}

/** Every closed signal kind the adapter may be asked for (health reports one
 *  entry per kind — never fabricated). */
const ALL_KINDS: WorldSignalKind[] = [
  'market_trends',
  'startup_ideas',
  'technology_releases',
  'ai_model_releases',
  'open_source_projects',
  'pricing_changes',
  'customer_demand',
  'competitor_changes',
  'regulatory_changes',
  'job_market',
  'content_trends',
];

interface KindHealth {
  status: WorldSignalSourceStatus;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastError?: string;
}

export class LiveSignalAdapter implements WorldSignalSourcePort {
  private readonly baseUrl: string | undefined;
  private readonly token: string | undefined;
  private readonly kinds: Set<string>;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => string;
  private readonly healthByKind = new Map<string, KindHealth>();

  constructor(config: LiveSignalAdapterConfig = {}) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.kinds = new Set((config.kinds ?? []).map((k) => k as string));
    this.fetchFn =
      config.fetchFn ?? ((...args: Parameters<typeof fetch>): Promise<Response> => fetch(...args));
    this.now = config.now ?? ((): string => new Date().toISOString());
  }

  /** Honest status: not configured → UNAVAILABLE (never AVAILABLE). */
  get configured(): boolean {
    return Boolean(this.baseUrl && this.baseUrl.length > 0);
  }

  /** True when this kind is enabled for the adapter (empty = any kind). */
  private kindEnabled(kind: WorldSignalKind): boolean {
    return this.kinds.size === 0 || this.kinds.has(kind);
  }

  /** SPRINT-035 — honest per-source health. A source is AVAILABLE only after
   *  a real observation; UNAVAILABLE until configured/observed; ERROR after a
   *  failure. Never fabricated "live" status. */
  health(): Array<{
    kind: WorldSignalKind;
    status: WorldSignalSourceStatus;
    lastSuccessAt?: string;
    lastErrorAt?: string;
    lastError?: string;
    configured: boolean;
  }> {
    return ALL_KINDS.map((kind) => {
      const recorded = this.healthByKind.get(kind);
      const configured = this.configured && this.kindEnabled(kind);
      return {
        kind,
        status: recorded?.status ?? (configured ? 'UNAVAILABLE' : 'UNAVAILABLE'),
        lastSuccessAt: recorded?.lastSuccessAt,
        lastErrorAt: recorded?.lastErrorAt,
        lastError: recorded?.lastError,
        configured,
      };
    });
  }

  private recordHealth(
    kind: WorldSignalKind,
    status: WorldSignalSourceStatus,
    error?: string,
  ): void {
    const prior = this.healthByKind.get(kind);
    this.healthByKind.set(kind, {
      status,
      lastSuccessAt: status === 'AVAILABLE' ? this.now() : prior?.lastSuccessAt,
      lastErrorAt: status === 'ERROR' ? this.now() : prior?.lastErrorAt,
      lastError: status === 'ERROR' ? (error ?? 'Source failed.') : prior?.lastError,
    });
  }

  /** Wrapper: record honest health per kind, then return the fetch result.
   *  The health map is the ONLY memory the adapter keeps beyond the fetch. */
  async listSignals(kind: WorldSignalKind): Promise<{
    status: WorldSignalSourceStatus;
    signals: WorldSignal[];
    error?: string;
  }> {
    const result = await this.fetchKind(kind);
    this.recordHealth(kind, result.status, result.error);
    return result;
  }

  private async fetchKind(kind: WorldSignalKind): Promise<{
    status: WorldSignalSourceStatus;
    signals: WorldSignal[];
    error?: string;
  }> {
    // Not configured for this kind → UNAVAILABLE (the honest state).
    if (!this.configured) {
      return { status: 'UNAVAILABLE', signals: [] };
    }
    if (!this.kindEnabled(kind)) {
      return { status: 'UNAVAILABLE', signals: [] };
    }
    try {
      const url = new URL(`${this.baseUrl}?kind=${encodeURIComponent(kind)}`);
      const headers: Record<string, string> = { accept: 'application/json' };
      // Server-side credential only — the gateway owns this adapter; the
      // token never crosses to the browser.
      if (this.token) headers.authorization = `Bearer ${this.token}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, 10_000);
      let response: Response;
      try {
        response = await this.fetchFn(url.toString(), {
          headers,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        return {
          status: 'ERROR',
          signals: [],
          error: `Source answered ${response.status} — ${response.statusText || 'error'}.`,
        };
      }
      const contentLength = Number(response.headers.get('content-length') ?? 0);
      if (contentLength > MAX_PAYLOAD_BYTES) {
        return { status: 'ERROR', signals: [], error: 'Payload exceeds the bounded size limit.' };
      }
      const text = await response.text();
      if (text.length > MAX_PAYLOAD_BYTES) {
        return { status: 'ERROR', signals: [], error: 'Payload exceeds the bounded size limit.' };
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { status: 'ERROR', signals: [], error: 'Source returned non-JSON content.' };
      }
      const rawList = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown }).items;
      if (!Array.isArray(rawList)) {
        return { status: 'ERROR', signals: [], error: 'Unexpected response shape.' };
      }
      const retrievedAt = this.now();
      const signals: WorldSignal[] = [];
      for (const raw of rawList.slice(0, MAX_SIGNALS_PER_KIND)) {
        const signal = this.toSignal(raw, kind, retrievedAt);
        // Provenance required — a signal without any source identity is refused.
        if (signal) signals.push(signal);
      }
      return { status: 'AVAILABLE', signals };
    } catch (e) {
      return {
        status: 'ERROR',
        signals: [],
        error: e instanceof Error ? `Source failed: ${e.message}` : 'Source failed.',
      };
    }
  }

  private toSignal(
    raw: unknown,
    requested: WorldSignalKind,
    retrievedAt: string,
  ): WorldSignal | undefined {
    if (typeof raw !== 'object' || raw === null) return undefined;
    const item = raw as RawSignal;
    const title =
      typeof item.title === 'string' ? sanitizeExternalText(item.title, MAX_TITLE_LENGTH) : '';
    const description =
      typeof item.description === 'string'
        ? sanitizeExternalText(item.description, MAX_DESCRIPTION_LENGTH)
        : '';
    if (title.length === 0 && description.length === 0) return undefined;
    const url = typeof item.url === 'string' ? item.url.slice(0, 500) : undefined;
    const sourceId = typeof item.sourceId === 'string' ? item.sourceId.slice(0, 200) : url;
    const publishedAt =
      typeof item.publishedAt === 'string' && item.publishedAt.length > 0
        ? item.publishedAt.slice(0, 64)
        : undefined;
    // Provenance: source identity (url/sourceId) + retrievedAt are REQUIRED.
    // publishedAt is optional but preserved when the source provides it.
    const provenance = [
      sourceId ? `source:${sourceId}` : undefined,
      url ? `url:${url}` : undefined,
      publishedAt ? `published:${publishedAt}` : undefined,
      `retrieved:${retrievedAt}`,
    ]
      .filter((p): p is string => Boolean(p))
      .join(' | ');
    if (!sourceId && !url) return undefined; // no provenance → refused
    const id =
      typeof item.id === 'string' && item.id.length > 0
        ? sanitizeExternalText(item.id, 100)
        : `sig-${retrievedAt.replace(/\D/g, '').slice(-10)}-${Math.random().toString(36).slice(2, 6)}`;
    return {
      id,
      kind: normalizeKind(item.kind, requested),
      title: title.slice(0, MAX_TITLE_LENGTH),
      description: description.slice(0, MAX_DESCRIPTION_LENGTH),
      provenance,
      observedAt: retrievedAt,
    };
  }
}
