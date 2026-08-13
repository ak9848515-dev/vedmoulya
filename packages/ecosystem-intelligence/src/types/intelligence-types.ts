// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence
// EPIC-015 — VedMoulya Intelligence
//
// The Intelligence layer answers: "For THIS task, is there something
// significantly better available?" across configured providers, free
// providers, local models, GitHub projects and external applications —
// with DISCOVERY + EVIDENCE + SECURITY + LICENSE + FRESHNESS, never a
// static directory. Every state is explicit; UNKNOWN is first-class;
// nothing is fabricated; nothing is auto-activated.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type { FreeResourceClass, LocalAvailability } from '@vedmoulya/ai-world';

// ── Intelligence lifecycle (persist evidence + state) ─────────────
// Never silently delete deprecated models/providers/repos — preserve
// provenance through every transition.

export type IntelligenceLifecycleState =
  | 'DISCOVERED'
  | 'VERIFIED'
  | 'SECURITY_REVIEWED'
  | 'RECOMMENDED'
  | 'USER_APPROVED'
  | 'CONFIGURED'
  | 'VALIDATED'
  | 'ACTIVE'
  | 'STALE'
  | 'DEPRECATED'
  | 'BLOCKED';

export const INTELLIGENCE_LIFECYCLE: readonly IntelligenceLifecycleState[] = [
  'DISCOVERED',
  'VERIFIED',
  'SECURITY_REVIEWED',
  'RECOMMENDED',
  'USER_APPROVED',
  'CONFIGURED',
  'VALIDATED',
  'ACTIVE',
  'STALE',
  'DEPRECATED',
  'BLOCKED',
] as const;

export interface LifecycleRecord {
  resourceId: string;
  /** Provider / model / github / application / external_tool. */
  resourceKind: 'provider' | 'model' | 'github' | 'application' | 'external_tool';
  state: IntelligenceLifecycleState;
  /** What evidence drove the current state. */
  evidence: string[];
  /** Provenance: when + why each transition happened. */
  history: Array<{ state: IntelligenceLifecycleState; at: string; reason: string }>;
  /** Verification timestamp (staleness anchor). */
  verifiedAt?: string;
  updatedAt: string;
}

// ── Security classification ───────────────────────────────────────
// Evidence must be attached. Never claim "safe" merely because no
// vulnerability was found — use "no blocking indicators found in the
// checks performed".

export type SecurityClassification =
  | 'TRUSTED'
  | 'TRUSTED_WITH_REVIEW'
  | 'SECURITY_REVIEW_REQUIRED'
  | 'SUSPICIOUS'
  | 'BLOCKED'
  | 'UNKNOWN';

export const SECURITY_CLASSIFICATIONS: readonly SecurityClassification[] = [
  'TRUSTED',
  'TRUSTED_WITH_REVIEW',
  'SECURITY_REVIEW_REQUIRED',
  'SUSPICIOUS',
  'BLOCKED',
  'UNKNOWN',
] as const;

/** A single security check performed on a repository/tool. */
export interface SecurityCheck {
  name: string;
  passed: boolean;
  /** Honest detail — never "safe", always "no blocking indicator found in the checks performed". */
  detail: string;
  evidence: string[];
}

export interface RepositorySecurityAssessment {
  classification: SecurityClassification;
  checks: SecurityCheck[];
  /** Blocking indicators actually found (empty when none — never a blanket "safe"). */
  blockingIndicators: string[];
  /** Sandbox decision: true when the environment cannot safely sandbox the repo. */
  sandboxRequired: boolean;
  sandboxAvailable: boolean;
  assessedAt: string;
}

// ── License intelligence ──────────────────────────────────────────
// Model license is evaluated SEPARATELY from software license.
// LICENSE_UNKNOWN is first-class — never auto-approved for commercial use.

export type LicenseUsageVerdict =
  'PERMISSIVE' | 'RESTRICTIVE' | 'COMMERCIAL_RESTRICTED' | 'LICENSE_UNKNOWN';

export interface LicenseIntelligence {
  license?: string;
  /** SOFTWARE license — the code itself. */
  software: {
    present: boolean;
    type?: string;
    commercialUseRestricted: boolean;
    redistributionRestricted: boolean;
    attributionRequired: boolean;
    verdict: LicenseUsageVerdict;
  };
  /** MODEL license — weights/training data, evaluated separately. */
  model?: {
    present: boolean;
    type?: string;
    commercialUseRestricted: boolean;
    attributionRequired: boolean;
    verdict: LicenseUsageVerdict;
  };
  verdict: LicenseUsageVerdict;
  /** When the license facts were verified. */
  verifiedAt?: string;
}

