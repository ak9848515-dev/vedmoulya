// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Marketplace & Factory Intelligence types
// EPIC-013 — AI Capability Marketplace & Factory Intelligence
//
// Connects AI World intelligence with the factory ecosystem:
//   OUTCOME → CAPABILITIES → CANDIDATES → INTEGRATION CLASS →
//   AUTOMATION BOUNDARY → QUALITY-FIRST SELECTION → PLAN → APPROVAL.
// Every important recommendation carries evidence; unknown stays
// UNKNOWN — API availability / automation capability / pricing are
// never fabricated. "AI can do this" ≠ "VedMoulya can automate this"
// ≠ "an external application can do this" ≠ "human action required".
// ──────────────────────────────────────────────────────────────────

// ── Normalized AI Capability Graph ────────────────────────────────
// The canonical capability taxonomy. Not every capability is
// executable through an API — that is exactly what the integration
// classification determines (see IntegrationType).
// ──────────────────────────────────────────────────────────────────

export type CapabilityId =
  | 'TEXT_GENERATION'
  | 'REASONING'
  | 'CODING'
  | 'RESEARCH'
  | 'RAG'
  | 'VISION'
  | 'IMAGE_GENERATION'
  | 'VIDEO_GENERATION'
  | 'VIDEO_EDITING'
  | 'AUDIO_GENERATION'
  | 'TEXT_TO_SPEECH'
  | 'SPEECH_TO_TEXT'
  | 'MUSIC'
  | 'AVATAR'
  | 'TRANSLATION'
  | 'DOCUMENT_PROCESSING'
  | 'EMBEDDINGS'
  | 'WEB_RESEARCH'
  | 'BROWSER_AUTOMATION'
  | 'CODE_EXECUTION'
  | 'DEPLOYMENT'
  | 'QUALITY_EVALUATION'
  | 'ASSEMBLY';

export const CAPABILITY_IDS: readonly CapabilityId[] = [
  'TEXT_GENERATION',
  'REASONING',
  'CODING',
  'RESEARCH',
  'RAG',
  'VISION',
  'IMAGE_GENERATION',
  'VIDEO_GENERATION',
  'VIDEO_EDITING',
  'AUDIO_GENERATION',
  'TEXT_TO_SPEECH',
  'SPEECH_TO_TEXT',
  'MUSIC',
  'AVATAR',
  'TRANSLATION',
  'DOCUMENT_PROCESSING',
  'EMBEDDINGS',
  'WEB_RESEARCH',
  'BROWSER_AUTOMATION',
  'CODE_EXECUTION',
  'DEPLOYMENT',
  'QUALITY_EVALUATION',
  'ASSEMBLY',
];

/** Human label for each capability (UI-friendly, no jargon). */
export const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  TEXT_GENERATION: 'Text generation',
  REASONING: 'Reasoning',
  CODING: 'Coding',
  RESEARCH: 'Research',
  RAG: 'Knowledge retrieval (RAG)',
  VISION: 'Image understanding',
  IMAGE_GENERATION: 'Image generation',
  VIDEO_GENERATION: 'Video generation',
  VIDEO_EDITING: 'Video editing',
  AUDIO_GENERATION: 'Audio generation',
  TEXT_TO_SPEECH: 'Text to speech',
  SPEECH_TO_TEXT: 'Speech to text',
  MUSIC: 'Music',
  AVATAR: 'Avatar',
  TRANSLATION: 'Translation',
  DOCUMENT_PROCESSING: 'Document processing',
  EMBEDDINGS: 'Embeddings',
  WEB_RESEARCH: 'Web research',
  BROWSER_AUTOMATION: 'Browser automation',
  CODE_EXECUTION: 'Code execution',
  DEPLOYMENT: 'Deployment',
  QUALITY_EVALUATION: 'Quality evaluation',
  ASSEMBLY: 'Assembly',
};

// ── Integration Types ─────────────────────────────────────────────
// Every capability provider must declare HOW it can be used. This is
// the critical distinction: a model behind an API is AUTOMATABLE; a
// tool available only inside an external application is NOT. Never
// pretend an external application has API automation without evidence.
// ──────────────────────────────────────────────────────────────────

export type IntegrationType =
  | 'NATIVE_API'
  | 'DIRECT_PROVIDER'
  | 'OPEN_SOURCE'
  | 'LOCAL_MODEL'
  | 'GITHUB_PROJECT'
  | 'EXTERNAL_APPLICATION'
  | 'MANUAL_STEP'
  | 'UNKNOWN';

export const INTEGRATION_TYPES: readonly IntegrationType[] = [
  'NATIVE_API',
  'DIRECT_PROVIDER',
  'OPEN_SOURCE',
  'LOCAL_MODEL',
  'GITHUB_PROJECT',
  'EXTERNAL_APPLICATION',
  'MANUAL_STEP',
  'UNKNOWN',
];

