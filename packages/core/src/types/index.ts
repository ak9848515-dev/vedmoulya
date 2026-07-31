// ──────────────────────────────────────────────────────────────────
// VedMoulya — Core Base Types
// ──────────────────────────────────────────────────────────────────

/** Branded type for entity IDs */
export type BrandedId<T extends string> = string & { readonly __brand: T };

/** Standard Result type for operations that can fail */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/** Standard pagination parameters */
export interface PaginationParams {
  page: number;
  limit: number;
}

/** Standard paginated response */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Standard API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: Record<string, unknown>;
}

/** Standard API error */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** Entity status */
export type EntityStatus = 'active' | 'inactive' | 'archived' | 'deleted';

/** Timestamp range */
export interface TimeRange {
  start: Date;
  end: Date;
}
