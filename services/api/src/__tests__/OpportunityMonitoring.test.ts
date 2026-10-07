// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S7.1 · External opportunity monitoring
//
// Proves the monitoring pass end to end over the REAL canonical machinery: the
// real normalizer, the real OpportunityLifecycle/stable-key dedup, the real
// owner-scoped control router and the real qualification. The ONLY double is the
// external source port (the network boundary), which is exactly where a fixture
// belongs.
//
//   EXTERNAL SOURCE → NORMALIZE → DEDUP → DISCOVERED → (existing) QUALIFY
//
// Coverage: discovery, normalization, source identity, deduplication, owner
// isolation, DISCOVERED-only lifecycle, boundedness, idempotency, the owner's
// category policy, and HONEST failure for every external-source failure mode.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ActiveIntelligenceControlPlane, InMemoryControlStores } from '@vedmoulya/control-plane';
import type { OpportunityLifecycleRecord } from '@vedmoulya/control-plane';
import {
  BrainApplicationService,
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
  InMemoryOpportunityStore,
} from '@vedmoulya/brain';
import { createOpportunityMonitor } from '../services/OpportunityMonitoring.js';
import {
  createOpportunityDiscoveryPort,
  type ExternalOpportunitySourcePort,
  type ExternalSourceFailure,
} from '../infrastructure/OpportunityMonitoringPorts.js';
import { createControlRouter } from '../routers/ControlRouter.js';
import { createOpportunityApprovalPort } from '../infrastructure/OpportunityApprovalPorts.js';
import { createMissionLaunchPort } from '../infrastructure/OpportunityMissionPorts.js';
import { createOpportunityQualifier } from '../services/OpportunityQualification.js';
import type { RawExternalOpportunity } from '../services/OpportunitySourceAdapter.js';

const OWNER = 'owner-a';
const OTHER = 'owner-b';
const NOW = '2026-10-07T09:00:00.000Z';

/** The shape the Freelancer adapter emits for one posting. */
const POSTING: RawExternalOpportunity = {
  source: 'freelancer',
  sourceReference: 'project:123456',
  title: 'Build a TypeScript reporting CLI',
  description: 'Client needs a recursive project reporting utility.',
  category: 'fixed',
  requirements: ['typescript', 'cli', 'node'],
  url: 'https://www.freelancer.com/projects/123456',
  estimatedValue: { label: '500-1000 USD (budget as stated by Freelancer)', status: 'ESTIMATED' },
  riskLevel: 'UNKNOWN',
  automationPotential: 'UNKNOWN',
};

function createBrain(): BrainApplicationService {
  return new BrainApplicationService({
    plan: async () => ({ steps: [], rationale: '' }),
    candidates: async () => [],
    execution: async () => ({ output: '', success: true }),
    context: { assemble: async () => 'context' },
    preference: { record: async () => {} },
    tasks: new InMemoryBrainTaskStore(),
    decisions: new InMemoryBrainDecisionStore(),
    clock: { now: () => NOW },
    budget: { maxTokens: 10_000, maxCostUsd: 1, maxIterations: 5, maxLatencyMs: 1000 },
    opportunities: new InMemoryOpportunityStore(),
  });
}

/** A source double at the NETWORK BOUNDARY only. */
function fixtureSource(
  candidates: RawExternalOpportunity[],
  failure?: ExternalSourceFailure,
): ExternalOpportunitySourcePort & { calls: number } {
  const port = {
    calls: 0,
    name: 'freelancer',
    status: {
      configured: failure?.code !== 'SOURCE_NOT_CONFIGURED',
      reason: failure === undefined ? 'fixture source is configured' : failure.message,
    },
    async fetchCandidates() {
      port.calls += 1;
      return failure !== undefined
        ? { success: false as const, ...failure }
        : { success: true as const, candidates };
    },
  };
  return port;
}

