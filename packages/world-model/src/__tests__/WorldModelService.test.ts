// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — WorldModelService tests (SPRINT-032)
// The composition seam over the frozen estate:
//   • business units are configurable + owner-isolated
//   • opportunity pipeline composes control + brain opportunities and NEVER
//     fabricates scores/capital modes
//   • roles + advisory workers ride the Intelligence Fabric
//   • bounded decomposition validates through the fabric bounds
//   • world signals report UNAVAILABLE when no source is connected
//   • memory promotion is controlled: observations are interaction
//     artifacts with provenance — nothing here writes preferences/outcomes
//   • the world model NEVER approves, spends or executes (structural)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type { StrategySelection } from '@vedmoulya/intelligence-fabric';
import { ActionClassPolicy } from '@vedmoulya/proactive';
import { WorldModelService } from '../application/WorldModelService.js';
import { InMemoryWorldStores } from '../infrastructure/InMemoryWorldStores.js';
import type { WorkflowExecutionBlueprint } from '../types/world-types.js';
import type {
  WorldActionPort,
  WorldApprovalPort,
  WorldBrainPort,
  WorldControlPort,
  WorldCostPort,
  WorldFabricPort,
  WorldProactivePort,
  WorldSignalSourcePort,
} from '../contracts/world-ports.js';

const now = (): string => '2026-08-14T10:00:00.000Z';

function brainPort(): WorldBrainPort {
  return {
    listOpportunities: (userId) => ({
      success: true,
      data: [
        {
          id: 'opp-1',
          category: 'business',
          title: 'AI automation service',
          description: 'Deliver workflow automation.',
          evidence: ['ai-world-discovery'],
          uncertainty: 0.3,
          status: 'RECOMMENDED',
          estimatedValue: { label: 'Unknown — no verified revenue data', status: 'UNKNOWN' },
          cost: { label: 'Unknown — depends on provider choice', status: 'UNKNOWN' },
          risk: 'MEDIUM',
          requiredCapabilities: ['TEXT_GENERATION', 'REASONING'],
          recommendedNextAction: 'Research the market.',
        },
      ],
    }),
    listTasks: (userId) => ({
      success: true,
      data: [
        { id: 't1', objective: 'Set up a YouTube channel', status: 'COMPLETED', createdAt: now() },
      ],
    }),
  };
}

function proactivePort(): WorldProactivePort {
  return {
    assessBusiness: (userId, input) => ({
      id: 'ba-1',
      ownerId: userId,
      title: input.title,
      description: input.description,
      category: 'Consulting / services',
      score: 0.5,
      businessCase: ['Capability fit 100%.'],
      estimatedCost: { label: 'Unknown — depends on provider choice', status: 'UNKNOWN' },
      estimatedRevenue: { label: 'Unknown — no verified revenue data', status: 'UNKNOWN' },
      riskLevel: 'MEDIUM',
      mvpPlan: ['Research the market.', 'Get explicit user approval.'],
      authorizationRequired: true,
      status: 'RESEARCHED',
      evidence: ['capability fit'],
      createdAt: now(),
    }),
  };
}

function fabricPort(): WorldFabricPort {
  return {
    selectStrategy: async (input): Promise<StrategySelection> => ({
      strategy: input.strategy,
      selected: {
        providerId: 'openai',
        modelId: 'gpt-4o-mini',
        name: 'OpenAI',
        capabilityMatched: true,
        evidence: ['capability matched'],
      },
      ranked: [],
      reasons: ['Selected because it matched the capability.'],
    }),
    validateWorkflow: (plan) =>
      plan.taskCount <= 24
        ? { allowed: true, reason: 'within bounds' }
        : { allowed: false, reason: 'too many tasks', exceeded: 'tasks' },
    costSnapshot: () => ({ dailyUsd: 0.5 }),
  };
}

function actionPort(): WorldActionPort {
  const policy = new ActionClassPolicy();
  return { classify: (a, opts) => policy.classify(a, opts) };
}

function controlPort(): WorldControlPort {
  return {
    listOpportunities: (userId) => [
      {
        id: 'lc-1',
        title: 'AI automation service',
        category: 'Consulting / services',
        status: 'PRESENTED',
        riskLevel: 'MEDIUM',
        estimatedCost: { label: '₹5,000 initial', status: 'ESTIMATED' },
        estimatedValue: { label: 'Unknown', status: 'UNKNOWN' },
        evidence: [{ label: 'capability fit', status: 'VERIFIED' }],
        recommendedWorkflow: ['Research', 'Propose', 'Deliver'],
        createdAt: '2026-08-15T08:00:00.000Z',
        updatedAt: '2026-08-15T09:00:00.000Z',
      },
    ],
    autonomyPosture: (ownerId) => ({
      emergencyStopEngaged: false,
      autonomyLevel: 2,
      settingsConfirmed: true,
    }),
  };
}

/** A control port with NO lifecycle records — a brand-new founder. */
function emptyControlPort(): WorldControlPort {
  return {
    listOpportunities: () => [],
    autonomyPosture: () => ({
      emergencyStopEngaged: false,
      autonomyLevel: 0,
      settingsConfirmed: false,
    }),
  };
}

function makeService(extra?: { signalSources?: WorldSignalSourcePort[] }): WorldModelService {
  return new WorldModelService({
    brain: brainPort(),
    proactive: proactivePort(),
    fabric: fabricPort(),
    action: actionPort(),
    control: controlPort(),
    stores: new InMemoryWorldStores(),
    signalSources: extra?.signalSources ?? [],
    now,
  });
}

describe('WorldModelService — world graph', () => {
  it('observes evidence-backed entities with provenance; refuses fabricated facts', () => {
    const service = makeService();
    const ok = service.observe({
      ownerId: 'u1',
      type: 'opportunity',
      label: 'YouTube automation',
      externalId: 'opp-1',
      evidence: ['brain-opportunity opp-1'],
      provenance: { source: 'brain-opportunity', status: 'VERIFIED', observedAt: now() },
    });
    expect(ok.success).toBe(true);
    const bad = service.observe({
      ownerId: 'u1',
      type: 'opportunity',
      label: 'Made up',
      evidence: [],
      provenance: { source: 'brain-opportunity', status: 'UNKNOWN', observedAt: now() },
    });
    expect(bad.success).toBe(false);
  });
});

describe('WorldModelService — business units', () => {
  it('creates configurable owner-scoped units with stable-key idempotency', () => {
    const service = makeService();
    const first = service.createBusinessUnit({
      ownerId: 'u1',
      name: 'AI solutions',
      purpose: 'Deliver AI automation services to local businesses.',
      offerings: ['workflow automation', 'AI consulting'],
      automationLevel: 2,
      aiCapabilities: ['TEXT_GENERATION'],
    });
    expect(first.success).toBe(true);
    const second = service.createBusinessUnit({
      ownerId: 'u1',
      name: 'AI solutions',
      purpose: 'Updated purpose.',
    });
    expect(second.success).toBe(true);
    if (first.success && second.success) {
      expect(second.data.id).toBe(first.data.id); // upsert, never duplicate
      expect(second.data.purpose).toBe('Updated purpose.');
    }
    const units = service.listBusinessUnits('u1');
    expect(units.success && units.data.length).toBe(1);
    // Owner isolation.
    const other = service.listBusinessUnits('u2');
    expect(other.success && other.data.length).toBe(0);
  });

  it('refuses invalid units and unknown updates', () => {
    const service = makeService();
    const invalid = service.createBusinessUnit({ ownerId: 'u1', name: '', purpose: '' });
    expect(invalid.success).toBe(false);
    const missing = service.updateBusinessUnit({ ownerId: 'u1', id: 'nope', name: 'x' });
    expect(missing.success).toBe(false);
  });
});

