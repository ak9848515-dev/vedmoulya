// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Seed Catalog
// EI-009 — Enterprise Knowledge Intelligence Platform
// Realistic seed knowledge so the platform demonstrates value
// immediately: 30 items across the 14 knowledge categories,
// referencing the SAME seed entities the other EI catalogs seed
// (goal_blog_seed, openai, anthropic, research capability,
// strat_blog_001, …). Includes relationships, citations, versions,
// consumers, usage, trust + confidence. Used for dev, the web
// dashboard, and tests. Deterministic ids — idempotent upsert.
// ──────────────────────────────────────────────────────────────────

import type {
  KnowledgeCitation,
  KnowledgeConsumer,
  KnowledgeItem,
  KnowledgeRelationship,
  KnowledgeSourceType,
  KnowledgeTrustScore,
} from '../types/knowledge-types.js';

export const SEED_KNOWLEDGE_SIZE = 30;
export const SEED_RELATIONSHIPS_SIZE = 26;

// ── Compact item spec ────────────────────────────────────────────────────────

interface ItemSpec {
  id: string;
  title: string;
  description: string;
  source: string;
  sourceType: KnowledgeSourceType;
  owner: string;
  category: KnowledgeItem['category'];
  tags: string[];
  trust: number;
  trustFactors: string[];
  confidence: number;
  confidenceFactors: string[];
  version: number;
  citations: Array<{ sourceId: string; sourceTitle: string; reference: string; verified: boolean }>;
  consumers: Array<{
    consumerId: string;
    consumerType: KnowledgeConsumer['consumerType'];
    consumerLabel: string;
    usageCount: number;
  }>;
  reads: number;
  validation: KnowledgeItem['validationStatus'];
  lifecycle: KnowledgeItem['lifecycleStatus'];
  relationships: Array<{
    type: KnowledgeRelationship['type'];
    target: string;
    weight: number;
    note?: string;
  }>;
  createdAt: string;
}

