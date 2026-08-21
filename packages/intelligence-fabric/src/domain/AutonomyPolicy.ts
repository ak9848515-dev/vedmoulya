// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Fabric · AutonomyPolicy
// SPRINT-030 — G-3 · autonomy levels 0–5.
//
// Formalizes what VedMoulya may do at each level. The classification itself is
// the EXISTING ActionClassPolicy (A/B/C/D over the frozen SENSITIVE_ACTIONS) —
// this policy only maps levels onto classes and GATES actions:
//
//   LEVEL 0 Observe   — read-only (opportunities, tasks, health, cost)
//   LEVEL 1 Recommend — proposals/recommendations (proactive layer)
//   LEVEL 2 Prepare   — drafts/workflows/assessments prepared, nothing runs
//   LEVEL 3 Ask       — class-C actions → WAITING_FOR_APPROVAL (existing authority)
//   LEVEL 4 Execute   — pre-authorized low-risk (class A, and class B under an
//                       explicit user authorization record)
//   LEVEL 5 Continuous— scheduled research/recommend/discovery within explicit
//                       policy boundaries (bounded cadence) — never class C/D
//
// A level is NEVER jumped automatically: every action is re-classified and the
// required level is re-verified. Silence/voice/AI-plans are never approval —
// class B execution still requires the existing explicit authorization.
// ─────────────────────────────────────────────────────────────────────────────

import type { ActionClass } from '@vedmoulya/proactive';
import type { AutonomyDecision, AutonomyLevel } from '../types/fabric-types.js';
import { ActionClassPolicy } from '@vedmoulya/proactive';

/** Minimum level required for each action class. */
const REQUIRED_LEVEL: Record<ActionClass, AutonomyLevel> = {
  // Class A is safe analysis/drafting — may execute at LEVEL 4.
  A: 4,
  // Class B is user-authorized automation — LEVEL 4 WITH an explicit
  // authorization record (never granted by the model or the level itself).
  B: 4,
  // Class C is approval-required — at LEVEL 3 the action is ASKED, and it
  // executes only after the existing approval authority approves.
  C: 3,
  // Class D is never automated at any level.
  D: 5,
};

export interface AutonomyGateInput {
  currentLevel: AutonomyLevel;
  /** The candidate action (e.g. a recommendation title or workflow action). */
  action: string;
  /** Explicit user authorization record — REQUIRED for class B execution. */
  userAuthorization?: { id: string; grantedAt: string; scope: string };
}

export class AutonomyPolicy {
  private readonly actionClassPolicy: ActionClassPolicy;

  constructor(actionClassPolicy: ActionClassPolicy = new ActionClassPolicy()) {
    this.actionClassPolicy = actionClassPolicy;
  }

  /** Classify an action and gate it against the current level. Deterministic. */
  gate(input: AutonomyGateInput): AutonomyDecision {
    const classification = this.actionClassPolicy.classify(input.action);
    const requiredLevel = REQUIRED_LEVEL[classification.actionClass];

    // Class D is never automated regardless of level.
    if (classification.actionClass === 'D') {
      return {
        level: input.currentLevel,
        actionClass: 'D',
        allowed: false,
        reasons: [`Action "${input.action}" is class D (never automate) — refused at every level.`],
        authority: 'ACTION_CLASS_POLICY',
        requiredLevel,
      };
    }

    // Class B requires an EXPLICIT user authorization record — the level alone
    // (even 5) never grants it.
    if (classification.actionClass === 'B' && !input.userAuthorization) {
      return {
        level: input.currentLevel,
        actionClass: 'B',
        allowed: false,
        reasons: [
          `Action "${input.action}" is class B — it requires an explicit user authorization record; the autonomy level never grants it.`,
        ],
        authority: 'AUTONOMY_GATE',
        requiredLevel,
      };
    }

    const levelEnough = input.currentLevel >= requiredLevel;
    const reasons: string[] = [];
    if (levelEnough) {
      reasons.push(
        `Level ${input.currentLevel} (${this.levelName(input.currentLevel)}) satisfies the ${requiredLevel} required for class ${classification.actionClass}.`,
      );
      if (classification.actionClass === 'C') {
        reasons.push(
          'Class C — execution still requires the existing approval authority (this gate only ASKS).',
        );
      }
      if (input.userAuthorization) {
        reasons.push(`Explicit user authorization ${input.userAuthorization.id} present.`);
      }
    } else {
      reasons.push(
        `Level ${input.currentLevel} (${this.levelName(input.currentLevel)}) is below the ${requiredLevel} required for class ${classification.actionClass} — blocked.`,
      );
    }
    return {
      level: input.currentLevel,
      actionClass: classification.actionClass,
      allowed: levelEnough,
      reasons,
      authority:
        classification.authority === 'SENSITIVE_ACTIONS' ? 'SENSITIVE_ACTIONS' : 'AUTONOMY_GATE',
      requiredLevel,
    };
  }

  /** The highest level the current evidence justifies — used to decide whether
   *  a level CHANGE is allowed (never a jump past what evidence supports). */
  nextLevel(currentLevel: AutonomyLevel, desiredLevel: AutonomyLevel): AutonomyLevel {
    if (desiredLevel <= currentLevel) return currentLevel;
    // A single-step transition only: LEVEL 0→1→2→3→4→5. Jumping more than one
    // level in one step is refused.
    return Math.min(5, currentLevel + 1) as AutonomyLevel;
  }

  levelName(level: AutonomyLevel): string {
    // Explicit switch over the static level table — no dynamic indexing, so
    // an unexpected level falls back honestly instead of mislabeling.
    switch (level) {
      case 0:
        return 'Observe';
      case 1:
        return 'Recommend';
      case 2:
        return 'Prepare';
      case 3:
        return 'Ask approval';
      case 4:
        return 'Execute pre-authorized low-risk';
      case 5:
        return 'Continuous operation within explicit policy boundaries';
      default:
        return 'Unknown';
    }
  }
}