describe('WorldModelService — opportunity economics + pipeline', () => {
  it('evaluates an opportunity with factor exposure and honest capital mode', () => {
    const service = makeService();
    const evaluation = service.evaluateOpportunity({
      ownerId: 'u1',
      title: 'AI automation service',
      description: 'Deliver workflow automation to local businesses.',
      requiredCapabilities: ['TEXT_GENERATION', 'REASONING'],
      factors: [
        {
          key: 'marketEvidence',
          value: 0.8,
          status: 'ESTIMATED',
          evidence: ['local demand survey'],
        },
        { key: 'customerPain', value: 0.9, status: 'ESTIMATED', evidence: ['customer interviews'] },
        { key: 'initialCost', value: 0.9, status: 'ESTIMATED', evidence: ['low provider cost'] },
        {
          key: 'automationPotential',
          value: 0.9,
          status: 'ESTIMATED',
          evidence: ['capability fit'],
        },
      ],
      initialCostInr: { value: 1000, status: 'ESTIMATED' },
      capitalBudgetInr: 1000,
    });
    expect(evaluation.success).toBe(true);
    if (!evaluation.success) return;
    expect(evaluation.data.authorizationRequired).toBe(true);
    expect(evaluation.data.capitalMode).toBe('LOW_COST');
    expect(evaluation.data.factors.length).toBe(4);
    expect(evaluation.data.score).toBeGreaterThan(0);
  });

  it('pipeline composes control + brain opportunities and never fabricates', () => {
    const service = makeService();
    const pipeline = service.opportunityPipeline('u1', { limit: 10 });
    expect(pipeline.success).toBe(true);
    if (!pipeline.success) return;
    expect(pipeline.data.length).toBe(1);
    expect(pipeline.data[0]?.approvalRequired).toBe(true);
    // ₹5,000 initial cost → CAPITAL_REQUIRED against the ₹0 default budget.
    expect(pipeline.data[0]?.capitalMode).toBe('CAPITAL_REQUIRED');
    // A ₹5,000 owner budget makes the same opportunity LOW_COST.
    const funded = service.opportunityPipeline('u1', { budgetInr: 5000 });
    expect(funded.success && funded.data[0]?.capitalMode).toBe('LOW_COST');
  });

  it('pipeline stays EMPTY for a brand-new founder — AI World discovery does not pollute before data exists', () => {
    // Brain discovery has an AI World opportunity, but the founder has NO
    // recorded data (no control lifecycle, no problems/observations/prospects).
    // SPRINT-043E: the pipeline must stay honestly empty — the discovery
    // opportunity belongs to the AI World surface, not the founder's pipeline.
    const service = new WorldModelService({
      brain: brainPort(),
      proactive: proactivePort(),
      fabric: fabricPort(),
      action: actionPort(),
      control: emptyControlPort(),
      stores: new InMemoryWorldStores(),
      now,
    });
    const pipeline = service.opportunityPipeline('u1', { limit: 10 });
    expect(pipeline.success).toBe(true);
    if (!pipeline.success) return;
    expect(pipeline.data).toEqual([]);
  });

  it('pipeline surfaces AI World opportunities once the founder records evidence', () => {
    const service = new WorldModelService({
      brain: brainPort(),
      proactive: proactivePort(),
      fabric: fabricPort(),
      action: actionPort(),
      control: emptyControlPort(),
      stores: new InMemoryWorldStores(),
      now,
    });
    // The founder records their first problem with evidence (the evidence loop
    // requires evidence — never a fabricated fact).
    const registered = service.registerProblem({
      ownerId: 'u1',
      problemStatement: 'Local clinics reconcile invoices manually and lose hours weekly.',
      evidence: [
        {
          source: 'direct_observation',
          text: 'LOCAL TEST: two clinic owners described reconciliation as a weekly time sink.',
          confidence: 'ESTIMATED',
        },
      ],
    });
    expect(registered.success).toBe(true);
    // The pipeline now legitimately surfaces the AI World discovery opportunity.
    const pipeline = service.opportunityPipeline('u1', { limit: 10 });
    expect(pipeline.success).toBe(true);
    if (!pipeline.success) return;
    const titles = pipeline.data.map((e) => e.title);
    expect(titles).toContain('AI automation service');
  });
});

describe('WorldModelService — AI workforce', () => {
  it('registers roles and suggests advisory workers through the fabric', async () => {
    const service = makeService();
    const role = service.registerRole({
      ownerId: 'u1',
      name: 'CONTENT_RESEARCHER',
      responsibilities: ['Research markets'],
      capabilities: ['RESEARCH'],
      authorityClass: 'A',
    });
    expect(role.success).toBe(true);
    if (!role.success) return;
    const workers = await service.suggestWorkers('u1', role.data.id, 'BALANCED');
    expect(workers.success).toBe(true);
    if (workers.success) {
      expect(workers.data.length).toBeGreaterThan(0);
      expect(workers.data[0]?.advisory).toBe(true);
      expect(workers.data[0]?.authorityClass).toBe('A');
      expect(workers.data[0]?.providerId).toBe('openai');
    }
    // No escalation.
    expect(service.canDelegate(role.data, 'C')).toBe(false);
  });
});

describe('WorldModelService — workflows', () => {
  it('creates a workflow and decomposes within bounds', async () => {
    const service = makeService();
    const created = service.createWorkflow({
      ownerId: 'u1',
      name: 'Client delivery',
      description: 'Generic delivery pipeline',
      trigger: 'CLIENT_REQUEST',
      inputs: ['request'],
      steps: [
        { id: 's1', label: 'analyze', capability: 'REASONING', dependsOn: [] },
        { id: 's2', label: 'propose', dependsOn: ['s1'] },
        { id: 's3', label: 'build', capability: 'CODING', dependsOn: ['s2'] },
      ],
      outputs: ['delivered artifact'],
    });
    expect(created.success).toBe(true);

    const decomposition = await service.decomposeWorkflow({
      ownerId: 'u1',
      goal: 'Build a YouTube video',
      steps: [
        { label: 'research', capability: 'RESEARCH' },
        { label: 'script', capability: 'TEXT_GENERATION' },
        { label: 'thumbnail', capability: 'IMAGE_GENERATION' },
      ],
      estimatedCostUsd: 1,
    });
    expect(decomposition.success).toBe(true);
    if (decomposition.success) {
      expect(decomposition.data.executed).toBe(false);
      expect(decomposition.data.bounds.allowed).toBe(true);
    }

    // Estimated cost/time over the SPRINT-030 caps → the fabric bounds block.
    const overBudget = await service.decomposeWorkflow({
      ownerId: 'u1',
      goal: 'Over budget plan',
      steps: [{ label: 'research', capability: 'RESEARCH' }],
      estimatedCostUsd: 100,
      estimatedTimeMs: 9_000_000,
    });
    expect(overBudget.success).toBe(true);
    if (overBudget.success) expect(overBudget.data.bounds.allowed).toBe(false);
  });
});

describe('WorldModelService — world signals (interfaces only)', () => {
  it('reports UNAVAILABLE when no external source is connected (never SUCCESS)', async () => {
    const service = makeService();
    const signals = await service.listSignals('u1');
    expect(signals.success).toBe(true);
    if (!signals.success) return;
    expect(signals.data.length).toBeGreaterThan(0);
    for (const signal of signals.data) {
      expect(signal.status).toBe('UNAVAILABLE');
      expect(signal.signals).toEqual([]);
    }
  });

  it('reports ERROR when a connected source fails — never fabricated data', async () => {
    const failing: WorldSignalSourcePort = {
      listSignals: async () => {
        throw new Error('source down');
      },
    };
    const service = makeService({ signalSources: [failing] });
    const signals = await service.listSignals('u1');
    expect(signals.success).toBe(true);
    if (!signals.success) return;
    expect(signals.data[0]?.status).toBe('ERROR');
    expect(signals.data[0]?.signals).toEqual([]);
  });

  it('surfaces AVAILABLE signals with provenance when a real source answers', async () => {
    const live: WorldSignalSourcePort = {
      listSignals: async (kind) => ({
        status: 'AVAILABLE',
        signals: [
          {
            id: 'sig-1',
            kind,
            title: 'AI model release',
            description: 'A new model shipped.',
            provenance: 'https://example.com/release',
            observedAt: now(),
          },
        ],
      }),
    };
    const service = makeService({ signalSources: [live] });
    const signals = await service.listSignals('u1');
    expect(signals.success).toBe(true);
    if (!signals.success) return;
    const model = signals.data.find((s) => s.kind === 'ai_model_releases');
    expect(model?.status).toBe('AVAILABLE');
    expect(model?.signals[0]?.provenance).toContain('https://');
  });
});

