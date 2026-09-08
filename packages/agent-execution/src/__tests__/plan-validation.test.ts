// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Plan Validation Tests
// Covers: valid plan · invalid plan (dup ids, unknown deps, cycles,
// empty actions) · tool allowlist enforcement · impossible capabilities ·
// unavailable tools — a plan must never execute an impossible step.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { validatePlanReadiness, validatePlanStructure } from '../domain/PlanValidator.js';
import {
  aiAction,
  FakeAiPort,
  FakeToolRegistry,
  includesRule,
  plan,
  rulePolicy,
  step,
  toolAction,
} from './fixtures.js';

describe('validatePlanStructure', () => {
  it('accepts a valid multi-step dependency plan', () => {
    const p = plan(
      'g1',
      'research then write',
      [
        step('research', 'research', [aiAction('a1', 'reasoning', 'research')]),
        step(
          'write',
          'write',
          [aiAction('a2', 'content_generation', 'write {outputOf:research}')],
          {
            dependencies: ['research'],
          },
        ),
      ],
      rulePolicy([includesRule('done', 'DONE')]),
    );
    expect(validatePlanStructure(p)).toEqual([]);
  });

  it('rejects an empty plan', () => {
    const issues = validatePlanStructure(plan('g1', 'nothing', []));
    expect(issues.some((i) => i.code === 'PLAN_EMPTY')).toBe(true);
  });

  it('rejects duplicate step ids and duplicate action ids', () => {
    const p = plan('g1', 'dup', [
      step('x', 'first', [aiAction('a1', 'reasoning', 'do')]),
      step('x', 'second', [aiAction('a1', 'reasoning', 'do again')]),
    ]);
    const codes = validatePlanStructure(p).map((i) => i.code);
    expect(codes).toContain('STEP_DUPLICATE_ID');
    expect(codes).toContain('ACTION_DUPLICATE_ID');
  });

  it('rejects a step with no actions', () => {
    const issues = validatePlanStructure(plan('g1', 'empty step', [step('x', 'nothing', [])]));
    expect(issues.some((i) => i.code === 'STEP_NO_ACTIONS')).toBe(true);
  });

  it('rejects unknown dependencies and dependency cycles', () => {
    const unknown = plan('g1', 'deps', [
      step('x', 'x', [aiAction('a1', 'reasoning', 'x')], { dependencies: ['ghost'] }),
    ]);
    expect(validatePlanStructure(unknown).some((i) => i.code === 'DEPENDENCY_UNKNOWN')).toBe(true);

    const cyclic = plan('g1', 'cycle', [
      step('a', 'a', [aiAction('a1', 'reasoning', 'a')], { dependencies: ['c'] }),
      step('b', 'b', [aiAction('a2', 'reasoning', 'b')], { dependencies: ['a'] }),
      step('c', 'c', [aiAction('a3', 'reasoning', 'c')], { dependencies: ['b'] }),
    ]);
    expect(validatePlanStructure(cyclic).some((i) => i.code === 'DEPENDENCY_CYCLE')).toBe(true);
  });

  it('rejects a tool action outside the step allowlist (arbitrary tools never run)', () => {
    const p = plan('g1', 'tool', [
      step('x', 'read', [toolAction('t1', 'fs.read')], { allowedTools: [] }),
    ]);
    const issues = validatePlanStructure(p);
    expect(issues.some((i) => i.code === 'TOOL_NOT_ALLOWED' && i.stepId === 'x')).toBe(true);
  });

  it('warns when a recovery alternate tool is outside the allowlist', () => {
    const p = plan('g1', 'tool', [
      step('x', 'read', [toolAction('t1', 'readerA')], {
        allowedTools: ['readerA'],
        recoveryPolicy: { alternateTools: ['readerB'] },
      }),
    ]);
    expect(validatePlanStructure(p).some((i) => i.code === 'ALT_TOOL_NOT_ALLOWED')).toBe(true);
  });
});

describe('validatePlanReadiness', () => {
  it('flags an impossible capability (vision required, no vision-capable model)', async () => {
    const ai = new FakeAiPort({ unroutable: ['vision'] });
    const p = plan('g1', 'see', [
      step('see', 'describe image', [aiAction('a1', 'vision', 'describe')]),
    ]);
    const issues = await validatePlanReadiness(p, { ai });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('CAPABILITY_NOT_ROUTABLE');
    expect(issues[0]?.message).toContain('no eligible model');
  });

  it('flags an unavailable tool but only for that step', async () => {
    const registry = new FakeToolRegistry([{ toolName: 'fs.read', permissionClass: 'READ' }]);
    const p = plan('g1', 'read', [
      step('a', 'ai part', [aiAction('a1', 'reasoning', 'think')], {
        verificationPolicy: rulePolicy([includesRule('ok', 'OK')]),
      }),
      step('b', 'gh part', [toolAction('t1', 'gh')], { allowedTools: ['gh'] }),
    ]);
    const issues = await validatePlanReadiness(p, { toolRegistry: registry });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.stepId).toBe('b');
    expect(issues[0]?.code).toBe('TOOL_UNAVAILABLE');
  });

  it('skips readiness checks when the optional ports are absent', async () => {
    const p = plan('g1', 'plain', [step('a', 'ai', [aiAction('a1', 'coding', 'code')])]);
    expect(await validatePlanReadiness(p, {})).toEqual([]);
  });

  it('does not flag capabilities the runtime can route', async () => {
    const ai = new FakeAiPort();
    const p = plan('g1', 'code', [
      step('code', 'write code', [aiAction('a1', 'coding', 'code', ['coding', 'reasoning'])]),
    ]);
    expect(await validatePlanReadiness(p, { ai })).toEqual([]);
  });
});
