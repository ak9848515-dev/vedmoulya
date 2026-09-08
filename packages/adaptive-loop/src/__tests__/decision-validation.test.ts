// ──────────────────────────────────────────────────────────────────
// Decision validation tests (PHASE 20 #14–#22):
//   unknown/unauthorized tools, capability escalation, permission and
//   governance gates. Validation runs on the PARSED decision (still
//   untrusted) before any proposal can exist.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { validateDecision, allowedCapabilitiesForStep } from '../domain/decision-validation.js';
import type { DecisionValidationContext } from '../domain/decision-validation.js';
import {
  aiStep,
  simplePlan,
  toolStep,
  makeToolRegistry,
  type FakeToolRegistry,
} from './fixtures.js';
import type { AdaptiveDecision } from '../types/adaptive-loop-types.js';

function decision(
  partial: Partial<AdaptiveDecision> & { kind: AdaptiveDecision['kind'] },
): AdaptiveDecision {
  return {
    decisionId: 'decision-1',
    rationale: 'test',
    ...partial,
  };
}

function baseCtx(overrides: Partial<DecisionValidationContext> = {}): DecisionValidationContext {
  return {
    plan: simplePlan(),
    allowedCapabilities: ['reasoning'],
    allowedTools: ['read.files'],
    grantedPermissionClasses: ['READ'],
    autonomyLevel: 'SUPERVISED',
    revisionsRemaining: 2,
    replansRemaining: 2,
    ...overrides,
  };
}