const SPECS: ItemSpec[] = [
  // ── AI Knowledge ───────────────────────────────────────────────────────────
  {
    id: 'kn_openai_provider_profile',
    title: 'OpenAI provider profile',
    description:
      'Primary reasoning provider for the content pipeline. Capability mix: reasoning, coding, writing. Best quality on reasoning benchmarks. Cost above the economy tier; use for client-facing drafts.',
    source: 'provider_registry seed (EI-002)',
    sourceType: 'repository',
    owner: 'platform-team',
    category: 'ai',
    tags: ['openai', 'provider', 'reasoning', 'quality'],
    trust: 0.9,
    trustFactors: ['source repository reliability 0.95', 'validation "validated" contributes 1'],
    confidence: 0.9,
    confidenceFactors: ['Live registry health', 'Benchmark win-rate 0.94'],
    version: 2,
    citations: [
      {
        sourceId: 'provider-registry',
        sourceTitle: 'Enterprise Provider Registry',
        reference: 'providers/openai',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 14,
      },
      {
        consumerId: 'execution-orchestrator',
        consumerType: 'engine',
        consumerLabel: 'Execution Orchestrator (EI-005)',
        usageCount: 9,
      },
    ],
    reads: 48,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [
      { type: 'related_to', target: 'kn_anthropic_provider_profile', weight: 0.7 },
      { type: 'produces', target: 'kn_blog_pipeline_playbook', weight: 0.6 },
    ],
    createdAt: '2026-07-20T08:00:00.000Z',
  },
  {
    id: 'kn_anthropic_provider_profile',
    title: 'Anthropic provider profile',
    description:
      'High-quality long-context provider. Strong writing and instruction-following. Fallback candidate in the blog pipeline chain.',
    source: 'provider_registry seed (EI-002)',
    sourceType: 'repository',
    owner: 'platform-team',
    category: 'ai',
    tags: ['anthropic', 'provider', 'long-context'],
    trust: 0.86,
    trustFactors: ['source repository reliability 0.95', '4 citation(s)'],
    confidence: 0.85,
    confidenceFactors: ['Live registry health 97%'],
    version: 1,
    citations: [
      {
        sourceId: 'provider-registry',
        sourceTitle: 'Enterprise Provider Registry',
        reference: 'providers/anthropic',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 11,
      },
    ],
    reads: 31,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [{ type: 'related_to', target: 'kn_openai_provider_profile', weight: 0.7 }],
    createdAt: '2026-07-20T08:30:00.000Z',
  },
  {
    id: 'kn_capability_research',
    title: 'Research capability profile',
    description:
      'Web research and synthesis capability. Estimated cost per run 0.004 USD. Highest confidence in the capability registry. Required by the blog pipeline.',
    source: 'capability_registry seed (EI-001)',
    sourceType: 'repository',
    owner: 'platform-team',
    category: 'ai',
    tags: ['research', 'capability', 'synthesis'],
    trust: 0.88,
    trustFactors: ['source repository reliability 0.95', 'validation "validated" contributes 1'],
    confidence: 0.94,
    confidenceFactors: ['Registry confidence 0.94'],
    version: 1,
    citations: [
      {
        sourceId: 'capability-registry',
        sourceTitle: 'Enterprise Capability Registry',
        reference: 'capabilities/research',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 14,
      },
    ],
    reads: 37,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [
      { type: 'consumes', target: 'kn_blog_pipeline_playbook', weight: 0.8 },
      { type: 'related_to', target: 'kn_ai_execution_guidelines', weight: 0.5 },
    ],
    createdAt: '2026-07-21T09:00:00.000Z',
  },
  // ── Execution Knowledge ────────────────────────────────────────────────────
  {
    id: 'kn_blog_pipeline_playbook',
    title: 'Blog pipeline execution playbook',
    description:
      'End-to-end runbook for the blog goal: research → draft → review → publish. Mode pipeline; budget envelope $0.5–$1; strict 90% quality gate. Depends on the Research capability and falls back anthropic → google → deepseek.',
    source: 'execution_strategy_registry seed (EI-004)',
    sourceType: 'architecture',
    owner: 'platform-team',
    category: 'execution',
    tags: ['blog', 'pipeline', 'playbook', 'quality-gate'],
    trust: 0.85,
    trustFactors: ['source architecture reliability 0.9', '5 consumer(s) · 27 read(s)'],
    confidence: 0.84,
    confidenceFactors: ['Derived from strategy registry confidence'],
    version: 3,
    citations: [
      {
        sourceId: 'execution-strategy-registry',
        sourceTitle: 'Execution Strategy Registry',
        reference: 'strategies/strat_blog_001',
        verified: true,
      },
      {
        sourceId: 'execution-playbooks/',
        sourceTitle: 'Execution playbooks archive',
        reference: 'playbooks/blog-pipeline.md',
        verified: false,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 14,
      },
      {
        consumerId: 'learning-intelligence',
        consumerType: 'engine',
        consumerLabel: 'Learning Intelligence (EI-007)',
        usageCount: 12,
      },
      {
        consumerId: 'content-agency',
        consumerType: 'module',
        consumerLabel: 'Content Agency (AC-001)',
        usageCount: 6,
      },
    ],
    reads: 27,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [
      {
        type: 'depends_on',
        target: 'kn_capability_research',
        weight: 0.85,
        note: 'Research capability is the first pipeline stage',
      },
      { type: 'depends_on', target: 'kn_openai_provider_profile', weight: 0.7 },
      { type: 'supersedes', target: 'kn_blog_pipeline_playbook_v1', weight: 0.9 },
    ],
    createdAt: '2026-07-22T10:00:00.000Z',
  },
  {
    id: 'kn_blog_pipeline_playbook_v1',
    title: 'Blog pipeline playbook (v1, retired)',
    description:
      'First-generation blog runbook with a sequential single-provider flow. Superseded by the pipeline-mode playbook after provider fallback was added.',
    source: 'execution playbooks archive',
    sourceType: 'document',
    owner: 'platform-team',
    category: 'execution',
    tags: ['blog', 'pipeline', 'legacy'],
    trust: 0.55,
    trustFactors: ['source document reliability 0.7', 'deprecated lifecycle'],
    confidence: 0.7,
    confidenceFactors: ['Authored by the original pipeline team'],
    version: 1,
    citations: [
      {
        sourceId: 'execution-playbooks/',
        sourceTitle: 'Execution playbooks archive',
        reference: 'playbooks/blog-pipeline-v1.md',
        verified: false,
      },
    ],
    consumers: [],
    reads: 4,
    validation: 'validated',
    lifecycle: 'deprecated',
    relationships: [],
    createdAt: '2026-06-15T10:00:00.000Z',
  },
  // ── Goal / Project Knowledge ───────────────────────────────────────────────
  {
    id: 'kn_blog_seed_goal',
    title: 'Publish a client blog post — goal record',
    description:
      'The seed goal goal_blog_seed: publish a client blog post through the content-agency pipeline. High priority, business category, budget envelope $0.5–$1. Reference record for the Enterprise Brain decision plan plan_goal_blog_seed_seed.',
    source: 'goal_registry seed (EI-006)',
    sourceType: 'repository',
    owner: 'operations',
    category: 'project',
    tags: ['goal', 'blog', 'content-agency', 'seed'],
    trust: 0.87,
    trustFactors: ['source repository reliability 0.95', '3 citation(s)'],
    confidence: 0.82,
    confidenceFactors: ['Goal score 0.82', 'Declared priority high'],
    version: 1,
    citations: [
      {
        sourceId: 'goal-registry',
        sourceTitle: 'Enterprise Goal Registry',
        reference: 'goals/goal_blog_seed',
        verified: true,
      },
      {
        sourceId: 'brain-registry',
        sourceTitle: 'Enterprise Brain plan',
        reference: 'plans/plan_goal_blog_seed_seed',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 14,
      },
    ],
    reads: 22,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [
      { type: 'uses', target: 'kn_blog_pipeline_playbook', weight: 0.8 },
      { type: 'related_to', target: 'kn_client_acme_brand_guide', weight: 0.5 },
    ],
    createdAt: '2026-07-23T09:00:00.000Z',
  },
  // ── Client / Business Knowledge ────────────────────────────────────────────
  {
    id: 'kn_client_acme_brand_guide',
    title: 'Acme Inc. brand guide',
    description:
      'Tone, voice, and visual rules for Acme Inc. Client-facing content must match the guide before the 90% quality gate passes. Owner: account team.',
    source: 'client onboarding docs',
    sourceType: 'document',
    owner: 'account-team',
    category: 'client',
    tags: ['acme', 'brand', 'client', 'tone'],
    trust: 0.72,
    trustFactors: ['source document reliability 0.7', '3 consumer(s)'],
    confidence: 0.85,
    confidenceFactors: ['Reviewed by the account lead'],
    version: 2,
    citations: [
      {
        sourceId: 'client-docs/',
        sourceTitle: 'Acme onboarding pack',
        reference: 'acme/brand-guide.pdf',
        verified: false,
      },
    ],
    consumers: [
      {
        consumerId: 'content-agency',
        consumerType: 'module',
        consumerLabel: 'Content Agency (AC-001)',
        usageCount: 8,
      },
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 5,
      },
    ],
    reads: 33,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [{ type: 'owned_by', target: 'kn_account_team_handbook', weight: 0.8 }],
    createdAt: '2026-07-18T11:00:00.000Z',
  },
  {
    id: 'kn_account_team_handbook',
    title: 'Account team handbook',
    description:
      'Operating rules for the account team: client ownership, escalation paths, and content approval workflow. Source of the owned_by edge for client knowledge.',
    source: 'operations wiki',
    sourceType: 'document',
    owner: 'account-team',
    category: 'business',
    tags: ['account-team', 'operations', 'handbook'],
    trust: 0.68,
    trustFactors: ['source document reliability 0.7', '2 consumer(s)'],
    confidence: 0.8,
    confidenceFactors: ['Maintained by the account lead'],
    version: 1,
    citations: [
      {
        sourceId: 'operations-wiki',
        sourceTitle: 'Operations wiki',
        reference: 'wiki/account-handbook',
        verified: false,
      },
    ],
    consumers: [
      {
        consumerId: 'content-agency',
        consumerType: 'module',
        consumerLabel: 'Content Agency (AC-001)',
        usageCount: 4,
      },
    ],
    reads: 12,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [],
    createdAt: '2026-07-10T08:00:00.000Z',
  },
  // ── Architecture / Technical / API Knowledge ───────────────────────────────
  {
    id: 'kn_api_gateway_contract',
    title: 'API gateway tRPC contract',
    description:
      'The /api/trpc route contract: namespaces, auth + IDOR + rate-limit middleware, zod input schemas. Every EI engine exposes its namespace through this gateway. Reference for API knowledge consumers.',
    source: '03_Architecture docs',
    sourceType: 'architecture',
    owner: 'platform-team',
    category: 'api',
    tags: ['api', 'trpc', 'gateway', 'contract'],
    trust: 0.9,
    trustFactors: ['source architecture reliability 0.9', 'validation "validated" contributes 1'],
    confidence: 0.9,
    confidenceFactors: ['Generated from the gateway source'],
    version: 4,
    citations: [
      {
        sourceId: '03_Architecture/',
        sourceTitle: 'Architecture docs',
        reference: 'API_MANIFEST.md',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'learning-intelligence',
        consumerType: 'engine',
        consumerLabel: 'Learning Intelligence (EI-007)',
        usageCount: 7,
      },
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 7,
      },
    ],
    reads: 41,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [
      { type: 'parent', target: 'kn_enterprise_intelligence_architecture', weight: 0.8 },
    ],
    createdAt: '2026-07-15T08:00:00.000Z',
  },
  {
    id: 'kn_enterprise_intelligence_architecture',
    title: 'Enterprise Intelligence architecture',
    description:
      'EI-000 architecture: the 13 engines, 10 equations, and the layering types → contracts → domain → infrastructure → application → catalog. Parent of the API gateway contract and the engine registry docs.',
    source: '03_Architecture docs',
    sourceType: 'architecture',
    owner: 'platform-team',
    category: 'architecture',
    tags: ['architecture', 'ei-000', 'engines', 'layering'],
    trust: 0.92,
    trustFactors: [
      'source architecture reliability 0.9',
      'validation "validated" contributes 1',
      '6 citation(s)',
    ],
    confidence: 0.92,
    confidenceFactors: ['Canonical architecture specification'],
    version: 2,
    citations: [
      {
        sourceId: '03_Architecture/',
        sourceTitle: 'Architecture docs',
        reference: 'EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 14,
      },
    ],
    reads: 55,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [
      { type: 'child', target: 'kn_api_gateway_contract', weight: 0.8 },
      { type: 'implements', target: 'kn_learning_intelligence_platform', weight: 0.7 },
      { type: 'implements', target: 'kn_enterprise_brain_platform', weight: 0.7 },
    ],
    createdAt: '2026-07-01T08:00:00.000Z',
  },
  // ── Learning / Brain Knowledge ─────────────────────────────────────────────
  {
    id: 'kn_learning_intelligence_platform',
    title: 'Learning Intelligence platform (EI-007)',
    description:
      'The feedback loop: learning events → models → insights → recommendations → reports. Recommendations are born pending and require human approval. Consumes execution outcomes and knowledge items as evidence.',
    source: '03_Architecture docs (EI-007)',
    sourceType: 'architecture',
    owner: 'platform-team',
    category: 'learning',
    tags: ['learning', 'ei-007', 'recommendations', 'feedback'],
    trust: 0.89,
    trustFactors: ['source architecture reliability 0.9', '3 citation(s)'],
    confidence: 0.88,
    confidenceFactors: ['EI-007 completion report'],
    version: 1,
    citations: [
      {
        sourceId: '03_Architecture/',
        sourceTitle: 'Architecture docs',
        reference: 'LEARNING_INTELLIGENCE.md',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 14,
      },
    ],
    reads: 29,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [
      { type: 'consumes', target: 'kn_learning_events_observability', weight: 0.75 },
      { type: 'produces', target: 'kn_provider_selection_playbook', weight: 0.6 },
    ],
    createdAt: '2026-07-28T08:00:00.000Z',
  },
  {
    id: 'kn_enterprise_brain_platform',
    title: 'Enterprise Brain platform (EI-008)',
    description:
      'The decision layer: 14 explained decisions per goal, human-approval gate, handoff to the orchestrator. Consumes the knowledge registry as evidence for decisions.',
    source: '03_Architecture docs (EI-008)',
    sourceType: 'architecture',
    owner: 'platform-team',
    category: 'architecture',
    tags: ['brain', 'ei-008', 'decisions', 'approval'],
    trust: 0.9,
    trustFactors: ['source architecture reliability 0.9', 'validation "validated" contributes 1'],
    confidence: 0.9,
    confidenceFactors: ['EI-008 completion report'],
    version: 1,
    citations: [
      {
        sourceId: '03_Architecture/',
        sourceTitle: 'Architecture docs',
        reference: 'ENTERPRISE_BRAIN.md',
        verified: true,
      },
    ],
    consumers: [],
    reads: 25,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [{ type: 'consumes', target: 'kn_api_gateway_contract', weight: 0.7 }],
    createdAt: '2026-07-28T09:00:00.000Z',
  },
  // ── Learning (observed) ─────────────────────────────────────────────────────
  {
    id: 'kn_learning_events_observability',
    title: 'Learning events observability spec',
    description:
      'The 10 learning signal categories (provider, context, capability, prompt, budget, quality, execution, business, user preference, failure) and the source references that link every event back to a goal, task, session, or pipeline.',
    source: 'learning_intelligence package (EI-007)',
    sourceType: 'repository',
    owner: 'platform-team',
    category: 'learning',
    tags: ['learning', 'events', 'observability', 'signals'],
    trust: 0.84,
    trustFactors: ['source repository reliability 0.95'],
    confidence: 0.85,
    confidenceFactors: ['From the EI-007 source'],
    version: 1,
    citations: [
      {
        sourceId: 'learning-intelligence/src',
        sourceTitle: 'Learning Intelligence source',
        reference: 'types/learning-types.ts',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'learning-intelligence',
        consumerType: 'engine',
        consumerLabel: 'Learning Intelligence (EI-007)',
        usageCount: 12,
      },
    ],
    reads: 18,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [],
    createdAt: '2026-07-26T08:00:00.000Z',
  },
  // ── Domain / SAP / Policy / User / Document Knowledge ──────────────────────
  {
    id: 'kn_sap_client_master_data',
    title: 'SAP client master data mapping',
    description:
      'Mapping of client master data fields between SAP and the CRM export. Used by the client operations module when reconciling invoices.',
    source: 'SAP export (quarterly)',
    sourceType: 'database',
    owner: 'data-team',
    category: 'sap',
    tags: ['sap', 'master-data', 'crm', 'mapping'],
    trust: 0.78,
    trustFactors: ['source database reliability 0.85'],
    confidence: 0.8,
    confidenceFactors: ['Verified against the last export'],
    version: 5,
    citations: [
      {
        sourceId: 'sap-export',
        sourceTitle: 'SAP quarterly export',
        reference: 'exports/Q3/master-data.csv',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'client-ops',
        consumerType: 'module',
        consumerLabel: 'Client Operations (AC-002)',
        usageCount: 9,
      },
    ],
    reads: 21,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [{ type: 'depends_on', target: 'kn_sap_field_glossary', weight: 0.8 }],
    createdAt: '2026-06-30T08:00:00.000Z',
  },
  {
    id: 'kn_sap_field_glossary',
    title: 'SAP field glossary',
    description:
      'Definitions of the SAP fields used across exports: KUNNR, NAME1, VKORG, and the invoice reconciliation fields. Single source of truth for SAP terminology.',
    source: 'SAP documentation',
    sourceType: 'document',
    owner: 'data-team',
    category: 'sap',
    tags: ['sap', 'glossary', 'fields'],
    trust: 0.7,
    trustFactors: ['source document reliability 0.7'],
    confidence: 0.85,
    confidenceFactors: ['Reviewed by the data team'],
    version: 2,
    citations: [
      {
        sourceId: 'sap-docs',
        sourceTitle: 'SAP documentation portal',
        reference: 'docs/field-glossary',
        verified: false,
      },
    ],
    consumers: [],
    reads: 15,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [],
    createdAt: '2026-06-20T08:00:00.000Z',
  },
  {
    id: 'kn_privacy_policy_content',
    title: 'Content privacy policy',
    description:
      'What client content may be stored, processed, and retained. All client-facing pipeline output must comply. Owners must review before activating content modules.',
    source: 'company policy library',
    sourceType: 'document',
    owner: 'legal',
    category: 'policy',
    tags: ['privacy', 'policy', 'compliance', 'content'],
    trust: 0.82,
    trustFactors: [
      'source document reliability 0.7',
      'validation "validated" contributes 1',
      '3 citation(s)',
    ],
    confidence: 0.9,
    confidenceFactors: ['Reviewed by legal'],
    version: 3,
    citations: [
      {
        sourceId: 'policy-library',
        sourceTitle: 'Company policy library',
        reference: 'policies/privacy-content.md',
        verified: true,
      },
      {
        sourceId: 'legal-review',
        sourceTitle: 'Legal review notes',
        reference: 'reviews/privacy-2026-01',
        verified: false,
      },
    ],
    consumers: [
      {
        consumerId: 'content-agency',
        consumerType: 'module',
        consumerLabel: 'Content Agency (AC-001)',
        usageCount: 10,
      },
    ],
    reads: 44,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [{ type: 'related_to', target: 'kn_client_acme_brand_guide', weight: 0.4 }],
    createdAt: '2026-07-05T08:00:00.000Z',
  },
  {
    id: 'kn_ai_execution_guidelines',
    title: 'AI execution guidelines',
    description:
      'Company policy for AI usage: human approval before delivery, quality gates, provider data residency, and the learning feedback loop. Applies to every enterprise intelligence engine.',
    source: 'company policy library',
    sourceType: 'document',
    owner: 'legal',
    category: 'policy',
    tags: ['ai', 'policy', 'governance', 'approval'],
    trust: 0.85,
    trustFactors: [
      'source policy reliability 0.7',
      'validation "validated" contributes 1',
      '4 citation(s)',
    ],
    confidence: 0.88,
    confidenceFactors: ['Board-reviewed governance policy'],
    version: 2,
    citations: [
      {
        sourceId: 'policy-library',
        sourceTitle: 'Company policy library',
        reference: 'policies/ai-execution.md',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 14,
      },
      {
        consumerId: 'execution-orchestrator',
        consumerType: 'engine',
        consumerLabel: 'Execution Orchestrator (EI-005)',
        usageCount: 8,
      },
    ],
    reads: 39,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [
      { type: 'related_to', target: 'kn_capability_research', weight: 0.5 },
      { type: 'parent', target: 'kn_blog_pipeline_playbook', weight: 0.6 },
    ],
    createdAt: '2026-07-08T08:00:00.000Z',
  },
  {
    id: 'kn_user_preferences_survey',
    title: 'User preferences survey Q2',
    description:
      'Survey of user preferences for the learning module: weekly digest, execution summaries, and confidence display. Feeds the user preference learning category.',
    source: 'user research (survey Q2)',
    sourceType: 'report',
    owner: 'product',
    category: 'user',
    tags: ['user', 'survey', 'preferences', 'product'],
    trust: 0.62,
    trustFactors: ['source report reliability 0.8', 'sample size 40'],
    confidence: 0.7,
    confidenceFactors: ['Self-reported survey data'],
    version: 1,
    citations: [
      {
        sourceId: 'user-research',
        sourceTitle: 'User research archive',
        reference: 'surveys/Q2-preferences.pdf',
        verified: false,
      },
    ],
    consumers: [
      {
        consumerId: 'learning-intelligence',
        consumerType: 'engine',
        consumerLabel: 'Learning Intelligence (EI-007)',
        usageCount: 6,
      },
    ],
    reads: 19,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [],
    createdAt: '2026-07-12T08:00:00.000Z',
  },
  {
    id: 'kn_marketplace_categories',
    title: 'Marketplace category taxonomy',
    description:
      'The marketplace capability categories and their placement rules. Reference for the business module when recommending capabilities to users.',
    source: 'marketplace module',
    sourceType: 'system',
    owner: 'product',
    category: 'domain',
    tags: ['marketplace', 'taxonomy', 'capabilities'],
    trust: 0.75,
    trustFactors: ['source system reliability 0.78'],
    confidence: 0.8,
    confidenceFactors: ['Maintained by the product team'],
    version: 1,
    citations: [],
    consumers: [
      {
        consumerId: 'marketplace',
        consumerType: 'module',
        consumerLabel: 'Marketplace module',
        usageCount: 5,
      },
    ],
    reads: 11,
    validation: 'pending',
    lifecycle: 'review',
    relationships: [],
    createdAt: '2026-07-30T08:00:00.000Z',
  },
  // ── Technical / Document ───────────────────────────────────────────────────
  {
    id: 'kn_content_agency_architecture',
    title: 'Content Agency architecture (EPIC-003)',
    description:
      'AC-001/AC-002 module architecture: brand, project, content, invoice, client operations, and the portal. Reuses the shared AI orchestrator — no duplicated logic.',
    source: '03_Architecture docs',
    sourceType: 'architecture',
    owner: 'platform-team',
    category: 'technical',
    tags: ['content-agency', 'architecture', 'ac-001', 'portal'],
    trust: 0.84,
    trustFactors: ['source architecture reliability 0.9'],
    confidence: 0.85,
    confidenceFactors: ['EPIC-003 completion report'],
    version: 1,
    citations: [
      {
        sourceId: '03_Architecture/',
        sourceTitle: 'Architecture docs',
        reference: 'CONTENT_AGENCY.md',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'content-agency',
        consumerType: 'module',
        consumerLabel: 'Content Agency (AC-001)',
        usageCount: 9,
      },
    ],
    reads: 16,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [
      { type: 'implements', target: 'kn_ai_execution_guidelines', weight: 0.6 },
      { type: 'parent', target: 'kn_client_acme_brand_guide', weight: 0.5 },
    ],
    createdAt: '2026-07-11T08:00:00.000Z',
  },
  {
    id: 'kn_execution_graph_model',
    title: 'Execution graph model (EI-005)',
    description:
      'The orchestrator graph model: nodes, edges, state machine, sessions, workers, queues. Conversion of a strategy into an executable graph is deterministic.',
    source: 'execution-orchestrator package',
    sourceType: 'repository',
    owner: 'platform-team',
    category: 'technical',
    tags: ['execution', 'graph', 'orchestrator', 'ei-005'],
    trust: 0.83,
    trustFactors: ['source repository reliability 0.95'],
    confidence: 0.82,
    confidenceFactors: ['From the EI-005 source'],
    version: 2,
    citations: [
      {
        sourceId: 'execution-orchestrator/src',
        sourceTitle: 'Orchestrator source',
        reference: 'domain/graph',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'execution-orchestrator',
        consumerType: 'engine',
        consumerLabel: 'Execution Orchestrator (EI-005)',
        usageCount: 11,
      },
    ],
    reads: 23,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [{ type: 'related_to', target: 'kn_blog_pipeline_playbook', weight: 0.6 }],
    createdAt: '2026-07-16T08:00:00.000Z',
  },
  {
    id: 'kn_provider_selection_playbook',
    title: 'Provider selection playbook',
    description:
      'How the platform chooses providers: learned outcomes (EI-007) first, then live registry health (EI-002), then fallback chain. Produced by the Learning Intelligence recommendations.',
    source: 'learning recommendations archive',
    sourceType: 'generated',
    owner: 'platform-team',
    category: 'technical',
    tags: ['provider', 'selection', 'playbook', 'learning'],
    trust: 0.66,
    trustFactors: ['source generated reliability 0.55', '3 consumer(s)'],
    confidence: 0.8,
    confidenceFactors: ['Approved EI-007 recommendation'],
    version: 1,
    citations: [
      {
        sourceId: 'learning-registry',
        sourceTitle: 'Learning recommendation',
        reference: 'recommendations/best_provider',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 9,
      },
    ],
    reads: 17,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [{ type: 'uses', target: 'kn_openai_provider_profile', weight: 0.7 }],
    createdAt: '2026-07-29T08:00:00.000Z',
  },
  {
    id: 'kn_domain_life_os_vocabulary',
    title: 'Life OS domain vocabulary',
    description:
      'The domain glossary: goal, task, execution, knowledge, learning, decision. Shared vocabulary across all modules to avoid concept drift.',
    source: '09_Documents/Company Glossary.md',
    sourceType: 'document',
    owner: 'program-management',
    category: 'domain',
    tags: ['glossary', 'domain', 'vocabulary'],
    trust: 0.71,
    trustFactors: ['source document reliability 0.7', '2 citation(s)'],
    confidence: 0.8,
    confidenceFactors: ['Reviewed by program management'],
    version: 1,
    citations: [
      {
        sourceId: '09_Documents/',
        sourceTitle: 'Company Glossary',
        reference: 'Company Glossary.md',
        verified: true,
      },
    ],
    consumers: [],
    reads: 9,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [],
    createdAt: '2026-07-06T08:00:00.000Z',
  },
  // ── Document Knowledge ─────────────────────────────────────────────────────
  {
    id: 'kn_document_templates_index',
    title: 'Document templates index',
    description:
      'Index of approved document templates: proposal, invoice, brand brief, and onboarding pack. The Content Agency resolves these by type when generating deliverables.',
    source: 'document templates library',
    sourceType: 'document',
    owner: 'content-team',
    category: 'document',
    tags: ['templates', 'documents', 'proposal', 'invoice'],
    trust: 0.74,
    trustFactors: ['source document reliability 0.7', '2 citation(s)'],
    confidence: 0.78,
    confidenceFactors: ['Reviewed by the content team'],
    version: 2,
    citations: [
      {
        sourceId: 'templates-library',
        sourceTitle: 'Templates library',
        reference: 'templates/index.json',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'content-agency',
        consumerType: 'module',
        consumerLabel: 'Content Agency (AC-001)',
        usageCount: 7,
      },
    ],
    reads: 13,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [],
    createdAt: '2026-07-07T08:00:00.000Z',
  },
  {
    id: 'kn_draft_quarterly_report',
    title: 'Draft: quarterly business review',
    description:
      'Draft Q3 business review notes. Not yet validated — numbers are being reconciled against the SAP export.',
    source: 'business team drafts',
    sourceType: 'manual',
    owner: 'business-team',
    category: 'business',
    tags: ['qbr', 'report', 'draft'],
    trust: 0.42,
    trustFactors: ['source manual reliability 0.4', 'unvalidated'],
    confidence: 0.6,
    confidenceFactors: ['Draft — unreconciled numbers'],
    version: 1,
    citations: [],
    consumers: [],
    reads: 2,
    validation: 'pending',
    lifecycle: 'draft',
    relationships: [],
    createdAt: '2026-08-03T08:00:00.000Z',
  },
  // ── Project / User / Context Knowledge ─────────────────────────────────────
  {
    id: 'kn_context_assembly_strategy',
    title: 'Context assembly strategy (EI-003)',
    description:
      'How context is ranked, filtered, compressed, and assembled: priority categories first, threshold compression under 30k tokens, hybrid beyond. The authoritative context playbook.',
    source: 'context package (EI-003)',
    sourceType: 'architecture',
    owner: 'platform-team',
    category: 'execution',
    tags: ['context', 'assembly', 'compression', 'ei-003'],
    trust: 0.82,
    trustFactors: ['source architecture reliability 0.9'],
    confidence: 0.8,
    confidenceFactors: ['From the EI-003 source'],
    version: 1,
    citations: [
      {
        sourceId: '03_Architecture/',
        sourceTitle: 'Architecture docs',
        reference: 'CONTEXT_INTELLIGENCE.md',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'context',
        consumerType: 'engine',
        consumerLabel: 'Context Intelligence (EI-003)',
        usageCount: 10,
      },
    ],
    reads: 14,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [
      { type: 'related_to', target: 'kn_enterprise_intelligence_architecture', weight: 0.5 },
    ],
    createdAt: '2026-07-24T08:00:00.000Z',
  },
  {
    id: 'kn_mobile_release_notes',
    title: 'Mobile release notes — Capacitor wrapper',
    description:
      'MOB-002: Android wrapper notes — edge-to-edge insets, secure storage, splash API. Project log for the mobile build.',
    source: 'mobile project log',
    sourceType: 'system',
    owner: 'mobile-team',
    category: 'project',
    tags: ['mobile', 'capacitor', 'android', 'release'],
    trust: 0.69,
    trustFactors: ['source system reliability 0.78'],
    confidence: 0.75,
    confidenceFactors: ['Logged at release time'],
    version: 1,
    citations: [],
    consumers: [],
    reads: 5,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [],
    createdAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'kn_learning_feedback_signals',
    title: 'Learning feedback signal catalog',
    description:
      'The user-preference and failure signal catalog that the Learning platform records after each execution: provider, context, capability, prompt, budget, quality, execution, business, user preference, failure.',
    source: 'learning-intelligence package (EI-007)',
    sourceType: 'repository',
    owner: 'platform-team',
    category: 'learning',
    tags: ['learning', 'signals', 'feedback'],
    trust: 0.85,
    trustFactors: ['source repository reliability 0.95'],
    confidence: 0.86,
    confidenceFactors: ['From the EI-007 source'],
    version: 1,
    citations: [
      {
        sourceId: 'learning-intelligence/src',
        sourceTitle: 'Learning Intelligence source',
        reference: 'catalog/learning-catalog.ts',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'learning-intelligence',
        consumerType: 'engine',
        consumerLabel: 'Learning Intelligence (EI-007)',
        usageCount: 12,
      },
    ],
    reads: 20,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [
      { type: 'related_to', target: 'kn_learning_events_observability', weight: 0.7 },
    ],
    createdAt: '2026-07-27T08:00:00.000Z',
  },
  {
    id: 'kn_strategy_budget_envelope',
    title: 'Strategy budget envelope rules',
    description:
      'Budget envelopes per execution mode: pipeline, sequential, parallel. How estimatedCostRangeUsd from goal classification constrains provider selection.',
    source: 'execution-strategy package (EI-004)',
    sourceType: 'repository',
    owner: 'platform-team',
    category: 'execution',
    tags: ['budget', 'envelope', 'strategy'],
    trust: 0.8,
    trustFactors: ['source repository reliability 0.95'],
    confidence: 0.78,
    confidenceFactors: ['From the EI-004 source'],
    version: 1,
    citations: [
      {
        sourceId: 'execution-strategy/src',
        sourceTitle: 'Execution Strategy source',
        reference: 'domain/services',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 8,
      },
    ],
    reads: 10,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [{ type: 'uses', target: 'kn_blog_pipeline_playbook', weight: 0.6 }],
    createdAt: '2026-07-25T08:00:00.000Z',
  },
  {
    id: 'kn_identity_sso_contract',
    title: 'Identity & SSO contract',
    description:
      'OAuth2 redirect flow, JWT session tokens, secure storage on mobile. Reference for the identity integration across modules.',
    source: 'identity service docs',
    sourceType: 'api',
    owner: 'platform-team',
    category: 'technical',
    tags: ['identity', 'sso', 'oauth', 'jwt'],
    trust: 0.79,
    trustFactors: ['source api reliability 0.88'],
    confidence: 0.82,
    confidenceFactors: ['Verified against the identity service'],
    version: 2,
    citations: [
      {
        sourceId: 'identity-service',
        sourceTitle: 'Identity service docs',
        reference: 'docs/sso-contract.md',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'app-shell',
        consumerType: 'module',
        consumerLabel: 'Web app shell',
        usageCount: 12,
      },
    ],
    reads: 26,
    validation: 'validated',
    lifecycle: 'active',
    relationships: [{ type: 'related_to', target: 'kn_api_gateway_contract', weight: 0.6 }],
    createdAt: '2026-07-14T08:00:00.000Z',
  },
];

