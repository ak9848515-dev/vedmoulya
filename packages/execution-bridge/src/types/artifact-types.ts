// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: Artifact Verification Types
// SPRINT-024 — REAL RUNTIME ARTIFACT VERIFICATION (Phase 1)
//
// A NARROW, read-only, deterministic artifact-verification vocabulary
// that the existing StepVerifier / execution-bridge verification path
// can use to inspect the REAL evidence produced by a bounded task —
// independent of any execution claim. "File created" in a provider
// response never proves "file valid and outcome successful".
//
// Honesty invariants:
//   - Every check is confined to an approved execution boundary root.
//   - Missing / malformed / contradictory / unavailable evidence is
//     NEVER converted into SUCCESS — it stays FAIL / UNKNOWN.
//   - The verifier only READS files; it never executes commands.
// ──────────────────────────────────────────────────────────────────

/** The closed set of deterministic artifact checks (Phase 1 A–D). */
export type ArtifactCheckType =
  | 'FILE_EXISTS' // expected file must exist (non-empty unless emptyAllowed)
  | 'FILE_ABSENT' // a file that must NOT exist (unexpected presence = FAIL)
  | 'JSON_VALID' // file parses as JSON
  | 'JSON_FIELD' // parsed JSON must contain required fields (dot paths)
  | 'CSV_VALID' // basic CSV structure: consistent header + rows
  | 'CALCULATION' // independent deterministic recompute vs expected
  | 'DRY_RUN'; // verify a safe dry-run's expected side-effect evidence (read-only)

/** A deterministic calculation the verifier can INDEPENDENTLY recompute. */
export type CalculationKind = 'sum' | 'count' | 'length' | 'equals';

export interface CalculationExpectation {
  kind: CalculationKind;
  /** For 'sum'/'count': a JSON array field path (dot path) to reduce. */
  field?: string;
  /** For 'length': target string field path (dot path). */
  targetField?: string;
  /** For 'equals': dot path to the value compared against `expected`. */
  valueField?: string;
  /** The INDEPENDENTLY computed expected value. */
  expected: number;
}

export interface ArtifactExpectation {
  /** Unique id (used for traceability). */
  checkId: string;
  type: ArtifactCheckType;
  /** RELATIVE path within the approved execution boundary root. */
  path: string;
  /** FILE_EXISTS: allow an empty file to count as present. */
  emptyAllowed?: boolean;
  /** JSON_FIELD: required field dot-paths (e.g. "user.name", "items.0.id"). */
  requiredFields?: string[];
  /** CALCULATION: the deterministic recompute. */
  calculation?: CalculationExpectation;
  /** DRY_RUN: expected marker substring that proves the dry-run's side effect. */
  expectedContent?: string;
  /** JSON_FIELD / CALCULATION(equals): the expected value. */
  expectedValue?: unknown;
}

export type ArtifactCheckStatus = 'PASS' | 'FAIL' | 'UNKNOWN';

export interface ArtifactCheckResult {
  checkId: string;
  type: ArtifactCheckType;
  path: string;
  status: ArtifactCheckStatus;
  /** Human-readable, aggregate-only (no secrets). */
  detail: string;
}

export interface ArtifactVerificationResult {
  /** True only when every check PASSED (no FAIL, no UNKNOWN). */
  passed: boolean;
  checks: ArtifactCheckResult[];
  failedCount: number;
  unknownCount: number;
  /** Summary line for the UI (plain language). */
  summary: string;
}
