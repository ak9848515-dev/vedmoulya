// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Proactive Intelligence · AutomationDiscovery
// SPRINT-029 — Phase 2 · repetitive-workflow detection.
//
// Detects workflows that recur (the same kind of task completed multiple
// times) and represents them as TRIGGER → INPUT → CAPABILITIES →
// TRANSFORMATION → APPROVAL → ACTION → VERIFICATION → OUTPUT → MEMORY.
//
// No new execution engine: the workflow is a PROPOSAL. Acting on it runs
// through the existing execution bridge and the existing approval authority
// (ActionClassPolicy decides the class; the approval authority decides each
// run). Verification uses the existing verification authority. Memory intake
// is interaction-artifact only — never auto-promoted to facts/preferences.
// ─────────────────────────────────────────────────────────────────────────────

import type { BrainTaskLike } from '../contracts/proactive-ports.js';
import { ActionClassPolicy } from './ActionClassPolicy.js';
import type { ActionClass, AutomationWorkflow } from '../types/proactive-types.js';

export interface AutomationDiscoveryInput {
  /** Task history for one owner (already owner-scoped by the caller). */
  tasks: BrainTaskLike[];
  /** The automation boundary engine from the capability marketplace. */
  automationBoundary: {
    assess(candidates: unknown[], irreversible: boolean): { automation: string; reasons: string[] };
  };
  actionClassPolicy: ActionClassPolicy;
  now: () => string;
}

export interface DiscoveryResult {
  workflows: AutomationWorkflow[];
  /** Why nothing was proposed (empty = meaningful proposals exist). */
  skipped: string[];
}

/** Group tasks by a normalized objective keyword so repetitions are visible. */
function objectiveFamily(objective: string): string {
  const normalized = objective.trim().toLowerCase();
  // Pick the most distinctive words (≥4 chars) as the family signature.
  const words = normalized.split(/\W+/).filter((w) => w.length >= 4);
  return words.slice(0, 3).join(' ');
}

/**
 * Detect repetitive workflows. A workflow is proposed only when the same
 * objective family appears at least `minOccurrences` times in the owner's
 * task history — evidence-based, never invented from a single task.
 */
export class AutomationDiscovery {
  private readonly minOccurrences: number;

  constructor(minOccurrences = 2) {
    this.minOccurrences = minOccurrences;
  }

  discover(input: AutomationDiscoveryInput): DiscoveryResult {
    const skipped: string[] = [];
    if (input.tasks.length === 0) {
      return { workflows: [], skipped: ['No task history to analyze.'] };
    }

    // Group by objective family.
    const families = new Map<string, BrainTaskLike[]>();
    for (const task of input.tasks) {
      const family = objectiveFamily(task.objective);
      if (!family) continue;
      const bucket = families.get(family);
      if (bucket) {
        bucket.push(task);
      } else {
        families.set(family, [...[task]]);
      }
    }

    const workflows: AutomationWorkflow[] = [];
    let index = 0;
    for (const [family, tasks] of families) {
      if (tasks.length < this.minOccurrences) {
        skipped.push(
          `"${family}" appears only ${tasks.length}× — below the ${this.minOccurrences}× evidence floor.`,
        );
        continue;
      }
      const first = tasks[0];
      if (!first) continue;

      // Action-class: classify the family as a candidate automation. Irreversible
      // (sensitive) actions force class C via the policy; the boundary engine's
      // automation level is advisory evidence only.
      const decision = input.actionClassPolicy.classify(family, { recurring: true });
      if (!input.actionClassPolicy.proposable(decision.actionClass)) {
        skipped.push(`"${family}" maps to class ${decision.actionClass} — never proposed.`);
        continue;
      }
      const automationClass: Exclude<ActionClass, 'A' | 'D'> =
        decision.actionClass === 'C' ? 'C' : 'B';

      const boundary = input.automationBoundary.assess([], automationClass === 'C');
      const workflow: AutomationWorkflow = {
        id: `wf-${input.now().replace(/\D/g, '').slice(-8)}-${index++}`,
        ownerId: first.userId,
        title: `Automate "${family}"`,
        description: `This workflow repeats ${tasks.length}× in your task history.`,
        trigger: 'Scheduled cadence or explicit user request',
        input: 'The same inputs the repeated tasks used',
        capabilities: [],
        transformation: 'The transformation the repeated tasks performed',
        action: family,
        actionClass: automationClass,
        verification: 'The existing verification authority confirms the output artifact',
        output: 'The same output the repeated tasks produced',
        memory: 'Interaction artifacts only — never auto-promoted to facts/preferences',
        evidence: tasks.map((t) => `Task ${t.id}: "${t.objective}" (${t.status})`),
        occurrences: tasks.length,
        status: 'PROPOSED',
        createdAt: input.now(),
      };
      // Keep the boundary assessment as advisory metadata.
      workflow.description += ` Automation boundary: ${boundary.automation}.`;
      workflows.push(workflow);
    }

    return { workflows, skipped };
  }
}
