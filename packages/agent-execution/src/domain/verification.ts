// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Verification Interpreter
//
// Turns a VerificationPolicy into a normalized result:
//   VERIFIED | FAILED | PARTIAL | UNKNOWN | BLOCKED
//
// Rules:
//   - Deterministic verification (rule/schema/artifact/command/state) is
//     ALWAYS preferred over another AI call.
//   - Model-based verification is used ONLY when the policy declares kind
//     'model' (deterministic verification is impossible).
//   - UNKNOWN is never success: no policy ⇒ UNKNOWN; an all-unknown
//     evaluation ⇒ UNKNOWN. The engine routes UNKNOWN into recovery.
//   - A denied command-verification tool ⇒ BLOCKED (never bypassed).
// ──────────────────────────────────────────────────────────────────

import type {
  AgentModelVerifierPort,
  AgentToolExecutionPort,
} from '../contracts/agent-execution-ports.js';
import type {
  AgentArtifactRef,
  AgentObservation,
  AgentRuleCheck,
  AgentVerificationCheck,
  AgentVerificationResult,
  VerificationPolicy,
  VerificationVerdict,
} from '../types/agent-execution-types.js';

export interface VerificationContext {
  /** Sanitized attempt output (AI content and/or tool outcomes). */
  output: string;
  /** Artifacts reported by the attempt's actions. */
  artifacts: AgentArtifactRef[];
  /** Observations emitted by the attempt's actions. */
  observations: AgentObservation[];
}

export interface VerificationDeps {
  tools?: AgentToolExecutionPort;
  modelVerifier?: AgentModelVerifierPort;
}

const PASS = (name: string, detail: string): AgentVerificationCheck => ({
  name,
  status: 'pass',
  detail,
});
const FAIL = (name: string, detail: string): AgentVerificationCheck => ({
  name,
  status: 'fail',
  detail,
});
const UNKNOWN = (name: string, detail: string): AgentVerificationCheck => ({
  name,
  status: 'unknown',
  detail,
});

/** Aggregate individual checks into the normalized verdict vocabulary. */
export function aggregateVerdict(checks: AgentVerificationCheck[]): {
  verdict: VerificationVerdict;
  reasons: string[];
} {
  const fails = checks.filter((c) => c.status === 'fail').length;
  const unknowns = checks.filter((c) => c.status === 'unknown').length;
  const passes = checks.filter((c) => c.status === 'pass').length;

  if (fails > 0) {
    const failedNames = checks
      .filter((c) => c.status === 'fail')
      .map((c) => c.name)
      .join(', ');
    return { verdict: 'FAILED', reasons: [`verification failed: ${failedNames}`] };
  }
  if (checks.length === 0) {
    return { verdict: 'UNKNOWN', reasons: ['nothing was verifiable (no checks evaluated)'] };
  }
  if (unknowns === 0) {
    return { verdict: 'VERIFIED', reasons: [`all ${String(passes)} check(s) passed`] };
  }
  if (passes > 0) {
    return {
      verdict: 'PARTIAL',
      reasons: [`${String(passes)} check(s) passed but ${String(unknowns)} could not be evaluated`],
    };
  }
  return { verdict: 'UNKNOWN', reasons: ['no check could be evaluated'] };
}

function observationsText(observations: AgentObservation[]): string {
  return observations.map((o) => `${o.status}: ${o.resultSummary}`).join('\n');
}

function evaluateRule(rule: AgentRuleCheck, ctx: VerificationContext): AgentVerificationCheck {
  const text = rule.target === 'observations' ? observationsText(ctx.observations) : ctx.output;
  if (rule.kind === 'includes') {
    return text.includes(rule.text)
      ? PASS(rule.name, `output includes "${rule.text}"`)
      : FAIL(rule.name, `output does not include "${rule.text}"`);
  }
  if (rule.kind === 'notIncludes') {
    return text.includes(rule.text)
      ? FAIL(rule.name, `output unexpectedly includes "${rule.text}"`)
      : PASS(rule.name, `output does not include "${rule.text}"`);
  }
  return text.length >= rule.length
    ? PASS(rule.name, `output length ${String(text.length)} >= ${String(rule.length)}`)
    : FAIL(rule.name, `output length ${String(text.length)} < ${String(rule.length)}`);
}

function findArtifact(artifacts: AgentArtifactRef[], name: string): AgentArtifactRef | undefined {
  return artifacts.find((a) => a.name === name);
}

/**
 * Evaluate one verification policy against a step attempt. Deterministic
 * kinds never call a model. Returns the normalized result.
 */
