// ─────────────────────────────
// VedMoulya — Ask VedMoulya (UX-08)
//
// The ONE canonical Ask experience is a conversation LAYER over the existing AI
// runtime, not a second chat engine. This module holds the parts of that layer
// that must be provably correct and therefore live outside the component:
//
//   1. INTENT — does the person want an ANSWER ("What is SAP?") or an ACTION
//      ("Create a mission to revise ABAP.")? Nothing here executes anything; it
//      only decides which existing path the UI should take.
//
//   2. CONTEXT — what REAL VedMoulya context should accompany the request.
//      Only context that actually exists in the Life OS snapshot is included.
//      Nothing is fabricated: an empty snapshot produces no context, never a
//      placeholder identity or a made-up goal. These strings are handed to the
//      existing `ai.stream` runtime, which already consumes identityContext /
//      memoryContext / knowledgeContext / conversationHistory (see
//      AIOrchestrationService.buildContextSections).
//
//   3. MISSION DRAFT — how the AI's understanding of an action request becomes
//      the real `mission.createAndRun` input. Title/objective are derived from
//      the person's own words; we never invent an objective they did not ask for.
// ─────────────────────────────

import type { AIContext, IdentitySummary, MemorySummary } from '../app/sections/types.js';

// ── Intent ──────────────────

/**
 * What the person is asking for.
 *
 * `answer`   → a conversational response from the AI runtime (read-only).
 * `action`   → something VedMoulya can START (currently: a mission), routed to
 *              the real mission infrastructure. The UI must not claim the
 *              action succeeded until the mission API actually returned an id.
 */
export type AskIntent = 'answer' | 'action';

/**
 * Classify a free-text request.
 *
 * This is deliberately conservative: it only returns `action` when the person
 * has asked to CREATE/START something. Everything else stays an answer, so an
 * ordinary question can never silently turn into a mission.
 *
 * The patterns describe *starting work*, which is exactly the surface missions
 * own today. They do not promise capabilities the backend does not have.
 */
const ACTION_PATTERNS: readonly RegExp[] = [
  /\bcreate (a |an |the )?(new )?mission\b/i,
  /\bstart (a |an |the )?(new )?mission\b/i,
  /\bmake (a |an |the )?(new )?mission\b/i,
  /\bbuild (a |an |the )?(new )?mission\b/i,
  /\blaunch (a |an |the )?(new )?mission\b/i,
  /\bcreate (a |an |the )?plan to\b/i,
  /\bstart (work|working) on\b/i,
  /\b(set|start) (a |an )?mission (for|to)\b/i,
  /\bmission (for|to) (learn|build|create|revise|study|prepare|research|ship|launch|design)\b/i,
];

/** True when the request is an ACTION the mission infrastructure can start. */
export function classifyAskIntent(input: string): AskIntent {
  const text = input.trim();
  if (text.length === 0) return 'answer';
  return ACTION_PATTERNS.some((pattern) => pattern.test(text)) ? 'action' : 'answer';
}

/**
 * Derive a mission draft from the person's own words.
 *
 * The objective is the request itself (verbatim, trimmed) — VedMoulya never
 * invents a goal the person did not state. The title is the same sentence,
 * compacted to the mission API's free-text title field, with the "create a
 * mission to …" scaffold removed only when it is a leading instruction.
 *
 * Returns null when there is nothing real to create (so the UI cannot call the
 * mission API with an empty objective).
 */
export interface MissionDraft {
  title: string;
  objective: string;
}

const MAX_TITLE = 200;
const MAX_OBJECTIVE = 2000;

