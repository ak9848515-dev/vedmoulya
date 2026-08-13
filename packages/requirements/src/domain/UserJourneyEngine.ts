// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: User Journey Engine
// EPIC-009 — Phase 13. Generates the full journey set per actor:
// happy path, failure path, empty state, permission failure, network
// failure, validation failure and recovery path. Every generated
// application must account for these states before build.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { UserJourney } from '../types/requirement-types.js';
import { knowledgeFor } from '../catalog/knowledge.js';

export interface JourneyInput {
  sessionId: string;
  archetype: AppArchetype;
}

export class UserJourneyEngine {
  generate(input: JourneyInput): UserJourney[] {
    const k = knowledgeFor(input.archetype);
    const journeys: UserJourney[] = [];
    let seq = 0;
    for (const actor of k.journeyActors) {
      for (const j of actor.journeys) {
        seq += 1;
        journeys.push({
          id: `J-${String(seq).padStart(3, '0')}`,
          actor: actor.actor,
          name: j.name,
          path: j.path,
          steps: j.steps,
        });
      }
    }
    return journeys;
  }
}