export const INTEGRATION_LABELS: Record<IntegrationType, string> = {
  NATIVE_API: 'API-automatable',
  DIRECT_PROVIDER: 'Direct provider API',
  OPEN_SOURCE: 'Open source',
  LOCAL_MODEL: 'Local model',
  GITHUB_PROJECT: 'GitHub project',
  EXTERNAL_APPLICATION: 'External application',
  MANUAL_STEP: 'Manual step',
  UNKNOWN: 'Integration unknown',
};

// ── Candidate classification ──────────────────────────────────────

export type CandidateClass =
  'READY' | 'CONFIGURE' | 'EVALUATE' | 'EXTERNAL' | 'MANUAL' | 'UNAVAILABLE' | 'UNKNOWN';

export const CANDIDATE_CLASSES: readonly CandidateClass[] = [
  'READY',
  'CONFIGURE',
  'EVALUATE',
  'EXTERNAL',
  'MANUAL',
  'UNAVAILABLE',
  'UNKNOWN',
];

export const CANDIDATE_CLASS_LABELS: Record<CandidateClass, string> = {
  READY: 'Ready to use',
  CONFIGURE: 'Configure first',
  EVALUATE: 'Evaluate',
  EXTERNAL: 'External application',
  MANUAL: 'Manual action',
  UNAVAILABLE: 'Unavailable',
  UNKNOWN: 'Unknown',
};

// ── Automation boundary ───────────────────────────────────────────
// Never claim full automation where the provider/API does not
// support it. FULLY_AUTOMATED means VedMoulya can drive the whole
// step; PARTIALLY_AUTOMATED means parts are manual/external;
// HUMAN_APPROVAL means automation exists but an approval gate is
// required (irreversible actions); MANUAL means no automation.
// ──────────────────────────────────────────────────────────────────

export type AutomationLevel =
  'FULLY_AUTOMATED' | 'PARTIALLY_AUTOMATED' | 'HUMAN_APPROVAL' | 'MANUAL';

export const AUTOMATION_LEVELS: readonly AutomationLevel[] = [
  'FULLY_AUTOMATED',
  'PARTIALLY_AUTOMATED',
  'HUMAN_APPROVAL',
  'MANUAL',
];

export const AUTOMATION_LABELS: Record<AutomationLevel, string> = {
  FULLY_AUTOMATED: 'Fully automated',
  PARTIALLY_AUTOMATED: 'Partially automated',
  HUMAN_APPROVAL: 'Requires approval',
  MANUAL: 'Manual',
};

// ── Evidence (reuses the ai-world confidence vocabulary) ──────────

export type EvidenceConfidence =
  'VERIFIED' | 'PROVIDER_DECLARED' | 'MEASURED' | 'INFERRED' | 'UNKNOWN';

export interface CapabilityEvidence {
  claim: string;
  source: string;
  sourceUrl?: string;
  confidence: EvidenceConfidence;
}

// ── Candidate (a provider/model/tool that can perform a capability) ─

export type CandidateKind =
  | 'provider'
  | 'model'
  | 'local-model'
  | 'github'
  | 'application'
  | 'vedmoulya'
  | 'external'
  | 'manual';

export interface CapabilityCandidate {
  /** Stable candidate id (source kind + name). */
  id: string;
  kind: CandidateKind;
  name: string;
  /** Provider family when this is a configured/discovered provider. */
  providerFamily?: string;
  /** Model id when the candidate is a specific model. */
  modelId?: string;
  /** Which capability this candidate performs. */
  capability: CapabilityId;
  /** Honest integration classification — never assumed. */
  integrationType: IntegrationType;
  classification: CandidateClass;
  /** Free/local facts where known (quality-first, free never wins alone). */
  freeAvailability: 'FREE' | 'FREE_WITH_QUOTA' | 'PAID' | 'UNKNOWN';
  localAvailability: 'yes' | 'no' | 'UNKNOWN';
  /** Quality signal where evidence exists (0..1); UNKNOWN when absent. */
  quality: number | undefined;
  /** Availability signal (0..1) where the registry has evidence. */
  availability?: number;
  /** Evidence for every important claim. */
  evidence: CapabilityEvidence[];
  /** Why this candidate is/ isn't recommended (user-friendly). */
  reasons: string[];
  /** Whether VedMoulya can configure this today (deep-link). */
  configurable: boolean;
  /** Suggested registry family for the configure deep-link. */
  suggestedFamily?: string;
  /** Approximate cost per use where evidence exists. */
  estimatedCostUsd?: number;
  /** Whether an API is known to exist (never assumed for external apps). */
  apiAvailable: 'yes' | 'no' | 'UNKNOWN';
  /** Human-readable explanation for external/manual candidates. */
  externalNote?: string;
}

