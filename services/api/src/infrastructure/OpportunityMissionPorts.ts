// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · S5.1 — Mission launch port
//
// The ONLY way the acquisition layer may create a Mission. It is a thin seam
// over the EXISTING canonical `mission.createAndRun` path (MissionService), so
// no Mission creation logic is duplicated and no second Mission engine exists.
//
// Two rules are enforced structurally, not by convention:
//   1. A Mission is launched ONLY for an opportunity that already reached
//      APPROVED through the guarded lifecycle. The router checks the record
//      first; this port refuses again if asked directly.
//   2. A launch failure is an HONEST failure. It returns a discriminated
//      result and never reports a missionId it does not have, so a caller can
//      never persist an association for a Mission that does not exist.
// ─────────────────────────────────────────────────────────────────────────────

export interface MissionLaunchInput {
  userId: string;
  title: string;
  description: string;
  /**
   * S7.2 — the DERIVED, bounded Mission objective. This is what the canonical
   * Mission engine actually receives as its objective; it is built from the
   * approved opportunity by `deriveOpportunityMissionObjective` (never invented
   * requirements). Optional only so existing callers/tests that pass a bare
   * title/description keep compiling; the acquisition path always supplies it.
   */
  objective?: string;
  /** S7.2 — bounded, derivable initial objectives (from the opportunity's own
   *  stated requirements). Omitted when the opportunity states none. */
  initialObjectives?: string[];
  /** Autonomy/budget come from the caller; this layer adds no autonomy. */
  autonomyLevel?: number;
  maxCostUsd?: number;
}

export type MissionLaunchResult =
  { success: true; missionId: string } | { success: false; code: string; message: string };

/** The injected slice of the canonical Mission service. */
export interface MissionLauncher {
  createAndRun(
    userId: string,
    input: Omit<MissionLaunchInput, 'userId'>,
  ): Promise<{ missionId: string } | { error: string }>;
}

/**
 * S7.2 — the opportunity fields the objective derivation may read. Deliberately
 * narrower than the full lifecycle record so this pure function is trivially
 * testable and cannot reach anything it does not need. Every field is OPTIONAL
 * except title: when the opportunity does not state something, the objective
 * says so honestly instead of inventing a value.
 */
export interface OpportunityMissionSource {
  title: string;
  description?: string;
  /** Capabilities the source ACTUALLY stated (never a hallucinated list). */
  requiredCapabilities?: string[];
  /** External provenance, when the record carries it. */
  sourceRef?: { source: string; sourceReference: string };
  /** Evidence already on the record (label + status), rendered verbatim. */
  evidence?: Array<{ label: string; status: string }>;
  category?: string;
  /** 0..1 qualification score — carried as EVIDENCE, never as a promise. */
  qualificationScore?: number;
  /** The approval record's scope — provenance for the human decision. */
  approvalScope?: string;
}

/**
 * S7.2 — derive a BOUNDED, verifiable Mission objective from an approved
 * opportunity.
 *
 * This is the ONLY place the opportunity→Mission request is shaped. It:
 *   • preserves the opportunity title and description verbatim,
 *   • preserves the stated requiredCapabilities,
 *   • preserves source/provenance and the record's own evidence,
 *   • states missing information HONESTLY ("not stated by the opportunity")
 *     instead of inventing requirements,
 *   • produces a bounded objective with an explicit deliverable and observable
 *     verification criteria — never an unbounded "do whatever it takes".
 */
