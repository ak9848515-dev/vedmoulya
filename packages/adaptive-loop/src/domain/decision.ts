// ──────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Agent Loop: Decision Parser
//
// The model's decision output is UNTRUSTED INPUT. This parser is the
// safety boundary between raw model text and a typed AdaptiveDecision:
//   - kind must be one of the closed set (CONTINUE / TOOL_CALL /
//     AI_ACTION / VERIFY / REVISE_STEP / REPLAN / COMPLETE / FAIL /
//     REQUEST_APPROVAL / ABSTAIN).
//   - only whitelisted fields survive; unknown keys are REJECTED
//     (never silently dropped).
//   - provider / model / arbitrary execution directives / permission /
//     budget / autonomy fields are REJECTED at parse time — the model
//     can never express routing or authority changes.
//   - capabilities must come from the frozen taxonomy.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import { CAPABILITY_TYPES } from '@vedmoulya/ai';
import type { CapabilityType } from '@vedmoulya/ai';
import type { VerificationPolicy } from '@vedmoulya/agent-execution';
import {
  ADAPTIVE_DECISION_KINDS,
  type AdaptiveDecision,
  type AdaptiveDecisionKind,
} from '../types/adaptive-loop-types.js';

export const MAX_RATIONALE_LENGTH = 400;
export const MAX_ARGUMENTS = 24;
export const MAX_VERIFICATION_CHECKS = 12;

const DECISION_FIELDS = new Set([
  'kind',
  'rationale',
  'targetStepId',
  'capability',
  'requiredCapabilities',
  'tool',
  'arguments',
  'verification',
  'reviseInstruction',
  'replanReason',
  'failReason',
  'approvalReason',
  'abstainReason',
]);

// ── Forbidden fields that would be authority/routing changes ──────
const FORBIDDEN_FIELDS = [
  'provider',
  'model',
  'modelId',
  'permission',
  'permissions',
  'permissionClass',
  'grantedPermissionClasses',
  'budget',
  'autonomyLevel',
  'execute',
  'command',
  'shell',
  'url',
  'sdk',
  'bypass',
];

export interface ParsedDecision {
  ok: true;
  decision: AdaptiveDecision;
}

export interface ParsedDecisionFailure {
  ok: false;
  errors: string[];
}

export type ParseDecisionResult = ParsedDecision | ParsedDecisionFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCapability(value: unknown): value is CapabilityType {
  return typeof value === 'string' && (CAPABILITY_TYPES as readonly string[]).includes(value);
}

function isDecisionKind(value: unknown): value is AdaptiveDecisionKind {
  return (
    typeof value === 'string' && (ADAPTIVE_DECISION_KINDS as readonly string[]).includes(value)
  );
}

function boundString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, maxLength);
}

/**
 * Parse raw model decision text (expected JSON) into a whitelisted
 * AdaptiveDecision. Rejects: unknown kinds, unknown fields, forbidden
 * fields (provider/model/authority/execution directives), unknown
 * capabilities, malformed tool/verification shapes and oversized input.
 */
