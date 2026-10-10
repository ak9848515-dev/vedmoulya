// REVENUE-004A - Governed Narrative-Consistency Check (Mission Runtime)
// VedMoulya - Mission Runtime: Governed Narrative-Consistency Check (REVENUE-004A)
//
// The quality gap: numerical verification passed while the report claimed
// "the East region had the highest sales" although the verified aggregate
// table showed South ($7,636) above East ($4,809). The read-back check
// certified the bytes; nothing compared the NARRATIVE claims to the numbers.
//
// This is the narrow, deterministic fix. It reuses existing architecture:
//   - facts come from the SAME governed `computeAggregates` computation,
//     re-run inside the SAME path jail by a governed read-only tool;
//   - the verdict travels through the EXISTING `kind: 'command'`
//     verification policy (the tool throws on contradiction, so
//     `expect: 'ok'` fails closed - exactly like the read-back check);
//   - no model judges a model: every check is a deterministic comparison
//     of a parsed claim against structured aggregate data.
//
// Coverage: highest/lowest ranking claims, named A-versus-B comparisons,
// numeric totals paired with a group name, the overall total figure, and
// unsupported claims which are FLAGGED (`needsReview`) rather than blessed.
// Arbitrary prose the patterns cannot resolve is routed to human review;
// a generic string check never pretends to prove semantic correctness.

import * as fs from 'node:fs';
import type { ToolDefinition } from '@vedmoulya/services/ai/runtime/ToolRuntime';
import { computeAggregates, parseCsv } from './DataAggregateTool.js';
import type { AggregateResult } from './DataAggregateTool.js';

/** The governed tool name (registered by the mission runtime). */
export const DATA_NARRATIVE_CHECK_TOOL = 'data_narrative_check';

export interface NarrativeContradiction {
  check: string;
  claim: string;
  reason: string;
}

export interface NarrativeFinding {
  name: string;
  status: 'pass' | 'fail' | 'review';
  detail: string;
}

export interface NarrativeCheckResult {
  ok: boolean;
  contradictions: NarrativeContradiction[];
  needsReview: string[];
  findings: NarrativeFinding[];
}

export interface RankedEntry {
  group: string;
  key: string;
  total: number;
  rank: number;
  count: number;
}

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** Parse `$7,636` / `$7636` / `$7636.00` into numbers (handles long spans). */
export function parseMoneyFigures(text: string): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < text.length) {
    const d = text.indexOf('$', i);
    if (d < 0) break;
    let e = d + 1;
    while (e < text.length && /[0-9,]/.test(text.charAt(e))) e += 1;
    const raw = text.slice(d + 1, e).replace(/,/g, '');
    const v = Number(raw);
    if (raw.length > 0 && Number.isFinite(v)) out.push(v);
    i = e;
  }
  return out;
}

/** True when the report states this exact figure (plain or comma-grouped). */
export function containsFigure(text: string, value: number): boolean {
  return text.includes(String(value)) || text.includes(value.toLocaleString('en-US'));
}

/** Label variants for a `YYYY-MM` key: ISO plus words ("November 2025"). */
export function monthVariants(key: string): string[] {
  const m = /^(\d{4})-(\d{2})$/.exec(key.trim());
  if (!m) return [key];
  const idx = Number.parseInt(m[2] ?? '0', 10) - 1;
  const nm = MONTHS[idx] ?? '';
  if (!nm) return [key];
  const year = m[1] ?? '';
  return [key, `${nm} ${year}`, `${nm.slice(0, 3)} ${year}`];
}

/** Split prose into bounded sentence-ish units for claim scoping. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, 500);
}

/** Word-boundary-aware containment (lower-cased), never a naive substring. */
export function wordHit(hay: string, needle: string): boolean {
  const h = ` ${hay.toLowerCase()} `;
  const t = needle.toLowerCase().trim();
  if (!t) return false;
  let k = h.indexOf(t);
  while (k >= 0) {
    const before = h.charAt(k - 1);
    const after = h.charAt(k + t.length);
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
    k = h.indexOf(t, k + 1);
  }
  return false;
}

