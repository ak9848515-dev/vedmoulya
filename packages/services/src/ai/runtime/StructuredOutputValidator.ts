// ──────────────────────────────────────────────────────────────────
// VedMoulya — Structured Output Validator
// Deterministic schema validation for model structured output so
// business engines never consume unvalidated model JSON. Supports the
// JSON-schema fragment used by the ai.* API (`type: 'object',
// properties: {...}, required: [...]`) plus a compact field-descriptor
// form. Malformed responses are reported with concrete errors for
// bounded retry/fallback at the orchestration layer.
// AI-RUNTIME-002 — Structured Output.
// ──────────────────────────────────────────────────────────────────

export type StructuredFieldType = 'string' | 'number' | 'boolean' | 'string[]' | 'object';

export interface StructuredFieldDescriptor {
  key: string;
  type: StructuredFieldType;
  required?: boolean;
  /** Numeric lower bound (inclusive). */
  minimum?: number;
  /** Numeric upper bound (inclusive). */
  maximum?: number;
  /** Minimum string length. */
  minLength?: number;
  /** Maximum string length. */
  maxLength?: number;
  /** Allowed scalar values. */
  enum?: Array<string | number | boolean>;
}

export type StructuredOutputSchema = Record<string, unknown> | StructuredFieldDescriptor[];

export type StructuredOutputResult =
  { ok: true; data: Record<string, unknown> } | { ok: false; errors: string[]; data: undefined };

export class StructuredOutputValidator {
  /**
   * Validate raw model output against a schema. Supports both the
   * JSON-schema fragment (from `ai` SDK jsonSchema) and the compact
   * descriptor form.
   */
  validate(schema: StructuredOutputSchema, raw: string): StructuredOutputResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, errors: ['response is not valid JSON'], data: undefined };
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, errors: ['response is not a JSON object'], data: undefined };
    }

    const descriptors = this.toDescriptors(schema);
    const data = parsed as Record<string, unknown>;
    const errors: string[] = [];

    for (const field of descriptors) {
      const value = data[field.key];
      if (value === undefined || value === null) {
        if (field.required) {
          errors.push(`missing required field: ${field.key}`);
        }
        continue;
      }
      if (!this.typeMatches(field.type, value)) {
        errors.push(`field ${field.key} has wrong type: expected ${field.type}`);
      }
      // C-11: semantic/business constraints beyond the primitive type — a
      // number in range, a string of bounded length, or an enumerated value.
      // Without these a model could emit plausible-but-invalid truth.
      if (typeof value === 'number') {
        if (field.minimum !== undefined && value < field.minimum) {
          errors.push(`field ${field.key} must be >= ${String(field.minimum)}`);
        }
        if (field.maximum !== undefined && value > field.maximum) {
          errors.push(`field ${field.key} must be <= ${String(field.maximum)}`);
        }
      }
      if (typeof value === 'string') {
        if (field.minLength !== undefined && value.length < field.minLength) {
          errors.push(`field ${field.key} must be at least ${String(field.minLength)} chars`);
        }
        if (field.maxLength !== undefined && value.length > field.maxLength) {
          errors.push(`field ${field.key} must be at most ${String(field.maxLength)} chars`);
        }
      }
      if (
        field.enum !== undefined &&
        typeof value !== 'object' &&
        !field.enum.some((option) => option === value)
      ) {
        errors.push(`field ${field.key} must be one of ${field.enum.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      return { ok: false, errors, data: undefined };
    }
    return { ok: true, data };
  }

  /** Bounded retry helper: re-run a parser up to maxAttempts on failure. */
  async parseWithRetries(
    attempt: () => Promise<{ ok: boolean; data?: Record<string, unknown>; errors?: string[] }>,
    maxAttempts = 2,
  ): Promise<{ ok: boolean; data?: Record<string, unknown>; errors?: string[] }> {
    let last: { ok: boolean; data?: Record<string, unknown>; errors?: string[] } | undefined;
    for (let i = 0; i < maxAttempts; i++) {
      last = await attempt();
      if (last.ok) return last;
    }
    return last ?? { ok: false, errors: ['structured output failed'] };
  }

  private toDescriptors(schema: StructuredOutputSchema): StructuredFieldDescriptor[] {
    if (Array.isArray(schema)) {
      return schema;
    }
    // JSON-schema fragment form: { type: 'object', properties: {...}, required: [...] }
    // The property shape carries the semantic constraint fields the validator
    // enforces (minimum/maximum/minLength/maxLength/enum) — typed here so
    // model JSON-schemas are validated against the same contract.
    interface JsonSchemaProperty {
      type?: string;
      minimum?: number;
      maximum?: number;
      minLength?: number;
      maxLength?: number;
      enum?: Array<string | number | boolean>;
    }
    const properties = (schema.properties as Record<string, JsonSchemaProperty> | undefined) ?? {};
    const required = new Set<string>(
      Array.isArray(schema.required) ? (schema.required as string[]) : [],
    );
    return Object.entries(properties).map(([key, prop]) => ({
      key,
      type: this.mapJsonType(prop.type ?? 'string'),
      required: required.has(key),
      minimum: typeof prop.minimum === 'number' ? prop.minimum : undefined,
      maximum: typeof prop.maximum === 'number' ? prop.maximum : undefined,
      minLength: typeof prop.minLength === 'number' ? prop.minLength : undefined,
      maxLength: typeof prop.maxLength === 'number' ? prop.maxLength : undefined,
      enum: Array.isArray(prop.enum) ? prop.enum : undefined,
    }));
  }

  private mapJsonType(type: string): StructuredFieldType {
    switch (type) {
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'string[]';
      case 'object':
        return 'object';
      default:
        return 'string';
    }
  }

  private typeMatches(type: StructuredFieldType, value: unknown): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'string[]':
        return Array.isArray(value) && value.every((v) => typeof v === 'string');
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }
}