// ── Builders ─────────────────────────────────────────────────────────────────

function trust(score: number, factors: string[]): KnowledgeTrustScore {
  return { score, level: score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low', factors };
}

function item(spec: ItemSpec): KnowledgeItem {
  const now = spec.createdAt;
  const citations: KnowledgeCitation[] = spec.citations.map((c) => ({
    citationId: `cit_seed_${spec.id}_${c.sourceId.replace(/[^a-z0-9]/gi, '')}`,
    sourceId: c.sourceId,
    sourceTitle: c.sourceTitle,
    sourceType: spec.sourceType,
    reference: c.reference,
    retrievedAt: now,
    verified: c.verified,
  }));
  const consumers: KnowledgeConsumer[] = spec.consumers.map((c) => ({
    consumerId: c.consumerId,
    consumerType: c.consumerType,
    consumerLabel: c.consumerLabel,
    usageCount: c.usageCount,
    firstUsedAt: now,
    lastUsedAt: now,
  }));
  const relationships: KnowledgeRelationship[] = spec.relationships.map((r) => ({
    relationshipId: `rel_seed_${spec.id}_${r.target}`,
    type: r.type,
    sourceId: spec.id,
    sourceTitle: spec.title,
    targetId: r.target,
    targetTitle: undefined,
    weight: r.weight,
    actor: 'knowledge-platform',
    note: r.note,
    createdAt: now,
  }));
  return {
    knowledgeId: spec.id,
    title: spec.title,
    description: spec.description,
    source: spec.source,
    sourceType: spec.sourceType,
    owner: spec.owner,
    category: spec.category,
    tags: spec.tags,
    trust: trust(spec.trust, spec.trustFactors),
    confidence: trust(spec.confidence, spec.confidenceFactors),
    version: spec.version,
    // Every knowledge item's version history starts with its initial
    // registration snapshot — the registry invariant that `listVersions` and
    // `diff(from: 1, to: n)` always resolve for seeded items, not just
    // items that have already been revised once.
    versionHistory: [
      {
        versionId: `ver_seed_${spec.id}_1`,
        knowledgeId: spec.id,
        versionNumber: 1,
        title: spec.title,
        description: spec.description,
        tags: spec.tags,
        changeSummary: 'Initial registration',
        actor: 'knowledge-platform',
        createdAt: now,
      },
    ],
    consumers,
    dependencies: [],
    relationships,
    citations,
    usage: { totalReads: spec.reads, totalConsumers: consumers.length, lastAccessedAt: now },
    validationStatus: spec.validation,
    lifecycleStatus: spec.lifecycle,
    audit: [
      {
        auditId: `kaud_seed_${spec.id}_created`,
        action: 'created',
        actor: 'knowledge-platform',
        note: `Registered from ${spec.source}`,
        timestamp: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

/** Build the full seed registry (24 items, deterministic ids — idempotent upsert). */
export function createCatalogKnowledgeItems(): KnowledgeItem[] {
  return SPECS.map(item);
}

/** All relationship edges of the seed catalog (referencing only seed items). */
export function createCatalogKnowledgeRelationships(): KnowledgeRelationship[] {
  return createCatalogKnowledgeItems().flatMap((i) => i.relationships);
}

/** Convenience: the seed items keyed by id (tests + seed script). */
export function createCatalogKnowledgeItemMap(): Map<string, KnowledgeItem> {
  const map = new Map<string, KnowledgeItem>();
  for (const item of createCatalogKnowledgeItems()) map.set(item.knowledgeId, item);
  return map;
}

/** True when all 14 categories are present (catalog integrity check). */
export function hasAllKnowledgeCategories(items: readonly KnowledgeItem[]): boolean {
  const present = new Set(items.map((i) => i.category));
  return [
    'business',
    'technical',
    'user',
    'project',
    'ai',
    'sap',
    'client',
    'domain',
    'policy',
    'document',
    'api',
    'architecture',
    'learning',
    'execution',
  ].every((category) => present.has(category as KnowledgeItem['category']));
}