describe('WorldModelService — security + memory boundaries', () => {
  it('the world model has NO self-approve / spend / execute surface (structural)', () => {
    const service = makeService();
    const prototype = Object.getOwnPropertyNames(Object.getPrototypeOf(service));
    // Approval-named methods DELEGATE through the existing authority port
    // (WorldApprovalPort → Brain) — they never decide alone. Anything else
    // carrying an approve/authorize/execute/spend name is forbidden.
    const delegating = new Set(['approveOrchestrationPlan', 'decideBlueprintApproval']);
    // SPRINT-038 recordVerifiedPayment RECORDS the founder's reported payment
    // as EVIDENCE (revenueState advance) — it never spends, moves or approves
    // money; it is an evidence-write, not a payment action.
    const evidenceOnly = new Set(['recordVerifiedPayment']);
    const approveLike = prototype.filter((m) => /approve|authorize/i.test(m) && !delegating.has(m));
    expect(approveLike).toEqual([]);
    expect(prototype.some((m) => /execute|runWorkflow|deploy/i.test(m))).toBe(false);
    expect(prototype.some((m) => /spend|pay|purchase/i.test(m) && !evidenceOnly.has(m))).toBe(
      false,
    );
  });

  it('observations are interaction artifacts with provenance — no memory promotion', () => {
    const service = makeService();
    service.observe({
      ownerId: 'u1',
      type: 'work',
      label: 'Completed client project',
      externalId: 'task-9',
      evidence: ['brain-task task-9'],
      provenance: { source: 'brain-task', status: 'VERIFIED', observedAt: now() },
    });
    // The world model has no method that writes preferences/outcomes/learning.
    const prototype = Object.getOwnPropertyNames(Object.getPrototypeOf(service));
    expect(prototype.some((m) => /preference|promote|recordLearning|outcomeMemory/i.test(m))).toBe(
      false,
    );
    // Evidence + provenance are always stored with the entity.
    const entities = service.listEntities('u1');
    expect(entities.success && entities.data.entities[0]?.provenance?.source).toBe('brain-task');
  });

  it('boundary classification composes the existing authority (class C → APPROVAL_REQUIRED)', () => {
    const service = makeService();
    const decision = service.classifyBoundary('Publish the report to the website');
    expect(decision.responsibilityClass).toBe('APPROVAL_REQUIRED');
    expect(decision.actionClass).toBe('C');
  });

  it('error paths are honest: missing units/roles, invalid workflows, unavailable fabric/assessor', async () => {
    const service = makeService();

    // update/remove unknown business unit → NOT_FOUND.
    const missingUpdate = service.updateBusinessUnit({ ownerId: 'u1', id: 'nope', name: 'x' });
    expect(missingUpdate.success).toBe(false);
    const missingRemove = service.removeBusinessUnit('u1', 'nope');
    expect(missingRemove.success).toBe(false);

    // invalid role (no responsibilities) refused.
    const badRole = service.registerRole({
      ownerId: 'u1',
      name: 'GHOST',
      responsibilities: [],
      capabilities: [],
    });
    expect(badRole.success).toBe(false);

    // invalid workflow (no trigger) refused.
    const badWorkflow = service.createWorkflow({
      ownerId: 'u1',
      name: 'x',
      description: 'x',
      trigger: '',
      inputs: [],
      steps: [{ id: 's1', label: 'a', dependsOn: [] }],
      outputs: [],
    });
    expect(badWorkflow.success).toBe(false);

    // empty decomposition goal refused.
    const emptyDecompose = service.decomposeWorkflow({
      ownerId: 'u1',
      goal: '',
      steps: [{ label: 'a' }],
    });
    expect(emptyDecompose.success).toBe(false);

    // suggestWorkers with an unknown role → NOT_FOUND.
    const missingRole = await service.suggestWorkers('u1', 'role-ghost');
    expect(missingRole.success).toBe(false);
  });

  it('suggestWorkers returns no workers when the fabric has no candidate (honest no-selection)', async () => {
    const noCandidateFabric: WorldFabricPort = {
      ...fabricPort(),
      selectStrategy: async (input): Promise<StrategySelection> => ({
        strategy: input.strategy,
        selected: undefined,
        ranked: [],
        reasons: ['PRIVATE task with no local candidate — no selection.'],
      }),
    };
    const service = new WorldModelService({
      brain: brainPort(),
      proactive: proactivePort(),
      fabric: noCandidateFabric,
      action: actionPort(),
      control: controlPort(),
      stores: new InMemoryWorldStores(),
      now,
    });
    const role = service.registerRole({
      ownerId: 'u1',
      name: 'RESEARCHER',
      responsibilities: ['Research'],
      capabilities: ['RESEARCH'],
      privacyRequirement: 'PRIVATE',
    });
    expect(role.success).toBe(true);
    if (!role.success) return;
    const workers = await service.suggestWorkers('u1', role.data.id, 'PRIVATE');
    expect(workers.success).toBe(true);
    if (workers.success) expect(workers.data).toEqual([]);
  });

  it('suggestWorkers fails honestly when the fabric is unavailable', async () => {
    const failingFabric: WorldFabricPort = {
      ...fabricPort(),
      selectStrategy: async () => {
        throw new Error('fabric down');
      },
    };
    const service = new WorldModelService({
      brain: brainPort(),
      proactive: proactivePort(),
      fabric: failingFabric,
      action: actionPort(),
      control: controlPort(),
      stores: new InMemoryWorldStores(),
      now,
    });
    const role = service.registerRole({
      ownerId: 'u1',
      name: 'RESEARCHER',
      responsibilities: ['Research'],
      capabilities: ['RESEARCH'],
    });
    expect(role.success).toBe(true);
    if (!role.success) return;
    const workers = await service.suggestWorkers('u1', role.data.id);
    expect(workers.success).toBe(false);
    expect(workers.success === false && workers.code).toBe('FABRIC_UNAVAILABLE');
  });

  it('evaluateOpportunity fails honestly when the assessor is unavailable', () => {
    const throwingProactive: WorldProactivePort = {
      assessBusiness: () => {
        throw new Error('assessor down');
      },
    };
    const service = new WorldModelService({
      brain: brainPort(),
      proactive: throwingProactive,
      fabric: fabricPort(),
      action: actionPort(),
      control: controlPort(),
      stores: new InMemoryWorldStores(),
      now,
    });
    const evaluation = service.evaluateOpportunity({
      ownerId: 'u1',
      title: 'Opportunity',
      description: 'desc',
      requiredCapabilities: [],
      factors: [],
    });
    expect(evaluation.success).toBe(false);
    expect(evaluation.success === false && evaluation.code).toBe('ASSESSOR_UNAVAILABLE');
  });

  it('links refuse unknown entities and wrong owners at the graph boundary', () => {
    const service = makeService();
    const unknown = service.link({
      ownerId: 'u1',
      type: 'has_goal',
      fromId: 'nope',
      toId: 'nope2',
    });
    expect(unknown.success).toBe(false);
  });

  it('overview is a bounded snapshot with honest posture', async () => {
    const service = makeService();
    const overview = await service.overview('u1');
    expect(overview.bounded).toBe(true);
    expect(overview.emergencyStopEngaged).toBe(false);
    expect(overview.autonomyLevel).toBe(2);
    expect(overview.settingsConfirmed).toBe(true);
    expect(overview.signals.every((s) => s.status === 'UNAVAILABLE')).toBe(true);
  });

  it('uses the real clock when no clock is injected', () => {
    const service = new WorldModelService({
      brain: brainPort(),
      proactive: proactivePort(),
      fabric: fabricPort(),
      action: actionPort(),
      control: controlPort(),
      stores: new InMemoryWorldStores(),
    });
    const result = service.observe({
      ownerId: 'u1',
      type: 'task',
      label: 'Clock',
      evidence: ['brain-task'],
      provenance: {
        source: 'brain-task',
        status: 'VERIFIED',
        observedAt: new Date().toISOString(),
      },
    });
    expect(result.success).toBe(true);
  });

  it('lists relations and views the graph as a bounded slice', () => {
    const service = makeService();
    const user = service.observe({
      ownerId: 'u1',
      type: 'user',
      label: 'Owner',
      evidence: ['user-statement'],
      provenance: { source: 'user-statement', status: 'VERIFIED', observedAt: now() },
    });
    const goal = service.observe({
      ownerId: 'u1',
      type: 'goal',
      label: 'Goal',
      evidence: ['user-statement'],
      provenance: { source: 'user-statement', status: 'VERIFIED', observedAt: now() },
    });
    if (!user.success || !goal.success) return;
    const linked = service.link({
      ownerId: 'u1',
      type: 'has_goal',
      fromId: user.data.id,
      toId: goal.data.id,
    });
    expect(linked.success).toBe(true);
    const relations = service.listRelations('u1');
    expect(relations.success && relations.data.total).toBe(1);
    const typeFiltered = service.listRelations('u1', { type: 'has_goal', limit: 5 });
    expect(typeFiltered.success && typeFiltered.data.relations.length).toBe(1);
    const view = service.view('u1');
    expect(view.totalEntities).toBe(2);
    expect(view.totalRelations).toBe(1);
    expect(view.entities.length).toBeLessThanOrEqual(20);
  });

  it('updates and removes business units (success paths)', () => {
    const service = makeService();
    const created = service.createBusinessUnit({
      ownerId: 'u1',
      name: 'AI solutions',
      purpose: 'Deliver AI automation.',
      automationLevel: 2,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;
    const updated = service.updateBusinessUnit({
      ownerId: 'u1',
      id: created.data.id,
      purpose: 'Updated purpose.',
      automationLevel: 4,
    });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.data.purpose).toBe('Updated purpose.');
      expect(updated.data.automationLevel).toBe(4);
      expect(updated.data.createdAt).toBe(created.data.createdAt); // createdAt preserved
    }
    const removed = service.removeBusinessUnit('u1', created.data.id);
    expect(removed.success && removed.data.removed).toBe(true);
    expect(service.listBusinessUnits('u1').success && service.listBusinessUnits('u1').data).toEqual(
      [],
    );
  });

  it('pipeline skips rejected/completed/duplicate/dismissed records and exposes capital modes', () => {
    const richControl: WorldControlPort = {
      listOpportunities: (userId) => [
        {
          id: 'lc-1',
          title: 'REJECTED OPPORTUNITY',
          category: 'x',
          status: 'REJECTED',
          riskLevel: 'HIGH',
          evidence: [],
        },
        {
          id: 'lc-2',
          title: 'DONE OPPORTUNITY',
          category: 'x',
          status: 'COMPLETED',
          riskLevel: 'LOW',
          evidence: [],
        },
        {
          id: 'lc-3',
          title: 'Duplicate',
          category: 'x',
          status: 'PRESENTED',
          riskLevel: 'UNKNOWN',
          evidence: [],
        },
        {
          id: 'lc-4',
          title: 'Duplicate',
          category: 'x',
          status: 'PRESENTED',
          riskLevel: 'MEDIUM',
          evidence: [],
        },
        {
          id: 'lc-5',
          title: 'No cost evidence',
          category: 'x',
          status: 'PRESENTED',
          riskLevel: 'UNKNOWN',
          evidence: [],
        },
        {
          id: 'lc-6',
          title: 'Zero cost',
          category: 'x',
          status: 'PRESENTED',
          riskLevel: 'LOW',
          estimatedCost: { label: '₹0 initial', status: 'ESTIMATED' },
          estimatedValue: { label: 'Unknown', status: 'UNKNOWN' },
          evidence: [],
        },
        {
          id: 'lc-7',
          title: 'No digits',
          category: 'x',
          status: 'PRESENTED',
          riskLevel: 'MEDIUM',
          estimatedCost: { label: 'Custom pricing', status: 'ESTIMATED' },
          evidence: [],
        },
      ],
      autonomyPosture: (ownerId) => ({
        emergencyStopEngaged: false,
        autonomyLevel: 2,
        settingsConfirmed: true,
      }),
    };
    const service = new WorldModelService({
      brain: brainPort(),
      proactive: proactivePort(),
      fabric: fabricPort(),
      action: actionPort(),
      control: richControl,
      stores: new InMemoryWorldStores(),
      now,
    });
    const pipeline = service.opportunityPipeline('u1', { limit: 10 });
    expect(pipeline.success).toBe(true);
    if (!pipeline.success) return;
    const titles = pipeline.data.map((e) => e.title);
    expect(titles).not.toContain('REJECTED OPPORTUNITY');
    expect(titles).not.toContain('DONE OPPORTUNITY');
    expect(titles.filter((t) => t === 'Duplicate')).toHaveLength(1); // dedup
    expect(pipeline.data.find((e) => e.title === 'No cost evidence')?.capitalMode).toBe('UNKNOWN');
    expect(pipeline.data.find((e) => e.title === 'Zero cost')?.capitalMode).toBe('NO_COST');
    expect(pipeline.data.find((e) => e.title === 'No digits')?.capitalMode).toBe('UNKNOWN');
  });

  it('pipeline surfaces brain opportunities that are not deduped and sorts by score', () => {
    const service = makeService();
    // control 'AI automation service' and brain 'AI automation service' dedup;
    // add a second brain opportunity with a unique title + low uncertainty.
    const richBrain: WorldBrainPort = {
      listOpportunities: (userId) => ({
        success: true,
        data: [
          {
            id: 'opp-2',
            category: 'business',
            title: 'YouTube automation',
            description: 'Automate content production.',
            evidence: ['ai-world-discovery'],
            uncertainty: 0.1,
            status: 'RECOMMENDED',
            estimatedValue: { label: 'Unknown', status: 'UNKNOWN' },
            cost: { label: 'Unknown', status: 'UNKNOWN' },
            risk: 'HIGH',
            requiredCapabilities: ['TEXT_GENERATION'],
            recommendedNextAction: 'Research.',
          },
          {
            id: 'opp-3',
            category: 'business',
            title: 'DISMISSED ONE',
            description: 'x',
            evidence: [],
            uncertainty: 0.9,
            status: 'DISMISSED',
            risk: 'UNKNOWN',
            requiredCapabilities: [],
          },
        ],
      }),
      listTasks: (userId) => ({ success: true, data: [] }),
    };
    const serviceWithBrain = new WorldModelService({
      brain: richBrain,
      proactive: proactivePort(),
      fabric: fabricPort(),
      action: actionPort(),
      control: controlPort(),
      stores: new InMemoryWorldStores(),
      now,
    });
    const pipeline = serviceWithBrain.opportunityPipeline('u1', { limit: 10 });
    expect(pipeline.success).toBe(true);
    if (!pipeline.success) return;
    const titles = pipeline.data.map((e) => e.title);
    expect(titles).toContain('YouTube automation');
    expect(titles).not.toContain('DISMISSED ONE');
    // YouTube automation (score 0.9) sorts above AI automation service (score 0).
    expect(pipeline.data[0]?.title).toBe('YouTube automation');
    expect(pipeline.data.find((e) => e.title === 'YouTube automation')?.riskLevel).toBe('HIGH');
    expect(pipeline.data.find((e) => e.title === 'YouTube automation')?.capitalMode).toBe(
      'UNKNOWN',
    );
  });

  it('lists roles and workflows', () => {
    const service = makeService();
    service.registerRole({
      ownerId: 'u1',
      name: 'RESEARCHER',
      responsibilities: ['Research'],
      capabilities: ['RESEARCH'],
    });
    service.createWorkflow({
      ownerId: 'u1',
      name: 'Delivery',
      description: 'x',
      trigger: 'CLIENT_REQUEST',
      inputs: [],
      steps: [{ id: 's1', label: 'a', dependsOn: [] }],
      outputs: [],
    });
    const roles = service.listRoles('u1');
    expect(roles.success && roles.data.length).toBe(1);
    const workflows = service.listWorkflows('u1');
    expect(workflows.success && workflows.data.length).toBe(1);
    expect(service.listRoles('u2').success && service.listRoles('u2').data).toEqual([]);
    expect(service.listWorkflows('u2').success && service.listWorkflows('u2').data).toEqual([]);
  });
});

