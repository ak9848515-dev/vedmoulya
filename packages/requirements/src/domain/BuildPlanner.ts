// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Build Planner
// EPIC-009 — Phase 22. Generates a dependency-aware build plan with
// safe parallel tasks. The plan is executed by the EPIC-006 LoopEngine
// after approval — the planner does not execute anything itself.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { BuildPlan, BuildStep } from '../types/requirement-types.js';
import { knowledgeFor } from '../catalog/knowledge.js';

export interface BuildPlanInput {
  sessionId: string;
  archetype: AppArchetype;
  /** Whether the build will use the loop engine (always true here). */
  usesLoopEngine?: boolean;
}

export class BuildPlanner {
  plan(input: BuildPlanInput): BuildPlan {
    const k = knowledgeFor(input.archetype);
    const steps: BuildStep[] = k.build.map((b) => ({
      id: b.id,
      title: b.title,
      phase: b.phase,
      dependencies: b.dependencies,
      parallelEligible: b.parallelEligible,
    }));

    const dependentSet = new Set<string>();
    for (const step of steps) {
      for (const dep of step.dependencies) dependentSet.add(dep);
    }
    const entrySteps = steps.filter((s) => s.dependencies.length === 0).map((s) => s.id);
    const terminalSteps = steps.filter((s) => !dependentSet.has(s.id)).map((s) => s.id);

    // Compute parallel waves: repeatedly take steps whose dependencies are done.
    const parallelWaves: string[][] = [];
    const done = new Set<string>();
    const remaining = [...steps];
    while (remaining.length > 0) {
      const ready = remaining.filter((s) => s.dependencies.every((d) => done.has(d)));
      if (ready.length === 0) {
        // Cycle or broken dependency — break to avoid an infinite loop.
        parallelWaves.push(remaining.map((s) => s.id));
        break;
      }
      parallelWaves.push(ready.map((s) => s.id));
      for (const s of ready) done.add(s.id);
      for (const s of ready) {
        const idx = remaining.indexOf(s);
        if (idx >= 0) remaining.splice(idx, 1);
      }
    }

    return {
      steps,
      parallelWaves,
      entrySteps,
      terminalSteps,
      usesLoopEngine: input.usesLoopEngine ?? true,
    };
  }
}
