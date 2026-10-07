// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S7.1 · Freelancer.com opportunity source (official API, DISCOVERY only)
//
// Proves the external boundary is honest, bounded and safe:
//   • the OFFICIAL documented endpoint + the official auth header are used
//   • no credential → NO request is made (never a fake empty success)
//   • every failure mode maps onto the closed failure set, secret-free
//   • the credential never appears in the URL or in any error message
//   • mapping into the EXISTING S7.0 raw contract preserves stable identity
//   • the adapter offers NO submission/bid/contact capability at all
//
// The HTTP transport is the ONLY double — exactly the external boundary.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  FREELANCER_ACTIVE_PROJECTS_PATH,
  FREELANCER_SOURCE_NAME,
  createFreelancerOpportunitySource,
  mapFreelancerProject,
  parseFreelancerProjects,
  resolveFreelancerToken,
  type FreelancerFetch,
} from '../services/FreelancerOpportunitySource.js';
import { normalizeExternalOpportunity } from '../services/OpportunitySourceAdapter.js';

const TOKEN = 'test-oauth-token-abcdef123456';

/** One documented-shape Freelancer active project. */
const PROJECT = {
  id: 4209911,
  title: 'Build a TypeScript reporting CLI',
  description: 'Recursively report on a project directory.',
  type: 'fixed',
  seo_url: 'typescript/reporting-cli',
  jobs: [{ name: 'TypeScript' }, { name: 'Node.js' }],
  budget: { minimum: 500, maximum: 1000 },
  currency: { code: 'USD' },
};

