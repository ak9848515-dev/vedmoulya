// ──────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Planning Intelligence: Plan Proposal Parsing
//
// The planner's AI output is UNTRUSTED INPUT. This module is the safety
// boundary: it parses raw model text into a whitelisted proposal shape
// and converts it into the frozen AgentPlan contract — rejecting unknown
// fields (provider/model directives, invented tools, unknown
// capabilities), malformed dependencies, invalid verification/recovery
// and anything else that could bypass the execution/security boundaries.
//
// Rules enforced here (deterministic):
//   - top level + every step/action/verification/recovery object may
//     contain ONLY whitelisted keys — anything else is rejected;
//   - capabilities must be members of the frozen CAPABILITY_TYPES;
//   - tool names are opaque strings (availability is validated against
//     the authoritative registry later — never assumed);
//   - no provider/model fields exist in the proposal at all — routing
//     is a runtime responsibility and the planner cannot bypass it;
//   - recovery is bounded by construction (attempts/revisions caps).
// ──────────────────────────────────────────────────────────────────

import { CAPABILITY_TYPES } from '@vedmoulya/ai';
import type { QualityTier } from '@vedmoulya/ai';
import type {
  AgentActionSpec,
  AgentPlan,
  AgentPlanStep,
  StepRecoveryPolicy,
  VerificationPolicy,
} from '@vedmoulya/agent-execution';

// ── Bounds (deterministic, documented) ────────────────────────────

export const MAX_PLAN_STEPS = 12;
export const MAX_ACTIONS_PER_STEP = 8;
export const MAX_INSTRUCTION_LENGTH = 2_000;
export const MAX_STEP_OBJECTIVE_LENGTH = 300;
export const MAX_TOOL_NAME_LENGTH = 100;
export const MAX_RECOVERY_ATTEMPTS = 10;
export const MAX_RECOVERY_REVISIONS = 5;

const QUALITY_TIERS: readonly QualityTier[] = ['premium', 'standard', 'economy', 'free'] as const;
const STEP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

// ── The whitelisted proposal shape (what the AI may say) ──────────

/** Untrusted raw proposal (all fields unknown until validated). */
export interface PlannerPlanProposal {
  objective?: unknown;
  steps?: unknown;
  completionCriteria?: unknown;
  finalVerification?: unknown;
}

interface ProposalVerification {
  kind?: unknown;
  description?: unknown;
  checks?: unknown;
  requiredKeys?: unknown;
  artifact?: unknown;
  command?: unknown;
  state?: unknown;
  criteria?: unknown;
  maxOutputTokens?: unknown;
}

interface ProposalRecovery {
  maxAttempts?: unknown;
  maxRevisions?: unknown;
  alternateTools?: unknown;
  acceptUnknown?: unknown;
}

// ── Validated parsed shapes ───────────────────────────────────────

export interface ParsedPlanAction {
  actionId: string;
  kind: 'ai' | 'tool';
  capability?: string;
  requiredCapabilities?: string[];
  qualityTier?: QualityTier;
  instruction?: string;
  expectedOutcome?: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
}

export interface ParsedPlanStep {
  stepId?: string;
  objective: string;
  capability?: string;
  requiredCapabilities?: string[];
  dependencies: string[];
  allowedTools: string[];
  actions: ParsedPlanAction[];
  expectedOutcome?: string;
  verification?: ProposalVerification;
  recovery?: ProposalRecovery;
  approvalRequired?: boolean;
}

export interface ParsedPlan {
  objective: string;
  steps: ParsedPlanStep[];
  completionCriteria?: string[];
  finalVerification?: ProposalVerification;
}

export type ProposalParseResult = { ok: true; plan: ParsedPlan } | { ok: false; errors: string[] };

// ── Parsing (defensive; never trusts structure) ───────────────────

/**
 * Parse raw model text into a validated proposal. Accepts plain JSON or
 * JSON wrapped in markdown code fences. Every object is checked for
 * allowed keys only; unknown keys (e.g. provider/model directives) are
 * REJECTED — the planner never silently drops a field the model sent.
 */
