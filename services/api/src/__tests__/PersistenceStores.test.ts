// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Persistence Bundle (SPRINT-022) tests
//
// 1. Hermetic: resolvePersistenceBundle() env gating — deterministic
//    in-memory stores in development/test, Postgres stores in
//    production/staging, partial overrides applied.
// 2. Real-Postgres restart recovery (gated on POSTGRES_TEST_URL): create
//    state across every store family → flush → RECREATE the bundle over the
//    same database → hydrate → assert state survives, NO duplicate records,
//    owner isolation holds, notification read-state preserved.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { InMemoryScheduleStore } from '@vedmoulya/ai-world-scheduler';
import { resolvePersistenceBundle } from '../infrastructure/PersistenceStores.js';

describe('resolvePersistenceBundle (SPRINT-022)', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('resolves deterministic in-memory stores in development/test', async () => {
    process.env.NODE_ENV = 'test';
    const bundle = resolvePersistenceBundle();
    expect(bundle.scheduler.schedules.constructor.name).toBe('InMemoryScheduleStore');
    expect(bundle.brain.tasks.constructor.name).toBe('InMemoryBrainTaskStore');
    expect(bundle.brain.outcomeMemory.constructor.name).toBe('InMemoryOutcomeMemory');
    expect(bundle.ecosystem.notificationStore.constructor.name).toBe('InMemoryNotificationStore');
    expect(bundle.bridge.loops.constructor.name).toBe('InMemoryBridgeLoopStore');
    expect(bundle.discoveryStore.constructor.name).toBe('InMemoryDiscoveryStore');
    // Lifecycle handles are safe no-ops for in-memory bundles.
    await bundle.hydrate();
    await bundle.flush();
  });

  it('resolves Postgres write-through stores in production/staging', () => {
    const bundle = resolvePersistenceBundle({}, 'production');
    expect(bundle.scheduler.schedules.constructor.name).toBe('PostgresScheduleStore');
    expect(bundle.scheduler.runs.constructor.name).toBe('PostgresRunStore');
    expect(bundle.brain.tasks.constructor.name).toBe('PostgresBrainTaskStore');
    expect(bundle.brain.decisions.constructor.name).toBe('PostgresBrainDecisionStore');
    expect(bundle.brain.opportunities.constructor.name).toBe('PostgresOpportunityStore');
    expect(bundle.brain.events.constructor.name).toBe('PostgresIntelligenceEventStore');
    expect(bundle.brain.outcomeMemory.constructor.name).toBe('PostgresOutcomeMemory');
    expect(bundle.brain.adaptiveScores.constructor.name).toBe('PostgresAdaptiveScoreLedger');
    expect(bundle.ecosystem.connectionStore.constructor.name).toBe('PostgresGitHubConnectionStore');
    expect(bundle.ecosystem.notificationStore.constructor.name).toBe('PostgresNotificationStore');
    expect(bundle.bridge.loops.constructor.name).toBe('PostgresBridgeLoopStore');
    expect(bundle.discoveryStore.constructor.name).toBe('PostgresDiscoveryStore');
  });

  it('applies partial overrides on top of the environment default', () => {
    const bundle = resolvePersistenceBundle(
      {
        scheduler: { schedules: new InMemoryScheduleStore() },
      },
      'production',
    );
    expect(bundle.scheduler.schedules.constructor.name).toBe('InMemoryScheduleStore');
    expect(bundle.scheduler.runs.constructor.name).toBe('PostgresRunStore'); // untouched
    expect(bundle.brain.tasks.constructor.name).toBe('PostgresBrainTaskStore');
  });
});

// ── Real-Postgres restart recovery (requires POSTGRES_TEST_URL) ──────────────

const testUrl = process.env.POSTGRES_TEST_URL;

const describeReal = testUrl ? describe : describe.skip;

