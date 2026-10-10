// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Data → Report Template (REVENUE-002A)
//
// A deterministic plan template installed through the FROZEN planner's
// `templates` extension point (PlannerServiceOptions.templates). It gives
// a data-analysis goal the smallest plan that can REALLY do the work:
//
//   step-1  aggregate  governed `data_aggregate` over the stated SOURCE
//                      file: the totals are computed DETERMINISTICALLY
//                      through the path-jailed tool (never by a model)
//   step-2  author     ONE real AI execution that writes the deliverable
//                      narrative and reproduces those real figures
//   step-3  write      governed workspace_write of the model-authored
//                      deliverable at the stated OUTPUT path, verified by a
//                      DETERMINISTIC read-back with expectedContent resolved
//                      from the SAME real step output
//
// This is the capability REVENUE-002A needed: before it, every file-writing
// template took its content from a literal in the goal text, and the model
// could neither read the source data nor author the file. Here the model
// authors the DELIVERABLE, but it never chooses a path, never invokes a tool
// and never computes a figure: the tool name, the source/output paths and
// the aggregation columns are literals decided by this builder from the goal,
// and every tool call still passes the full security chain (allowlist, path
// jail, schema, timeout, rate limit, audit). The verdict is deterministic:
// the aggregate step re-runs the same governed computation, and the write is
// verified by reading the REAL file back and requiring it to equal the exact
// content that was written — so model prose can never certify a missing or
// tampered artifact.
//
// The source/output targets and the aggregation columns are extracted by a
// bounded deterministic rule — a data-format SOURCE only, a document-format
// OUTPUT only, both relative, never absolute, never '..'. If they are missing
// the template does not match and the goal falls through to the previous
// behaviour unchanged.
// ──────────────────────────────────────────────────────────────────

import type { AgentPlan, AgentPlanStep, VerificationPolicy } from '@vedmoulya/agent-execution';
import type { GoalUnderstanding, PlanTemplate } from '@vedmoulya/planning';
import { DATA_AGGREGATE_TOOL } from './DataAggregateTool.js';
import { DATA_NARRATIVE_CHECK_TOOL } from './DataNarrativeCheck.js';

/** The governed workspace tool names (registered by the mission runtime). */
const WORKSPACE_READ_TOOL = 'workspace_read';
const WORKSPACE_WRITE_TOOL = 'workspace_write';

/** A data file the goal names as the SOURCE of the analysis. */
const SOURCE_PATTERN =
  /\b(?:in|from|at|source[:\s]+|input[:\s]+|reading)\s+([A-Za-z0-9][A-Za-z0-9._/-]{0,200}\.(?:csv|tsv|json|txt|log))/i;
/** A document file the goal names as the requested OUTPUT deliverable. */
const OUTPUT_PATTERN =
  /(?:at|to|into|as|output[:\s]+|report (?:file )?[:\s]+|save[d]?\s+(?:to|as))\s+([A-Za-z0-9][A-Za-z0-9._/-]{0,200}\.(?:md|markdown|txt|json))/i;
/** The goal must actually ask for an analysis / report / summary. */
const REPORT_INTENT_PATTERN =
  /\b(analyz|analys|report|summar|breakdown|trend|insight|dashboard)\w*/i;
/** An explicit column declaration, e.g. "columns date, product, region, ...". */
const COLUMNS_PATTERN =
  /(?:columns?|fields?)\s*[:=]?\s*([A-Za-z0-9_]+(?:\s*[,\s]\s*[A-Za-z0-9_]+)+)/i;

const AMOUNT_NAME_PATTERN = /(amount|revenue|total|value|sales|turnover)/i;
const NON_AMOUNT_NAME_PATTERN = /(unit|price|quantity|qty|count|^id$|_id$)/i;
const DATE_NAME_PATTERN = /(^|_)date($|_)|_at$|^day$|(^|_)day($|_)/i;
const GROUP_NAME_PATTERN =
  /(product|item|sku|category|region|territory|market|channel|customer|segment|store|city|country|team|owner)/i;