export function parsePlanProposal(content: string): ProposalParseResult {
  const errors: string[] = [];
  const raw = extractJson(content);
  if (raw === undefined) {
    return { ok: false, errors: ['planner output is not valid JSON'] };
  }
  if (!isPlainObject(raw)) {
    return { ok: false, errors: ['planner output must be a JSON object'] };
  }

  const proposalPicked = pickKeys(raw, [
    'objective',
    'steps',
    'completionCriteria',
    'finalVerification',
  ]);
  rejectUnknownKeys(proposalPicked.unknownKeys, 'proposal', errors);
  const proposal = proposalPicked.values;

  const objective = proposal.objective;
  if (typeof objective !== 'string' || objective.trim().length === 0) {
    errors.push('proposal.objective must be a non-empty string');
  }

  const stepsRaw = proposal.steps;
  if (!Array.isArray(stepsRaw) || stepsRaw.length === 0) {
    errors.push('proposal.steps must be a non-empty array');
    return { ok: false, errors };
  }
  if (stepsRaw.length > MAX_PLAN_STEPS) {
    errors.push(`proposal.steps exceeds the maximum of ${String(MAX_PLAN_STEPS)} steps`);
  }

  const steps: ParsedPlanStep[] = [];
  const seenStepIds = new Set<string>();
  for (const [index, stepRaw] of stepsRaw.entries()) {
    if (!isPlainObject(stepRaw)) {
      errors.push(`steps[${String(index)}] must be an object`);
      continue;
    }
    const stepPicked = pickKeys(stepRaw, [
      'stepId',
      'objective',
      'capability',
      'requiredCapabilities',
      'dependencies',
      'allowedTools',
      'actions',
      'expectedOutcome',
      'verification',
      'recovery',
      'approvalRequired',
    ]);
    rejectUnknownKeys(stepPicked.unknownKeys, `steps[${String(index)}]`, errors);
    const parsed = parseStep(stepPicked.values, index, seenStepIds, errors);
    if (parsed) steps.push(parsed);
  }

  // finalVerification + completionCriteria (optional, whitelisted).
  let finalVerification: ProposalVerification | undefined;
  if (proposal.finalVerification !== undefined) {
    if (!isPlainObject(proposal.finalVerification)) {
      errors.push('proposal.finalVerification must be an object');
    } else {
      const finalVerificationPicked = pickKeys(proposal.finalVerification, [
        'kind',
        'description',
        'checks',
        'requiredKeys',
        'artifact',
        'command',
        'state',
        'criteria',
        'maxOutputTokens',
      ]);
      rejectUnknownKeys(finalVerificationPicked.unknownKeys, 'finalVerification', errors);
      finalVerification = parseVerification(
        finalVerificationPicked.values,
        'finalVerification',
        errors,
      );
    }
  }

  let completionCriteria: string[] | undefined;
  if (proposal.completionCriteria !== undefined) {
    if (!isArrayOfStrings(proposal.completionCriteria, 'proposal.completionCriteria', errors)) {
      // error already recorded
    } else {
      completionCriteria = proposal.completionCriteria as string[];
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    plan: { objective: objective as string, steps, completionCriteria, finalVerification },
  };
}

// ── Step parsing ──────────────────────────────────────────────────

function parseStep(
  step: Record<string, unknown>,
  index: number,
  seenStepIds: Set<string>,
  errors: string[],
): ParsedPlanStep | undefined {
  const prefix = `steps[${String(index)}]`;

  const stepIdRaw = step.stepId;
  let stepId: string | undefined;
  if (stepIdRaw !== undefined) {
    if (typeof stepIdRaw !== 'string' || !STEP_ID_PATTERN.test(stepIdRaw)) {
      errors.push(`${prefix}.stepId must match ^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`);
    } else if (seenStepIds.has(stepIdRaw)) {
      errors.push(`${prefix}.stepId "${stepIdRaw}" is duplicated`);
    } else {
      seenStepIds.add(stepIdRaw);
      stepId = stepIdRaw;
    }
  }

  if (typeof step.objective !== 'string' || step.objective.trim().length === 0) {
    errors.push(`${prefix}.objective must be a non-empty string`);
  } else if (step.objective.length > MAX_STEP_OBJECTIVE_LENGTH) {
    errors.push(`${prefix}.objective exceeds ${String(MAX_STEP_OBJECTIVE_LENGTH)} chars`);
  }

  const capability = parseOptionalCapability(step.capability, `${prefix}.capability`, errors);
  const requiredCapabilities = parseCapabilityList(
    step.requiredCapabilities,
    `${prefix}.requiredCapabilities`,
    errors,
  );

  const dependencies = parseStringList(step.dependencies, `${prefix}.dependencies`, errors, true);
  // Empty allowedTools is a legitimate explicit "no tools" declaration;
  // a tool action outside the allowlist is rejected later (frozen structural
  // validation + this package's tool validation).
  const allowedTools = parseStringList(step.allowedTools, `${prefix}.allowedTools`, errors, true);

  const actions = parseActions(step.actions, prefix, errors);

  if (typeof step.expectedOutcome !== 'undefined' && typeof step.expectedOutcome !== 'string') {
    errors.push(`${prefix}.expectedOutcome must be a string`);
  }
  if (typeof step.approvalRequired !== 'undefined' && typeof step.approvalRequired !== 'boolean') {
    errors.push(`${prefix}.approvalRequired must be a boolean`);
  }

  let verification: ProposalVerification | undefined;
  if (step.verification !== undefined) {
    if (!isPlainObject(step.verification)) {
      errors.push(`${prefix}.verification must be an object`);
    } else {
      const verificationPicked = pickKeys(step.verification, [
        'kind',
        'description',
        'checks',
        'requiredKeys',
        'artifact',
        'command',
        'state',
        'criteria',
        'maxOutputTokens',
      ]);
      rejectUnknownKeys(verificationPicked.unknownKeys, `${prefix}.verification`, errors);
      verification = parseVerification(verificationPicked.values, `${prefix}.verification`, errors);
    }
  }

  let recovery: ProposalRecovery | undefined;
  if (step.recovery !== undefined) {
    if (!isPlainObject(step.recovery)) {
      errors.push(`${prefix}.recovery must be an object`);
    } else {
      const recoveryPicked = pickKeys(step.recovery, [
        'maxAttempts',
        'maxRevisions',
        'alternateTools',
        'acceptUnknown',
      ]);
      rejectUnknownKeys(recoveryPicked.unknownKeys, `${prefix}.recovery`, errors);
      recovery = parseRecovery(recoveryPicked.values, `${prefix}.recovery`, errors);
    }
  }

  if (errors.length > 0) return undefined;
  return {
    stepId,
    objective: step.objective as string,
    capability,
    requiredCapabilities,
    dependencies,
    allowedTools,
    actions,
    expectedOutcome: step.expectedOutcome as string | undefined,
    verification,
    recovery,
    approvalRequired: step.approvalRequired as boolean | undefined,
  };
}

function parseActions(actionsRaw: unknown, prefix: string, errors: string[]): ParsedPlanAction[] {
  if (!Array.isArray(actionsRaw) || actionsRaw.length === 0) {
    errors.push(`${prefix}.actions must be a non-empty array`);
    return [];
  }
  if (actionsRaw.length > MAX_ACTIONS_PER_STEP) {
    errors.push(`${prefix}.actions exceeds the maximum of ${String(MAX_ACTIONS_PER_STEP)}`);
  }
  const actions: ParsedPlanAction[] = [];
  const seenActionIds = new Set<string>();
  for (const [actionIndex, actionRaw] of actionsRaw.entries()) {
    if (!isPlainObject(actionRaw)) {
      errors.push(`${prefix}.actions[${String(actionIndex)}] must be an object`);
      continue;
    }
    const actionPicked = pickKeys(actionRaw, [
      'kind',
      'actionId',
      'capability',
      'requiredCapabilities',
      'qualityTier',
      'instruction',
      'expectedOutcome',
      'toolName',
      'arguments',
    ]);
    rejectUnknownKeys(
      actionPicked.unknownKeys,
      `${prefix}.actions[${String(actionIndex)}]`,
      errors,
    );
    const action = actionPicked.values;
    const actionPrefix = `${prefix}.actions[${String(actionIndex)}]`;

    const kind = action.kind;
    if (kind !== 'ai' && kind !== 'tool') {
      errors.push(`${actionPrefix}.kind must be "ai" or "tool"`);
      continue;
    }

    const actionId = parseOptionalActionId(action.actionId, actionPrefix, seenActionIds, errors);

    if (kind === 'ai') {
      const capability = action.capability;
      if (typeof capability !== 'string' || !CAPABILITY_TYPES.includes(capability as never)) {
        errors.push(
          `${actionPrefix}.capability must be a known CapabilityType (got ${describeValue(capability)})`,
        );
      }
      const required = parseCapabilityList(
        action.requiredCapabilities,
        `${actionPrefix}.requiredCapabilities`,
        errors,
      );
      let qualityTier: QualityTier | undefined;
      if (action.qualityTier !== undefined) {
        if (
          typeof action.qualityTier !== 'string' ||
          !QUALITY_TIERS.includes(action.qualityTier as QualityTier)
        ) {
          errors.push(`${actionPrefix}.qualityTier must be one of ${QUALITY_TIERS.join(', ')}`);
        } else {
          qualityTier = action.qualityTier as QualityTier;
        }
      }
      if (
        typeof action.instruction !== 'string' ||
        action.instruction.trim().length === 0 ||
        action.instruction.length > MAX_INSTRUCTION_LENGTH
      ) {
        errors.push(
          `${actionPrefix}.instruction must be a non-empty string ≤ ${String(MAX_INSTRUCTION_LENGTH)} chars`,
        );
      }
      actions.push({
        actionId,
        kind: 'ai',
        capability: action.capability as string,
        requiredCapabilities: required,
        qualityTier,
        instruction: action.instruction as string,
        expectedOutcome:
          typeof action.expectedOutcome === 'string' ? action.expectedOutcome : undefined,
      });
    } else {
      if (
        typeof action.toolName !== 'string' ||
        action.toolName.trim().length === 0 ||
        action.toolName.length > MAX_TOOL_NAME_LENGTH
      ) {
        errors.push(
          `${actionPrefix}.toolName must be a non-empty string ≤ ${String(MAX_TOOL_NAME_LENGTH)} chars`,
        );
      }
      let argumentsValue: Record<string, unknown> | undefined;
      if (action.arguments !== undefined) {
        if (!isPlainObject(action.arguments)) {
          errors.push(`${actionPrefix}.arguments must be an object`);
        } else {
          const entries = Object.entries(action.arguments);
          if (entries.length > 20) {
            errors.push(`${actionPrefix}.arguments exceeds 20 keys`);
          } else {
            // Copy with own-key checks — never spread untrusted objects.
            argumentsValue = {};
            for (const [key, value] of entries) {
              if (Object.prototype.hasOwnProperty.call(action.arguments, key)) {
                argumentsValue[key] = value;
              }
            }
          }
        }
      }
      actions.push({
        actionId,
        kind: 'tool',
        toolName: action.toolName as string,
        arguments: argumentsValue,
        expectedOutcome:
          typeof action.expectedOutcome === 'string' ? action.expectedOutcome : undefined,
      });
    }
  }
  return actions;
}

function parseOptionalActionId(
  raw: unknown,
  prefix: string,
  seen: Set<string>,
  errors: string[],
): string {
  if (raw === undefined) return '';
  if (typeof raw !== 'string' || !STEP_ID_PATTERN.test(raw)) {
    errors.push(`${prefix}.actionId must match ^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`);
    return '';
  }
  if (seen.has(raw)) {
    errors.push(`${prefix}.actionId "${raw}" is duplicated`);
    return '';
  }
  seen.add(raw);
  return raw;
}

// ── Verification parsing (all six frozen kinds) ───────────────────

function parseVerification(
  verification: Record<string, unknown>,
  prefix: string,
  errors: string[],
): ProposalVerification {
  const kind = verification.kind;
  const kinds = ['rule', 'schema', 'artifact', 'command', 'state', 'model'];
  if (typeof kind !== 'string' || !kinds.includes(kind)) {
    errors.push(`${prefix}.kind must be one of ${kinds.join(', ')}`);
    return verification;
  }
  if (
    typeof verification.description !== 'string' ||
    verification.description.trim().length === 0
  ) {
    errors.push(`${prefix}.description must be a non-empty string`);
  }
  switch (kind) {
    case 'rule': {
      if (!Array.isArray(verification.checks) || verification.checks.length === 0) {
        errors.push(`${prefix}.checks must be a non-empty array for kind "rule"`);
      } else {
        for (const [checkIndex, checkRaw] of verification.checks.entries()) {
          if (!isPlainObject(checkRaw)) {
            errors.push(`${prefix}.checks[${String(checkIndex)}] must be an object`);
            continue;
          }
          const checkPicked = pickKeys(checkRaw, ['name', 'kind', 'text', 'length', 'target']);
          rejectUnknownKeys(
            checkPicked.unknownKeys,
            `${prefix}.checks[${String(checkIndex)}]`,
            errors,
          );
          const check = checkPicked.values;
          const checkPrefix = `${prefix}.checks[${String(checkIndex)}]`;
          if (
            typeof check.kind !== 'string' ||
            !['includes', 'notIncludes', 'minLength'].includes(check.kind)
          ) {
            errors.push(`${checkPrefix}.kind must be includes|notIncludes|minLength`);
          }
          if (typeof check.name !== 'string' || check.name.trim().length === 0) {
            errors.push(`${checkPrefix}.name must be a non-empty string`);
          }
          if (check.kind === 'minLength') {
            if (
              typeof check.length !== 'number' ||
              !Number.isFinite(check.length) ||
              check.length < 1
            ) {
              errors.push(`${checkPrefix}.length must be a positive number`);
            }
          } else if (typeof check.text !== 'string' || check.text.length === 0) {
            errors.push(`${checkPrefix}.text must be a non-empty string`);
          }
          if (
            check.target !== undefined &&
            (typeof check.target !== 'string' || !['output', 'observations'].includes(check.target))
          ) {
            errors.push(`${checkPrefix}.target must be "output"|"observations"`);
          }
        }
      }
      break;
    }
    case 'schema': {
      const requiredKeys = verification.requiredKeys;
      if (!Array.isArray(requiredKeys) || requiredKeys.length === 0) {
        errors.push(`${prefix}.requiredKeys must be a non-empty array for kind "schema"`);
      } else {
        for (const [keyIndex, key] of requiredKeys.entries()) {
          if (typeof key !== 'string' || key.trim().length === 0) {
            errors.push(`${prefix}.requiredKeys[${String(keyIndex)}] must be a non-empty string`);
          }
        }
      }
      break;
    }
    case 'artifact': {
      if (!isPlainObject(verification.artifact)) {
        errors.push(`${prefix}.artifact must be an object for kind "artifact"`);
      } else {
        const artifactPicked = pickKeys(verification.artifact, ['name', 'type', 'mustExist']);
        rejectUnknownKeys(artifactPicked.unknownKeys, `${prefix}.artifact`, errors);
        const artifact = artifactPicked.values;
        if (typeof artifact.name !== 'string' || artifact.name.trim().length === 0) {
          errors.push(`${prefix}.artifact.name must be a non-empty string`);
        }
      }
      break;
    }
    case 'command': {
      if (!isPlainObject(verification.command)) {
        errors.push(`${prefix}.command must be an object for kind "command"`);
      } else {
        const commandPicked = pickKeys(verification.command, ['toolName', 'arguments', 'expect']);
        rejectUnknownKeys(commandPicked.unknownKeys, `${prefix}.command`, errors);
        const command = commandPicked.values;
        if (
          typeof command.toolName !== 'string' ||
          command.toolName.trim().length === 0 ||
          command.toolName.length > MAX_TOOL_NAME_LENGTH
        ) {
          errors.push(`${prefix}.command.toolName must be a non-empty string`);
        }
        if (command.expect !== 'ok' && command.expect !== 'fails') {
          errors.push(`${prefix}.command.expect must be "ok"|"fails"`);
        }
      }
      break;
    }
    case 'state': {
      if (!isPlainObject(verification.state)) {
        errors.push(`${prefix}.state must be an object for kind "state"`);
      } else {
        const statePicked = pickKeys(verification.state, ['artifactName', 'change']);
        rejectUnknownKeys(statePicked.unknownKeys, `${prefix}.state`, errors);
        const state = statePicked.values;
        if (typeof state.artifactName !== 'string' || state.artifactName.trim().length === 0) {
          errors.push(`${prefix}.state.artifactName must be a non-empty string`);
        }
        if (state.change !== 'created' && state.change !== 'absent') {
          errors.push(`${prefix}.state.change must be "created"|"absent"`);
        }
      }
      break;
    }
    case 'model': {
      if (!Array.isArray(verification.criteria) || verification.criteria.length === 0) {
        errors.push(`${prefix}.criteria must be a non-empty array for kind "model"`);
      } else {
        for (const [criteriaIndex, criterion] of verification.criteria.entries()) {
          if (typeof criterion !== 'string' || criterion.trim().length === 0) {
            errors.push(`${prefix}.criteria[${String(criteriaIndex)}] must be a non-empty string`);
          }
        }
      }
      if (
        verification.maxOutputTokens !== undefined &&
        (typeof verification.maxOutputTokens !== 'number' || verification.maxOutputTokens < 1)
      ) {
        errors.push(`${prefix}.maxOutputTokens must be a positive number`);
      }
      break;
    }
    default:
      break;
  }
  return verification;
}

// ── Recovery parsing (bounded by construction) ────────────────────

function parseRecovery(
  recovery: Record<string, unknown>,
  prefix: string,
  errors: string[],
): ProposalRecovery {
  if (recovery.maxAttempts !== undefined) {
    if (
      typeof recovery.maxAttempts !== 'number' ||
      !Number.isInteger(recovery.maxAttempts) ||
      recovery.maxAttempts < 1 ||
      recovery.maxAttempts > MAX_RECOVERY_ATTEMPTS
    ) {
      errors.push(
        `${prefix}.maxAttempts must be an integer in 1..${String(MAX_RECOVERY_ATTEMPTS)}`,
      );
    }
  }
  if (recovery.maxRevisions !== undefined) {
    if (
      typeof recovery.maxRevisions !== 'number' ||
      !Number.isInteger(recovery.maxRevisions) ||
      recovery.maxRevisions < 0 ||
      recovery.maxRevisions > MAX_RECOVERY_REVISIONS
    ) {
      errors.push(
        `${prefix}.maxRevisions must be an integer in 0..${String(MAX_RECOVERY_REVISIONS)}`,
      );
    }
  }
  if (recovery.alternateTools !== undefined) {
    if (!isArrayOfStrings(recovery.alternateTools, `${prefix}.alternateTools`, errors)) {
      // error already recorded
    }
  }
  if (recovery.acceptUnknown !== undefined && typeof recovery.acceptUnknown !== 'boolean') {
    errors.push(`${prefix}.acceptUnknown must be a boolean`);
  }
  return recovery;
}

// ── Small validators ──────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Return only the whitelisted keys plus the list of rejected unknown keys.
 * Unknown keys (provider/model directives, invented fields) are REJECTED —
 * the caller reports every one; the planner never silently drops a field.
 */
function pickKeys(
  object: Record<string, unknown>,
  allowed: readonly string[],
): { values: Record<string, unknown>; unknownKeys: string[] } {
  const values: Record<string, unknown> = {};
  const unknownKeys: string[] = [];
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      unknownKeys.push(key);
    } else if (Object.prototype.hasOwnProperty.call(object, key)) {
      values[key] = object[key];
    }
  }
  return { values, unknownKeys };
}

