// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: State Intelligence Engine
// EPIC-010 — Phase 5. Every important screen must define LOADING,
// EMPTY, SUCCESS, ERROR, PARTIAL, OFFLINE, UNAUTHORIZED, FORBIDDEN and
// VALIDATION_ERROR. The engine never generates only the happy path.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import { experienceKnowledgeFor } from '../catalog/design-knowledge.js';
import type { ScreenStateId, ScreenStateSpec, UIBlueprint } from '../types/experience-types.js';

export interface StateIntelligenceInput {
  applicationId: string;
  archetype: AppArchetype;
  blueprint: UIBlueprint;
}

export const ALL_STATES: readonly ScreenStateId[] = [
  'LOADING',
  'EMPTY',
  'SUCCESS',
  'ERROR',
  'PARTIAL',
  'OFFLINE',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'VALIDATION_ERROR',
];

export class StateIntelligenceEngine {
  /** Per-screen state requirements for the blueprint's screens. */
  derive(input: StateIntelligenceInput): Array<{ screenId: string; states: ScreenStateSpec[] }> {
    const k = experienceKnowledgeFor(input.archetype);
    const defaultSpecs = new Map<ScreenStateId, ScreenStateSpec>(
      k.stateSpecs.map((s) => [s.state, s]),
    );
    return input.blueprint.screens.map((screen) => ({
      screenId: screen.id,
      states: screen.states.map((stateId) => {
        const base = defaultSpecs.get(stateId);
        return base
          ? {
              ...base,
              requirements: [...base.requirements, `Screen ${screen.id}: ${screen.title}`],
            }
          : {
              state: stateId,
              description: `State ${stateId} for screen ${screen.id}`,
              component: 'StateComponent',
              requirements: ['Defined per-screen state'],
            };
      }),
    }));
  }

  /** The canonical nine-state contract any generated screen must satisfy. */
  contract(): ScreenStateSpec[] {
    return ALL_STATES.map((state, i) => ({
      state,
      description: `Required state: ${state}`,
      component: `State${i}`,
      requirements: ['Present in the generated screen'],
    }));
  }
}
