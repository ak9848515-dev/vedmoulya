// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Memory: Memory Candidate Builder (PHASE 5)
//
// Learning signals produce structured MemoryCandidates — never
// unsupported natural-language facts. Each candidate carries the
// subject/predicate/value, sample/success/failure/verified counts, the
// scope, capability context and full provenance (execution ids + the
// signals that produced it).
//
// Categories are a CLOSED set (never model-defined). Scopes are
// explicit and never silently widened: a USER-scoped observation never
// becomes GLOBAL knowledge.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import type { CapabilityType } from '@vedmoulya/ai';
import type {
  ExecutionRecord,
  LearningSignal,
  MemoryCandidate,
  MemoryCategory,
  MemoryScope,
} from '../types/execution-memory-types.js';
import type { LearningSignalKind } from '../types/execution-memory-types.js';

function candidate(input: {
  category: MemoryCategory;
  scope: MemoryScope;
  subject: string;
  predicate: string;
  value: number;
  sampleCount: number;
  successCount: number;
  failureCount: number;
  verifiedCount: number;
  capability?: CapabilityType;
  userId?: string;
  executionIds: string[];
  signalKinds: LearningSignalKind[];
  createdAt: string;
}): MemoryCandidate {
  return { candidateId: `candidate-${generateId()}`, ...input };
}

/** Plan signature: capability set + step count (deterministic subject). */
export function planSignature(records: ExecutionRecord[]): string {
  const caps = [
    ...new Set(
      records
        .flatMap((r) => [r.capability, ...(r.requiredCapabilities ?? [])])
        .filter((c): c is CapabilityType => c !== undefined),
    ),
  ];
  const stepCount = new Set(
    records.map((r) => r.stepId).filter((s): s is string => s !== undefined),
  ).size;
  const capPart = caps.length > 0 ? caps.sort().join('+') : 'generic';
  return `${capPart}:${String(stepCount)}steps`;
}

/** Compound routing subject: provider/model when both are known. */
function routingSubject(record: ExecutionRecord): string {
  if (record.provider !== undefined && record.model !== undefined) {
    return `provider:${record.provider}/model:${record.model}`;
  }
  if (record.provider !== undefined) return `provider:${record.provider}`;
  return `model:${record.model ?? 'unknown'}`;
}

/** Goal-type signature for TASK_PATTERN entries. */
function goalTypeSignature(record: ExecutionRecord): string {
  const text = record.goalText.toLowerCase();
  if (/(fix|repair|bug|failing|broken)/.test(text)) return 'fix';
  if (/(write|create|draft|compose|content)/.test(text)) return 'create';
  if (/(analy|assess|report|review|research)/.test(text)) return 'analyze';
  return 'generic';
}

/**
 * Build candidates from the signals of one execution. Aggregation of
 * repeated evidence happens later (memory-confidence/memory-validation);
 * this stage only maps signal → structured candidate.
 */
