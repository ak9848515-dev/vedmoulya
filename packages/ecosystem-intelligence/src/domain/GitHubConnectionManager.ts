// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence
// GitHubConnectionManager — EPIC-015
//
// GitHub is connected SEPARATELY from Google auth — the Google identity
// token is never reused as a GitHub credential. The default scope is
// public_metadata (public discovery needs NO repo access). Private
// repos and write access require EXPLICIT user authorization; write
// access is never obtained silently. Tokens never live here — only an
// opaque tokenRef into the server-side credential store.
// ──────────────────────────────────────────────────────────────────

import type {
  GitHubConnection,
  GitHubConnectionState,
  GitHubPermissionScope,
} from '../types/intelligence-types.js';
import type { ClockPort } from '../contracts/intelligence-ports.js';

/** The sanitized, token-free permission view rendered to the UI. */
export interface GitHubPermissionView {
  state: GitHubConnectionState;
  accountLogin?: string;
  grantedScopes: GitHubPermissionScope[];
  authorizedScopes: GitHubPermissionScope[];
  lastVerifiedAt?: string;
  connectedAt?: string;
  canDiscoverPublic: boolean;
  canReadPrivateRepos: boolean;
  canWriteRepos: boolean;
  requiresVerification: boolean;
}

// ── Least-privilege policy ─────────────────────────────────────────
// public_metadata: always allowed (discovery of public repos).
// public_repos_read: read-only, explicit.
// private_repos_read: explicit authorization, never implied by public.
// repos_write: separate + explicit — NEVER silent.
const MINIMAL_SCOPES: readonly GitHubPermissionScope[] = ['public_metadata'];

const EXPLICIT_APPROVAL_SCOPES: readonly GitHubPermissionScope[] = [
  'public_repos_read',
  'private_repos_read',
  'repos_write',
  'orgs_read',
];

/** Access is granted ONLY for scopes the user explicitly authorized. */
export function effectiveGrantedScopes(
  requested: readonly GitHubPermissionScope[],
  granted: readonly GitHubPermissionScope[],
): GitHubPermissionScope[] {
  const grantedSet = new Set(granted);
  return requested.filter((scope) => grantedSet.has(scope));
}

export function isWriteScope(scope: GitHubPermissionScope): boolean {
  return scope === 'repos_write';
}

export class GitHubConnectionManager {
  constructor(private readonly clock: ClockPort) {}

  /** A fresh connection for a user who has never connected. */
  disconnected(userId: string): GitHubConnection {
    return {
      userId,
      state: 'DISCONNECTED',
      grantedScopes: [],
      authorizedScopes: [],
      updatedAt: this.clock.now(),
    };
  }

  /**
   * Begin authorization. Returns the user-facing URL (rendered by the
   * gateway from the auth port) and records the requested scopes.
   * MINIMAL scopes are the default; private/write scopes must be
   * requested explicitly by the user (never inferred from the task).
   */
  beginAuthorization(
    current: GitHubConnection | undefined,
    userId: string,
    requestedScopes: GitHubPermissionScope[],
  ): { connection: GitHubConnection; requested: GitHubPermissionScope[] } {
    const scopes = requestedScopes.length > 0 ? requestedScopes : [...MINIMAL_SCOPES];
    // Never silently broaden a previous grant — only the requested set is pending.
    const connection: GitHubConnection = {
      userId,
      state: 'AUTHORIZING',
      authorizedScopes: [...scopes],
      grantedScopes: [],
      updatedAt: this.clock.now(),
      ...(current?.tokenRef ? { tokenRef: current.tokenRef } : {}),
    };
    return { connection, requested: scopes };
  }

  /**
   * Complete authorization from the auth port. Granted scopes are
   * always the intersection of requested and provider-granted — never
   * broader than what the user reviewed.
   */
  completeAuthorization(
    pending: GitHubConnection | undefined,
    userId: string,
    accountLogin: string,
    providerGrantedScopes: GitHubPermissionScope[],
  ): GitHubConnection {
    const requested = pending?.authorizedScopes ?? [];
    const granted = effectiveGrantedScopes(requested, providerGrantedScopes);
    const now = this.clock.now();
    return {
      userId,
      state: granted.length > 0 ? 'CONNECTED' : 'REVOKED',
      accountLogin,
      grantedScopes: granted,
      authorizedScopes: [...requested],
      lastVerifiedAt: now,
      connectedAt: now,
      tokenRef: pending?.tokenRef ?? `github:${userId}`,
      updatedAt: now,
    };
  }

  verify(connection: GitHubConnection, valid: boolean, login?: string): GitHubConnection {
    if (!valid) {
      return { ...connection, state: 'EXPIRED', updatedAt: this.clock.now() };
    }
    return {
      ...connection,
      state: 'CONNECTED',
      accountLogin: login ?? connection.accountLogin,
      lastVerifiedAt: this.clock.now(),
      updatedAt: this.clock.now(),
    };
  }

  revoke(connection: GitHubConnection): GitHubConnection {
    if (connection.state === 'DISCONNECTED') return connection;
    return {
      ...connection,
      state: 'REVOKED',
      grantedScopes: [],
      updatedAt: this.clock.now(),
    };
  }

  disconnect(connection: GitHubConnection): GitHubConnection {
    return {
      ...connection,
      state: 'DISCONNECTED',
      grantedScopes: [],
      authorizedScopes: [],
      tokenRef: undefined,
      updatedAt: this.clock.now(),
    };
  }

  /**
   * The permission view rendered to the user. Public discovery is free;
   * everything else is listed explicitly with the boundary. Never
   * includes token refs or any secret.
   */
  permissionView(connection: GitHubConnection): GitHubPermissionView {
    return {
      state: connection.state,
      accountLogin: connection.accountLogin,
      grantedScopes: connection.grantedScopes,
      authorizedScopes: connection.authorizedScopes,
      lastVerifiedAt: connection.lastVerifiedAt,
      connectedAt: connection.connectedAt,
      canDiscoverPublic:
        connection.state === 'CONNECTED' && connection.grantedScopes.includes('public_metadata'),
      canReadPrivateRepos:
        connection.state === 'CONNECTED' && connection.grantedScopes.includes('private_repos_read'),
      canWriteRepos:
        connection.state === 'CONNECTED' && connection.grantedScopes.includes('repos_write'),
      requiresVerification: connection.state === 'EXPIRED',
    };
  }

  /**
   * Validate a requested scope set. Everything beyond public_metadata
   * requires explicit user intent (repoAccessExplicit); write access
   * additionally requires a SEPARATE consent flag (writeConsent) so it
   * can never be obtained silently. Returns accepted + rejected scopes.
   */
  validateScopeRequest(
    requested: readonly GitHubPermissionScope[],
    opts: { repoAccessExplicit: boolean; writeConsent: boolean },
  ): { accepted: GitHubPermissionScope[]; rejected: GitHubPermissionScope[] } {
    const accepted: GitHubPermissionScope[] = [];
    const rejected: GitHubPermissionScope[] = [];
    for (const scope of requested) {
      if (isWriteScope(scope)) {
        if (opts.writeConsent) accepted.push(scope);
        else rejected.push(scope);
      } else if (EXPLICIT_APPROVAL_SCOPES.includes(scope)) {
        if (opts.repoAccessExplicit) accepted.push(scope);
        else rejected.push(scope);
      } else {
        accepted.push(scope);
      }
    }
    return { accepted, rejected };
  }
}
