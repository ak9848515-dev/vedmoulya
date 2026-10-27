// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · GitHub & Algora Bounty Opportunity Source
//
// Ingests open-source issue bounties (Algora / GitHub bounties) into the
// canonical OpportunityLifecycleRecord pipeline via ExternalOpportunitySourcePort.
//
// DISCOVERY ONLY:
//   • Never auto-bids, never comments on GitHub, never claims bounties autonomously.
//   • Ingests into DISCOVERED -> requires operator consent to proceed to Mission.
//   • Respects GitHub REST rate-limits and sanitizes all inputs.
// ─────────────────────────────────────────────────────────────────────────────

import type { RawExternalOpportunity } from './OpportunitySourceAdapter.js';
import type {
  ExternalCandidatesResult,
  ExternalOpportunitySourcePort,
} from '../infrastructure/OpportunityMonitoringPorts.js';

export const GITHUB_BOUNTY_SOURCE_NAME = 'github-bounty';
export const GITHUB_API_SEARCH_URL = 'https://api.github.com/search/issues';

export const GITHUB_TOKEN_ENV_KEYS: readonly string[] = [
  'GITHUB_TOKEN',
  'AI_GITHUB_TOKEN',
  'GH_TOKEN',
];

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface GitHubBountySourceOptions {
  token?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  query?: string;
}

interface GitHubIssueItem {
  id: number;
  number: number;
  title: string;
  body?: string | null;
  html_url: string;
  state: string;
  labels?: Array<{ name: string; description?: string | null }>;
  created_at: string;
  updated_at: string;
  repository_url: string;
}

export function resolveGitHubToken(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  if (typeof env.GITHUB_TOKEN === 'string' && env.GITHUB_TOKEN.trim() !== '') {
    return env.GITHUB_TOKEN.trim();
  }
  if (typeof env.AI_GITHUB_TOKEN === 'string' && env.AI_GITHUB_TOKEN.trim() !== '') {
    return env.AI_GITHUB_TOKEN.trim();
  }
  if (typeof env.GH_TOKEN === 'string' && env.GH_TOKEN.trim() !== '') {
    return env.GH_TOKEN.trim();
  }
  return undefined;
}

export class GitHubBountyOpportunitySource implements ExternalOpportunitySourcePort {
  readonly name = GITHUB_BOUNTY_SOURCE_NAME;
  private readonly token: string | undefined;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly query: string;

  constructor(options: GitHubBountySourceOptions = {}) {
    this.token = options.token ?? resolveGitHubToken();
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.query = options.query ?? 'is:issue is:open label:bounty';
  }

  get status(): { configured: boolean; reason: string } {
    return {
      configured: true,
      reason: this.token
        ? 'GitHub authenticated token configured for bounties'
        : 'GitHub public rate-limited unauthenticated discovery active',
    };
  }

  async fetchCandidates(options?: { limit?: number }): Promise<ExternalCandidatesResult> {
    const limit = Math.min(Math.max(1, options?.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const searchUrl = `${GITHUB_API_SEARCH_URL}?q=${encodeURIComponent(
      this.query,
    )}&sort=updated&order=desc&per_page=${String(limit)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'VedMoulya-BountyRadar/1.0',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await this.fetchFn(searchUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
          if (rateLimitRemaining === '0') {
            return {
              success: false,
              code: 'SOURCE_RATE_LIMITED',
              message: 'GitHub API rate limit exceeded. Retry after reset.',
              status: 429,
            };
          }
          return {
            success: false,
            code: 'SOURCE_AUTH_FAILED',
            message: 'GitHub credentials rejected or unauthorized.',
            status: response.status,
          };
        }
        if (response.status === 429) {
          return {
            success: false,
            code: 'SOURCE_RATE_LIMITED',
            message: 'GitHub API rate limit exceeded.',
            status: 429,
          };
        }
        return {
          success: false,
          code: 'SOURCE_UNAVAILABLE',
          message: `GitHub search failed with status ${String(response.status)}`,
          status: response.status,
        };
      }

      const json = (await response.json()) as { items?: unknown };
      if (!Array.isArray(json.items)) {
        return {
          success: false,
          code: 'MALFORMED_SOURCE_RESPONSE',
          message: 'GitHub response did not contain expected items array',
        };
      }

      const candidates: RawExternalOpportunity[] = [];
      for (const item of json.items as GitHubIssueItem[]) {
        const candidate = this.mapIssueToOpportunity(item);
        if (candidate) {
          candidates.push(candidate);
        }
      }

      return {
        success: true,
        candidates,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          code: 'SOURCE_TIMEOUT',
          message: `GitHub bounty fetch exceeded ${String(this.timeoutMs)}ms limit`,
        };
      }
      return {
        success: false,
        code: 'SOURCE_REQUEST_FAILED',
        message: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private mapIssueToOpportunity(item: GitHubIssueItem): RawExternalOpportunity | undefined {
    const rawTitle = item.title.trim();
    const rawBody = (item.body ?? '').trim();
    if (!rawTitle) return undefined;

    // Detect dollar bounty from labels, title, or body
    const labelNames = (item.labels ?? []).map((l) => l.name);
    const combinedText = `${rawTitle} ${labelNames.join(' ')} ${rawBody.slice(0, 1000)}`;

    const bountyMatch =
      combinedText.match(/\b(?:bounty|reward)[:\s]*\$?([0-9,]+)\b/i) ||
      combinedText.match(/\$([0-9,]+)\s*(?:bounty|reward)?/i);

    let estimatedValue: RawExternalOpportunity['estimatedValue'] = undefined;
    if (bountyMatch && bountyMatch[1]) {
      const parsedAmount = Number(bountyMatch[1].replace(/,/g, ''));
      if (Number.isFinite(parsedAmount) && parsedAmount > 0) {
        estimatedValue = {
          label: `$${String(parsedAmount)} bounty`,
          status: 'VERIFIED',
        };
      }
    }

    const repoSlug = item.repository_url.replace(/^.*\/repos\//, '');
    const cleanDescription =
      rawBody.length > 0
        ? rawBody.slice(0, 4000)
        : `GitHub issue #${String(item.number)} on ${repoSlug}`;

    return {
      source: this.name,
      sourceReference: item.html_url,
      title: `[${repoSlug}] ${rawTitle}`,
      description: cleanDescription,
      category: 'software-bounty',
      url: item.html_url,
      requirements: labelNames.filter((l) => !/bounty/i.test(l)).slice(0, 10),
      estimatedValue,
      riskLevel: 'LOW',
      automationPotential: 'HIGH',
    };
  }
}