describe('WorldModelService — SPRINT-033 revenue intelligence', () => {
  it('registers evidence-carrying streams, snapshots and decisions', () => {
    const service = makeService();
    const stream = service.registerRevenueStream({
      ownerId: 'u1',
      name: 'AI services',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 5000, status: 'ESTIMATED', evidence: ['quote'] },
      estimatedMonthlyCostUsd: { value: 2000, status: 'ESTIMATED', evidence: ['provider cost'] },
      automationPercentage: { value: 0.8, status: 'ESTIMATED', evidence: ['measured'] },
    });
    expect(stream.success).toBe(true);
    const snapshot = service.revenueSnapshot('u1');
    expect(snapshot.totalEstimatedMonthlyRevenueUsd).toBe(5000);
    expect(snapshot.estimatedMargin).toBeCloseTo((5000 - 2000) / 5000, 5);
    expect(snapshot.advisory).toBe(true);
    const decisions = service.revenueDecisions('u1');
    expect(decisions[0]?.advisory).toBe(true);
  });

  it('rejects a figure without evidence and isolates owners', () => {
    const service = makeService();
    const bad = service.registerRevenueStream({
      ownerId: 'u1',
      name: 'Fake revenue',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 999999, status: 'ESTIMATED', evidence: [] },
    });
    expect(bad.success).toBe(false);
    service.registerRevenueStream({
      ownerId: 'u1',
      name: 'Real stream',
      kind: 'PRODUCT',
      estimatedMonthlyRevenueUsd: { value: 100, status: 'VERIFIED', evidence: ['ledger'] },
    });
    expect(
      service.listRevenueStreams('u2').success && service.listRevenueStreams('u2').data,
    ).toEqual([]);
    const removed = service.removeRevenueStream('u1', 'nope');
    expect(removed.success).toBe(false);
  });
});

