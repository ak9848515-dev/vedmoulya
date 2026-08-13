// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Bounded Repair Loop (Phase 11)
// EPIC-008 — repair-loop UI contract. The engine validates, applies
// deterministic patches, and re-validates — capped at MAX_REPAIR_ATTEMPTS
// (6). A fixable failure converges to READY with every attempt recorded
// (diagnosis → patches → result) for the UI; an unfixable failure must
// NEVER pretend the application is ready: it ends FAILED with
// REPAIR_LIMIT_REACHED and the attempts persisted.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { FactoryEngine, MAX_REPAIR_ATTEMPTS } from '../FactoryEngine.js';
import { ValidationPipeline } from '../ValidationPipeline.js';
import { makePorts } from './fixtures.js';
import type { ValidationContext, ValidationOptions } from '../ValidationPipeline.js';
import type { ValidationReport } from '../../types/app-types.js';

/** A validation stub that NEVER passes: every run reports FAIL and proposes
 *  a new deterministic patch. Used to prove the loop is bounded (it cannot
 *  spin forever) and terminates in REPAIR_LIMIT_REACHED. */
class NeverPassingValidation extends ValidationPipeline {
  private runs = 0;

  override run(
    ctx: ValidationContext,
    options: ValidationOptions = {},
  ): { report: ValidationReport; fixes: Array<{ path: string; reason: string }> } {
    this.runs += 1;
    const report: ValidationReport = {
      applicationId: ctx.applicationId,
      gates: [
        {
          gate: 'lint',
          passed: false,
          findings: [`stub gate ${this.runs}: unfixable lint finding`],
          score: 0,
        },
      ],
      overall: 'FAIL',
      automaticFixesApplied: 0,
      createdAt: new Date().toISOString(),
    };
    // A fresh patch path each run so the loop always has something to try.
    return {
      report,
      fixes: [{ path: `src/stub-fix-${this.runs}.ts`, reason: 'stub deterministic patch' }],
    };
  }
}

/** A validation stub that fails ONCE with a deterministic fix, then passes
 *  after the patch is applied — proving diagnose → patch → re-validate →
 *  READY with exactly one recorded attempt. */
class FailsOnceThenPassesValidation extends ValidationPipeline {
  private runs = 0;

  override run(
    ctx: ValidationContext,
    options: ValidationOptions = {},
  ): { report: ValidationReport; fixes: Array<{ path: string; reason: string }> } {
    this.runs += 1;
    if (this.runs === 1) {
      return {
        report: {
          applicationId: ctx.applicationId,
          gates: [
            {
              gate: 'unit_tests',
              passed: false,
              findings: ['stub: missing src/repair-fix.ts'],
              score: 0,
            },
          ],
          overall: 'FAIL',
          automaticFixesApplied: 0,
          createdAt: new Date().toISOString(),
        },
        fixes: [{ path: 'src/repair-fix.ts', reason: 'stub deterministic patch' }],
      };
    }
    return {
      report: {
        applicationId: ctx.applicationId,
        gates: [
          {
            gate: 'unit_tests',
            passed: true,
            findings: [],
            score: 1,
          },
        ],
        overall: 'PASS',
        automaticFixesApplied: 0,
        createdAt: new Date().toISOString(),
      },
      fixes: [],
    };
  }
}

/** A validation stub that proposes a fix the execution policy can never apply
 *  (a SECRET_ACCESS path — `.env` — which the default policy classifies as
 *  requiresApproval and not granted). Proves the repair loop stops instead of
 *  spinning the remaining attempts pointlessly. */
class UnappliableFixValidation extends ValidationPipeline {
  override run(
    ctx: ValidationContext,
    options: ValidationOptions = {},
  ): { report: ValidationReport; fixes: Array<{ path: string; reason: string }> } {
    return {
      report: {
        applicationId: ctx.applicationId,
        gates: [
          {
            gate: 'lint',
            passed: false,
            findings: ['stub: secret path cannot be written without authorization'],
            score: 0,
          },
        ],
        overall: 'FAIL',
        automaticFixesApplied: 0,
        createdAt: new Date().toISOString(),
      },
      fixes: [{ path: 'src/.env', reason: 'stub unappliable fix (SECRET_ACCESS)' }],
    };
  }
}

function makeEngine(validation?: ValidationPipeline) {
  const ports = makePorts({});
  const engine = new FactoryEngine({
    ...ports,
    versionControl: ports.versionControl,
    deployments: ports.deployments,
    validation,
  });
  return engine;
}

async function buildToReady(goal: string): Promise<Awaited<ReturnType<FactoryEngine['build']>>> {
  const engine = makeEngine();
  const project = await engine.create({ goal, owner: 'u1' });
  await engine.approve(project.applicationId, 'u1');
  return engine.build({ applicationId: project.applicationId, owner: 'u1', approved: true });
}

