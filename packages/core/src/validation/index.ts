// ──────────────────────────────────────────────────────────────────
// VedMoulya — Validation Framework
// Schema-based validation for inputs, configuration, and domain objects
// Implements BLP-001/D01 — Error handling & validation in DoD
// ──────────────────────────────────────────────────────────────────

import { ValidationError } from '../errors/index.js';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * A single validation issue
 */
export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
  value?: unknown;
}

/**
 * Validation rule for a specific field
 */
export interface ValidationRule<T = unknown> {
  name: string;
  validate: (value: T, context?: Record<string, unknown>) => string | null;
}

/**
 * Schema definition for validating an object
 */
export class ValidationSchema<T extends Record<string, unknown> = Record<string, unknown>> {
  private readonly rules = new Map<string, ValidationRule[]>();
  private readonly customValidators: Array<(data: T) => string | null> = [];

  /**
   * Add a validation rule for a field
   */
  field<K extends keyof T>(name: K, rules: ValidationRule<T[K]>[]): this {
    this.rules.set(name as string, rules as ValidationRule[]);
    return this;
  }

  /**
   * Add a custom validator for the entire object
   */
  custom(validator: (data: T) => string | null): this {
    this.customValidators.push(validator);
    return this;
  }

  /**
   * Validate data against the schema
   */
  validate(data: T): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    // Validate each field
    for (const [fieldName, fieldRules] of this.rules) {
      const value = data[fieldName as keyof T];
      for (const rule of fieldRules) {
        if (typeof value === 'function') continue;
        const error = rule.validate(value, data);
        if (error) {
          errors.push({
            path: fieldName,
            message: error,
            code: rule.name,
            value,
          });
        }
      }
    }

    // Run custom validators
    for (const validator of this.customValidators) {
      const error = validator(data);
      if (error) {
        errors.push({
          path: '$root',
          message: error,
          code: 'CUSTOM',
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate and throw if invalid
   * @throws {ValidationError}
   */
  assert(data: T): void {
    const result = this.validate(data);
    if (!result.valid) {
      throw new ValidationError('Validation failed', {
        errors: result.errors.map((e) => ({
          path: e.path,
          message: e.message,
          code: e.code,
        })),
      });
    }
  }
}

// ── Built-in Validation Rules ─────────────────────────────────────────────

export const Rules = {
  /** Value must be present (not null, undefined, or empty string) */
  required: (message?: string): ValidationRule => ({
    name: 'required',
    validate: (value: unknown): string | null => {
      if (value === null || value === undefined || value === '') {
        return message ?? 'Value is required';
      }
      return null;
    },
  }),

  /** String must match a pattern */
  pattern: (regex: RegExp, message?: string): ValidationRule<string> => ({
    name: 'pattern',
    validate: (value: string): string | null => {
      if (typeof value !== 'string') return 'Value must be a string';
      if (!regex.test(value)) return message ?? `Value must match pattern: ${String(regex)}`;
      return null;
    },
  }),

  /** String must be at least min characters */
  minLength: (min: number, message?: string): ValidationRule<string> => ({
    name: 'minLength',
    validate: (value: string): string | null => {
      if (typeof value !== 'string') return 'Value must be a string';
      if (value.length < min) return message ?? `Must be at least ${String(min)} characters`;
      return null;
    },
  }),

  /** String must be at most max characters */
  maxLength: (max: number, message?: string): ValidationRule<string> => ({
    name: 'maxLength',
    validate: (value: string): string | null => {
      if (typeof value !== 'string') return 'Value must be a string';
      if (value.length > max) return message ?? `Must be at most ${String(max)} characters`;
      return null;
    },
  }),

  /** Number must be at least min */
  min: (min: number, message?: string): ValidationRule<number> => ({
    name: 'min',
    validate: (value: number): string | null => {
      if (typeof value !== 'number') return 'Value must be a number';
      if (value < min) return message ?? `Must be at least ${String(min)}`;
      return null;
    },
  }),

  /** Number must be at most max */
  max: (max: number, message?: string): ValidationRule<number> => ({
    name: 'max',
    validate: (value: number): string | null => {
      if (typeof value !== 'number') return 'Value must be a number';
      if (value > max) return message ?? `Must be at most ${String(max)}`;
      return null;
    },
  }),

  /** Value must be one of the allowed values */
  oneOf: (allowed: unknown[], message?: string): ValidationRule => ({
    name: 'oneOf',
    validate: (value: unknown): string | null => {
      if (!allowed.includes(value)) {
        return message ?? `Must be one of: ${allowed.join(', ')}`;
      }
      return null;
    },
  }),

  /** String must be a valid email */
  email: (message?: string): ValidationRule<string> => ({
    name: 'email',
    validate: (value: string): string | null => {
      if (typeof value !== 'string') return 'Value must be a string';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return message ?? 'Must be a valid email address';
      return null;
    },
  }),

  /** String must be a valid UUID */
  uuid: (message?: string): ValidationRule<string> => ({
    name: 'uuid',
    validate: (value: string): string | null => {
      if (typeof value !== 'string') return 'Value must be a string';
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) return message ?? 'Must be a valid UUID';
      return null;
    },
  }),
} as const;
