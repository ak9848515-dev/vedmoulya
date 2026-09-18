// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Production Diagnosis Adapter (FINAL-03A)
//
// The production implementation of the Mission Controller's
// `FailureDiagnosisPort`. It REUSES the EXISTING AUTONOMY-04 diagnosis
// engine (`createDiagnosis` / `rankRepairStrategy` from
// @vedmoulya/mission-controller) over the EXISTING structured contract —
// there is no second diagnosis architecture and no competing type.
//
// This adapter is a pure function over bounded evidence the controller
// already observed. It holds NO tool registry, NO workspace binding, NO
// process spawner and NO provider client: it can only RETURN a structured
// diagnosis. Executing anything remains with the frozen governed path
// (planner → agent execution → governed ToolRegistry).
// ──────────────────────────────────────────────────────────────────

import { createDiagnosis, rankRepairStrategy } from '@vedmoulya/mission-controller';
import type {
  CommandFailureEvidence,
  FailureDiagnosis,
  FailureDiagnosisPort,
  HistoricalRepairEvidence,
} from '@vedmoulya/mission-controller';

/** Bounded number of historical evidence lines folded into diagnosis. */
const MAX_HISTORICAL_ITEMS = 8;

export interface MissionDiagnosisAdapterOptions {
  /**
   * AUTONOMY-06 — optional bounded historical repair evidence (advisory
   * RANKING only). It can never force a strategy over current evidence and
   * can never escape governance; it merely selects between governed
   * workspace-mutation strategies when history is genuinely positive.
   */
  historicalEvidence?: () => HistoricalRepairEvidence[];
}

/**
 * Production diagnosis adapter. Deterministic analysis first (the existing
 * `analyzeRootCause` inside `createDiagnosis`); history can only re-rank
 * WITHIN the governed mutation family, exactly as AUTONOMY-04 defined.
 */
export class MissionDiagnosisAdapter implements FailureDiagnosisPort {
  constructor(private readonly options: MissionDiagnosisAdapterOptions = {}) {}

  // The diagnosis engine is fully deterministic and synchronous: the port is
  // asynchronous by contract (a diagnosis backend may need I/O), so the
  // resolved result is returned without pretending there is a pending await.
  diagnose(input: {
    evidence: CommandFailureEvidence;
    objective: string;
    missionContext: string;
    workspaceFiles?: string[];
    historicalLearning?: HistoricalRepairEvidence[];
  }): Promise<FailureDiagnosis> {
    const diagnosis = createDiagnosis({
      evidence: input.evidence,
      objective: input.objective,
      missionContext: input.missionContext,
      workspaceFiles: input.workspaceFiles,
      historicalLearning: input.historicalLearning,
    });

    // Advisory ranking over the SAME structured diagnosis. Uses caller-
    // supplied history when present, else the adapter's bounded provider.
    const historical = input.historicalLearning ?? this.options.historicalEvidence?.() ?? undefined;
    if (historical && historical.length > 0) {
      const ranked = rankRepairStrategy(diagnosis, historical.slice(0, MAX_HISTORICAL_ITEMS));
      diagnosis.suggestedRepair = ranked;
    }

    return Promise.resolve(diagnosis);
  }
}
