// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Experience Strategy Engine
// EPIC-009 — Phase 14. Chooses the correct interaction model for the
// product (dashboard / chat / copilot / wizard / workflow / canvas /
// editor / search / command center / mobile-first workflow /
// structured form). Never defaults every application to a chatbot UI.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { ExperienceStrategy, InteractionModel } from '../types/requirement-types.js';
import { knowledgeFor } from '../catalog/knowledge.js';

export interface ExperienceInput {
  sessionId: string;
  archetype: AppArchetype;
  /** Override detected from the idea (e.g. the user explicitly asked for chat). */
  requestedModel?: InteractionModel;
}

export const ALL_MODELS: InteractionModel[] = [
  'dashboard',
  'chat',
  'copilot',
  'wizard',
  'workflow',
  'canvas',
  'editor',
  'search',
  'command_center',
  'mobile_first_workflow',
  'structured_form',
];

export class ExperienceStrategyEngine {
  derive(input: ExperienceInput): ExperienceStrategy {
    const k = knowledgeFor(input.archetype);
    const primaryModel: InteractionModel = input.requestedModel ?? k.experience.primaryModel;
    const secondary = k.experience.secondaryModels.filter((m) => m !== primaryModel);
    const alternatives = ALL_MODELS.filter((m) => m !== primaryModel && !secondary.includes(m)).map(
      (m) => ({
        model: m,
        tradeoff: tradeoffFor(m, primaryModel),
      }),
    );

    return {
      sessionId: input.sessionId,
      primaryModel,
      secondaryModels: secondary,
      reasons: [
        ...k.experience.reasons,
        primaryModel === 'chat' || primaryModel === 'copilot'
          ? 'A conversational model is only chosen when the product is inherently conversational'
          : 'The interaction model follows the workflow, not a default chatbot pattern',
      ],
      alternatives: alternatives.slice(0, 3),
      screens: k.experience.screens,
      navigation: k.experience.navigation,
    };
  }
}

function tradeoffFor(alternative: InteractionModel, chosen: InteractionModel): string {
  if (alternative === 'chat')
    return `A chat surface would trade structured navigation for free-form conversation (not the best fit for ${chosen})`;
  if (alternative === 'canvas')
    return `A canvas would add free-form layout complexity without a clear need`;
  if (alternative === 'dashboard')
    return `A dashboard-first model suits monitoring, not the primary ${chosen} flow`;
  if (alternative === 'wizard')
    return `A wizard works for setup but would slow the primary ${chosen} flow`;
  return `Using ${alternative} would add scope without improving the core ${chosen} experience`;
}