// ── Free resource intelligence (limits + freshness) ───────────────
// "Free within quota" ≠ unlimited free. When evidence becomes stale,
// mark STALE rather than assuming it is still free.

export type FreeResourceStatus = 'ACTIVE' | 'STALE' | 'VERIFICATION_REQUIRED';

export interface FreeResourceLimits {
  freeClass: FreeResourceClass;
  localAvailability: LocalAvailability;
  dailyLimit?: number;
  monthlyLimit?: number;
  tokenLimit?: number;
  requestLimit?: number;
  contextLimit?: number;
  expiresAt?: string;
  regionalRestrictions?: string[];
  rateLimit?: string;
  /** Current status — STALE when verification evidence has aged. */
  status: FreeResourceStatus;
  verificationTimestamp?: string;
  /** Max age before the free claim is treated as stale. */
  maxAgeMs: number;
}

// ── GitHub connection (separate from Google auth) ─────────────────
// GitHub App architecture preferred: fine-grained permissions,
// short-lived tokens. Public discovery never requires private
// repository permissions.

export type GitHubConnectionState =
  'DISCONNECTED' | 'AUTHORIZING' | 'CONNECTED' | 'REVOKED' | 'EXPIRED';

export const GITHUB_CONNECTION_STATES: readonly GitHubConnectionState[] = [
  'DISCONNECTED',
  'AUTHORIZING',
  'CONNECTED',
  'REVOKED',
  'EXPIRED',
] as const;

/** Read-only metadata is the default; everything else is explicit. */
export type GitHubPermissionScope =
  | 'public_metadata' // default — no repo access needed for discovery
  | 'public_repos_read'
  | 'private_repos_read' // explicit authorization required
  | 'repos_write' // separate permissions + separate approval; never silent
  | 'orgs_read';

export const GITHUB_PERMISSION_SCOPES: readonly GitHubPermissionScope[] = [
  'public_metadata',
  'public_repos_read',
  'private_repos_read',
  'repos_write',
  'orgs_read',
] as const;

export interface GitHubConnection {
  userId: string;
  state: GitHubConnectionState;
  /** GitHub username / login when connected. */
  accountLogin?: string;
  /** Permissions actually granted (never broader than requested). */
  grantedScopes: GitHubPermissionScope[];
  /** Permissions the user explicitly authorized. */
  authorizedScopes: GitHubPermissionScope[];
  /** Last successful verification timestamp. */
  lastVerifiedAt?: string;
  connectedAt?: string;
  /** Never store the access token here — server-side credential store only. */
  tokenRef?: string;
  updatedAt: string;
}

// ── Repository acquisition pipeline ───────────────────────────────
// DISCOVERED → SECURITY REVIEW → RELEVANCE → APPROVAL → ACQUIRE →
// SANDBOX → ANALYZE → STORE INTELLIGENCE → OPTIONAL CONFIGURATION.
// READ vs CLONE vs EXECUTE vs INSTALL vs CONFIGURE vs USE are
// DIFFERENT actions — never assume reading implies safe execution.

export type AcquisitionState =
  | 'DISCOVERED'
  | 'SECURITY_REVIEW'
  | 'RELEVANCE'
  | 'APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'ACQUIRED'
  | 'SANDBOXED'
  | 'ANALYZED'
  | 'STORED'
  | 'CONFIGURED'
  | 'BLOCKED'
  | 'REJECTED';

export const ACQUISITION_STATES: readonly AcquisitionState[] = [
  'DISCOVERED',
  'SECURITY_REVIEW',
  'RELEVANCE',
  'APPROVAL_REQUIRED',
  'APPROVED',
  'ACQUIRED',
  'SANDBOXED',
  'ANALYZED',
  'STORED',
  'CONFIGURED',
  'BLOCKED',
  'REJECTED',
] as const;

export interface AcquisitionPlan {
  repository: string;
  state: AcquisitionState;
  /** Security assessment feeding the gate. */
  security?: RepositorySecurityAssessment;
  license?: LicenseIntelligence;
  /** Why this repo matters for the user/factory. */
  relevance?: string[];
  /** What approval is required before acquiring. */
  requiresApprovalFor: Array<
    'acquire' | 'clone' | 'execute' | 'install' | 'configure' | 'use_in_factory'
  >;
  /** What happens if the user declines. */
  fallback?: string;
  updatedAt: string;
}

// ── Task-specific intelligence result ─────────────────────────────
// Answers: "For THIS task, is there something significantly better?"

