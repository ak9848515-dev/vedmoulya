// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · ParallelPlanner
// EPIC-016 §6/§13 — task decomposition into an ordered capability graph
// with parallel waves. Dependent nodes wait; independent nodes run
// together. Consumes the EPIC-013 FactoryCapabilityPlan — never a
// second decomposition engine.
// ──────────────────────────────────────────────────────────────────

import type { FactoryCapabilityPlan, PlanStep } from '@vedmoulya/capability-marketplace';
import type { BrainExecutionGraph, BrainGraphNode, BrainGraphEdge } from '../types/brain-types.js';

/** Steps that must run strictly before another step (dependency map). */
const KNOWN_DEPENDENCIES: Record<string, string[]> = {
  // A script depends on research; fact-check depends on the script, etc.
  RESEARCH: [],
  FACT_CHECK: ['RESEARCH'],
  SCRIPT: ['RESEARCH'],
  STORYBOARD: ['SCRIPT'],
  VISUAL_GENERATION: ['SCRIPT', 'STORYBOARD'],
  VOICE: ['SCRIPT'],
  MUSIC: ['SCRIPT'],
  VIDEO_ASSEMBLY: ['VISUAL_GENERATION', 'VOICE', 'MUSIC'],
  QUALITY_EVALUATION: ['VIDEO_ASSEMBLY'],
  EXPORT: ['QUALITY_EVALUATION'],
};

function capabilityOf(step: PlanStep): string {
  return step.capability;
}

export class ParallelPlanner {
  build(plan: FactoryCapabilityPlan): BrainExecutionGraph {
    const nodes: BrainGraphNode[] = [];
    const edges: BrainGraphEdge[] = [];

    const stepCapabilities = plan.steps.map((s) => capabilityOf(s));

    plan.steps.forEach((step, i) => {
      const cap = capabilityOf(step);
      const id = `node-${i}`;
      nodes.push({
        id,
        kind: 'capability',
        label: cap || step.title || `Step ${i + 1}`,
        capability: step.capability,
        status: 'pending',
      });
    });

    // Sequential dependency edges between consecutive steps by default,
    // refined by KNOWN_DEPENDENCIES.
    for (let i = 0; i < plan.steps.length; i++) {
      // eslint-disable-next-line security/detect-object-injection -- Array index access (stepCapabilities is a plain array; i is the loop counter, never user-controlled).
      const cap = stepCapabilities[i] ?? '';
      // eslint-disable-next-line security/detect-object-injection -- Closed KNOWN_DEPENDENCIES record keyed by the capability union; never user-controlled.
      const deps = KNOWN_DEPENDENCIES[cap] ?? [];
      for (const dep of deps) {
        const depIndex = stepCapabilities.indexOf(dep);
        if (depIndex >= 0 && depIndex < i) {
          edges.push({ from: `node-${depIndex}`, to: `node-${i}`, type: 'depends_on' });
        }
      }
      if (i > 0 && edges.filter((e) => e.to === `node-${i}`).length === 0) {
        // No explicit dependency: still keep declared plan order as a soft edge.
        edges.push({ from: `node-${i - 1}`, to: `node-${i}`, type: 'depends_on' });
      }
    }

    // Parallel waves: nodes whose dependencies are satisfied within earlier waves.
    const waves: string[][] = [];
    const remaining = new Set(nodes.map((n) => n.id));
    const indegree = new Map<string, number>();
    for (const n of nodes) indegree.set(n.id, 0);
    for (const e of edges) indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);

    while (remaining.size > 0) {
      const wave: string[] = [...remaining].filter((id) => (indegree.get(id) ?? 0) === 0);
      if (wave.length === 0) {
        // Cycle safety: break deterministically.
        const next = [...remaining][0] as string;
        wave.push(next);
      }
      for (const id of wave) {
        remaining.delete(id);
        for (const e of edges) {
          if (e.from === id) indegree.set(e.to, (indegree.get(e.to) ?? 0) - 1);
        }
      }
      waves.push(wave);
    }

    return { nodes, edges, waves };
  }
}
