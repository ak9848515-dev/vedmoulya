// ──────────────────────────────────────────────────────────────────
// VedMoulya — services/api · Ecosystem Intelligence gateway ports
// EPIC-015
//
// The ONLY seams the Intelligence layer uses to reach the frozen
// estate from the gateway:
//   • candidate sources (providers / AI World / local models) → the
//     SAME capability-source seam the planner, execution bridge and
//     Brain reuse (zero duplication).
//   • preference ledger → the EPIC-014 in-memory ledger through the
//     Brain's preference port adapter.
//   • GitHub auth → deterministic adapter (live GitHub App exchange is
//     an OPERATOR step; the port is ready for a real adapter).
//   • GitHub repository facts → mapped from the AI World discovery
//     store (public repos are platform-wide facts; private repos only
//     surface under an explicit private_repos_read grant).
// Tokens/codes never cross these ports — only opaque refs + metadata.
// ──────────────────────────────────────────────────────────────────

import type {
  GitHubAuthPort,
  GitHubRepoFacts,
  GitHubRepoSourcePort,
} from '@vedmoulya/ecosystem-intelligence';
import type { GitHubPermissionScope } from '@vedmoulya/ecosystem-intelligence';
import type { DiscoveryApplicationService } from '@vedmoulya/ai-world';
import type { GitHubConnection } from '@vedmoulya/ecosystem-intelligence';

/**
 * Deterministic GitHub auth adapter. In hermetic CI (no credentials) the
 * authorization flow completes against the reviewed scope set. A live
 * GitHub App adapter replaces this at the operator step — the port
 * contract (tokens server-side only, granted scopes never broader than
 * requested) is unchanged.
 */
export function createGitHubAuthPort(): GitHubAuthPort {
  return {
    beginAuthorization: (
      userId,
      requestedScopes,
    ): Promise<{ authorizationUrl: string; state: string }> => {
      const state = `state-${userId}-${Date.now().toString(36)}`;
      const scope = requestedScopes.join('+');
      return Promise.resolve({
        authorizationUrl: `https://github.com/login/oauth/authorize?client_id=vedmoulya&scope=${scope}&state=${state}`,
        state,
      });
    },
    completeAuthorization: (
      _userId: string,
      _code: string,
      _state: string,
    ): Promise<{ accountLogin: string; grantedScopes: GitHubPermissionScope[] }> => {
      // Deterministic: the GitHub App grants exactly the reviewed scopes.
      return Promise.resolve({
        accountLogin: 'vedmoulya-operator',
        grantedScopes: ['public_metadata'],
      });
    },
    verify: (
      _userId: string,
    ): Promise<{ valid: boolean; login?: string; lastVerifiedAt: string }> => {
      return Promise.resolve({
        valid: true,
        login: 'vedmoulya-operator',
        lastVerifiedAt: new Date().toISOString(),
      });
    },
    revoke: (_userId: string): Promise<void> => {
      // no-op in the deterministic adapter — revoke is recorded locally.
      return Promise.resolve();
    },
  };
}

/**
 * Repository facts sourced from the AI World discovery store. Public
 * repositories are platform-wide facts; private access only surfaces
 * when the connection carries an explicit private_repos_read grant.
 * Metadata is read-only — never credentials.
 */
export function createGitHubRepoSourcePort(
  aiWorld: DiscoveryApplicationService,
): GitHubRepoSourcePort {
  return {
    list: async (_userId: string, connection: GitHubConnection): Promise<GitHubRepoFacts[]> => {
      const views = await aiWorld.listItems(_userId);
      const githubItems = views.map((v) => v.item).filter((item) => item.category === 'github');

      const repos: GitHubRepoFacts[] = githubItems.map((item) => ({
        fullName: item.github?.name ?? item.title,
        visibility: 'public',
        description: item.summary,
        language: item.github?.language,
        stars: item.github?.stars,
        forks: item.github?.forks,
        lastCommitAt: item.github?.lastCommitAt,
        license: item.github?.license,
        defaultBranch: 'main',
        archived: item.github?.flags.includes('abandoned') ?? false,
        allowedActions: ['read', 'clone'],
      }));

      // Private repos only when explicitly authorized — never implied.
      if (!connection.grantedScopes.includes('private_repos_read')) {
        return repos.filter((r) => r.visibility === 'public');
      }
      return repos;
    },
  };
}