describe('WorldModelService — SPRINT-033 founder briefing', () => {
  it('is advisory, no-spam, and surfaces approvals/risks from the estate', async () => {
    const service = makeService();
    const briefing = await service.founderBriefing('u1');
    expect(briefing.success).toBe(true);
    if (!briefing.success) return;
    expect(briefing.data.advisory).toBe(true);
    // The pipeline has one PRESENTED opportunity needing approval → content.
    expect(briefing.data.hasContent).toBe(true);
    expect(briefing.data.today.pendingApprovals.length).toBeGreaterThan(0);
    expect(briefing.data.today.activeOpportunities).toBe(1);
    // Signals are UNAVAILABLE (no source) — never fabricated.
    expect(briefing.data.signals.every((s) => s.status === 'UNAVAILABLE')).toBe(true);
  });

  it('reflects revenue + cost in TODAY', async () => {
    const service = makeService();
    service.registerRevenueStream({
      ownerId: 'u1',
      name: 'AI services',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 5000, status: 'ESTIMATED', evidence: ['quote'] },
    });
    const briefing = await service.founderBriefing('u1');
    expect(briefing.success).toBe(true);
    if (!briefing.success) return;
    expect(briefing.data.today.revenueStreams).toBe(1);
    expect(briefing.data.today.totalEstimatedMonthlyRevenueUsd).toBe(5000);
    expect(briefing.data.today.costDailyUsd).toBe(0.5); // fabric costSnapshot
  });
});

describe('WorldModelService — SPRINT-033 execution blueprint', () => {
  it('builds a representation with approval gates and structural executed:false', () => {
    const service = makeService();
    const blueprint = service.buildExecutionBlueprint({
      ownerId: 'u1',
      sourceTitle: 'Content business',
      sourceGoal: 'Produce and publish content.',
      steps: [
        { id: 's1', label: 'draft the report', dependsOn: [] },
        { id: 's2', label: 'publish the report to the website', dependsOn: ['s1'] },
      ],
    });
    expect(blueprint.success).toBe(true);
    if (!blueprint.success) return;
    expect(blueprint.data.executed).toBe(false);
    expect(blueprint.data.authorizationRequired).toBe(true);
    expect(blueprint.data.approvalGates).toHaveLength(1);
    expect(blueprint.data.steps[0]?.actionClass).toBe('A');
    expect(blueprint.data.steps[1]?.actionClass).toBe('C');
  });

  it('refuses invalid blueprints and cost without evidence', () => {
    const service = makeService();
    const empty = service.buildExecutionBlueprint({
      ownerId: 'u1',
      sourceTitle: '',
      sourceGoal: 'x',
      steps: [{ id: 's1', label: 'a', dependsOn: [] }],
    });
    expect(empty.success).toBe(false);
    const noEvidence = service.buildExecutionBlueprint({
      ownerId: 'u1',
      sourceTitle: 'Plan',
      sourceGoal: 'Goal',
      steps: [{ id: 's1', label: 'a', dependsOn: [] }],
      estimatedCostUsd: { value: 10, status: 'ESTIMATED', evidence: [] },
    });
    expect(noEvidence.success).toBe(false);
  });
});

describe('WorldModelService — SPRINT-033 opportunity categories', () => {
  it('normalizes an evaluation category against the closed vocabulary', () => {
    const service = makeService();
    const evaluation = service.evaluateOpportunity({
      ownerId: 'u1',
      title: 'SaaS idea',
      description: 'A subscription product.',
      requiredCapabilities: ['TEXT_GENERATION'],
      category: 'SAAS',
      factors: [],
    });
    expect(evaluation.success).toBe(true);
    if (!evaluation.success) return;
    expect(evaluation.data.category).toBe('saas');
  });

  it('keeps a non-vocabulary category as-is (never invented)', () => {
    const service = makeService();
    const evaluation = service.evaluateOpportunity({
      ownerId: 'u1',
      title: 'Bespoke idea',
      description: 'A custom business.',
      requiredCapabilities: [],
      category: 'totally-custom-niche',
      factors: [],
    });
    expect(evaluation.success).toBe(true);
    if (!evaluation.success) return;
    expect(evaluation.data.category).toBe('totally-custom-niche');
  });
});

describe('WorldModelService — SPRINT-034 outcome evidence + feedback', () => {
  it('records VERIFIED-only evidence with stable-key idempotency', () => {
    const service = makeService();
    const record = service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'REVENUE',
      opportunityId: 'opp-1',
      category: 'saas',
      actual: { value: 500, status: 'VERIFIED', evidence: ['invoice'] },
      verificationStatus: 'VERIFIED',
      evidence: ['invoice shows $500'],
      source: 'invoice',
    });
    expect(record.success).toBe(true);
    if (!record.success) return;
    const again = service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'REVENUE',
      opportunityId: 'opp-1',
      category: 'saas',
      actual: { value: 600, status: 'VERIFIED', evidence: ['invoice-2'] },
      verificationStatus: 'VERIFIED',
      evidence: ['invoice-2 shows $600'],
      source: 'invoice-2',
    });
    expect(again.success).toBe(true);
    if (!again.success) return;
    // Same stable key → upsert (one record per (kind, opportunity)).
    expect(again.data.stableKey).toBe(record.data.stableKey);
    expect(
      service.listOutcomeEvidence('u1').success && service.listOutcomeEvidence('u1').data,
    ).toHaveLength(1);
  });

  it('REFUSES unverified actuals and evidence-free records', () => {
    const service = makeService();
    const unverified = service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'REVENUE',
      opportunityId: 'opp-1',
      actual: { value: 500, status: 'ESTIMATED', evidence: ['guess'] },
      verificationStatus: 'VERIFIED',
      evidence: ['guess'],
    });
    expect(unverified.success).toBe(false);
    const noEvidence = service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'COST',
      opportunityId: 'opp-1',
      verificationStatus: 'VERIFIED',
      evidence: [],
    });
    expect(noEvidence.success).toBe(false);
  });

  it('feeds verified outcome evidence into future evaluations of the SAME category (bounded, evidence-attached)', () => {
    const service = makeService();
    const before = service.evaluateOpportunity({
      ownerId: 'u1',
      title: 'SaaS product',
      description: 'A subscription.',
      requiredCapabilities: [],
      category: 'saas',
      factors: [{ key: 'expectedMargin', value: 0.5, status: 'ESTIMATED', evidence: ['plan'] }],
    });
    if (!before.success) throw new Error('eval failed');
    const baseline = before.data.factors.find((f) => f.key === 'expectedMargin')?.value ?? 0.5;

    service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'MARGIN',
      opportunityId: 'opp-saas',
      category: 'saas',
      actual: { value: 0.9, status: 'VERIFIED', evidence: ['actuals'] },
      verificationStatus: 'VERIFIED',
      evidence: ['verified margin 0.9'],
    });

    const after = service.evaluateOpportunity({
      ownerId: 'u1',
      title: 'SaaS product 2',
      description: 'Another subscription.',
      requiredCapabilities: [],
      category: 'saas',
      factors: [{ key: 'expectedMargin', value: 0.5, status: 'ESTIMATED', evidence: ['plan'] }],
    });
    if (!after.success) throw new Error('eval failed');
    const adjusted = after.data.factors.find((f) => f.key === 'expectedMargin')?.value ?? 0.5;
    expect(adjusted).toBeGreaterThan(baseline);
    expect(after.data.feedback?.length).toBeGreaterThan(0);
    // Feedback is bounded: never more than the clamp from the base.
    expect(adjusted - 0.5).toBeLessThanOrEqual(0.06);
    // The feedback is evidence-attached — always explainable.
    expect(after.data.feedback?.[0]?.evidence.length).toBeGreaterThan(0);
  });

  it('applyOutcomeFeedback is honest for missing records and records without an actual', () => {
    const service = makeService();
    const missing = service.applyOutcomeFeedback('u1', 'nope');
    expect(missing.success).toBe(false);
    expect(missing.success === false && missing.code).toBe('NOT_FOUND');
    // A VERIFIED record WITHOUT an actual figure is recorded but never
    // applied as feedback (there is no observed value to move a factor).
    const noActual = service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'REVENUE',
      opportunityId: 'opp-2',
      category: 'saas',
      verificationStatus: 'VERIFIED',
      evidence: ['verified event, no actual figure yet'],
    });
    if (!noActual.success) throw new Error('record failed');
    const feedback = service.applyOutcomeFeedback('u1', noActual.data.id);
    expect(feedback.success).toBe(true);
    if (feedback.success) {
      expect(feedback.data.applied).toBe(false);
      expect(feedback.data.reason).toContain('refused');
    }
    // An UNVERIFIED record is REFUSED at record time (never stored).
    const unverified = service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'REVENUE',
      opportunityId: 'opp-3',
      category: 'saas',
      verificationStatus: 'UNVERIFIED',
      evidence: ['unverified'],
    });
    expect(unverified.success).toBe(false);
    expect(unverified.success === false && unverified.code).toBe('NOT_VERIFIED');
  });
});

function approvalPort(overrides?: Partial<WorldApprovalPort>): WorldApprovalPort {
  return {
    requestApproval: (input) => ({ success: true, data: { taskId: 'brain-task-1' } }),
    approve: (input) => ({
      success: true,
      data: { grantedBy: input.userId, grantedAt: now(), scope: input.action },
    }),
    reject: () => ({ success: true }),
    ...overrides,
  };
}

