// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: Artifact Verifier
// SPRINT-024 — REAL RUNTIME ARTIFACT VERIFICATION (Phase 1)
//
// A deterministic, READ-ONLY verification helper (Phase 1 A–D). It
// inspects the REAL evidence produced by a bounded task through the
// root-confined ArtifactReaderPort — independent of any execution
// claim. It is composed INTO the existing StepVerifier verification
// path; it is NOT a new engine, budget, execution, approval or
// notification system.
//
// Honesty rules:
//   - A provider saying "file created" is NOT success. The verifier
//     must observe the artifact itself.
//   - Missing expected artifact  → FAIL (never SUCCESS).
//   - Malformed structure        → FAIL.
//   - Recompute mismatch         → FAIL.
//   - Unavailable / undecidable evidence → UNKNOWN (never SUCCESS).
//   - The verifier NEVER executes commands or mutates state.
// ──────────────────────────────────────────────────────────────────

import type { ArtifactReaderPort } from '../contracts/artifact-ports.js';
import type {
  ArtifactCheckResult,
  ArtifactExpectation,
  ArtifactVerificationResult,
} from '../types/artifact-types.js';

/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: the only computed member access in this module indexes
   JSON-decoded artifact data (getPath / deepEqual) with dot-paths drawn from
   the verifier's OWN ArtifactExpectation config (plan-controlled, closed set
   of check definitions — never raw interactive user input), and splitCsv
   indexes the already-in-memory line string by its own loop counter. Reads
   are null-safe under strict + noUncheckedIndexedAccess. */

export class ArtifactVerifier {
  constructor(private readonly reader: ArtifactReaderPort) {}

  /**
   * Verify a bounded set of artifact expectations against the real files
   * inside the approved boundary root. Returns a single PASS only when every
   * check passed and no check was UNKNOWN.
   */
  async verify(expectations: ArtifactExpectation[]): Promise<ArtifactVerificationResult> {
    const checks: ArtifactCheckResult[] = [];
    for (const expectation of expectations) {
      const result = await this.runCheck(expectation);
      checks.push(result);
    }
    const failedCount = checks.filter((c) => c.status === 'FAIL').length;
    const unknownCount = checks.filter((c) => c.status === 'UNKNOWN').length;
    const passed = failedCount === 0 && unknownCount === 0;
    const summary = passed
      ? `${checks.length} artifact check(s) verified.`
      : failedCount > 0 && unknownCount === 0
        ? `Artifact verification failed (${failedCount} check(s)).`
        : `Artifact verification inconclusive (${unknownCount} check(s) UNKNOWN, ${failedCount} failed).`;
    return { passed, checks, failedCount, unknownCount, summary };
  }

  // ── Single check dispatch ────────────────────────────────────────

  private async runCheck(expectation: ArtifactExpectation): Promise<ArtifactCheckResult> {
    switch (expectation.type) {
      case 'FILE_EXISTS':
        return this.checkFileExists(expectation);
      case 'FILE_ABSENT':
        return this.checkFileAbsent(expectation);
      case 'JSON_VALID':
        return this.checkJson(expectation, false);
      case 'JSON_FIELD':
        return this.checkJson(expectation, true);
      case 'CSV_VALID':
        return this.checkCsv(expectation);
      case 'CALCULATION':
        return this.checkCalculation(expectation);
      case 'DRY_RUN':
        return this.checkDryRun(expectation);
    }
  }

  private async read(expectation: ArtifactExpectation): Promise<{
    ok: boolean;
    denied?: boolean;
    unknown?: boolean;
    content?: string;
    detail: string;
  }> {
    const read = await this.reader.read(expectation.path);
    if (read.denied) {
      return { ok: false, denied: true, detail: 'Path outside the approved boundary (denied).' };
    }
    if (!read.found) {
      return { ok: false, detail: 'Artifact not found.' };
    }
    // Found but unreadable (I/O / permission / truncation) → UNKNOWN evidence.
    if (read.content === undefined) {
      return {
        ok: false,
        unknown: true,
        detail: read.error ?? 'Artifact present but evidence unavailable.',
      };
    }
    if (read.byteLength === 0 && !expectation.emptyAllowed && expectation.type !== 'FILE_ABSENT') {
      return { ok: false, detail: 'Artifact is empty.' };
    }
    return { ok: true, content: read.content, detail: `Read ${read.byteLength ?? 0} byte(s).` };
  }

