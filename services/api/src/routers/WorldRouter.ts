// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: World Model & Business Operating System Router
// SPRINT-032 — world.* procedures.
//
//   world.overview                    — bounded composed snapshot (MY WORLD)
//   world.graph.entities / relations  — bounded + paginated graph queries
//   world.graph.observe / link        — evidence-backed observations (provenance
//                                       REQUIRED; never fabricated facts)
//   world.businessUnits.*             — configurable business units
//   world.opportunities.evaluate      — evidence-only economics (factor-exposed)
//   world.opportunities.pipeline      — ranked pipeline (advisory scores only)
//   world.workforce.roles.* / suggestWorkers — provider-neutral role abstraction
//   world.workflow.*                  — generic workflows + BOUNDED decomposition
//   world.signals.list                — honest external-source status
//                                       (UNAVAILABLE, never SUCCESS)
//   world.boundary.classify           — human vs AI responsibility boundary
//
// Every procedure is authenticated + rate-limited + owner-checked by the
// central middleware. The world model composes the frozen estate — it never
// approves, spends, executes or promotes to memory.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { WorldModelService } from '@vedmoulya/world-model';
import type { ExecutionRunService } from '@vedmoulya/execution-bridge';
import type { TRPCContext } from '../services/RouterRegistry.js';
import type { ApiResponse } from '../services/ResponseMapper.js';
import { successResponse } from '../services/ResponseMapper.js';
import { fromServiceResult } from '../services/ResponseMapper.js';

const userIdInput = z.object({ userId: z.string().min(1) });

const entityTypeEnum = z.enum([
  'user',
  'goal',
  'project',
  'skill',
  'work',
  'preference',
  'permission',
  'task',
  'workflow',
  'outcome',
  'opportunity',
  'business_unit',
  'problem',
  'service',
  'customer',
  'revenue',
  'cost',
  'risk',
  'capability',
  'provider',
  'model',
  'role',
  'worker',
  'signal',
]);

const relationTypeEnum = z.enum([
  'has_goal',
  'has_project',
  'has_skill',
  'has_work',
  'has_preference',
  'has_permission',
  'belongs_to',
  'contains_task',
  'has_workflow',
  'has_outcome',
  'has_opportunity',
  'has_problem',
  'has_service',
  'has_customer',
  'generates_revenue',
  'incurs_cost',
  'has_risk',
  'requires_capability',
  'served_by_provider',
  'uses_model',
  'fulfills_role',
  'assigned_role',
  'decomposes_into',
  'evidence_of',
  'linked_to',
]);

const observationStatusEnum = z.enum(['VERIFIED', 'ESTIMATED', 'UNKNOWN']);
const observationSourceEnum = z.enum([
  'brain-task',
  'brain-opportunity',
  'brain-outcome',
  'capability-marketplace',
  'provider-registry',
  'proactive-assessment',
  'control-lifecycle',
  'fabric',
  'cost-ledger',
  'user-statement',
  'workflow',
  'signal',
]);

const factorSchema = z.object({
  key: z.enum([
    'marketEvidence',
    'customerPain',
    'demandSignal',
    'competition',
    'implementationEffort',
    'initialCost',
    'operatingCost',
    'potentialRevenue',
    'timeToFirstRevenue',
    'risk',
    'automationPotential',
    'userFit',
    'aiLeverage',
    'providerCost',
    'scalability',
    'defensibility',
    // SPRINT-033 (Part B) — founder/margin factors.
    'expectedMargin',
    'founderInvolvement',
  ]),
  value: z.number().min(0).max(1).optional(),
  status: observationStatusEnum,
  evidence: z.array(z.string()).max(4).default([]),
});

/** Evidence-carrying revenue figure (SPRINT-033 Part F) — a figure without
 *  evidence is refused at the domain boundary. */
const revenueFigureSchema = z.object({
  value: z.number().min(0).max(100000000),
  status: z.enum(['VERIFIED', 'ESTIMATED']),
  evidence: z.array(z.string().min(1)).min(1).max(4),
});

/** SPRINT-033 Part B — closed opportunity-category vocabulary (advisory;
 *  normalized, never invented). */
const opportunityCategoryEnum = z.enum([
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
]);

