// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI World Discovery types
// EPIC-012C — AI World Discovery, Provider Catalog & Market Intelligence
//
// A DiscoveryItem is the canonical record of a useful development in
// the AI ecosystem. EVERY claim carries evidence + a confidence state
// (VERIFIED / PROVIDER_DECLARED / MEASURED / INFERRED / UNKNOWN) —
// nothing is ever fabricated. Unknown fields stay UNKNOWN.
// ──────────────────────────────────────────────────────────────────

// ── Categories ─────────────────────────────────────────────────────

export type DiscoveryCategory = 'provider' | 'model' | 'github' | 'application' | 'news';

export const DISCOVERY_CATEGORIES: readonly DiscoveryCategory[] = [
  'provider',
  'model',
  'github',
  'application',
  'news',
];

// ── Evidence ───────────────────────────────────────────────────────

export type EvidenceConfidence =
  'VERIFIED' | 'PROVIDER_DECLARED' | 'MEASURED' | 'INFERRED' | 'UNKNOWN';

export interface DiscoveryEvidence {
  /** What is claimed (e.g. "context window 128k"). */
  claim: string;
  /** Where the claim came from (official catalogue, repo README, …). */
  source: string;
  /** Direct URL to the claim where available. */
  sourceUrl?: string;
  /** Honest confidence — never fabricated. */
  confidence: EvidenceConfidence;
  /** When the evidence was retrieved. */
  retrievedAt: string;
}

// ── Free / local resource classification ───────────────────────────
// Independent axes: "open source" ≠ "free API" ≠ "unlimited free
// inference". FREE does NOT mean automatically recommended — quality,
// capability, evidence and usability rank first.

export type FreeResourceClass =
  | 'FREE_API'
  | 'FREE_WITH_QUOTA'
  | 'OPEN_WEIGHTS'
  | 'OPEN_SOURCE'
  | 'LOCAL'
  | 'SELF_HOSTABLE'
  | 'PAID'
  | 'UNKNOWN';

export const FREE_RESOURCE_CLASSES: readonly FreeResourceClass[] = [
  'FREE_API',
  'FREE_WITH_QUOTA',
  'OPEN_WEIGHTS',
  'OPEN_SOURCE',
  'LOCAL',
  'SELF_HOSTABLE',
  'PAID',
  'UNKNOWN',
];

export type LocalAvailability = 'yes' | 'no' | 'UNKNOWN';

// ── Recommendation state ───────────────────────────────────────────

export type RecommendationState = 'IGNORE' | 'WATCH' | 'REVIEW' | 'TRY' | 'CONFIGURE' | 'INTEGRATE';

export const RECOMMENDATION_STATES: readonly RecommendationState[] = [
  'IGNORE',
  'WATCH',
  'REVIEW',
  'TRY',
  'CONFIGURE',
  'INTEGRATE',
];

// ── GitHub repository intelligence ─────────────────────────────────

export type GitHubRepoFlag =
  | 'abandoned'
  | 'unclear_license'
  | 'suspicious'
  | 'low_documentation'
  | 'security_concerns'
  | 'inactive_development';

export const GITHUB_REPO_FLAGS: readonly GitHubRepoFlag[] = [
  'abandoned',
  'unclear_license',
  'suspicious',
  'low_documentation',
  'security_concerns',
  'inactive_development',
];

export interface GitHubRepositoryIntelligence {
  /** Full repository name (owner/repo). */
  name: string;
  description?: string;
  language?: string;
  /** Stars are ADOPTION, not quality — never a proxy for usefulness. */
  stars?: number;
  forks?: number;
  /** ISO date of last commit where known. */
  lastCommitAt?: string;
  license?: string;
  /** Confidence in the license fact. */
  licenseConfidence: EvidenceConfidence;
  documentationQuality: 'good' | 'limited' | 'unknown';
  deploymentComplexity: 'low' | 'medium' | 'high' | 'UNKNOWN';
  selfHostable: LocalAvailability;
  /** Flags that downgrade the recommendation (evidence-backed). */
  flags: GitHubRepoFlag[];
  /** Why each flag was raised. */
  flagEvidence: Record<GitHubRepoFlag, string>;
  /** Security considerations — never silently recommended. */
  securityConsiderations: string[];
}

// ── Model / provider discovery facts ───────────────────────────────

export interface DiscoveryModelFacts {
  providerName?: string;
  modelId?: string;
  capabilities: string[];
  contextWindow?: number;
  /** Whether VedMoulya can configure this provider/model today. */
  configurable: boolean;
  /** Suggested provider family when configurable (registry family). */
  suggestedFamily?: string;
}

// ── The DiscoveryItem ──────────────────────────────────────────────

