// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: ExecutionRunService tests
// EPIC-014 — the 20 deterministic scenarios. No live services: the
// plan is a fixture, the port is a fake, the clock is manual.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  CapabilityCandidate,
  FactoryCapabilityPlan,
  PlanStep,
} from '@vedmoulya/capability-marketplace';
import { ExecutionRunService } from '../application/ExecutionRunService.js';
import type {
  ClockPort,
  ExecutionRunStore,
  PreferenceLedgerPort,
  StepExecutionInput,
  StepExecutionPort,
  StepExecutionResult,
} from '../contracts/execution-ports.js';
import { InMemoryExecutionRunStore } from '../infrastructure/InMemoryExecutionRunStore.js';
import { InMemoryPreferenceLedger } from '../infrastructure/InMemoryPreferenceLedger.js';
import { NodeArtifactReader } from '../infrastructure/NodeArtifactReader.js';

// ── Deterministic clock ───────────────────────────────────────────
class FakeClock implements ClockPort {
  private t = 1_700_000_000_000;
  now(): string {
    return new Date(this.t).toISOString();
  }
  timestampMs(): number {
    return this.t;
  }
  async sleep(): Promise<void> {}
}

// ── Deterministic execution port ──────────────────────────────────
class FakePort implements StepExecutionPort {
  calls: StepExecutionInput[] = [];
  private readonly results = new Map<string, StepExecutionResult>();
  private readonly failuresBeforeSuccess = new Map<string, number>();
  private readonly unavailable = new Set<string>();

  setResult(stepId: string, result: StepExecutionResult): void {
    this.results.set(stepId, result);
  }
  failTimes(stepId: string, times: number): void {
    this.failuresBeforeSuccess.set(stepId, times);
  }
  makeUnavailable(capability: string): void {
    this.unavailable.add(capability);
  }

  availability(capability: string): { available: boolean; reason?: string } {
    if (this.unavailable.has(capability)) {
      return { available: false, reason: `provider unavailable for ${capability}` };
    }
    return { available: true };
  }

  /** Optional hook (SPRINT-024 tests) — writes REAL artifacts after a call. */
  afterExecute?: (input: StepExecutionInput) => Promise<void>;

  async execute(input: StepExecutionInput): Promise<StepExecutionResult> {
    this.calls.push(input);
    if (this.unavailable.has(input.capability)) {
      return { ok: false, error: 'provider unavailable' };
    }
    const remaining = this.failuresBeforeSuccess.get(input.stepId) ?? 0;
    if (remaining > 0) {
      this.failuresBeforeSuccess.set(input.stepId, remaining - 1);
      return { ok: false, error: 'transient provider failure' };
    }
    if (this.afterExecute) await this.afterExecute(input);
    return (
      this.results.get(input.stepId) ?? {
        ok: true,
        content:
          'Produced deliverable for the step. This content is long enough to satisfy the output contract.',
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { input: 120, output: 420, total: 540 },
        costUsd: 0.001,
        latencyMs: 45,
      }
    );
  }
}

// ── Fixture plan builders ─────────────────────────────────────────
function candidate(overrides: Partial<CapabilityCandidate> = {}): CapabilityCandidate {
  return {
    id: 'provider:openai:gpt-4o',
    kind: 'model',
    name: 'OpenAI · GPT-4o',
    providerFamily: 'openai',
    modelId: 'gpt-4o',
    capability: 'TEXT_GENERATION',
    integrationType: 'NATIVE_API',
    classification: 'READY',
    freeAvailability: 'FREE_WITH_QUOTA',
    localAvailability: 'no',
    quality: 0.9,
    availability: 0.95,
    evidence: [
      { claim: 'supports text generation', source: 'provider-catalog', confidence: 'VERIFIED' },
    ],
    reasons: ['best quality'],
    configurable: false,
    apiAvailable: 'yes',
    ...overrides,
  };
}