function rejectUnknownKeys(unknownKeys: string[], prefix: string, errors: string[]): void {
  for (const key of unknownKeys) {
    errors.push(`${prefix} contains an unknown/forbidden field "${key}"`);
  }
}

function parseOptionalCapability(
  raw: unknown,
  prefix: string,
  errors: string[],
): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !CAPABILITY_TYPES.includes(raw as never)) {
    errors.push(`${prefix} must be a known CapabilityType (got ${describeValue(raw)})`);
    return undefined;
  }
  return raw;
}

function parseCapabilityList(raw: unknown, prefix: string, errors: string[]): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    errors.push(`${prefix} must be an array`);
    return undefined;
  }
  const out: string[] = [];
  for (const [index, item] of raw.entries()) {
    if (typeof item !== 'string' || !CAPABILITY_TYPES.includes(item as never)) {
      errors.push(
        `${prefix}[${String(index)}] must be a known CapabilityType (got ${describeValue(item)})`,
      );
    } else if (!out.includes(item)) {
      out.push(item);
    }
  }
  return out;
}

function parseStringList(
  raw: unknown,
  prefix: string,
  errors: string[],
  allowEmpty: boolean,
): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push(`${prefix} must be an array`);
    return [];
  }
  if (raw.length === 0 && !allowEmpty) {
    errors.push(`${prefix} must be a non-empty array`);
    return [];
  }
  const out: string[] = [];
  for (const [index, item] of raw.entries()) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      errors.push(`${prefix}[${String(index)}] must be a non-empty string`);
    } else {
      out.push(item);
    }
  }
  return out;
}