/** Ranked entries across every group column (values arrive sorted desc). */
function buildEntries(aggregate: AggregateResult): RankedEntry[] {
  const entries: RankedEntry[] = [];
  for (const group of aggregate.groups) {
    group.values.forEach((value, rank) => {
      entries.push({
        group: group.column,
        key: value.key,
        total: value.total,
        rank,
        count: group.values.length,
      });
    });
  }
  return entries;
}

/**
 * Resolve a free-text subject to a ranked entry (month labels included).
 *
 * A subject resolves only when it maps to EXACTLY ONE verified entry. An
 * ambiguous subject — one that names several entries, or merely contains a
 * month label inside a larger phrase — is left UNRESOLVED so the caller flags
 * it for human review instead of silently picking one entry and blessing a
 * claim that may be about another (the REVENUE-004A failure mode).
 */
function resolverFor(entries: RankedEntry[]): (subject: string) => RankedEntry | undefined {
  const byName = new Map<string, RankedEntry>();
  for (const e of entries) byName.set(e.key.toLowerCase(), e);
  return (subject: string): RankedEntry | undefined => {
    const cleaned = subject
      .toLowerCase()
      .trim()
      .replace(/^(?:the|a|an)\s+/, '');
    const direct = byName.get(cleaned);
    if (direct) return direct;
    const matches = new Set<RankedEntry>();
    for (const e of entries) {
      const labels = e.group === 'month' ? monthVariants(e.key) : [e.key];
      if (labels.some((label) => wordHit(subject, label))) matches.add(e);
    }
    return matches.size === 1 ? [...matches][0] : undefined;
  };
}

/**
 * Deterministically verify the factual ranking/total claims in a report
 * against structured aggregate data. Pure: no I/O, no model, no registry.
 * Unsupported claims are flagged for human review, never blessed.
 */