function harness(
  options: {
    candidates?: RawExternalOpportunity[];
    failure?: ExternalSourceFailure;
    sourceAbsent?: boolean;
    settings?: { allowedCategories?: string[]; prohibitedCategories?: string[] } | undefined;
    maxCandidatesPerPass?: number;
    cacheTtlMs?: number;
  } = {},
) {
  const brain = createBrain();
  const stores = new InMemoryControlStores();
  const plane = new ActiveIntelligenceControlPlane({
    brain: { listTasksWithApprovals: () => [], outcomeCount: () => 0 },
    proactive: { refresh: async () => ({ success: true }), listRecommendations: () => [] },
    fabric: {} as never,
    stores,
    now: () => NOW,
  });
  const source =
    options.sourceAbsent === true
      ? undefined
      : fixtureSource(options.candidates ?? [POSTING], options.failure);
  const monitor = createOpportunityMonitor({
    ...(source !== undefined ? { source } : {}),
    discovery: createOpportunityDiscoveryPort(plane),
    settings: () => options.settings,
    now: () => NOW,
    ...(options.maxCandidatesPerPass !== undefined
      ? { maxCandidatesPerPass: options.maxCandidatesPerPass }
      : {}),
    // Tests drive candidate changes between passes; the cache is exercised in
    // its own case.
    cacheTtlMs: options.cacheTtlMs ?? 0,
  });
  let launched = 0;
  const router = createControlRouter(plane, {
    approval: createOpportunityApprovalPort(brain),
    qualify: createOpportunityQualifier({ brain, now: () => NOW }).qualify,
    mission: createMissionLaunchPort({
      createAndRun: async () => {
        launched += 1;
        return { missionId: 'm-1' };
      },
    }),
    monitor,
  });
  return {
    monitor,
    router,
    plane,
    source,
    ctx: { userId: OWNER } as never,
    missionsLaunched: () => launched,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.1 — discovery + normalization + source identity', () => {
  it('1. an external candidate is discovered as a canonical DISCOVERED opportunity', async () => {
    const h = harness();
    const result = await h.monitor.monitor(OWNER);
    expect(result.failure).toBeUndefined();
    expect(result.candidatesFetched).toBe(1);
    expect(result.normalized).toBe(1);
    expect(result.created).toBe(1);
    expect(result.existing).toBe(0);
    const records = h.plane.listOpportunities(OWNER);
    expect(records).toHaveLength(1);
    expect(records[0]?.status).toBe('DISCOVERED');
  });

  it('2. source identity (source + sourceReference) is preserved on the record', async () => {
    const h = harness();
    await h.monitor.monitor(OWNER);
    const record = h.plane.listOpportunities(OWNER)[0] as OpportunityLifecycleRecord;
    expect(record.sourceRef).toEqual({ source: 'freelancer', sourceReference: 'project:123456' });
    // The stable key is the canonical owner + source + reference discriminator.
    expect(record.stableKey).toBe('owner-a:freelancer:project:123456');
    // The source URL survives as provenance evidence (the record has no URL field).
    expect(
      record.evidence.some((e) => e.label.includes('https://www.freelancer.com/projects/123456')),
    ).toBe(true);
  });

  it('3. stated capabilities become the canonical requiredCapabilities (qualification input)', async () => {
    const h = harness();
    await h.monitor.monitor(OWNER);
    const record = h.plane.listOpportunities(OWNER)[0] as OpportunityLifecycleRecord;
    expect(record.requiredCapabilities).toEqual(['typescript', 'cli', 'node']);
    // The source's stated budget is carried as a LABEL with its evidence status.
    expect(record.estimatedValue?.status).toBe('ESTIMATED');
  });

  it('4. a candidate refused by the EXISTING normalizer is counted, never stored', async () => {
    const h = harness({
      candidates: [
        POSTING,
        // A credential in the payload is a HARD REJECT by the existing gate.
        {
          ...POSTING,
          sourceReference: 'project:9',
          description: 'Authorization: Bearer abcdef1234567890',
        },
      ],
    });
    const result = await h.monitor.monitor(OWNER);
    expect(result.rejected).toBe(1);
    expect(result.created).toBe(1);
    expect(result.rejectedSample[0]?.code).toBe('SECRET_REJECTED');
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.1 — deduplication + repeated monitoring (idempotency)', () => {
  it('5/6. repeated polling creates NO duplicate and does not reset lifecycle state', async () => {
    const h = harness();
    const first = await h.monitor.monitor(OWNER);
    expect(first.created).toBe(1);

    // Move the record forward through the EXISTING canonical qualifier.
    const id = (h.plane.listOpportunities(OWNER)[0] as OpportunityLifecycleRecord).id;
    await h.router.qualifyOpportunity({ id, userId: OWNER }, h.ctx);
    expect(h.plane.listOpportunities(OWNER)[0]?.status).toBe('ASSESSED');

    const second = await h.monitor.monitor(OWNER);
    expect(second.created).toBe(0);
    expect(second.existing).toBe(1);
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(1);
    // A rediscovery can never reset a moved-on record.
    expect(h.plane.listOpportunities(OWNER)[0]?.status).toBe('ASSESSED');
  });

  it('7. a bounded source cache serves N owners from ONE upstream request', async () => {
    const h = harness({ cacheTtlMs: 60_000 });
    const first = await h.monitor.monitor(OWNER);
    const second = await h.monitor.monitor(OTHER);
    expect(first.usedCachedCandidates).toBe(false);
    expect(second.usedCachedCandidates).toBe(true);
    expect(h.source?.calls).toBe(1);
    // Idempotency is unaffected: the cached pass still resolves canonically.
    expect(second.created).toBe(1);
  });

  it('8. a different sourceReference stays a separate opportunity (no over-collapsing)', async () => {
    const h = harness();
    await h.monitor.monitor(OWNER);
    // The SAME source with a DIFFERENT source-native reference is a genuinely
    // different posting and must not collapse onto the first.
    h.plane.discoverOpportunityWithResult({
      ownerId: OWNER,
      title: 'Another freelance posting',
      description: 'A different job from the same marketplace.',
      category: 'fixed',
      evidence: [],
      riskLevel: 'UNKNOWN',
      automationPotential: 'UNKNOWN',
      sourceRef: { source: 'freelancer', sourceReference: 'project:999' },
    });
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(2);
    // A third poll of the SAME reference still adds nothing.
    await h.monitor.monitor(OWNER);
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.1 — owner isolation', () => {
  it('9. one owner’s monitored opportunity never becomes another owner’s', async () => {
    const h = harness();
    await h.monitor.monitor(OWNER);
    await h.monitor.monitor(OTHER);
    const mine = h.plane.listOpportunities(OWNER);
    const theirs = h.plane.listOpportunities(OTHER);
    expect(mine).toHaveLength(1);
    expect(theirs).toHaveLength(1);
    expect(mine[0]?.id).not.toBe(theirs[0]?.id);
    expect(mine[0]?.ownerId).toBe(OWNER);
    expect(theirs[0]?.ownerId).toBe(OTHER);
    // Cross-owner reads fail closed (owner-scoped store).
    expect(h.plane.listOpportunities(OTHER).find((o) => o.id === mine[0]?.id)).toBeUndefined();
  });

  it('10. the monitoring procedure attributes the pass to the SESSION owner', async () => {
    const h = harness();
    const result = await h.router.monitorOpportunities({ userId: OTHER }, h.ctx);
    expect(result.success).toBe(true);
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(0);
    expect(h.plane.listOpportunities(OTHER)).toHaveLength(1);
    expect(h.plane.listOpportunities(OTHER)[0]?.ownerId).toBe(OTHER);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.1 — owner category policy (the EXISTING settings shape)', () => {
  it('11. prohibited categories are skipped', async () => {
    const h = harness({ settings: { prohibitedCategories: ['typescript'] } });
    const result = await h.monitor.monitor(OWNER);
    expect(result.filtered).toBe(1);
    expect(result.created).toBe(0);
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(0);
  });

  it('12. a non-empty allow-list requires a match; an empty one allows everything', async () => {
    const blocked = harness({ settings: { allowedCategories: ['wordpress'] } });
    expect((await blocked.monitor.monitor(OWNER)).filtered).toBe(1);
    expect(blocked.plane.listOpportunities(OWNER)).toHaveLength(0);

    const allowed = harness({ settings: { allowedCategories: ['typescript'] } });
    expect((await allowed.monitor.monitor(OWNER)).created).toBe(1);

    const open = harness({ settings: {} });
    expect((await open.monitor.monitor(OWNER)).created).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.1 — honest external-source failure (nothing fabricated, nothing ingested)', () => {
  const failureCases: ExternalSourceFailure[] = [
    { code: 'SOURCE_AUTH_FAILED', message: 'credential refused', status: 401 },
    { code: 'SOURCE_RATE_LIMITED', message: 'rate limited', status: 429 },
    { code: 'SOURCE_TIMEOUT', message: 'timed out' },
    { code: 'SOURCE_UNAVAILABLE', message: 'unreachable', status: 502 },
    { code: 'MALFORMED_SOURCE_RESPONSE', message: 'bad envelope' },
    { code: 'UNSUPPORTED_SOURCE_CAPABILITY', message: 'not offered', status: 404 },
  ];

  it('13. every source failure is reported and ingests NOTHING', async () => {
    for (const failure of failureCases) {
      const h = harness({ failure });
      const result = await h.monitor.monitor(OWNER);
      expect(result.failure?.code).toBe(failure.code);
      expect(result.candidatesFetched).toBe(0);
      expect(result.normalized).toBe(0);
      expect(result.created).toBe(0);
      expect(result.createdIds).toEqual([]);
      expect(h.plane.listOpportunities(OWNER)).toHaveLength(0);
    }
  });

  it('14. a failure is surfaced as a FAILURE envelope, never a successful empty pass', async () => {
    const h = harness({
      failure: { code: 'SOURCE_RATE_LIMITED', message: 'slow down', status: 429 },
    });
    const response = await h.router.monitorOpportunities({ userId: OWNER }, h.ctx);
    expect(response.success).toBe(false);
    if (response.success) return;
    // The specific, honest reason is preserved (S7.0 discipline).
    expect(response.error.details?.opportunityCode).toBe('SOURCE_RATE_LIMITED');
    expect(response.error.statusCode).toBe(429);
    // The full pass outcome is preserved so nothing is hidden.
    expect((response.error.details?.monitoring as { created: number }).created).toBe(0);
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(0);
  });

  it('15. an unconfigured source is reported, and no owner is polluted', async () => {
    const h = harness({ sourceAbsent: true });
    const result = await h.monitor.monitor(OWNER);
    expect(result.sourceConfigured).toBe(false);
    expect(result.failure?.code).toBe('SOURCE_NOT_CONFIGURED');
    expect(result.created).toBe(0);
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(0);
    const response = await h.router.monitorOpportunities({ userId: OWNER }, h.ctx);
    expect(response.success).toBe(false);
  });

  it('16. a source that THROWS is still an honest failure, never a crash and never success', async () => {
    const h = harness({ sourceAbsent: true });
    const throwing = createOpportunityMonitor({
      source: {
        name: 'throwing',
        status: { configured: true, reason: 'fixture' },
        fetchCandidates: async () => {
          throw new Error('socket hang up');
        },
      } as unknown as ExternalOpportunitySourcePort,
      discovery: createOpportunityDiscoveryPort(h.plane),
      now: () => NOW,
    });
    const result = await throwing.monitor(OWNER);
    expect(result.failure?.code).toBe('SOURCE_REQUEST_FAILED');
    expect(result.created).toBe(0);
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.1 — bounded, and DISCOVERED-only (no commitment)', () => {
  it('17. a pass stops at the candidate bound and says so', async () => {
    const many: RawExternalOpportunity[] = Array.from({ length: 5 }, (_, i) => ({
      ...POSTING,
      sourceReference: `project:${1000 + i}`,
    }));
    const h = harness({ candidates: many, maxCandidatesPerPass: 2 });
    const result = await h.monitor.monitor(OWNER);
    expect(result.truncated).toBe(true);
    expect(result.candidatesFetched).toBe(5);
    expect(result.normalized).toBe(2);
    expect(result.created).toBe(2);
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(2);
  });

  it('18. monitoring can only reach DISCOVERED — never APPROVED, never a Mission', async () => {
    const h = harness();
    const result = await h.monitor.monitor(OWNER);
    expect(result.created).toBe(1);
    const record = h.plane.listOpportunities(OWNER)[0] as OpportunityLifecycleRecord;
    expect(record.status).toBe('DISCOVERED');
    expect(record.approval).toBeUndefined();
    expect(record.execution).toBeUndefined();
    expect(h.missionsLaunched()).toBe(0);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(0);
    // And a direct launch attempt is refused (not APPROVED).
    const launched = await h.router.startMissionForOpportunity(
      { id: record.id, userId: OWNER },
      h.ctx,
    );
    expect(launched.success).toBe(false);
    expect(h.missionsLaunched()).toBe(0);
  });

  it('19. no credential, token or raw payload is stored on a monitored record', async () => {
    const h = harness();
    await h.monitor.monitor(OWNER);
    const serialized = JSON.stringify(h.plane.listOpportunities(OWNER));
    expect(serialized).not.toMatch(/cookie|authorization|bearer|api[_-]?key|client[_-]?secret/i);
  });

  it('20. monitoring integrates with the EXISTING qualification and value read', async () => {
    const h = harness();
    await h.monitor.monitor(OWNER);
    const id = (h.plane.listOpportunities(OWNER)[0] as OpportunityLifecycleRecord).id;
    // The EXISTING S6.4 read works on a monitored record (no second engine).
    const read = await h.router.getValueIntelligence({ id, userId: OWNER }, h.ctx);
    expect(read.success).toBe(true);
    const data = read.data as { assessment: { score: number }; approved: false };
    expect(typeof data.assessment.score).toBe('number');
    // Qualification is ADVISORY: the read never approves.
    expect(data.approved).toBe(false);
    expect(h.plane.listOpportunities(OWNER)[0]?.status).toBe('DISCOVERED');
  });
});
