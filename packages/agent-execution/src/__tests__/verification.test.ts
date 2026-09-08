// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Verification Tests
// Covers: verified · failed · partial · unknown · blocked, every policy
// kind, deterministic-first (no model call for deterministic kinds),
// and "UNKNOWN is never success".
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type { AgentModelVerifierPort } from '../contracts/agent-execution-ports.js';
import type { AgentObservation, VerificationPolicy } from '../types/agent-execution-types.js';
import { verifyAgainstPolicy, aggregateVerdict } from '../domain/verification.js';
import type { VerificationContext } from '../domain/verification.js';
import { FakeModelVerifier, FakeToolPort, includesRule, rulePolicy } from './fixtures.js';

function ctx(
  output = '',
  artifacts: VerificationContext['artifacts'] = [],
  observations: VerificationContext['observations'] = [],
): VerificationContext {
  return { output, artifacts, observations };
}

describe('aggregateVerdict', () => {
  it('VERIFIED only when every check passes and none is unknown', () => {
    const result = aggregateVerdict([
      { name: 'a', status: 'pass', detail: '' },
      { name: 'b', status: 'pass', detail: '' },
    ]);
    expect(result.verdict).toBe('VERIFIED');
  });

  it('FAILED when any check fails — never masked by passing checks', () => {
    const result = aggregateVerdict([
      { name: 'a', status: 'pass', detail: '' },
      { name: 'b', status: 'fail', detail: 'missing section' },
    ]);
    expect(result.verdict).toBe('FAILED');
  });

  it('PARTIAL when some checks pass but others cannot be evaluated', () => {
    const result = aggregateVerdict([
      { name: 'a', status: 'pass', detail: '' },
      { name: 'b', status: 'unknown', detail: 'no data' },
    ]);
    expect(result.verdict).toBe('PARTIAL');
  });

  it('UNKNOWN when nothing could be evaluated — never treated as success', () => {
    const result = aggregateVerdict([{ name: 'a', status: 'unknown', detail: 'no data' }]);
    expect(result.verdict).toBe('UNKNOWN');
  });

  it('UNKNOWN when there are no checks at all', () => {
    expect(aggregateVerdict([]).verdict).toBe('UNKNOWN');
  });
});