export type BestOptionKind =
  | 'BEST_AVAILABLE_NOW'
  | 'BEST_FREE'
  | 'BEST_LOCAL'
  | 'BEST_LOW_COST'
  | 'BEST_PAID'
  | 'BEST_CONFIGURED';

export const BEST_OPTION_KINDS: readonly BestOptionKind[] = [
  'BEST_AVAILABLE_NOW',
  'BEST_FREE',
  'BEST_LOCAL',
  'BEST_LOW_COST',
  'BEST_PAID',
  'BEST_CONFIGURED',
] as const;

export interface IntelligenceOption {
  kind: BestOptionKind;
  providerId?: string;
  name: string;
  capability: CapabilityId;
  quality?: number;
  /** Cost only when evidenced — UNKNOWN stays UNKNOWN. */
  costUsd?: number;
  freeClass?: FreeResourceClass;
  localAvailability?: LocalAvailability;
  /** Why this option (quality-first, evidence-backed). */
  reason: string;
  evidence: string[];
  /** What activating this option requires (subscription / API key / GitHub connection / download / approval). */
  requires: Array<
    | 'subscription'
    | 'api_key'
    | 'github_connection'
    | 'download'
    | 'local_install'
    | 'external_application'
    | 'additional_permission'
  >;
}

export interface TaskIntelligenceResult {
  taskId: string;
  requestedOutcome: string;
  options: IntelligenceOption[];
  /** The best option that can be used RIGHT NOW without new activation. */
  bestAvailableNow?: IntelligenceOption;
  /** True when a materially better option exists but requires activation. */
  betterOptionAvailable: boolean;
  /** Approval recommendation when a better option needs user consent. */
  recommendation?: IntelligenceRecommendation;
  /** Honest fallback when the user declines (free → quota → local → os → github → current). */
  fallback?: FallbackPlan;
}

export interface FallbackPlan {
  order: Array<'FREE' | 'FREE_QUOTA' | 'LOCAL' | 'OPEN_SOURCE' | 'GITHUB' | 'CURRENT_CONFIGURED'>;
  bestAchievable: string;
  note: string;
}

// ── Approval recommendation (premium, simple) ─────────────────────

export type RecommendationKind =
  'BETTER_CAPABILITY_FOUND' | 'USEFUL_OPEN_SOURCE_FOUND' | 'FREE_LOCAL_MODEL_AVAILABLE';

export interface IntelligenceRecommendation {
  id: string;
  kind: RecommendationKind;
  title: string;
  /** What the user has now (current capability + quality). */
  current?: { name: string; quality?: number };
  /** The recommended alternative. */
  recommended: { name: string; quality?: number; costUsd?: number; why: string[] };
  /** What it requires. */
  requires: string[];
  /** Risks — evidence-backed, never hidden. */
  risks: string[];
  /** Allowed actions the UI may offer. */
  actions: Array<
    | 'use_recommended'
    | 'continue_with_current'
    | 'review_details'
    | 'dont_suggest_again'
    | 'review_and_configure'
    | 'ignore'
    | 'download'
    | 'open_repository'
  >;
  /** Cost when evidenced (UNKNOWN stays UNKNOWN). */
  cost?: { amountUsd?: number; cadence?: 'one_time' | 'monthly' | 'per_use' | 'UNKNOWN' };
  createdAt: string;
}

// ── Intelligence source seam (narrow port — the ONLY external reach) ──
// Mirrors the BrainCandidatePort shape so the same frozen sources
// (providers / AI World / local models) feed the intelligence layer.

export interface IntelligenceTaskContext {
  objective: string;
  domain: string;
  qualityTarget: 'LOW' | 'MEDIUM' | 'HIGH';
  privacyRequirement: 'PRIVATE' | 'STANDARD';
  constraints: string[];
  authorizedActions: string[];
}

// ── Notifications (meaningful events only — relevance-gated) ──────

export type IntelligenceNotificationKind =
  | 'BETTER_PROVIDER_DISCOVERED'
  | 'NEW_FREE_MODEL'
  | 'FREE_QUOTA_INCREASED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_RETIRED'
  | 'USEFUL_GITHUB_PROJECT'
  | 'SECURITY_WARNING'
  | 'LICENSE_CONCERN'
  | 'LOCAL_MODEL_SUITABLE'
  | 'PAID_TOOL_MATERIALLY_BETTER'
  | 'CONFIGURED_PROVIDER_CHANGED'
  | 'NEW_OPPORTUNITY';

export interface IntelligenceNotification {
  id: string;
  kind: IntelligenceNotificationKind;
  title: string;
  body: string;
  relevance: number;
  itemId?: string;
  createdAt: string;
}
