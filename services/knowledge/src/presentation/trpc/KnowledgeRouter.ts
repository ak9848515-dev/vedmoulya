// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge tRPC Router
// tRPC procedures for type-safe knowledge graph operations
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import type { KnowledgeApplicationService } from '@vedmoulya/services';
import { NotFoundError, ConflictError, ValidationError } from '@vedmoulya/core';
import {
  createGraphSchema,
  createNodeSchema,
  updateNodeSchema,
  createEdgeSchema,
  paginationQuery,
  searchQuery,
  mergeNodesSchema,
  splitNodeSchema,
} from '../validation/KnowledgeSchemas.js';

// ── Factory ───────────────────────────────────────────────────────────────

/** Create a tRPC router with all knowledge procedures */
export function createKnowledgeTrpcRouter(knowledgeService: KnowledgeApplicationService): object {
  const t = initTRPC.create();

  return t.router({
    // ── Graph Management ───────────────────────────────────────────────────

    createGraph: t.procedure.input(createGraphSchema).mutation(async ({ input }) => {
      try {
        const result = await knowledgeService.createGraph(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    getGraph: t.procedure.input(z.string()).query(async ({ input }) => {
      try {
        const result = await knowledgeService.getGraph(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    listGraphs: t.procedure.input(paginationQuery).query(async ({ input }) => {
      try {
        const result = await knowledgeService.listGraphs(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    deleteGraph: t.procedure.input(z.string()).mutation(async ({ input }) => {
      try {
        await knowledgeService.deleteGraph(input);
        return { success: true as const, data: { message: 'Graph deleted' } };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    // ── Node Management ────────────────────────────────────────────────────

    createNode: t.procedure.input(createNodeSchema).mutation(async ({ input }) => {
      try {
        const result = await knowledgeService.createNode(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    getNode: t.procedure.input(z.string()).query(async ({ input }) => {
      try {
        const result = await knowledgeService.getNode(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    updateNode: t.procedure
      .input(z.object({ id: z.string(), data: updateNodeSchema }))
      .mutation(async ({ input }) => {
        try {
          const result = await knowledgeService.updateNode(input.id, input.data);
          return { success: true as const, data: result };
        } catch (error) {
          throw mapTRPCError(error);
        }
      }),

    deleteNode: t.procedure.input(z.string()).mutation(async ({ input }) => {
      try {
        await knowledgeService.deleteNode(input);
        return { success: true as const, data: { message: 'Node deleted' } };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    listNodesByGraph: t.procedure
      .input(z.object({ graphId: z.string(), pagination: paginationQuery }))
      .query(async ({ input }) => {
        try {
          const result = await knowledgeService.listNodesByGraph(input.graphId, input.pagination);
          return { success: true as const, data: result };
        } catch (error) {
          throw mapTRPCError(error);
        }
      }),

    // ── Edge Management ────────────────────────────────────────────────────

    createEdge: t.procedure.input(createEdgeSchema).mutation(async ({ input }) => {
      try {
        const result = await knowledgeService.createEdge(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    getNodeEdges: t.procedure.input(z.string()).query(async ({ input }) => {
      try {
        const result = await knowledgeService.getNodeEdges(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    deleteEdge: t.procedure.input(z.string()).mutation(async ({ input }) => {
      try {
        await knowledgeService.deleteEdge(input);
        return { success: true as const, data: { message: 'Edge deleted' } };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    // ── Traversal & Analysis ───────────────────────────────────────────────

    traverse: t.procedure
      .input(z.object({ nodeId: z.string(), maxDepth: z.number().optional() }))
      .query(async ({ input }) => {
        try {
          const result = await knowledgeService.traverse(input.nodeId, input.maxDepth);
          return { success: true as const, data: result };
        } catch (error) {
          throw mapTRPCError(error);
        }
      }),

    findShortestPath: t.procedure
      .input(z.object({ startNodeId: z.string(), endNodeId: z.string() }))
      .query(async ({ input }) => {
        try {
          const result = await knowledgeService.findShortestPath(
            input.startNodeId,
            input.endNodeId,
          );
          return { success: true as const, data: result };
        } catch (error) {
          throw mapTRPCError(error);
        }
      }),

    findRelatedKnowledge: t.procedure.input(z.string()).query(async ({ input }) => {
      try {
        const result = await knowledgeService.findRelatedKnowledge(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    analyzeImpact: t.procedure.input(z.string()).query(async ({ input }) => {
      try {
        const result = await knowledgeService.analyzeImpact(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    detectCycles: t.procedure.input(z.string()).query(async ({ input }) => {
      try {
        const result = await knowledgeService.detectCycles(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    getGraphStatistics: t.procedure.input(z.string()).query(async ({ input }) => {
      try {
        const result = await knowledgeService.getGraphStatistics(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    // ── Advanced Operations ────────────────────────────────────────────────

    mergeNodes: t.procedure.input(mergeNodesSchema).mutation(async ({ input }) => {
      try {
        const result = await knowledgeService.mergeNodes(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    splitNode: t.procedure.input(splitNodeSchema).mutation(async ({ input }) => {
      try {
        const result = await knowledgeService.splitNode(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    // ── Search ─────────────────────────────────────────────────────────────

    searchNodes: t.procedure.input(searchQuery).query(async ({ input }) => {
      try {
        const { q, page, limit } = input;
        const result = await knowledgeService.searchNodes(q, { page, limit });
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),
  });
}

// ── Error Mapping ─────────────────────────────────────────────────────────

/** Map domain/application errors to tRPC error codes using type checks */
function mapTRPCError(error: unknown): TRPCError {
  if (error instanceof NotFoundError) {
    return new TRPCError({ code: 'NOT_FOUND', message: error.message });
  }
  if (error instanceof ConflictError) {
    return new TRPCError({ code: 'CONFLICT', message: error.message });
  }
  if (error instanceof ValidationError) {
    return new TRPCError({ code: 'BAD_REQUEST', message: error.message });
  }
  if (error instanceof Error) {
    return new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
  }
  return new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' });
}
