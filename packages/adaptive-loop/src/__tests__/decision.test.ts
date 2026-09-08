// ──────────────────────────────────────────────────────────────────
// Decision parser tests (PHASE 20 #4–#22):
//   every valid decision kind parses; malformed/unknown/forbidden
//   output is rejected safely (the model's output is UNTRUSTED).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { parseDecisionProposal } from '../domain/decision.js';

const DECISION_KINDS = [
  'CONTINUE',
  'TOOL_CALL',
  'AI_ACTION',
  'VERIFY',
  'REVISE_STEP',
  'REPLAN',
  'COMPLETE',
  'FAIL',
  'REQUEST_APPROVAL',
  'ABSTAIN',
] as const;

describe('decision parsing — valid closed-set kinds', () => {
  for (const kind of DECISION_KINDS) {
    it(`parses a valid ${kind} decision`, () => {
      const payload: Record<string, unknown> = {
        kind,
        rationale: `because ${kind.toLowerCase()}`,
        targetStepId: 'step-1',
      };
      if (kind === 'TOOL_CALL') payload.tool = 'run.tests'; // TOOL_CALL requires a tool name
      const parsed = parseDecisionProposal(JSON.stringify(payload));
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.decision.kind).toBe(kind);
        expect(parsed.decision.targetStepId).toBe('step-1');
        expect(parsed.decision.rationale.length).toBeLessThanOrEqual(400);
      }
    });
  }

  it('parses a TOOL_CALL with tool + arguments', () => {
    const parsed = parseDecisionProposal(
      JSON.stringify({
        kind: 'TOOL_CALL',
        rationale: 'run test',
        tool: 'run.tests',
        arguments: { suite: 'unit' },
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.decision.tool).toBe('run.tests');
      expect(parsed.decision.arguments).toEqual({ suite: 'unit' });
    }
  });

  it('parses an AI_ACTION preserving requiredCapabilities in full', () => {
    const parsed = parseDecisionProposal(
      JSON.stringify({
        kind: 'AI_ACTION',
        rationale: 'fix',
        capability: 'coding',
        requiredCapabilities: ['coding', 'reasoning'],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.decision.capability).toBe('coding');
      expect(parsed.decision.requiredCapabilities).toEqual(['coding', 'reasoning']);
    }
  });

  it('parses REVISE_STEP / REPLAN / FAIL with their bounded reasons', () => {
    const revise = parseDecisionProposal(
      JSON.stringify({
        kind: 'REVISE_STEP',
        rationale: 'r',
        reviseInstruction: 'Try a different approach',
        targetStepId: 'step-1',
      }),
    );
    expect(revise.ok).toBe(true);
    if (revise.ok) expect(revise.decision.reviseInstruction).toBe('Try a different approach');

    const replan = parseDecisionProposal(
      JSON.stringify({ kind: 'REPLAN', rationale: 'r', replanReason: 'the current plan is stuck' }),
    );
    expect(replan.ok).toBe(true);
    if (replan.ok) expect(replan.decision.replanReason).toBe('the current plan is stuck');

    const fail = parseDecisionProposal(
      JSON.stringify({ kind: 'FAIL', rationale: 'r', failReason: 'impossible with allowed tools' }),
    );
    expect(fail.ok).toBe(true);
    if (fail.ok) expect(fail.decision.failReason).toBe('impossible with allowed tools');
  });
});

