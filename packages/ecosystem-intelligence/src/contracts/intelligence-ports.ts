// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence — Contracts
// EPIC-015 — VedMoulya Intelligence
//
// The ONLY seams the Intelligence layer uses to reach the frozen
// estate. It NEVER reaches inside another engine:
//   • candidate sources (providers / AI World / local models) → reuse
//     the Brain's BrainCandidatePort (EPIC-016) so there is exactly
//     ONE source seam for the whole platform.
//   • preference ledger (EPIC-014) → reuse the Brain's
//     BrainPreferencePort.
//   • GitHub auth + repository facts → narrow ports implemented by
//     the gateway (deterministic in hermetic CI; live GitHub App is
//     an operator step — tokens never leave the server).
// ──────────────────────────────────────────────────────────────────

import type { BrainCandidatePort, BrainPreferencePort } from '@vedmoulya/brain';
import type {
  GitHubConnection,
  GitHubPermissionScope,
  IntelligenceNotification,
  LifecycleRecord,
} from '../types/intelligence-types.js';

// ── Clock ──────────────────────────────────────────────────────────
export interface ClockPort {
  now(): string;
}

// ── Candidate + preference seams (REUSE, not rebuild) ─────────────
// The intelligence layer consumes the same normalized candidate facts
// as the Brain — configured providers, AI World discoveries and local
// models — and the same EPIC-014 preference ledger.
export type { BrainCandidatePort, BrainPreferencePort };

// ── GitHub auth (GitHub App architecture, short-lived tokens) ─────
// Never expose tokens/codes through this port — only opaque refs.
export interface GitHubAuthPort {
  /** Start authorization: returns the user-facing authorization URL + a CSRF state. */
  beginAuthorization(
    userId: string,
    requestedScopes: GitHubPermissionScope[],
  ): Promise<{ authorizationUrl: string; state: string }>;
  /**
   * Exchange the authorization code for a connection. The adapter
   * performs the token exchange server-side and returns only metadata.
   * Granted scopes are NEVER broader than what was requested.
   */
  completeAuthorization(
    userId: string,
    code: string,
    state: string,
  ): Promise<{ accountLogin: string; grantedScopes: GitHubPermissionScope[] }>;
  /** Verify the connection still works (bounded, rate-limited). */
  verify(userId: string): Promise<{ valid: boolean; login?: string; lastVerifiedAt: string }>;
  /** Revoke access at the provider (user-visible action). */
  revoke(userId: string): Promise<void>;
}

// ── GitHub repository facts (read-only metadata — never credentials) ─
export interface GitHubRepoFacts {
  fullName: string;
  visibility: 'public' | 'private';
  description?: string;
  language?: string;
  stars?: number;
  forks?: number;
  lastCommitAt?: string;
  license?: string;
  defaultBranch?: string;
  archived: boolean;
  /** What this connection may do with the repo (permission boundary). */
  allowedActions: Array<'read' | 'clone' | 'write'>;
}

export interface GitHubRepoSourcePort {
  /** Repositories accessible under the granted scopes. */
  list(userId: string, connection: GitHubConnection): Promise<GitHubRepoFacts[]>;
}

// ── Owner-scoped stores (IDOR-safe by construction — every key is (userId, id)) ──
export interface GitHubConnectionStore {
  save(connection: GitHubConnection): void;
  get(userId: string): GitHubConnection | undefined;
}

export interface LifecycleStore {
  save(userId: string, record: LifecycleRecord): void;
  get(userId: string, resourceId: string): LifecycleRecord | undefined;
  list(userId: string): LifecycleRecord[];
}

export interface RecommendationStore {
  save(
    userId: string,
    recommendation: {
      id: string;
      kind: string;
      title: string;
      state: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'DISMISSED' | 'SUPPRESSED';
      createdAt: string;
    },
  ): void;
  get(
    userId: string,
    id: string,
  ): { id: string; kind: string; title: string; state: string; createdAt: string } | undefined;
  list(
    userId: string,
  ): Array<{ id: string; kind: string; title: string; state: string; createdAt: string }>;
  mark(
    userId: string,
    id: string,
    state: 'ACCEPTED' | 'DECLINED' | 'DISMISSED' | 'SUPPRESSED',
  ): void;
}

export interface NotificationStore {
  save(userId: string, notification: IntelligenceNotification): void;
  list(userId: string): IntelligenceNotification[];
  markRead(userId: string, id: string): void;
}

export interface AcquisitionStore {
  save(userId: string, plan: { repository: string; state: string; updatedAt: string }): void;
  get(
    userId: string,
    repository: string,
  ): { repository: string; state: string; updatedAt: string } | undefined;
  mark(userId: string, repository: string, state: string): void;
}
