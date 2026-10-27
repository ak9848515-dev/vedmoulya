import { describe, expect, it, vi } from 'vitest';
import {
  GitHubBountyOpportunitySource,
  GITHUB_BOUNTY_SOURCE_NAME,
  resolveGitHubToken,
} from '../services/GitHubBountyOpportunitySource.js';
import { normalizeExternalOpportunity } from '../services/OpportunitySourceAdapter.js';

describe('GitHubBountyOpportunitySource', () => {
  it('resolves token from environment keys with proper precedence', () => {
    expect(resolveGitHubToken({ GITHUB_TOKEN: 'gh_123' })).toBe('gh_123');
    expect(resolveGitHubToken({ AI_GITHUB_TOKEN: 'ai_gh_456' })).toBe('ai_gh_456');
    expect(resolveGitHubToken({ GH_TOKEN: 'gh_789' })).toBe('gh_789');
    expect(resolveGitHubToken({ GITHUB_TOKEN: 'gh_first', GH_TOKEN: 'gh_second' })).toBe(
      'gh_first',
    );
    expect(resolveGitHubToken({})).toBeUndefined();
  });

  it('exposes status correctly for configured token vs public unauthenticated', () => {
    const publicSource = new GitHubBountyOpportunitySource({ token: undefined });
    expect(publicSource.status.configured).toBe(true);
    expect(publicSource.status.reason).toContain('public rate-limited');

    const authSource = new GitHubBountyOpportunitySource({ token: 'ghp_secret' });
    expect(authSource.status.configured).toBe(true);
    expect(authSource.status.reason).toContain('authenticated token configured');
  });

  it('successfully fetches and maps GitHub bounty issues to canonical candidates', async () => {
    const mockItems = [
      {
        id: 101,
        number: 42,
        title: 'Add support for WebSockets in TypeScript client',
        body: 'We are placing a bounty on this issue. Reward: $500 upon PR merge.',
        html_url: 'https://github.com/acme/sdk/issues/42',
        state: 'open',
        labels: [{ name: 'bounty' }, { name: 'typescript' }, { name: 'enhancement' }],
        created_at: '2026-10-25T10:00:00Z',
        updated_at: '2026-10-26T12:00:00Z',
        repository_url: 'https://api.github.com/repos/acme/sdk',
      },
      {
        id: 102,
        number: 88,
        title: 'Fix race condition in redis lock',
        body: 'Bounty: $250. Fix must be verified with tests.',
        html_url: 'https://github.com/acme/backend/issues/88',
        state: 'open',
        labels: [{ name: 'bounty: $250' }, { name: 'bug' }],
        created_at: '2026-10-25T11:00:00Z',
        updated_at: '2026-10-26T13:00:00Z',
        repository_url: 'https://api.github.com/repos/acme/backend',
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        total_count: 2,
        incomplete_results: false,
        items: mockItems,
      }),
    });

    const source = new GitHubBountyOpportunitySource({
      token: 'ghp_test',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await source.fetchCandidates({ limit: 10 });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.candidates).toHaveLength(2);

    const first = result.candidates[0]!;
    expect(first.source).toBe(GITHUB_BOUNTY_SOURCE_NAME);
    expect(first.title).toBe('[acme/sdk] Add support for WebSockets in TypeScript client');
    expect(first.sourceReference).toBe('https://github.com/acme/sdk/issues/42');
    expect(first.category).toBe('software-bounty');
    expect(first.estimatedValue).toEqual({
      label: '$500 bounty',
      status: 'VERIFIED',
    });
    expect(first.requirements).toContain('typescript');
    expect(first.requirements).toContain('enhancement');

    // Verify it normalizes through canonical normalizer
    const norm = normalizeExternalOpportunity(first);
    expect(norm.success).toBe(true);

    const second = result.candidates[1]!;
    expect(second.estimatedValue).toEqual({
      label: '$250 bounty',
      status: 'VERIFIED',
    });
  });

  it('handles rate limits honestly with SOURCE_RATE_LIMITED', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ 'x-ratelimit-remaining': '0' }),
    });

    const source = new GitHubBountyOpportunitySource({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await source.fetchCandidates();
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('SOURCE_RATE_LIMITED');
  });

  it('handles timeout honestly with SOURCE_TIMEOUT', async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const source = new GitHubBountyOpportunitySource({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await source.fetchCandidates();
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('SOURCE_TIMEOUT');
  });
});