// ── Plan steps ────────────────────────────────────────────────────

export interface PlanStep {
  id: string;
  title: string;
  /** Which capability this step needs. */
  capability: CapabilityId;
  /** What this step produces (plain language). */
  purpose: string;
  /** Candidates that can perform this step (best first). */
  candidates: CapabilityCandidate[];
  /** The selected candidate id (quality-first, evidence-backed). */
  selectedCandidateId?: string;
  /** Honest automation boundary for this step. */
  automation: AutomationLevel;
  /** Whether this step performs an irreversible action (needs approval). */
  irreversible: boolean;
  /** Why the automation level and selection were chosen. */
  reasons: string[];
}

// ── The FactoryCapabilityPlan ─────────────────────────────────────

export interface FactoryCapabilityPlan {
  /** Stable plan id (owner-scoped). */
  id: string;
  /** The user's requested outcome, verbatim. */
  requestedOutcome: string;
  createdAt: string;
  /** The normalized capability graph nodes required by the outcome. */
  requiredCapabilities: CapabilityId[];
  /** Every candidate considered across all steps (de-duplicated). */
  candidates: CapabilityCandidate[];
  /** The ordered execution steps. */
  steps: PlanStep[];
  /** Overall automation level of the plan. */
  automationLevel: AutomationLevel;
  /** 0..100 — percent of steps fully automatable. */
  automationPercent: number;
  /** Estimated cost when evidence exists (sum of step estimates). */
  estimatedCostUsd?: number;
  /** Estimated time in minutes when evidence exists. */
  estimatedTimeMinutes?: number;
  /** Evidence backing the plan. */
  evidence: CapabilityEvidence[];
  /** Risks (including capabilities that remain unavailable). */
  risks: string[];
  /** Steps that require explicit human approval (irreversible actions). */
  humanApprovalPoints: PlanStep[];
  /** Capabilities required but currently unavailable. */
  unavailableCapabilities: CapabilityId[];
  /** Deep-link suggestions for missing capability (configure/evaluate/review). */
  recommendations: Array<{
    capability: CapabilityId;
    action: 'CONFIGURE_PROVIDER' | 'EVALUATE_LOCAL_MODEL' | 'REVIEW_EXTERNAL_TOOL';
    label: string;
    suggestedFamily?: string;
  }>;
  /**
   * Optional AI-suggested overlay (EPIC-013 enrichment seam) — ADVISORY only.
   * The deterministic plan above remains authoritative for candidates,
   * selection, automation and approvals. Present only when a configured
   * provider produced a confident enrichment; never fabricated.
   */
  aiInsight?: {
    /** 1–2 sentence plain-language summary of how to produce the outcome. */
    summary?: string;
    /** AI-suggested capability ids (a subset of the graph). */
    suggestedCapabilities: CapabilityId[];
    /** AI-suggested step titles (alternative/refined pipeline). */
    suggestedSteps: string[];
    /** The provider/model that produced the insight (provenance). */
    provider: string;
    model: string;
    confident: boolean;
  };
}

// ── Request ───────────────────────────────────────────────────────

export interface CapabilityPlanRequest {
  /** The requested outcome, e.g. "Create a 60-second educational video". */
  outcome: string;
  /** User's enabled modules (career/business/factory...) — personalization. */
  userModules?: string[];
  /** User's configured provider families (from the registry). */
  configuredFamilies?: string[];
}

// ── Capability marketplace view model ─────────────────────────────

export interface CapabilityMarketplaceView {
  capabilities: Array<{
    id: CapabilityId;
    label: string;
    /** Whether VedMoulya currently has a READY candidate for it. */
    ready: boolean;
    /** Whether a candidate is known but needs configuration. */
    configurable: boolean;
    /** Best candidate name where one exists. */
    bestCandidate?: string;
  }>;
  generatedAt: string;
}

// ── Approval system ───────────────────────────────────────────────
// Irreversible actions must be explicitly approved: publish, send,
// deploy, purchase, delete, externally share.

export type IrreversibleAction = 'publish' | 'send' | 'deploy' | 'purchase' | 'delete' | 'share';

export const IRREVERSIBLE_ACTIONS: readonly IrreversibleAction[] = [
  'publish',
  'send',
  'deploy',
  'purchase',
  'delete',
  'share',
];

// ── Plan history (owner-scoped, bounded) ──────────────────────────

export interface CapabilityPlanSummary {
  id: string;
  requestedOutcome: string;
  createdAt: string;
  automationPercent: number;
  automationLevel: AutomationLevel;
  unavailableCount: number;
}
