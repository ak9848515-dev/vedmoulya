// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S7.0 · External opportunity acquisition foundation
//
// Proves the acquisition boundary end to end over the REAL canonical machinery:
// the real normalizer, the real OpportunityLifecycle/stable-key dedup, the real
// owner-scoped control router. No second model, store or lifecycle is involved.
//
//   EXTERNAL SOURCE → NORMALIZE → SECURITY GATE → DEDUP → CANONICAL → DISCOVERED
//
// Coverage: source contract, provenance, deduplication, owner isolation,
// security, lifecycle, and the S7.0 created/existing acquisition report.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ActiveIntelligenceControlPlane, InMemoryControlStores } from '@vedmoulya/control-plane';
import type { OpportunityLifecycleRecord } from '@vedmoulya/control-plane';
import { createControlRouter } from '../routers/ControlRouter.js';
import { createOpportunityApprovalPort } from '../infrastructure/OpportunityApprovalPorts.js';
import { createMissionLaunchPort } from '../infrastructure/OpportunityMissionPorts.js';
import { createOpportunityQualifier } from '../services/OpportunityQualification.js';
import { normalizeExternalOpportunity } from '../services/OpportunitySourceAdapter.js';
import { BrainApplicationService } from '@vedmoulya/brain';
import {
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
  InMemoryOpportunityStore,
} from '@vedmoulya/brain';

const OWNER = 'owner-a';
const OTHER = 'owner-b';
const NOW = '2026-10-06T09:00:00.000Z';