describeReal('Persistence restart recovery against real Postgres', () => {
  let sql: postgres.Sql;

  const ALL_TABLES = [
    'ai_world_schedules',
    'ai_world_jobs',
    'ai_world_runs',
    'ai_world_source_policies',
    'ai_world_cooldowns',
    'brain_tasks',
    'brain_decisions',
    'brain_opportunities',
    'brain_intelligence_events',
    'brain_outcome_memory',
    'adaptive_score_ledger',
    'ecosystem_github_connections',
    'ecosystem_lifecycle_records',
    'ecosystem_recommendations',
    'ecosystem_notifications',
    'ecosystem_acquisitions',
    'bridge_loop_runs',
    'ai_world_discovery_items',
    'ai_world_discovery_user_state',
  ];

  const importPackages = async (): Promise<{
    scheduler: typeof import('@vedmoulya/ai-world-scheduler');
    brain: typeof import('@vedmoulya/brain');
    ecosystem: typeof import('@vedmoulya/ecosystem-intelligence');
    bridge: typeof import('@vedmoulya/live-intelligence-bridge');
    aiWorld: typeof import('@vedmoulya/ai-world');
  }> => {
    const [scheduler, brain, ecosystem, bridge, aiWorld] = await Promise.all([
      import('@vedmoulya/ai-world-scheduler'),
      import('@vedmoulya/brain'),
      import('@vedmoulya/ecosystem-intelligence'),
      import('@vedmoulya/live-intelligence-bridge'),
      import('@vedmoulya/ai-world'),
    ]);
    return { scheduler, brain, ecosystem, bridge, aiWorld };
  };

  const ensureTables = async (p: Awaited<ReturnType<typeof importPackages>>): Promise<void> => {
    const stores = [
      new p.scheduler.PostgresScheduleStore(sql),
      new p.scheduler.PostgresJobStore(sql),
      new p.scheduler.PostgresRunStore(sql),
      new p.scheduler.PostgresSourcePolicyStore(sql),
      new p.scheduler.PostgresCooldownStore(sql),
      new p.brain.PostgresBrainTaskStore(sql),
      new p.brain.PostgresBrainDecisionStore(sql),
      new p.brain.PostgresOpportunityStore(sql),
      new p.brain.PostgresIntelligenceEventStore(sql),
      new p.brain.PostgresOutcomeMemory(sql),
      new p.brain.PostgresAdaptiveScoreLedger(sql),
      new p.ecosystem.PostgresGitHubConnectionStore(sql),
      new p.ecosystem.PostgresLifecycleStore(sql),
      new p.ecosystem.PostgresRecommendationStore(sql),
      new p.ecosystem.PostgresNotificationStore(sql),
      new p.ecosystem.PostgresAcquisitionStore(sql),
      new p.bridge.PostgresBridgeLoopStore(sql),
      new p.aiWorld.PostgresDiscoveryStore(sql),
    ];
    await Promise.all(stores.map((s) => (s as { ensureTable(): Promise<void> }).ensureTable()));
  };

  const cleanTables = async (): Promise<void> => {
    for (const table of ALL_TABLES) {
      try {
        await sql`DELETE FROM ${sql(table)}`;
      } catch {
        // Table may not exist before the first ensureTable — ignore.
      }
    }
  };

  it('scheduler/brain/ecosystem/bridge/AI World state survives a full restart with no duplicates and owner isolation', async () => {
    sql = postgres(testUrl as string, { max: 5 });
    const p = await importPackages();
    await ensureTables(p);
    await cleanTables();

    // ── Instance A: create state ─────────────────────────────────────────
    const a = {
      schedules: new p.scheduler.PostgresScheduleStore(sql),
      jobs: new p.scheduler.PostgresJobStore(sql),
      runs: new p.scheduler.PostgresRunStore(sql),
      sourcePolicies: new p.scheduler.PostgresSourcePolicyStore(sql),
      cooldowns: new p.scheduler.PostgresCooldownStore(sql),
      tasks: new p.brain.PostgresBrainTaskStore(sql),
      decisions: new p.brain.PostgresBrainDecisionStore(sql),
      opportunities: new p.brain.PostgresOpportunityStore(sql),
      events: new p.brain.PostgresIntelligenceEventStore(sql),
      outcomeMemory: new p.brain.PostgresOutcomeMemory(sql),
      adaptiveScores: new p.brain.PostgresAdaptiveScoreLedger(sql),
      connections: new p.ecosystem.PostgresGitHubConnectionStore(sql),
      lifecycle: new p.ecosystem.PostgresLifecycleStore(sql),
      recommendations: new p.ecosystem.PostgresRecommendationStore(sql),
      notifications: new p.ecosystem.PostgresNotificationStore(sql),
      acquisitions: new p.ecosystem.PostgresAcquisitionStore(sql),
      loops: new p.bridge.PostgresBridgeLoopStore(sql),
      discovery: new p.aiWorld.PostgresDiscoveryStore(sql),
    };

    const now = '2026-01-01T00:00:00.000Z';
    a.schedules.save({
      userId: 'u1',
      jobCategory: 'PROVIDER_MODEL_DISCOVERY',
      enabled: true,
      frequency: 'DAILY',
      updatedAt: now,
    });
    a.jobs.save({
      jobId: 'PROVIDER_MODEL_DISCOVERY',
      userId: 'u1',
      jobCategory: 'PROVIDER_MODEL_DISCOVERY',
      policy: {
        jobCategory: 'PROVIDER_MODEL_DISCOVERY',
        itemCategories: [],
        frequency: 'DAILY',
        discoveryBudget: {
          maxDiscoveryCalls: 5,
          maxSourceCalls: 5,
          maxTokens: 1000,
          maxCostUsd: 0.1,
          maxLatencyMs: 60000,
        },
        runLimits: {
          maxRuntimeMs: 60000,
          maxDiscoveryCalls: 5,
          maxSourceCalls: 5,
          maxTokens: 1000,
          maxCostUsd: 0.1,
        },
        retry: { maxRetries: 1, baseBackoffMs: 100, maxBackoffMs: 1000 },
        notificationCooldownMs: 60000,
        criticalMinRelevance: 0.9,
      },
      enabled: true,
      frequency: 'DAILY',
      inFlight: false,
      cancelRequested: false,
      consecutiveFailures: 0,
    });
    a.runs.save({
      runId: 'run-1',
      userId: 'u1',
      jobCategory: 'PROVIDER_MODEL_DISCOVERY',
      manual: false,
      status: 'COMPLETED',
      startedAt: now,
      changeSummary: {
        ranAt: now,
        meaningful: true,
        counts: { NO_CHANGE: 0, NEW: 1, UPDATED: 0, REMOVED: 0, CRITICAL_CHANGE: 0 },
        entries: [],
      },
      notifications: { emitted: 1, deduplicated: 0, skipped: 0 },
      budget: {
        spentTokens: 10,
        spentCostUsd: 0,
        spentLatencyMs: 5,
        discoveryCalls: 1,
        sourceCalls: 1,
        exceeded: false,
      },
      sourceReports: [],
    });
    a.sourcePolicies.save({
      sourceId: 'static-catalog',
      enabled: true,
      consecutiveFailures: 0,
      callsConsumed: 1,
      rateLimitWindowStartedAtMs: 0,
      maxCallsPerWindow: 10,
      rateLimitWindowMs: 60000,
      budgetConsumedUsd: 0,
    });
    a.cooldowns.save({ userId: 'u1', key: 'item-1', lastNotifiedAt: now, nextEligibleAtMs: 1000 });

    a.tasks.save({
      id: 'task-1',
      userId: 'u1',
      objective: 'o',
      originalInput: 'i',
      intent: {},
      mode: 'AUTONOMOUS',
      domain: 'd',
      qualityTarget: 'good',
      privacyRequirement: 'private',
      budget: { maxTokens: 1000, maxCostUsd: 0.1, maxIterations: 5, maxLatencyMs: 60000 },
      requiredCapabilities: [],
      roleAssignments: [],
      graph: { nodes: [], edges: [] },
      status: 'PLANNING',
      stage: 'UNDERSTAND',
      stageStatuses: {},
      providerOutputs: [],
      conflicts: [],
      failoverEvents: [],
      decisionRecords: [],
      approvalRequired: [],
      approvalGranted: [],
      traceId: 't',
      createdAt: now,
      updatedAt: now,
    } as never);
    a.decisions.save({
      id: 'dec-1',
      taskId: 'task-1',
      userId: 'u1',
      decision: 'select',
      reason: 'r',
      alternatives: [],
      selected: 'p1',
      evidence: [],
      confidence: 0.9,
      constraints: [],
      qualityEstimate: 0.9,
      createdAt: now,
      provenance: 'test',
    } as never);
    a.opportunities.save({
      id: 'opp-1',
      userId: 'u1',
      category: 'AUTOMATION',
      title: 't',
      description: 'd',
      evidence: [],
      uncertainty: 0.3,
      source: 'ai-world-discovery',
      createdAt: now,
    } as never);
    a.events.save({
      id: 'evt-1',
      userId: 'u1',
      kind: 'NEW_MODEL',
      title: 't',
      description: 'd',
      relevance: 0.8,
      security: 'TRUSTED',
      evidence: [],
      adoptionRequired: [],
      source: 'ai-world',
      createdAt: now,
    } as never);
    await a.outcomeMemory.recordOutcome({
      userId: 'u1',
      taskId: 'task-1',
      taskType: 'coding',
      providers: [
        { providerId: 'p1', capability: 'reasoning', role: 'PRIMARY_REASONER', succeeded: true },
      ],
      selectedReason: [],
      outcome: 'SUCCESS',
      userAccepted: true,
      capturedAt: now,
    } as never);
    await a.adaptiveScores.recordPerformance({
      providerId: 'p1',
      capability: 'reasoning',
      succeeded: true,
      explicit: true,
      at: now,
    });

    a.connections.save({
      userId: 'u1',
      state: 'CONNECTED',
      accountLogin: 'alice',
      grantedScopes: ['public_metadata'],
      authorizedScopes: ['public_metadata'],
      connectedAt: now,
    } as never);
    a.lifecycle.save('u1', {
      resourceId: 'res-1',
      resourceKind: 'provider',
      state: 'VERIFIED',
      evidence: [],
      history: [],
      updatedAt: now,
    } as never);
    a.recommendations.save('u1', {
      id: 'rec-1',
      kind: 'better-provider',
      title: 't',
      state: 'PENDING',
      createdAt: now,
    });
    a.notifications.save('u1', {
      id: 'notif-1',
      kind: 'BETTER_MODEL',
      title: 't',
      body: 'b',
      relevance: 0.9,
      createdAt: now,
    } as never);
    a.notifications.markRead('u1', 'notif-1');
    a.acquisitions.save('u1', { repository: 'Owner/Repo', state: 'DISCOVERED', updatedAt: now });

    a.loops.save({
      loopId: 'loop-1',
      userId: 'u1',
      objective: 'o',
      status: 'COMPLETED',
      stage: 'EVALUATE',
      stageStatuses: {},
      capabilities: [],
      candidates: [],
      comparisons: [],
      recommendations: [],
      approvals: [],
      performance: [],
      notifications: [],
      traceId: 't',
      createdAt: now,
      updatedAt: now,
    } as never);

    await a.discovery.addItems([
      {
        id: 'item-1',
        category: 'model',
        title: 't',
        description: 'd',
        provider: 'p',
        url: 'https://example.com',
        evidence: [],
        discoveredAt: now,
      } as never,
    ]);
    await a.discovery.markRead('u1', 'item-1');

    await Promise.all([
      a.schedules.flush(),
      a.jobs.flush(),
      a.runs.flush(),
      a.sourcePolicies.flush(),
      a.cooldowns.flush(),
      a.tasks.flush(),
      a.decisions.flush(),
      a.opportunities.flush(),
      a.events.flush(),
      a.outcomeMemory.flush(),
      a.adaptiveScores.flush(),
      a.connections.flush(),
      a.lifecycle.flush(),
      a.recommendations.flush(),
      a.notifications.flush(),
      a.acquisitions.flush(),
      a.loops.flush(),
    ]);

    // ── "Restart": brand-new store instances over the SAME database ─────
    const b = {
      schedules: new p.scheduler.PostgresScheduleStore(sql),
      jobs: new p.scheduler.PostgresJobStore(sql),
      runs: new p.scheduler.PostgresRunStore(sql),
      sourcePolicies: new p.scheduler.PostgresSourcePolicyStore(sql),
      cooldowns: new p.scheduler.PostgresCooldownStore(sql),
      tasks: new p.brain.PostgresBrainTaskStore(sql),
      decisions: new p.brain.PostgresBrainDecisionStore(sql),
      opportunities: new p.brain.PostgresOpportunityStore(sql),
      events: new p.brain.PostgresIntelligenceEventStore(sql),
      outcomeMemory: new p.brain.PostgresOutcomeMemory(sql),
      adaptiveScores: new p.brain.PostgresAdaptiveScoreLedger(sql),
      connections: new p.ecosystem.PostgresGitHubConnectionStore(sql),
      lifecycle: new p.ecosystem.PostgresLifecycleStore(sql),
      recommendations: new p.ecosystem.PostgresRecommendationStore(sql),
      notifications: new p.ecosystem.PostgresNotificationStore(sql),
      acquisitions: new p.ecosystem.PostgresAcquisitionStore(sql),
      loops: new p.bridge.PostgresBridgeLoopStore(sql),
      discovery: new p.aiWorld.PostgresDiscoveryStore(sql),
    };
    await Promise.all([
      b.schedules.hydrate(),
      b.jobs.hydrate(),
      b.runs.hydrate(),
      b.sourcePolicies.hydrate(),
      b.cooldowns.hydrate(),
      b.tasks.hydrate(),
      b.decisions.hydrate(),
      b.opportunities.hydrate(),
      b.events.hydrate(),
      b.outcomeMemory.hydrate(),
      b.adaptiveScores.hydrate(),
      b.connections.hydrate(),
      b.lifecycle.hydrate(),
      b.recommendations.hydrate(),
      b.notifications.hydrate(),
      b.acquisitions.hydrate(),
      b.loops.hydrate(),
      b.discovery.hydrate(),
    ]);

    // ── Assertions: state survived, no duplicates, owner isolation ──────
    expect(b.schedules.get('u1', 'PROVIDER_MODEL_DISCOVERY')?.enabled).toBe(true);
    expect(b.schedules.list('u1')).toHaveLength(1);
    expect(b.jobs.get('u1', 'PROVIDER_MODEL_DISCOVERY')?.enabled).toBe(true);
    expect(b.runs.list('u1')).toHaveLength(1); // no duplicate after restart
    expect(b.runs.get('u1', 'run-1')?.status).toBe('COMPLETED');
    expect(b.sourcePolicies.get('static-catalog')?.callsConsumed).toBe(1);
    expect(b.cooldowns.get('u1', 'item-1')?.nextEligibleAtMs).toBe(1000);

    expect(b.tasks.get('u1', 'task-1')?.objective).toBe('o');
    expect(b.tasks.get('u2', 'task-1')).toBeUndefined(); // IDOR
    expect(b.decisions.get('u1', 'task-1')).toHaveLength(1);
    expect(b.opportunities.list('u1')).toHaveLength(1);
    expect(b.events.list('u1')).toHaveLength(1);
    expect(b.outcomeMemory.list('u1')).toHaveLength(1); // learning survived
    expect(b.outcomeMemory.list('u1')[0]?.outcome).toBe('SUCCESS');
    expect(b.adaptiveScores.scoresFor('reasoning')[0]?.providerId).toBe('p1');

    expect(b.connections.get('u1')?.accountLogin).toBe('alice');
    expect(b.lifecycle.get('u1', 'res-1')?.state).toBe('VERIFIED');
    expect(b.recommendations.get('u1', 'rec-1')?.state).toBe('PENDING');
    expect(b.notifications.list('u1')).toHaveLength(1);
    expect(b.notifications.list('u1')[0]?.read).toBe(true); // read state survived
    expect(b.acquisitions.get('u1', 'owner/repo')?.state).toBe('DISCOVERED');
    expect(b.acquisitions.get('u2', 'owner/repo')).toBeUndefined(); // IDOR

    expect(b.loops.list('u1')).toHaveLength(1);
    expect(b.loops.get('u1', 'loop-1')?.status).toBe('COMPLETED');

    expect((await b.discovery.listItems()).map((i) => (i as { id: string }).id)).toEqual([
      'item-1',
    ]);
    expect((await b.discovery.getUserState('u1', 'item-1')).read).toBe(true);
    expect((await b.discovery.getUserState('u2', 'item-1')).read).toBe(false); // owner isolation

    await cleanTables();
    await sql.end();
  }, 120_000);
});
