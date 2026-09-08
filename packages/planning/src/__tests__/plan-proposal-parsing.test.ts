// ──────────────────────────────────────────────────────────────────
// VedMoulya — Planning: parsePlanProposal defensive-parsing tests.
//
// The plan proposal is UNTRUSTED model output. These tests prove the
// whitelist parser rejects unknown/authority fields (provider/model),
// malformed steps/actions/verifications, and out-of-bounds recovery,
// while accepting every legitimate frozen shape.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { parsePlanProposal } from '../domain/plan-proposal.js';
import { validProposalJson } from './fixtures.js';

type Proposal = Record<string, unknown>;
type ParseResult = ReturnType<typeof parsePlanProposal>;

function baseProposal(): Proposal {
  return JSON.parse(validProposalJson()) as Proposal;
}

function parse(mutate: (p: Proposal) => void): ParseResult {
  const proposal = baseProposal();
  mutate(proposal);
  return parsePlanProposal(JSON.stringify(proposal));
}

function expectReject(result: ParseResult, needle: string): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.join(' ')).toContain(needle);
}

const step0 = (p: Proposal): Record<string, unknown> =>
  (p.steps as Array<Record<string, unknown>>)[0];
const step0Actions = (p: Proposal): Array<Record<string, unknown>> =>
  step0(p).actions as Array<Record<string, unknown>>;

describe('plan proposal parsing — accepted shapes', () => {
  it('accepts the canonical valid proposal, also wrapped in markdown fences', () => {
    const plain = parsePlanProposal(validProposalJson());
    expect(plain.ok).toBe(true);
    if (plain.ok) expect(plain.plan.steps.length).toBeGreaterThan(0);

    const fenced = parsePlanProposal('```json\n' + validProposalJson() + '\n```');
    expect(fenced.ok).toBe(true);
  });

  it('accepts tool actions, command verification and a fully-specified recovery', () => {
    const result = parse((p) => {
      (p.steps as Array<Record<string, unknown>>).push({
        stepId: 'step-99',
        objective: 'Run the verification command',
        dependencies: ['step-2'],
        allowedTools: ['run.tests', 'calculator'],
        actions: [
          {
            kind: 'tool',
            actionId: 'run-tests',
            toolName: 'run.tests',
            arguments: { suite: 'unit' },
            expectedOutcome: 'green',
          },
        ],
        verification: {
          kind: 'command',
          description: 'tests pass',
          command: { toolName: 'run.tests', expect: 'ok' },
        },
        recovery: {
          maxAttempts: 3,
          maxRevisions: 2,
          alternateTools: ['calculator'],
          acceptUnknown: true,
        },
        approvalRequired: true,
        expectedOutcome: 'suite green',
      });
      p.completionCriteria = ['all steps verified'];
      p.finalVerification = {
        kind: 'model',
        description: 'final review',
        criteria: ['goal achieved', 'no regressions'],
        maxOutputTokens: 512,
      };
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.steps.length).toBeGreaterThan(2);
      expect(result.plan.completionCriteria).toEqual(['all steps verified']);
      expect(result.plan.finalVerification?.kind).toBe('model');
    }
  });

  it('accepts schema, artifact and state verification kinds with valid payloads', () => {
    const verifications = [
      { kind: 'schema', description: 'shape', requiredKeys: ['status'] },
      { kind: 'artifact', description: 'exists', artifact: { name: 'report.md', mustExist: true } },
      {
        kind: 'state',
        description: 'created',
        state: { artifactName: 'report.md', change: 'created' },
      },
    ];
    for (const verification of verifications) {
      const result = parse((p) => {
        step0(p).verification = verification;
      });
      expect(result.ok).toBe(true);
    }
  });
});

describe('plan proposal parsing — top-level rejections', () => {
  it('rejects non-JSON and non-object output', () => {
    expectReject(parsePlanProposal('not json at all'), 'not valid JSON');
    expectReject(parsePlanProposal('42'), 'not valid JSON');
  });

  it('rejects unknown proposal keys instead of silently dropping them', () => {
    expectReject(
      parse((p) => {
        p.provider = 'gemini-2.5';
      }),
      'provider',
    );
  });

  it('rejects a missing or empty objective', () => {
    expectReject(
      parse((p) => {
        p.objective = '';
      }),
      'proposal.objective must be a non-empty string',
    );
  });

  it('rejects missing/empty steps and a non-object step', () => {
    expectReject(
      parse((p) => {
        p.steps = [];
      }),
      'proposal.steps must be a non-empty array',
    );
    expectReject(
      parse((p) => {
        p.steps = 'nope';
      }),
      'proposal.steps must be a non-empty array',
    );
    expectReject(
      parse((p) => {
        (p.steps as unknown[])[0] = 'inspect';
      }),
      'steps[0] must be an object',
    );
  });

  it('rejects an unknown step key and a non-object finalVerification', () => {
    expectReject(
      parse((p) => {
        step0(p).model = 'gpt-5';
      }),
      'model',
    );
    expectReject(
      parse((p) => {
        p.finalVerification = 'rule';
      }),
      'proposal.finalVerification must be an object',
    );
  });

  it('rejects a step count above the frozen maximum', () => {
    expectReject(
      parse((p) => {
        const steps: Array<Record<string, unknown>> = [];
        for (let i = 0; i < 13; i += 1) {
          steps.push(JSON.parse(JSON.stringify(step0(p))) as Record<string, unknown>);
        }
        p.steps = steps;
      }),
      'maximum of 12 steps',
    );
  });
});