const POSTING = {
  source: 'manual-import',
  sourceReference: 'https://board.example/jobs/42',
  title: 'Build a TypeScript SDK',
  description: 'Client needs a typed SDK for their public API.',
  url: 'https://board.example/jobs/42',
  requirements: ['typescript', 'api design'],
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

function harness() {
  const brain = createBrain();
  const stores = new InMemoryControlStores();
  const plane = new ActiveIntelligenceControlPlane({
    brain: { listTasksWithApprovals: () => [], outcomeCount: () => 0 },
    proactive: { refresh: async () => ({ success: true }), listRecommendations: () => [] },
    fabric: {} as never,
    stores,
    now: () => NOW,
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
  });
  const ctx = { userId: OWNER } as never;
  return {
    router,
    plane,
    ctx,
    otherCtx: { userId: OTHER } as never,
    missionsLaunched: () => launched,
  };
}

/** Import ONE posting through the real acquisition entry point. */
async function ingest(
  h: ReturnType<typeof harness>,
  opportunity: unknown,
  ctx: never = h.ctx as never,
) {
  return h.router.importOpportunity({ userId: OWNER, opportunity }, ctx);
}

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.0 — source contract (normalization + security gate)', () => {
  it('1. a valid external opportunity normalizes into the canonical contract', async () => {
    const h = harness();
    const r = await ingest(h, POSTING);
    expect(r.success).toBe(true);
    const record = r.data as OpportunityLifecycleRecord;
    expect(record.title).toBe('Build a TypeScript SDK');
    expect(record.stableKey).toBe('owner-a:manual-import:https://board.example/jobs/42');
  });

  it('2. missing source identity fails closed', async () => {
    const h = harness();
    const r = await ingest(h, { title: 'No source', description: 'x' });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.details?.opportunityCode).toBe('SOURCE_REFERENCE_REQUIRED');
  });

  it('2b. a missing title OR description fails closed', () => {
    const noTitle = normalizeExternalOpportunity({
      source: 'manual-import',
      sourceReference: 'ref-1',
      description: 'x',
    });
    expect(noTitle.success).toBe(false);
    if (noTitle.success) return;
    expect(noTitle.code).toBe('TITLE_REQUIRED');
    const noDescription = normalizeExternalOpportunity({
      source: 'manual-import',
      sourceReference: 'ref-1',
      title: 'x',
    });
    expect(noDescription.success).toBe(false);
    if (noDescription.success) return;
    expect(noDescription.code).toBe('DESCRIPTION_REQUIRED');
  });

  it('3/4. an invalid or non-http(s) URL is rejected', () => {
    for (const url of ['ftp://x.example/a', 'javascript:alert(1)', 'not-a-url']) {
      const r = normalizeExternalOpportunity({ ...POSTING, url });
      expect(r.success).toBe(false);
      if (r.success) return;
      expect(r.code).toBe('MALFORMED_SOURCE_URL');
    }
  });

  it('5. an oversized URL (> 2048) is rejected', () => {
    const r = normalizeExternalOpportunity({
      ...POSTING,
      url: `https://example.com/${'a'.repeat(2100)}`,
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.code).toBe('MALFORMED_SOURCE_URL');
  });

  it('6. control characters are stripped in the retained fields, never preserved', () => {
    const r = normalizeExternalOpportunity({
      ...POSTING,
      title: 'Build\u0000 a\u001f TypeScript SDK',
      description: 'Client\u0007 needs a\u0008 typed SDK.',
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.title).toBe('Build a TypeScript SDK');
    expect(r.data.title).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
  });

  it('6b. a malformed source identifier (non-identifier characters) fails closed', () => {
    const r = normalizeExternalOpportunity({
      source: 'manual import!',
      sourceReference: 'ref-1',
      title: 'x',
      description: 'y',
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.code).toBe('MALFORMED_SOURCE_INPUT');
  });

  it('6c. a non-object payload fails closed', () => {
    expect(normalizeExternalOpportunity('nope').success).toBe(false);
    expect(normalizeExternalOpportunity(null).success).toBe(false);
    expect(normalizeExternalOpportunity(['a']).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.0 — provenance', () => {
  it('7/8/10. source, sourceReference and the discovery timestamp are retained', async () => {
    const h = harness();
    const r = await ingest(h, POSTING);
    const record = r.data as OpportunityLifecycleRecord;
    expect(record.sourceRef).toEqual({
      source: 'manual-import',
      sourceReference: 'https://board.example/jobs/42',
    });
    // The canonical discovery timestamp is recorded.
    expect(record.createdAt).toBe(NOW);
    // Provenance is also carried as canonical evidence.
    expect(record.evidence.some((e) => /Discovered via manual-import/.test(e.label))).toBe(true);
  });

  it('9. the source URL is retained as provenance only', () => {
    const r = normalizeExternalOpportunity(POSTING);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.url).toBe('https://board.example/jobs/42');
  });

  it('9b. no raw source payload or credential is stored on the record', async () => {
    const h = harness();
    const r = await ingest(h, POSTING);
    const serialized = JSON.stringify(r.data);
    expect(serialized).not.toMatch(/cookie|authorization|bearer|api[_-]?key|cookie|token/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.0 — deduplication', () => {
  it('11/12. the same owner + source + reference is idempotent (returns the SAME opportunity)', async () => {
    const h = harness();
    const first = await ingest(h, POSTING);
    const second = await ingest(h, POSTING);
    const a = first.data as OpportunityLifecycleRecord & { created: boolean };
    const b = second.data as OpportunityLifecycleRecord & { created: boolean };
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.id).toBe(a.id);
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(1);
  });

  it('13. a rediscovery does NOT reset lifecycle state', async () => {
    const h = harness();
    const first = await ingest(h, POSTING);
    const id = (first.data as OpportunityLifecycleRecord).id;
    // Move the record past DISCOVERED through the canonical transition.
    const moved = await h.router.transitionOpportunity(
      { userId: OWNER, id, to: 'ASSESSED', note: 'walk' },
      h.ctx,
    );
    expect(moved.success).toBe(true);

    // Rediscovering the SAME posting must not reset it back to DISCOVERED.
    const again = await ingest(h, POSTING);
    expect(again.success).toBe(true);
    expect((again.data as OpportunityLifecycleRecord & { created: boolean }).created).toBe(false);
    expect(h.plane.listOpportunities(OWNER).find((o) => o.id === id)?.status).toBe('ASSESSED');
  });

  it('14. a different sourceReference creates an independent opportunity', async () => {
    const h = harness();
    await ingest(h, POSTING);
    const other = await ingest(h, { ...POSTING, sourceReference: 'https://board.example/jobs/43' });
    const rec = other.data as OpportunityLifecycleRecord & { created: boolean };
    expect(rec.created).toBe(true);
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(2);
  });

  it('15. different owners remain isolated (same posting → separate owner-scoped records)', async () => {
    const h = harness();
    const mine = await ingest(h, POSTING, h.ctx as never);
    const theirs = await h.router.importOpportunity(
      { userId: OTHER, opportunity: POSTING },
      h.otherCtx,
    );
    const a = mine.data as OpportunityLifecycleRecord;
    const b = theirs.data as OpportunityLifecycleRecord;
    expect(a.id).not.toBe(b.id);
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(1);
    expect(h.plane.listOpportunities(OTHER)).toHaveLength(1);
    // Cross-owner reads fail closed.
    expect(h.plane.listOpportunities(OTHER).find((o) => o.id === a.id)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.0 — security', () => {
  it('16. a browser-supplied userId cannot override the session owner (boundary)', async () => {
    const h = harness();
    // The public boundary (RouterRegistry) spreads `userId: ctx.userId` AFTER
    // the client input, so the session identity always wins. Assert that the
    // mapping is structurally session-authoritative AND that the canonical
    // layer attributes the import to whichever owner it is given.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../services/RouterRegistry.ts', import.meta.url), 'utf8'),
    );
    const block = src.slice(src.indexOf('importOpportunity: standardProcedure'));
    const handler = block.slice(0, block.indexOf('}),'));
    // Session identity is applied LAST — it overrides any client-supplied value.
    expect(handler).toMatch(/\.\.\.\(input as Record<string, unknown>\), userId: ctx\.userId/);

    // Behavioural proof: acquisition is attributed to the owner it is given,
    // and never leaks a record into a different owner's scope.
    const r = await h.router.importOpportunity(
      { userId: OTHER, opportunity: POSTING } as never,
      h.otherCtx,
    );
    expect(r.success).toBe(true);
    const record = r.data as OpportunityLifecycleRecord;
    expect(record.ownerId).toBe(OTHER);
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(0);
    expect(h.plane.listOpportunities(OTHER)).toHaveLength(1);
  });

  it('17. cross-user access fails closed', async () => {
    const h = harness();
    const mine = await ingest(h, POSTING);
    const id = (mine.data as OpportunityLifecycleRecord).id;
    const peek = await h.router.getValueIntelligence({ id, userId: OTHER }, h.otherCtx);
    expect(peek.success).toBe(false);
  });

  it('18. secret-like input is rejected, never cleaned and stored', async () => {
    const h = harness();
    const withSecret = await ingest(h, {
      ...POSTING,
      description: 'Contact us — Authorization: Bearer abcdef1234567890token',
    });
    expect(withSecret.success).toBe(false);
    if (withSecret.success) return;
    expect(withSecret.error.details?.opportunityCode).toBe('SECRET_REJECTED');
    // Nothing was persisted.
    expect(h.plane.listOpportunities(OWNER)).toHaveLength(0);
  });

  it('18b. an API key / token / cookie in any field is rejected', () => {
    const cases = [
      { title: 'api_key=sk-1234567890' },
      { description: 'session_token=abcdef123456' },
      { url: 'https://x.example/?cookie=abc' },
    ];
    for (const c of cases) {
      const r = normalizeExternalOpportunity({ ...POSTING, ...c });
      expect(r.success).toBe(false);
    }
  });

  it('19. the rejection error does not echo the secret material', async () => {
    const h = harness();
    const secret = 'Bearer supersecretvalue123456';
    const r = await ingest(h, { ...POSTING, description: `Authorization: ${secret}` });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(JSON.stringify(r.error)).not.toContain(secret);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.0 — lifecycle boundary', () => {
  it('20. an imported opportunity starts DISCOVERED', async () => {
    const h = harness();
    const r = await ingest(h, POSTING);
    expect((r.data as OpportunityLifecycleRecord).status).toBe('DISCOVERED');
  });

  it('21. import cannot create an APPROVED opportunity', async () => {
    const h = harness();
    const r = await ingest(h, { ...POSTING, status: 'APPROVED', approved: true });
    const record = r.data as OpportunityLifecycleRecord;
    expect(record.status).toBe('DISCOVERED');
    expect(record.approval).toBeUndefined();
  });

  it('22. import cannot launch a Mission', async () => {
    const h = harness();
    const r = await ingest(h, POSTING);
    const id = (r.data as OpportunityLifecycleRecord).id;
    expect(h.missionsLaunched()).toBe(0);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(0);
    // And a direct launch attempt is refused (not APPROVED).
    const launched = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(launched.success).toBe(false);
    expect(h.missionsLaunched()).toBe(0);
  });

  it('23. import cannot create commercial outcomes', async () => {
    const h = harness();
    const r = await ingest(h, POSTING);
    expect(r.success).toBe(true);
    // No commercial-outcome store is reachable from acquisition; the records
    // hold no invoice/payment reference.
    const record = r.data as OpportunityLifecycleRecord;
    expect(JSON.stringify(record)).not.toMatch(/invoiceId|paymentId|outcomeId/);
  });
});