const MONTH_INTENT_PATTERN = /\bmonth(?:ly)?\b|\btrend\b/i;

export interface DataReportTarget {
  sourcePath: string;
  outputPath: string;
}

/** Reject anything that is not a bounded, relative, jail-safe path. */
function isSafeRelativePath(candidate: string): boolean {
  return (
    candidate.length > 0 &&
    candidate.length <= 220 &&
    !candidate.startsWith('/') &&
    !candidate.includes('\\') &&
    !candidate.includes('..')
  );
}

function extractColumns(goal: string): string[] {
  const captured = COLUMNS_PATTERN.exec(goal)?.[1];
  if (!captured) return [];
  return captured
    .split(/[,\s]+/)
    .map((name) => name.trim())
    .filter((name) => /^[A-Za-z0-9_]+$/.test(name));
}

export interface DataReportPlanInput extends DataReportTarget {
  amountColumn: string;
  groupBy: string[];
  monthOf?: string;
  quantityColumn?: string;
}

/**
 * Deterministically derive the aggregation plan inputs from the goal: the
 * source/out paths plus the real column names to sum and group. Returns
 * undefined (→ no match) when the goal does not state a usable source,
 * output and amount column, so the goal falls through unchanged.
 */
export function extractDataReportTarget(goal: string): DataReportPlanInput | undefined {
  const source = SOURCE_PATTERN.exec(goal)?.[1]?.trim();
  const output = OUTPUT_PATTERN.exec(goal)?.[1]?.trim();
  if (!source || !output) return undefined;
  if (!isSafeRelativePath(source) || !isSafeRelativePath(output)) return undefined;
  if (source.toLowerCase() === output.toLowerCase()) return undefined;

  const columns = extractColumns(goal);
  if (columns.length < 2) return undefined;
  const amountColumn =
    columns.find((name) => AMOUNT_NAME_PATTERN.test(name) && !NON_AMOUNT_NAME_PATTERN.test(name)) ??
    columns.find((name) => AMOUNT_NAME_PATTERN.test(name));
  if (!amountColumn) return undefined;

  const dateColumn = columns.find((name) => DATE_NAME_PATTERN.test(name));
  const groupBy = columns.filter(
    (name) =>
      name !== amountColumn &&
      name !== dateColumn &&
      GROUP_NAME_PATTERN.test(name) &&
      !NON_AMOUNT_NAME_PATTERN.test(name),
  );
  const monthOf = MONTH_INTENT_PATTERN.test(goal) ? dateColumn : undefined;
  if (groupBy.length === 0 && monthOf === undefined) return undefined;

  const quantityColumn = columns.find((name) => /^(qty|quantity|units?|count)$/i.test(name));
  return {
    sourcePath: source,
    outputPath: output,
    amountColumn,
    groupBy,
    ...(monthOf !== undefined ? { monthOf } : {}),
    ...(quantityColumn !== undefined ? { quantityColumn } : {}),
  };
}

const BOUNDED_RECOVERY = { maxAttempts: 2, maxRevisions: 0 };

function aggregateArgs(target: DataReportPlanInput): Record<string, unknown> {
  return {
    relativePath: target.sourcePath,
    amountColumn: target.amountColumn,
    ...(target.groupBy.length > 0 ? { groupBy: [...target.groupBy] } : {}),
    ...(target.monthOf !== undefined ? { monthOf: target.monthOf } : {}),
    ...(target.quantityColumn !== undefined ? { quantityColumn: target.quantityColumn } : {}),
  };
}

/** Deterministic read-back verification (exact content, or non-empty). */
function readBackVerification(
  args: Record<string, unknown>,
  description: string,
): VerificationPolicy {
  return {
    kind: 'command',
    description,
    command: { toolName: WORKSPACE_READ_TOOL, arguments: args, expect: 'ok' },
  };
}