export function missionDraftFromRequest(input: string): MissionDraft | null {
  const objective = input.trim().slice(0, MAX_OBJECTIVE);
  if (objective.length < 3) return null;

  // Strip only a LEADING instruction scaffold ("Create a mission to learn X."
  // → "Learn X."). The words after it are the person's own objective.
  const stripped = objective
    .replace(
      /^(please\s+)?(create|start|make|build|launch|set)\s+(a|an|the)?\s*(new)?\s*mission\s*(for|to)?\s*/i,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();

  const titleSource = stripped.length >= 3 ? stripped : objective;
  const title =
    titleSource.length > MAX_TITLE ? `${titleSource.slice(0, MAX_TITLE - 1)}…` : titleSource;
  return { title, objective };
}

// ── Real context assembly ───────────────────

/**
 * The pieces of REAL Vedmoulya context the Ask layer knows how to pass to the
 * runtime. Every field is optional: absent data means the field is omitted,
 * never filled with a placeholder.
 */
export interface AskContextInput {
  identity?: IdentitySummary | null;
  memory?: MemorySummary | null;
  aiContext?: AIContext | null;
  /** The person's words on the surface they asked from, if any (e.g. a mission title). */
  currentFocus?: string | null;
}

export interface AskRuntimeContext {
  identityContext?: string;
  memoryContext?: string;
  knowledgeContext?: string;
}

/** Trim + collapse whitespace, returning undefined for effectively-empty text. */
function clean(value: string | undefined | null): string | undefined {
  const text = (value ?? '').split(/\s+/).filter(Boolean).join(' ');
  return text.length > 0 ? text : undefined;
}

/**
 * Build the runtime `context` payload from real snapshot data.
 *
 * A field is included ONLY when the underlying data genuinely exists:
 *   - identityContext ← real display name / purpose / primary goal
 *   - memoryContext   ← real memory counts + AI observations
 *   - knowledgeContext ← the person's stated current focus / recent activity
 *
 * With an empty snapshot every field is omitted and the runtime simply answers
 * without personal context — it is never told a fiction.
 */
export function buildAskContext(input: AskContextInput): AskRuntimeContext {
  const out: AskRuntimeContext = {};

  const identityParts: string[] = [];
  const name = clean(input.identity?.displayName);
  const role = clean(input.identity?.role);
  const purpose = clean(input.identity?.purpose);
  const primaryGoal = clean(input.identity?.primaryGoal);
  if (name && name !== 'User') identityParts.push(`Name: ${name}`);
  if (role) identityParts.push(`Role: ${role}`);
  if (purpose) identityParts.push(`Purpose: ${purpose}`);
  if (primaryGoal) identityParts.push(`Primary goal: ${primaryGoal}`);
  if (identityParts.length > 0) out.identityContext = identityParts.join('\n');

  const memoryParts: string[] = [];
  const total = input.memory?.totalMemories ?? 0;
  if (total > 0) memoryParts.push(`Remembered events: ${String(total)}`);
  const observations = (input.memory?.aiObservations ?? [])
    .map(clean)
    .filter((value): value is string => value !== undefined);
  if (observations.length > 0) memoryParts.push(`Observations: ${observations.join('; ')}`);
  if (memoryParts.length > 0) out.memoryContext = memoryParts.join('\n');

  const knowledgeParts: string[] = [];
  const focus = clean(input.currentFocus) ?? clean(input.aiContext?.currentFocus);
  if (focus) knowledgeParts.push(`Current focus: ${focus}`);
  const summary = clean(input.aiContext?.contextSummary);
  if (summary) knowledgeParts.push(summary);
  const recent = (input.aiContext?.recentActivity ?? [])
    .map(clean)
    .filter((value): value is string => value !== undefined);
  if (recent.length > 0) knowledgeParts.push(`Recent activity: ${recent.join('; ')}`);
  if (knowledgeParts.length > 0) out.knowledgeContext = knowledgeParts.join('\n');

  return out;
}

/** Does the assembled context carry anything real? (Used for honest UI copy.) */
export function askContextIsEmpty(context: AskRuntimeContext): boolean {
  return (
    context.identityContext === undefined &&
    context.memoryContext === undefined &&
    context.knowledgeContext === undefined
  );
}

// ── Conversation history → runtime history ──────────────────

/** The minimal shape of a rendered message the history builder understands. */
export interface ConversationalMessage {
  role: 'ai' | 'user';
  content: string;
}

/**
 * Convert the visible conversation into the runtime's conversationHistory.
 *
 * Only prior turns are sent (the current user input travels as `userInput`), so
 * the same sentence is never duplicated. Fabricated or placeholder messages are
 * never created here — this is a faithful projection of what the person sees.
 */
export function conversationHistoryFor(
  messages: readonly ConversationalMessage[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .map((message): { role: 'user' | 'assistant'; content: string } => ({
      role: message.role === 'ai' ? 'assistant' : 'user',
      content: message.content,
    }))
    .slice(-20);
}

// ── Human labels ────────────────────────────

/** The greeting shown when a fresh conversation begins (no fake example). */
export const ASK_GREETING =
  "Ask me anything about your goals, missions, career or learning — or ask me to start something, and I'll set up a mission for you.";

/** Non-persisted input hints. These are placeholders, never conversation state. */
export const ASK_INPUT_HINTS: readonly string[] = [
  'What should I focus on today?',
  'Create a mission to revise ABAP.',
  'Help me plan my next learning step.',
  'What is SAP?',
];
