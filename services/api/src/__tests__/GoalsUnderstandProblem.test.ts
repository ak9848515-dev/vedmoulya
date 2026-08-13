// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — goals.understandProblem router tests (SPRINT-023)
// The typed problem-understanding procedure through the REAL tRPC pipeline
// (createAppRouter + auth + rate-limit middleware + zod input). The
// deterministic understanding logic is covered by the goals package suite —
// this suite proves the gateway wiring.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import {
  GoalsApplicationService,
  InMemoryGoalRepository,
  InMemoryTaskRepository,
} from '@vedmoulya/goals';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';

const services = {
  goals: new GoalsApplicationService(new InMemoryGoalRepository(), new InMemoryTaskRepository()),
} as unknown as ApiApplicationService;

const router = createAppRouter(services);
const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

describe('goals.understandProblem namespace (SPRINT-023)', () => {
  it('returns a typed ProblemDefinition through the real pipeline', async () => {
    const caller = router.createCaller(ctx('u1'));
    const result = await caller.goals.understandProblem({
      userId: 'u1',
      problem: 'Automate my daily Excel report before Friday, without sharing the data externally',
    });
    expect(result.success).toBe(true);
    if (!result.success || !('data' in result) || !result.data) throw new Error('expected data');
    const d = result.data as {
      intent: string;
      domain: string;
      desiredOutcome: string;
      constraints: Array<{ kind: string }>;
      approvalRequirements: unknown[];
      missingInformation: string[];
      confidence: number;
      provenance: string[];
    };
    expect(d.intent).toBe('ACTION');
    expect(d.desiredOutcome).toContain('Complete:');
    expect(d.constraints.map((c) => c.kind)).toContain('deadline');
    expect(d.constraints.map((c) => c.kind)).toContain('privacy');
    expect(Array.isArray(d.approvalRequirements)).toBe(true);
    expect(Array.isArray(d.missingInformation)).toBe(true);
    expect(d.confidence).toBeGreaterThanOrEqual(0.3);
    expect(d.provenance.length).toBeGreaterThan(0);
  });

  it('rejects a too-short problem via zod (fail-fast input validation)', async () => {
    const caller = router.createCaller(ctx('u1'));
    await expect(
      caller.goals.understandProblem({ userId: 'u1', problem: 'ab' }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('is owner-inert (no cross-user state read — stateless understanding)', async () => {
    // The procedure performs no owner-scoped store access; two different
    // users receive the same deterministic definition for the same problem
    // (only the generated problemId differs).
    const a = await router.createCaller(ctx('u1')).goals.understandProblem({
      userId: 'u1',
      problem: 'Summarize this document',
    });
    const b = await router.createCaller(ctx('u2')).goals.understandProblem({
      userId: 'u2',
      problem: 'Summarize this document',
    });
    const { problemId: _pa, ...restA } = a.data as Record<string, unknown>;
    const { problemId: _pb, ...restB } = b.data as Record<string, unknown>;
    expect(restA).toEqual(restB);
  });
});