export const worldInputs = {
  overview: userIdInput,
  entities: z.object({
    userId: z.string().min(1),
    type: entityTypeEnum.optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  relations: z.object({
    userId: z.string().min(1),
    type: relationTypeEnum.optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  observe: z.object({
    userId: z.string().min(1),
    type: entityTypeEnum,
    label: z.string().min(1).max(160),
    externalId: z.string().max(160).optional(),
    properties: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
    evidence: z.array(z.string().min(1)).min(1).max(5),
    provenance: z.object({
      source: observationSourceEnum,
      status: observationStatusEnum,
      observedAt: z.string().min(1),
    }),
  }),
  link: z.object({
    userId: z.string().min(1),
    type: relationTypeEnum,
    fromId: z.string().min(1),
    toId: z.string().min(1),
    note: z.string().max(240).optional(),
  }),
  businessUnitsList: userIdInput,
  businessUnitCreate: z.object({
    userId: z.string().min(1),
    name: z.string().min(1).max(80),
    purpose: z.string().min(1).max(500),
    targetCustomer: z.string().max(200).optional(),
    offerings: z.array(z.string()).max(25).optional(),
    automationLevel: z.number().int().min(0).max(5).optional(),
    aiCapabilities: z.array(z.string()).max(30).optional(),
    humanResponsibilities: z.array(z.string()).max(30).optional(),
    approvalRequirements: z.array(z.string()).max(20).optional(),
  }),
  businessUnitUpdate: z.object({
    userId: z.string().min(1),
    id: z.string().min(1),
    name: z.string().min(1).max(80).optional(),
    purpose: z.string().min(1).max(500).optional(),
    targetCustomer: z.string().max(200).optional(),
    offerings: z.array(z.string()).max(25).optional(),
    automationLevel: z.number().int().min(0).max(5).optional(),
    aiCapabilities: z.array(z.string()).max(30).optional(),
    humanResponsibilities: z.array(z.string()).max(30).optional(),
    approvalRequirements: z.array(z.string()).max(20).optional(),
    status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  }),
  businessUnitRemove: z.object({ userId: z.string().min(1), id: z.string().min(1) }),
  evaluateOpportunity: z.object({
    userId: z.string().min(1),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    requiredCapabilities: z.array(z.string()).max(30).default([]),
    /** SPRINT-033 Part B — optional category from the closed vocabulary. */
    category: opportunityCategoryEnum.optional(),
    factors: z.array(factorSchema).max(18).default([]),
    initialCostInr: z
      .object({ value: z.number().min(0).max(100000000), status: observationStatusEnum })
      .optional(),
    capitalBudgetInr: z.number().int().min(0).max(1000000).optional(),
  }),
  pipeline: z.object({
    userId: z.string().min(1),
    budgetInr: z.number().int().min(0).max(1000000).optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  rolesList: userIdInput,
  roleRegister: z.object({
    userId: z.string().min(1),
    name: z.string().min(1).max(80),
    responsibilities: z.array(z.string().min(1)).min(1).max(20),
    capabilities: z.array(z.string().min(1)).min(1).max(30),
    providerStrategies: z
      .array(z.enum(['FREE', 'LOCAL', 'OPEN_SOURCE', 'LOW_COST', 'PREMIUM', 'PRIVATE']))
      .max(8)
      .optional(),
    privacyRequirement: z.enum(['PRIVATE', 'STANDARD']).optional(),
    authorityClass: z.enum(['A', 'B', 'C', 'D']).optional(),
  }),
  suggestWorkers: z.object({
    userId: z.string().min(1),
    roleId: z.string().min(1),
    strategy: z.enum(['CHEAP', 'FAST', 'QUALITY', 'PRIVATE', 'BALANCED']).optional(),
  }),
  workflowCreate: z.object({
    userId: z.string().min(1),
    name: z.string().min(1).max(80),
    description: z.string().max(500).default(''),
    businessUnitId: z.string().max(120).optional(),
    trigger: z.string().min(1).max(200),
    inputs: z.array(z.string()).max(12).default([]),
    steps: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1).max(160),
          capability: z.string().max(80).optional(),
          roleName: z.string().max(120).optional(),
          providerStrategy: z
            .enum(['FREE', 'LOCAL', 'OPEN_SOURCE', 'LOW_COST', 'PREMIUM', 'PRIVATE'])
            .optional(),
          approvalGate: z.string().max(200).optional(),
          verificationRequirement: z.string().max(200).optional(),
          dependsOn: z.array(z.string()).max(12).default([]),
        }),
      )
      .min(1)
      .max(24),
    outputs: z.array(z.string()).max(12).default([]),
    expectedOutcome: z.string().max(300).optional(),
  }),
  workflowsList: userIdInput,
  decomposeWorkflow: z.object({
    userId: z.string().min(1),
    goal: z.string().min(1).max(300),
    steps: z
      .array(
        z.object({
          label: z.string().min(1).max(160),
          capability: z.string().max(80).optional(),
          roleName: z.string().max(120).optional(),
        }),
      )
      .min(1)
      .max(24),
    estimatedCostUsd: z.number().min(0).optional(),
    estimatedTimeMs: z.number().int().min(0).optional(),
  }),
  // ── SPRINT-036 — multi-provider orchestration plan (representation only) ──
  orchestratePlan: z.object({
    userId: z.string().min(1),
    goal: z.string().min(1).max(300),
    strategy: z.enum(['CHEAP', 'FAST', 'QUALITY', 'PRIVATE', 'BALANCED']),
    steps: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          label: z.string().min(1).max(160),
          capability: z.string().max(80).optional(),
          roleName: z.string().max(120).optional(),
          privacyClass: z.enum(['PUBLIC', 'INTERNAL', 'SENSITIVE', 'PRIVATE']).optional(),
          verificationRequirement: z.string().max(300).optional(),
        }),
      )
      .min(1)
      .max(24),
    estimatedCostUsd: z.number().min(0).optional(),
    estimatedTimeMs: z.number().int().min(0).optional(),
    maxRetries: z.number().int().min(0).max(3).optional(),
  }),
  orchestrationPlansList: userIdInput,
  // ── SPRINT-037 — approval-gated execution (Brain + EXISTING bridge) ──────
  approveOrchestrationPlan: z.object({
    userId: z.string().min(1),
    planId: z.string().min(1).max(120),
    decision: z.enum(['APPROVED', 'REJECTED']),
    note: z.string().max(400).optional(),
  }),
  startOrchestrationPlan: z.object({
    userId: z.string().min(1),
    planId: z.string().min(1).max(120),
  }),
  signals: userIdInput,
  classifyBoundary: z.object({
    userId: z.string().min(1),
    action: z.string().min(1).max(300),
  }),
  // ── SPRINT-033 Part F — revenue intelligence ────────────────────────────
  revenueRegister: z.object({
    userId: z.string().min(1),
    name: z.string().min(1).max(120),
    kind: z.enum([
      'SERVICE',
      'PRODUCT',
      'SUBSCRIPTION',
      'PROJECT',
      'AFFILIATE',
      'ADVERTISING',
      'LICENSING',
      'OTHER',
    ]),
    status: z.enum(['ACTIVE', 'PLANNED', 'PAUSED', 'ARCHIVED']).optional(),
    businessUnitId: z.string().max(120).optional(),
    estimatedMonthlyRevenueUsd: revenueFigureSchema.optional(),
    actualMonthlyRevenueUsd: revenueFigureSchema.optional(),
    estimatedMonthlyCostUsd: revenueFigureSchema.optional(),
    actualMonthlyCostUsd: revenueFigureSchema.optional(),
    automationPercentage: revenueFigureSchema.optional(),
    humanEffortHoursMonthly: revenueFigureSchema.optional(),
    customerCount: revenueFigureSchema.optional(),
    conversionRate: revenueFigureSchema.optional(),
    retentionRate: revenueFigureSchema.optional(),
    note: z.string().max(400).optional(),
  }),
  revenueList: userIdInput,
  revenueRemove: z.object({ userId: z.string().min(1), id: z.string().min(1) }),
  revenueSnapshot: userIdInput,
  revenueDecisions: userIdInput,
  // ── SPRINT-033 Part A — founder briefing ────────────────────────────────
  founderBriefing: userIdInput,
  // ── SPRINT-033 Part E — workflow execution blueprint ────────────────────
  buildBlueprint: z.object({
    userId: z.string().min(1),
    sourceTitle: z.string().min(1).max(200),
    sourceGoal: z.string().min(1).max(300),
    businessUnitId: z.string().max(120).optional(),
    steps: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1).max(160),
          capability: z.string().max(80).optional(),
          roleName: z.string().max(120).optional(),
          verificationRequirement: z.string().max(200).optional(),
          dependsOn: z.array(z.string()).max(12).default([]),
        }),
      )
      .min(1)
      .max(24),
    estimatedCostUsd: revenueFigureSchema.optional(),
  }),
  // ── SPRINT-034 — outcome evidence & revenue → outcome feedback ──────────
  outcomeEvidenceRecord: z.object({
    userId: z.string().min(1),
    kind: z.enum([
      'REVENUE',
      'COST',
      'MARGIN',
      'EFFORT',
      'TIME',
      'QUALITY',
      'CUSTOMER_RESPONSE',
      'EXECUTION_RELIABILITY',
    ]),
    opportunityId: z.string().max(160).optional(),
    workflowId: z.string().max(160).optional(),
    businessUnitId: z.string().max(160).optional(),
    category: z.string().max(120).optional(),
    expected: z
      .object({
        value: z.number().min(0).max(100000000),
        status: z.literal('ESTIMATED'),
        evidence: z.array(z.string().min(1)).min(1).max(4),
      })
      .optional(),
    actual: z
      .object({
        value: z.number().min(0).max(100000000),
        status: z.literal('VERIFIED'),
        evidence: z.array(z.string().min(1)).min(1).max(4),
      })
      .optional(),
    verificationStatus: z.enum(['VERIFIED', 'UNVERIFIED', 'FAILED', 'UNKNOWN']),
    evidence: z.array(z.string().min(1)).min(1).max(8),
    source: z.string().max(200).optional(),
  }),
  outcomeEvidenceList: userIdInput,
  outcomeFeedbackApply: z.object({ userId: z.string().min(1), evidenceId: z.string().min(1) }),
  // ── SPRINT-034 — blueprint → approval-gated execution ───────────────────
  blueprintApprovalRequest: z.object({
    userId: z.string().min(1),
    blueprint: z.object({
      id: z.string().min(1).max(160),
      ownerId: z.string().min(1),
      sourceTitle: z.string().min(1).max(200),
      sourceGoal: z.string().min(1).max(300),
      businessUnitId: z.string().max(120).optional(),
      steps: z
        .array(
          z.object({
            id: z.string().min(1),
            label: z.string().min(1).max(160),
            capability: z.string().max(80).optional(),
            roleName: z.string().max(120).optional(),
            actionClass: z.enum(['A', 'B', 'C', 'D']),
            approvalGateRequired: z.boolean(),
            approvalReason: z.string().max(300).optional(),
            verificationRequirement: z.string().max(200).optional(),
            dependsOn: z.array(z.string()).max(12).default([]),
          }),
        )
        .min(1)
        .max(24),
      approvalGates: z
        .array(
          z.object({
            stepId: z.string().min(1),
            label: z.string().min(1),
            actionClass: z.enum(['A', 'B', 'C', 'D']),
          }),
        )
        .optional(),
      bounds: z.object({
        allowed: z.boolean(),
        reason: z.string(),
        exceeded: z.string().optional(),
      }),
      executed: z.literal(false),
      authorizationRequired: z.literal(true),
      createdAt: z.string().min(1),
    }),
    stepId: z.string().min(1),
    workflowId: z.string().max(160).optional(),
    providerId: z.string().max(160).optional(),
    estimatedCostUsd: revenueFigureSchema.optional(),
    dataScope: z.string().max(300).optional(),
    expectedOutcome: z.string().max(300).optional(),
  }),
  blueprintApprovalsList: userIdInput,
  blueprintApprovalDecide: z.object({
    userId: z.string().min(1),
    requestId: z.string().min(1),
    decision: z.enum(['APPROVED', 'REJECTED']),
    note: z.string().max(400).optional(),
  }),
  // ── SPRINT-034 — cost-weighted revenue intelligence ─────────────────────
  revenueRanking: userIdInput,
  // ── SPRINT-034 — Founder Command Center (presentation-only read model) ──
  commandCenter: userIdInput,
  // ── SPRINT-035 — bounded timeline + honest signal health ────────────────
  timeline: z.object({
    userId: z.string().min(1),
    limit: z.number().int().min(1).max(50).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  signalHealth: userIdInput,
  // ── SPRINT-038 — opportunity discovery & revenue validation ─────────────
  // Practical business problems (evidence/provenance-REQUIRED — never
  // fabricated customers/revenue), three advisory scores + LEVEL, a bounded
  // lifecycle, zero/low-cost experiment planning, customer discovery,
  // VERIFIED-payment-only revenue validation, STOP recommendations, provider
  // economics over the EXISTING fabric and the Opportunity Radar. Nothing
  // here approves/spends/executes.
  problemRegister: z.object({
    userId: z.string().min(1),
    problemStatement: z.string().min(1).max(500),
    customerOrBusiness: z.string().max(160).optional(),
    industry: z.string().max(80).optional(),
    workflow: z.string().max(160).optional(),
    affectedRole: z.string().max(120).optional(),
    pain: z.string().max(300).optional(),
    frequency: z.string().max(200).optional(),
    humanEffort: z.string().max(200).optional(),
    estimatedCurrentCost: revenueFigureSchema.optional(),
    revenueImpact: revenueFigureSchema.optional(),
    errorImpact: z.string().max(300).optional(),
    urgency: z.string().max(300).optional(),
    currentSolution: z.string().max(300).optional(),
    competitorAlternatives: z.array(z.string()).max(12).optional(),
    aiSuitability: z.string().max(300).optional(),
    automationPotential: revenueFigureSchema.optional(),
    buyer: z.string().max(160).optional(),
    implementationComplexity: z.string().max(300).optional(),
    estimatedAiCost: revenueFigureSchema.optional(),
    evidence: z
      .array(
        z.object({
          source: z.enum([
            'customer_interview',
            'customer_data',
            'direct_observation',
            'public_company_info',
            'public_reviews',
            'job_postings',
            'marketplace_demand',
            'public_pricing',
            'industry_reports',
            'startup_databases',
            'government_data',
            'vedmoulya_observation',
            'experiment_result',
            'verified_payment',
          ]),
          observedAt: z.string().optional(),
          reference: z.string().max(240).optional(),
          text: z.string().min(1).max(500),
          confidence: observationStatusEnum,
        }),
      )
      .min(1)
      .max(12),
  }),
  problemList: userIdInput,
  problemGet: z.object({ userId: z.string().min(1), problemId: z.string().min(1).max(120) }),
  problemAddEvidence: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1).max(120),
    source: z.enum([
      'customer_interview',
      'customer_data',
      'direct_observation',
      'public_company_info',
      'public_reviews',
      'job_postings',
      'marketplace_demand',
      'public_pricing',
      'industry_reports',
      'startup_databases',
      'government_data',
      'vedmoulya_observation',
      'experiment_result',
      'verified_payment',
    ]),
    observedAt: z.string().optional(),
    reference: z.string().max(240).optional(),
    text: z.string().min(1).max(500),
    confidence: observationStatusEnum,
  }),
  problemRecordCustomerSignal: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1).max(120),
    signal: z.enum(['INTEREST', 'PROBLEM_CONFIRMED', 'EXPERIMENT_SUCCESS', 'WILLINGNESS_TO_PAY']),
    text: z.string().min(1).max(500),
    reference: z.string().max(240).optional(),
    confidence: observationStatusEnum.optional(),
  }),
  problemRecordVerifiedPayment: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1).max(120),
    text: z.string().min(1).max(500),
    reference: z.string().max(240).optional(),
  }),
  problemAssess: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1).max(120),
    problemFactors: z.array(factorSchema).max(20).optional(),
    opportunityFactors: z.array(factorSchema).max(20).optional(),
    experimentFactors: z.array(factorSchema).max(20).optional(),
  }),
  problemAdvance: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1).max(120),
    to: z.enum([
      'OBSERVED',
      'PROBLEM',
      'VALIDATED_PROBLEM',
      'ECONOMIC_OPPORTUNITY',
      'AI_FEASIBLE',
      'EXPERIMENT_CANDIDATE',
      'EXPERIMENT_APPROVAL_REQUIRED',
      'EXPERIMENT_RUNNING',
      'EXPERIMENT_COMPLETED',
      'PAYMENT_EVIDENCE',
      'BUSINESS_CANDIDATE',
      'BUILD_RECOMMENDED',
      'REJECTED',
      'DISMISSED',
      'NEEDS_REVIEW',
    ]),
  }),
  problemPlanExperiment: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1).max(120),
    hypothesis: z.string().min(1).max(300),
    targetCustomer: z.string().min(1).max(160),
    problemUnderTest: z.string().min(1).max(300),
    objective: z.string().min(1).max(300),
    minimumRequiredData: z.array(z.string()).max(12).default([]),
    actions: z.array(z.string()).max(12).default([]),
    estimatedAiCost: revenueFigureSchema.optional(),
    humanEffort: revenueFigureSchema.optional(),
    duration: revenueFigureSchema.optional(),
    successCriteria: z.array(z.string()).max(8).default([]),
    failureCriteria: z.array(z.string()).max(8).default([]),
    stopConditions: z.array(z.string()).max(8).default([]),
    measurementMethod: z.string().min(1).max(300),
    expectedInformationGain: revenueFigureSchema.optional(),
    maxBudget: revenueFigureSchema.optional(),
    capitalBudgetInr: z.number().int().min(0).max(1000000).optional(),
  }),
  problemCustomerDiscovery: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1).max(120),
    customerProfile: z.string().max(300).optional(),
  }),
  problemProviderEconomics: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1).max(120),
    requiredCapabilities: z.array(z.string().min(1)).min(1).max(12),
    qualityRequirement: z
      .array(z.object({ capability: z.string().min(1), quality: z.number().min(0).max(1) }))
      .max(12)
      .optional(),
    privacy: z.enum(['PUBLIC', 'INTERNAL', 'SENSITIVE', 'PRIVATE']).optional(),
    strategy: z.enum(['CHEAP', 'FAST', 'QUALITY', 'PRIVATE', 'BALANCED']).optional(),
  }),
  problemBusinessCandidate: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1).max(120),
    serviceDefinition: z.string().min(1).max(400),
    targetCustomer: z.string().min(1).max(160),
    pricingHypothesis: revenueFigureSchema.optional(),
    deliveryWorkflow: z.array(z.string()).max(12).default([]),
    providerStrategy: z.string().min(1).max(200),
    aiCost: revenueFigureSchema.optional(),
    humanCost: revenueFigureSchema.optional(),
    marginHypothesis: revenueFigureSchema.optional(),
    customerAcquisitionHypothesis: z.string().max(300).optional(),
    mvpScope: z.array(z.string()).max(12).default([]),
    automationPotential: revenueFigureSchema.optional(),
    risks: z.array(z.string()).max(12).default([]),
    nextExperiment: z.string().max(300).optional(),
  }),
  opportunityRadar: z.object({
    userId: z.string().min(1),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  // ── SPRINT-039 — founder evidence loop ────────────────────────────────────
  observationRecord: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1).optional(),
    sourceType: z.string().min(1).max(40),
    sourceReference: z.string().min(1).max(200),
    observedStatement: z.string().min(1).max(1000),
    context: z.string().max(400).optional(),
    affectedCustomerSegment: z.string().max(200).optional(),
    frequency: z.string().max(200).optional(),
    severity: z.string().max(200).optional(),
    currentWorkaround: z.string().max(400).optional(),
    statedWillingnessToPay: revenueFigureSchema.optional(),
    statedBudget: revenueFigureSchema.optional(),
    objection: z.string().max(400).optional(),
    nextAction: z.string().max(400).optional(),
    claimedState: z.string().max(40).optional(),
    provenance: z.object({
      source: z.string().min(1).max(200),
      reference: z.string().max(300).optional(),
      observedAt: z.string().min(1).max(100),
    }),
  }),
  observationsList: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1).optional(),
  }),
  prospectRegister: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1),
    prospectReference: z.string().min(1).max(200),
    customerSegment: z.string().min(1).max(200),
    problemDiscussed: z.string().min(1).max(1000),
    currentSolution: z.string().max(400).optional(),
    painSeverity: z.string().max(200).optional(),
    frequency: z.string().max(200).optional(),
    existingSpending: revenueFigureSchema.optional(),
    budgetIndication: revenueFigureSchema.optional(),
    willingnessToPayIndication: revenueFigureSchema.optional(),
    objection: z.string().max(400).optional(),
    desiredOutcome: z.string().max(400).optional(),
    nextStep: z.string().max(400).optional(),
    discoveryStatus: z.string().max(40).optional(),
    evidence: z
      .array(
        z.object({
          source: z.string().min(1).max(200),
          observedAt: z.string().max(100).optional(),
          reference: z.string().max(300).optional(),
          text: z.string().min(1).max(1000),
          confidence: z.enum(['VERIFIED', 'ESTIMATED', 'UNKNOWN']),
        }),
      )
      .max(20)
      .optional(),
    provenance: z.object({
      source: z.string().min(1).max(200),
      reference: z.string().max(300).optional(),
      observedAt: z.string().min(1).max(100),
    }),
  }),
  prospectAdvance: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1),
    prospectReference: z.string().min(1).max(200),
    to: z.string().min(1).max(40),
    verifiedPaymentText: z.string().max(1000).optional(),
  }),
  prospectsList: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1).optional(),
  }),
  evidenceQualityView: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1),
  }),
  factorCalibrate: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1),
    factorKey: z.string().min(1).max(80),
    direction: z.union([z.literal(1), z.literal(-1)]),
    reason: z.string().min(1).max(400),
  }),
  nextBestActionView: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1),
  }),
  opportunityCompare: z.object({
    userId: z.string().min(1),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  opportunityDrilldownView: z.object({
    userId: z.string().min(1),
    problemId: z.string().min(1),
  }),
};

export interface WorldHandlers {
  overview: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  entities: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  relations: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  observe: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  link: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  businessUnitsList: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  businessUnitCreate: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  businessUnitUpdate: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  businessUnitRemove: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  evaluateOpportunity: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  pipeline: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  rolesList: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  roleRegister: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  suggestWorkers: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  workflowCreate: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  workflowsList: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  decomposeWorkflow: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  // SPRINT-036 — multi-provider orchestration plan
  orchestratePlan: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  orchestrationPlansList: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  // SPRINT-037 — approval-gated execution of an orchestration plan through
  // the EXISTING Brain approval authority + the EXISTING execution bridge.
  approveOrchestrationPlan: (
    input: Record<string, unknown>,
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  startOrchestrationPlan: (
    input: Record<string, unknown>,
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  signals: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  classifyBoundary: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  // SPRINT-033 Part F — revenue intelligence
  revenueRegister: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  revenueList: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  revenueRemove: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  revenueSnapshot: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  revenueDecisions: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  // SPRINT-033 Part A — founder briefing
  founderBriefing: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  // SPRINT-033 Part E — workflow execution blueprint
  buildBlueprint: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  // SPRINT-034 — outcome evidence & revenue → outcome feedback
  outcomeEvidenceRecord: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  outcomeEvidenceList: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  outcomeFeedbackApply: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  // SPRINT-034 — blueprint → approval-gated execution
  blueprintApprovalRequest: (
    input: Record<string, unknown>,
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  blueprintApprovalsList: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  blueprintApprovalDecide: (
    input: Record<string, unknown>,
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // SPRINT-034 — cost-weighted revenue intelligence
  revenueRanking: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  // SPRINT-034 — Founder Command Center
  commandCenter: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  // SPRINT-035 — bounded timeline + honest signal health
  timeline: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  signalHealth: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  // SPRINT-038 — opportunity discovery & revenue validation
  problemRegister: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  problemList: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  problemGet: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  problemAddEvidence: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  problemRecordCustomerSignal: (
    input: Record<string, unknown>,
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  problemRecordVerifiedPayment: (
    input: Record<string, unknown>,
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  problemAssess: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  problemAdvance: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  problemPlanExperiment: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  problemCustomerDiscovery: (
    input: Record<string, unknown>,
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  problemProviderEconomics: (
    input: Record<string, unknown>,
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  problemBusinessCandidate: (
    input: Record<string, unknown>,
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  opportunityRadar: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  // SPRINT-039 — founder evidence loop
  observationRecord: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  observationsList: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  prospectRegister: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  prospectAdvance: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  prospectsList: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  evidenceQualityView: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  factorCalibrate: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  nextBestActionView: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  opportunityCompare: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  opportunityDrilldownView: (
    input: Record<string, unknown>,
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
}

/** Map a world-model result to the standard envelope (same discipline as the
 *  proactive/voice/control routers — the honest code is preserved in
 *  error.details.worldCode). */
function fromWorldResult<T>(
  result: { success: true; data: T } | { success: false; error: string; code?: string },
  statusCode: number,
): ApiResponse<T> {
  if (result.success) return successResponse(result.data);
  return {
    success: false,
    error: {
      code: result.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'INTERNAL_ERROR',
      message: result.error || 'World model error',
      statusCode,
      details: { worldCode: result.code ?? 'WORLD_ERROR' },
    },
    meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
  };
}

export function createWorldRouter(
  world: WorldModelService,
  executionRun?: ExecutionRunService,
): WorldHandlers {
  return {
    overview: async (input): Promise<ApiResponse> =>
      Promise.resolve(successResponse(await world.overview(input.userId))),

    entities: async (input): Promise<ApiResponse> =>
      Promise.resolve(
        fromWorldResult(
          world.listEntities(input.userId as string, {
            type: input.type as never,
            limit: input.limit as number | undefined,
            offset: input.offset as number | undefined,
          }),
          400,
        ),
      ),

    relations: async (input): Promise<ApiResponse> =>
      Promise.resolve(
        fromWorldResult(
          world.listRelations(input.userId as string, {
            type: input.type as never,
            limit: input.limit as number | undefined,
            offset: input.offset as number | undefined,
          }),
          400,
        ),
      ),

    observe: async (input): Promise<ApiResponse> => {
      const result = world.observe({
        ownerId: input.userId as string,
        type: input.type as never,
        label: input.label as string,
        externalId: input.externalId as string | undefined,
        properties: input.properties as Record<string, string | number | boolean> | undefined,
        evidence: input.evidence as string[],
        provenance: input.provenance as {
          source: never;
          status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN';
          observedAt: string;
        },
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    link: async (input): Promise<ApiResponse> => {
      const result = world.link({
        ownerId: input.userId as string,
        type: input.type as never,
        fromId: input.fromId as string,
        toId: input.toId as string,
        note: input.note as string | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    businessUnitsList: async (input): Promise<ApiResponse> =>
      Promise.resolve(fromWorldResult(world.listBusinessUnits(input.userId), 400)),

    businessUnitCreate: async (input): Promise<ApiResponse> => {
      const result = world.createBusinessUnit({
        ownerId: input.userId as string,
        name: input.name as string,
        purpose: input.purpose as string,
        targetCustomer: input.targetCustomer as string | undefined,
        offerings: input.offerings as string[] | undefined,
        automationLevel: input.automationLevel as number | undefined,
        aiCapabilities: input.aiCapabilities as string[] | undefined,
        humanResponsibilities: input.humanResponsibilities as string[] | undefined,
        approvalRequirements: input.approvalRequirements as string[] | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    businessUnitUpdate: async (input): Promise<ApiResponse> => {
      const result = world.updateBusinessUnit({
        ownerId: input.userId as string,
        id: input.id as string,
        name: input.name as string | undefined,
        purpose: input.purpose as string | undefined,
        targetCustomer: input.targetCustomer as string | undefined,
        offerings: input.offerings as string[] | undefined,
        automationLevel: input.automationLevel as number | undefined,
        aiCapabilities: input.aiCapabilities as string[] | undefined,
        humanResponsibilities: input.humanResponsibilities as string[] | undefined,
        approvalRequirements: input.approvalRequirements as string[] | undefined,
        status: input.status as 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    businessUnitRemove: async (input): Promise<ApiResponse> => {
      const result = world.removeBusinessUnit(input.userId as string, input.id as string);
      return Promise.resolve(fromWorldResult(result, 400));
    },

    evaluateOpportunity: async (input): Promise<ApiResponse> => {
      const result = world.evaluateOpportunity({
        ownerId: input.userId as string,
        title: input.title as string,
        description: input.description as string,
        requiredCapabilities: input.requiredCapabilities as string[],
        // SPRINT-033 Part B — closed category vocabulary (optional).
        category: input.category as string | undefined,
        factors: input.factors as never[],
        initialCostInr: input.initialCostInr as
          { value?: number; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' } | undefined,
        capitalBudgetInr: input.capitalBudgetInr as number | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    pipeline: async (input): Promise<ApiResponse> =>
      Promise.resolve(
        fromWorldResult(
          world.opportunityPipeline(input.userId as string, {
            budgetInr: input.budgetInr as number | undefined,
            limit: input.limit as number | undefined,
          }),
          400,
        ),
      ),

    rolesList: async (input): Promise<ApiResponse> =>
      Promise.resolve(fromWorldResult(world.listRoles(input.userId), 400)),

    roleRegister: async (input): Promise<ApiResponse> => {
      const result = world.registerRole({
        ownerId: input.userId as string,
        name: input.name as string,
        responsibilities: input.responsibilities as string[],
        capabilities: input.capabilities as string[],
        providerStrategies: input.providerStrategies as RoleProviderStrategy[] | undefined,
        privacyRequirement: input.privacyRequirement as 'PRIVATE' | 'STANDARD' | undefined,
        authorityClass: input.authorityClass as 'A' | 'B' | 'C' | 'D' | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    suggestWorkers: async (input): Promise<ApiResponse> => {
      const result = await world.suggestWorkers(
        input.userId as string,
        input.roleId as string,
        input.strategy as 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED' | undefined,
      );
      return Promise.resolve(fromWorldResult(result, 500));
    },

    workflowCreate: async (input): Promise<ApiResponse> => {
      const result = world.createWorkflow({
        ownerId: input.userId as string,
        name: input.name as string,
        description: input.description as string,
        businessUnitId: input.businessUnitId as string | undefined,
        trigger: input.trigger as string,
        inputs: input.inputs as string[],
        steps: input.steps as never[],
        outputs: input.outputs as string[],
        expectedOutcome: input.expectedOutcome as string | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    workflowsList: async (input): Promise<ApiResponse> =>
      Promise.resolve(fromWorldResult(world.listWorkflows(input.userId), 400)),

    decomposeWorkflow: async (input): Promise<ApiResponse> => {
      const result = world.decomposeWorkflow({
        ownerId: input.userId as string,
        goal: input.goal as string,
        steps: input.steps as never[],
        estimatedCostUsd: input.estimatedCostUsd as number | undefined,
        estimatedTimeMs: input.estimatedTimeMs as number | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    // ── SPRINT-036 — multi-provider orchestration plan (representation only) ──
    // Advisory per-step provider binding through the EXISTING fabric; the plan
    // NEVER executes — `executed:false` is structural. Bounded + owner-scoped.
    orchestratePlan: async (input): Promise<ApiResponse> => {
      const result = await world.orchestratePlan({
        ownerId: input.userId as string,
        goal: input.goal as string,
        strategy: input.strategy as 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED',
        steps: input.steps as never[],
        estimatedCostUsd: input.estimatedCostUsd as number | undefined,
        estimatedTimeMs: input.estimatedTimeMs as number | undefined,
        maxRetries: input.maxRetries as number | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    orchestrationPlansList: async (input): Promise<ApiResponse> =>
      Promise.resolve(fromWorldResult(world.listOrchestrationPlans(input.userId), 400)),

    // ── SPRINT-037 — approval-gated execution through the EXISTING bridge ──
    // The founder approves the orchestration plan through the EXISTING Brain
    // authority (world.approveOrchestrationPlan → WorldApprovalPort → Brain).
    // The plan NEVER executes on its own — `executed:false` is structural. An
    // approved plan is submitted to the EXISTING ExecutionRunService, which
    // resolves it through the orchestration-aware plan source (SPRINT-037).
    // There is exactly ONE runtime path; this procedure only decides + starts.
    approveOrchestrationPlan: async (input): Promise<ApiResponse> => {
      const result = world.approveOrchestrationPlan({
        ownerId: input.userId as string,
        planId: input.planId as string,
        decision: input.decision as 'APPROVED' | 'REJECTED',
        note: input.note as string | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    startOrchestrationPlan: async (input): Promise<ApiResponse> => {
      // Belt-and-braces BEFORE the bridge: the plan must exist, be APPROVED
      // through the existing authority, and be adaptable. The plan source
      // re-checks these structurally — this is the honest user-facing error.
      const found = world.getOrchestrationPlan(input.userId as string, input.planId as string);
      if (!found.success) {
        return Promise.resolve(fromWorldResult(found, 400));
      }
      if (found.data.status !== 'APPROVED') {
        return Promise.resolve(
          fromWorldResult(
            {
              success: false as const,
              error:
                'This orchestration plan is not approved — it must be approved through the existing approval authority before it can be executed.',
              code: 'PLAN_NOT_APPROVED',
            },
            400,
          ),
        );
      }
      if (!executionRun) {
        return Promise.resolve(
          fromWorldResult(
            {
              success: false as const,
              error: 'The execution bridge is not available in this environment.',
              code: 'EXECUTION_UNAVAILABLE',
            },
            500,
          ),
        );
      }
      // The ONLY runtime path: the existing ExecutionRunService. It resolves
      // this plan through the orchestration-aware plan source and executes
      // EXECUTABLE steps through the existing step execution port.
      const run = await executionRun.start(input.userId as string, input.planId as string);
      return Promise.resolve(fromServiceResult(run));
    },

    signals: async (input): Promise<ApiResponse> => {
      const result = await world.listSignals(input.userId);
      return Promise.resolve(fromWorldResult(result, 500));
    },

    classifyBoundary: async (input): Promise<ApiResponse> =>
      Promise.resolve(successResponse(world.classifyBoundary(input.action as string))),

    // ── SPRINT-033 Part F — revenue intelligence ─────────────────────────
    revenueRegister: async (input): Promise<ApiResponse> => {
      const result = world.registerRevenueStream({
        ownerId: input.userId as string,
        name: input.name as string,
        kind: input.kind as never,
        status: input.status as 'ACTIVE' | 'PLANNED' | 'PAUSED' | 'ARCHIVED' | undefined,
        businessUnitId: input.businessUnitId as string | undefined,
        estimatedMonthlyRevenueUsd: input.estimatedMonthlyRevenueUsd as never,
        actualMonthlyRevenueUsd: input.actualMonthlyRevenueUsd as never,
        estimatedMonthlyCostUsd: input.estimatedMonthlyCostUsd as never,
        actualMonthlyCostUsd: input.actualMonthlyCostUsd as never,
        automationPercentage: input.automationPercentage as never,
        humanEffortHoursMonthly: input.humanEffortHoursMonthly as never,
        customerCount: input.customerCount as never,
        conversionRate: input.conversionRate as never,
        retentionRate: input.retentionRate as never,
        note: input.note as string | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    revenueList: async (input): Promise<ApiResponse> =>
      Promise.resolve(fromWorldResult(world.listRevenueStreams(input.userId), 400)),

    revenueRemove: async (input): Promise<ApiResponse> => {
      const result = world.removeRevenueStream(input.userId as string, input.id as string);
      return Promise.resolve(fromWorldResult(result, 400));
    },

    revenueSnapshot: async (input): Promise<ApiResponse> =>
      Promise.resolve(successResponse(world.revenueSnapshot(input.userId))),

    revenueDecisions: async (input): Promise<ApiResponse> =>
      Promise.resolve(successResponse(world.revenueDecisions(input.userId))),

    // ── SPRINT-033 Part A — founder briefing ──────────────────────────────
    founderBriefing: async (input): Promise<ApiResponse> =>
      Promise.resolve(fromWorldResult(await world.founderBriefing(input.userId), 400)),

    // ── SPRINT-033 Part E — workflow execution blueprint ──────────────────
    buildBlueprint: async (input): Promise<ApiResponse> => {
      const result = world.buildExecutionBlueprint({
        ownerId: input.userId as string,
        sourceTitle: input.sourceTitle as string,
        sourceGoal: input.sourceGoal as string,
        businessUnitId: input.businessUnitId as string | undefined,
        steps: input.steps as never[],
        estimatedCostUsd: input.estimatedCostUsd as never,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    // ── SPRINT-034 — outcome evidence & revenue → outcome feedback ────────
    outcomeEvidenceRecord: async (input): Promise<ApiResponse> => {
      const result = world.recordOutcomeEvidence({
        ownerId: input.userId as string,
        kind: input.kind as never,
        opportunityId: input.opportunityId as string | undefined,
        workflowId: input.workflowId as string | undefined,
        businessUnitId: input.businessUnitId as string | undefined,
        category: input.category as string | undefined,
        expected: input.expected as
          { value: number; status: 'ESTIMATED'; evidence: string[] } | undefined,
        actual: input.actual as
          { value: number; status: 'VERIFIED'; evidence: string[] } | undefined,
        verificationStatus: input.verificationStatus as never,
        evidence: input.evidence as string[],
        source: input.source as string | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    outcomeEvidenceList: async (input): Promise<ApiResponse> =>
      Promise.resolve(fromWorldResult(world.listOutcomeEvidence(input.userId), 400)),

    outcomeFeedbackApply: async (input): Promise<ApiResponse> => {
      const result = world.applyOutcomeFeedback(input.userId as string, input.evidenceId as string);
      return Promise.resolve(fromWorldResult(result, 400));
    },

    // ── SPRINT-034 — blueprint → approval-gated execution ─────────────────
    blueprintApprovalRequest: async (input): Promise<ApiResponse> => {
      const result = world.requestBlueprintApproval({
        ownerId: input.userId as string,
        blueprint: input.blueprint as never,
        stepId: input.stepId as string,
        workflowId: input.workflowId as string | undefined,
        providerId: input.providerId as string | undefined,
        estimatedCostUsd: input.estimatedCostUsd as
          | { value: number; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN'; evidence: string[] }
          | undefined,
        dataScope: input.dataScope as string | undefined,
        expectedOutcome: input.expectedOutcome as string | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    blueprintApprovalsList: async (input): Promise<ApiResponse> =>
      Promise.resolve(fromWorldResult(world.listBlueprintApprovals(input.userId), 400)),

    blueprintApprovalDecide: async (input): Promise<ApiResponse> => {
      const result = world.decideBlueprintApproval({
        ownerId: input.userId as string,
        requestId: input.requestId as string,
        decision: input.decision as 'APPROVED' | 'REJECTED',
        note: input.note as string | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    // ── SPRINT-034 — cost-weighted revenue intelligence ───────────────────
    revenueRanking: async (input): Promise<ApiResponse> =>
      Promise.resolve(successResponse(world.revenueRanking(input.userId))),

    // ── SPRINT-034 — Founder Command Center (presentation-only) ───────────
    commandCenter: async (input): Promise<ApiResponse> =>
      Promise.resolve(successResponse(await world.commandCenter(input.userId))),

    // ── SPRINT-035 — bounded owner-scoped timeline ────────────────────────
    timeline: async (input): Promise<ApiResponse> =>
      Promise.resolve(
        successResponse(
          world.buildTimeline(input.userId as string, {
            limit: input.limit as number | undefined,
            offset: input.offset as number | undefined,
          }),
        ),
      ),

    // ── SPRINT-035 — honest signal health ─────────────────────────────────
    signalHealth: async (input): Promise<ApiResponse> =>
      Promise.resolve(successResponse(world.signalHealth(input.userId))),

    // ── SPRINT-038 — opportunity discovery & revenue validation ──────────
    // Practical business problems (evidence-required), three advisory scores
    // + LEVEL, bounded lifecycle, zero/low-cost experiment planner, customer
    // discovery, VERIFIED-payment-only revenue validation, STOP
    // recommendations, provider economics over the EXISTING fabric and the
    // Opportunity Radar. All owner-scoped; nothing here approves/spends/
    // executes — the founder remains the ultimate authority.

    problemRegister: async (input): Promise<ApiResponse> => {
      const result = world.registerProblem({
        ownerId: input.userId as string,
        problemStatement: input.problemStatement as string,
        customerOrBusiness: input.customerOrBusiness as string | undefined,
        industry: input.industry as string | undefined,
        workflow: input.workflow as string | undefined,
        affectedRole: input.affectedRole as string | undefined,
        pain: input.pain as string | undefined,
        frequency: input.frequency as string | undefined,
        humanEffort: input.humanEffort as string | undefined,
        estimatedCurrentCost: input.estimatedCurrentCost as never,
        revenueImpact: input.revenueImpact as never,
        errorImpact: input.errorImpact as string | undefined,
        urgency: input.urgency as string | undefined,
        currentSolution: input.currentSolution as string | undefined,
        competitorAlternatives: input.competitorAlternatives as string[] | undefined,
        aiSuitability: input.aiSuitability as string | undefined,
        automationPotential: input.automationPotential as never,
        buyer: input.buyer as string | undefined,
        implementationComplexity: input.implementationComplexity as string | undefined,
        estimatedAiCost: input.estimatedAiCost as never,
        evidence: input.evidence as never[],
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    problemList: async (input): Promise<ApiResponse> =>
      Promise.resolve(fromWorldResult(world.listProblems(input.userId), 400)),

    problemGet: async (input): Promise<ApiResponse> =>
      Promise.resolve(
        fromWorldResult(world.getProblem(input.userId as string, input.problemId as string), 400),
      ),

    problemAddEvidence: async (input): Promise<ApiResponse> => {
      const result = world.addProblemEvidence({
        ownerId: input.userId as string,
        problemId: input.problemId as string,
        source: input.source as never,
        observedAt: input.observedAt as string | undefined,
        reference: input.reference as string | undefined,
        text: input.text as string,
        confidence: input.confidence as never,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    problemRecordCustomerSignal: async (input): Promise<ApiResponse> => {
      const result = world.recordCustomerSignal({
        ownerId: input.userId as string,
        problemId: input.problemId as string,
        signal: input.signal as never,
        text: input.text as string,
        reference: input.reference as string | undefined,
        confidence: input.confidence as never,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    problemRecordVerifiedPayment: async (input): Promise<ApiResponse> => {
      const result = world.recordVerifiedPayment({
        ownerId: input.userId as string,
        problemId: input.problemId as string,
        text: input.text as string,
        reference: input.reference as string | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    problemAssess: async (input): Promise<ApiResponse> => {
      const result = world.assessProblem({
        ownerId: input.userId as string,
        problemId: input.problemId as string,
        problemFactors: input.problemFactors as never[],
        opportunityFactors: input.opportunityFactors as never[],
        experimentFactors: input.experimentFactors as never[],
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    problemAdvance: async (input): Promise<ApiResponse> => {
      const result = world.advanceProblem({
        ownerId: input.userId as string,
        problemId: input.problemId as string,
        to: input.to as never,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    problemPlanExperiment: async (input): Promise<ApiResponse> => {
      const result = world.planProblemExperiment({
        ownerId: input.userId as string,
        problemId: input.problemId as string,
        hypothesis: input.hypothesis as string,
        targetCustomer: input.targetCustomer as string,
        problemUnderTest: input.problemUnderTest as string,
        objective: input.objective as string,
        minimumRequiredData: input.minimumRequiredData as string[],
        actions: input.actions as string[],
        estimatedAiCost: input.estimatedAiCost as never,
        humanEffort: input.humanEffort as never,
        duration: input.duration as never,
        successCriteria: input.successCriteria as string[],
        failureCriteria: input.failureCriteria as string[],
        stopConditions: input.stopConditions as string[],
        measurementMethod: input.measurementMethod as string,
        expectedInformationGain: input.expectedInformationGain as never,
        maxBudget: input.maxBudget as never,
        capitalBudgetInr: input.capitalBudgetInr as number | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    problemCustomerDiscovery: async (input): Promise<ApiResponse> => {
      const result = world.customerDiscovery({
        ownerId: input.userId as string,
        problemId: input.problemId as string,
        customerProfile: input.customerProfile as string | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    problemProviderEconomics: async (input): Promise<ApiResponse> => {
      const result = await world.problemProviderEconomics({
        ownerId: input.userId as string,
        problemId: input.problemId as string,
        requiredCapabilities: input.requiredCapabilities as string[],
        qualityRequirement: input.qualityRequirement as
          Array<{ capability: string; quality: number }> | undefined,
        privacy: input.privacy as 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'PRIVATE' | undefined,
        strategy: input.strategy as
          'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED' | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 500));
    },

    problemBusinessCandidate: async (input): Promise<ApiResponse> => {
      const result = world.businessCandidate({
        ownerId: input.userId as string,
        problemId: input.problemId as string,
        serviceDefinition: input.serviceDefinition as string,
        targetCustomer: input.targetCustomer as string,
        pricingHypothesis: input.pricingHypothesis as never,
        deliveryWorkflow: input.deliveryWorkflow as string[],
        providerStrategy: input.providerStrategy as string,
        aiCost: input.aiCost as never,
        humanCost: input.humanCost as never,
        marginHypothesis: input.marginHypothesis as never,
        customerAcquisitionHypothesis: input.customerAcquisitionHypothesis as string | undefined,
        mvpScope: input.mvpScope as string[],
        automationPotential: input.automationPotential as never,
        risks: input.risks as string[],
        nextExperiment: input.nextExperiment as string | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    opportunityRadar: async (input): Promise<ApiResponse> =>
      Promise.resolve(
        successResponse(
          world.opportunityRadar(input.userId as string, {
            limit: input.limit as number | undefined,
          }),
        ),
      ),

    // ── SPRINT-039 — founder evidence loop ───────────────────────────────────
    observationRecord: async (input): Promise<ApiResponse> => {
      const result = world.recordFounderObservation({
        ownerId: input.userId as string,
        problemId: input.problemId as string | undefined,
        sourceType: input.sourceType as never,
        sourceReference: input.sourceReference as string,
        observedStatement: input.observedStatement as string,
        context: input.context as string | undefined,
        affectedCustomerSegment: input.affectedCustomerSegment as string | undefined,
        frequency: input.frequency as string | undefined,
        severity: input.severity as string | undefined,
        currentWorkaround: input.currentWorkaround as string | undefined,
        statedWillingnessToPay: input.statedWillingnessToPay as never,
        statedBudget: input.statedBudget as never,
        objection: input.objection as string | undefined,
        nextAction: input.nextAction as string | undefined,
        claimedState: input.claimedState as never,
        provenance: input.provenance as never,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    observationsList: async (input): Promise<ApiResponse> => {
      const result = world.listObservations(
        input.userId as string,
        input.problemId as string | undefined,
      );
      return Promise.resolve(fromWorldResult(result, 400));
    },

    prospectRegister: async (input): Promise<ApiResponse> => {
      const result = world.registerProspect({
        ownerId: input.userId as string,
        problemId: input.problemId as string,
        prospectReference: input.prospectReference as string,
        customerSegment: input.customerSegment as string,
        problemDiscussed: input.problemDiscussed as string,
        currentSolution: input.currentSolution as string | undefined,
        painSeverity: input.painSeverity as string | undefined,
        frequency: input.frequency as string | undefined,
        existingSpending: input.existingSpending as never,
        budgetIndication: input.budgetIndication as never,
        willingnessToPayIndication: input.willingnessToPayIndication as never,
        objection: input.objection as string | undefined,
        desiredOutcome: input.desiredOutcome as string | undefined,
        nextStep: input.nextStep as string | undefined,
        discoveryStatus: input.discoveryStatus as never,
        evidence: input.evidence as never,
        provenance: input.provenance as never,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    prospectAdvance: async (input): Promise<ApiResponse> => {
      const result = world.advanceProspect({
        ownerId: input.userId as string,
        problemId: input.problemId as string,
        prospectReference: input.prospectReference as string,
        to: input.to as never,
        verifiedPaymentText: input.verifiedPaymentText as string | undefined,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    prospectsList: async (input): Promise<ApiResponse> => {
      const result = world.listProspects(
        input.userId as string,
        input.problemId as string | undefined,
      );
      return Promise.resolve(fromWorldResult(result, 400));
    },

    evidenceQualityView: async (input): Promise<ApiResponse> => {
      const result = world.opportunityEvidenceQuality(
        input.userId as string,
        input.problemId as string,
      );
      return Promise.resolve(fromWorldResult(result, 400));
    },

    factorCalibrate: async (input): Promise<ApiResponse> => {
      const result = world.calibrateProblemFactor({
        ownerId: input.userId as string,
        problemId: input.problemId as string,
        factorKey: input.factorKey as string,
        direction: input.direction as 1 | -1,
        reason: input.reason as string,
      });
      return Promise.resolve(fromWorldResult(result, 400));
    },

    nextBestActionView: async (input): Promise<ApiResponse> => {
      const result = world.opportunityNextBestAction(
        input.userId as string,
        input.problemId as string,
      );
      return Promise.resolve(fromWorldResult(result, 400));
    },

    opportunityCompare: async (input): Promise<ApiResponse> =>
      Promise.resolve(
        successResponse(
          world.compareOpportunities(input.userId as string, {
            limit: input.limit as number | undefined,
          }),
        ),
      ),

    opportunityDrilldownView: async (input): Promise<ApiResponse> => {
      const result = world.opportunityDrilldown(input.userId as string, input.problemId as string);
      return Promise.resolve(fromWorldResult(result, 400));
    },
  };
}

type RoleProviderStrategy = 'FREE' | 'LOCAL' | 'OPEN_SOURCE' | 'LOW_COST' | 'PREMIUM' | 'PRIVATE';
