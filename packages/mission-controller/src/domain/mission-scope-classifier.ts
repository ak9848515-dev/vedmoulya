// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Controller: Mission Scope Classifier (SCOPE-01)
//
// SCOPE AWARENESS — the smallest missing capability between USER SCOPE and
// REPOSITORY DISCOVERY.
//
// `FsRepositoryInspector` legitimately reports repository work the user never
// asked for (incomplete packages, missing integrations, failing tests, gaps,
// TODOs). Before SCOPE-01 every such item became a Mission objective through
// `DevelopmentObjectiveSelector`, so incidental repository debt consumed the
// objective budget and a Mission whose DECLARED objectives all VERIFIED could
// still end FAILED with "Maximum objectives reached".
//
// This module is the missing link and nothing more. It introduces no package,
// no loop, no planner, no scheduler and no new state machine: it reuses
//   - the EXISTING inspection evidence shape (`RepositoryInspectionEvidence`),
//   - the EXISTING objective titles the selector already produced,
//   - the EXISTING `MissionObjective.dependencies` field the selectors already
//     enforce, and
//   - the EXISTING mission goal / objective text.
//
// Classification is fully deterministic (string containment, no model, no
// heuristics, no I/O) so TEST E (multiple discoveries) is stable.
//
//   REQUIRED     a DECLARED objective explicitly names the item → it is work
//                the user scoped. It becomes a real objective and the
//                declaring objective DEPENDS on it, so it genuinely blocks.
//   OPTIONAL     the item is referenced by the mission goal but by no single
//                declared objective → recorded + surfaced, never auto-executed.
//   OUT_OF_SCOPE the item is unrelated to the requested work → reported only.
//
// Nothing is hidden, nothing is marked complete, and the inspector is never
// suppressed: every discovered item lands in the returned report.
// ──────────────────────────────────────────────────────────────────

import type {
  DiscoveredWorkItem,
  DiscoveredWorkKind,
  DiscoveredWorkScope,
  Mission,
  MissionScopeReport,
  RepositoryInspectionEvidence,
} from '../types/mission-types.js';

/**
 * Fixed kind order. Classification and reporting follow this order so the same
 * inspection evidence always yields byte-identical output (TEST E).
 */
const KIND_ORDER: readonly DiscoveredWorkKind[] = [
  'FAILING_TEST',
  'INCOMPLETE_PACKAGE',
  'MISSING_INTEGRATION',
  'ARCHITECTURAL_GAP',
  'TODO',
];

/** Bounds the report so a huge monorepo cannot grow an unbounded mission doc. */
const MAX_ITEMS_PER_KIND = 25;

/**
 * The objective title each discovered item WOULD take. Identical strings to
 * the ones `DevelopmentObjectiveSelector` has always produced, so existing
 * objective-title filtering (`existingTitles`) keeps working unchanged.
 */
export function discoveredObjectiveTitle(kind: DiscoveredWorkKind, label: string): string {
  switch (kind) {
    case 'FAILING_TEST':
      return `Fix failing test: ${label}`;
    case 'INCOMPLETE_PACKAGE':
      return `Complete package: ${label}`;
    case 'MISSING_INTEGRATION':
      return `Implement integration: ${label}`;
    case 'ARCHITECTURAL_GAP':
      return `Resolve gap: ${label}`;
    case 'TODO':
      return `Resolve TODO: ${label}`;
  }
}

/**
 * Normalize text for containment matching: lowercase, every non-alphanumeric
 * run collapsed to a single space. This makes `packages/analytics`,
 * `packages analytics` and `Packages/Analytics` the same reference, and lets
 * `services/api/src/services/Foo.ts` be found in a prose objective.
 */
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * A label references a scope text when its normalized form appears in it.
 * Normalized labels shorter than 3 characters are ignored: they would match
 * almost any text and would manufacture false REQUIRED work.
 */
function references(scopeText: string, normalizedLabel: string): boolean {
  if (normalizedLabel.length < 3) return false;
  return normalizeText(scopeText).includes(normalizedLabel);
}

function labelsFor(inspection: RepositoryInspectionEvidence, kind: DiscoveredWorkKind): string[] {
  switch (kind) {
    case 'FAILING_TEST':
      return inspection.failingTests;
    case 'INCOMPLETE_PACKAGE':
      return inspection.incompletePackages;
    case 'MISSING_INTEGRATION':
      return inspection.missingIntegrations;
    case 'ARCHITECTURAL_GAP':
      return inspection.architecturalGaps;
    case 'TODO':
      return inspection.todos;
  }
}

/** Text a declared objective contributes to scope matching. */
function objectiveScopeText(objective: {
  title: string;
  objective: string;
  description: string;
}): string {
  return `${objective.title} ${objective.objective} ${objective.description}`;
}

/** TRUE when this exact discovered item already became a mission objective. */
function alreadyObjectiveFor(kind: DiscoveredWorkKind, label: string, mission: Mission): boolean {
  return mission.objectives.some(
    (objective) =>
      objective.title === discoveredObjectiveTitle(kind, label) ||
      (objective.discovery?.kind === kind && objective.discovery.label === label),
  );
}

