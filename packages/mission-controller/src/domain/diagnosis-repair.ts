// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Controller: Autonomous Failure Diagnosis + Repair
// BLD-021A — AUTONOMY-04 — Real failure diagnosis and workspace repair
//
// Extends the existing recovery architecture with:
// 1. Structured failure evidence collection
// 2. Root cause diagnosis (AI-assisted when needed)
// 3. Repair strategy selection
// 4. Governed workspace repair execution
// 5. Post-repair verification
// ──────────────────────────────────────────────────────────────────

import type { FailureContext, MissionFailureClass } from '../types/mission-types.js';

// ── Type Definitions ──────────────────────────────────────────────────────

/**
 * Structured evidence collected from a failed command execution.
 */
export interface CommandFailureEvidence {
  failureContext: FailureContext;
  command?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  timedOut?: boolean;
  durationMs?: number;
  relevantFiles?: string[];
  previousRepairs?: RepairAttemptRecord[];
}

/**
 * Identified root cause of a failure.
 */
export interface RootCause {
  category: RootCauseCategory;
  identifier?: string;
  description: string;
}

/**
 * Categories of root causes that can be diagnosed.
 */
export type RootCauseCategory =
  | 'MISSING_DEPENDENCY'
  | 'MISSING_FILE'
  | 'SYNTAX_ERROR'
  | 'TYPE_ERROR'
  | 'IMPORT_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'TEST_FAILURE'
  | 'TIMEOUT'
  | 'PERMISSION_DENIED'
  | 'ENVIRONMENT_ERROR'
  | 'UNKNOWN';

/**
 * Repair strategies available for autonomous repair.
 */
export type RepairStrategy =
  | 'MODIFY_FILE'
  | 'ADD_OR_UPDATE_DEPENDENCY'
  | 'MODIFY_CONFIGURATION'
  | 'MODIFY_TEST'
  | 'MODIFY_SOURCE'
  | 'RETRY_COMMAND'
  | 'REVISE_STEP'
  | 'REVISE_OBJECTIVE'
  | 'ALTERNATE_TOOL'
  | 'BLOCK'
  | 'FAIL';

/**
 * Result of diagnosing a failure.
 */
export interface FailureDiagnosis {
  failureClass: MissionFailureClass;
  summary: string;
  rootCause?: RootCause;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string[];
  suggestedRepair: RepairStrategy;
  affectedFiles?: string[];
  verificationCommand?: string;
  /**
   * AUTONOMY-06 — bounded advisory lines describing how past verified
   * experiences relate to this diagnosis. Supporting evidence only — never
   * authoritative, never a forced conclusion.
   */
  historicalSupport?: string[];
}

/**
 * Record of a repair attempt.
 */
export interface RepairAttemptRecord {
  repairId: string;
  diagnosis: FailureDiagnosis;
  strategy: RepairStrategy;
  modifiedFiles: string[];
  success: boolean;
  verificationResult?: {
    verified: boolean;
    exitCode: number;
    output?: string;
  };
  attemptedAt: string;
  error?: string;
}

/**
 * Input to the diagnosis process.
 */
export interface DiagnosisInput {
  evidence: CommandFailureEvidence;
  workspaceFiles?: string[];
  objective: string;
  missionContext: string;
  /**
   * AUTONOMY-06 — bounded, verified, historical repair experiences relevant
   * to this failure. ADVISORY ONLY: current evidence stays authoritative;
   * history can support a diagnosis and influence repair RANKING, never
   * bypass governance, never force a strategy over current evidence.
   */
  historicalLearning?: HistoricalRepairEvidence[];
}

/**
 * AUTONOMY-06 — one bounded historical repair experience derived from
 * aggregated execution-memory evidence (fingerprint-merged entries with
 * provenance execution ids and evidence-based confidence).
 */
