// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity tRPC Router
// tRPC procedures for type-safe identity operations
// Uses @trpc/server v11 API for client-side type inference
// ──────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import type { IdentityApplicationService } from '@vedmoulya/services';
import { NotFoundError, ConflictError, ValidationError } from '@vedmoulya/core';
import {
  registerUserSchema,
  updateProfileSchema,
  updatePreferencesSchema,
  updateSettingsSchema,
  paginationQuery,
} from '../validation/IdentitySchemas.js';

// ── Factory ───────────────────────────────────────────────────────────────

/** Create a tRPC router with all identity procedures */
export function createIdentityTrpcRouter(identityService: IdentityApplicationService): object {
  const t = initTRPC.create();

  return t.router({
    // ── Mutations ───────────────────────────────────────────────────────────

    registerUser: t.procedure.input(registerUserSchema).mutation(async ({ input }) => {
      try {
        const result = await identityService.registerUser({
          email: input.email,
          displayName: input.displayName,
          givenName: input.givenName,
          familyName: input.familyName,
          passwordHash: input.password,
        });
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    updateProfile: t.procedure
      .input(z.object({ id: z.string(), data: updateProfileSchema }))
      .mutation(async ({ input }) => {
        try {
          const result = await identityService.updateProfile(input.id, input.data);
          return { success: true as const, data: result };
        } catch (error) {
          throw mapTRPCError(error);
        }
      }),

    updatePreferences: t.procedure
      .input(z.object({ id: z.string(), data: updatePreferencesSchema }))
      .mutation(async ({ input }) => {
        try {
          const result = await identityService.updatePreferences(input.id, input.data);
          return { success: true as const, data: result };
        } catch (error) {
          throw mapTRPCError(error);
        }
      }),

    updateSettings: t.procedure
      .input(z.object({ id: z.string(), data: updateSettingsSchema }))
      .mutation(async ({ input }) => {
        try {
          const result = await identityService.updateSettings(input.id, input.data);
          return { success: true as const, data: result };
        } catch (error) {
          throw mapTRPCError(error);
        }
      }),

    activateUser: t.procedure.input(z.string()).mutation(async ({ input }) => {
      try {
        const result = await identityService.activateUser(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    deactivateUser: t.procedure
      .input(z.object({ id: z.string(), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        try {
          const result = await identityService.deactivateUser(input.id, input.reason);
          return { success: true as const, data: result };
        } catch (error) {
          throw mapTRPCError(error);
        }
      }),

    archiveUser: t.procedure.input(z.string()).mutation(async ({ input }) => {
      try {
        await identityService.archiveUser(input);
        return { success: true as const, data: { message: 'User archived' } };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    // ── Queries ─────────────────────────────────────────────────────────────

    getUserById: t.procedure.input(z.string()).query(async ({ input }) => {
      try {
        const user = await identityService.getUserById(input);
        return { success: true as const, data: user };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    getUserByEmail: t.procedure.input(z.string().email()).query(async ({ input }) => {
      try {
        const user = await identityService.getUserByEmail(input);
        return { success: true as const, data: user };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    listUsers: t.procedure.input(paginationQuery).query(async ({ input }) => {
      try {
        const result = await identityService.listUsers(input);
        return { success: true as const, data: result };
      } catch (error) {
        throw mapTRPCError(error);
      }
    }),

    checkAuthentication: t.procedure.input(z.string()).query(async ({ input }) => {
      try {
        const result = await identityService.checkAuthentication(input);
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