/** Text the mission itself contributes to scope matching. */
function missionScopeText(mission: Mission): string {
  return `${mission.title} ${mission.objective} ${mission.description}`;
}

/**
 * Objectives the USER declared. A previously discovered objective carries a
 * `discovery` record; it is repository work, not requested work, and must
 * never be counted as part of the requested scope (otherwise discovery would
 * grow its own justification on every pass).
 */
export function isDeclaredObjective(objective: Mission['objectives'][number]): boolean {
  return objective.discovery === undefined;
}

/**
 * Classify every item the repository inspection surfaced against the mission's
 * own declared scope. Pure and deterministic.
 */
export function classifyDiscoveredWork(
  mission: Mission,
  inspection: RepositoryInspectionEvidence,
): MissionScopeReport {
  const declared = mission.objectives.filter(isDeclaredObjective);
  const missionText = missionScopeText(mission);

  const required: DiscoveredWorkItem[] = [];
  const optional: DiscoveredWorkItem[] = [];
  const outOfScope: DiscoveredWorkItem[] = [];

  for (const kind of KIND_ORDER) {
    // Deterministic, de-duplicated, bounded slice of the inspection labels.
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const raw of labelsFor(inspection, kind)) {
      const label = typeof raw === 'string' ? raw.trim() : '';
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push(label);
      if (labels.length >= MAX_ITEMS_PER_KIND) break;
    }

    for (const label of labels) {
      const normalizedLabel = normalizeText(label);
      const blockingObjectiveIds = declared
        .filter((objective) => references(objectiveScopeText(objective), normalizedLabel))
        .map((objective) => objective.objectiveId);

      // A mission that declares NO objective has no requested scope to
      // protect, so repository state IS its requested work — the pre-existing
      // open-ended autonomous-development semantics (BLD-025 discovery-driven
      // recovery). Scope awareness protects a DECLARED scope; it never
      // disables discovery for a scope-less mission.
      if (declared.length === 0) {
        required.push({
          kind,
          label,
          title: discoveredObjectiveTitle(kind, label),
          classification: 'REQUIRED',
          rationale: `Mission declares no objective scope, so discovered repository work "${label}" is the mission's own work`,
          blockingObjectiveIds: [],
          executed: alreadyObjectiveFor(kind, label, mission),
        });
        continue;
      }

      if (blockingObjectiveIds.length > 0) {
        required.push({
          kind,
          label,
          title: discoveredObjectiveTitle(kind, label),
          classification: 'REQUIRED',
          rationale: `Declared objective ${blockingObjectiveIds.join(', ')} explicitly references "${label}", so the requested work depends on it`,
          blockingObjectiveIds,
          executed: alreadyObjectiveFor(kind, label, mission),
        });
        continue;
      }

      if (references(missionText, normalizedLabel)) {
        optional.push({
          kind,
          label,
          title: discoveredObjectiveTitle(kind, label),
          classification: 'OPTIONAL',
          rationale: `Related to the mission goal but named by no declared objective: repository improvement "${label}" is reported, not executed`,
          blockingObjectiveIds: [],
          executed: false,
        });
        continue;
      }

      outOfScope.push({
        kind,
        label,
        title: discoveredObjectiveTitle(kind, label),
        classification: 'OUT_OF_SCOPE',
        rationale: `Unrelated to the requested work: "${label}" is reported, never executed by this Mission`,
        blockingObjectiveIds: [],
        executed: false,
      });
    }
  }

  const verified = declared.filter((o) => o.state === 'VERIFIED').length;
  const failed = declared.filter((o) => o.state === 'FAILED').length;

  const report: MissionScopeReport = {
    requestedWork: {
      total: declared.length,
      verified,
      failed,
      pending: declared.filter((o) => o.state === 'PENDING' || o.state === 'READY').length,
    },
    required,
    optional,
    outOfScope,
    summary: '',
  };
  report.summary = renderScopeSummary(report);
  return report;
}

/**
 * Stable one-line summary. Appended to a mission outcome reason so a result can
 * never read as "completed" while silently ignoring discovered repository work.
 */
export function renderScopeSummary(report: MissionScopeReport): string {
  const { requestedWork, required, optional, outOfScope } = report;
  const executedRequired = required.filter((item) => item.executed).length;
  const parts = [
    `requested work ${requestedWork.verified}/${requestedWork.total} verified` +
      (requestedWork.failed > 0 ? `, ${requestedWork.failed} failed` : ''),
    `discovered required work ${required.length} (${executedRequired} executed)`,
    `discovered related work ${optional.length} (reported, not executed)`,
    `discovered out-of-scope work ${outOfScope.length} (reported, not executed)`,
  ];
  return parts.join('; ');
}

/** All items of a classification, REQUIRED first (deterministic). */
export function itemsByScope(
  report: MissionScopeReport,
  scope: DiscoveredWorkScope,
): DiscoveredWorkItem[] {
  if (scope === 'REQUIRED') return report.required;
  if (scope === 'OPTIONAL') return report.optional;
  return report.outOfScope;
}