function makeServiceWithApproval(
  overrides?: Partial<WorldApprovalPort>,
  cost?: WorldCostPort,
): WorldModelService {
  return new WorldModelService({
    brain: brainPort(),
    proactive: proactivePort(),
    fabric: fabricPort(),
    action: actionPort(),
    control: controlPort(),
    stores: new InMemoryWorldStores(),
    approval: approvalPort(overrides),
    cost,
    now,
  });
}

function blueprintFor(service: WorldModelService): WorkflowExecutionBlueprint {
  const built = service.buildExecutionBlueprint({
    ownerId: 'u1',
    sourceTitle: 'Content business',
    sourceGoal: 'Publish content.',
    steps: [{ id: 's1', label: 'publish the report to the website', dependsOn: [] }],
  });
  if (!built.success) throw new Error('blueprint failed');
  return built.data;
}

describe('WorldModelService — SPRINT-034 blueprint approval lifecycle', () => {
  it('creates a WAITING request through the existing approval authority', () => {
    const service = makeServiceWithApproval();
    const blueprint = blueprintFor(service);
    const request = service.requestBlueprintApproval({
      ownerId: 'u1',
      blueprint,
      stepId: 's1',
      providerId: 'provider-x',
      estimatedCostUsd: { value: 5, status: 'ESTIMATED', evidence: ['quote'] },
      dataScope: 'public website',
      expectedOutcome: 'Report published',
    });
    expect(request.success).toBe(true);
    if (!request.success) return;
    expect(request.data.status).toBe('WAITING_FOR_APPROVAL');
    expect(request.data.authorityTaskId).toBe('brain-task-1');
    expect(request.data.executed).toBe(false);
    expect(request.data.authorityRequired).toBe('C');
    const list = service.listBlueprintApprovals('u1');
    expect(list.success && list.data).toHaveLength(1);
    // Owner isolation.
    expect(
      service.listBlueprintApprovals('u2').success && service.listBlueprintApprovals('u2').data,
    ).toHaveLength(0);
  });

  it('CANNOT approve itself — only the existing authority port can grant approval', () => {
    const service = makeServiceWithApproval();
    const blueprint = blueprintFor(service);
    const request = service.requestBlueprintApproval({ ownerId: 'u1', blueprint, stepId: 's1' });
    if (!request.success) throw new Error('request failed');
    // The world model has NO approve surface of its own — only decide* which
    // delegates to the port. A decision without the port is refused.
    const structural = Object.getOwnPropertyNames(Object.getPrototypeOf(service));
    expect(structural.some((m) => /^approve$/i.test(m))).toBe(false);
    // Deciding requires the port to answer — the decision record comes FROM
    // the authority, never fabricated by the world model.
    const decided = service.decideBlueprintApproval({
      ownerId: 'u1',
      requestId: request.data.id,
      decision: 'APPROVED',
    });
    expect(decided.success).toBe(true);
    if (decided.success) {
      expect(decided.data.status).toBe('APPROVED');
      expect(decided.data.decision?.grantedBy).toBe('u1');
      expect(decided.data.decision?.scope).toBe(request.data.action);
      // Structural: approval never flips executed.
      expect(decided.data.executed).toBe(false);
    }
  });

  it('refuses to decide a non-waiting or already-decided request', () => {
    const service = makeServiceWithApproval();
    const blueprint = blueprintFor(service);
    const request = service.requestBlueprintApproval({ ownerId: 'u1', blueprint, stepId: 's1' });
    if (!request.success) throw new Error('request failed');
    service.decideBlueprintApproval({
      ownerId: 'u1',
      requestId: request.data.id,
      decision: 'APPROVED',
    });
    const again = service.decideBlueprintApproval({
      ownerId: 'u1',
      requestId: request.data.id,
      decision: 'REJECTED',
    });
    expect(again.success).toBe(false);
    expect(again.success === false && again.code).toBe('ALREADY_DECIDED');
    const missing = service.decideBlueprintApproval({
      ownerId: 'u1',
      requestId: 'nope',
      decision: 'APPROVED',
    });
    expect(missing.success).toBe(false);
  });

  it('rejection routes through the existing authority and blocks the action', () => {
    const service = makeServiceWithApproval();
    const blueprint = blueprintFor(service);
    const request = service.requestBlueprintApproval({ ownerId: 'u1', blueprint, stepId: 's1' });
    if (!request.success) throw new Error('request failed');
    const decided = service.decideBlueprintApproval({
      ownerId: 'u1',
      requestId: request.data.id,
      decision: 'REJECTED',
      note: 'Not now',
    });
    expect(decided.success).toBe(true);
    if (decided.success) {
      expect(decided.data.status).toBe('REJECTED');
      expect(decided.data.decision?.note).toBe('Not now');
      expect(decided.data.executed).toBe(false);
    }
  });

  it('refuses a request when the existing approval authority is not configured', () => {
    const service = makeService(); // no approval port
    const blueprint = blueprintFor(service);
    const request = service.requestBlueprintApproval({ ownerId: 'u1', blueprint, stepId: 's1' });
    expect(request.success).toBe(false);
    expect(request.success === false && request.code).toBe('APPROVAL_AUTHORITY_UNAVAILABLE');
  });

  it('refuses a request for a step not in the blueprint', () => {
    const service = makeServiceWithApproval();
    const blueprint = blueprintFor(service);
    const request = service.requestBlueprintApproval({ ownerId: 'u1', blueprint, stepId: 'ghost' });
    expect(request.success).toBe(false);
    expect(request.success === false && request.code).toBe('NOT_FOUND');
  });
});

describe('WorldModelService — SPRINT-034 cost-weighted revenue intelligence', () => {
  it('ranks margin-aware; UNKNOWN cost is never zero and never attributed', () => {
    // Honest cost port: stream-scoped queries return undefined (the gateway
    // has no per-stream ledger key — a per-stream figure would be fabricated).
    const costPort: WorldCostPort = {
      measuredCostUsd: (ownerId, scope) => (scope?.streamId ? undefined : undefined),
    };
    const service = new WorldModelService({
      brain: brainPort(),
      proactive: proactivePort(),
      fabric: fabricPort(),
      action: actionPort(),
      control: controlPort(),
      stores: new InMemoryWorldStores(),
      cost: costPort,
      now,
    });
    service.registerRevenueStream({
      ownerId: 'u1',
      name: 'High revenue',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 12000, status: 'ESTIMATED', evidence: ['deal'] },
      estimatedMonthlyCostUsd: { value: 5000, status: 'ESTIMATED', evidence: ['costs'] },
    });
    service.registerRevenueStream({
      ownerId: 'u1',
      name: 'No cost evidence',
      kind: 'PRODUCT',
      estimatedMonthlyRevenueUsd: { value: 10000, status: 'ESTIMATED', evidence: ['deal'] },
    });
    const ranking = service.revenueRanking('u1');
    expect(ranking.advisory).toBe(true);
    expect(ranking.unknownCost).toContain('No cost evidence');
    const noCost = ranking.entries.find((e) => e.streamName === 'No cost evidence');
    expect(noCost?.rankScore).toBeUndefined();
    expect(noCost?.assumptions.some((a) => a.includes('never treated as zero'))).toBe(true);
    const highRevenue = ranking.entries.find((e) => e.streamName === 'High revenue');
    // No measured cost exists → the stream's own evidence is the basis.
    expect(highRevenue?.measuredCostUsd).toBeUndefined();
    expect(highRevenue?.roiUsd).toBeCloseTo((12000 - 5000) / 5000, 1);
  });

  it('lists revenue without a cost port honestly (no measured evidence)', () => {
    const service = makeService();
    service.registerRevenueStream({
      ownerId: 'u1',
      name: 'Stream',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 1000, status: 'ESTIMATED', evidence: ['deal'] },
      estimatedMonthlyCostUsd: { value: 100, status: 'ESTIMATED', evidence: ['costs'] },
    });
    const ranking = service.revenueRanking('u1');
    expect(ranking.entries[0]?.roiUsd).toBeCloseTo(9, 1);
    expect(ranking.entries[0]?.assumptions.length).toBeGreaterThan(0);
  });
});