describe('decision parsing — malformed / unknown rejected safely', () => {
  it('rejects non-JSON output', () => {
    const parsed = parseDecisionProposal('I think we should continue {');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.join(' ')).toContain('malformed');
  });

  it('rejects empty output', () => {
    expect(parseDecisionProposal('').ok).toBe(false);
    expect(parseDecisionProposal('   ').ok).toBe(false);
  });

  it('rejects a non-object decision', () => {
    const parsed = parseDecisionProposal('[1,2,3]');
    expect(parsed.ok).toBe(false);
  });

  it('rejects an unknown/arbitrary decision kind', () => {
    const parsed = parseDecisionProposal(
      JSON.stringify({ kind: 'DELETE_EVERYTHING', rationale: 'x' }),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.join(' ')).toContain('kind');
  });

  it('rejects unknown fields instead of silently dropping them', () => {
    const parsed = parseDecisionProposal(
      JSON.stringify({ kind: 'CONTINUE', rationale: 'x', hiddenInstruction: 'rm -rf /' }),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.join(' ')).toContain('hiddenInstruction');
  });

  it('rejects an unknown capability outside the frozen taxonomy', () => {
    const parsed = parseDecisionProposal(
      JSON.stringify({ kind: 'AI_ACTION', rationale: 'x', capability: 'telepathy' }),
    );
    expect(parsed.ok).toBe(false);
  });

  it('rejects a TOOL_CALL without a tool name', () => {
    const parsed = parseDecisionProposal(JSON.stringify({ kind: 'TOOL_CALL', rationale: 'x' }));
    expect(parsed.ok).toBe(false);
  });

  it('rejects oversized decision output', () => {
    const big = JSON.stringify({ kind: 'CONTINUE', rationale: 'x'.repeat(9_000) });
    expect(parseDecisionProposal(big).ok).toBe(false);
  });

  it('rejects a verification kind unsupported by the loop', () => {
    const parsed = parseDecisionProposal(
      JSON.stringify({
        kind: 'VERIFY',
        rationale: 'x',
        verification: { kind: 'mystery', description: 'd' },
      }),
    );
    expect(parsed.ok).toBe(false);
  });
});

