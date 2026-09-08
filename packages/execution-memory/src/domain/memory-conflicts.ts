// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Memory: Conflict Handling (PHASE 19)
//
// Memory is NEVER stronger than current runtime truth or current
// explicit intent. Deterministic rules:
//   - a tool memory whose tool is currently UNAVAILABLE is dropped,
//   - a routing signal for a currently DEGRADED provider is dropped,
//   - a user-preference memory contradicted by an EXPLICIT current
//     request is dropped,
//   - a capability memory for an unavailable capability is dropped.
//
// Resolutions are recorded for observability (never silent).
// ──────────────────────────────────────────────────────────────────

import type { MemoryEvidence, RuntimeTruth } from '../types/execution-memory-types.js';

export function resolveMemoryConflicts(
  evidence: MemoryEvidence[],
  runtimeTruth: RuntimeTruth | undefined,
): {
  accepted: MemoryEvidence[];
  resolutions: import('../types/execution-memory-types.js').ConflictResolution[];
} {
  const resolutions: import('../types/execution-memory-types.js').ConflictResolution[] = [];
  if (runtimeTruth === undefined) return { accepted: evidence, resolutions };

  const accepted: MemoryEvidence[] = [];
  for (const item of evidence) {
    let dropped: string | undefined;

    if (item.category === 'TOOL_RELIABILITY' && runtimeTruth.availableTools !== undefined) {
      if (!runtimeTruth.availableTools.includes(item.subject)) {
        dropped = `CURRENT_RUNTIME_WINS: tool "${item.subject}" is not currently available`;
      }
    }
    if (
      item.category === 'ROUTING_SIGNAL' &&
      runtimeTruth.degradedProviders !== undefined &&
      dropped === undefined
    ) {
      const entities = item.subject.match(/provider:([^/]+)|model:([^/]+)/g) ?? [];
      const names = entities.map((e) => e.replace(/^(provider|model):/, ''));
      const degraded = runtimeTruth.degradedProviders;
      if (names.some((name) => degraded.includes(name))) {
        dropped = `CURRENT_HEALTH_WINS: provider/model "${names.join(', ')}" is currently degraded`;
      }
    }
    if (
      item.category === 'USER_PREFERENCE' &&
      runtimeTruth.explicitOverrides !== undefined &&
      dropped === undefined
    ) {
      const key = item.subject;
      if (
        runtimeTruth.explicitOverrides[key] !== undefined &&
        runtimeTruth.explicitOverrides[key] !== String(item.value)
      ) {
        dropped = `CURRENT_EXPLICIT_REQUEST_WINS: current request "${key}" overrides preference memory`;
      }
    }
    if (
      item.category === 'TOOL_RELIABILITY' &&
      runtimeTruth.availableCapabilities !== undefined &&
      dropped === undefined
    ) {
      // Capability-scoped tool evidence without the capability currently
      // available cannot influence a decision (advisory only).
      const cap = item.capability;
      const available = runtimeTruth.availableCapabilities;
      if (cap !== undefined && !available.includes(cap)) {
        dropped = `CURRENT_RUNTIME_WINS: capability "${cap}" is not currently available`;
      }
    }

    if (dropped !== undefined) {
      resolutions.push({ entryId: item.entryId, reason: dropped });
    } else {
      accepted.push(item);
    }
  }
  return { accepted, resolutions };
}