describe('WorldModelService — SPRINT-034 Founder Command Center', () => {
  it('composes the existing read models into TODAY/PORTFOLIO/INTELLIGENCE/AUTOMATION/APPROVALS', async () => {
    const service = makeService();
    service.createBusinessUnit({
      ownerId: 'u1',
      name: 'AI solutions',
      purpose: 'Deliver AI automation.',
    });
    service.registerRevenueStream({
      ownerId: 'u1',
      name: 'AI services',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 5000, status: 'ESTIMATED', evidence: ['quote'] },
    });
    service.createWorkflow({
      ownerId: 'u1',
      name: 'Delivery',
      description: 'x',
      trigger: 'CLIENT_REQUEST',
      inputs: [],
      steps: [{ id: 's1', label: 'a', dependsOn: [] }],
      outputs: [],
    });
    const view = await service.commandCenter('u1');
    expect(view.advisory).toBe(true);
    // TODAY — briefing surfaces the pending pipeline opportunity.
    expect(view.today.pendingApprovals.length).toBeGreaterThan(0);
    // PORTFOLIO — business units + revenue streams + pipeline.
    expect(view.portfolio.businessUnits).toBe(1);
    expect(view.portfolio.revenueStreams).toBe(1);
    expect(view.portfolio.totalEstimatedMonthlyRevenueUsd).toBe(5000);
    expect(view.portfolio.pipelineOpportunities).toBeGreaterThan(0);
    // INTELLIGENCE — bounded graph + honest signals.
    expect(view.intelligence.entityCount).toBe(0);
    expect(view.intelligence.signals.every((s) => s.status === 'UNAVAILABLE')).toBe(true);
    // AUTOMATION — workflows count.
    expect(view.automation.workflows).toBe(1);
    // APPROVALS — empty until a blueprint request exists.
    expect(view.approvals).toEqual([]);
  });

  it('surfaces waiting blueprint approvals in the APPROVALS surface', async () => {
    const service = makeServiceWithApproval();
    const built = service.buildExecutionBlueprint({
      ownerId: 'u1',
      sourceTitle: 'Content business',
      sourceGoal: 'Publish content.',
      steps: [{ id: 's1', label: 'publish the report to the website', dependsOn: [] }],
    });
    if (!built.success) throw new Error('blueprint failed');
    service.requestBlueprintApproval({ ownerId: 'u1', blueprint: built.data, stepId: 's1' });
    const view = await service.commandCenter('u1');
    expect(view.approvals).toHaveLength(1);
    expect(view.approvals[0]?.action).toContain('publish the report');
    expect(view.approvals[0]?.authorityRequired).toBe('C');
    expect(view.automation.blueprintApprovals).toHaveLength(1);
  });
});

describe('WorldModelService — SPRINT-035 bounded timeline + signal health + cost view', () => {
  it('composes a bounded owner-scoped timeline from the existing stores', () => {
    const service = makeService();
    // Revenue stream + outcome evidence + blueprint approval + control opportunity.
    service.registerRevenueStream({
      ownerId: 'u1',
      name: 'AI services',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 5000, status: 'ESTIMATED', evidence: ['quote'] },
    });
    service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'MARGIN',
      category: 'Consulting / services',
      verificationStatus: 'VERIFIED',
      actual: { value: 0.8, status: 'VERIFIED', evidence: ['invoice'] },
      evidence: ['invoice'],
    });
    const timeline = service.buildTimeline('u1');
    expect(timeline.events.length).toBeGreaterThanOrEqual(2);
    // Sorted newest-first (timestamps in the fixture are fixed).
    const ats = timeline.events.map((e) => e.at);
    expect([...ats].sort().reverse()).toEqual(ats);
    // Bounded + paginated.
    const page = service.buildTimeline('u1', { limit: 1, offset: 0 });
    expect(page.events).toHaveLength(1);
    expect(page.hasMore).toBe(true);
    const second = service.buildTimeline('u1', { limit: 1, offset: 1 });
    expect(second.events).toHaveLength(1);
    expect(second.events[0]?.eventId).not.toBe(page.events[0]?.eventId);
  });

  it('never duplicates timeline events (stable-key idempotency)', () => {
    const service = makeService();
    // Re-recording the same outcome upserts by stable key.
    service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'MARGIN',
      category: 'AI automation',
      verificationStatus: 'VERIFIED',
      actual: { value: 0.8, status: 'VERIFIED', evidence: ['invoice'] },
      evidence: ['invoice'],
    });
    service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'MARGIN',
      category: 'AI automation',
      verificationStatus: 'VERIFIED',
      actual: { value: 0.9, status: 'VERIFIED', evidence: ['invoice-2'] },
      evidence: ['invoice-2'],
    });
    const timeline = service.buildTimeline('u1');
    const outcomeEvents = timeline.events.filter((e) => e.type === 'OUTCOME');
    expect(outcomeEvents).toHaveLength(1);
  });

  it('keeps the timeline owner-scoped (cross-owner isolation)', () => {
    const service = makeService();
    service.registerRevenueStream({
      ownerId: 'u1',
      name: 'AI services',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 5000, status: 'ESTIMATED', evidence: ['quote'] },
    });
    // The owner-scoped revenue stream never appears in another owner's
    // timeline (the fake control port serves the same lifecycle record to
    // every caller, mirroring that it is NOT a cross-owner leak — the
    // revenue store is the owner-scoped surface under test).
    const other = service.buildTimeline('u2').events.filter((e) => e.type === 'REVENUE');
    expect(other).toHaveLength(0);
    const own = service.buildTimeline('u1').events.filter((e) => e.type === 'REVENUE');
    expect(own).toHaveLength(1);
  });

  it('reports honest signal health (UNAVAILABLE until a real observation)', async () => {
    let success: boolean | undefined;
    const fakeSource: WorldSignalSourcePort = {
      listSignals: async () => ({ status: 'AVAILABLE', signals: [] }),
      health: () => [
        {
          kind: 'market_trends',
          status: success === false ? 'ERROR' : 'AVAILABLE',
          lastSuccessAt: '2026-08-15T10:00:00.000Z',
          lastErrorAt: success === false ? '2026-08-15T10:00:00.000Z' : undefined,
          lastError: success === false ? 'Source failed.' : undefined,
          configured: true,
        },
      ],
    };
    const service = makeService({ signalSources: [fakeSource] });
    success = true;
    const health = service.signalHealth('u1');
    expect(health).toHaveLength(1);
    expect(health[0]?.kind).toBe('market_trends');
    expect(health[0]?.status).toBe('AVAILABLE');
    expect(health[0]?.lastSuccessAt).toBeDefined();
    // The command center exposes the same honest health.
    const view = await service.commandCenter('u1');
    expect(view.intelligence.signalHealth[0]?.status).toBe('AVAILABLE');
  });

  it('never fabricates signal health when no source implements health()', async () => {
    const service = makeService();
    expect(service.signalHealth('u1')).toEqual([]);
    const view = await service.commandCenter('u1');
    expect(view.intelligence.signalHealth).toEqual([]);
    expect(view.intelligence.signals.every((s) => s.status === 'UNAVAILABLE')).toBe(true);
  });
});

