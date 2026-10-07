// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · S7.1 — Freelancer.com opportunity source (external DISCOVERY only)
//
// This adapter is the ONE external marketplace integration. It uses the
// OFFICIAL, DOCUMENTED Freelancer.com public API (`developers.freelancer.com`):
//
//     GET {base}/projects/0.1/projects/active/
//     header: freelancer-oauth-v1: <OAuth token>
//
// It performs DISCOVERY ONLY. It does NOT scrape the website, does NOT drive a
// browser, does NOT call an undocumented/private endpoint, and implements NO
// bidding/submission action of any kind. Freelancer.com has not been
// established as authorizing API submission for this deployment, so the
// submission capability is deliberately absent from this module AND from the
// source port it implements — the code cannot bid even by mistake.
//
// Credentials follow the platform's EXISTING environment-credential
// convention (`packages/providers` `resolvePlatformCredential` /
// `platformCredentialEnvKeys`): the value is read from the process environment
// by the composition root, never hard-coded, never logged and never returned
// to a browser. No token is present in this file, in the request URL or in any
// error message.
//
// Honest failure is the contract: this adapter never fabricates a candidate and
// never converts a failure into an empty-but-successful list. Every failure
// carries one of the closed `ExternalSourceFailureCode` values, and when no
// credential is configured the adapter makes NO network call at all and
// reports `SOURCE_NOT_CONFIGURED`.
// ─────────────────────────────────────────────────────────────────────────────

import type { RawExternalOpportunity } from './OpportunitySourceAdapter.js';
import type {
  ExternalCandidatesResult,
  ExternalOpportunitySourcePort,
  ExternalSourceFailure,
  ExternalSourceFailureCode,
} from '../infrastructure/OpportunityMonitoringPorts.js';

/** Adapter identity — becomes the canonical `sourceRef.source`. */
export const FREELANCER_SOURCE_NAME = 'freelancer';

/** Official, documented API base (no private/undocumented host). */
export const FREELANCER_API_BASE_URL = 'https://www.freelancer.com/api';

/** Official, documented active-projects path (Freelancer API v0.1). */
export const FREELANCER_ACTIVE_PROJECTS_PATH = '/projects/0.1/projects/active/';

/** Public project link base — provenance only, never fetched. */
export const FREELANCER_PROJECT_URL_BASE = 'https://www.freelancer.com/projects';

/**
 * Environment keys that provision the Freelancer OAuth token, ordered by
 * precedence. This mirrors the platform's existing credential lookup
 * convention. It is NOT added to `packages/providers`' family table: that
 * table provisions AI PROVIDER families and extending it is a provider
 * architecture change, which S7.1 must not make.
 */
export const FREELANCER_TOKEN_ENV_KEYS: readonly string[] = [
  'FREELANCER_OAUTH_TOKEN',
  'AI_FREELANCER_OAUTH_TOKEN',
];

/** Bounded defaults — a monitoring pass is never an unbounded crawl. */
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
/** Hard cap on the accepted response body (a malformed/hostile source is bounded). */
const MAX_RESPONSE_CHARS = 2_000_000;

/**
 * Resolve the deployment's Freelancer OAuth token from an environment record.
 * Same discipline as the existing `resolvePlatformCredential`: only OWN,
 * non-blank string entries count, so a name like `toString` can never resolve
 * an inherited `Object.prototype` member and report a credential that does not
 * exist. The value is never logged.
 */
export function resolveFreelancerToken(
  env: Record<string, string | undefined>,
): string | undefined {
  const own = new Map<string, string>();
  for (const [name, value] of Object.entries(env)) {
    if (typeof value === 'string' && value.trim() !== '') own.set(name, value);
  }
  for (const name of FREELANCER_TOKEN_ENV_KEYS) {
    const value = own.get(name);
    if (value !== undefined) return value.trim();
  }
  return undefined;
}

/** A typed, secret-free source failure. Never carries the token or the raw body. */
export class ExternalSourceError extends Error {
  readonly code: ExternalSourceFailureCode;
  readonly status: number | undefined;

  constructor(failure: ExternalSourceFailure) {
    super(failure.message);
    this.name = 'ExternalSourceError';
    this.code = failure.code;
    this.status = failure.status;
  }
}