describe('verifyAgainstPolicy', () => {
  it('no policy ⇒ UNKNOWN — a model returning text is NOT proof of success', async () => {
    const result = await verifyAgainstPolicy(undefined, ctx('some model output'));
    expect(result.verdict).toBe('UNKNOWN');
    expect(result.reasons[0]).toContain('no verification policy');
  });

  it('rule includes passes and does not call a model', async () => {
    const verifier = new FakeModelVerifier();
    const result = await verifyAgainstPolicy(
      rulePolicy([includesRule('sections', '## Requirements')]),
      ctx('## Requirements\npresent'),
      { modelVerifier: verifier },
    );
    expect(result.verdict).toBe('VERIFIED');
    expect(verifier.calls).toHaveLength(0);
  });

  it('rule notIncludes + minLength aggregation FAILS honestly', async () => {
    const policy: VerificationPolicy = {
      kind: 'rule',
      description: 'length check',
      checks: [
        { name: 'no-lorem', kind: 'notIncludes', text: 'lorem' },
        { name: 'length', kind: 'minLength', length: 5 },
      ],
    };
    const result = await verifyAgainstPolicy(policy, ctx('no'));
    expect(result.verdict).toBe('FAILED');
    expect(result.checks.find((c) => c.name === 'length')?.status).toBe('fail');
  });

  it('rule checks can target observations instead of output', async () => {
    const policy: VerificationPolicy = {
      kind: 'rule',
      description: 'observation rule',
      checks: [
        { name: 'obs', kind: 'includes', text: 'succeeded: data read', target: 'observations' },
      ],
    };
    const observations: AgentObservation[] = [
      {
        observationId: 'o1',
        actionId: 'a1',
        stepId: 's1',
        runId: 'r1',
        attempt: 1,
        status: 'succeeded',
        resultSummary: 'data read',
        artifacts: [],
        observedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const result = await verifyAgainstPolicy(policy, ctx('', [], observations), {});
    expect(result.verdict).toBe('VERIFIED');
  });

  it('schema policy requires valid JSON with every required key', async () => {
    const policy: VerificationPolicy = {
      kind: 'schema',
      description: 'schema',
      requiredKeys: ['title', 'body'],
    };
    const good = await verifyAgainstPolicy(
      policy,
      ctx(JSON.stringify({ title: 't', body: 'b', extra: 1 })),
    );
    expect(good.verdict).toBe('VERIFIED');

    const missing = await verifyAgainstPolicy(policy, ctx(JSON.stringify({ title: 't' })));
    expect(missing.verdict).toBe('FAILED');
    expect(missing.checks.find((c) => c.name === 'key.body')?.status).toBe('fail');

    const notJson = await verifyAgainstPolicy(policy, ctx('not json at all'));
    expect(notJson.verdict).toBe('FAILED');
    expect(notJson.checks.find((c) => c.name === 'json')?.status).toBe('fail');
  });

  it('artifact policy verifies produced artifacts (name + type)', async () => {
    const policy: VerificationPolicy = {
      kind: 'artifact',
      description: 'report file',
      artifact: { name: 'report.md', type: 'file' },
    };
    const ok = await verifyAgainstPolicy(policy, ctx('x', [{ name: 'report.md', type: 'file' }]));
    expect(ok.verdict).toBe('VERIFIED');

    const wrongType = await verifyAgainstPolicy(
      policy,
      ctx('x', [{ name: 'report.md', type: 'json' }]),
    );
    expect(wrongType.verdict).toBe('FAILED');

    const absent = await verifyAgainstPolicy(policy, ctx('x', []));
    expect(absent.verdict).toBe('FAILED');
  });

  it('state policy checks artifact created/absent', async () => {
    const created: VerificationPolicy = {
      kind: 'state',
      description: 'file created',
      state: { artifactName: 'out.txt', change: 'created' },
    };
    const absent: VerificationPolicy = {
      kind: 'state',
      description: 'temp file removed',
      state: { artifactName: 'tmp.tmp', change: 'absent' },
    };
    expect(
      (await verifyAgainstPolicy(created, ctx('x', [{ name: 'out.txt', type: 'file' }]))).verdict,
    ).toBe('VERIFIED');
    expect((await verifyAgainstPolicy(created, ctx('x', []))).verdict).toBe('FAILED');
    expect((await verifyAgainstPolicy(absent, ctx('x', []))).verdict).toBe('VERIFIED');
    expect(
      (await verifyAgainstPolicy(absent, ctx('x', [{ name: 'tmp.tmp', type: 'file' }]))).verdict,
    ).toBe('FAILED');
  });

  it('command policy runs a tool deterministically (ok / fails)', async () => {
    const tools = new FakeToolPort({
      results: new Map([
        ['test.run', { ok: true, denied: false, outcome: '3 passed' }],
        ['lint.run', { ok: false, denied: false, outcome: '', error: '2 lint errors' }],
      ]),
    });
    const expectOk: VerificationPolicy = {
      kind: 'command',
      description: 'tests pass',
      command: { toolName: 'test.run', expect: 'ok' },
    };
    const expectFail: VerificationPolicy = {
      kind: 'command',
      description: 'lint should pass',
      command: { toolName: 'lint.run', expect: 'ok' },
    };
    expect((await verifyAgainstPolicy(expectOk, ctx(''), { tools })).verdict).toBe('VERIFIED');
    expect((await verifyAgainstPolicy(expectFail, ctx(''), { tools })).verdict).toBe('FAILED');
  });

  it('denied verification command ⇒ BLOCKED (permission never bypassed)', async () => {
    const tools = new FakeToolPort({
      results: new Map([['deploy.run', { ok: false, denied: true, outcome: 'denied' }]]),
    });
    const policy: VerificationPolicy = {
      kind: 'command',
      description: 'deploy check',
      command: { toolName: 'deploy.run', expect: 'ok' },
    };
    const result = await verifyAgainstPolicy(policy, ctx(''), { tools });
    expect(result.verdict).toBe('BLOCKED');
  });

  it('command policy without a tool port ⇒ UNKNOWN, not success', async () => {
    const policy: VerificationPolicy = {
      kind: 'command',
      description: 'tests pass',
      command: { toolName: 'test.run', expect: 'ok' },
    };
    const result = await verifyAgainstPolicy(policy, ctx(''));
    expect(result.verdict).toBe('UNKNOWN');
  });

  it('model policy uses the verifier ONLY when declared', async () => {
    const verifier: AgentModelVerifierPort = new FakeModelVerifier({
      verify: () => ({
        passed: false,
        checks: [{ name: 'coherence', passed: false, detail: 'contradictory claims' }],
      }),
    });
    const policy: VerificationPolicy = {
      kind: 'model',
      description: 'coherence review',
      criteria: ['coherence'],
    };
    const result = await verifyAgainstPolicy(policy, ctx('text'), { modelVerifier: verifier });
    expect(result.verdict).toBe('FAILED');
    expect(result.checks[0]?.status).toBe('fail');
  });

  it('model policy without a verifier ⇒ UNKNOWN — never auto-pass', async () => {
    const policy: VerificationPolicy = {
      kind: 'model',
      description: 'coherence review',
      criteria: ['coherence'],
    };
    const result = await verifyAgainstPolicy(policy, ctx('text'), {});
    expect(result.verdict).toBe('UNKNOWN');
  });

  it('deterministic kinds never invoke the model verifier', async () => {
    const verifier = new FakeModelVerifier();
    const policy: VerificationPolicy = {
      kind: 'rule',
      description: 'marker',
      checks: [{ name: 'm', kind: 'includes', text: 'DONE' }],
    };
    await verifyAgainstPolicy(policy, ctx('DONE'), { modelVerifier: verifier });
    expect(verifier.calls).toHaveLength(0);
  });
});