function step(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    id: 'step-1',
    title: 'Research',
    capability: 'TEXT_GENERATION',
    purpose: 'Gather accurate background information.',
    candidates: [candidate()],
    selectedCandidateId: 'provider:openai:gpt-4o',
    automation: 'FULLY_AUTOMATED',
    irreversible: false,
    reasons: ['best quality'],
    ...overrides,
  };
}

let planCounter = 0;
function plan(steps: PlanStep[]): FactoryCapabilityPlan {
  planCounter += 1;
  return {
    id: `plan-${planCounter}`,
    requestedOutcome: 'Create a test deliverable',
    createdAt: '2026-08-10T00:00:00.000Z',
    requiredCapabilities: steps.map((s) => s.capability),
    candidates: steps.flatMap((s) => s.candidates),
    steps,
    automationLevel: 'FULLY_AUTOMATED',
    automationPercent: 100,
    evidence: [],
    risks: [],
    humanApprovalPoints: steps.filter((s) => s.irreversible),
    unavailableCapabilities: [],
    recommendations: [],
  };
}

// ── Test harness ──────────────────────────────────────────────────
interface Harness {
  service: ExecutionRunService;
  port: FakePort;
  store: ExecutionRunStore;
  ledger: PreferenceLedgerPort;
  planMap: Map<string, FactoryCapabilityPlan>;
}

function harness(
  p: FactoryCapabilityPlan,
  budget?: Partial<{
    maxTokens: number;
    maxCostUsd: number;
    maxIterations: number;
    maxLatencyMs: number;
  }>,
): Harness {
  const port = new FakePort();
  const store = new InMemoryExecutionRunStore();
  const ledger = new InMemoryPreferenceLedger();
  const planMap = new Map([[p.id, p]]);
  const service = new ExecutionRunService({
    planSource: {
      getPlan: async (ownerId, planId) => {
        const found = planMap.get(planId);
        return found && found.id === planId ? found : undefined;
      },
    },
    port,
    store,
    ledger,
    budget: {
      maxIterations: 3,
      maxTokens: 100_000,
      maxCostUsd: 1,
      maxLatencyMs: 60_000,
      ...budget,
    },
    clock: new FakeClock(),
    traceId: () => 'trace-test-1',
    maxRetries: 1,
  });
  return { service, port, store, ledger, planMap };
}