/** The transport this adapter is allowed to use (injectable for hermetic tests). */
export type FreelancerFetch = (
  input: string,
  init: { method: 'GET'; headers: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  statusText?: string;
  text(): Promise<string>;
}>;

export interface FreelancerOpportunitySourceDeps {
  /** The platform credential, resolved from the environment by the caller. */
  token: () => string | undefined;
  /** Defaults to the global `fetch`. Injected by tests at this boundary only. */
  fetchImpl?: FreelancerFetch;
  /** Defaults to the official documented base URL. */
  baseUrl?: string;
  /** Candidates requested per pass (bounded 1..50, default 20). */
  limit?: number;
  /** Bounded wall-clock budget per request. */
  timeoutMs?: number;
}

export interface FreelancerOpportunitySource extends ExternalOpportunitySourcePort {
  /** Compatibility with the EXISTING `OpportunitySourcePort` contract: the same
   *  candidates, but THROWING a typed `ExternalSourceError` on failure. Callers
   *  that must not throw use `fetchCandidates()` below. */
  readonly fetchCandidatesOrThrow: () => Promise<RawExternalOpportunity[]>;
}

// ── The documented response envelope (validated, never assumed) ──────────────

interface FreelancerProject {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  type?: unknown;
  seo_url?: unknown;
  jobs?: unknown;
  budget?: unknown;
  currency?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** The source's stated budget as an HONEST label — never a bare number. */
function budgetLabel(project: FreelancerProject): string | undefined {
  const budget = asRecord(project.budget);
  if (budget === undefined) return undefined;
  const currency = nonEmptyString(asRecord(project.currency)?.code);
  const minimum = asFiniteNumber(budget.minimum);
  const maximum = asFiniteNumber(budget.maximum);
  if (minimum === undefined && maximum === undefined) return undefined;
  const range =
    minimum !== undefined && maximum !== undefined && maximum > minimum
      ? `${minimum}-${maximum}`
      : `${minimum ?? maximum}`;
  return `${range} ${currency ?? ''}`.trim() + ' (budget as stated by Freelancer)';
}

/** Skills the source itself listed — the only capability evidence we may hold. */
function requiredCapabilities(project: FreelancerProject): string[] {
  if (!Array.isArray(project.jobs)) return [];
  const names: string[] = [];
  for (const job of project.jobs) {
    const name = nonEmptyString(asRecord(job)?.name);
    if (name !== undefined) names.push(name);
  }
  return Array.from(new Set(names)).slice(0, 20);
}

/**
 * Map ONE documented Freelancer project onto the EXISTING S7.0 raw contract.
 * `sourceReference` is the source-native project id (`project:<id>`), which is
 * provably STABLE across polls — a title edit can change `seo_url`, so identity
 * never depends on it. The human-readable project URL is carried as `url`
 * (provenance only, never fetched).
 */
export function mapFreelancerProject(project: unknown): RawExternalOpportunity | undefined {
  const p = asRecord(project);
  if (p === undefined) return undefined;
  const id = asFiniteNumber(p.id) ?? nonEmptyString(p.id);
  if (id === undefined) return undefined;
  const title = nonEmptyString(p.title);
  if (title === undefined) return undefined;
  const seo = nonEmptyString(p.seo_url);
  const url = `${FREELANCER_PROJECT_URL_BASE}/${seo ?? String(id)}`;
  const type = nonEmptyString(p.type);
  const budget = budgetLabel(p);
  const capabilities = requiredCapabilities(p);

  return {
    source: FREELANCER_SOURCE_NAME,
    sourceReference: `project:${String(id)}`,
    title,
    // The source may omit the description on a list response; an empty
    // description would be rejected downstream, so we state the honest minimum
    // (the title) rather than inventing prose.
    description: nonEmptyString(p.description) ?? title,
    category: type ?? 'external',
    ...(capabilities.length > 0 ? { requirements: capabilities } : {}),
    url,
    ...(budget !== undefined
      ? { estimatedValue: { label: budget, status: 'ESTIMATED' as const } }
      : {}),
    // The source states neither a risk level nor an automation potential. We
    // never invent either; the canonical model already has UNKNOWN for this.
    riskLevel: 'UNKNOWN' as const,
    automationPotential: 'UNKNOWN' as const,
  };
}

/** Parse the documented envelope. Anything else is a malformed response. */
export function parseFreelancerProjects(body: string): RawExternalOpportunity[] | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }
  const root = asRecord(parsed);
  if (root === undefined) return undefined;
  const result = asRecord(root.result);
  if (result === undefined) return undefined;
  const projects = result.projects;
  if (!Array.isArray(projects)) return undefined;
  const mapped: RawExternalOpportunity[] = [];
  for (const project of projects) {
    const candidate = mapFreelancerProject(project);
    // A malformed PROJECT is skipped, never fabricated; a malformed ENVELOPE
    // (above) is an honest failure.
    if (candidate !== undefined) mapped.push(candidate);
  }
  return mapped;
}

/** Map an HTTP response onto the closed failure set (secret-free messages). */
export function classifyFreelancerStatus(
  status: number,
  statusText: string,
): ExternalSourceFailure {
  if (status === 401 || status === 403) {
    return {
      code: 'SOURCE_AUTH_FAILED',
      message: `The Freelancer API refused the configured credential (${status}).`,
      status,
    };
  }
  if (status === 429) {
    return {
      code: 'SOURCE_RATE_LIMITED',
      message: 'The Freelancer API rate-limited this deployment (429).',
      status,
    };
  }
  if (status === 404 || status === 405 || status === 501) {
    return {
      code: 'UNSUPPORTED_SOURCE_CAPABILITY',
      message: `The Freelancer API does not offer this capability at the configured endpoint (${status}).`,
      status,
    };
  }
  if (status >= 500) {
    return {
      code: 'SOURCE_UNAVAILABLE',
      message: `The Freelancer API is unavailable (${status}${statusText !== '' ? ` ${statusText}` : ''}).`,
      status,
    };
  }
  return {
    code: 'SOURCE_REQUEST_FAILED',
    message: `The Freelancer API request failed (${status}${statusText !== '' ? ` ${statusText}` : ''}).`,
    status,
  };
}