describe('WorldModelService — multi-provider orchestration (SPRINT-036)', () => {
  it('produces a bounded, owner-scoped plan with per-step bindings + reasons; never executes', async () => {
    const service = makeService();
    const result = await service.orchestratePlan({
      ownerId: 'u1',
      goal: 'Research a business opportunity and prepare a concise recommendation',
      steps: [
        { id: 'research', label: 'Research the business opportunity', capability: 'research' },
        { id: 'verify', label: 'Verify the recommendation', capability: 'verification' },
      ],
      strategy: 'BALANCED',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const plan = result.data;
    expect(plan.executed).toBe(false);
    expect(plan.authorizationRequired).toBe(true);
    expect(plan.bounds.allowed).toBe(true);
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0]?.providerId).toBe('openai');
    expect(plan.steps[0]?.reasons.length).toBeGreaterThan(0);
    expect(plan.steps[0]?.actionClass).toBe('A');
    // Bounded retry/fallback policy is decided for every failure mode.
    expect(plan.steps[0]?.retryPolicy.some((p) => p.failureMode === 'TIMEOUT')).toBe(true);
    expect(
      plan.steps[0]?.retryPolicy.find((p) => p.failureMode === 'MALFORMED_RESPONSE')?.action,
    ).toBe('STOP');
  });

  it('is idempotent — same goal + strategy upserts, never duplicates', async () => {
    const service = makeService();
    const first = await service.orchestratePlan({
      ownerId: 'u1',
      goal: 'Automate client onboarding',
      steps: [{ id: 's1', label: 'Draft the plan', capability: 'planning' }],
      strategy: 'QUALITY',
    });
    const second = await service.orchestratePlan({
      ownerId: 'u1',
      goal: 'Automate client onboarding',
      steps: [{ id: 's1', label: 'Draft the plan', capability: 'planning' }],
      strategy: 'QUALITY',
    });
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.data.stableKey).toBe(first.data.stableKey);
    expect(second.data.id).toBe(first.data.id); // upsert, not a new record
    const plans = service.listOrchestrationPlans('u1');
    expect(plans.success && plans.data.length).toBe(1);
  });

  it('is owner-isolated — another owner never sees the plans', async () => {
    const service = makeService();
    await service.orchestratePlan({
      ownerId: 'u1',
      goal: 'Build a YouTube workflow',
      steps: [{ id: 's1', label: 'Research topics', capability: 'research' }],
      strategy: 'BALANCED',
    });
    expect(service.listOrchestrationPlans('u2').data?.length ?? 0).toBe(0);
  });

  it('reports honest errors — fabric unavailable and no AI steps', async () => {
    const failing: WorldFabricPort = {
      selectStrategy: async () => {
        throw new Error('fabric down');
      },
      validateWorkflow: (p) => ({ allowed: true, reason: 'ok' }),
      costSnapshot: () => ({}),
    };
    const down = new WorldModelService({
      brain: brainPort(),
      proactive: proactivePort(),
      fabric: failing,
      action: actionPort(),
      control: controlPort(),
      stores: new InMemoryWorldStores(),
      now,
    });
    const fabricError = await down.orchestratePlan({
      ownerId: 'u1',
      goal: 'Anything',
      steps: [{ id: 's1', label: 'Research', capability: 'research' }],
      strategy: 'BALANCED',
    });
    expect(fabricError.success).toBe(false);
    expect(fabricError.code).toBe('FABRIC_UNAVAILABLE');

    const noAi = await makeService().orchestratePlan({
      ownerId: 'u1',
      goal: 'Human-only task',
      steps: [{ id: 's1', label: 'Call the client', capability: undefined }],
      strategy: 'BALANCED',
    });
    expect(noAi.success).toBe(false);
    expect(noAi.code).toBe('NO_AI_STEPS');
  });

  it('privacy overrides cost — PRIVATE strategy never selects a public provider', async () => {
    const privateFabric: WorldFabricPort = {
      selectStrategy: async (input) => {
        // Only a PUBLIC candidate exists for this capability.
        const candidate = {
          providerId: 'public-only',
          modelId: 'm1',
          name: 'Public Only',
          capabilityMatched: true,
          quality: 0.9,
          latencyMs: 100,
          estimatedCostUsd: 0.001,
          privacyClass: 'PUBLIC' as const,
          localAvailability: 'no' as const,
          evidence: [],
        };
        const privacyFiltered = input.taskPrivacy === 'PRIVATE' || input.strategy === 'PRIVATE';
        return {
          strategy: input.strategy,
          selected: privacyFiltered ? undefined : candidate,
          ranked: privacyFiltered ? [] : [candidate],
          reasons: privacyFiltered
            ? ['No private/local provider satisfies the capability — honest NO_SELECTION.']
            : ['Selected Public Only.'],
        };
      },
      validateWorkflow: (p) => ({ allowed: true, reason: 'ok' }),
      costSnapshot: () => ({}),
    };
    const service = new WorldModelService({
      brain: brainPort(),
      proactive: proactivePort(),
      fabric: privateFabric,
      action: actionPort(),
      control: controlPort(),
      stores: new InMemoryWorldStores(),
      now,
    });
    const result = await service.orchestratePlan({
      ownerId: 'u1',
      goal: 'Process private data',
      steps: [
        {
          id: 's1',
          label: 'Analyze the private document',
          capability: 'analysis',
          privacyClass: 'PRIVATE',
        },
      ],
      strategy: 'PRIVATE',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const step = result.data.steps[0];
    expect(step?.providerId).toBeUndefined(); // honest NO_SELECTION
    expect(step?.providerState).toBe('UNAVAILABLE');
    expect(step?.fallbackProviderId).toBeUndefined(); // never a public fallback
  });

  it('bounds are enforced — an over-cost plan is not allowed', async () => {
    const service = makeService();
    const result = await service.orchestratePlan({
      ownerId: 'u1',
      goal: 'Expensive workflow',
      steps: [
        { id: 's1', label: 'Research', capability: 'research' },
        { id: 's2', label: 'Reason', capability: 'reasoning' },
      ],
      strategy: 'BALANCED',
      estimatedCostUsd: 500,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.bounds.allowed).toBe(false);
    expect(result.data.bounds.exceeded).toBe('cost');
    expect(result.data.costPolicy.allowed).toBe(false);
  });
});

// ── SPRINT-037 — orchestration plan approval through the EXISTING authority ──
describe('WorldModelService — SPRINT-037 orchestration plan approval + execution gate', () => {
  it('getOrchestrationPlan is owner-scoped (IDOR refused)', async () => {
    const service = makeServiceWithApproval();
    const planned = await service.orchestratePlan({
      ownerId: 'u1',
      goal: 'Research an opportunity',
      steps: [{ id: 's1', label: 'Research', capability: 'research' }],
      strategy: 'BALANCED',
    });
    expect(planned.success).toBe(true);
    if (!planned.success) return;
    const planId = planned.data.id;
    // Same owner sees it.
    expect(service.getOrchestrationPlan('u1', planId).success).toBe(true);
    // Another owner is refused — never a cross-owner read.
    const foreign = service.getOrchestrationPlan('u2', planId);
    expect(foreign.success).toBe(false);
  });

  it('approveOrchestrationPlan routes through the Brain authority and records the grant', async () => {
    const service = makeServiceWithApproval();
    const planned = await service.orchestratePlan({
      ownerId: 'u1',
      goal: 'Research an opportunity',
      steps: [{ id: 's1', label: 'Research', capability: 'research' }],
      strategy: 'BALANCED',
    });
    if (!planned.success) return;
    const planId = planned.data.id;

    const approved = service.approveOrchestrationPlan({
      ownerId: 'u1',
      planId,
      decision: 'APPROVED',
      note: 'founder says go',
    });
    expect(approved.success).toBe(true);
    if (!approved.success) return;
    expect(approved.data.status).toBe('APPROVED');
    expect(approved.data.approval?.grantedBy).toBe('u1');
    expect(approved.data.approval?.scope).toContain('Research');
    // STRUCTURAL — approval never flips `executed`: the plan is a
    // representation; the EXISTING execution bridge is the only runtime.
    expect(approved.data.executed).toBe(false);
  });

  it('a PLANNED plan cannot be approved twice (already decided)', async () => {
    const service = makeServiceWithApproval();
    const planned = await service.orchestratePlan({
      ownerId: 'u1',
      goal: 'Research an opportunity',
      steps: [{ id: 's1', label: 'Research', capability: 'research' }],
      strategy: 'BALANCED',
    });
    if (!planned.success) return;
    const planId = planned.data.id;
    service.approveOrchestrationPlan({ ownerId: 'u1', planId, decision: 'APPROVED' });
    const second = service.approveOrchestrationPlan({
      ownerId: 'u1',
      planId,
      decision: 'APPROVED',
    });
    expect(second.success).toBe(false);
  });

  it('rejection also routes through the authority and is never an approval', async () => {
    const service = makeServiceWithApproval();
    const planned = await service.orchestratePlan({
      ownerId: 'u1',
      goal: 'Research an opportunity',
      steps: [{ id: 's1', label: 'Research', capability: 'research' }],
      strategy: 'BALANCED',
    });
    if (!planned.success) return;
    const planId = planned.data.id;
    const rejected = service.approveOrchestrationPlan({
      ownerId: 'u1',
      planId,
      decision: 'REJECTED',
    });
    expect(rejected.success).toBe(true);
    if (!rejected.success) return;
    expect(rejected.data.status).toBe('REJECTED');
    expect(rejected.data.approval).toBeUndefined();
    expect(rejected.data.executed).toBe(false);
  });

  it('approval is refused when the authority is unavailable (never self-approved)', async () => {
    const service = new WorldModelService({
      brain: brainPort(),
      proactive: proactivePort(),
      fabric: fabricPort(),
      action: actionPort(),
      control: controlPort(),
      stores: new InMemoryWorldStores(),
      now,
    });
    const planned = await service.orchestratePlan({
      ownerId: 'u1',
      goal: 'Research an opportunity',
      steps: [{ id: 's1', label: 'Research', capability: 'research' }],
      strategy: 'BALANCED',
    });
    if (!planned.success) return;
    const planId = planned.data.id;
    const decided = service.approveOrchestrationPlan({
      ownerId: 'u1',
      planId,
      decision: 'APPROVED',
    });
    expect(decided.success).toBe(false);
    expect(decided.error).toContain('approval authority');
  });

  it('commandCenter surfaces orchestration plans with honest approval state', async () => {
    const service = makeServiceWithApproval();
    await service.orchestratePlan({
      ownerId: 'u1',
      goal: 'Research an opportunity',
      steps: [{ id: 's1', label: 'Research', capability: 'research' }],
      strategy: 'BALANCED',
    });
    const view = await service.commandCenter('u1');
    expect(view.automation.orchestrationPlans.length).toBe(1);
    const shown = view.automation.orchestrationPlans[0];
    expect(shown).toBeDefined();
    expect(shown?.approved).toBe(false); // PLANNED — never presented as runnable
    expect(shown?.status).toBe('PLANNED');
  });
});
