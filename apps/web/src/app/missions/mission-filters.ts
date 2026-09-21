// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Missions Filtering (UX-04)
//
// /missions is a history / discovery surface, so it must let the user narrow the
// real mission list. Filters are derived purely from mission STATE — no
// grouping, scoring or inference is invented.
//
// This lives outside `page.tsx` on purpose: a Next.js route module may only
// export its route contract, so shared helpers belong in their own module.
// ─────────────────────────────────────────────────────────────────────────────

import type { MissionHistoryEntry } from '../../lib/api-client.js';

export type MissionFilter = 'all' | 'active' | 'attention' | 'completed' | 'failed' | 'cancelled';

/** Mission states in which nothing further is expected. */
export const TERMINAL_MISSION_STATES: readonly string[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

/** Mission states that require a human (approval, provider wait, block, pause). */
export const ATTENTION_MISSION_STATES: readonly string[] = [
  'WAITING_FOR_APPROVAL',
  'WAITING_FOR_PROVIDER',
  'BLOCKED',
  'PAUSED',
];

export function filterMissions(
  missions: readonly MissionHistoryEntry[],
  filter: MissionFilter,
): MissionHistoryEntry[] {
  switch (filter) {
    case 'all':
      return [...missions];
    case 'active':
      return missions.filter((mission) => !TERMINAL_MISSION_STATES.includes(mission.state));
    case 'attention':
      return missions.filter((mission) => ATTENTION_MISSION_STATES.includes(mission.state));
    case 'completed':
      return missions.filter((mission) => mission.state === 'COMPLETED');
    case 'failed':
      return missions.filter((mission) => mission.state === 'FAILED');
    case 'cancelled':
      return missions.filter((mission) => mission.state === 'CANCELLED');
  }
}

/** Count of missions per filter — always from the caller's real list. */
export function missionFilterCounts(
  missions: readonly MissionHistoryEntry[],
): Record<MissionFilter, number> {
  return {
    all: missions.length,
    active: missions.filter((mission) => !TERMINAL_MISSION_STATES.includes(mission.state)).length,
    attention: missions.filter((mission) => ATTENTION_MISSION_STATES.includes(mission.state))
      .length,
    completed: missions.filter((mission) => mission.state === 'COMPLETED').length,
    failed: missions.filter((mission) => mission.state === 'FAILED').length,
    cancelled: missions.filter((mission) => mission.state === 'CANCELLED').length,
  };
}