describe('plan proposal parsing — step-level rejections', () => {
  it('rejects malformed and duplicated stepIds', () => {
    expectReject(
      parse((p) => {
        step0(p).stepId = 'bad id!';
      }),
      'stepId must match',
    );
    expectReject(
      parse((p) => {
        (p.steps as Array<Record<string, unknown>>)[1].stepId = 'step-1';
      }),
      'is duplicated',
    );
  });

  it('rejects empty and oversized step objectives', () => {
    expectReject(
      parse((p) => {
        step0(p).objective = '   ';
      }),
      'steps[0].objective must be a non-empty string',
    );
    expectReject(
      parse((p) => {
        step0(p).objective = 'x'.repeat(301);
      }),
      'steps[0].objective exceeds 300 chars',
    );
  });

  it('rejects non-string expectedOutcome and non-boolean approvalRequired', () => {
    expectReject(
      parse((p) => {
        step0(p).expectedOutcome = 7;
      }),
      'expectedOutcome must be a string',
    );
    expectReject(
      parse((p) => {
        step0(p).approvalRequired = 'yes';
      }),
      'approvalRequired must be a boolean',
    );
  });

  it('rejects non-object verification and recovery', () => {
    expectReject(
      parse((p) => {
        step0(p).verification = 'rule';
      }),
      'steps[0].verification must be an object',
    );
    expectReject(
      parse((p) => {
        step0(p).recovery = 'fast';
      }),
      'steps[0].recovery must be an object',
    );
  });
});

describe('plan proposal parsing — action rejections', () => {
  it('rejects missing/oversized actions and non-object actions', () => {
    expectReject(
      parse((p) => {
        step0(p).actions = [];
      }),
      'actions must be a non-empty array',
    );
    expectReject(
      parse((p) => {
        step0(p).actions = 'ai';
      }),
      'actions must be a non-empty array',
    );
    expectReject(
      parse((p) => {
        step0(p).actions = ['ai'];
      }),
      'actions[0] must be an object',
    );
  });

  it('rejects unknown action keys and unknown action kinds', () => {
    expectReject(
      parse((p) => {
        step0Actions(p)[0].model = 'gpt-5';
      }),
      'model',
    );
    expectReject(
      parse((p) => {
        step0Actions(p)[0].kind = 'shell';
      }),
      'kind must be "ai" or "tool"',
    );
  });

  it('rejects an ai action with an unknown capability or bad qualityTier or empty instruction', () => {
    expectReject(
      parse((p) => {
        step0Actions(p)[0].capability = 'telepathy';
      }),
      'known CapabilityType',
    );
    expectReject(
      parse((p) => {
        step0Actions(p)[0].qualityTier = 'ULTRA';
      }),
      'qualityTier must be one of',
    );
    expectReject(
      parse((p) => {
        step0Actions(p)[0].instruction = '   ';
      }),
      'instruction must be a non-empty string',
    );
  });

  it('accepts a valid qualityTier + actionId and rejects invalid/duplicated actionIds', () => {
    const ok = parse((p) => {
      step0Actions(p)[0].qualityTier = 'standard';
      step0Actions(p)[0].actionId = 'act-1';
    });
    expect(ok.ok).toBe(true);

    expectReject(
      parse((p) => {
        step0Actions(p)[0].actionId = 'bad id!';
      }),
      'actionId must match',
    );
    expectReject(
      parse((p) => {
        const actions = step0Actions(p);
        actions.push({ kind: 'ai', capability: 'reasoning', instruction: 'second action' });
        actions[0].actionId = 'act-1';
        actions[1].actionId = 'act-1';
      }),
      'is duplicated',
    );
  });

  it('rejects a tool action with an empty toolName or invalid/oversized arguments', () => {
    expectReject(
      parse((p) => {
        step0(p).actions = [{ kind: 'tool', toolName: '' }];
      }),
      'toolName must be a non-empty string',
    );
    expectReject(
      parse((p) => {
        step0(p).actions = [{ kind: 'tool', toolName: 'run.tests', arguments: 'suite' }];
      }),
      'arguments must be an object',
    );
    const many: Record<string, number> = {};
    for (let i = 0; i < 21; i += 1) many[`k${String(i)}`] = i;
    expectReject(
      parse((p) => {
        step0(p).actions = [{ kind: 'tool', toolName: 'run.tests', arguments: many }];
      }),
      'arguments exceeds 20 keys',
    );
  });
});

