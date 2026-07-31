// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Validation Middleware
// Zod-based input/output validation with standardized error messages
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

// ── Common Validation Schemas ───────────────────────────────────────────────

export const userIdSchema = z.object({
  userId: z.string().min(1, 'userId is required').max(100, 'userId too long'),
});

export const paginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
});

export const searchQuerySchema = z.object({
  query: z.string().min(1, 'Search query is required').max(500, 'Search query too long'),
  categories: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  maxResults: z.number().int().min(1).max(100).optional().default(20),
});

export const idSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

// ── Validation Helper ───────────────────────────────────────────────────────

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Validates input against a Zod schema with standardized error formatting.
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): ValidationResult<T> {
  const result = schema.safeParse(input);

  if (!result.success) {
    const firstError = result.error.errors[0];
    const message = firstError
      ? `${firstError.path.join('.')}: ${firstError.message}`
      : 'Validation failed';
    return { success: false, error: message };
  }

  return { success: true, data: result.data };
}

/**
 * Throws a TRPCError with BAD_REQUEST if validation fails.
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = validateInput(schema, input);
  if (!result.success) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: result.error,
    });
  }
  return result.data;
}
