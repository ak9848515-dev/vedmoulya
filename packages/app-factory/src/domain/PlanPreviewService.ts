// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Plan Preview Service
// EPIC-007 — Phase 8. Before generating substantial code, the factory
// shows the APPLICATION PLAN: what will be built, why, technology
// choices, AI capabilities, expected files, database changes,
// integrations, estimated effort + AI usage, security considerations
// and the deployment target. The user must approve (or modify) the
// plan — the factory NEVER silently generates a large application.
// ──────────────────────────────────────────────────────────────────

import type {
  ApplicationArchitecture,
  ApplicationBlueprint,
  ApplicationPlanPreview,
  ApplicationSpecification,
} from '../types/app-types.js';

export interface PreviewInput {
  specification: ApplicationSpecification;
  architecture: ApplicationArchitecture;
  blueprint: ApplicationBlueprint;
}

export class PlanPreviewService {
  build(input: PreviewInput): ApplicationPlanPreview {
    const { specification, architecture, blueprint } = input;
    const unresolved = specification.unresolved;
    const expectedFiles = blueprint.files.length;
    const estimatedTokens = 4_000 + expectedFiles * 600;
    const estimatedCostUsd = Number(((estimatedTokens / 1_000_000) * 3 + 0.1).toFixed(4));

    return {
      applicationId: specification.applicationId,
      whatWillBeBuilt: `${specification.name} — a ${specification.archetype.replaceAll('-', ' ')} with ${String(specification.features.length)} features and ${String(specification.userJourneys.length)} user journeys.`,
      why: specification.purpose,
      technologyChoices: blueprint.technologies,
      aiCapabilities: architecture.aiCapabilities,
      expectedFiles,
      fileHighlights: blueprint.files.slice(0, 6).map((f) => f.path),
      databaseChanges: blueprint.database.map(
        (d) => `table ${d.table} (${d.columns.length} columns)`,
      ),
      integrations: architecture.integrations.map((i) => i.name),
      estimatedEffort: `${String(expectedFiles)} files · ${String(blueprint.tests.length)} test suites · 11 task stages`,
      estimatedAiUsage: {
        estimatedTokens,
        estimatedCostUsd,
        estimatedProviderCalls: 22,
      },
      securityConsiderations: architecture.securityControls,
      deploymentTarget: architecture.deploymentTarget,
      approvalRequired: true,
      ...(unresolved.length > 0
        ? {
            approvalChanges: `Unresolved requirements to confirm before building: ${unresolved.map((u) => u.label).join('; ')}`,
          }
        : {}),
    };
  }

  approve(preview: ApplicationPlanPreview, changes?: string): ApplicationPlanPreview {
    return {
      ...preview,
      approvalRequired: false,
      approvedAt: new Date().toISOString(),
      approvalChanges: changes ?? preview.approvalChanges,
    };
  }
}