export interface HistoricalRepairEvidence {
  /** What the history is about: a root-cause category or failure class. */
  subject: string;
  /** The repair strategy historically attempted for this subject. */
  strategy: RepairStrategy;
  successCount: number;
  failureCount: number;
  verifiedCount: number;
  sampleCount: number;
  confidenceLevel: 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Output of the repair process.
 */
export interface RepairResult {
  attempted: boolean;
  success: boolean;
  modifiedFiles: string[];
  verificationResult?: {
    verified: boolean;
    exitCode: number;
    output?: string;
  };
  nextAction: 'CONTINUE' | 'RETRY' | 'REPLAN' | 'BLOCK' | 'FAIL';
  repairRecord?: RepairAttemptRecord;
}

/** Deterministic ordering for mutation-family strategies (stable fallback). */
const MUTATION_FAMILY: readonly RepairStrategy[] = [
  'MODIFY_FILE',
  'ADD_OR_UPDATE_DEPENDENCY',
  'MODIFY_CONFIGURATION',
  'MODIFY_TEST',
  'MODIFY_SOURCE',
];

const MAX_HISTORICAL_SUPPORT_LINES = 5;
const MAX_HISTORICAL_SUPPORT_LINE_CHARS = 160;

// ── Implementation ────────────────────────────────────────────────────────

/**
 * Deterministic root cause analysis from command evidence.
 * Performs structured analysis without AI when patterns are recognized.
 */
export function analyzeRootCause(evidence: CommandFailureEvidence): RootCause | undefined {
  const stderr = evidence.stderr ?? '';
  const stdout = evidence.stdout ?? '';
  const combined = `${stdout}\n${stderr}`.toLowerCase();

  // Missing dependency / module patterns
  const modulePatterns = [
    /cannot find module ['"]([^'"]+)['"]/i,
    /module not found: cannot resolve ['"]([^'"]+)['"]/i,
    /cannot find package ['"]([^'"]+)['"]/i,
  ];
  for (const pattern of modulePatterns) {
    const match = stderr.match(pattern) ?? stdout.match(pattern);
    if (match) {
      return {
        category: 'MISSING_DEPENDENCY',
        identifier: match[1] || 'unknown',
        description: `Missing dependency: ${match[1] || 'unknown module'}`,
      };
    }
  }

  // Generic module not found
  if (/error: cannot find module/i.test(combined)) {
    return {
      category: 'MISSING_DEPENDENCY',
      description: 'Missing module dependency',
    };
  }

  // Import error
  if (combined.includes('import') && (combined.includes('error') || combined.includes('cannot'))) {
    return {
      category: 'IMPORT_ERROR',
      description: 'Import resolution failure',
    };
  }

  // Syntax error
  if (combined.includes('syntaxerror') || combined.includes('unexpected token')) {
    return {
      category: 'SYNTAX_ERROR',
      description: 'Syntax error in code',
    };
  }

  // Type error
  if (combined.includes('typeerror') || (combined.includes('type') && combined.includes('error'))) {
    return {
      category: 'TYPE_ERROR',
      description: 'Type error',
    };
  }

  // Configuration error
  if (combined.includes('config') || combined.includes('configuration')) {
    return {
      category: 'CONFIGURATION_ERROR',
      description: 'Configuration error',
    };
  }

  // Permission denied
  if (combined.includes('permission denied') || combined.includes('eacces')) {
    return {
      category: 'PERMISSION_DENIED',
      description: 'Permission denied',
    };
  }

  // Timeout
  if (evidence.timedOut || combined.includes('timeout')) {
    return {
      category: 'TIMEOUT',
      description: 'Command timed out',
    };
  }

  // Test failure
  if (combined.includes('test') && (combined.includes('fail') || combined.includes('error'))) {
    return {
      category: 'TEST_FAILURE',
      description: 'Test execution failed',
    };
  }

  return undefined;
}

/**
 * Determine repair strategy based on diagnosis.
 */
export function selectRepairStrategy(diagnosis: FailureDiagnosis): RepairStrategy {
  const rootCause = diagnosis.rootCause;

  if (!rootCause) {
    return diagnosis.confidence === 'LOW' ? 'REVISE_STEP' : 'RETRY_COMMAND';
  }

  switch (rootCause.category) {
    case 'MISSING_DEPENDENCY':
      return 'ADD_OR_UPDATE_DEPENDENCY';
    case 'MISSING_FILE':
      return 'MODIFY_FILE';
    case 'SYNTAX_ERROR':
    case 'TYPE_ERROR':
    case 'IMPORT_ERROR':
      return 'MODIFY_SOURCE';
    case 'CONFIGURATION_ERROR':
      return 'MODIFY_CONFIGURATION';
    case 'TEST_FAILURE':
      return 'MODIFY_TEST';
    case 'TIMEOUT':
      return 'RETRY_COMMAND';
    case 'PERMISSION_DENIED':
      return 'BLOCK';
    case 'ENVIRONMENT_ERROR':
      return 'REVISE_STEP';
    case 'UNKNOWN':
    default:
      return diagnosis.confidence === 'HIGH' ? 'MODIFY_SOURCE' : 'REVISE_STEP';
  }
}

/**
 * Create a structured diagnosis from failure evidence.
 * Uses deterministic analysis first, with optional AI enhancement.
 */
export function createDiagnosis(input: DiagnosisInput): FailureDiagnosis {
  const { evidence } = input;

  // Start with deterministic analysis
  const rootCause = analyzeRootCause(evidence);

  // Build evidence list
  const diagEvidence: string[] = [...evidence.failureContext.evidence];
  if (evidence.command) {
    diagEvidence.push(`Command: ${evidence.command}`);
  }
  if (evidence.exitCode !== undefined) {
    diagEvidence.push(`Exit code: ${evidence.exitCode}`);
  }
  if (evidence.timedOut) {
    diagEvidence.push('Command timed out');
  }
  if (evidence.stderr) {
    const trimmedStderr = evidence.stderr.slice(0, 500);
    diagEvidence.push(`stderr: ${trimmedStderr}`);
  }
  if (evidence.stdout) {
    const trimmedStdout = evidence.stdout.slice(0, 500);
    diagEvidence.push(`stdout: ${trimmedStdout}`);
  }

  // Determine confidence based on root cause and evidence quality
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (rootCause) {
    confidence = 'HIGH';
  } else if (evidence.stderr || evidence.stdout || evidence.command) {
    // Has some execution evidence but no pattern matched
    confidence = 'MEDIUM';
  }
  // Otherwise remains LOW

  // Build summary
  const summary = rootCause
    ? `${rootCause.category}: ${rootCause.description}`
    : `Unclassified ${evidence.failureContext.failureClass} failure`;

  const diagnosis: FailureDiagnosis = {
    failureClass: evidence.failureContext.failureClass,
    summary,
    rootCause,
    confidence,
    evidence: diagEvidence,
    suggestedRepair: 'RETRY_COMMAND',
    affectedFiles: evidence.relevantFiles,
    verificationCommand: evidence.command,
  };

  // Select repair strategy based on diagnosis
  diagnosis.suggestedRepair = selectRepairStrategy(diagnosis);

  // AUTONOMY-06 — attach bounded advisory historical support. Current
  // evidence (diagEvidence above) stays authoritative; history only adds
  // supporting context lines for matching root-cause category/failure class.
  if (input.historicalLearning && input.historicalLearning.length > 0) {
    const subjects = new Set<string>();
    if (rootCause) subjects.add(rootCause.category);
    subjects.add(evidence.failureContext.failureClass);
    const support: string[] = [];
    for (const item of input.historicalLearning) {
      if (support.length >= MAX_HISTORICAL_SUPPORT_LINES) break;
      if (!subjects.has(item.subject)) continue;
      if (item.sampleCount < 1) continue;
      const rate = item.sampleCount > 0 ? (item.successCount / item.sampleCount).toFixed(2) : 'n/a';
      const line = `advisory: ${item.subject} → ${item.strategy} historically succeeded ${rate} (samples=${String(item.sampleCount)}, confidence=${item.confidenceLevel})`;
      support.push(line.slice(0, MAX_HISTORICAL_SUPPORT_LINE_CHARS));
    }
    if (support.length > 0) {
      diagnosis.historicalSupport = support;
    }
  }

  return diagnosis;
}

/**
 * AUTONOMY-06 — advisory repair-strategy ranking informed by historical
 * verified repair experiences. STRICT boundaries:
 *   - starts from the deterministic current-evidence strategy
 *     (selectRepairStrategy) — current evidence is authoritative;
 *   - history can only switch WITHIN the governed workspace-mutation family
 *     (all strategies that perform bounded, path-jailed workspace writes);
 *   - a switch requires matching subject AND confidence MEDIUM/HIGH AND
 *     successCount > failureCount for the candidate strategy;
 *   - BLOCK / FAIL / RETRY_COMMAND / REVISE_* / ALTERNATE_TOOL bases and
 *     candidates are NEVER changed by history — governance semantics and
 *     the current diagnosis always win;
 *   - no historical evidence ⇒ exactly the deterministic base strategy.
 */
export function rankRepairStrategy(
  diagnosis: FailureDiagnosis,
  historical?: HistoricalRepairEvidence[],
): RepairStrategy {
  const base = selectRepairStrategy(diagnosis);
  if (historical === undefined || historical.length === 0) return base;

  // History may only influence governed workspace-mutation strategies.
  if (!(MUTATION_FAMILY as readonly string[]).includes(base)) return base;

  // Only a diagnosed root-cause category can match historical subjects —
  // an unclassified failure (no rootCause) is never history-ranked.
  if (diagnosis.rootCause === undefined) return base;
  const subject = diagnosis.rootCause.category;

  let best: { strategy: RepairStrategy; verified: number } | undefined;
  for (const item of historical) {
    if (item.subject !== subject) continue;
    if (!(MUTATION_FAMILY as readonly string[]).includes(item.strategy)) continue;
    // Negative learning: a strategy that historically failed more than it
    // succeeded can never be elevated (bounded, evidence-based).
    if (item.successCount <= item.failureCount) continue;
    if (item.confidenceLevel !== 'MEDIUM' && item.confidenceLevel !== 'HIGH') continue;
    const verified = item.verifiedCount;
    if (best === undefined || verified > best.verified) {
      best = { strategy: item.strategy, verified };
    }
  }
  // Deterministic tie-break: when no historical candidate has verified
  // evidence, keep the deterministic base strategy.
  return best === undefined ? base : best.strategy;
}

/**
 * Create a repair attempt record.
 */
export function createRepairRecord(
  diagnosis: FailureDiagnosis,
  strategy: RepairStrategy,
  modifiedFiles: string[],
  success: boolean,
  clockNow: string,
  options?: {
    verificationResult?: RepairAttemptRecord['verificationResult'];
    error?: string;
  },
): RepairAttemptRecord {
  return {
    repairId: `repair-${Date.now()}`,
    diagnosis,
    strategy,
    modifiedFiles,
    success,
    attemptedAt: clockNow,
    verificationResult: options?.verificationResult,
    error: options?.error,
  };
}