describe('plan proposal parsing — verification rejections', () => {
  it('rejects an unknown verification kind and a missing description', () => {
    expectReject(
      parse((p) => {
        step0(p).verification = { kind: 'mystery', description: 'd' };
      }),
      'kind must be one of',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = { kind: 'rule', description: '  ' };
      }),
      'description must be a non-empty string',
    );
  });

  it('validates rule checks (shape, kind, name, length/text, target)', () => {
    expectReject(
      parse((p) => {
        step0(p).verification = { kind: 'rule', description: 'd', checks: [] };
      }),
      'checks must be a non-empty array',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = { kind: 'rule', description: 'd', checks: ['x'] };
      }),
      'checks[0] must be an object',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = {
          kind: 'rule',
          description: 'd',
          checks: [{ name: 'n', kind: 'regex' }],
        };
      }),
      'kind must be includes|notIncludes|minLength',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = {
          kind: 'rule',
          description: 'd',
          checks: [{ kind: 'includes', text: 'x' }],
        };
      }),
      'name must be a non-empty string',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = {
          kind: 'rule',
          description: 'd',
          checks: [{ name: 'n', kind: 'minLength', length: 0 }],
        };
      }),
      'length must be a positive number',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = {
          kind: 'rule',
          description: 'd',
          checks: [{ name: 'n', kind: 'includes' }],
        };
      }),
      'text must be a non-empty string',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = {
          kind: 'rule',
          description: 'd',
          checks: [{ name: 'n', kind: 'includes', text: 'x', target: 'everywhere' }],
        };
      }),
      'target must be "output"|"observations"',
    );
  });

  it('validates schema requiredKeys and artifact payloads', () => {
    expectReject(
      parse((p) => {
        step0(p).verification = { kind: 'schema', description: 'd', requiredKeys: [] };
      }),
      'requiredKeys must be a non-empty array',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = { kind: 'schema', description: 'd', requiredKeys: [''] };
      }),
      'requiredKeys[0] must be a non-empty string',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = { kind: 'artifact', description: 'd' };
      }),
      'artifact must be an object',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = { kind: 'artifact', description: 'd', artifact: { name: '  ' } };
      }),
      'artifact.name must be a non-empty string',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = {
          kind: 'artifact',
          description: 'd',
          artifact: { name: 'r.md', provider: 'x' },
        };
      }),
      'artifact',
    );
  });

  it('validates command payloads', () => {
    expectReject(
      parse((p) => {
        step0(p).verification = { kind: 'command', description: 'd' };
      }),
      'command must be an object',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = {
          kind: 'command',
          description: 'd',
          command: { toolName: '', expect: 'ok' },
        };
      }),
      'command.toolName',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = {
          kind: 'command',
          description: 'd',
          command: { toolName: 'run.tests', expect: 'sometimes' },
        };
      }),
      'command.expect must be "ok"|"fails"',
    );
  });

  it('validates state payloads', () => {
    expectReject(
      parse((p) => {
        step0(p).verification = { kind: 'state', description: 'd' };
      }),
      'state must be an object',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = {
          kind: 'state',
          description: 'd',
          state: { artifactName: '', change: 'created' },
        };
      }),
      'state.artifactName must be a non-empty string',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = {
          kind: 'state',
          description: 'd',
          state: { artifactName: 'r.md', change: 'mutated' },
        };
      }),
      'state.change must be "created"|"absent"',
    );
  });

  it('validates model criteria and maxOutputTokens', () => {
    expectReject(
      parse((p) => {
        step0(p).verification = { kind: 'model', description: 'd', criteria: [] };
      }),
      'criteria must be a non-empty array',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = { kind: 'model', description: 'd', criteria: ['  '] };
      }),
      'criteria[0] must be a non-empty string',
    );
    expectReject(
      parse((p) => {
        step0(p).verification = {
          kind: 'model',
          description: 'd',
          criteria: ['c'],
          maxOutputTokens: 0,
        };
      }),
      'maxOutputTokens must be a positive number',
    );
  });
});

describe('plan proposal parsing — recovery rejections', () => {
  it('bounds maxAttempts and maxRevisions', () => {
    expectReject(
      parse((p) => {
        step0(p).recovery = { maxAttempts: 0 };
      }),
      'maxAttempts must be an integer in 1..10',
    );
    expectReject(
      parse((p) => {
        step0(p).recovery = { maxAttempts: 11 };
      }),
      'maxAttempts must be an integer in 1..10',
    );
    expectReject(
      parse((p) => {
        step0(p).recovery = { maxRevisions: 6 };
      }),
      'maxRevisions must be an integer in 0..5',
    );
  });

  it('validates alternateTools and acceptUnknown types', () => {
    expectReject(
      parse((p) => {
        step0(p).recovery = { alternateTools: 'run.tests' };
      }),
      'alternateTools',
    );
    expectReject(
      parse((p) => {
        step0(p).recovery = { acceptUnknown: 'yes' };
      }),
      'acceptUnknown must be a boolean',
    );
  });
});
