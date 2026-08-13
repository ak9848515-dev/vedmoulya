// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Success Criteria Service
// EI-006 — Enterprise Goal & Task Intelligence Engine
// Every goal must include success criteria: definition, validation,
// completion criteria, and expected outcome (per the sprint brief).
// ──────────────────────────────────────────────────────────────────

import type { SuccessCriterion } from '../../types/goal-types.js';
import { generateSuccessCriterionId } from '../value-objects/Identifiers.js';

export interface SuccessCriterionInput {
  definition: string;
  validation?: string;
  completionCriteria?: string[];
  expectedOutcome?: string;
}

export class SuccessCriteriaService {
  /**
   * Normalize input criteria; when none are provided, derive a default
   * criterion from the goal title/description so no goal ships without
   * definition + validation + completion criteria + expected outcome.
   */
  build(
    inputs: SuccessCriterionInput[],
    goalTitle: string,
    goalDescription: string,
  ): SuccessCriterion[] {
    if (inputs.length > 0) {
      return inputs.map((c) => this.toCriterion(c));
    }
    const base = goalDescription.trim() || goalTitle.trim();
    return [
      this.toCriterion({
        definition: `Achieve: ${goalTitle}`,
        validation: 'Verify the outcome against the stated objective and any measurable targets.',
        completionCriteria: [
          `The outcome for "${goalTitle}" is delivered`,
          'All defined deliverables are complete',
          'Stakeholder/owner confirmation recorded',
        ],
        expectedOutcome: base.length > 0 ? `The objective "${base}" is met` : 'Objective met',
      }),
    ];
  }

  private toCriterion(input: SuccessCriterionInput): SuccessCriterion {
    return {
      criterionId: generateSuccessCriterionId(),
      definition: input.definition,
      validation: input.validation ?? 'Verify the outcome against the stated objective.',
      completionCriteria:
        input.completionCriteria && input.completionCriteria.length > 0
          ? input.completionCriteria
          : ['Outcome delivered', 'Deliverables complete'],
      expectedOutcome: input.expectedOutcome ?? `Expected outcome for: ${input.definition}`,
      met: false,
    };
  }
}
