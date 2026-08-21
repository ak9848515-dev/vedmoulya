// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model & Business Operating System · types
// SPRINT-032 — the minimum useful world representation for better decisions.
//
// This package is a COMPOSITION layer — NOT an engine and NOT a universal
// knowledge graph. It represents typed relationships BETWEEN EXISTING
// entities (the Brain's tasks/opportunities/outcomes, the marketplace's
// capabilities, the registry's providers, the proactive layer's
// assessments, the control plane's opportunity lifecycle). Everything is
// owner-scoped, bounded, evidence-carrying and NEVER fabricated:
//   • an observation without provenance is refused
//   • a score without evidence is 0 / UNKNOWN — never invented
//   • an external signal source that is not connected reports UNAVAILABLE
//   • nothing here approves, spends or executes — the frozen estate owns
//     every authority
// ─────────────────────────────────────────────────────────────────────────────

// ── The world graph (bounded, owner-scoped) ─────────────────────────────────

/** The typed entities the world model can represent. Each maps to an EXISTING
 *  estate concept (see the architecture report) — this list is a closed
 *  vocabulary, not a dumping ground. */
export type WorldEntityType =
  | 'user'
  | 'goal'
  | 'project'
  | 'skill'
  | 'work'
  | 'preference'
  | 'permission'
  | 'task'
  | 'workflow'
  | 'outcome'
  | 'opportunity'
  | 'business_unit'
  | 'problem'
  | 'service'
  | 'customer'
  | 'revenue'
  | 'cost'
  | 'risk'
  | 'capability'
  | 'provider'
  | 'model'
  | 'role'
  | 'worker'
  | 'signal';

/** Provenance discipline — mirrors the platform EvidenceStatus contract. */
export type ObservationStatus = 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN';

/** Where an observation came from. Every stored fact must carry one. */
export type ObservationSource =
  | 'brain-task'
  | 'brain-opportunity'
  | 'brain-outcome'
  | 'capability-marketplace'
  | 'provider-registry'
  | 'proactive-assessment'
  | 'control-lifecycle'
  | 'fabric'
  | 'cost-ledger'
  | 'user-statement'
  | 'workflow'
  | 'signal';

/** One typed node in the owner's world. `externalId` keeps the link to the
 *  existing engine's entity (task id, opportunity id, provider id, …) so the
 *  world never duplicates the estate — it indexes it. */