export function parseDecisionProposal(raw: string): ParseDecisionResult {
  const errors: string[] = [];

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, errors: ['decision proposal is empty'] };
  }
  if (raw.length > 8_000) {
    return { ok: false, errors: ['decision proposal exceeds the 8000-char bound'] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ['malformed decision JSON'] };
  }
  if (!isRecord(parsed)) {
    return { ok: false, errors: ['decision proposal must be a JSON object'] };
  }

  // 1. Unknown keys → reject (never silently drop).
  for (const key of Object.keys(parsed)) {
    if (!DECISION_FIELDS.has(key)) {
      errors.push(`unknown decision field "${key}"`);
    }
  }

  // 2. Forbidden fields → reject (authority/routing changes).
  for (const key of FORBIDDEN_FIELDS) {
    if (key in parsed) {
      errors.push(
        `forbidden decision field "${key}" — the model cannot change authority or routing`,
      );
    }
  }

  // 3. Closed kind set.
  if (!isDecisionKind(parsed.kind)) {
    errors.push(
      `decision kind must be one of ${ADAPTIVE_DECISION_KINDS.join(', ')} — got ${JSON.stringify(parsed.kind)}`,
    );
  }

  // 4. Whitelisted capability (frozen taxonomy).
  const capability = parsed.capability;
  if (capability !== undefined && !isCapability(capability)) {
    errors.push(
      `unknown capability "${typeof capability === 'string' ? capability : JSON.stringify(capability)}" — not in the frozen taxonomy`,
    );
  }
  const validCapability =
    capability !== undefined && isCapability(capability) ? capability : undefined;

  // 5. requiredCapabilities — full array, frozen taxonomy only.
  let requiredCapabilities: CapabilityType[] | undefined;
  if (parsed.requiredCapabilities !== undefined) {
    if (!Array.isArray(parsed.requiredCapabilities) || parsed.requiredCapabilities.length === 0) {
      errors.push('requiredCapabilities must be a non-empty array');
    } else {
      requiredCapabilities = [];
      for (const rc of parsed.requiredCapabilities as unknown[]) {
        if (!isCapability(rc)) {
          errors.push(`unknown requiredCapability "${String(rc)}"`);
        } else {
          requiredCapabilities.push(rc);
        }
      }
    }
  }

  // 6. Tool proposal shape (TOOL_CALL).
  if (parsed.kind === 'TOOL_CALL') {
    if (typeof parsed.tool !== 'string' || parsed.tool.trim().length === 0) {
      errors.push('TOOL_CALL requires a non-empty "tool" name');
    }
    if (parsed.arguments !== undefined) {
      if (!isRecord(parsed.arguments) || Object.keys(parsed.arguments).length > MAX_ARGUMENTS) {
        errors.push(
          `TOOL_CALL arguments must be an object with at most ${String(MAX_ARGUMENTS)} keys`,
        );
      }
    }
    if (parsed.capability === undefined) {
      // Tools declare their own capability in the registry; a missing
      // capability is tolerated but a present one must be whitelisted.
    }
  }

  // 7. Verification policy shape (VERIFY / steps).
  let verification: VerificationPolicy | undefined;
  if (parsed.verification !== undefined) {
    if (!isRecord(parsed.verification) || typeof parsed.verification.kind !== 'string') {
      errors.push('verification must be an object with a kind');
    } else {
      const kind = parsed.verification.kind;
      if (kind === 'rule') {
        const checks = parsed.verification.checks;
        if (
          !Array.isArray(checks) ||
          checks.length === 0 ||
          checks.length > MAX_VERIFICATION_CHECKS
        ) {
          errors.push('rule verification requires 1..12 checks');
        } else {
          const ruleChecks = checks
            .filter((c): c is Record<string, unknown> => isRecord(c))
            .slice(0, MAX_VERIFICATION_CHECKS);
          const built: import('@vedmoulya/agent-execution').AgentRuleCheck[] = [];
          for (const c of ruleChecks) {
            const name = boundString(c.name, 80) ?? 'check';
            if (c.kind === 'minLength') {
              if (typeof c.length !== 'number' || c.length < 0) {
                errors.push('minLength check requires a non-negative length');
              } else {
                built.push({ name, kind: 'minLength', length: c.length });
              }
            } else {
              const kindOf = c.kind === 'notIncludes' ? 'notIncludes' : 'includes';
              if (typeof c.text !== 'string') {
                errors.push(`${kindOf} check requires a text string`);
              } else {
                built.push({ name, kind: kindOf, text: c.text.slice(0, 200) });
              }
            }
          }
          if (built.length === 0) {
            errors.push('rule verification produced no valid checks');
          } else {
            verification = {
              kind: 'rule',
              description:
                boundString(parsed.verification.description, 200) ?? 'rule-based verification',
              checks: built,
            };
          }
        }
      } else if (kind === 'schema') {
        const keys = parsed.verification.requiredKeys;
        verification = {
          kind: 'schema',
          description: boundString(parsed.verification.description, 200) ?? 'schema verification',
          requiredKeys: Array.isArray(keys)
            ? keys.filter((k): k is string => typeof k === 'string').slice(0, 12)
            : [],
        };
      } else if (kind === 'artifact' && isRecord(parsed.verification.artifact)) {
        verification = {
          kind: 'artifact',
          description: boundString(parsed.verification.description, 200) ?? 'artifact verification',
          artifact: {
            name: boundString(parsed.verification.artifact.name, 200) ?? 'artifact',
            mustExist: parsed.verification.artifact.mustExist !== false,
          },
        };
      } else {
        errors.push(`verification kind "${kind}" is not supported by the adaptive loop`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors: errors.slice(0, 6) };
  }

  const kind = parsed.kind as AdaptiveDecisionKind;
  return {
    ok: true,
    decision: {
      decisionId: `decision-${generateId()}`,
      kind,
      rationale: boundString(parsed.rationale, MAX_RATIONALE_LENGTH) ?? kind.toLowerCase(),
      targetStepId: boundString(parsed.targetStepId, 120),
      capability: validCapability,
      requiredCapabilities,
      tool: typeof parsed.tool === 'string' ? parsed.tool.trim().slice(0, 120) : undefined,
      arguments: isRecord(parsed.arguments) ? parsed.arguments : undefined,
      verification,
      reviseInstruction: boundString(parsed.reviseInstruction, 800),
      replanReason: boundString(parsed.replanReason, 400),
      failReason: boundString(parsed.failReason, 400),
      approvalReason: boundString(parsed.approvalReason, 400),
      abstainReason: boundString(parsed.abstainReason, 400),
    },
  };
}