export function verifyReportNarrative(
  report: string,
  aggregate: AggregateResult,
): NarrativeCheckResult {
  const contradictions: NarrativeContradiction[] = [];
  const needsReview: string[] = [];
  const findings: NarrativeFinding[] = [];
  const sentences = sentencesOf(report);
  const entries = buildEntries(aggregate);
  const resolveEntry = resolverFor(entries);

  const fail = (check: string, claim: string, reason: string): void => {
    contradictions.push({ check, claim, reason });
    findings.push({ name: check, status: 'fail', detail: `${claim} -- ${reason}` });
  };
  const review = (check: string, claim: string): void => {
    needsReview.push(`${check}: ${claim}`);
    findings.push({ name: check, status: 'review', detail: `${claim} -- needs human review` });
  };
  const pass = (check: string, detail: string): void => {
    findings.push({ name: check, status: 'pass', detail });
  };

  // 1. The overall total must be stated exactly (plain or comma-grouped).
  if (containsFigure(report, aggregate.total)) {
    pass('overall-total', `overall total ${String(aggregate.total)} is stated`);
  } else {
    fail(
      'overall-total',
      `overall total ${String(aggregate.total)}`,
      'the verified overall total is absent',
    );
  }

  // 2. Every group entry must appear, and any figure on its line must match.
  for (const entry of entries) {
    const labels = entry.group === 'month' ? monthVariants(entry.key) : [entry.key];
    if (!labels.some((label) => wordHit(report, label))) {
      fail(
        `${entry.group}-entry-missing`,
        entry.key,
        `verified ${entry.group} entry absent (${String(entry.total)})`,
      );
      continue;
    }
    let paired = false;
    let mismatched: number | undefined;
    for (const s of sentences) {
      if (!labels.some((label) => wordHit(s, label))) continue;
      const figures = parseMoneyFigures(s);
      if (figures.length === 0) continue;
      paired = true;
      if (!figures.some((f) => f === entry.total)) mismatched = figures[0];
    }
    if (mismatched !== undefined) {
      fail(
        `${entry.group}-total-mismatch`,
        `${entry.key} stated with $${String(mismatched)}`,
        `verified is $${String(entry.total)}`,
      );
    } else if (paired) {
      pass(`${entry.group}-total:${entry.key}`, `${entry.key} paired with $${String(entry.total)}`);
    } else {
      review(
        `${entry.group}-total-unpaired`,
        `${entry.key} named but no total paired with the mention`,
      );
    }
  }

  // 3. Highest/lowest ranking claims: "X had the highest Y".
  // Scanned PER SENTENCE so a claim subject can never bleed across a sentence
  // boundary — e.g. a preceding money figure must not be absorbed into the
  // subject of "$17,855 in November 2025. The East region had the highest
  // sales", which previously captured the month and silently PASSED.
  const superlative =
    /([\w][\w .&'()-]{0,80}?)\s+(?:had|has|have|recorded|posted|achieved)\s+the\s+(highest|largest|biggest|lowest|smallest|least)\b/gi;
  let match: RegExpExecArray | null;
  for (const sentence of sentences) {
    superlative.lastIndex = 0;
    while ((match = superlative.exec(sentence)) !== null) {
      const subject = (match[1] ?? '').trim();
      const kind = (match[2] ?? '').toLowerCase();
      const wantsHighest = kind !== 'lowest' && kind !== 'smallest' && kind !== 'least';
      const entry = resolveEntry(subject);
      if (!entry) {
        review(
          'ranking-unsupported',
          `"${subject}" claimed ${kind} -- subject does not resolve to a single verified group entry`,
        );
        continue;
      }
      const expectedRank = wantsHighest ? 0 : entry.count - 1;
      if (entry.rank === expectedRank) {
        pass('ranking-claim', `"${entry.key}" is correctly stated as ${kind} among ${entry.group}`);
      } else {
        const actual = entries.find((c) => c.group === entry.group && c.rank === expectedRank);
        fail(
          'ranking-contradiction',
          `"${entry.key}" claimed ${kind} among ${entry.group}`,
          actual
            ? `the verified ${wantsHighest ? 'highest' : 'lowest'} ${entry.group} is "${actual.key}" ($${String(actual.total)}), not "${entry.key}" ($${String(entry.total)})`
            : `the claim contradicts the verified ${entry.group} order`,
        );
      }
    }
  }

  // "X was the top-selling / top-performing Y" form.
  const topForm =
    /([\w][\w .&'()-]{0,60}?)\s+(?:is|was)\s+the\s+top(?:-|\s+)?(?:selling|performing|rated)\b/gi;
  for (const sentence of sentences) {
    topForm.lastIndex = 0;
    while ((match = topForm.exec(sentence)) !== null) {
      const subject = (match[1] ?? '').trim().replace(/^(?:the|a|an)\s+/i, '');
      const entry = resolveEntry(subject);
      if (!entry) {
        review(
          'ranking-unsupported',
          `"${subject}" claimed top -- subject does not resolve to a single verified group entry`,
        );
        continue;
      }
      if (entry.rank === 0) {
        pass('ranking-claim', `"${entry.key}" is correctly stated as the top ${entry.group}`);
      } else {
        const actual = entries.find((c) => c.group === entry.group && c.rank === 0);
        fail(
          'ranking-contradiction',
          `"${entry.key}" claimed top among ${entry.group}`,
          actual
            ? `the verified top ${entry.group} is "${actual.key}" ($${String(actual.total)})`
            : `the claim contradicts the verified ${entry.group} order`,
        );
      }
    }
  }

  // 4. Named A-versus-B comparisons: "X followed by Y", "X outperformed Y".
  const comparisons: Array<{ relation: string; higher: boolean; pattern: RegExp }> = [
    {
      relation: 'followed by',
      higher: true,
      pattern:
        /([\w][\w .&'()-]{0,60}?)\s+followed by\s+([\w][\w .&'()-]{0,60}?)(?=[,.;:!?]|\s+(?:and|with|at|in)\b|$)/gi,
    },
    {
      relation: 'ahead of',
      higher: true,
      pattern:
        /([\w][\w .&'()-]{0,60}?)\s+ahead of\s+([\w][\w .&'()-]{0,60}?)(?=[,.;:!?]|\s+(?:and|with|at|in)\b|$)/gi,
    },
    {
      relation: 'outperformed',
      higher: true,
      pattern:
        /([\w][\w .&'()-]{0,60}?)\s+outperformed\s+([\w][\w .&'()-]{0,60}?)(?=[,.;:!?]|\s+(?:and|with|at|in)\b|$)/gi,
    },
    {
      relation: 'exceeded',
      higher: true,
      pattern:
        /([\w][\w .&'()-]{0,60}?)\s+exceeded\s+([\w][\w .&'()-]{0,60}?)(?=[,.;:!?]|\s+(?:and|with|at|in)\b|$)/gi,
    },
    {
      relation: 'higher than',
      higher: true,
      pattern:
        /([\w][\w .&'()-]{0,60}?)\s+higher than\s+([\w][\w .&'()-]{0,60}?)(?=[,.;:!?]|\s+(?:and|with|at|in)\b|$)/gi,
    },
    {
      relation: 'below',
      higher: false,
      pattern:
        /([\w][\w .&'()-]{0,60}?)\s+below\s+([\w][\w .&'()-]{0,60}?)(?=[,.;:!?]|\s+(?:and|with|at|in)\b|$)/gi,
    },
    {
      relation: 'behind',
      higher: false,
      pattern:
        /([\w][\w .&'()-]{0,60}?)\s+behind\s+([\w][\w .&'()-]{0,60}?)(?=[,.;:!?]|\s+(?:and|with|at|in)\b|$)/gi,
    },
    {
      relation: 'trailed',
      higher: false,
      pattern:
        /([\w][\w .&'()-]{0,60}?)\s+trailed\s+([\w][\w .&'()-]{0,60}?)(?=[,.;:!?]|\s+(?:and|with|at|in)\b|$)/gi,
    },
  ];
  const seenComparisons = new Set<string>();
  for (const sentence of sentences) {
    for (const cmp of comparisons) {
      let m: RegExpExecArray | null;
      cmp.pattern.lastIndex = 0;
      while ((m = cmp.pattern.exec(sentence)) !== null) {
        const subject = (m[1] ?? '').trim();
        const other = (m[2] ?? '').trim();
        const key = `${subject.toLowerCase()}|${cmp.relation}|${other.toLowerCase()}`;
        if (seenComparisons.has(key)) continue;
        seenComparisons.add(key);
        const a = resolveEntry(subject);
        const b = resolveEntry(other);
        if (!a || !b) {
          review(
            'comparison-unsupported',
            `"${subject}" ${cmp.relation} "${other}" -- subject does not resolve to a single verified group entry`,
          );
          continue;
        }
        if (a.group !== b.group) {
          // Cross-group claims (region vs product) are not comparable.
          review(
            'comparison-unsupported',
            `"${a.key}" ${cmp.relation} "${b.key}" -- spans different groups (${a.group} vs ${b.group})`,
          );
          continue;
        }
        const holds = cmp.higher ? a.total > b.total : a.total < b.total;
        if (holds) {
          pass(
            'comparison-claim',
            `"${a.key}" ($${String(a.total)}) correctly ${cmp.relation} "${b.key}" ($${String(b.total)})`,
          );
        } else {
          fail(
            'comparison-contradiction',
            `"${a.key}" ${cmp.relation} "${b.key}"`,
            `verified totals are "${a.key}" $${String(a.total)} vs "${b.key}" $${String(b.total)} -- stated order is inverted`,
          );
        }
      }
    }
  }

  // 5. The overall total must not be attributed to a single month that differs.
  for (const s of sentences) {
    const figures = parseMoneyFigures(s);
    if (!figures.some((f) => f === aggregate.total)) continue;
    for (const entry of entries) {
      if (entry.group !== 'month' || entry.total === aggregate.total) continue;
      if (!monthVariants(entry.key).some((v) => wordHit(s, v))) continue;
      fail(
        'total-scope-mismatch',
        `overall total $${String(aggregate.total)} attributed to ${monthVariants(entry.key)[1] ?? entry.key}`,
        `verified total for that month is $${String(entry.total)} -- $${String(aggregate.total)} is the whole-period total`,
      );
      break;
    }
  }

  return finish(contradictions, needsReview, findings);
}

const MAX_SOURCE_BYTES = 256 * 1024;
const MAX_REPORT_BYTES = 64 * 1024;

/** Bounded input for the governed narrative-check tool. */
export interface NarrativeCheckToolArgs {
  sourceRelativePath: string;
  amountColumn: string;
  reportRelativePath: string;
  groupBy?: string[];
  monthOf?: string;
  quantityColumn?: string;
}

/**
 * Governed, read-only narrative-consistency tool. Re-runs the SAME governed
 * aggregation over the source CSV inside the path jail, reads the report
 * file back from disk, and THROWS on any contradiction (unsupported or
 * ambiguous claims are surfaced in the returned findings for human review) -
 * so a `kind: 'command'` verification with `expect: 'ok'` fails closed
 * instead of certifying a contradictory narrative.
 */
export function createDataNarrativeCheckTool(binding: {
  resolveInside: (relativePath: string) => string;
}): ToolDefinition {
  return {
    name: DATA_NARRATIVE_CHECK_TOOL,
    description:
      'Deterministically checks the factual ranking/total claims in a report file against the governed aggregate totals recomputed from the source CSV. Read-only; throws on any contradiction (unsupported or ambiguous claims are surfaced in the findings for human review).',
    capability: 'calculation',
    inputSchema: {
      type: 'object',
      properties: {
        sourceRelativePath: { type: 'string', required: true, minLength: 1, maxLength: 300 },
        amountColumn: { type: 'string', required: true, minLength: 1, maxLength: 120 },
        reportRelativePath: { type: 'string', required: true, minLength: 1, maxLength: 300 },
        groupBy: { type: 'array', items: { type: 'string', maxLength: 120 } },
        monthOf: { type: 'string', maxLength: 120 },
        quantityColumn: { type: 'string', maxLength: 120 },
      },
      additionalProperties: false,
    },
    timeoutMs: 5_000,
    rateLimit: { max: 120, windowMs: 60_000 },
    handler: (args): { ok: true; checks: number; findings: NarrativeFinding[] } => {
      const sourceRelativePath = String(args['sourceRelativePath']);
      const reportRelativePath = String(args['reportRelativePath']);
      const sourceResolved = binding.resolveInside(sourceRelativePath);
      if (fs.statSync(sourceResolved).size > MAX_SOURCE_BYTES) {
        throw new Error(`file exceeds the bounded aggregation size: ${sourceRelativePath}`);
      }
      const { header, rows } = parseCsv(fs.readFileSync(sourceResolved, 'utf8'));
      const groupByRaw = args['groupBy'];
      const aggregate = computeAggregates(header, rows, {
        relativePath: sourceRelativePath,
        amountColumn: String(args['amountColumn']),
        ...(Array.isArray(groupByRaw) ? { groupBy: groupByRaw.map((v) => String(v)) } : {}),
        ...(typeof args['monthOf'] === 'string' ? { monthOf: args['monthOf'] } : {}),
        ...(typeof args['quantityColumn'] === 'string'
          ? { quantityColumn: args['quantityColumn'] }
          : {}),
      });
      const reportResolved = binding.resolveInside(reportRelativePath);
      if (fs.statSync(reportResolved).size > MAX_REPORT_BYTES) {
        throw new Error(`report exceeds the bounded check size: ${reportRelativePath}`);
      }
      const report = fs.readFileSync(reportResolved, 'utf8');
      const result = verifyReportNarrative(report, aggregate);
      if (!result.ok) {
        const details = [
          ...result.contradictions.map(
            (c) => `contradiction [${c.check}]: ${c.claim} -- ${c.reason}`,
          ),
          ...result.needsReview.map((r) => `needs human review: ${r}`),
        ].join(' | ');
        throw new Error(`report narrative contradicts the verified aggregates: ${details}`);
      }
      return { ok: true as const, checks: result.findings.length, findings: result.findings };
    },
  };
}

function finish(
  contradictions: NarrativeContradiction[],
  needsReview: string[],
  findings: NarrativeFinding[],
): NarrativeCheckResult {
  return {
    // A deterministic CONTRADICTION fails the check. A claim the patterns
    // cannot resolve deterministically is REPORTED for human review
    // (`needsReview`) rather than treated as verified — it does not, by
    // itself, block the run: the deliverable still passes through the human
    // approval boundary.
    ok: contradictions.length === 0,
    contradictions,
    needsReview,
    findings,
  };
}
