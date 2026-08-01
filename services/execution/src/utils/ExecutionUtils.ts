/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: dynamic member access here uses typed/closed-union keys,
   constant environment names, or fixed internal lists — never
   attacker-controlled property names. */
import { ID_PREFIX } from '../constants/ExecutionConstants.js';

/** Generate a plan ID with prefix */
export function generatePlanId(): string {
  return `${ID_PREFIX.PLAN}${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

/** Generate a mission ID with prefix */
export function generateMissionId(): string {
  return `${ID_PREFIX.MISSION}${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** Generate a task ID with prefix */
export function generateTaskId(): string {
  return `${ID_PREFIX.TASK}${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** Generate a step ID with prefix */
export function generateStepId(): string {
  return `${ID_PREFIX.STEP}${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Calculate pagination offset */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/** Calculate total pages */
export function calculateTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

/** Format a date to ISO string safely */
export function safeDateToString(date: Date | undefined | null): string | undefined {
  return date?.toISOString();
}

/** Parse ISO date string to Date */
export function parseDate(value: string | Date | undefined | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

/** Sleep for a given number of milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry an async function with exponential backoff */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelayMs: number } = { maxRetries: 3, baseDelayMs: 200 },
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < options.maxRetries) {
        const delay = options.baseDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  throw lastError ?? new Error('Retry failed');
}

/** Truncate a string to a maximum length */
export function truncate(str: string, maxLength: number = 200): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/** Check if a string is null or whitespace-only */
export function isBlank(str: string | undefined | null): boolean {
  return !str || str.trim().length === 0;
}

/** Deep merge two objects */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (
      sourceVal !== undefined &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      sourceVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal) &&
      targetVal !== null
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      ) as unknown as T[keyof T];
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal as T[keyof T];
    }
  }
  return result;
}