/**
 * Create the Freelancer.com discovery source.
 *
 * Posture: DISCOVERY ONLY. There is no submit/bid/contact method on the
 * returned object, and the ports it satisfies have no such method either.
 */
export function createFreelancerOpportunitySource(
  deps: FreelancerOpportunitySourceDeps,
): FreelancerOpportunitySource {
  const baseUrl = (deps.baseUrl ?? FREELANCER_API_BASE_URL).replace(/\/+$/, '');
  const limit = Math.max(1, Math.min(MAX_LIMIT, deps.limit ?? DEFAULT_LIMIT));
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // The global fetch is structurally compatible with the narrow transport this
  // adapter needs, and this package declares Node >= 22 — where fetch is always
  // present — so no assertion and no unreachable guard are needed. A caller may
  // still inject its own transport.
  const fetchImpl: FreelancerFetch = deps.fetchImpl ?? globalThis.fetch;

  /** Whether a usable credential exists right now (never a guess). */
  const hasCredential = (): boolean => Boolean(deps.token());

  const fetchOrThrow = async (): Promise<RawExternalOpportunity[]> => {
    const token = deps.token();
    // A non-string resolution can never be used as a credential value.
    if (typeof token !== 'string') {
      // No credential → NO request is made. Monitoring is honestly OFF.
      throw new ExternalSourceError({
        code: 'SOURCE_NOT_CONFIGURED',
        message:
          'No Freelancer API credential is configured (FREELANCER_OAUTH_TOKEN). Discovery is disabled until an operator provisions it.',
      });
    }
    const params = new URLSearchParams({
      limit: String(limit),
      offset: '0',
      // Ask the API for the fields this adapter actually maps.
      full_description: 'true',
      job_details: 'true',
    });
    const url = `${baseUrl}${FREELANCER_ACTIVE_PROJECTS_PATH}?${params.toString()}`;

    let response: Awaited<ReturnType<FreelancerFetch>>;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          // Official Freelancer API v0.1 authentication header.
          'freelancer-oauth-v1': token,
          Accept: 'application/json',
        },
        signal:
          typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
            ? AbortSignal.timeout(timeoutMs)
            : undefined,
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new ExternalSourceError({
          code: 'SOURCE_TIMEOUT',
          message: `The Freelancer API did not answer within ${timeoutMs}ms.`,
        });
      }
      // Never echo the URL or the token — only the transport's own message.
      throw new ExternalSourceError({
        code: 'SOURCE_UNAVAILABLE',
        message: `The Freelancer API could not be reached: ${
          error instanceof Error ? error.message : 'unknown transport error'
        }`,
      });
    }

    if (!response.ok) {
      throw new ExternalSourceError(
        classifyFreelancerStatus(response.status, response.statusText ?? ''),
      );
    }

    let body: string;
    try {
      body = await response.text();
    } catch {
      throw new ExternalSourceError({
        code: 'SOURCE_REQUEST_FAILED',
        message: 'The Freelancer API response body could not be read.',
      });
    }
    if (body.length > MAX_RESPONSE_CHARS) {
      throw new ExternalSourceError({
        code: 'MALFORMED_SOURCE_RESPONSE',
        message: 'The Freelancer API response exceeded the accepted size bound.',
      });
    }
    const projects = parseFreelancerProjects(body);
    if (projects === undefined) {
      throw new ExternalSourceError({
        code: 'MALFORMED_SOURCE_RESPONSE',
        message: 'The Freelancer API returned an unexpected response envelope.',
      });
    }
    return projects;
  };

  return {
    name: FREELANCER_SOURCE_NAME,
    get status(): { configured: boolean; reason: string } {
      return hasCredential()
        ? { configured: true, reason: 'Freelancer API credential is configured.' }
        : {
            configured: false,
            reason:
              'No Freelancer API credential is configured — discovery is disabled (no request is made).',
          };
    },
    /** Honest, NON-THROWING result — the shape the monitoring pass consumes. */
    fetchCandidates: async (): Promise<ExternalCandidatesResult> => {
      try {
        return { success: true, candidates: await fetchOrThrow() };
      } catch (error) {
        if (error instanceof ExternalSourceError) {
          return {
            success: false,
            code: error.code,
            message: error.message,
            ...(error.status !== undefined ? { status: error.status } : {}),
          };
        }
        return {
          success: false,
          code: 'SOURCE_REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown source failure.',
        };
      }
    },
    /** The EXISTING `OpportunitySourcePort` contract (throwing variant). */
    fetchCandidatesOrThrow: fetchOrThrow,
  };
}
