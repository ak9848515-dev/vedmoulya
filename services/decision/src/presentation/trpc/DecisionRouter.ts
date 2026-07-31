// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision tRPC Router
// tRPC procedures for type-safe decision engine operations
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { initTRPC } from '@trpc/server';
import type { DecisionApplicationService } from '@vedmoulya/services';
import {
  createDecisionSchema,
  updateDecisionSchema,
  addOptionSchema,
  scoreOptionSchema,
  assessRiskSchema,
  assessOpportunitySchema,
  decideSchema,
  completeDecisionSchema,
} from '../validation/DecisionSchemas.js';

/** Create a tRPC router with all decision procedures */
export function createDecisionTrpcRouter(decisionService: DecisionApplicationService): object {
  const t = initTRPC.create();

  return t.router({
    // ── Decision CRUD ────────────────────────────────────────────────────────

    createDecision: t.procedure.input(createDecisionSchema).mutation(async ({ input }) => {
      const result = await decisionService.createDecision(input);
      return { success: true as const, data: result };
    }),

    getDecision: t.procedure.input(z.string()).query(async ({ input }) => {
      const result = await decisionService.getDecision(input);
      return { success: true as const, data: result };
    }),

    updateDecision: t.procedure
      .input(z.object({ id: z.string(), data: updateDecisionSchema }))
      .mutation(async ({ input }) => {
        const result = await decisionService.updateDecision(input.id, input.data);
        return { success: true as const, data: result };
      }),

    archiveDecision: t.procedure
      .input(z.object({ id: z.string(), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        const result = await decisionService.archiveDecision(input.id, input.reason);
        return { success: true as const, data: result };
      }),

    cancelDecision: t.procedure
      .input(z.object({ id: z.string(), reason: z.string() }))
      .mutation(async ({ input }) => {
        const result = await decisionService.cancelDecision(input.id, input.reason);
        return { success: true as const, data: result };
      }),

    // ── Lifecycle ────────────────────────────────────────────────────────────

    startAnalysis: t.procedure.input(z.string()).mutation(async ({ input }) => {
      const result = await decisionService.startAnalysis(input);
      return { success: true as const, data: result };
    }),

    startEvaluation: t.procedure.input(z.string()).mutation(async ({ input }) => {
      const result = await decisionService.startEvaluation(input);
      return { success: true as const, data: result };
    }),

    addOption: t.procedure
      .input(z.object({ id: z.string(), option: addOptionSchema }))
      .mutation(async ({ input }) => {
        const result = await decisionService.addOption(input.id, input.option);
        return { success: true as const, data: result };
      }),

    scoreOption: t.procedure
      .input(z.object({ id: z.string(), data: scoreOptionSchema }))
      .mutation(async ({ input }) => {
        const result = await decisionService.scoreOption(input.id, input.data);
        return { success: true as const, data: result };
      }),

    assessRisk: t.procedure
      .input(z.object({ id: z.string(), data: assessRiskSchema }))
      .mutation(async ({ input }) => {
        const result = await decisionService.assessRisk(input.id, input.data);
        return { success: true as const, data: result };
      }),

    assessOpportunity: t.procedure
      .input(z.object({ id: z.string(), data: assessOpportunitySchema }))
      .mutation(async ({ input }) => {
        const result = await decisionService.assessOpportunity(input.id, input.data);
        return { success: true as const, data: result };
      }),

    decide: t.procedure
      .input(z.object({ id: z.string(), data: decideSchema }))
      .mutation(async ({ input }) => {
        const result = await decisionService.decide(input.id, input.data);
        return { success: true as const, data: result };
      }),

    completeDecision: t.procedure
      .input(z.object({ id: z.string(), data: completeDecisionSchema }))
      .mutation(async ({ input }) => {
        const result = await decisionService.completeDecision(input.id, input.data);
        return { success: true as const, data: result };
      }),

    // ── Rankings & Recommendations ──────────────────────────────────────────

    rankOptions: t.procedure.input(z.string()).query(async ({ input }) => {
      const result = await decisionService.rankOptions(input);
      return { success: true as const, data: result };
    }),

    getRecommendation: t.procedure.input(z.string()).query(async ({ input }) => {
      const result = await decisionService.recommend(input);
      return { success: true as const, data: result };
    }),

    compareOptions: t.procedure
      .input(z.object({ id: z.string(), optionA: z.string(), optionB: z.string() }))
      .query(async ({ input }) => {
        const result = await decisionService.compareOptions(input.id, input.optionA, input.optionB);
        return { success: true as const, data: result };
      }),

    // ── List & Search ──────────────────────────────────────────────────────

    listDecisions: t.procedure
      .input(
        z.object({
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(20),
        }),
      )
      .query(async ({ input }) => {
        const result = await decisionService.listDecisions(input.page, input.limit);
        return { success: true as const, data: result };
      }),

    // ── Statistics ──────────────────────────────────────────────────────────

    getStats: t.procedure.query(async () => {
      const result = await decisionService.getStats();
      return { success: true as const, data: result };
    }),
  });
}