export interface DiscoveryItem {
  /** Stable id (derived from source + url/title — survives re-runs). */
  id: string;
  title: string;
  category: DiscoveryCategory;
  /** Which AIDiscoverySource produced this item. */
  source: string;
  sourceUrl?: string;
  discoveredAt: string;
  publishedAt?: string;
  /** Short, useful, non-technical summary. */
  summary: string;
  capabilities: string[];
  /** Honest free/local classification (independent axes). */
  freeClass: FreeResourceClass;
  localAvailability: LocalAvailability;
  /** 0..100 usefulness score — QUALITY over volume. */
  relevance: number;
  relevanceLabel: 'high' | 'medium' | 'low';
  /** Why this item matters (short bullets). */
  relevanceReasons: string[];
  /** Aggregate confidence across the evidence. */
  confidence: EvidenceConfidence;
  evidence: DiscoveryEvidence[];
  recommendation: RecommendationState;
  /** Why this recommendation (short bullets, user-friendly). */
  recommendationReasons: string[];
  modelFacts?: DiscoveryModelFacts;
  github?: GitHubRepositoryIntelligence;
  /** Security flags raised by the untrusted-content scanner. */
  securityFlags: string[];
  /** Raw title/summary never rendered as trusted markup. */
  raw: boolean;
}

// ── Discovery budgets (bounded, never an infinite crawler) ─────────

export interface DiscoveryBudget {
  /** Max items a single source may contribute per run. */
  maxItemsPerSource: number;
  /** Max items a single run may add overall. */
  maxItemsPerRun: number;
  /** Max sources consulted per run. */
  maxSourcesPerRun: number;
  /** Storage cap for the retained discovery store. */
  maxStoredItems: number;
  /** Minimum interval between runs (cache + refresh policy). */
  minRefreshIntervalMs: number;
}

export const DEFAULT_DISCOVERY_BUDGET: DiscoveryBudget = {
  maxItemsPerSource: 25,
  maxItemsPerRun: 60,
  maxSourcesPerRun: 8,
  maxStoredItems: 300,
  minRefreshIntervalMs: 6 * 60 * 60 * 1000, // 6h — bounded daily evolution
};

// ── Raw source output ──────────────────────────────────────────────
// Sources return raw facts; every derived field is computed by the
// domain engines with provenance — never trusted from the source.

export interface RawDiscoveryItem {
  title: string;
  category: DiscoveryCategory;
  sourceUrl?: string;
  publishedAt?: string;
  summary: string;
  capabilities?: string[];
  /** Claimed free class — treated as a CLAIM, re-classified by engine. */
  claimedFreeClass?: FreeResourceClass;
  claimedLocalAvailability?: LocalAvailability;
  modelFacts?: {
    providerName?: string;
    modelId?: string;
    capabilities: string[];
    contextWindow?: number;
    /** Suggested registry family when the provider is configurable. */
    suggestedFamily?: string;
  };
  github?: {
    name: string;
    description?: string;
    language?: string;
    stars?: number;
    forks?: number;
    lastCommitAt?: string;
    license?: string;
  };
  evidence?: Array<
    Pick<DiscoveryEvidence, 'claim' | 'source' | 'sourceUrl' | 'confidence'> & {
      retrievedAt?: string;
    }
  >;
}

export interface RawDiscoveryResult {
  source: string;
  items: RawDiscoveryItem[];
}

// ── Per-user state ─────────────────────────────────────────────────
// Discovery items are platform-wide, but each user's attention state
// is owner-scoped (never shared, IDOR-safe).

export type DiscoveryItemAction = 'none' | 'watching' | 'dismissed';

export interface DiscoveryUserState {
  read: boolean;
  action: DiscoveryItemAction;
}

// ── World view (bell) ──────────────────────────────────────────────

export interface AIWorldSection {
  title: string;
  items: DiscoveryItem[];
}

export interface AIWorldView {
  generatedAt: string;
  /** 🔥 Important for VedMoulya — must-see changes. */
  important: DiscoveryItem[];
  /** ⭐ Recommended for you — worth attention. */
  recommended: DiscoveryItem[];
  /** 🧩 New GitHub projects — useful repos. */
  github: DiscoveryItem[];
  /** 📰 AI updates — ecosystem changes. */
  updates: DiscoveryItem[];
  /** Unread count for the bell badge. */
  unreadCount: number;
}

// ── Digest ─────────────────────────────────────────────────────────

export interface DigestEntry {
  item: DiscoveryItem;
  /** Why it made today's digest. */
  why: string;
}

export interface DiscoveryDigest {
  date: string;
  entries: DigestEntry[];
  summary: string;
}

// ── Run reports ────────────────────────────────────────────────────

export interface DiscoverySourceRunReport {
  source: string;
  attempted: boolean;
  failed: boolean;
  error?: string;
  rawReceived: number;
  added: number;
  duplicatesSkipped: number;
  securityRejected: number;
  durationMs: number;
}

export interface DiscoveryRunReport {
  ranAt: string;
  sources: DiscoverySourceRunReport[];
  totalAdded: number;
  budget: DiscoveryBudget;
}