describe('FactoryEngine — bounded repair loop (EPIC-008 Phase 11)', () => {
  it('a fixable failure converges to READY with every attempt recorded', async () => {
    const built = await buildToReady('Build a modern restaurant ordering application.');
    expect(built.status).toBe('READY');
    expect(built.lastValidation?.overall).toBe('PASS');
    expect(built.repairLimit).toBe(MAX_REPAIR_ATTEMPTS);
    // The UI counter contract: attempts are 1-based, ordered, capped at 6.
    for (const [index, attempt] of (built.repairAttempts ?? []).entries()) {
      expect(attempt.attempt).toBe(index + 1);
      expect(attempt.limit).toBe(MAX_REPAIR_ATTEMPTS);
      expect(attempt.diagnosis.overall).toBeDefined();
      expect(attempt.result.overall).toBeDefined();
    }
    expect(built.repairLimitReached).toBeFalsy();
    expect(built.terminationReason).not.toBe('REPAIR_LIMIT_REACHED');
  });

  it('diagnose → patch → re-validate → READY: one attempt recorded when a deterministic fix resolves the failure', async () => {
    const engine = makeEngine(new FailsOnceThenPassesValidation());
    const project = await engine.create({
      goal: 'Build a modern restaurant ordering application.',
      owner: 'u1',
    });
    await engine.approve(project.applicationId, 'u1');
    const built = await engine.build({
      applicationId: project.applicationId,
      owner: 'u1',
      approved: true,
    });

    expect(built.status).toBe('READY');
    expect(built.lastValidation?.overall).toBe('PASS');
    expect(built.repairLimitReached).toBeFalsy();
    expect(built.terminationReason).not.toBe('REPAIR_LIMIT_REACHED');
    // Exactly one bounded attempt, and it healed the failure.
    expect(built.repairAttempts).toHaveLength(1);
    const attempt = built.repairAttempts![0]!;
    expect(attempt.attempt).toBe(1);
    expect(attempt.limit).toBe(MAX_REPAIR_ATTEMPTS);
    expect(attempt.diagnosis.overall).toBe('FAIL');
    expect(attempt.patches).toEqual([
      { path: 'src/repair-fix.ts', reason: 'stub deterministic patch' },
    ]);
    expect(attempt.result.overall).toBe('PASS');
  });

  it('no-op repairs do not spin: an unappliable fix stops the loop and reports VALIDATION_FAILURE, not REPAIR_LIMIT_REACHED', async () => {
    // A stub proposing a fix for a path that cannot be applied under the
    // policy (an absolute root path) must not burn 6 identical attempts.
    const engine = makeEngine(new UnappliableFixValidation());
    const project = await engine.create({
      goal: 'Build a modern restaurant ordering application.',
      owner: 'u1',
    });
    await engine.approve(project.applicationId, 'u1');
    const built = await engine.build({
      applicationId: project.applicationId,
      owner: 'u1',
      approved: true,
    });

    expect(built.status).toBe('FAILED');
    expect(built.terminationReason).toBe('VALIDATION_FAILURE');
    expect(built.repairLimitReached).toBeFalsy();
    expect((built.repairAttempts ?? []).length).toBe(0);
  });

  it('an unfixable failure exhausts the loop → REPAIR_LIMIT_REACHED + FAILED (never READY)', async () => {
    const engine = makeEngine(new NeverPassingValidation());
    const project = await engine.create({ goal: 'Build a restaurant app.', owner: 'u1' });
    await engine.approve(project.applicationId, 'u1');
    const built = await engine.build({
      applicationId: project.applicationId,
      owner: 'u1',
      approved: true,
    });

    expect(built.status).toBe('FAILED');
    expect(built.terminationReason).toBe('REPAIR_LIMIT_REACHED');
    expect(built.repairLimitReached).toBe(true);
    expect(built.repairLimit).toBe(MAX_REPAIR_ATTEMPTS);
    // The loop is bounded: exactly the cap of attempts, never more, never infinite.
    expect(built.repairAttempts ?? []).toHaveLength(MAX_REPAIR_ATTEMPTS);
    expect(built.health).toBe('degraded');
    expect(built.lastValidation?.overall).toBe('FAIL');
    // Version history records the honest outcome.
    const versions = built.versionHistory ?? [];
    expect(versions.some((v) => v.change.includes('REPAIR_LIMIT_REACHED'))).toBe(true);
    expect(built.error).toContain('REPAIR_LIMIT_REACHED');
  });

  it('repair patches are recorded as file operations (diff/change-review contract)', async () => {
    const engine = makeEngine(new NeverPassingValidation());
    const project = await engine.create({ goal: 'Build an ABAP debugger.', owner: 'u1' });
    await engine.approve(project.applicationId, 'u1');
    const built = await engine.build({
      applicationId: project.applicationId,
      owner: 'u1',
      approved: true,
    });

    const repairOps = built.fileOperations.filter((op) =>
      op.originatingTask?.startsWith('repair-'),
    );
    expect(repairOps.length).toBeGreaterThan(0);
    for (const op of repairOps) {
      expect(op.reason).toContain('stub');
      expect(op.status).toBe('applied');
      expect(op.validationStatus).toBeDefined();
    }
  });

  it('converges with the deterministic pipeline: the three validation projects reach READY with a bounded loop', async () => {
    for (const goal of [
      'Build an ABAP debugger for short dumps.',
      'Build a modern restaurant ordering application.',
      'Build an AI application builder for customer support.',
    ]) {
      const built = await buildToReady(goal);
      expect(built.status, `${goal} → READY`).toBe('READY');
      expect(built.lastValidation?.overall).toBe('PASS');
      expect((built.repairAttempts ?? []).length).toBeLessThanOrEqual(MAX_REPAIR_ATTEMPTS);
    }
  });
});