describe('EPIC-014 ExecutionRunService — PLAN → EXECUTE → VERIFY', () => {
  it('1. executes a valid executable plan to COMPLETED with verified steps', async () => {
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({ id: 's2', title: 'Script', purpose: 'Write the script.' }),
    ]);
    const { service } = harness(p);
    const result = await service.start('owner-a', p.id);

    expect(result.success).toBe(true);
    const run = result.data;
    expect(run?.status).toBe('COMPLETED');
    expect(run?.steps.map((s) => s.state)).toEqual(['completed', 'completed']);
    for (const s of run?.steps ?? []) {
      expect(s.verification?.post?.passed).toBe(true);
      expect(s.provider).toBe('openai');
      expect(s.output).toBeTruthy();
    }
    // Every completed step persisted a checkpoint boundary.
    expect(run?.checkpoints.length).toBeGreaterThanOrEqual(2);
  });

  it('2. mixed executable + manual plan → honest MANUAL_REQUIRED, no false execution', async () => {
    const manual = candidate({
      id: 'external:canva',
      kind: 'application',
      name: 'Canva',
      integrationType: 'EXTERNAL_APPLICATION',
      classification: 'EXTERNAL',
      apiAvailable: 'no',
    });
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({
        id: 's2',
        title: 'Design visuals',
        purpose: 'Design visuals in Canva.',
        candidates: [manual],
        selectedCandidateId: 'external:canva',
        automation: 'MANUAL',
      }),
    ]);
    const { service, port } = harness(p);
    const result = await service.start('owner-a', p.id);

    expect(result.data?.status).toBe('MANUAL_REQUIRED');
    expect(result.data?.steps[0]?.state).toBe('completed');
    expect(result.data?.steps[1]?.state).toBe('manual_required');
    // Manual/external step was NEVER executed by the port.
    expect(port.calls.map((c) => c.stepId)).not.toContain('s2');
    // No false COMPLETED.
    expect(result.data?.status).not.toBe('COMPLETED');
    const handoff = result.data?.handoffs.find((h) => h.stepId === 's2');
    expect(handoff?.kind).toBe('EXTERNAL');
    expect(handoff?.what).toContain('cannot execute it');
    expect(handoff?.action).toContain('mark it done');
  });

  it('3. CONFIGURE step pauses with a deep-link and is not executed', async () => {
    const cfg = candidate({
      id: 'provider:claude:sonnet',
      name: 'Anthropic · Claude Sonnet',
      providerFamily: 'anthropic',
      modelId: 'claude-sonnet',
      classification: 'CONFIGURE',
      configurable: true,
      suggestedFamily: 'anthropic',
    });
    const p = plan([
      step({
        id: 's1',
        capability: 'REASONING',
        title: 'Analyze',
        candidates: [cfg],
        selectedCandidateId: 'provider:claude:sonnet',
        automation: 'PARTIALLY_AUTOMATED',
      }),
    ]);
    const { service, port } = harness(p);
    const result = await service.start('owner-a', p.id);

    expect(result.data?.status).toBe('CONFIGURE_REQUIRED');
    expect(result.data?.steps[0]?.state).toBe('configure_required');
    expect(port.calls.length).toBe(0);
    expect(result.data?.handoffs[0]?.deepLink).toBe('/providers');
  });

  it('4. approval-required step gates → WAITING_FOR_APPROVAL; approve resumes to completion', async () => {
    const publish = step({
      id: 's2',
      title: 'Publish',
      purpose: 'Publish the content publicly to the platform.',
      irreversible: true,
    });
    const p = plan([step({ id: 's1', title: 'Research' }), publish]);
    const { service, port } = harness(p);
    const started = await service.start('owner-a', p.id);

    expect(started.data?.status).toBe('WAITING_FOR_APPROVAL');
    expect(started.data?.steps[1]?.state).toBe('waiting_approval');
    // The gated step never executed before approval.
    expect(port.calls.map((c) => c.stepId)).not.toContain('s2');
    expect(started.data?.handoffs[0]?.why).toContain('irreversible');

    const approved = await service.approve('owner-a', started.data?.executionId ?? '', 's2');
    expect(approved.data?.status).toBe('COMPLETED');
    expect(approved.data?.steps[1]?.state).toBe('completed');
    expect(approved.data?.steps[1]?.disposition).toBe('EXECUTABLE');
  });

  it('5. approval rejection blocks the run and records an explicit rejection', async () => {
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({
        id: 's2',
        title: 'Deploy',
        purpose: 'Deploy the application to production.',
        irreversible: true,
      }),
    ]);
    const { service, ledger } = harness(p);
    const started = await service.start('owner-a', p.id);
    const rejected = await service.reject(
      'owner-a',
      started.data?.executionId ?? '',
      's2',
      'not ready',
    );

    expect(rejected.data?.status).toBe('BLOCKED');
    expect(rejected.data?.steps[1]?.state).toBe('blocked');
    expect(rejected.data?.steps[1]?.failureReason).toBe('Approval rejected by the user.');
    const events = ledger.list();
    expect(events.some((e) => e.source === 'explicit_user_rejection' && e.stepId === 's2')).toBe(
      true,
    );
    expect(events.find((e) => e.stepId === 's2')?.confidence).toBe(1);
  });

  it('6. budget rejection is fail-closed — nothing executes, run BLOCKED', async () => {
    const p = plan([step({ id: 's1', title: 'Research' })]);
    const { service, port } = harness(p, { maxTokens: 100 }); // any call would exceed
    const result = await service.start('owner-a', p.id);

    expect(result.data?.status).toBe('BLOCKED');
    expect(result.data?.budget.exceeded).toBe(true);
    expect(result.data?.budget.failureReason).toContain('BUDGET_EXCEEDED');
    expect(port.calls.length).toBe(0);
    expect(result.data?.steps[0]?.state).toBe('blocked');
  });

  it('7. provider failure after bounded retries → FAILED (never endless)', async () => {
    const p = plan([step({ id: 's1', title: 'Research' })]);
    const { service, port } = harness(p);
    port.setResult('s1', { ok: false, error: 'provider 500' });
    const result = await service.start('owner-a', p.id);

    expect(result.data?.status).toBe('FAILED');
    expect(result.data?.steps[0]?.state).toBe('failed');
    expect(result.data?.steps[0]?.failureReason).toContain('provider 500');
    // maxRetries=1 → exactly 2 attempts, no endless retry.
    expect(port.calls.length).toBe(2);
    expect(result.data?.steps[0]?.attempts).toBe(2);
  });

  it('8. transient failure retries then succeeds (retried flag + honest provider)', async () => {
    const p = plan([step({ id: 's1', title: 'Research' })]);
    const { service, port } = harness(p);
    port.failTimes('s1', 1);
    const result = await service.start('owner-a', p.id);

    expect(result.data?.status).toBe('COMPLETED');
    expect(result.data?.steps[0]?.retried).toBe(true);
    expect(result.data?.steps[0]?.attempts).toBe(2);
    expect(result.data?.steps[0]?.verification?.post?.passed).toBe(true);
  });

  it('9. validation failure (bad output) → FAILED — a response alone is not success', async () => {
    const p = plan([step({ id: 's1', title: 'Research' })]);
    const h = harness(p);
    // Short garbage output fails the output contract.
    h.port.setResult('s1', { ok: true, content: 'x', provider: 'openai', model: 'gpt-4o' });
    const result = await h.service.start('owner-a', p.id);

    expect(result.data?.status).toBe('FAILED');
    expect(result.data?.steps[0]?.state).toBe('failed');
    expect(result.data?.steps[0]?.failureReason).toContain('validation failed');
  });

  it('10. unavailable capability → PARTIAL with honest skip (no false COMPLETED)', async () => {
    const vid = candidate({
      id: 'provider:video:veo',
      name: 'Video · Veo',
      providerFamily: 'video',
      modelId: 'veo',
      capability: 'VIDEO_GENERATION',
      integrationType: 'NATIVE_API',
    });
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({
        id: 's2',
        capability: 'VIDEO_GENERATION',
        title: 'Generate video',
        candidates: [vid],
        selectedCandidateId: 'provider:video:veo',
      }),
    ]);
    const { service, port } = harness(p);
    const result = await service.start('owner-a', p.id);

    expect(result.data?.status).toBe('PARTIAL');
    expect(result.data?.steps[0]?.state).toBe('completed');
    expect(result.data?.steps[1]?.state).toBe('skipped');
    expect(port.calls.map((c) => c.stepId)).not.toContain('s2');
    expect(result.data?.status).not.toBe('COMPLETED');
  });

  it('11. resume from checkpoint after approval executes the remaining steps', async () => {
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({ id: 's2', title: 'Publish', purpose: 'Publish the result.', irreversible: true }),
      step({ id: 's3', title: 'Wrap up', purpose: 'Final summary.' }),
    ]);
    const { service, port } = harness(p);
    const started = await service.start('owner-a', p.id);

    expect(started.data?.status).toBe('WAITING_FOR_APPROVAL');
    // Checkpoint captured the completed prefix.
    expect(started.data?.checkpoints[0]?.completedStepIds).toContain('s1');
    expect(port.calls.map((c) => c.stepId)).toEqual(['s1']);

    const resumed = await service.approve('owner-a', started.data?.executionId ?? '', 's2');
    expect(resumed.data?.status).toBe('COMPLETED');
    expect(port.calls.map((c) => c.stepId)).toEqual(['s1', 's2', 's3']);
    expect(resumed.data?.checkpoints.length).toBeGreaterThanOrEqual(3);
  });

  it('12. user-selected model is preserved in the binding and never silently replaced on failure', async () => {
    const chosen = candidate({
      id: 'provider:anthropic:opus',
      name: 'Anthropic · Opus',
      providerFamily: 'anthropic',
      modelId: 'opus-4',
    });
    const p = plan([
      step({
        id: 's1',
        capability: 'CODING',
        title: 'Write code',
        candidates: [chosen],
        selectedCandidateId: 'provider:anthropic:opus',
      }),
    ]);
    const { service, port } = harness(p);
    port.setResult('s1', { ok: false, error: 'provider failed' });

    const result = await service.start('owner-a', p.id);
    // The plan binding is preserved on the step.
    expect(result.data?.steps[0]?.provider).toBe('anthropic');
    expect(result.data?.steps[0]?.model).toBe('opus-4');
    // On failure we do NOT re-route to a different provider — same capability, bounded, FAILED.
    expect(result.data?.status).toBe('FAILED');
    expect(port.calls.every((c) => c.runtimeCapability === 'coding')).toBe(true);
    expect(port.calls.length).toBeLessThanOrEqual(2);
  });

  it('13. provider unavailable → blocked by pre-verification, zero calls', async () => {
    const p = plan([step({ id: 's1', title: 'Research' })]);
    const { service, port } = harness(p);
    port.makeUnavailable('TEXT_GENERATION');
    const result = await service.start('owner-a', p.id);

    expect(result.data?.status).toBe('BLOCKED');
    expect(result.data?.steps[0]?.state).toBe('blocked');
    expect(result.data?.steps[0]?.failureReason).toContain('unavailable');
    expect(port.calls.length).toBe(0);
  });

  it('14. dependency failure — downstream step never executes after an upstream failure', async () => {
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({ id: 's2', title: 'Script', purpose: 'Write the script.' }),
    ]);
    const { service, port } = harness(p);
    port.setResult('s1', { ok: false, error: 'boom' });
    const result = await service.start('owner-a', p.id);

    expect(result.data?.status).toBe('FAILED');
    expect(port.calls.map((c) => c.stepId)).not.toContain('s2');
  });

  it('15. preference ledger preserves provenance (explicit > inferred, confidence bounded)', async () => {
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({ id: 's2', title: 'Publish', purpose: 'Publish the result.', irreversible: true }),
    ]);
    const { service, ledger } = harness(p);
    const started = await service.start('owner-a', p.id);
    await service.approve('owner-a', started.data?.executionId ?? '', 's2');

    const events = ledger.list();
    const inferred = events.filter((e) => e.source === 'inferred_observation');
    const explicit = events.filter((e) => e.source === 'explicit_user_approval');

    expect(inferred.length).toBeGreaterThan(0);
    expect(explicit.length).toBeGreaterThan(0);
    // Inferred facts are capped below the explicit threshold.
    for (const e of inferred) expect(e.confidence).toBeLessThanOrEqual(0.5);
    for (const e of explicit) expect(e.confidence).toBe(1);
    // Every event carries provenance.
    for (const e of events) {
      expect(e.timestamp).toBeTruthy();
      expect(e.executionId).toBe(started.data?.executionId);
      expect(e.fact.length).toBeGreaterThan(0);
    }
  });

  it('16. IDOR — a foreign owner cannot read/approve/cancel/handoff another execution', async () => {
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({ id: 's2', title: 'Publish', purpose: 'Publish.', irreversible: true }),
    ]);
    const { service } = harness(p);
    const started = await service.start('owner-a', p.id);
    const execId = started.data?.executionId ?? '';

    expect(service.get('owner-b', execId).success).toBe(false);
    expect((await service.approve('owner-b', execId, 's2')).success).toBe(false);
    expect((await service.cancel('owner-b', execId)).success).toBe(false);
    expect((await service.completeHandoff('owner-b', execId, 's2')).success).toBe(false);
  });

  it('17. ownership isolation — list/ledger never leak another owner', async () => {
    const p = plan([step({ id: 's1', title: 'Research' })]);
    const { service, store } = harness(p);
    await service.start('owner-a', p.id);
    const p2 = plan([step({ id: 's1', title: 'Research' })]);
    const h2 = harness(p2);
    await h2.service.start('owner-b', p2.id);

    expect(service.list('owner-a').data?.every((r) => r.ownerId === 'owner-a')).toBe(true);
    expect(service.list('owner-a').data?.length).toBe(1);
    expect(store.list('owner-a').length).toBe(1);
    // Ledger events belong to runs owned by owner-a (the harness used for owner-b
    // has a separate store, so owner-a's ledger only sees its own run events).
    const events = service.preferenceLedger('owner-a').data as Array<{ executionId: string }>;
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.executionId.startsWith('exec-'))).toBe(true);
  });

  it('18. no false COMPLETED — a run with unmet manual/unavailable steps is never DONE', async () => {
    const manual = candidate({
      id: 'manual:storyboard',
      kind: 'manual',
      name: 'Manual action',
      integrationType: 'MANUAL_STEP',
      classification: 'MANUAL',
    });
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({
        id: 's2',
        capability: 'IMAGE_GENERATION',
        title: 'Storyboard',
        candidates: [manual],
        selectedCandidateId: 'manual:storyboard',
        automation: 'MANUAL',
      }),
    ]);
    const { service } = harness(p);
    const result = await service.start('owner-a', p.id);
    expect(result.data?.status).not.toBe('COMPLETED');
    expect(result.data?.status).toBe('MANUAL_REQUIRED');

    // After the user completes the manual hand-off the run may finish —
    // but the manual step is recorded as completed-by-user, never as executed.
    const done = await service.completeHandoff(
      'owner-a',
      result.data?.executionId ?? '',
      's2',
      'done in Canva',
    );
    expect(done.data?.status).toBe('COMPLETED');
    expect(done.data?.steps[1]?.output).toContain('Completed manually');
  });

  it('19. no silent provider replacement — failed provider never swapped mid-run', async () => {
    const p = plan([step({ id: 's1', title: 'Research' })]);
    const { service, port } = harness(p);
    port.setResult('s1', { ok: false, error: 'quota exhausted' });
    const result = await service.start('owner-a', p.id);

    expect(result.data?.status).toBe('FAILED');
    // The SAME port/capability was retried; nothing was re-routed elsewhere.
    expect(port.calls.every((c) => c.capability === 'TEXT_GENERATION')).toBe(true);
    expect(result.data?.steps[0]?.failureReason).toContain('quota exhausted');
  });

  it('21. completeHandoff twice is refused — a CONFIGURE hand-off can never re-execute a step', async () => {
    const cfg = candidate({
      id: 'provider:claude:sonnet',
      name: 'Anthropic · Claude Sonnet',
      providerFamily: 'anthropic',
      modelId: 'claude-sonnet',
      classification: 'CONFIGURE',
      configurable: true,
    });
    const p = plan([
      step({
        id: 's1',
        capability: 'REASONING',
        title: 'Analyze',
        candidates: [cfg],
        selectedCandidateId: 'provider:claude:sonnet',
        automation: 'PARTIALLY_AUTOMATED',
      }),
    ]);
    const { service, port } = harness(p);
    const started = await service.start('owner-a', p.id);
    const execId = started.data?.executionId ?? '';

    const first = await service.completeHandoff('owner-a', execId, 's1', 'configured the provider');
    expect(first.success).toBe(true);
    expect(first.data?.status).toBe('COMPLETED');
    expect(port.calls.length).toBe(1);

    // A second completion is refused — the step is never re-executed.
    const second = await service.completeHandoff('owner-a', execId, 's1', 'again');
    expect(second.success).toBe(false);
    expect(port.calls.length).toBe(1);
  });

  it('22. approval closes the hand-off — no stale approval actions on an executed step', async () => {
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({ id: 's2', title: 'Publish', purpose: 'Publish the result.', irreversible: true }),
    ]);
    const { service } = harness(p);
    const started = await service.start('owner-a', p.id);
    const approved = await service.approve('owner-a', started.data?.executionId ?? '', 's2');

    expect(approved.data?.status).toBe('COMPLETED');
    expect(approved.data?.handoffs.find((h) => h.stepId === 's2')?.completed).toBe(true);
  });

  it('23. iteration budget is preserved across an approval resume (no per-pass reset)', async () => {
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({ id: 's2', title: 'Publish', purpose: 'Publish the result.', irreversible: true }),
      step({ id: 's3', title: 'Wrap up', purpose: 'Final summary.' }),
      step({ id: 's4', title: 'Report', purpose: 'Write the report.' }),
    ]);
    const { service, port } = harness(p, { maxIterations: 3 });
    const started = await service.start('owner-a', p.id);
    expect(started.data?.status).toBe('WAITING_FOR_APPROVAL');

    const resumed = await service.approve('owner-a', started.data?.executionId ?? '', 's2');
    expect(resumed.data?.status).toBe('BLOCKED');
    expect(resumed.data?.budget.iterations).toBe(3);
    expect(resumed.data?.budget.failureReason).toContain('ITERATION_LIMIT');
    // s1 (pass 1) + s2 + s3 (pass 2) ran; s4 was blocked by the run-level limit.
    expect(port.calls.map((c) => c.stepId)).toEqual(['s1', 's2', 's3']);
  });

  it('24. SPRINT-024 — malformed REAL artifact contradicts the execution claim → step FAILED in the run service', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sprint024-runsvc-'));
    try {
      const p = plan([step({ id: 's1', title: 'Research' })]);
      const port = new FakePort();
      // The provider CLAIMS success (returns content) but the real artifact is malformed.
      port.afterExecute = async () => {
        await fs.mkdir(path.join(dir, 'out'), { recursive: true });
        await fs.writeFile(path.join(dir, 'out', 'report.json'), '{broken', 'utf8');
      };
      const service = new ExecutionRunService({
        planSource: { getPlan: async () => p },
        port,
        store: new InMemoryExecutionRunStore(),
        ledger: new InMemoryPreferenceLedger(),
        budget: { maxIterations: 3, maxTokens: 100_000, maxCostUsd: 1, maxLatencyMs: 60_000 },
        clock: new FakeClock(),
        traceId: () => 'trace-test-24',
        maxRetries: 1,
        artifactReader: new NodeArtifactReader(dir),
        artifactExpectations: () => [
          { checkId: 'json', type: 'JSON_VALID', path: 'out/report.json' },
        ],
      });
      const result = await service.start('owner-a', p.id);

      // Verification wins over the execution claim — the run must NOT complete.
      expect(result.data?.status).toBe('FAILED');
      expect(result.data?.steps[0]?.state).toBe('failed');
      // The failure reason cites the REAL artifact evidence (malformed JSON).
      expect(result.data?.steps[0]?.failureReason).toContain('Malformed JSON');
      // The recorded verification carries the failed artifact check.
      const names = result.data?.steps[0]?.verification?.post?.checks.map((c) => c.name) ?? [];
      expect(names.some((n) => n.startsWith('artifact:json'))).toBe(true);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('25. SPRINT-024 — valid REAL artifact + execution claim → step COMPLETED with artifact checks attached', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sprint024-runsvc-'));
    try {
      const p = plan([step({ id: 's1', title: 'Research' })]);
      const port = new FakePort();
      port.afterExecute = async () => {
        await fs.mkdir(path.join(dir, 'out'), { recursive: true });
        await fs.writeFile(path.join(dir, 'out', 'report.json'), '{"numbers":[1,2,3]}', 'utf8');
      };
      const service = new ExecutionRunService({
        planSource: { getPlan: async () => p },
        port,
        store: new InMemoryExecutionRunStore(),
        ledger: new InMemoryPreferenceLedger(),
        budget: { maxIterations: 3, maxTokens: 100_000, maxCostUsd: 1, maxLatencyMs: 60_000 },
        clock: new FakeClock(),
        traceId: () => 'trace-test-25',
        maxRetries: 1,
        artifactReader: new NodeArtifactReader(dir),
        artifactExpectations: () => [
          { checkId: 'json', type: 'JSON_VALID', path: 'out/report.json' },
          {
            checkId: 'calc',
            type: 'CALCULATION',
            path: 'out/report.json',
            calculation: { kind: 'sum', field: 'numbers', expected: 6 },
          },
        ],
      });
      const result = await service.start('owner-a', p.id);

      expect(result.data?.status).toBe('COMPLETED');
      const stepRun = result.data?.steps[0];
      expect(stepRun?.state).toBe('completed');
      // Both the execution-contract checks AND the artifact checks are attached.
      const checkNames = stepRun?.verification?.post?.checks.map((c) => c.name) ?? [];
      expect(checkNames.some((n) => n.startsWith('artifact:json'))).toBe(true);
      expect(checkNames.some((n) => n.startsWith('artifact:calc'))).toBe(true);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('20. manual/configure/unavailable steps are never executed by the port', async () => {
    const manual = candidate({
      id: 'manual:x',
      kind: 'manual',
      name: 'Manual action',
      integrationType: 'MANUAL_STEP',
      classification: 'MANUAL',
    });
    const external = candidate({
      id: 'external:canva',
      kind: 'application',
      name: 'Canva',
      integrationType: 'EXTERNAL_APPLICATION',
      classification: 'EXTERNAL',
    });
    const cfg = candidate({
      id: 'provider:claude:sonnet',
      name: 'Anthropic · Claude Sonnet',
      providerFamily: 'anthropic',
      modelId: 'claude-sonnet',
      classification: 'CONFIGURE',
      configurable: true,
    });
    const vid = candidate({
      id: 'provider:video:veo',
      name: 'Video · Veo',
      providerFamily: 'video',
      capability: 'VIDEO_GENERATION',
      integrationType: 'NATIVE_API',
    });
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({
        id: 's2',
        title: 'Storyboard',
        capability: 'IMAGE_GENERATION',
        candidates: [manual],
        selectedCandidateId: 'manual:x',
        automation: 'MANUAL',
      }),
      step({
        id: 's3',
        title: 'Design',
        purpose: 'Design in Canva.',
        candidates: [external],
        selectedCandidateId: 'external:canva',
        automation: 'MANUAL',
      }),
      step({
        id: 's4',
        capability: 'REASONING',
        title: 'Analyze',
        candidates: [cfg],
        selectedCandidateId: 'provider:claude:sonnet',
        automation: 'PARTIALLY_AUTOMATED',
      }),
      step({
        id: 's5',
        capability: 'VIDEO_GENERATION',
        title: 'Generate video',
        candidates: [vid],
        selectedCandidateId: 'provider:video:veo',
      }),
    ]);
    const { service, port } = harness(p);
    const result = await service.start('owner-a', p.id);

    // Only s1 was executable; every non-executable step was never called.
    expect(port.calls.map((c) => c.stepId)).toEqual(['s1']);
    expect(result.data?.steps.filter((s) => s.state === 'completed').map((s) => s.stepId)).toEqual([
      's1',
    ]);
  });
});