export function createDataReportTemplate(): PlanTemplate {
  return {
    id: 'mission-data-report',
    matches: (understanding: GoalUnderstanding): boolean =>
      REPORT_INTENT_PATTERN.test(understanding.normalizedGoal) &&
      extractDataReportTarget(understanding.normalizedGoal) !== undefined,
    build: (understanding: GoalUnderstanding, planId: string): AgentPlan => {
      const target = extractDataReportTarget(understanding.normalizedGoal);
      if (!target) {
        // Unreachable via matches(); defensive so a plan can never carry an
        // undefined source/output/aggregation target.
        throw new Error('mission-data-report template requires a source and an output path');
      }
      const { sourcePath, outputPath } = target;
      const args = aggregateArgs(target);
      // The content the model authors is referenced — never copied — so the
      // write and the deterministic read-back both use the SAME real value.
      const contentRef = '{outputOf:step-2}';

      const aggregateStep: AgentPlanStep = {
        stepId: 'step-1',
        objective: `Compute the real figures from ${sourcePath} with the governed aggregation tool`,
        capability: 'reasoning',
        allowedTools: [DATA_AGGREGATE_TOOL],
        dependencies: [],
        actions: [
          {
            actionId: 'step-1-aggregate',
            kind: 'tool',
            toolName: DATA_AGGREGATE_TOOL,
            arguments: args,
            expectedOutcome: `the deterministic totals from ${sourcePath}`,
          },
        ],
        expectedOutcome: `the deterministic totals from ${sourcePath}`,
        // Deterministic re-run of the SAME computation: the step verifies only
        // when the governed tool really reproduces the totals.
        verificationPolicy: {
          kind: 'command',
          description: `the governed aggregation over ${sourcePath} must succeed deterministically`,
          command: { toolName: DATA_AGGREGATE_TOOL, arguments: args, expect: 'ok' },
        },
        recoveryPolicy: BOUNDED_RECOVERY,
      };

      const authorStep: AgentPlanStep = {
        stepId: 'step-2',
        objective: `Author the deliverable at ${outputPath} from the real figures`,
        capability: 'content_generation',
        // No tools: the author step reasons over the REAL deterministic
        // aggregate observation supplied through {outputOf:step-1}. It cannot
        // touch the filesystem or the network, and it must not compute figures.
        allowedTools: [],
        dependencies: ['step-1'],
        actions: [
          {
            actionId: 'step-2-author',
            kind: 'ai',
            capability: 'content_generation',
            requiredCapabilities: ['content_generation', 'reasoning'],
            instruction:
              `Author the client deliverable for this goal: {goal}\n\n` +
              `The FIGURES below were computed deterministically from ${sourcePath} by the ` +
              `governed aggregation tool. They are authoritative:\n{outputOf:step-1}\n\n` +
              'Rules (all mandatory):\n' +
              '- Use ONLY these figures. Never compute, round or alter a number.\n' +
              '- Reproduce EVERY group name and its exact total exactly as given ' +
              '(all products, all regions, all months), and the overall total.\n' +
              '- Include, in this order, these Markdown sections: an H1 title naming the ' +
              'client; "## Executive Summary"; "## Total Sales"; "## Top-Performing Products"; ' +
              '"## Top-Performing Regions"; "## Monthly Sales Trend"; "## Recommendations".\n' +
              '- In the products, regions and monthly sections, list every entry with its total.\n' +
              '- "## Recommendations" must contain exactly three numbered, actionable items ' +
              'grounded in the figures.\n' +
              '- Output ONLY the final Markdown document (no code fences around the whole ' +
              'document, no preamble, no commentary). Be COMPLETE and exact: never omit a ' +
              'product, region or month to save space, and never merge two entries.',
            expectedOutcome: `the complete data-derived deliverable for ${outputPath}`,
          },
        ],
        expectedOutcome: `the complete data-derived deliverable for ${outputPath}`,
        verificationPolicy: {
          kind: 'rule',
          description: 'the authored deliverable must be substantial (a real document, not a stub)',
          checks: [{ name: 'deliverable-length', kind: 'minLength', length: 200 }],
        },
        recoveryPolicy: BOUNDED_RECOVERY,
      };

      const writeStep: AgentPlanStep = {
        stepId: 'step-3',
        objective: `Write the authored deliverable to ${outputPath} through the governed tool`,
        capability: 'coding',
        allowedTools: [WORKSPACE_WRITE_TOOL, WORKSPACE_READ_TOOL],
        dependencies: ['step-2'],
        actions: [
          {
            actionId: 'step-3-write',
            kind: 'tool',
            toolName: WORKSPACE_WRITE_TOOL,
            arguments: { relativePath: outputPath, content: contentRef },
            expectedOutcome: `${outputPath} holds the authored deliverable`,
          },
        ],
        expectedOutcome: `${outputPath} holds the authored deliverable`,
        verificationPolicy: readBackVerification(
          { relativePath: outputPath, expectedContent: contentRef },
          `${outputPath} must read back with EXACTLY the authored content — a deterministic assertion against the real file, never model prose`,
        ),
        recoveryPolicy: BOUNDED_RECOVERY,
      };

      // REVENUE-004A — the quality gap: step-3's read-back certifies the
      // BYTES, and step-1 verifies the NUMBERS, but nothing ever compared
      // the report's factual ranking claims to those numbers. This step is
      // a governed, deterministic consistency check over the real file.
      // The narrative-check schema is `additionalProperties: false` and has NO
      // `relativePath` field, so its arguments are built explicitly from the
      // values the aggregate tool used — minus `relativePath`. Spreading the
      // aggregate args here injected an unsupported key that schema validation
      // rejected (surfaced by the security chain as a denial), which blocked
      // the run instead of checking the narrative.
      const narrativeCheckArgs: Record<string, unknown> = {
        sourceRelativePath: sourcePath,
        reportRelativePath: outputPath,
        amountColumn: target.amountColumn,
        ...(target.groupBy.length > 0 ? { groupBy: [...target.groupBy] } : {}),
        ...(target.monthOf !== undefined ? { monthOf: target.monthOf } : {}),
        ...(target.quantityColumn !== undefined ? { quantityColumn: target.quantityColumn } : {}),
      };
      const consistencyStep: AgentPlanStep = {
        stepId: 'step-4',
        objective: `Verify the ranking and total claims in ${outputPath} against the recomputed aggregates`,
        capability: 'reasoning',
        allowedTools: [DATA_NARRATIVE_CHECK_TOOL],
        dependencies: ['step-3'],
        actions: [
          {
            actionId: 'step-4-narrative-check',
            kind: 'tool',
            toolName: DATA_NARRATIVE_CHECK_TOOL,
            arguments: narrativeCheckArgs,
            expectedOutcome: `the claims in ${outputPath} are consistent with the verified aggregates`,
          },
        ],
        expectedOutcome: `the claims in ${outputPath} are consistent with the verified aggregates`,
        // The tool THROWS on any contradiction, so this fails closed: a
        // contradictory narrative can never reach VERIFIED. Unsupported or
        // ambiguous claims are surfaced in the tool findings for human review
        // (the deliverable still passes through the approval boundary).
        verificationPolicy: {
          kind: 'command',
          description:
            'every factual ranking/total claim in the deliverable must be consistent with the aggregates recomputed from the source data',
          command: {
            toolName: DATA_NARRATIVE_CHECK_TOOL,
            arguments: narrativeCheckArgs,
            expect: 'ok',
          },
        },
        recoveryPolicy: BOUNDED_RECOVERY,
      };

      return {
        planId,
        goalId: understanding.goalId,
        objective: understanding.normalizedGoal,
        steps: [aggregateStep, authorStep, writeStep, consistencyStep],
        finalVerification: readBackVerification(
          { relativePath: outputPath, expectedContent: contentRef },
          `the goal is verified only if ${outputPath} really holds the full authored deliverable`,
        ),
        completionCriteria: [
          `deterministic totals computed from ${sourcePath} through the governed aggregation tool`,
          'deliverable authored from the real figures',
          `${outputPath} written through the governed workspace tool`,
          `${outputPath} reads back with exactly the authored content (deterministic)`,
          `ranking and total claims in ${outputPath} verified against the aggregates (deterministic)`,
        ],
      };
    },
  };
}
