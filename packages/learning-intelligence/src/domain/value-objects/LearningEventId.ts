// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Event Id
// EI-007 — Enterprise Learning Intelligence Platform
// Branded identifier for learning events.
// ──────────────────────────────────────────────────────────────────

export type LearningEventId = string & { readonly __learningEventId: unique symbol };

/** Create a branded LearningEventId from a raw string. */
export function createLearningEventId(id: string): LearningEventId {
  return id as LearningEventId;
}

/** Generate a unique learning event id. */
export function generateLearningEventId(): LearningEventId {
  return createLearningEventId(
    `levent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
  );
}