export function deriveOpportunityMissionObjective(source: OpportunityMissionSource): {
  objective: string;
  initialObjectives: string[];
} {
  const title = source.title.trim().length > 0 ? source.title.trim() : '(untitled opportunity)';
  const requirements =
    source.description !== undefined && source.description.trim().length > 0
      ? source.description.trim()
      : 'No description was provided by the opportunity source.';
  const capabilities =
    source.requiredCapabilities !== undefined && source.requiredCapabilities.length > 0
      ? source.requiredCapabilities.join(', ')
      : 'No required capabilities were stated by the opportunity source.';
  const provenance =
    source.sourceRef !== undefined
      ? `${source.sourceRef.source} (${source.sourceRef.sourceReference})`
      : 'No external source/provenance was recorded for this opportunity.';
  const evidenceLines =
    source.evidence !== undefined && source.evidence.length > 0
      ? source.evidence.map((e) => `${e.label} (${e.status})`).join('; ')
      : 'No evidence was recorded on this opportunity.';
  const scoreLine =
    source.qualificationScore !== undefined
      ? `Qualification score (advisory evidence, not a promise): ${source.qualificationScore.toFixed(2)}`
      : 'Qualification score: not available.';
  const approvalLine =
    source.approvalScope !== undefined && source.approvalScope.length > 0
      ? `Approved by the human owner — scope: ${source.approvalScope}`
      : 'Approved by the human owner.';

  const objective = [
    `Complete the requested deliverable for:`,
    title,
    '',
    'Requirements:',
    requirements,
    '',
    'Required capabilities:',
    capabilities,
    '',
    'Source / provenance:',
    provenance,
    '',
    'Relevant qualification / value evidence:',
    scoreLine,
    evidenceLines,
    '',
    'Deliverable:',
    `A reviewable artifact that satisfies the stated requirements for "${title}", prepared for human delivery.`, // prettier-ignore
    '',
    'Verification:',
    'The deliverable is verified only when it addresses every stated requirement above and its evidence is checkable. Missing information above is NOT to be invented — leave it unaddressed and report it.', // prettier-ignore
    '',
    approvalLine,
    'Human verification and external submission remain HUMAN actions — this Mission stops before any external submission.', // prettier-ignore
  ].join('\n');

  // Bounded initial objectives come ONLY from requirements the opportunity
  // actually stated. With no stated capabilities there is exactly one bounded
  // objective (the summary above) — never a fabricated checklist.
  const initialObjectives =
    source.requiredCapabilities !== undefined && source.requiredCapabilities.length > 0
      ? source.requiredCapabilities.map(
          (capability) => `Satisfy the stated capability requirement: ${capability}`,
        )
      : [];

  return { objective, initialObjectives };
}

export interface MissionLaunchPort {
  launch(input: MissionLaunchInput): Promise<MissionLaunchResult>;
}

export function createMissionLaunchPort(launcher: MissionLauncher): MissionLaunchPort {
  return {
    launch: async (input): Promise<MissionLaunchResult> => {
      // A Mission is real work. The autonomy ceiling is the caller's existing
      // default, not anything acquisition raises.
      try {
        const result = await launcher.createAndRun(input.userId, {
          title: input.title,
          description: input.description,
          // S7.2 — forward the DERIVED bounded objective. When the caller did not
          // supply one (older callers), fall back to the description so the
          // Mission objective is never empty/undefined.
          objective: input.objective ?? input.description,
          ...(input.initialObjectives !== undefined && input.initialObjectives.length > 0
            ? { initialObjectives: input.initialObjectives }
            : {}),
          ...(input.autonomyLevel !== undefined ? { autonomyLevel: input.autonomyLevel } : {}),
          ...(input.maxCostUsd !== undefined ? { maxCostUsd: input.maxCostUsd } : {}),
        });
        if ('error' in result) {
          return {
            success: false,
            code: 'MISSION_CREATION_FAILED',
            message: result.error || 'Mission creation failed.',
          };
        }
        if (typeof result.missionId !== 'string' || result.missionId.length === 0) {
          // Never invent an id — an association for a Mission we cannot name
          // would be a false claim of commercial linkage.
          return {
            success: false,
            code: 'MISSION_CREATION_FAILED',
            message: 'Mission creation returned no missionId.',
          };
        }
        return { success: true, missionId: result.missionId };
      } catch (error) {
        return {
          success: false,
          code: 'MISSION_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Mission creation failed.',
        };
      }
    },
  };
}
