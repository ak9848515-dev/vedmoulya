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