  // ── A. FILE EXISTENCE ────────────────────────────────────────────

  private async checkFileExists(e: ArtifactExpectation): Promise<ArtifactCheckResult> {
    const read = await this.read(e);
    if (read.denied) return this.fail(e, read.detail);
    if (read.unknown) return this.unknown(e, read.detail);
    if (!read.ok) return this.fail(e, read.detail);
    if (read.content === '' && !e.emptyAllowed) {
      return this.fail(e, 'Expected file exists but is empty.');
    }
    return this.pass(e, `File exists${e.emptyAllowed ? ' (empty allowed)' : ''}.`);
  }
  private async checkFileAbsent(e: ArtifactExpectation): Promise<ArtifactCheckResult> {
    const exists = await this.reader.exists(e.path);
    // Denied = the expectation path is invalid (unsafe) — fail-closed, and the
    // SAME semantics as FILE_EXISTS: an unverifiable expectation never passes.
    if (exists.denied) return this.fail(e, 'Path outside the approved boundary (denied).');
    if (exists.found) {
      return this.fail(e, 'Unexpected file present — it must not exist.');
    }
    return this.pass(e, 'Unexpected file absent (as required).');
  }

  // ── B. VALID STRUCTURE ───────────────────────────────────────────

  private async readJson(e: ArtifactExpectation): Promise<{
    ok: boolean;
    unknown?: boolean;
    data?: unknown;
    detail: string;
  }> {
    const read = await this.read(e);
    if (read.denied) return { ok: false, detail: read.detail };
    if (read.unknown) return { ok: false, unknown: true, detail: read.detail };
    if (!read.ok) return { ok: false, detail: read.detail };
    try {
      const data: unknown = JSON.parse(read.content ?? '');
      return { ok: true, data, detail: 'JSON parsed.' };
    } catch (err) {
      return {
        ok: false,
        detail: `Malformed JSON: ${err instanceof Error ? err.message.split('\n')[0] : 'parse error'}`,
      };
    }
  }

  private async checkJson(
    e: ArtifactExpectation,
    requireFields: boolean,
  ): Promise<ArtifactCheckResult> {
    const parsed = await this.readJson(e);
    if (parsed.unknown) return this.unknown(e, parsed.detail);
    if (!parsed.ok) return this.fail(e, parsed.detail);
    if (!requireFields) return this.pass(e, 'Valid JSON.');
    const missing: string[] = [];
    for (const field of e.requiredFields ?? []) {
      const value = getPath(parsed.data, field);
      if (value === undefined) missing.push(field);
    }
    if (missing.length > 0) {
      return this.fail(e, `Required field(s) missing: ${missing.join(', ')}.`);
    }
    if (e.expectedValue !== undefined) {
      const value = getPath(parsed.data, e.requiredFields?.[0] ?? '');
      if (!deepEqual(value, e.expectedValue)) {
        return this.fail(e, 'Field value does not match the expected value.');
      }
    }
    return this.pass(e, `Valid JSON with ${e.requiredFields?.length ?? 0} required field(s).`);
  }