function ok(body: unknown, status = 200): Awaited<ReturnType<FreelancerFetch>> {
  return {
    ok: true,
    status,
    statusText: 'OK',
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function fail(status: number, statusText = 'Error'): Awaited<ReturnType<FreelancerFetch>> {
  return { ok: false, status, statusText, text: async () => '' };
}

/** A transport double that records exactly what the adapter sent. */
function transport(response: Awaited<ReturnType<FreelancerFetch>> | (() => never)) {
  const calls: Array<{ url: string; init: { method: string; headers: Record<string, string> } }> =
    [];
  const fetchImpl: FreelancerFetch = async (url, init) => {
    calls.push({ url, init });
    if (typeof response === 'function') return (response as () => never)();
    return response;
  };
  return { fetchImpl, calls };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.1 — Freelancer credential resolution (existing env convention)', () => {
  it('1. resolves the documented env keys in precedence order, ignoring blanks', () => {
    expect(resolveFreelancerToken({ FREELANCER_OAUTH_TOKEN: TOKEN })).toBe(TOKEN);
    expect(resolveFreelancerToken({ AI_FREELANCER_OAUTH_TOKEN: TOKEN })).toBe(TOKEN);
    expect(
      resolveFreelancerToken({ FREELANCER_OAUTH_TOKEN: TOKEN, AI_FREELANCER_OAUTH_TOKEN: 'other' }),
    ).toBe(TOKEN);
    expect(resolveFreelancerToken({ FREELANCER_OAUTH_TOKEN: '   ' })).toBeUndefined();
    expect(resolveFreelancerToken({})).toBeUndefined();
  });

  it('2. an inherited/prototype-shaped env name can never resolve a credential', () => {
    expect(resolveFreelancerToken({ toString: 'sneaky' })).toBeUndefined();
  });

  it('3. no hard-coded credential exists in the module source', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(
        new URL('../services/FreelancerOpportunitySource.ts', import.meta.url),
        'utf8',
      ),
    );
    // The only token references are the env KEY names and the parameter name.
    expect(src).not.toMatch(/FREELANCER_OAUTH_TOKEN\s*[:=]\s*['"][^'"]+['"]/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.1 — Freelancer source: configuration honesty', () => {
  it('4. with NO credential the source is not configured and makes NO request', async () => {
    const { fetchImpl, calls } = transport(ok({ result: { projects: [PROJECT] } }));
    const source = createFreelancerOpportunitySource({ token: () => undefined, fetchImpl });
    expect(source.status.configured).toBe(false);
    expect(source.status.reason).toMatch(/no freelancer api credential/i);
    const result = await source.fetchCandidates();
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('SOURCE_NOT_CONFIGURED');
    // The hard guarantee: no network call at all.
    expect(calls).toHaveLength(0);
  });

  it('5. a configured source reports itself configured', () => {
    const source = createFreelancerOpportunitySource({ token: () => TOKEN });
    expect(source.status.configured).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.1 — Freelancer source: the official documented request', () => {
  it('6. GETs the documented v0.1 endpoint with the official auth header and a bounded limit', async () => {
    const { fetchImpl, calls } = transport(ok({ result: { projects: [PROJECT] } }));
    const source = createFreelancerOpportunitySource({ token: () => TOKEN, fetchImpl, limit: 10 });
    const result = await source.fetchCandidates();
    expect(result.success).toBe(true);
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.init.method).toBe('GET');
    // OFFICIAL host + path (no scraping, no undocumented endpoint).
    expect(call.url.startsWith('https://www.freelancer.com/api')).toBe(true);
    expect(call.url).toContain(FREELANCER_ACTIVE_PROJECTS_PATH);
    // OFFICIAL authentication header.
    expect(call.init.headers['freelancer-oauth-v1']).toBe(TOKEN);
    // Bounded: the asked-for limit is capped.
    const limitParam = new URL(call.url).searchParams.get('limit');
    expect(limitParam).toBe('10');
  });

  it('7. the credential is never placed in the request URL', async () => {
    const { fetchImpl, calls } = transport(ok({ result: { projects: [PROJECT] } }));
    const source = createFreelancerOpportunitySource({ token: () => TOKEN, fetchImpl });
    await source.fetchCandidates();
    expect(calls[0]!.url).not.toContain(TOKEN);
  });

  it('8. an oversized limit is clamped to the hard cap', async () => {
    const { fetchImpl, calls } = transport(ok({ result: { projects: [] } }));
    const source = createFreelancerOpportunitySource({
      token: () => TOKEN,
      fetchImpl,
      limit: 5000,
    });
    await source.fetchCandidates();
    expect(new URL(calls[0]!.url).searchParams.get('limit')).toBe('50');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.1 — Freelancer source: mapping into the existing contract', () => {
  it('9. a documented project maps with STABLE identity and provenance URL', async () => {
    const { fetchImpl } = transport(ok({ result: { projects: [PROJECT] } }));
    const source = createFreelancerOpportunitySource({ token: () => TOKEN, fetchImpl });
    const result = await source.fetchCandidates();
    expect(result.success).toBe(true);
    if (!result.success) return;
    const candidate = result.candidates[0]!;
    expect(candidate.source).toBe(FREELANCER_SOURCE_NAME);
    // Stable source-native identity — independent of the (editable) seo slug.
    expect(candidate.sourceReference).toBe('project:4209911');
    expect(candidate.url).toBe('https://www.freelancer.com/projects/typescript/reporting-cli');
    expect(candidate.requirements).toEqual(['TypeScript', 'Node.js']);
    expect(candidate.estimatedValue?.status).toBe('ESTIMATED');
    expect(candidate.estimatedValue?.label).toContain('500-1000 USD');
    // The source states neither risk nor automation potential — never invented.
    expect(candidate.riskLevel).toBe('UNKNOWN');
    expect(candidate.automationPotential).toBe('UNKNOWN');
  });

  it('10. a mapped project passes the EXISTING S7.0 normalizer + secret gate', async () => {
    const { fetchImpl } = transport(ok({ result: { projects: [PROJECT] } }));
    const source = createFreelancerOpportunitySource({ token: () => TOKEN, fetchImpl });
    const result = await source.fetchCandidates();
    expect(result.success).toBe(true);
    if (!result.success) return;
    const normalized = normalizeExternalOpportunity(result.candidates[0]);
    expect(normalized.success).toBe(true);
    if (!normalized.success) return;
    expect(normalized.data.sourceRef).toEqual({
      source: 'freelancer',
      sourceReference: 'project:4209911',
    });
    expect(normalized.data.requiredCapabilities).toEqual(['typescript', 'node.js']);
  });

  it('11. a project with no stated budget carries NO value label (never a guess)', () => {
    const { budget: _budget, currency: _currency, ...noBudget } = PROJECT;
    const candidate = mapFreelancerProject(noBudget);
    expect(candidate?.estimatedValue).toBeUndefined();
    expect(candidate?.estimatedEffort).toBeUndefined();
  });

  it('12. an hourly project without a budget range is still discovered honestly', () => {
    const candidate = mapFreelancerProject({ ...PROJECT, type: 'hourly', budget: undefined });
    expect(candidate?.category).toBe('hourly');
    expect(candidate?.estimatedValue).toBeUndefined();
  });

  it('13. a malformed PROJECT is skipped, and a malformed ENVELOPE is an honest failure', () => {
    // No id → not a usable candidate.
    expect(mapFreelancerProject({ title: 'no id' })).toBeUndefined();
    // No title → not a usable candidate.
    expect(mapFreelancerProject({ id: 1 })).toBeUndefined();
    // A missing description falls back to the title (honest minimum), not prose.
    expect(mapFreelancerProject({ id: 1, title: 'T' })?.description).toBe('T');

    expect(parseFreelancerProjects('{"result":{"projects":[{"title":"x"}]}}')).toEqual([]);
    expect(parseFreelancerProjects('{"result":{}}')).toBeUndefined();
    expect(parseFreelancerProjects('not json')).toBeUndefined();
    expect(parseFreelancerProjects('[]')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.1 — Freelancer source: honest failure classification', () => {
  const cases: Array<[number, string]> = [
    [401, 'SOURCE_AUTH_FAILED'],
    [403, 'SOURCE_AUTH_FAILED'],
    [429, 'SOURCE_RATE_LIMITED'],
    [500, 'SOURCE_UNAVAILABLE'],
    [503, 'SOURCE_UNAVAILABLE'],
    [404, 'UNSUPPORTED_SOURCE_CAPABILITY'],
    [400, 'SOURCE_REQUEST_FAILED'],
  ];

  it('14. every HTTP failure maps onto the closed failure set (secret-free message)', async () => {
    for (const [status, code] of cases) {
      const { fetchImpl } = transport(fail(status));
      const source = createFreelancerOpportunitySource({ token: () => TOKEN, fetchImpl });
      const result = await source.fetchCandidates();
      expect(result.success).toBe(false);
      if (result.success) continue;
      expect(result.code).toBe(code);
      expect(result.status).toBe(status);
      // Never echo the credential.
      expect(result.message).not.toContain(TOKEN);
    }
  });

  it('15. a malformed response body is reported, never parsed into candidates', async () => {
    for (const body of ['not json', '{"result":{}}', '{"unexpected":true}']) {
      const { fetchImpl } = transport(ok(body));
      const source = createFreelancerOpportunitySource({ token: () => TOKEN, fetchImpl });
      const result = await source.fetchCandidates();
      expect(result.success).toBe(false);
      if (result.success) continue;
      expect(result.code).toBe('MALFORMED_SOURCE_RESPONSE');
    }
  });

  it('16. an oversized response body is refused', async () => {
    const { fetchImpl } = transport(
      ok(`{"result":{"projects":[]},"pad":"${'a'.repeat(2_100_000)}"}`),
    );
    const source = createFreelancerOpportunitySource({ token: () => TOKEN, fetchImpl });
    const result = await source.fetchCandidates();
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('MALFORMED_SOURCE_RESPONSE');
  });

  it('17. a timeout is reported as SOURCE_TIMEOUT', async () => {
    const { fetchImpl } = transport(() => {
      const error = new Error('The operation was aborted due to timeout');
      error.name = 'TimeoutError';
      throw error;
    });
    const source = createFreelancerOpportunitySource({
      token: () => TOKEN,
      fetchImpl,
      timeoutMs: 5,
    });
    const result = await source.fetchCandidates();
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('SOURCE_TIMEOUT');
  });

  it('18. a transport error is reported as SOURCE_UNAVAILABLE without leaking the URL', async () => {
    const { fetchImpl } = transport(() => {
      throw new Error('getaddrinfo ENOTFOUND www.freelancer.com');
    });
    const source = createFreelancerOpportunitySource({ token: () => TOKEN, fetchImpl });
    const result = await source.fetchCandidates();
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('SOURCE_UNAVAILABLE');
    expect(result.message).not.toContain(TOKEN);
  });

  it('19. the throwing (existing OpportunitySourcePort) variant surfaces the typed error', async () => {
    const { fetchImpl } = transport(fail(401));
    const source = createFreelancerOpportunitySource({ token: () => TOKEN, fetchImpl });
    await expect(source.fetchCandidatesOrThrow()).rejects.toMatchObject({
      code: 'SOURCE_AUTH_FAILED',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.1 — Freelancer source: DISCOVERY ONLY (no autonomous action)', () => {
  it('20. the adapter exposes no submission, bid or contact capability', () => {
    const source = createFreelancerOpportunitySource({ token: () => TOKEN });
    const surface = source as unknown as Record<string, unknown>;
    for (const forbidden of [
      'submit',
      'bid',
      'placeBid',
      'sendMessage',
      'contact',
      'pay',
      'accept',
    ]) {
      expect(surface[forbidden]).toBeUndefined();
    }
    // The entire public surface is exactly: discovery + identity + status.
    expect(Object.keys(surface).sort()).toEqual([
      'fetchCandidates',
      'fetchCandidatesOrThrow',
      'name',
      'status',
    ]);
  });
});