export function buildMemoryCandidates(
  signals: LearningSignal[],
  records: ExecutionRecord[],
  now: string,
): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  const runRecord = records.find((r) => r.stepId === undefined);
  const byId = new Map(records.map((r) => [r.executionId, r]));

  const collect = (kind: LearningSignalKind): ExecutionRecord[] =>
    signals
      .filter((s) => s.kind === kind)
      .flatMap((s) => s.executionIds)
      .map((id) => byId.get(id))
      .filter((r): r is ExecutionRecord => r !== undefined);

  // ── TOOL_RELIABILITY ────────────────────────────────────────────
  for (const toolRecord of collect('TOOL_SUCCESS')) {
    candidates.push(
      candidate({
        category: 'TOOL_RELIABILITY',
        scope: 'TOOL',
        subject: toolRecord.tool ?? 'unknown-tool',
        predicate: 'verified_success_rate',
        value: 1,
        sampleCount: 1,
        successCount: 1,
        failureCount: 0,
        verifiedCount: 1,
        capability: toolRecord.capability,
        executionIds: [toolRecord.executionId],
        signalKinds: ['TOOL_SUCCESS'],
        createdAt: now,
      }),
    );
  }
  for (const kind of ['TOOL_FAILURE', 'TOOL_TIMEOUT', 'TOOL_PERMISSION_DENIED'] as const) {
    for (const toolRecord of collect(kind)) {
      candidates.push(
        candidate({
          category: 'TOOL_RELIABILITY',
          scope: 'TOOL',
          subject: toolRecord.tool ?? 'unknown-tool',
          predicate: 'verified_success_rate',
          value: 0,
          sampleCount: 1,
          successCount: 0,
          failureCount: 1,
          verifiedCount: 0,
          capability: toolRecord.capability,
          executionIds: [toolRecord.executionId],
          signalKinds: [kind],
          createdAt: now,
        }),
      );
    }
  }

  // ── PLAN_PATTERN ────────────────────────────────────────────────
  const planSuccesses = collect('SUCCESSFUL_PLAN');
  const planFailures = collect('FAILED_PLAN');
  if (planSuccesses.length + planFailures.length > 0) {
    const signature = planSignature(records);
    const successCount = planSuccesses.length;
    const failureCount = planFailures.length;
    candidates.push(
      candidate({
        category: 'PLAN_PATTERN',
        scope: 'PLAN_PATTERN',
        subject: signature,
        predicate: 'achieved_rate',
        value: successCount / (successCount + failureCount),
        sampleCount: successCount + failureCount,
        successCount,
        failureCount,
        verifiedCount: successCount,
        executionIds: [...planSuccesses, ...planFailures].map((r) => r.executionId),
        signalKinds: ['SUCCESSFUL_PLAN', 'FAILED_PLAN'],
        createdAt: now,
      }),
    );
  }

  // ── RECOVERY_PATTERN ────────────────────────────────────────────
  const recoverySuccesses = collect('RECOVERY_SUCCESS');
  const recoveryFailures = collect('RECOVERY_FAILURE');
  if (recoverySuccesses.length + recoveryFailures.length > 0) {
    const byStrategy = new Map<
      string,
      { success: ExecutionRecord[]; failure: ExecutionRecord[] }
    >();
    for (const r of recoverySuccesses) {
      const key = r.recoveryStrategy ?? 'retry';
      const bucket = byStrategy.get(key) ?? { success: [], failure: [] };
      bucket.success.push(r);
      byStrategy.set(key, bucket);
    }
    for (const r of recoveryFailures) {
      const key = r.recoveryStrategy ?? 'retry';
      const bucket = byStrategy.get(key) ?? { success: [], failure: [] };
      bucket.failure.push(r);
      byStrategy.set(key, bucket);
    }
    for (const [strategy, bucket] of byStrategy) {
      const total = bucket.success.length + bucket.failure.length;
      candidates.push(
        candidate({
          category: 'RECOVERY_PATTERN',
          scope: 'GLOBAL',
          subject: strategy,
          predicate: 'effective_verified_rate',
          value: bucket.success.length / total,
          sampleCount: total,
          successCount: bucket.success.length,
          failureCount: bucket.failure.length,
          verifiedCount: bucket.success.length,
          executionIds: [...bucket.success, ...bucket.failure].map((r) => r.executionId),
          signalKinds: ['RECOVERY_SUCCESS', 'RECOVERY_FAILURE'],
          createdAt: now,
        }),
      );
    }
  }

  // ── VERIFICATION_PATTERN ────────────────────────────────────────
  const verificationSuccesses = collect('VERIFICATION_SUCCESS');
  const verificationFailures = collect('VERIFICATION_FAILURE');
  if (verificationSuccesses.length + verificationFailures.length > 0) {
    candidates.push(
      candidate({
        category: 'VERIFICATION_PATTERN',
        scope: 'GLOBAL',
        subject: 'frozen_verification',
        predicate: 'success_rate',
        value:
          verificationSuccesses.length /
          (verificationSuccesses.length + verificationFailures.length),
        sampleCount: verificationSuccesses.length + verificationFailures.length,
        successCount: verificationSuccesses.length,
        failureCount: verificationFailures.length,
        verifiedCount: verificationSuccesses.length,
        executionIds: [...verificationSuccesses, ...verificationFailures].map((r) => r.executionId),
        signalKinds: ['VERIFICATION_SUCCESS', 'VERIFICATION_FAILURE'],
        createdAt: now,
      }),
    );
  }

  // ── ROUTING_SIGNAL (advisory ONLY — never a routing authority) ──
  const modelSuccesses = collect('MODEL_SUCCESS');
  const modelFailures = collect('MODEL_FAILURE');
  if (modelSuccesses.length + modelFailures.length > 0) {
    const byCombo = new Map<string, { success: ExecutionRecord[]; failure: ExecutionRecord[] }>();
    for (const r of modelSuccesses) {
      const key = routingSubject(r);
      const bucket = byCombo.get(key) ?? { success: [], failure: [] };
      bucket.success.push(r);
      byCombo.set(key, bucket);
    }
    for (const r of modelFailures) {
      const key = routingSubject(r);
      const bucket = byCombo.get(key) ?? { success: [], failure: [] };
      bucket.failure.push(r);
      byCombo.set(key, bucket);
    }
    for (const [subject, bucket] of byCombo) {
      const total = bucket.success.length + bucket.failure.length;
      const isProvider = subject.startsWith('provider:');
      candidates.push(
        candidate({
          category: 'ROUTING_SIGNAL',
          scope: isProvider ? 'PROVIDER' : 'MODEL',
          subject,
          predicate: 'verified_success_rate',
          value: bucket.success.length / total,
          sampleCount: total,
          successCount: bucket.success.length,
          failureCount: bucket.failure.length,
          verifiedCount: bucket.success.length,
          executionIds: [...bucket.success, ...bucket.failure].map((r) => r.executionId),
          signalKinds: ['MODEL_SUCCESS', 'MODEL_FAILURE'],
          createdAt: now,
        }),
      );
    }
  }

  // ── TASK_PATTERN (goal outcome rates per goal type) ─────────────
  if (runRecord !== undefined && runRecord.finalOutcome !== undefined) {
    const goalType = goalTypeSignature(runRecord);
    // A frozen ACHIEVED label alone is not positive learning evidence.
    // Only an achieved run with at least one VERIFIED record may improve
    // the task-pattern rate.
    const success =
      runRecord.finalOutcome === 'ACHIEVED' && runRecord.verifiedEvidenceCount > 0 ? 1 : 0;
    const failure =
      runRecord.finalOutcome === 'FAILED' || runRecord.finalOutcome === 'BLOCKED' ? 1 : 0;
    if (success + failure > 0) {
      candidates.push(
        candidate({
          category: 'TASK_PATTERN',
          scope: 'GOAL_TYPE',
          subject: goalType,
          predicate: 'outcome_rate',
          value: success / (success + failure),
          sampleCount: 1,
          successCount: success,
          failureCount: failure,
          verifiedCount: success,
          executionIds: [runRecord.executionId],
          signalKinds: ['GOAL_ACHIEVED', 'GOAL_BLOCKED', 'GOAL_FAILED'],
          createdAt: now,
        }),
      );
    }
  }

  return candidates;
}
