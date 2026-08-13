// ──────────────────────────────────────────────────────────────────
// VedMoulya — Loop Engine: Deterministic Test Fixtures
// EPIC-006 — Phase 16. Fake ports make every loop test hermetic,
// deterministic and fast (no network, no secrets, instant clock).
// ──────────────────────────────────────────────────────────────────

import type {
  ClockPort,
  RagSearchPort,
  SpecialistExecutionInput,
  SpecialistExecutionPort,
  SpecialistExecutionResult,
  ToolExecutionPort,
} from '../../contracts/loop-ports.js';
import type { EvidenceState } from '../../types/loop-types.js';

/** Instant, manually-advanced clock for deterministic timeout tests. */
export class FakeClock implements ClockPort {
  private ms = 0;

  /**
   * When set, every timestampMs() read advances the clock by this amount —
   * used to deterministically trigger the run TIMEOUT bound.
   */
  constructor(private readonly autoAdvanceMs = 0) {}

  now(): string {
    return new Date(this.ms).toISOString();
  }

  timestampMs(): number {
    const current = this.ms;
    if (this.autoAdvanceMs > 0) this.ms += this.autoAdvanceMs;
    return current;
  }

  advance(ms: number): void {
    this.ms += ms;
  }

  sleep(ms: number): Promise<void> {
    this.ms += ms;
    return Promise.resolve();
  }
}

/** Content that satisfies every required-section success criterion. */
export const FULL_ANSWER = [
  '## Diagnosis\nThe root cause is an untyped reference in the DATA statement.',
  '## Explanation\nThe reference is dereferenced before the field symbol is assigned.',
  '## Corrected Code\nDATA(lv_ref) = ls_item-ref.\nIF lv_ref IS NOT INITIAL.',
  '## Validation\nAll checks PASS: syntax, null-handling, types.',
  '## Requirements\nUsers, core workflows and acceptance criteria are defined.',
  '## Architecture\nThe stack, components, data model and deployment are defined.',
  '## UI Plan\nScreens, navigation and design language are defined.',
  '## Implementation Plan\nMilestones, module order, tests and launch checklist are defined.',
  '## Capabilities\nEach AI touchpoint maps to a capability and quality tier.',
  '## Implementation\nThe implementation plan with validation is complete.',
  '## Deliverable\nThe complete deliverable is present.',
].join('\n\n');

export interface FakeSpecialistBehavior {
  /** Custom content builder (defaults to task echo). */
  content?: (input: SpecialistExecutionInput, callIndex: number) => string;
  /** Throw a provider error for these task ids / always. */
  throwFor?: (input: SpecialistExecutionInput) => boolean;
  /** Force an evidence state on every result. */
  evidenceState?: EvidenceState;
  /** Abstain (Evidence-First) — the runtime refuses to answer. */
  abstainFor?: (input: SpecialistExecutionInput) => boolean;
  /** Simulated latency per call (ms). */
  latencyMs?: number;
}

export class FakeSpecialistPort implements SpecialistExecutionPort {
  calls: SpecialistExecutionInput[] = [];
  private callCount = 0;

  constructor(private readonly behavior: FakeSpecialistBehavior = {}) {}

  async execute(input: SpecialistExecutionInput): Promise<SpecialistExecutionResult> {
    this.calls.push(input);
    const index = this.callCount;
    this.callCount += 1;
    if (this.behavior.throwFor?.(input)) {
      throw new Error('provider 503 unavailable');
    }
    const abstained = this.behavior.abstainFor?.(input) === true;
    return {
      content: abstained
        ? 'Abstained: not enough evidence to answer confidently.'
        : (this.behavior.content?.(input, index) ??
          `Output for ${input.taskId}: ${input.userInput.slice(0, 60)}`),
      provider: 'mock',
      model: 'mock-v1',
      tokens: { input: 120, output: 60, total: 180 },
      costUsd: 0.0002,
      latencyMs: this.behavior.latencyMs ?? 5,
      abstained,
      evidenceState: abstained
        ? (this.behavior.evidenceState ?? 'INSUFFICIENT_EVIDENCE')
        : this.behavior.evidenceState,
      selectionExplanation: `Selected mock/mock-v1 (balanced) — deterministic test fixture.`,
      validationDecision: 'pass',
    };
  }

  async explain(input: {
    capability: SpecialistExecutionInput['capability'];
  }): Promise<{ providerId: string; modelId: string; reasons: string[]; strategy: string }> {
    return {
      providerId: 'mock',
      modelId: 'mock-v1',
      reasons: [`fake selection for ${input.capability}`],
      strategy: 'balanced',
    };
  }
}

export class FakeRagPort implements RagSearchPort {
  results: Array<{ title: string; content: string; score: number; source?: string }>;
  searchCalls = 0;

  constructor(
    results: Array<{ title: string; content: string; score: number; source?: string }> = [
      {
        title: 'SAP ABAP knowledge base',
        content:
          'ABAP short dumps on unassigned field symbols: check DATA declarations and dereferencing.',
        score: 0.9,
        source: 'sap-kb-1',
      },
    ],
  ) {
    this.results = results;
  }

  async search(): Promise<{
    results: Array<{ title: string; content: string; score: number; source?: string }>;
  }> {
    this.searchCalls += 1;
    return { results: this.results };
  }
}

export class FakeToolPort implements ToolExecutionPort {
  deniedTools = new Set<string>();
  failingTools = new Set<string>();
  calls = 0;
  allowlist: string[] = ['echo', 'calculator', 'current_time'];

  async execute(input: {
    toolName: string;
    arguments: Record<string, unknown>;
    userId: string;
  }): Promise<{
    ok: boolean;
    denied: boolean;
    outcome: string;
    error?: string;
    latencyMs: number;
  }> {
    this.calls += 1;
    if (this.deniedTools.has(input.toolName)) {
      return { ok: false, denied: true, outcome: 'authorization_error', latencyMs: 0 };
    }
    if (this.failingTools.has(input.toolName)) {
      return { ok: false, denied: false, outcome: 'timeout', error: 'timed out', latencyMs: 1 };
    }
    return { ok: true, denied: false, outcome: 'success', latencyMs: 1 };
  }

  listAllowed(): string[] {
    return this.allowlist;
  }
}