function isArrayOfStrings(raw: unknown, prefix: string, errors: string[]): boolean {
  if (!Array.isArray(raw)) {
    errors.push(`${prefix} must be an array`);
    return false;
  }
  let valid = true;
  for (const [index, item] of raw.entries()) {
    if (typeof item !== 'string') {
      errors.push(`${prefix}[${String(index)}] must be a string`);
      valid = false;
    }
  }
  return valid;
}

/** Safe description of an untrusted value (never '[object Object]'). */
function describeValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

/** Extract the first JSON object from model text (strips code fences). */
function extractJson(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    const candidate = fenced[1].trim();
    if (candidate.startsWith('{')) {
      try {
        return JSON.parse(candidate);
      } catch {
        return undefined;
      }
    }
  }
  const braceStart = trimmed.indexOf('{');
  if (braceStart >= 0) {
    try {
      return JSON.parse(trimmed.slice(braceStart));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// ── Conversion: validated proposal → frozen AgentPlan ─────────────

/**
 * Convert a validated proposal into the frozen AgentPlan contract. Step
 * ids are assigned deterministically (step-<n>) when the model omitted
 * them; verification/recovery proposals are mapped onto the frozen
 * VerificationPolicy / StepRecoveryPolicy types. Called ONLY after
 * parsePlanProposal succeeded — the proposal is already whitelisted.
 */
export function planFromProposal(parsed: ParsedPlan, goalId: string, planId: string): AgentPlan {
  const steps: AgentPlanStep[] = parsed.steps.map((step, index) => ({
    stepId: step.stepId ?? `step-${index + 1}`,
    objective: step.objective,
    capability: step.capability as AgentPlanStep['capability'],
    requiredCapabilities: step.requiredCapabilities as AgentPlanStep['requiredCapabilities'],
    allowedTools: step.allowedTools,
    dependencies: step.dependencies,
    // Auto-assigned action ids are scoped to the step so they stay unique
    // across the whole plan (the frozen structural validator rejects
    // cross-plan duplicates).
    actions: step.actions.map((action, actionIndex) =>
      toActionSpec(action, `${step.stepId ?? `step-${index + 1}`}-${actionIndex + 1}`),
    ),
    expectedOutcome: step.expectedOutcome,
    verificationPolicy: step.verification
      ? (step.verification as unknown as VerificationPolicy)
      : undefined,
    recoveryPolicy: step.recovery ? toRecoveryPolicy(step.recovery) : undefined,
    approvalRequired: step.approvalRequired,
  }));

  return {
    planId,
    goalId,
    objective: parsed.objective,
    steps,
    finalVerification: parsed.finalVerification
      ? (parsed.finalVerification as unknown as VerificationPolicy)
      : undefined,
    completionCriteria: parsed.completionCriteria,
  };
}

function toActionSpec(action: ParsedPlanAction, fallbackSuffix: string): AgentActionSpec {
  const actionId = action.actionId !== '' ? action.actionId : `action-${fallbackSuffix}`;
  if (action.kind === 'ai') {
    return {
      actionId,
      kind: 'ai',
      capability: action.capability as Extract<AgentActionSpec, { kind: 'ai' }>['capability'],
      requiredCapabilities: action.requiredCapabilities as
        Extract<AgentActionSpec, { kind: 'ai' }>['requiredCapabilities'] | undefined,
      qualityTier: action.qualityTier,
      instruction: action.instruction ?? '',
      expectedOutcome: action.expectedOutcome,
    };
  }
  return {
    actionId,
    kind: 'tool',
    toolName: action.toolName ?? '',
    arguments: action.arguments,
    expectedOutcome: action.expectedOutcome,
  };
}

function toRecoveryPolicy(recovery: ProposalRecovery): StepRecoveryPolicy {
  return {
    maxAttempts: recovery.maxAttempts as number | undefined,
    maxRevisions: recovery.maxRevisions as number | undefined,
    alternateTools: recovery.alternateTools as string[] | undefined,
    acceptUnknown: recovery.acceptUnknown as boolean | undefined,
  };
}