describe('decision validation — capabilities (PHASE 6)', () => {
  it('accepts a capability already allowed by the plan', () => {
    const ctx = baseCtx({ allowedCapabilities: ['reasoning'] });
    const result = validateDecision(decision({ kind: 'AI_ACTION', capability: 'reasoning' }), ctx);
    expect(result.ok).toBe(true);
  });

  it('preserves requiredCapabilities in FULL (never collapsed)', () => {
    const ctx = baseCtx({ allowedCapabilities: ['coding', 'reasoning'] });
    const result = validateDecision(
      decision({
        kind: 'AI_ACTION',
        capability: 'coding',
        requiredCapabilities: ['coding', 'reasoning'],
      }),
      ctx,
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a capability escalation outside the plan whitelist', () => {
    const ctx = baseCtx({ allowedCapabilities: ['coding', 'reasoning'] });
    const result = validateDecision(decision({ kind: 'AI_ACTION', capability: 'vision' }), ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejectionReasons.join(' ')).toContain('CAPABILITY_ESCALATION');
  });

  it('rejects escalation hidden inside requiredCapabilities', () => {
    const ctx = baseCtx({ allowedCapabilities: ['coding'] });
    const result = validateDecision(
      decision({
        kind: 'AI_ACTION',
        capability: 'coding',
        requiredCapabilities: ['coding', 'content_generation'],
      }),
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejectionReasons.join(' ')).toContain('CAPABILITY_ESCALATION');
  });
});

describe('decision validation — tools (PHASE 7)', () => {
  const registry: FakeToolRegistry = makeToolRegistry({
    'read.files': { permissionClass: 'READ' },
    'git.push': { permissionClass: 'DEPLOYMENT', requiresApproval: true },
  });

  it('accepts a registered, permitted, low-risk tool', () => {
    const ctx = baseCtx({
      allowedTools: ['read.files'],
      grantedPermissionClasses: ['READ'],
      toolRegistry: registry,
    });
    const result = validateDecision(
      decision({ kind: 'TOOL_CALL', tool: 'read.files', arguments: { path: '.' } }),
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(result.permissionClass).toBe('READ');
    expect(result.requiresApproval).toBe(false);
  });

  it('rejects an unknown tool not exposed by the authoritative registry', () => {
    const ctx = baseCtx({
      allowedTools: ['read.files'],
      grantedPermissionClasses: ['READ'],
      toolRegistry: registry,
    });
    const result = validateDecision(decision({ kind: 'TOOL_CALL', tool: 'fabricated.tool' }), ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejectionReasons.join(' ')).toContain('TOOL_UNAVAILABLE');
  });

  it('rejects an unauthorized tool outside the principal allowlist', () => {
    const ctx = baseCtx({
      allowedTools: ['read.files'],
      grantedPermissionClasses: ['READ'],
      toolRegistry: registry,
    });
    const result = validateDecision(decision({ kind: 'TOOL_CALL', tool: 'read.files' }), ctx);
    // allowedTools contains read.files so this passes; use a different tool:
    const ctxDeny = baseCtx({
      allowedTools: ['other.tool'],
      grantedPermissionClasses: ['READ'],
      toolRegistry: makeToolRegistry({ 'read.files': { permissionClass: 'READ' } }),
    });
    const denied = validateDecision(decision({ kind: 'TOOL_CALL', tool: 'read.files' }), ctxDeny);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.rejectionReasons.join(' ')).toContain('UNAUTHORIZED_TOOL');
  });

  it('rejects a tool whose permission class is not granted to the principal', () => {
    const ctx = baseCtx({
      allowedTools: ['git.push'],
      grantedPermissionClasses: ['READ'],
      toolRegistry: registry,
    });
    const result = validateDecision(decision({ kind: 'TOOL_CALL', tool: 'git.push' }), ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejectionReasons.join(' ')).toContain('PERMISSION_DENIED');
  });

  it('flags high-risk / approval-required tools for governance (never auto-executed)', () => {
    const ctx = baseCtx({
      allowedTools: ['git.push'],
      grantedPermissionClasses: ['DEPLOYMENT'],
      toolRegistry: registry,
    });
    const result = validateDecision(decision({ kind: 'TOOL_CALL', tool: 'git.push' }), ctx);
    expect(result.ok).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it('gates EVERY tool behind approval under ASSISTED autonomy', () => {
    const ctx = baseCtx({
      allowedTools: ['read.files'],
      grantedPermissionClasses: ['READ'],
      toolRegistry: registry,
      autonomyLevel: 'ASSISTED',
    });
    const result = validateDecision(decision({ kind: 'TOOL_CALL', tool: 'read.files' }), ctx);
    expect(result.ok).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });
});

describe('decision validation — REVISE_STEP / REPLAN scope (PHASE 13/14)', () => {
  it('accepts a bounded REVISE_STEP that touches only the approach', () => {
    const ctx = baseCtx({ revisionsRemaining: 1 });
    const result = validateDecision(
      decision({
        kind: 'REVISE_STEP',
        reviseInstruction: 'different approach',
        targetStepId: 'step-1',
      }),
      ctx,
    );
    expect(result.ok).toBe(true);
  });

  it('rejects REVISE_STEP with no revisions remaining', () => {
    const ctx = baseCtx({ revisionsRemaining: 0 });
    const result = validateDecision(decision({ kind: 'REVISE_STEP', targetStepId: 'step-1' }), ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejectionReasons.join(' ')).toContain('REVISION_BUDGET_EXCEEDED');
  });

  it('rejects REVISE_STEP that tries to change capability authority', () => {
    const ctx = baseCtx({ revisionsRemaining: 1 });
    const result = validateDecision(
      decision({ kind: 'REVISE_STEP', capability: 'coding', targetStepId: 'step-1' }),
      ctx,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects REPLAN with no replans remaining', () => {
    const ctx = baseCtx({ replansRemaining: 0 });
    const result = validateDecision(decision({ kind: 'REPLAN', replanReason: 'stuck' }), ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejectionReasons.join(' ')).toContain('REPLAN_BUDGET_EXCEEDED');
  });

  it('rejects REPLAN that tries to introduce capabilities', () => {
    const ctx = baseCtx({ replansRemaining: 1, allowedCapabilities: ['reasoning'] });
    const result = validateDecision(
      decision({ kind: 'REPLAN', capability: 'vision', replanReason: 'x' }),
      ctx,
    );
    expect(result.ok).toBe(false);
  });
});

describe('allowedCapabilitiesForStep — the plan whitelist is authoritative', () => {
  it('unions step + action declared capabilities in full', () => {
    const step = aiStep('step-1', {
      capability: 'coding',
      requiredCapabilities: ['coding', 'reasoning'],
    });
    const plan = simplePlan({ steps: [step] });
    const caps = allowedCapabilitiesForStep(plan, step);
    expect(caps).toContain('coding');
    expect(caps).toContain('reasoning');
  });

  it('includes tool-declaring steps via their plan capability surface', () => {
    const step = toolStep('step-1', { toolName: 'read.files' });
    const plan = simplePlan({ steps: [step] });
    expect(allowedCapabilitiesForStep(plan, step)).toContain('reasoning');
  });
});

describe('decision validation — scope guards on REVISE_STEP / REPLAN / AI_ACTION', () => {
  it('rejects a REVISE_STEP that tries to change verification/governance requirements', () => {
    const ctx = baseCtx({ revisionsRemaining: 2 });
    const result = validateDecision(
      decision({
        kind: 'REVISE_STEP',
        targetStepId: 'step-1',
        reviseInstruction: 'try harder',
        verification: {
          kind: 'rule',
          description: 'self-granted gate',
          checks: [{ kind: 'minLength', length: 1 }],
        },
      }),
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.rejectionReasons.join(' ')).toContain('may not change verification');
  });

  it('rejects a REPLAN that tries to propose tools directly', () => {
    const ctx = baseCtx({ replansRemaining: 2 });
    const result = validateDecision(
      decision({ kind: 'REPLAN', replanReason: 'stuck', tool: 'read.files' }),
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.rejectionReasons.join(' ')).toContain('may not propose tools');
  });

  it('rejects an AI_ACTION with no capability at all', () => {
    const result = validateDecision(decision({ kind: 'AI_ACTION' }), baseCtx());
    expect(result.ok).toBe(false);
    expect(result.rejectionReasons.join(' ')).toContain('AI_ACTION requires a capability');
  });
});
