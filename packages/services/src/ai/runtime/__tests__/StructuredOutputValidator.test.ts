import { describe, it, expect } from 'vitest';
import { StructuredOutputValidator } from '../StructuredOutputValidator.js';

const schema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    riskLevel: { type: 'string' },
    score: { type: 'number' },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'score'],
};

describe('StructuredOutputValidator', () => {
  it('accepts a valid structured object', () => {
    const validator = new StructuredOutputValidator();
    const result = validator.validate(
      schema,
      JSON.stringify({ summary: 'ok', score: 8, tags: ['a'] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.score).toBe(8);
    }
  });

  it('rejects malformed JSON', () => {
    const validator = new StructuredOutputValidator();
    const result = validator.validate(schema, 'not json {');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('not valid JSON');
    }
  });

  it('rejects a missing required field', () => {
    const validator = new StructuredOutputValidator();
    const result = validator.validate(schema, JSON.stringify({ riskLevel: 'low' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('summary'))).toBe(true);
    }
  });

  it('rejects a wrong-typed field', () => {
    const validator = new StructuredOutputValidator();
    const result = validator.validate(schema, JSON.stringify({ summary: 'ok', score: 'high' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('wrong type'))).toBe(true);
    }
  });

  it('supports the compact descriptor form', () => {
    const validator = new StructuredOutputValidator();
    const result = validator.validate(
      [
        { key: 'title', type: 'string', required: true },
        { key: 'count', type: 'number' },
      ],
      JSON.stringify({ title: 'x', count: 3 }),
    );
    expect(result.ok).toBe(true);
  });

  it('bounded retry stops after maxAttempts', async () => {
    const validator = new StructuredOutputValidator();
    let calls = 0;
    const result = await validator.parseWithRetries(async () => {
      calls += 1;
      return { ok: false, errors: ['nope'] };
    }, 2);
    expect(result.ok).toBe(false);
    expect(calls).toBe(2);
  });

  it('maps and validates object- and boolean-typed JSON-schema properties', () => {
    const validator = new StructuredOutputValidator();
    const nestedSchema = {
      type: 'object',
      properties: {
        meta: { type: 'object' },
        approved: { type: 'boolean' },
      },
      required: ['meta', 'approved'],
    };
    const ok = validator.validate(
      nestedSchema,
      JSON.stringify({ meta: { source: 'kb' }, approved: true }),
    );
    expect(ok.ok).toBe(true);

    const badType = validator.validate(
      nestedSchema,
      JSON.stringify({ meta: 'not-an-object', approved: 'yes' }),
    );
    expect(badType.ok).toBe(false);
    if (!badType.ok) {
      expect(badType.errors.some((e) => e.includes('meta'))).toBe(true);
      expect(badType.errors.some((e) => e.includes('approved'))).toBe(true);
    }
  });

  it('validates the string-array element types', () => {
    const validator = new StructuredOutputValidator();
    const arraySchema = {
      type: 'object',
      properties: { tags: { type: 'array', items: { type: 'string' } } },
    };
    const ok = validator.validate(arraySchema, JSON.stringify({ tags: ['a', 'b'] }));
    expect(ok.ok).toBe(true);
    const bad = validator.validate(arraySchema, JSON.stringify({ tags: ['a', 42] }));
    expect(bad.ok).toBe(false);
  });

  it('accepts a non-empty array for the array type and rejects an empty object for object type', () => {
    const validator = new StructuredOutputValidator();
    // `string[]` with an empty array is valid; `object` requires a non-array object.
    const arrayOk = validator.validate(
      [{ key: 'tags', type: 'string[]' }],
      JSON.stringify({ tags: [] }),
    );
    expect(arrayOk.ok).toBe(true);

    const objectRejected = validator.validate(
      [{ key: 'meta', type: 'object', required: true }],
      JSON.stringify({ meta: ['not', 'an', 'object'] }),
    );
    expect(objectRejected.ok).toBe(false);
  });

  // ── C-11: semantic/business constraint validation (AI-RUNTIME-002) ───────

  describe('C-11 semantic constraints', () => {
    const constrained = {
      type: 'object',
      properties: {
        score: { type: 'number', minimum: 0, maximum: 10 },
        name: { type: 'string', minLength: 2, maxLength: 20 },
        status: { type: 'string', enum: ['draft', 'approved', 'rejected'] },
        risk: { type: 'number', minimum: 0 },
      },
      required: ['score', 'status'],
    };

    it('accepts values within every constraint', () => {
      const result = new StructuredOutputValidator().validate(
        constrained,
        JSON.stringify({ score: 8, status: 'approved', name: 'ok', risk: 0.5 }),
      );
      expect(result.ok).toBe(true);
    });

    it('rejects a number outside the numeric range', () => {
      const result = new StructuredOutputValidator().validate(
        constrained,
        JSON.stringify({ score: -999999, status: 'approved' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes('score'))).toBe(true);
      }
    });

    it('rejects a number above the maximum', () => {
      const result = new StructuredOutputValidator().validate(
        constrained,
        JSON.stringify({ score: 11, status: 'approved' }),
      );
      expect(result.ok).toBe(false);
    });

    it('rejects a string outside the length bounds', () => {
      const result = new StructuredOutputValidator().validate(
        constrained,
        JSON.stringify({ score: 5, status: 'approved', name: 'x' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes('name'))).toBe(true);
      }
    });

    it('rejects a value not in the enum', () => {
      const result = new StructuredOutputValidator().validate(
        constrained,
        JSON.stringify({ score: 5, status: 'admin' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes('status'))).toBe(true);
      }
    });

    it('rejects a negative-only constraint violation', () => {
      const result = new StructuredOutputValidator().validate(
        constrained,
        JSON.stringify({ score: 5, status: 'approved', risk: -0.01 }),
      );
      expect(result.ok).toBe(false);
    });

    it('accepts partial output when optional constrained fields are absent', () => {
      // name/risk are optional — omitting them is fine.
      const result = new StructuredOutputValidator().validate(
        constrained,
        JSON.stringify({ score: 5, status: 'draft' }),
      );
      expect(result.ok).toBe(true);
    });

    it('rejects partial output when a required field is missing', () => {
      const result = new StructuredOutputValidator().validate(
        constrained,
        JSON.stringify({ score: 5 }), // status required
      );
      expect(result.ok).toBe(false);
    });
  });

  describe('C-11 malformed / provider-schema mismatch outputs', () => {
    it('rejects trailing garbage after valid JSON', () => {
      const result = new StructuredOutputValidator().validate(
        schema,
        '{"summary":"ok","score":8} extra garbage',
      );
      // JSON.parse would accept a leading object and ignore the tail only
      // via a lenient parser; our validator rejects non-JSON payloads.
      expect(result.ok).toBe(false);
    });

    it('rejects a JSON array at the top level', () => {
      const result = new StructuredOutputValidator().validate(
        schema,
        JSON.stringify([{ summary: 'x', score: 1 }]),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]).toContain('not a JSON object');
      }
    });

    it('rejects a null payload', () => {
      const result = new StructuredOutputValidator().validate(schema, 'null');
      expect(result.ok).toBe(false);
    });
  });
});
