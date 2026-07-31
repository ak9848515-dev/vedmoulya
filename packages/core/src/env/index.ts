// ──────────────────────────────────────────────────────────────────
// VedMoulya — Environment Management
// Validates environment variables at startup and provides type-safe access
// Implements BLP-001/D01 — Configuration validation in DoD
// ──────────────────────────────────────────────────────────────────

/**
 * Environment error thrown when required variables are missing
 */
export class EnvironmentError extends Error {
  public readonly missing: string[];
  public readonly invalid: string[];

  constructor(missing: string[], invalid: string[] = []) {
    const details: string[] = [];
    if (missing.length > 0) details.push(`missing: ${missing.join(', ')}`);
    if (invalid.length > 0) details.push(`invalid: ${invalid.join(', ')}`);
    const suffix = details.length > 0 ? ` (${details.join('; ')})` : '';
    super(
      `Environment validation failed: ${String(missing.length)} missing, ${String(invalid.length)} invalid${suffix}`,
    );
    this.name = 'EnvironmentError';
    this.missing = missing;
    this.invalid = invalid;
  }
}

/**
 * Environment schema definition for a single variable
 */
export interface EnvVarDefinition<T = string> {
  key: string;
  description: string;
  required: boolean;
  default?: T;
  validate?: (value: string) => boolean;
  transform?: (value: string) => T;
}

interface EnvVarEntry {
  key: string;
  definition: EnvVarDefinition;
  value: string | undefined;
}

/**
 * Environment manager that validates and provides type-safe access to env vars
 */
export class Environment {
  private readonly entries = new Map<string, EnvVarEntry>();
  private validated = false;

  /**
   * Define expected environment variables
   */
  define(definitions: EnvVarDefinition[]): this {
    for (const def of definitions) {
      const raw = process.env[def.key] ?? def.default?.toString();
      this.entries.set(def.key, {
        key: def.key,
        definition: def,
        value: raw,
      });
    }
    return this;
  }

  /**
   * Validate all required variables are present and valid
   * @throws {EnvironmentError} if validation fails
   */
  validate(): void {
    const missing: string[] = [];
    const invalid: string[] = [];

    for (const [, entry] of this.entries) {
      const { definition, value } = entry;

      // Required variable with no value (and no default) is missing
      if (definition.required && (value === undefined || value === '')) {
        missing.push(entry.key);
        continue;
      }

      // Present value that fails its validation callback is invalid
      if (value !== undefined && definition.validate && !definition.validate(value)) {
        invalid.push(entry.key);
      }
    }

    if (missing.length > 0 || invalid.length > 0) {
      throw new EnvironmentError(missing, invalid);
    }

    this.validated = true;
  }

  /**
   * Get a raw environment variable value
   */
  get(key: string): string | undefined {
    return this.entries.get(key)?.value;
  }

  /**
   * Get a required environment variable or throw
   */
  require(key: string): string {
    const value = this.entries.get(key)?.value;
    if (!value) {
      throw new EnvironmentError([key]);
    }
    return value;
  }

  /**
   * Get an environment variable as a number
   */
  number(key: string, fallback?: number): number | undefined {
    const value = this.entries.get(key)?.value ?? fallback?.toString();
    return value ? Number(value) : undefined;
  }

  /**
   * Get an environment variable as a boolean
   */
  boolean(key: string, fallback?: boolean): boolean | undefined {
    const entry = this.entries.get(key);
    if (entry?.value === undefined && fallback !== undefined) {
      return fallback;
    }
    const val = entry?.value;
    if (val === 'true' || val === '1') return true;
    if (val === 'false' || val === '0') return false;
    return undefined;
  }

  /**
   * Get all validated environment variables
   */
  all(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, entry] of this.entries) {
      if (entry.value !== undefined) {
        result[key] = entry.value;
      }
    }
    return result;
  }

  /**
   * Check if environment has been validated
   */
  isValidated(): boolean {
    return this.validated;
  }

  /**
   * Clear all variables (for testing)
   */
  clear(): void {
    this.entries.clear();
    this.validated = false;
  }
}

/**
 * Default environment instance
 */
export const env = new Environment();

/**
 * Known placeholder / weak values that must never be used as a production secret
 */
const WEAK_SECRET_PATTERN =
  /development-secret|change[-_]?me|your[-_]?secret|placeholder|changeme|^secret$/i;

/**
 * Require a strong secret: at least 32 chars and not a known placeholder
 */
export function isStrongSecret(value: string): boolean {
  return value.length >= 32 && !WEAK_SECRET_PATTERN.test(value);
}

/**
 * Define standard environment variables for any service.
 * Fail-fast: AUTH_JWT_SECRET is required with no default and must be a strong
 * secret (P1-8 — remove hardcoded 'development-secret' fallback).
 */
export function defineStandardEnvVars(envManager: Environment): void {
  envManager.define([
    {
      key: 'NODE_ENV',
      description: 'Node environment (development, test, production)',
      required: true,
      default: 'development',
      validate: (v: string): boolean =>
        ['development', 'test', 'production', 'staging'].includes(v),
    },
    {
      key: 'LOG_LEVEL',
      description: 'Logging level',
      required: false,
      default: 'debug',
      validate: (v: string): boolean => ['error', 'warn', 'info', 'debug', 'trace'].includes(v),
    },
    {
      key: 'API_PORT',
      description: 'HTTP API port',
      required: false,
      default: '3000',
    },
    {
      key: 'API_HOST',
      description: 'HTTP API host',
      required: false,
      default: '0.0.0.0',
    },
    {
      key: 'APP_NAME',
      description: 'Application name',
      required: false,
      default: 'vedmoulya',
    },
    {
      key: 'AUTH_JWT_SECRET',
      description: 'JWT signing secret (required, no default, must be >= 32 chars)',
      required: true,
      validate: isStrongSecret,
    },
  ]);
}