export interface WorldEntity {
  id: string;
  ownerId: string;
  type: WorldEntityType;
  label: string;
  /** Stable dedup key (owner + type + externalId) — re-observing the same
   *  external entity upserts, never duplicates. */
  stableKey: string;
  /** The existing engine's entity id this node represents (when applicable). */
  externalId?: string;
  /** Bounded structured properties (never secrets, never chain-of-thought). */
  properties?: Record<string, string | number | boolean>;
  /** Evidence the entity exists — never fabricated. */
  evidence: string[];
  provenance?: {
    source: ObservationSource;
    status: ObservationStatus;
    observedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

/** Allowed relation shapes: (fromType, toType) pairs for the closed
 *  vocabulary. Unknown shapes are refused at the domain boundary. */
export const WORLD_RELATION_SHAPES: ReadonlyArray<{
  type: WorldRelationType;
  from: WorldEntityType;
  to: WorldEntityType;
}> = [
  { type: 'has_goal', from: 'user', to: 'goal' },
  { type: 'has_project', from: 'user', to: 'project' },
  { type: 'has_skill', from: 'user', to: 'skill' },
  { type: 'has_work', from: 'user', to: 'work' },
  { type: 'has_preference', from: 'user', to: 'preference' },
  { type: 'has_permission', from: 'user', to: 'permission' },
  { type: 'belongs_to', from: 'work', to: 'project' },
  { type: 'contains_task', from: 'project', to: 'task' },
  { type: 'contains_task', from: 'workflow', to: 'task' },
  { type: 'has_workflow', from: 'project', to: 'workflow' },
  { type: 'has_workflow', from: 'business_unit', to: 'workflow' },
  { type: 'has_outcome', from: 'project', to: 'outcome' },
  { type: 'has_outcome', from: 'workflow', to: 'outcome' },
  { type: 'has_outcome', from: 'task', to: 'outcome' },
  { type: 'has_opportunity', from: 'user', to: 'opportunity' },
  { type: 'has_opportunity', from: 'business_unit', to: 'opportunity' },
  { type: 'has_problem', from: 'business_unit', to: 'problem' },
  { type: 'has_service', from: 'business_unit', to: 'service' },
  { type: 'has_customer', from: 'business_unit', to: 'customer' },
  { type: 'generates_revenue', from: 'business_unit', to: 'revenue' },
  { type: 'incurs_cost', from: 'business_unit', to: 'cost' },
  { type: 'has_risk', from: 'opportunity', to: 'risk' },
  { type: 'requires_capability', from: 'task', to: 'capability' },
  { type: 'requires_capability', from: 'workflow', to: 'capability' },
  { type: 'requires_capability', from: 'opportunity', to: 'capability' },
  { type: 'served_by_provider', from: 'capability', to: 'provider' },
  { type: 'uses_model', from: 'provider', to: 'model' },
  { type: 'fulfills_role', from: 'worker', to: 'role' },
  { type: 'assigned_role', from: 'workflow', to: 'role' },
  { type: 'decomposes_into', from: 'workflow', to: 'task' },
  { type: 'evidence_of', from: 'signal', to: 'opportunity' },
  { type: 'linked_to', from: 'opportunity', to: 'workflow' },
];

export type WorldRelationType =
  | 'has_goal'
  | 'has_project'
  | 'has_skill'
  | 'has_work'
  | 'has_preference'
  | 'has_permission'
  | 'belongs_to'
  | 'contains_task'
  | 'has_workflow'
  | 'has_outcome'
  | 'has_opportunity'
  | 'has_problem'
  | 'has_service'
  | 'has_customer'
  | 'generates_revenue'
  | 'incurs_cost'
  | 'has_risk'
  | 'requires_capability'
  | 'served_by_provider'
  | 'uses_model'
  | 'fulfills_role'
  | 'assigned_role'
  | 'decomposes_into'
  | 'evidence_of'
  | 'linked_to';

/** One typed edge in the owner's world. */
export interface WorldRelation {
  id: string;
  ownerId: string;
  type: WorldRelationType;
  fromType: WorldEntityType;
  fromId: string;
  toType: WorldEntityType;
  toId: string;
  note?: string;
  provenance?: ObservationSource;
  createdAt: string;
}

/** The bounded world graph view (never loaded whole — always sliced). */
export interface WorldGraphView {
  ownerId: string;
  entities: WorldEntity[];
  relations: WorldRelation[];
  totalEntities: number;
  totalRelations: number;
}

// ── Business operating model (configurable business units) ──────────────────

export type AutomationLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** A CONFIGURABLE business unit — never a hard-coded business. The examples
 *  (AI solutions, app builder, automation services, content/YouTube,
 *  advertising, data services, AI consulting, digital products) are just
 *  starter keys an operator/user can create, rename or remove. */
export interface BusinessUnit {
  id: string;
  ownerId: string;
  /** Stable key (owner + name) — idempotent upserts. */
  stableKey: string;
  name: string;
  purpose: string;
  targetCustomer?: string;
  offerings: string[];
  workflowIds: string[];
  opportunityIds: string[];
  costs: string[];
  revenue: string[];
  kpis: string[];
  automationLevel: AutomationLevel;
  aiCapabilities: string[];
  humanResponsibilities: string[];
  approvalRequirements: string[];
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

// ── AI workforce abstraction (provider-neutral) ─────────────────────────────

/**
 * ROLE ≠ MODEL ≠ PROVIDER ≠ AGENT. A role is a typed responsibility that any
 * capable provider/model can fulfill. `CONTENT_RESEARCHER` may run on Gemini,
 * OpenAI, Claude, DeepSeek, a local model or a future provider without
 * changing the business workflow — the business logic names roles, never
 * provider ids.
 */
export interface RoleSpec {
  id: string;
  ownerId: string;
  /** Stable key (owner + name) — idempotent upserts. */
  stableKey: string;
  name: string;
  responsibilities: string[];
  /** Capability ids the role needs (from the marketplace catalog). */
  capabilities: string[];
  /** Provider strategies acceptable for this role (advisory constraints). */
  providerStrategies: Array<'FREE' | 'LOCAL' | 'OPEN_SOURCE' | 'LOW_COST' | 'PREMIUM' | 'PRIVATE'>;
  /** Advisory model requirements (plain text; never a provider binding). */
  modelRequirements?: string[];
  /** Cost constraints (USD) — advisory; enforcement stays with CostLedger. */
  costConstraintsUsd?: number;
  privacyRequirement: 'PRIVATE' | 'STANDARD';
  /** The role's ceiling — the existing A/B/C/D authority vocabulary. A worker
   *  can never carry more authority than its role. */
  authorityClass: 'A' | 'B' | 'C' | 'D';
  inputContract?: string;
  outputContract?: string;
  /** Verification requirement — the existing verification authority applies. */
  verificationRequirement?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

/**
 * An ADVISORY worker = role + provider/model binding. Produced by suggesting
 * providers for a role through the Intelligence Fabric (selection strategy);
 * it is a RECOMMENDATION, never a deployed agent, never an authority grant.
 */
export interface WorkerSpec {
  id: string;
  ownerId: string;
  roleId: string;
  roleName: string;
  /** Suggested provider/model — substituted freely without business change. */
  providerId?: string;
  modelId?: string;
  strategy: 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED';
  /** Evidence for the suggestion (from the fabric selection). */
  reasons: string[];
  /** Never exceeds the role's authority class (structural). */
  authorityClass: 'A' | 'B' | 'C' | 'D';
  /** Advisory only — never executed/spent. */
  advisory: true;
}

// ── Business workflow factory (generic, bounded) ────────────────────────────

export type WorkflowStatus = 'DEFINED' | 'APPROVED' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface WorkflowStep {
  id: string;
  label: string;
  /** Capability id (marketplace vocabulary) when the step is AI-served. */
  capability?: string;
  /** Role name (AI workforce) when a role is expected to serve this step. */
  roleName?: string;
  /** Provider strategy hint — advisory only. */
  providerStrategy?: 'FREE' | 'LOCAL' | 'OPEN_SOURCE' | 'LOW_COST' | 'PREMIUM' | 'PRIVATE';
  /** Approval gate required BEFORE this step (the existing approval
   *  authority — never implied). */
  approvalGate?: string;
  /** Verification requirement (existing verification authority). */
  verificationRequirement?: string;
  dependsOn: string[];
}

/**
 * A generic business workflow: trigger → inputs → tasks → dependencies →
 * approval gates → execution (existing bridge only) → verification →
 * outputs → cost → expected/actual outcome. No industry is hard-coded.
 */
export interface BusinessWorkflow {
  id: string;
  ownerId: string;
  /** Stable key (owner + name). */
  stableKey: string;
  name: string;
  description: string;
  businessUnitId?: string;
  trigger: string;
  inputs: string[];
  steps: WorkflowStep[];
  outputs: string[];
  expectedOutcome?: string;
  actualOutcome?: string;
  /** Cost only when measured/estimated with evidence (CostLedger). */
  costUsd?: { value: number; status: ObservationStatus; evidence: string[] };
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
}

/** Result of a BOUNDED decomposition proposal (never executed here). */
export interface WorkflowDecomposition {
  ownerId: string;
  goal: string;
  plan: {
    taskCount: number;
    depth: number;
    maxParallelFanout: number;
    estimatedProviderCalls: number;
    estimatedCostUsd?: number;
    estimatedTimeMs?: number;
  };
  steps: Array<{ label: string; capability?: string; roleName?: string }>;
  /** Decision from the EXISTING WorkflowBounds (Intelligence Fabric). */
  bounds: { allowed: boolean; reason: string; exceeded?: string };
  /** The plan is a proposal only — nothing executes. */
  executed: false;
}

// ── Opportunity economics (evidence-only, factor-exposed) ───────────────────

/**
 * One scoring factor. `value` is 0..1 ONLY when evidence supports it;
 * without evidence the factor is UNKNOWN and contributes nothing to the
 * composite. The composite score is an ADVISORY ranking, never objective
 * truth — every factor stays visible.
 */
export interface OpportunityFactor {
  key:
    | 'marketEvidence'
    | 'customerPain'
    | 'demandSignal'
    | 'competition'
    | 'implementationEffort'
    | 'initialCost'
    | 'operatingCost'
    | 'potentialRevenue'
    | 'timeToFirstRevenue'
    | 'risk'
    | 'automationPotential'
    | 'userFit'
    | 'aiLeverage'
    | 'providerCost'
    | 'scalability'
    | 'defensibility'
    // SPRINT-033 (Part B) — founder/margin factors added to the closed
    // vocabulary. Every factor stays evidence-only; UNKNOWN contributes 0.
    | 'expectedMargin'
    | 'founderInvolvement';
  value?: number;
  status: ObservationStatus;
  evidence: string[];
}

/** Closed opportunity-category vocabulary (SPRINT-033 Part B). The assessor's
 *  free-text category is normalized against this when provided; unknown
 *  categories stay as-is (never invented). This is a vocabulary, not a
 *  classifier — no new intelligence engine. */
export const OPPORTUNITY_CATEGORIES: ReadonlyArray<string> = [
  'ai_services',
  'saas',
  'automation_services',
  'app_building',
  'content_business',
  'youtube_media',
  'advertising',
  'lead_generation',
  'developer_services',
  'enterprise_automation',
  'data_services',
  'education',
  'digital_products',
  'marketplaces',
  'vertical_ai',
  'local_business_automation',
  'emerging',
] as const;

export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

/** Normalize a free-text category against the closed vocabulary (case +
 *  punctuation tolerant); returns the raw text when no match — the world
 *  model never invents a category. */
export function normalizeOpportunityCategory(category: string): string {
  const normalized = category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  if (OPPORTUNITY_CATEGORIES.includes(normalized)) {
    return normalized;
  }
  return category.trim().slice(0, 120);
}

/** Zero / low-capital mode — the system NEVER promises income. */
export type CapitalMode = 'NO_COST' | 'LOW_COST' | 'CAPITAL_REQUIRED' | 'UNKNOWN';

/** Configurable budget tiers (INR) for zero/low-capital opportunity mode. */
export const CAPITAL_BUDGET_TIERS_INR: ReadonlyArray<number> = [0, 1000, 5000, 10000, 25000];

/** A full opportunity evaluation: the EXISTING assessor's base assessment +
 *  the factor breakdown + composite score + capital mode. */
export interface OpportunityEvaluation {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  /** Composite score 0..1 (advisory — never objective truth). */
  score: number;
  /** Every underlying factor, exposed. */
  factors: OpportunityFactor[];
  businessCase: string[];
  estimatedCost?: { label: string; status: ObservationStatus };
  estimatedRevenue?: { label: string; status: ObservationStatus };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  /** Zero/low-capital classification given the owner's budget. */
  capitalMode: CapitalMode;
  capitalBudgetInr: number;
  automationPotential: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  aiLeverage: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  mvpPlan: string[];
  /** The opportunity can never execute itself. */
  authorizationRequired: true;
  status: 'RESEARCHED' | 'APPROVED' | 'REJECTED';
  evidence: string[];
  /** SPRINT-034 — bounded, evidence-attached outcome feedback applied to this
   *  evaluation (empty when no verified outcome evidence exists for the
   *  category). Every adjustment exposes its evidence — never a silent score
   *  rewrite. */
  feedback?: OutcomeFeedbackResult['adjustments'];
  createdAt: string;
}

/** One ranked entry in the revenue opportunity pipeline. */
export interface OpportunityPipelineEntry {
  opportunityId: string;
  title: string;
  category: string;
  status: string;
  /** Advisory composite score (0 when no evidence). */
  score: number;
  capitalMode: CapitalMode;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  estimatedCost?: { label: string; status: ObservationStatus };
  estimatedValue?: { label: string; status: ObservationStatus };
  firstStep?: string;
  approvalRequired: boolean;
  evidence: string[];
}

// ── World signal interface (interfaces ONLY — never fabricated data) ────────

export type WorldSignalKind =
  | 'market_trends'
  | 'startup_ideas'
  | 'technology_releases'
  | 'ai_model_releases'
  | 'open_source_projects'
  | 'pricing_changes'
  | 'customer_demand'
  | 'competitor_changes'
  | 'regulatory_changes'
  | 'job_market'
  | 'content_trends';

export interface WorldSignal {
  id: string;
  kind: WorldSignalKind;
  title: string;
  description: string;
  /** External provenance when available (never fabricated). */
  provenance?: string;
  observedAt: string;
}

/**
 * Honest external-source status: AVAILABLE only when a real source answered;
 * UNAVAILABLE when no source is connected; ERROR when a source failed. The
 * world model NEVER fabricates live world data.
 */
export type WorldSignalSourceStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'ERROR';

export interface WorldSignalSourceResult {
  kind: WorldSignalKind;
  status: WorldSignalSourceStatus;
  signals: WorldSignal[];
  error?: string;
}

// ── Human vs AI responsibility boundary ─────────────────────────────────────

export type ResponsibilityClass = 'AI_ALLOWED' | 'APPROVAL_REQUIRED' | 'HUMAN_REQUIRED';

export interface BoundaryDecision {
  action: string;
  responsibilityClass: ResponsibilityClass;
  /** The existing authority (A/B/C/D via ActionClassPolicy). */
  actionClass: 'A' | 'B' | 'C' | 'D';
  reasons: string[];
  /** AI can research/analyze/draft/classify/prepare/test/simulate and execute
   *  approved low-risk work. Human remains authoritative for sensitive,
   *  financial, legal, irreversible, high-impact and business-creating
   *  actions. Silence/voice/AI-plans never count as approval. */
  authority:
    'SENSITIVE_ACTIONS' | 'IRREVERSIBLE_ACTIONS' | 'SAFE_VERBS' | 'NEVER_AUTOMATE' | 'DEFAULT';
}

// ── Revenue intelligence (SPRINT-033 Part F) ────────────────────────────────
// Evidence-carrying revenue/cost/effort model for the founder. NOT a new
// engine: every figure is VERIFIED / ESTIMATED / UNKNOWN only — never
// fabricated; margins and ROI are advisory composites computed from evidence
// only. The system eventually helps the founder decide BUILD / BUY /
// AUTOMATE / OUTSOURCE / STOP / SCALE — it never decides alone.

export type RevenueStreamKind =
  | 'SERVICE'
  | 'PRODUCT'
  | 'SUBSCRIPTION'
  | 'PROJECT'
  | 'AFFILIATE'
  | 'ADVERTISING'
  | 'LICENSING'
  | 'OTHER';

export type RevenueStreamStatus = 'ACTIVE' | 'PLANNED' | 'PAUSED' | 'ARCHIVED';

/** One evidence-carrying figure. `status` is never fabricated: UNKNOWN stays
 *  UNKNOWN; ESTIMATED requires evidence; VERIFIED requires a real record. */
export interface RevenueFigure {
  value: number;
  status: ObservationStatus;
  evidence: string[];
}

/** A revenue stream: revenue + costs + effort + conversion + retention — all
 *  evidence-carrying, all owner-scoped, optionally bound to a business unit. */
export interface RevenueStream {
  id: string;
  ownerId: string;
  stableKey: string;
  /** Optional link to a configured business unit (SPRINT-032). */
  businessUnitId?: string;
  name: string;
  kind: RevenueStreamKind;
  status: RevenueStreamStatus;
  /** Monthly figures (USD) — each only when evidence exists. */
  estimatedMonthlyRevenueUsd?: RevenueFigure;
  actualMonthlyRevenueUsd?: RevenueFigure;
  estimatedMonthlyCostUsd?: RevenueFigure;
  actualMonthlyCostUsd?: RevenueFigure;
  /** 0..1 — evidence-only. */
  automationPercentage?: RevenueFigure;
  /** Hours per month the founder/humans spend on this stream. */
  humanEffortHoursMonthly?: RevenueFigure;
  customerCount?: RevenueFigure;
  conversionRate?: RevenueFigure;
  retentionRate?: RevenueFigure;
  /** Advisory note — never a promise. */
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/** Advisory revenue snapshot for one owner. Figures appear ONLY when
 *  evidence-backed; nothing is summed from UNKNOWN. */
export interface RevenueSnapshot {
  ownerId: string;
  generatedAt: string;
  streamCount: number;
  activeStreamCount: number;
  /** Sum of evidence-backed estimated revenue across ACTIVE streams. */
  totalEstimatedMonthlyRevenueUsd?: number;
  /** Sum of evidence-backed actual revenue across ACTIVE streams. */
  totalActualMonthlyRevenueUsd?: number;
  totalEstimatedMonthlyCostUsd?: number;
  totalActualMonthlyCostUsd?: number;
  /** Advisory margin (revenue−cost)/revenue — only when both have evidence. */
  estimatedMargin?: number;
  actualMargin?: number;
  /** Advisory automation share (0..1) over evidence-backed streams. */
  averageAutomationPercentage?: number;
  totalHumanEffortHoursMonthly?: number;
  streams: Array<{
    id: string;
    name: string;
    kind: RevenueStreamKind;
    status: RevenueStreamStatus;
    estimatedMonthlyRevenueUsd?: number;
    actualMonthlyRevenueUsd?: number;
    estimatedMargin?: number;
    automationPercentage?: number;
  }>;
  /** Advisory — NEVER a promise. */
  advisory: true;
}

/** Advisory founder decision hint for a stream. Every hint is evidence-derived
 *  and advisory — the founder decides; nothing here spends or commits. */
export interface RevenueDecisionHint {
  streamId: string;
  streamName: string;
  /** BUILD / BUY / AUTOMATE / OUTSOURCE / STOP / SCALE — or UNKNOWN when no
   *  evidence supports a hint (honest default). */
  hint: 'BUILD' | 'BUY' | 'AUTOMATE' | 'OUTSOURCE' | 'STOP' | 'SCALE' | 'UNKNOWN';
  reasons: string[];
  advisory: true;
}

// ── Founder briefing (SPRINT-033 Part A) ────────────────────────────────────
// Advisory-first executive intelligence: WHAT IS HAPPENING · WHAT CHANGED ·
// WHAT NEEDS ATTENTION · WHAT REQUIRES APPROVAL. Composed from the existing
// estate (control plane posture + opportunity pipeline + revenue snapshot +
// cost + recent world observations + signals). `hasContent:false` → the
// caller must NOT notify (no-spam, same discipline as the proactive briefing).

export interface FounderBriefing {
  ownerId: string;
  generatedAt: string;
  /** Advisory only — never an action order. */
  advisory: true;
  today: {
    pendingApprovals: Array<{ title: string; category: string; status: string }>;
    activeOpportunities: number;
    highRiskOpportunities: number;
    revenueStreams: number;
    totalEstimatedMonthlyRevenueUsd?: number;
    costDailyUsd?: number;
    emergencyStopEngaged: boolean;
    autonomyLevel: number;
    settingsConfirmed: boolean;
  };
  whatChanged: Array<{ type: string; label: string; updatedAt: string }>;
  attention: Array<{ category: string; title: string; reason: string; approvalRequired: boolean }>;
  signals: Array<{ kind: WorldSignalKind; status: WorldSignalSourceStatus }>;
  hasContent: boolean;
}

// ── Workflow execution blueprint (SPRINT-033 Part E) ────────────────────────
// The controlled mechanism: Opportunity → founder approval → workflow
// specification → provider/capability selection → execution (existing bridge
// ONLY) → verification → outcome → learning. A blueprint is a REPRESENTATION
// that records per-step approval gates (via the existing A/B/C/D authority),
// verification requirements and bounds. It NEVER executes — `executed:false`
// is structural. Sensitive steps stay behind the existing approval authority;
// no voice-only authorization; no hidden execution; no autonomous spending.

export interface ExecutionBlueprintStep {
  id: string;
  label: string;
  capability?: string;
  roleName?: string;
  /** The existing action class for this step (A/B/C/D). */
  actionClass: 'A' | 'B' | 'C' | 'D';
  /** True when this step requires the EXISTING approval authority first. */
  approvalGateRequired: boolean;
  /** Why the gate exists (when required) — advisory text, never a grant. */
  approvalReason?: string;
  verificationRequirement?: string;
  dependsOn: string[];
}

export interface WorkflowExecutionBlueprint {
  id: string;
  ownerId: string;
  /** The opportunity / goal this blueprint is FOR (never auto-launched). */
  sourceTitle: string;
  sourceGoal: string;
  businessUnitId?: string;
  steps: ExecutionBlueprintStep[];
  /** Advisory estimated cost (evidence-only). */
  estimatedCostUsd?: RevenueFigure;
  /** Bounds decision from the EXISTING WorkflowBounds (SPRINT-030). */
  bounds: { allowed: boolean; reason: string; exceeded?: string };
  /** Approval gates recorded on the blueprint. */
  approvalGates: Array<{ stepId: string; label: string; actionClass: 'A' | 'B' | 'C' | 'D' }>;
  /** Structural — a blueprint is a REPRESENTATION, never an execution order. */
  executed: false;
  /** Structural — acting on it requires the existing approval authority. */
  authorizationRequired: true;
  createdAt: string;
}

// ── Outcome evidence & revenue → outcome feedback (SPRINT-034) ───────────────
// Verified-only outcome evidence feeds opportunity evaluation through
// composition. Raw AI responses, unverified predictions, recommendations,
// hypothetical revenue and fabricated estimates NEVER become learning/scoring
// evidence. Actuals are recorded ONLY when VERIFIED; UNKNOWN stays UNKNOWN.
// One outcome never rewrites global policy — adjustments are bounded.

export type OutcomeEvidenceKind =
  | 'REVENUE'
  | 'COST'
  | 'MARGIN'
  | 'EFFORT'
  | 'TIME'
  | 'QUALITY'
  | 'CUSTOMER_RESPONSE'
  | 'EXECUTION_RELIABILITY';

/** Expected vs actual — the actual side is VERIFIED-only (never inferred). */
export interface OutcomeEvidence {
  id: string;
  ownerId: string;
  /** Stable dedup key — re-recording the same (kind, opportunityId) evidence
   *  upserts; identical evidence never duplicates. */
  stableKey: string;
  kind: OutcomeEvidenceKind;
  /** The opportunity / workflow / business unit this evidence is FOR. */
  opportunityId?: string;
  workflowId?: string;
  businessUnitId?: string;
  category?: string;
  /** Expected side — ESTIMATED only when evidence exists. */
  expected?: { value: number; status: ObservationStatus; evidence: string[] };
  /** Actual side — REQUIRED to be VERIFIED; never inferred. */
  actual?: { value: number; status: ObservationStatus; evidence: string[] };
  /** Quality verdict / verification status from the EXISTING authority. */
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'FAILED' | 'UNKNOWN';
  /** The evidence trail — REQUIRED (no fabricated facts). */
  evidence: string[];
  /** External source when the outcome came from a real record (CostLedger,
   *  an invoice, a verified run) — provenance, never a guess. */
  source?: string;
  recordedAt: string;
}

/** The bounded feedback application for ONE verified outcome — the deltas are
 *  clamped (a single outcome can move a factor by at most FEEDBACK_DELTA_MAX
 *  toward the evidence direction; the composite is never rewritten globally). */
export interface OutcomeFeedbackResult {
  evidenceId: string;
  kind: OutcomeEvidenceKind;
  /** Factor(s) adjusted — always with the evidence attached. */
  adjustments: Array<{
    factor: OpportunityFactor['key'];
    previous: number | undefined;
    next: number | undefined;
    delta: number;
    evidence: string[];
  }>;
  /** When the evidence is not VERIFIED the feedback is refused entirely. */
  applied: boolean;
  reason: string;
}

// ── Blueprint approval requests (SPRINT-034) ────────────────────────────────
// A blueprint can produce an approval request using the EXISTING approval
// authority. The request exposes ACTION / REASON / BUSINESS / WORKFLOW / STEP
// / PROVIDER / ESTIMATED COST / DATA SCOPE / RISK / EXPECTED OUTCOME /
// REVERSIBILITY / AUTHORITY REQUIRED. The world model NEVER approves — the
// decision is delegated to the existing authority (WorldApprovalPort) and
// execution happens ONLY through the existing execution bridge.

export type BlueprintApprovalStatus =
  'WAITING_FOR_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface BlueprintApprovalRequest {
  id: string;
  ownerId: string;
  /** Stable dedup key (owner + blueprint id + step id) — one request per
   *  gated step; re-requesting upserts, never duplicates. */
  stableKey: string;
  blueprintId: string;
  stepId: string;
  action: string;
  reason: string;
  businessUnitId?: string;
  workflowId?: string;
  providerId?: string;
  estimatedCostUsd?: { value: number; status: ObservationStatus; evidence: string[] };
  dataScope?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  expectedOutcome?: string;
  /** Reversible / irreversible indication (never a claim of safety). */
  reversibility: 'REVERSIBLE' | 'IRREVERSIBLE' | 'UNKNOWN';
  /** The authority required — the existing A/B/C/D vocabulary. */
  authorityRequired: 'A' | 'B' | 'C' | 'D';
  status: BlueprintApprovalStatus;
  /** The EXISTING authority's task id for this action (from the Brain task
   *  registered for approval) — decisions route through it, never forged. */
  authorityTaskId?: string;
  /** The existing authority's decision record (set ONLY by the existing
   *  approval port — never by this layer). */
  decision?: {
    grantedBy: string;
    grantedAt: string;
    scope: string;
    note?: string;
  };
  /** Structural — the world model can never mark a blueprint executed. */
  executed: false;
  createdAt: string;
  updatedAt: string;
}

// ── Cost-weighted revenue intelligence (SPRINT-034) ─────────────────────────
// Reuses CostLedger / CostPolicyGuard for actual cost evidence. The system
// does NOT rank purely by revenue — it considers revenue, cost, margin, time,
// risk, confidence, automation potential and founder effort. Unknown cost is
// NOT zero; unknown revenue is NOT zero; unknown margin is NOT zero — UNKNOWN
// stays UNKNOWN. Every calculation exposes its assumptions.

export interface RevenueRankingEntry {
  streamId: string;
  streamName: string;
  kind: RevenueStreamKind;
  /** Evidence-backed only — undefined when no evidence (never 0). */
  estimatedMonthlyRevenueUsd?: number;
  actualMonthlyRevenueUsd?: number;
  estimatedMonthlyCostUsd?: number;
  actualMonthlyCostUsd?: number;
  /** Advisory margin (revenue−cost)/revenue — only when both have evidence. */
  estimatedMargin?: number;
  actualMargin?: number;
  /** Advisory ROI multiple — only when both revenue and cost have evidence. */
  roiUsd?: number;
  /** Measured CostLedger cost for this stream (when the ledger observes it). */
  measuredCostUsd?: number;
  /** The weighted rank key — margin-aware, not pure revenue. */
  rankScore?: number;
  /** Exposed assumptions — never hidden arithmetic. */
  assumptions: string[];
  advisory: true;
}

export interface RevenueRanking {
  ownerId: string;
  generatedAt: string;
  /** Sorted by rankScore (margin-aware) — advisory, never a promise. */
  entries: RevenueRankingEntry[];
  /** UNKNOWN values are explicitly NOT zero — this list names every stream
   *  with missing evidence. */
  unknownCost: string[];
  unknownRevenue: string[];
  advisory: true;
}

// ── Founder Command Center read model (SPRINT-034) ──────────────────────────
// Presentation/composition ONLY — the Command Center composes the existing
// read models (world overview, founder briefing, revenue snapshot, opportunity
// pipeline, control-plane posture, blueprint approvals, cost). No new engine.

export interface CommandCenterView {
  ownerId: string;
  generatedAt: string;
  advisory: true;
  today: {
    briefingHasContent: boolean;
    pendingApprovals: Array<{ title: string; category: string; status: string }>;
    highRiskOpportunities: number;
    attention: Array<{
      category: string;
      title: string;
      reason: string;
      approvalRequired: boolean;
    }>;
    changes: Array<{ type: string; label: string; updatedAt: string }>;
    emergencyStopEngaged: boolean;
    settingsConfirmed: boolean;
  };
  portfolio: {
    businessUnits: number;
    revenueStreams: number;
    activeRevenueStreams: number;
    totalEstimatedMonthlyRevenueUsd?: number;
    totalActualMonthlyRevenueUsd?: number;
    /** Measured cost per day (OBSERVED via CostLedger; absent → undefined). */
    costDailyUsd?: number;
    /** Measured cost split by provider (OBSERVED; absent → undefined). */
    costProviderUsd?: number;
    /** Revenue vs measured cost — ONLY where both sides have evidence;
     *  UNKNOWN otherwise (never fabricated ROI). */
    revenueVsCost?: { label: string; status: ObservationStatus };
    pipelineOpportunities: number;
  };
  intelligence: {
    signals: Array<{ kind: WorldSignalKind; status: WorldSignalSourceStatus }>;
    signalHealth: SignalHealthEntry[];
    entityCount: number;
    relationCount: number;
  };
  automation: {
    workflows: number;
    blueprintApprovals: Array<{
      id: string;
      blueprintId: string;
      action: string;
      status: BlueprintApprovalStatus;
    }>;
    /** SPRINT-037 — orchestration plans (multi-provider) with honest status
     *  and approval state. PLANNED plans are never presented as executable. */
    orchestrationPlans: Array<{
      id: string;
      goal: string;
      strategy: 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED';
      status: OrchestrationPlanStatus;
      approved: boolean;
      steps: number;
    }>;
  };
  approvals: Array<{
    id: string;
    action: string;
    reason: string;
    businessUnitId?: string;
    workflowId?: string;
    providerId?: string;
    estimatedCostUsd?: number;
    riskLevel: string;
    expectedOutcome?: string;
    reversibility: 'REVERSIBLE' | 'IRREVERSIBLE' | 'UNKNOWN';
    authorityRequired: string;
  }>;
}

// ── SPRINT-035 — bounded owner-scoped timeline + signal health ──────────────
// A timeline is composed from the EXISTING owner-scoped stores (opportunity
// lifecycle, outcome evidence, blueprint approvals, revenue streams) — NO new
// event store. Bounded + paginated; owner-scoped by construction.

export type TimelineEventType = 'OPPORTUNITY' | 'OUTCOME' | 'APPROVAL' | 'REVENUE';

export interface TimelineEvent {
  eventId: string;
  type: TimelineEventType;
  label: string;
  /** The record's current status when known (e.g. opportunity status,
   *  approval status, revenue stream status). */
  status?: string;
  /** The event timestamp (record's updatedAt / recordedAt / createdAt). */
  at: string;
  /** Stable key of the underlying record — idempotency (never duplicated). */
  stableKey: string;
}

export interface TimelineResult {
  ownerId: string;
  /** Bounded — never more than the requested limit (max 50). */
  events: TimelineEvent[];
  /** True when more events exist beyond this page. */
  hasMore: boolean;
  /** The offset used to produce this page. */
  offset: number;
  /** The bound applied. */
  limit: number;
}

/** Honest per-source health (SPRINT-035) — a source is AVAILABLE only after a
 *  real observation; UNAVAILABLE until configured/observed; ERROR after a
 *  failure. Never fabricated "live" status. */
export interface SignalHealthEntry {
  kind: WorldSignalKind;
  status: WorldSignalSourceStatus;
  /** Set after the first SUCCESSFUL observation. */
  lastSuccessAt?: string;
  /** Set after the most recent FAILURE (undefined when none). */
  lastErrorAt?: string;
  /** Plain-language last failure (no secrets, no raw payloads). */
  lastError?: string;
  /** True when an adapter is configured for this kind. */
  configured: boolean;
}

// ── Multi-provider orchestration plan (SPRINT-036) ───────────────────────────
// The composition seam that connects a bounded decomposition to the EXISTING
// authorities: per-step provider selection through the Intelligence Fabric
// (advisory, strategy-aware, privacy-overriding), the EXISTING WorkflowBounds,
// the EXISTING ActionClassPolicy (A/B/C/D), and a BOUNDED retry/fallback
// policy (deterministic — RETRY / FALLBACK / STOP / NEEDS_REVIEW). The plan
// is a REPRESENTATION: `executed:false` + `authorizationRequired:true` are
// structural — it never calls a provider, never spends, never approves. The
// runtime path remains the EXISTING execution bridge; this layer only plans,
// explains and bounds.

export type OrchestrationFailureMode =
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'QUOTA_EXHAUSTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'MALFORMED_RESPONSE'
  | 'INVALID_JSON'
  | 'PROVIDER_ERROR'
  | 'NETWORK_FAILURE'
  | 'POLICY_REJECTION'
  | 'COST_REJECTION'
  | 'VERIFICATION_DISAGREEMENT';

export type OrchestrationResponseAction = 'RETRY' | 'FALLBACK' | 'STOP' | 'NEEDS_REVIEW';

/** The deterministic bounded response to one failure mode — decided at plan
 *  time, enforced at execution time by the existing authorities. A provider
 *  that fails is never retried endlessly and never silently replaced. */
export interface RetryPolicyDecision {
  failureMode: OrchestrationFailureMode;
  action: OrchestrationResponseAction;
  reason: string;
  retriesAllowed: number;
  fallbackAllowed: boolean;
  /** Why fallback is blocked (privacy / cost / capability) — never silent. */
  fallbackBlockedReason?: string;
}

/** Honest per-step provider state — UNKNOWN until the fabric observes real
 *  evidence; never fabricated "healthy". */
export type OrchestratedProviderState =
  'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE' | 'ERROR' | 'UNKNOWN';

/** One step of an orchestration plan: the bound provider + WHY + expected
 *  cost + action class + bounded retry/fallback policy + verification
 *  requirement. Every field is evidence-carrying — nothing fabricated. */
export interface OrchestratedStep {
  stepId: string;
  label: string;
  capability: string;
  roleName?: string;
  /** Advisory provider/model binding from the EXISTING fabric selection. */
  providerId?: string;
  modelId?: string;
  /** The first privacy-safe fallback candidate (when one exists) — the plan
   *  exposes WHICH provider may replace a failed one; never a public fallback
   *  for a PRIVATE step. Absent when no safe candidate exists. */
  fallbackProviderId?: string;
  strategy: 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED';
  /** WHY this provider — the fabric's selection evidence (explainable). */
  reasons: string[];
  /** Expected cost (USD) — only when the selection carried evidence; an
   *  absent value is UNKNOWN, never 0. */
  expectedCostUsd?: number;
  /** The EXISTING action class (ActionClassPolicy) — never derived from
   *  provider output. */
  actionClass: 'A' | 'B' | 'C' | 'D';
  /** The privacy class applied to this step's selection. */
  privacyClass: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'PRIVATE';
  /** Honest provider state from the fabric (UNKNOWN until observed). */
  providerState: OrchestratedProviderState;
  /** The bounded retry/fallback decisions for this step's failure modes. */
  retryPolicy: RetryPolicyDecision[];
  /** Verification requirement — the EXISTING verification authority. */
  verificationRequirement?: string;
}

export type OrchestrationPlanStatus = 'PLANNED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** A bounded, owner-scoped, EXPLAINABLE multi-provider orchestration plan.
 *  Produced by composing the existing decomposition (WorkflowFactory), the
 *  existing fabric selection + bounds, the existing ActionClassPolicy and the
 *  bounded retry/fallback policy. NEVER executes — `executed:false` and
 *  `authorizationRequired:true` are structural. */
export interface OrchestrationPlan {
  id: string;
  ownerId: string;
  /** Stable key (owner + goal + strategy) — idempotent upserts. */
  stableKey: string;
  goal: string;
  strategy: 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED';
  steps: OrchestratedStep[];
  /** Bounds from the EXISTING fabric WorkflowBounds (never widened here). */
  bounds: { allowed: boolean; reason: string; exceeded?: string };
  /** Expected cost (USD) — evidence-only sum; absent → UNKNOWN (never 0). */
  estimatedCostUsd?: number;
  estimatedTimeMs?: number;
  /** Distinct providers participating (capability coverage, not a KPI). */
  providerCount: number;
  /** Advisory cost-policy line — enforcement stays with the EXISTING
   *  CostPolicyGuard / RunBudgetGuard at execution time. */
  costPolicy: { allowed: boolean; reason: string };
  status: OrchestrationPlanStatus;
  /** The founder's approval record — set ONLY when the existing authority
   *  (Brain) granted it. Never fabricated by the plan layer. */
  approval?: {
    grantedBy: string;
    grantedAt: string;
    scope: string;
    note?: string;
  };
  /** Structural — the plan never executes/spends/approves on its own. */
  executed: false;
  authorizationRequired: true;
  createdAt: string;
  updatedAt: string;
}

// ── SPRINT-038 — Opportunity Discovery & Revenue Validation ─────────────────
// A PRACTICAL business-problem representation: owner-scoped, bounded,
// evidence/provenance-REQUIRED (no fabricated customers/revenue/market size),
// with THREE DISTINCT advisory scores (problem / business-opportunity /
// experiment), an explainable problem LEVEL (0–4), a bounded lifecycle, a
// zero/low-cost experiment planner, explicit revenue-evidence states (verified
// payment is the ONLY revenue-verification path), a STOP (kill-bad-ideas)
// recommendation, provider economics over the existing Intelligence Fabric
// (existing providers preferred; capability gaps become founder
// notifications — no automatic paid adoption) and an advisory Business
// Candidate. Nothing here approves, spends, executes or promotes to memory.

export type ProblemLevel = 0 | 1 | 2 | 3 | 4;

export type ProblemLevelLabel =
  'INTERESTING' | 'ANNOYING' | 'COSTLY' | 'REVENUE_IMPACTING' | 'MISSION_CRITICAL';

/** The bounded opportunity lifecycle (Part E). No opportunity may jump from
 *  an idea to a business — every transition is validated against the
 *  transition table in the domain. */
export type ProblemStatus =
  | 'OBSERVED'
  | 'PROBLEM'
  | 'VALIDATED_PROBLEM'
  | 'ECONOMIC_OPPORTUNITY'
  | 'AI_FEASIBLE'
  | 'EXPERIMENT_CANDIDATE'
  | 'EXPERIMENT_APPROVAL_REQUIRED'
  | 'EXPERIMENT_RUNNING'
  | 'EXPERIMENT_COMPLETED'
  | 'PAYMENT_EVIDENCE'
  | 'BUSINESS_CANDIDATE'
  | 'BUILD_RECOMMENDED'
  | 'REJECTED'
  | 'DISMISSED'
  | 'NEEDS_REVIEW';

/** Explicit revenue-evidence states (Part J). Rules: "sounds useful" ≠
 *  revenue; "I would pay" ≠ revenue; proposal ≠ revenue; invoice ≠ paid
 *  revenue. Only VERIFIED payment evidence can become REVENUE_VERIFIED;
 *  repeat verified payments can become REPEAT_REVENUE / REPEATABLE_BUSINESS. */
export type RevenueValidationState =
  | 'NO_EVIDENCE'
  | 'INTEREST'
  | 'PROBLEM_CONFIRMED'
  | 'EXPERIMENT_SUCCESS'
  | 'PAYING_INTEREST'
  | 'REVENUE_VERIFIED'
  | 'REPEAT_REVENUE'
  | 'REPEATABLE_BUSINESS';

/** Where a problem observation came from (Part B). Every evidence record
 *  carries source + provenance; a factual claim without evidence is refused. */
export type ProblemEvidenceSource =
  | 'customer_interview'
  | 'customer_data'
  | 'direct_observation'
  | 'public_company_info'
  | 'public_reviews'
  | 'job_postings'
  | 'marketplace_demand'
  | 'public_pricing'
  | 'industry_reports'
  | 'startup_databases'
  | 'government_data'
  | 'vedmoulya_observation'
  | 'experiment_result'
  | 'verified_payment';

/** One problem-evidence record (Part B) — source, provenance, observedAt,
 *  reference, sanitized text, confidence. External content is EVIDENCE only —
 *  it can never become authorization. */
export interface ProblemEvidence {
  id: string;
  ownerId: string;
  source: ProblemEvidenceSource;
  observedAt: string;
  /** URL / doc id / interview note — provenance where available. */
  reference?: string;
  /** Sanitized evidence text — never a script/instruction (untrusted). */
  text: string;
  confidence: ObservationStatus;
  /** Structural — evidence can never authorize anything. */
  evidenceOnly: true;
}

/** A PRACTICAL, owner-scoped business problem (Part A). Every externally
 *  derived factual claim requires evidence; no evidence → UNKNOWN. Never
 *  fabricate customers, revenue, market size, willingness to pay, competitor
 *  weakness, demand, savings or ROI. */
export interface BusinessProblem {
  id: string;
  ownerId: string;
  /** Stable key (owner + problem statement) — idempotent upserts. */
  stableKey: string;
  customerOrBusiness?: string;
  industry?: string;
  workflow?: string;
  problemStatement: string;
  affectedRole?: string;
  pain?: string;
  frequency?: string;
  humanEffort?: string;
  estimatedCurrentCost?: RevenueFigure;
  revenueImpact?: RevenueFigure;
  errorImpact?: string;
  urgency?: string;
  currentSolution?: string;
  competitorAlternatives: string[];
  aiSuitability?: string;
  automationPotential?: RevenueFigure;
  buyer?: string;
  /** Willingness-to-pay EVIDENCE — never revenue (Part G/J). */
  willingnessToPayEvidence: ProblemEvidence[];
  implementationComplexity?: string;
  estimatedAiCost?: RevenueFigure;
  /** Provenance-REQUIRED — a problem with no evidence is refused. */
  evidence: ProblemEvidence[];
  /** Derived from evidence confidence — never fabricated. */
  confidence: ObservationStatus;
  status: ProblemStatus;
  revenueState: RevenueValidationState;
  /** Evidence-driven level (0–4) + the three advisory scores (Part C/D). */
  level?: ProblemLevel;
  levelLabel?: ProblemLevelLabel;
  assessment?: ProblemAssessment;
  /** Part M — when the system recommends STOP, the reason is stored here. */
  stopReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** Factor keys for the three DISTINCT advisory scores (Part C). Weights are
 *  documented in the domain — scores are advisory, never truth; UNKNOWN stays
 *  UNKNOWN (never converted to zero). */
export type ProblemScoreFactorKey =
  | 'pain'
  | 'frequency'
  | 'humanEffort'
  | 'recurringCost'
  | 'revenueImpact'
  | 'errorImpact'
  | 'urgency';

export type OpportunityScoreFactorKey =
  | 'economicValue'
  | 'willingnessToPay'
  | 'buyerClarity'
  | 'aiFeasibility'
  | 'automationPotential'
  | 'competition'
  | 'differentiation'
  | 'salesDifficulty'
  | 'implementationComplexity'
  | 'deliveryCost'
  | 'expectedMargin';

export type ExperimentScoreFactorKey =
  | 'experimentCost'
  | 'experimentDuration'
  | 'customerAccess'
  | 'dataAccess'
  | 'measurableOutcome'
  | 'reversibility'
  | 'risk'
  | 'expectedInformationGain';

/** One factor of one advisory score — value 0..1 ONLY when evidence supports
 *  it; UNKNOWN contributes nothing. */
export interface ProblemFactor {
  key: string;
  value?: number;
  status: ObservationStatus;
  evidence: string[];
}

export interface ProblemScoreResult {
  /** Advisory composite 0..1 (never truth). */
  score: number;
  factors: ProblemFactor[];
  /** Documented weights — never secret. */
  weights: Record<string, number>;
  rationale: string[];
  advisory: true;
}

export interface OpportunityScoreResult {
  score: number;
  factors: ProblemFactor[];
  weights: Record<string, number>;
  rationale: string[];
  advisory: true;
}

export interface ExperimentScoreResult {
  score: number;
  factors: ProblemFactor[];
  weights: Record<string, number>;
  rationale: string[];
  advisory: true;
}

/** The three distinct advisory assessments + level + capital mode + STOP
 *  recommendation for ONE problem (Parts C/D/M). */
export interface ProblemAssessment {
  problemScore: ProblemScoreResult;
  opportunityScore: OpportunityScoreResult;
  experimentScore: ExperimentScoreResult;
  level: ProblemLevel;
  levelLabel: ProblemLevelLabel;
  /** Evidence-driven reasons for the level classification. */
  levelReasons: string[];
  /** Cheapest-valid capital mode for the experiment (NO_COST preferred). */
  experimentCapitalMode: CapitalMode;
  /** Part M — kill bad ideas: STOP is recommended when evidence shows
   *  insufficient pain/economics/AI-fit/competition/buyer-access/margin or a
   *  failed experiment. Advisory — the founder decides. */
  stopRecommendation?: { stop: boolean; reasons: string[] };
  advisory: true;
}

/** The zero/low-cost experiment planner (Part F) — the CHEAPEST realistic
 *  validation experiment that can answer the question. Prefers NO_COST, then
 *  LOW_COST, then CAPITAL_REQUIRED; never recommends spending when a cheaper
 *  experiment answers the same question; spending stays behind existing
 *  authorization. */
export interface ExperimentPlan {
  id: string;
  ownerId: string;
  problemId: string;
  hypothesis: string;
  targetCustomer: string;
  problemUnderTest: string;
  objective: string;
  minimumRequiredData: string[];
  actions: string[];
  estimatedAiCost?: RevenueFigure;
  humanEffort?: RevenueFigure;
  duration?: RevenueFigure;
  successCriteria: string[];
  failureCriteria: string[];
  stopConditions: string[];
  measurementMethod: string;
  expectedInformationGain?: RevenueFigure;
  maxBudget?: RevenueFigure;
  capitalMode: CapitalMode;
  approvalRequired: boolean;
  /** Advisory — when a cheaper experiment can answer the same question, the
   *  planner says so (never spend when a cheaper experiment works). */
  cheaperAlternative?: string;
  status: 'DRAFT' | 'APPROVAL_REQUIRED' | 'APPROVED' | 'RUNNING' | 'COMPLETED' | 'STOPPED';
  createdAt: string;
  updatedAt: string;
}

/** Customer discovery composition (Part G) — PREPARATION only. VedMoulya
 *  prepares profiles / interview plans / question sets / an experiment
 *  proposal; it NEVER fabricates an interview result. A customer statement
 *  "this sounds useful" is INTEREST, not revenue; "I would pay ₹X" is
 *  willingness-to-pay EVIDENCE, not revenue; only a verified payment becomes
 *  REVENUE_VERIFIED. */
export interface CustomerDiscoveryPlan {
  problemId: string;
  ownerId: string;
  customerProfile?: string;
  interviewPlan: string[];
  problemValidationQuestions: string[];
  currentSolutionQuestions: string[];
  economicImpactQuestions: string[];
  buyerQuestions: string[];
  willingnessToPayQuestions: string[];
  experimentProposal: string;
  advisory: true;
}

/** Provider economics for a proposed AI workflow (Part K) — composes the
 *  EXISTING Intelligence Fabric. Existing providers MUST be preferred when
 *  they satisfy the requirements. When no existing provider satisfies a
 *  required capability/quality, a CAPABILITY GAP DETECTED founder
 *  notification is produced — with no automatic paid-provider adoption. */
export interface ProviderEconomicsResult {
  problemId: string;
  /** Advisory selections — existing providers preferred, cheapest suitable. */
  selections: Array<{
    capability: string;
    providerId?: string;
    modelId?: string;
    strategy: 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED';
    reasons: string[];
    preferredExisting: boolean;
  }>;
  /** CAPABILITY GAP DETECTED founder notifications (no auto-adoption). */
  capabilityGaps: Array<{
    requiredCapability: string;
    requiredQuality?: string;
    evaluatedProviders: string[];
    whyInsufficient: string[];
    recommendedCapability?: string;
    estimatedCost?: RevenueFigure;
    privacyImplications?: string;
    operationalRequirements?: string[];
    localOpenSourceAlternative?: string;
    founderApprovalRequired: true;
  }>;
  advisory: true;
}

/** Advisory Business Candidate (Part N) — produced only after sufficient
 *  evidence (validated problem + identifiable customer + economic value + AI
 *  feasibility + experiment result + willingness-to-pay evidence, preferably
 *  a verified payment). Remains advisory; the founder is the final authority. */
export interface BusinessCandidate {
  problemId: string;
  ownerId: string;
  serviceDefinition: string;
  targetCustomer: string;
  pricingHypothesis?: RevenueFigure;
  deliveryWorkflow: string[];
  providerStrategy: string;
  aiCost?: RevenueFigure;
  humanCost?: RevenueFigure;
  marginHypothesis?: RevenueFigure;
  customerAcquisitionHypothesis?: string;
  mvpScope: string[];
  automationPotential?: RevenueFigure;
  risks: string[];
  nextExperiment?: string;
  advisory: true;
  createdAt: string;
}

/** One row of the Opportunity Radar (Part I) — WHAT / WHY / EVIDENCE /
 *  ECONOMICS / AI FIT / COMPETITION / COST / EXPERIMENT / RESULT / NEXT
 *  ACTION. Never a fabricated claim. */
export interface OpportunityRadarEntry {
  problemId: string;
  problemStatement: string;
  status: ProblemStatus;
  revenueState: RevenueValidationState;
  level?: ProblemLevel;
  levelLabel?: ProblemLevelLabel;
  scores?: {
    problemScore: number;
    opportunityScore: number;
    experimentScore: number;
  };
  evidenceCount: number;
  hasVerifiedPayment: boolean;
  stopReason?: string;
  nextAction: string;
}

export interface OpportunityRadar {
  ownerId: string;
  generatedAt: string;
  /** Bounded — never more than the requested limit (max 50). */
  entries: OpportunityRadarEntry[];
  /** Stage counts for the Command Center Opportunity Radar section. */
  counts: {
    newProblems: number;
    validatedProblems: number;
    highValueProblems: number;
    experimentCandidates: number;
    runningExperiments: number;
    completedExperiments: number;
    paymentEvidence: number;
    businessCandidates: number;
    rejectedOpportunities: number;
  };
  advisory: true;
}

// ── The composed overview (bounded snapshot) ────────────────────────────────

export interface WorldOverview {
  ownerId: string;
  observedAt: string;
  entities: { type: WorldEntityType; count: number }[];
  entityCount: number;
  relationCount: number;
  businessUnits: number;
  roles: number;
  activeOpportunities: number;
  pipelineEntries: number;
  signals: Array<{ kind: WorldSignalKind; status: WorldSignalSourceStatus }>;
  emergencyStopEngaged: boolean;
  autonomyLevel: number;
  settingsConfirmed: boolean;
  /** The world model is a bounded index — never a universal knowledge graph. */
  bounded: true;
}

// ── SPRINT-039 — Founder Evidence Loop ───────────────────────────────────────
// The disciplined, auditable feedback loop that turns the founder's real-world
// observations + customer-discovery results into calibrated opportunity
// scoring. COMPOSITION ONLY — no new engine: observations/prospects are
// bounded owner-scoped evidence records with explicit evidence states;
// calibration is a bounded delta model over the EXISTING SPRINT-038 scores;
// next-best-action + comparison compose the existing problem/assessment
// models. Nothing here approves, spends, executes or promotes to memory.

/** Explicit evidence states for a founder observation (Part B/D). The system
 *  must NEVER confuse hypothesis / opinion / AI inference / market signal /
 *  founder observation / customer statement / customer commitment / payment. */
export type FounderEvidenceState =
  | 'OBSERVED'
  | 'REPORTED_BY_CUSTOMER'
  | 'FOUNDER_OBSERVED'
  | 'DOCUMENTED'
  | 'VERIFIED'
  | 'HYPOTHESIS'
  | 'UNKNOWN'
  | 'CONFLICTING';

/** One real-world observation entered by the founder (Part B). Provenance is
 *  MANDATORY — no provenance → deterministic refusal. The system never turns
 *  an observation into verified market truth automatically. */
export interface FounderObservation {
  id: string;
  ownerId: string;
  /** Optional reference to a registered BusinessProblem. */
  problemId?: string;
  timestamp: string;
  sourceType:
    | 'customer_conversation'
    | 'site_visit'
    | 'workflow_observation'
    | 'secondary_research'
    | 'experiment'
    | 'founder_knowledge'
    | 'other';
  /** Who/what the observation is about — e.g. "5 clinic owners". */
  sourceReference: string;
  /** Sanitized observed statement — never a script/instruction (untrusted). */
  observedStatement: string;
  context?: string;
  affectedCustomerSegment?: string;
  frequency?: string;
  severity?: string;
  currentWorkaround?: string;
  /** Stated willingness to pay — WTP EVIDENCE, never revenue (Part G/J). */
  statedWillingnessToPay?: RevenueFigure;
  statedBudget?: RevenueFigure;
  objection?: string;
  nextAction?: string;
  evidenceState: FounderEvidenceState;
  /** Deterministic evidence-strength rank (see EvidenceQuality in domain). */
  evidenceStrength: 'WEAK' | 'MODERATE' | 'STRONG' | 'UNKNOWN';
  /** Provenance (source, reference, observedAt) — REQUIRED. */
  provenance: { source: string; reference?: string; observedAt: string };
  verificationStatus: 'UNVERIFIED' | 'CROSS_CHECKED' | 'VERIFIED' | 'CONFLICTING';
  createdAt: string;
  updatedAt: string;
}

/** The minimum evidence-oriented customer-discovery record (Part C) — NOT a
 *  CRM. Statuses distinguish DISCOVERY from VALIDATION; a conversation is
 *  never a customer, interest is never revenue, stated WTP is never payment. */
export type ProspectDiscoveryStatus =
  | 'CONTACTED'
  | 'CONVERSATION'
  | 'PROBLEM_CONFIRMED'
  | 'SOLUTION_INTEREST'
  | 'WTP_SIGNAL'
  | 'PAYMENT_REQUESTED'
  | 'VERIFIED_PAYMENT'
  | 'LOST';

export interface CustomerDiscoveryRecord {
  id: string;
  ownerId: string;
  problemId: string;
  /** Prospect reference — e.g. "clinic-owner-3" (never a real PII dump). */
  prospectReference: string;
  customerSegment: string;
  problemDiscussed: string;
  currentSolution?: string;
  painSeverity?: string;
  frequency?: string;
  existingSpending?: RevenueFigure;
  budgetIndication?: RevenueFigure;
  willingnessToPayIndication?: RevenueFigure;
  objection?: string;
  desiredOutcome?: string;
  nextStep?: string;
  discoveryStatus: ProspectDiscoveryStatus;
  /** Provenance for the record (interview notes / call log / doc ref). */
  evidence: ProblemEvidence[];
  provenance: { source: string; reference?: string; observedAt: string };
  createdAt: string;
  updatedAt: string;
}

/** Bounded evidence calibration (Part E/F) — one observation may move a
 *  factor by at most `CALIBRATION_DELTA_MAX`; the evidence trail is retained;
 *  conflicting evidence stays visible; negative evidence lowers confidence;
 *  UNKNOWN never becomes zero; fabricated evidence is rejected. */
export interface EvidenceCalibrationResult {
  problemId: string;
  /** The adjusted (bounded) factor values. */
  factors: Array<{
    key: string;
    before?: number;
    after: number;
    delta: number;
    reason: string;
    evidenceRefs: string[];
    quality: EvidenceQualityState;
  }>;
  /** Every adjustment is explainable — the evidence trail is never dropped. */
  adjustments: Array<{
    observationId: string;
    factorKey: string;
    delta: number;
    reason: string;
    evidenceState: FounderEvidenceState;
    quality: EvidenceQualityState;
  }>;
  /** Conflicting evidence is VISIBLE — never silently resolved. */
  conflicts: Array<{
    factorKey: string;
    forEvidence: string[];
    againstEvidence: string[];
    state: 'CONFLICTING' | 'NEEDS_REVIEW';
  }>;
  advisory: true;
}

export type EvidenceQualityState = 'HIGH' | 'MODERATE' | 'LOW' | 'UNKNOWN' | 'NEEDS_REVIEW';

export interface EvidenceQualityResult {
  problemId: string;
  /** Deterministic quality dimensions — never fake precision. */
  dimensions: Array<{
    name: string;
    state: EvidenceQualityState;
    reason: string;
    evidenceRefs: string[];
  }>;
  overall: EvidenceQualityState;
  advisory: true;
}

export type NextBestActionKind =
  | 'TALK_TO_CUSTOMERS'
  | 'VERIFY_PROBLEM'
  | 'TEST_WTP'
  | 'RUN_NO_COST_EXPERIMENT'
  | 'RUN_LOW_COST_EXPERIMENT'
  | 'BUILD_MINIMUM_PROTOTYPE'
  | 'REQUEST_PAYMENT'
  | 'STOP'
  | 'WAIT_FOR_MORE_EVIDENCE';

/** Advisory NEXT BEST ACTION for one opportunity (Part H) — the action that
 *  maximizes expected information gained per unit of founder time/capital.
 *  The system is ALLOWED to recommend STOP. Explainable: WHY / EVIDENCE /
 *  COST / EXPECTED LEARNING / RISK / NEXT DECISION. */
export interface NextBestAction {
  problemId: string;
  action: NextBestActionKind;
  why: string[];
  evidenceRefs: string[];
  estimatedCost?: RevenueFigure;
  expectedLearning: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  nextDecision: string;
  capitalMode: CapitalMode;
  advisory: true;
}

export type OpportunityComparisonState =
  | 'STRONG_EVIDENCE'
  | 'PROMISING'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NEEDS_CUSTOMER_VALIDATION'
  | 'STOP'
  | 'UNKNOWN';

export interface OpportunityComparisonEntry {
  problemId: string;
  problemStatement: string;
  state: OpportunityComparisonState;
  problemSeverity: number | undefined;
  evidenceStrength: EvidenceQualityState;
  opportunityScore: number;
  willingnessToPaySignals: number;
  verifiedPayments: number;
  experimentCost: CapitalMode;
  founderInvolvement: 'LOW' | 'MEDIUM' | 'HIGH';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  nextBestAction: NextBestActionKind;
  reasons: string[];
}

export interface OpportunityComparison {
  ownerId: string;
  generatedAt: string;
  entries: OpportunityComparisonEntry[];
  advisory: true;
}

/** Bounded drill-down for one opportunity (Part L) — PROBLEM / EVIDENCE /
 *  CUSTOMERS / EXPERIMENTS / ECONOMICS / PROVIDERS / REVENUE / DECISION. */
export interface OpportunityDrilldown {
  problem: BusinessProblem;
  assessment?: ProblemAssessment;
  observations: FounderObservation[];
  prospects: CustomerDiscoveryRecord[];
  experiments: ExperimentPlan[];
  providers: ProviderEconomicsResult | undefined;
  nextBestAction: NextBestAction | undefined;
  revenueState: RevenueValidationState;
  verifiedPaymentCount: number;
  advisory: true;
}