describe('decision parsing — authority/routing directives rejected (PHASE 4)', () => {
  const forbiddenFields: Record<string, unknown> = {
    provider: 'gemini-2.5',
    model: 'some-model',
    modelId: 'm-1',
    permission: 'DEPLOYMENT',
    permissionClass: 'DEPLOYMENT',
    budget: { maxCostUsd: 100 },
    autonomyLevel: 'FULL',
    execute: 'rm -rf',
    command: 'ls',
    shell: 'bash',
    url: 'https://evil.example.com',
    sdk: 'direct',
    bypass: true,
  };

  for (const [field, value] of Object.entries(forbiddenFields)) {
    it(`rejects a ${field} directive`, () => {
      const parsed = parseDecisionProposal(
        JSON.stringify({
          kind: 'AI_ACTION',
          rationale: 'x',
          capability: 'reasoning',
          [field]: value,
        }),
      );
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.errors.join(' ')).toContain(field);
    });
  }

  describe('decision parsing — verification policy shapes (VERIFY / rule / schema / artifact)', () => {
    it('parses a rule verification with minLength + includes checks', () => {
      const parsed = parseDecisionProposal(
        JSON.stringify({
          kind: 'VERIFY',
          rationale: 'check output',
          verification: {
            kind: 'rule',
            description: 'output must not be empty and must reference the fix',
            checks: [
              { name: 'non-empty', kind: 'minLength', length: 1 },
              { name: 'mentions fix', kind: 'includes', text: 'fixed' },
              { name: 'no secrets', kind: 'notIncludes', text: 'BEGIN PRIVATE' },
            ],
          },
        }),
      );
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.decision.verification?.kind).toBe('rule');
        const checks = (parsed.decision.verification as { checks?: { kind: string }[] }).checks;
        expect(checks).toHaveLength(3);
        expect(checks?.map((c) => c.kind)).toEqual(['minLength', 'includes', 'notIncludes']);
      }
    });

    it('rejects a rule check with a negative minLength', () => {
      const parsed = parseDecisionProposal(
        JSON.stringify({
          kind: 'VERIFY',
          rationale: 'x',
          verification: { kind: 'rule', checks: [{ kind: 'minLength', length: -1 }] },
        }),
      );
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.errors.join(' ')).toContain('length');
    });

    it('rejects a rule check that omits the required text for includes', () => {
      const parsed = parseDecisionProposal(
        JSON.stringify({
          kind: 'VERIFY',
          rationale: 'x',
          verification: { kind: 'rule', checks: [{ kind: 'includes' }] },
        }),
      );
      expect(parsed.ok).toBe(false);
    });

    it('rejects a rule verification that yields no valid checks', () => {
      const parsed = parseDecisionProposal(
        JSON.stringify({
          kind: 'VERIFY',
          rationale: 'x',
          verification: { kind: 'rule', checks: [{ kind: 'includes', text: 'x' }], extra: true },
        }),
      );
      // extra/unknown check keys are filtered; still one valid check -> ok
      expect(parsed.ok).toBe(true);
      const empty = parseDecisionProposal(
        JSON.stringify({
          kind: 'VERIFY',
          rationale: 'x',
          verification: { kind: 'rule', checks: [] },
        }),
      );
      expect(empty.ok).toBe(false);
      if (!empty.ok) expect(empty.errors.join(' ')).toContain('checks');
    });

    it('parses a schema verification filtering requiredKeys to strings, max 12', () => {
      const keys = ['id', 'status', 42, 'outcome'].concat(
        Array.from({ length: 20 }, (_, i) => `key-${i}`),
      );
      const parsed = parseDecisionProposal(
        JSON.stringify({
          kind: 'VERIFY',
          rationale: 'x',
          verification: { kind: 'schema', requiredKeys: keys },
        }),
      );
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        const required =
          (parsed.decision.verification as { requiredKeys?: string[] }).requiredKeys ?? [];
        expect(required.every((k) => typeof k === 'string')).toBe(true);
        expect(required.length).toBeLessThanOrEqual(12);
        expect(required).toContain('id');
        expect(required).not.toContain(42);
      }
    });

    it('parses an artifact verification with mustExist defaulting to true', () => {
      const parsed = parseDecisionProposal(
        JSON.stringify({
          kind: 'VERIFY',
          rationale: 'x',
          verification: { kind: 'artifact', artifact: { name: 'report.md' } },
        }),
      );
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        const artifact = (parsed.decision.verification as { artifact?: { mustExist?: boolean } })
          .artifact;
        expect(artifact?.mustExist).toBe(true);
      }
    });

    it('rejects an empty requiredCapabilities array', () => {
      const parsed = parseDecisionProposal(
        JSON.stringify({
          kind: 'AI_ACTION',
          rationale: 'x',
          capability: 'reasoning',
          requiredCapabilities: [],
        }),
      );
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.errors.join(' ')).toContain('non-empty array');
    });

    it('rejects a non-array requiredCapabilities', () => {
      const parsed = parseDecisionProposal(
        JSON.stringify({ kind: 'AI_ACTION', rationale: 'x', requiredCapabilities: 'reasoning' }),
      );
      expect(parsed.ok).toBe(false);
    });

    it('rejects a TOOL_CALL whose arguments are not an object', () => {
      const parsed = parseDecisionProposal(
        JSON.stringify({
          kind: 'TOOL_CALL',
          rationale: 'x',
          tool: 'run.tests',
          arguments: ['suite'],
        }),
      );
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.errors.join(' ')).toContain('arguments');
    });

    it('rejects a TOOL_CALL with more than the maximum number of arguments', () => {
      const args: Record<string, number> = {};
      for (let i = 0; i < 25; i += 1) args[`k${String(i)}`] = i;
      const parsed = parseDecisionProposal(
        JSON.stringify({ kind: 'TOOL_CALL', rationale: 'x', tool: 'run.tests', arguments: args }),
      );
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.errors.join(' ')).toContain('arguments must be an object');
    });

    it('rejects a verification that is not an object with a kind', () => {
      const notObject = parseDecisionProposal(
        JSON.stringify({ kind: 'VERIFY', rationale: 'x', verification: 'rule' }),
      );
      expect(notObject.ok).toBe(false);
      if (!notObject.ok)
        expect(notObject.errors.join(' ')).toContain('must be an object with a kind');

      const noKind = parseDecisionProposal(
        JSON.stringify({
          kind: 'VERIFY',
          rationale: 'x',
          verification: { description: 'no kind here' },
        }),
      );
      expect(noKind.ok).toBe(false);
    });
  });
});