  private async checkCsv(e: ArtifactExpectation): Promise<ArtifactCheckResult> {
    const read = await this.read(e);
    if (read.denied) return this.fail(e, read.detail);
    if (read.unknown) return this.unknown(e, read.detail);
    if (!read.ok) return this.fail(e, read.detail);
    const lines = (read.content ?? '').split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return this.fail(e, 'CSV is empty.');
    const header = splitCsv(lines[0] ?? '');
    if (header.length === 0) return this.fail(e, 'CSV has no header columns.');
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const cols = splitCsv(line);
      if (cols.length !== header.length) {
        return this.fail(e, `Row ${i + 1} has ${cols.length} columns, expected ${header.length}.`);
      }
    }
    return this.pass(e, `Valid CSV: ${header.length} column(s), ${lines.length - 1} data row(s).`);
  }

  // ── C. INDEPENDENT CALCULATION ───────────────────────────────────

  private async checkCalculation(e: ArtifactExpectation): Promise<ArtifactCheckResult> {
    const calc = e.calculation;
    if (!calc) return this.fail(e, 'No calculation expectation provided.');
    const parsed = await this.readJson(e);
    if (parsed.unknown) return this.unknown(e, parsed.detail);
    if (!parsed.ok) return this.fail(e, parsed.detail);

    let actual: number | null = null;
    if (calc.kind === 'sum' || calc.kind === 'count') {
      const arr = getPath(parsed.data, calc.field ?? '');
      if (!Array.isArray(arr)) return this.fail(e, `Field "${calc.field}" is not an array.`);
      // JSON-decoded array — annotate so the reduce stays number-safe (no `any`).
      const numbers: unknown[] = arr;
      actual =
        calc.kind === 'sum'
          ? numbers.reduce<number>((s, n) => s + (typeof n === 'number' ? n : 0), 0)
          : numbers.length;
    } else if (calc.kind === 'length') {
      const value = getPath(parsed.data, calc.targetField ?? '');
      actual = typeof value === 'string' ? value.length : null;
      if (actual === null) return this.fail(e, `Field "${calc.targetField}" is not a string.`);
    } else {
      // calc.kind is narrowed to 'equals' here (closed CalculationKind union).
      const value = getPath(parsed.data, calc.valueField ?? '');
      actual = typeof value === 'number' ? value : null;
      if (actual === null) return this.fail(e, `Field "${calc.valueField}" is not a number.`);
    }

    if (actual !== calc.expected) {
      return this.fail(
        e,
        `Independent recompute mismatch: expected ${calc.expected}, actual ${actual}.`,
      );
    }
    return this.pass(e, `Independent recompute matches (${actual}).`);
  }

  // ── D. DRY-RUN AUTOMATION (read-only evidence) ───────────────────

  private async checkDryRun(e: ArtifactExpectation): Promise<ArtifactCheckResult> {
    const read = await this.read(e);
    if (read.denied) return this.fail(e, read.detail);
    if (read.unknown) return this.unknown(e, read.detail);
    if (!read.ok) return this.fail(e, read.detail);
    if (!e.expectedContent) return this.fail(e, 'No expected dry-run evidence marker provided.');
    if (!(read.content ?? '').includes(e.expectedContent)) {
      return this.fail(e, 'Dry-run evidence does not contain the expected marker.');
    }
    return this.pass(e, 'Dry-run produced the expected side-effect evidence (read-only).');
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private pass(e: ArtifactExpectation, detail: string): ArtifactCheckResult {
    return { checkId: e.checkId, type: e.type, path: e.path, status: 'PASS', detail };
  }

  private fail(e: ArtifactExpectation, detail: string): ArtifactCheckResult {
    return { checkId: e.checkId, type: e.type, path: e.path, status: 'FAIL', detail };
  }

  private unknown(e: ArtifactExpectation, detail: string): ArtifactCheckResult {
    return { checkId: e.checkId, type: e.type, path: e.path, status: 'UNKNOWN', detail };
  }
}
// ── Dot-path resolution (closed, deterministic) ────────────────────
function getPath(data: unknown, path: string): unknown {
  if (!path) return data;
  const parts = path.split('.');
  let current: unknown = data;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(part)) {
      current = current[Number(part)];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b))
    return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return (
      ka.length === kb.length &&
      ka.every((k) =>
        deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
      )
    );
  }
  return false;
}

/** Minimal RFC-4180-ish CSV row splitter (handles quoted fields). */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}
