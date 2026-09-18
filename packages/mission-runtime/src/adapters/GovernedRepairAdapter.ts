// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Governed Repair Mechanism (FINAL-03A)
//
// The production implementation of the Mission Controller's
// `FailureRepairPort`. It is the ONLY thing that turns a structured
// diagnosis's repair INTENT into a REAL workspace action, and it does so
// exclusively through the SAME governed ToolRegistry the mission already
// uses — there is no second tool path, no raw filesystem write, no
// process spawn and no free-form command.
//
// WHY THIS EXISTS (the exact production gap FINAL-03A closes):
//
//   The production repository-fix plan observes a REAL failing command
//   (`run_command` → non-zero exit) and correctly lets that failure FAIL the
//   run. The controller then classifies it and produces a structured
//   diagnosis — but before FINAL-03A nothing performed the diagnosis's repair,
//   so the next planning attempt re-ran the identical plan against the still
//   broken workspace and failed identically. `workspace_write` was never
//   reached.
//
//   This adapter closes the loop with the EXISTING AUTONOMY-04 contracts:
//   it consumes the structured `FailureDiagnosis`, derives the repair target
//   from the mission's OWN objective (the same bounded, deterministic rule
//   the production plan uses — never AI text), and executes the repair
//   through the governed registry (`workspace_write`). The revision then
//   re-plans, re-executes and re-verifies — so the workspace write and the
//   verification are both REAL.
//
// GOVERNANCE (never bypassed — enforced here AND by the registry itself):
//   - only a diagnosis whose strategy is a GOVERNED WORKSPACE MUTATION is
//     repaired; BLOCK / FAIL / RETRY / REVISE strategies are untouched and
//     keep the frozen recovery behavior;
//   - the mission's own allowlist and permission classes are re-checked
//     BEFORE the call: a repair can never widen them, and a mission that was
//     not granted `workspace_write`/WRITE never writes;
//   - the tool arguments are literals derived from the objective + the fixed
//     workspace tool schema; the model never supplies them;
//   - the call runs through the governed ToolRuntime security chain (path
//     jail, schema validation, rate limit, audit) exactly like a plan action;
//   - success is never fabricated: a denied/failed write is reported honestly
//     with the registry's own error.
// ──────────────────────────────────────────────────────────────────

import type { ToolRegistry } from '@vedmoulya/services/ai/runtime/ToolRuntime';
import {
  createRepairRecord,
  type FailureDiagnosis,
  type FailureRepairPort,
  type RepairResult,
  type RepairStrategy,
} from '@vedmoulya/mission-controller';
import { extractRepositoryFixTarget } from '@vedmoulya/planning';
import { WORKSPACE_WRITE_TOOL } from './WorkspaceTools.js';

/**
 * The AUTONOMY-04 repair strategies that perform a bounded, path-jailed
 * workspace mutation. Only these may drive a governed repair write; every
 * other strategy (BLOCK / FAIL / RETRY_COMMAND / REVISE_*) is left to the
 * frozen recovery path.
 */
const GOVERNED_MUTATION_STRATEGIES: ReadonlySet<RepairStrategy> = new Set<RepairStrategy>([
  'MODIFY_FILE',
  'ADD_OR_UPDATE_DEPENDENCY',
  'MODIFY_CONFIGURATION',
  'MODIFY_TEST',
  'MODIFY_SOURCE',
]);

export interface GovernedRepairAdapterOptions {
  /** The SAME governed registry the mission executes plans against. */
  registry: ToolRegistry;
  /** Identity attributed to the governed tool call (never a model identity). */
  userId?: string;
}

export class GovernedRepairAdapter implements FailureRepairPort {
  constructor(private readonly options: GovernedRepairAdapterOptions) {}

  async repair(input: {
    diagnosis: FailureDiagnosis;
    objective: string;
    missionContext: string;
    allowedTools?: string[];
    grantedPermissionClasses?: string[];
  }): Promise<RepairResult> {
    const { diagnosis } = input;
    const strategy = diagnosis.suggestedRepair;
    const attemptedAt = new Date().toISOString();

    // 1. Only a governed workspace-mutation diagnosis is repaired.
    if (!GOVERNED_MUTATION_STRATEGIES.has(strategy)) {
      return notAttempted(
        diagnosis,
        strategy,
        attemptedAt,
        `diagnosis strategy ${strategy} is not a governed workspace mutation`,
      );
    }

    // 2. The repair target is the mission objective's OWN literal target,
    //    extracted by the SAME bounded deterministic rule the production plan
    //    builder uses (relative path only — never absolute, never '..').
    //    Nothing is generated from model output.
    const target = extractRepositoryFixTarget(input.objective);
    if (!target) {
      return notAttempted(
        diagnosis,
        strategy,
        attemptedAt,
        'the objective declares no explicit repair target — nothing is invented',
      );
    }

    // 3. Mission-level governance first: the governed registry enforces its
    //    own security chain, but a repair must never even attempt a tool the
    //    mission was not allowed or granted.
    if (input.allowedTools && !input.allowedTools.includes(WORKSPACE_WRITE_TOOL)) {
      return notAttempted(
        diagnosis,
        strategy,
        attemptedAt,
        `mission constraints do not allow ${WORKSPACE_WRITE_TOOL}`,
      );
    }
    if (input.grantedPermissionClasses && !input.grantedPermissionClasses.includes('WRITE')) {
      return notAttempted(
        diagnosis,
        strategy,
        attemptedAt,
        'the principal does not hold the WRITE permission class',
      );
    }

    // 4. The REAL governed repair write — through the same ToolRuntime
    //    security chain (path jail, schema validation, rate limit, audit) as
    //    any plan action, with step-fixed literal arguments.
    try {
      const result = await this.options.registry.execute({
        toolName: WORKSPACE_WRITE_TOOL,
        arguments: { relativePath: target.relativePath, content: target.content },
        userId: this.options.userId ?? 'mission-runtime',
      });
      if (!result.ok) {
        return {
          attempted: true,
          success: false,
          modifiedFiles: [],
          // The revision still re-plans/re-executes: a failed repair grants
          // nothing and is never reported as success.
          nextAction: 'REPLAN',
          repairRecord: createRepairRecord(diagnosis, strategy, [], false, attemptedAt, {
            error: result.error ?? 'governed workspace write failed',
          }),
        };
      }
      return {
        attempted: true,
        success: true,
        modifiedFiles: [target.relativePath],
        // The repair itself never certifies the outcome: the objective must
        // still be re-executed and re-verified through the existing plan,
        // governed command and verification path.
        nextAction: 'CONTINUE',
        repairRecord: createRepairRecord(
          diagnosis,
          strategy,
          [target.relativePath],
          true,
          attemptedAt,
        ),
      };
    } catch (error) {
      return {
        attempted: true,
        success: false,
        modifiedFiles: [],
        nextAction: 'REPLAN',
        repairRecord: createRepairRecord(diagnosis, strategy, [], false, attemptedAt, {
          error: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }
}

/** A repair that was deliberately not attempted — bounded, honest, grants nothing. */
function notAttempted(
  diagnosis: FailureDiagnosis,
  strategy: RepairStrategy,
  attemptedAt: string,
  reason: string,
): RepairResult {
  return {
    attempted: false,
    success: false,
    modifiedFiles: [],
    nextAction: 'REPLAN',
    repairRecord: createRepairRecord(diagnosis, strategy, [], false, attemptedAt, {
      error: reason,
    }),
  };
}
