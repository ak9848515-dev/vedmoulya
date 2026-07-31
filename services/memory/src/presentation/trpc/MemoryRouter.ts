// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory tRPC Router
// tRPC procedures for type-safe memory engine operations
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { initTRPC } from '@trpc/server';
import type { MemoryApplicationService } from '@vedmoulya/services';
import { captureMemorySchema, updateMemorySchema } from '../validation/MemorySchemas.js';

/** Create a tRPC router with all memory procedures */
export function createMemoryTrpcRouter(memoryService: MemoryApplicationService): object {
  const t = initTRPC.create();

  return t.router({
    // ── Memory CRUD ────────────────────────────────────────────────────────

    captureMemory: t.procedure.input(captureMemorySchema).mutation(async ({ input }) => {
      const result = await memoryService.captureMemory(input);
      return { success: true as const, data: result };
    }),

    recallMemory: t.procedure
      .input(z.object({ id: z.string(), strengthen: z.boolean().optional() }))
      .query(async ({ input }) => {
        const result = await memoryService.recallMemory(input.id, input.strengthen ?? true);
        return { success: true as const, data: result };
      }),

    updateMemory: t.procedure
      .input(z.object({ id: z.string(), data: updateMemorySchema }))
      .mutation(async ({ input }) => {
        const result = await memoryService.updateMemory(input.id, input.data);
        return { success: true as const, data: result };
      }),

    forgetMemory: t.procedure.input(z.string()).mutation(async ({ input }) => {
      await memoryService.forgetMemory(input);
      return { success: true as const, data: { message: 'Memory forgotten' } };
    }),

    // ── Memory Lifecycle ────────────────────────────────────────────────────

    strengthenMemory: t.procedure.input(z.string()).mutation(async ({ input }) => {
      const result = await memoryService.strengthenMemory(input);
      return { success: true as const, data: result };
    }),

    weakenMemory: t.procedure.input(z.string()).mutation(async ({ input }) => {
      const result = await memoryService.weakenMemory(input);
      return { success: true as const, data: result };
    }),

    archiveMemory: t.procedure.input(z.string()).mutation(async ({ input }) => {
      const result = await memoryService.archiveMemory(input);
      return { success: true as const, data: result };
    }),

    restoreMemory: t.procedure.input(z.string()).mutation(async ({ input }) => {
      const result = await memoryService.restoreMemory(input);
      return { success: true as const, data: result };
    }),

    // ── Advanced Operations ─────────────────────────────────────────────────

    mergeMemories: t.procedure
      .input(z.object({ sourceId: z.string(), targetId: z.string() }))
      .mutation(async ({ input }) => {
        const result = await memoryService.mergeMemories(input.sourceId, input.targetId);
        return { success: true as const, data: result };
      }),

    // ── Timeline (single memory) ────────────────────────────────────────────

    getMemory: t.procedure.input(z.string()).query(async ({ input }) => {
      const result = await memoryService.getMemory(input);
      return { success: true as const, data: result };
    }),

    // ── Search & List ──────────────────────────────────────────────────────

    listMemories: t.procedure
      .input(
        z.object({
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(20),
        }),
      )
      .query(async ({ input }) => {
        const result = await memoryService.listMemories(input.page, input.limit);
        return { success: true as const, data: result };
      }),

    // ── Statistics ──────────────────────────────────────────────────────────

    getStats: t.procedure.query(async () => {
      const result = await memoryService.getStats();
      return { success: true as const, data: result };
    }),
  });
}