export async function verifyAgainstPolicy(
  policy: VerificationPolicy | undefined,
  ctx: VerificationContext,
  deps: VerificationDeps = {},
): Promise<AgentVerificationResult> {
  if (!policy) {
    return {
      verdict: 'UNKNOWN',
      checks: [],
      reasons: ['no verification policy on this step — UNKNOWN is not success'],
      policyKind: 'none',
    };
  }

  const checks: AgentVerificationCheck[] = [];

  if (policy.kind === 'rule') {
    for (const rule of policy.checks) {
      checks.push(evaluateRule(rule, ctx));
    }
  } else if (policy.kind === 'schema') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(ctx.output) as unknown;
    } catch {
      checks.push(FAIL('json', 'output is not valid JSON'));
    }
    if (parsed !== undefined) {
      if (typeof parsed !== 'object' || parsed === null) {
        checks.push(FAIL('object', 'output JSON is not an object'));
      } else {
        const record = parsed as Record<string, unknown>;
        for (const key of policy.requiredKeys) {
          const has = Object.prototype.hasOwnProperty.call(record, key);
          checks.push(
            has
              ? PASS(`key.${key}`, `required key "${key}" present`)
              : FAIL(`key.${key}`, `required key "${key}" missing`),
          );
        }
      }
    }
  } else if (policy.kind === 'artifact') {
    const artifact = findArtifact(ctx.artifacts, policy.artifact.name);
    const mustExist = policy.artifact.mustExist ?? true;
    if (mustExist) {
      if (!artifact) {
        checks.push(FAIL('artifact', `artifact "${policy.artifact.name}" was not produced`));
      } else if (policy.artifact.type !== undefined && artifact.type !== policy.artifact.type) {
        checks.push(
          FAIL(
            'artifact',
            `artifact "${policy.artifact.name}" has type "${artifact.type}" (expected "${policy.artifact.type}")`,
          ),
        );
      } else {
        checks.push(PASS('artifact', `artifact "${policy.artifact.name}" produced`));
      }
    } else if (artifact) {
      checks.push(FAIL('artifact', `artifact "${policy.artifact.name}" unexpectedly present`));
    } else {
      checks.push(PASS('artifact', `artifact "${policy.artifact.name}" absent as expected`));
    }
  } else if (policy.kind === 'state') {
    const artifact = findArtifact(ctx.artifacts, policy.state.artifactName);
    const present = artifact !== undefined;
    const created = policy.state.change === 'created';
    if (created === present) {
      checks.push(
        PASS(
          'state',
          created
            ? `artifact "${policy.state.artifactName}" was created`
            : `artifact "${policy.state.artifactName}" is absent`,
        ),
      );
    } else {
      checks.push(
        FAIL(
          'state',
          created
            ? `artifact "${policy.state.artifactName}" was NOT created`
            : `artifact "${policy.state.artifactName}" is unexpectedly present`,
        ),
      );
    }
  } else if (policy.kind === 'command') {
    const tools = deps.tools;
    if (!tools) {
      checks.push(
        UNKNOWN('command', 'command verification requires a tool port, which is not available'),
      );
    } else {
      const result = await tools.execute({
        toolName: policy.command.toolName,
        arguments: policy.command.arguments ?? {},
      });
      if (result.denied) {
        return {
          verdict: 'BLOCKED',
          checks: [
            {
              name: 'command',
              status: 'unknown',
              detail: `verification tool "${policy.command.toolName}" was denied by the security policy`,
            },
          ],
          reasons: [`command verification blocked: tool "${policy.command.toolName}" denied`],
          policyKind: policy.kind,
        };
      }
      const expectOk = policy.command.expect === 'ok';
      const actualOk = result.ok;
      if (expectOk === actualOk) {
        checks.push(
          PASS(
            'command',
            `verification command "${policy.command.toolName}" ${actualOk ? 'succeeded' : 'failed as expected'}`,
          ),
        );
      } else {
        checks.push(
          FAIL(
            'command',
            `verification command "${policy.command.toolName}" ${actualOk ? 'succeeded (expected failure)' : 'failed (expected success)'}: ${result.error ?? result.outcome}`,
          ),
        );
      }
    }
  } else {
    // Final branch — every other policy kind was excluded above, so the
    // compiler narrows `policy` to the model variant here. Adding a new
    // variant without `criteria` breaks this line at compile time.
    const verifier = deps.modelVerifier;
    if (!verifier) {
      checks.push(UNKNOWN('model', 'model verifier port is not available'));
    } else {
      const result = await verifier.verify({
        stepId: 'verification',
        output: ctx.output,
        criteria: policy.criteria,
      });
      for (const check of result.checks) {
        checks.push(check.passed ? PASS(check.name, check.detail) : FAIL(check.name, check.detail));
      }
    }
  }

  const { verdict, reasons } = aggregateVerdict(checks);
  return { verdict, checks, reasons, policyKind: policy.kind };
}
