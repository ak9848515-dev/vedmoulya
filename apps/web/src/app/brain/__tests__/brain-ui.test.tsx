// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — VedMoulya Brain UI Tests (EPIC-016)
//
// Proves the premium /brain panels and pure helpers render honestly:
//   - stage rail shows all 6 pipeline stages with their statuses
//   - provider assignments render provider/role/quality with evidence
//   - approval panel surfaces sensitive actions (Approve/Reject) and
//     distinguishes non-sensitive hand-offs (missing-capabilities)
//   - verification renders pass/fail checks
//   - synthesis renders claims with confidence + provenance
//   - decision records explain selected / alternatives / evidence
//   - nextStepOf maps stages to the correct next pipeline action
// Nothing is fabricated: fixtures mirror the real BrainTask shape.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { BrainTask, BrainStage, BrainStageStatus, IntentProfile } from '@vedmoulya/brain';
import {
  BrainStageRail,
  BrainProviderAssignments,
  BrainApprovalPanel,
  BrainVerificationPanel,
  BrainSynthesisPanel,
  BrainOutputsPanel,
  BrainDecisionRecordsPanel,
  BrainTaskMeta,
} from '../brain-panels.js';
import {
  formatStageStatus,
  formatMode,
  formatRole,
  formatStage,
  formatUsd,
  confidenceBadge,
  confidenceBarColor,
  nextStepOf,
  nextStepLabel,
} from '../brain-ui.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const STAGE_STATUSES: Record<BrainStage, BrainStageStatus> = {
  UNDERSTANDING: 'completed',
  PLAN: 'completed',
  INTELLIGENCE: 'completed',
  EXECUTION: 'running',
  VERIFICATION: 'pending',
  RESULT: 'pending',
  CANCELLED: 'pending',
  FAILED: 'pending',
};

const INTENT: IntentProfile = {
  objective: 'Write a high-quality blog post about AI productivity',
  domain: 'content',
  desiredOutcome: 'A publishable blog post',
  constraints: ['free', 'high quality'],
  qualityTarget: 'HIGH',
  privacyRequirement: 'PRIVATE',
  urgency: 'NORMAL',
  authorizedActions: [],
  ambiguities: ['Audience not specified'],
  assumptions: [{ assumption: 'English language', reason: 'Not specified by the user' }],
};

function makeTask(overrides: Partial<BrainTask> = {}): BrainTask {
  const base: BrainTask = {
    id: 'brain-test-1',
    userId: 'user-1',
    objective: 'Write a high-quality blog post about AI productivity',
    originalInput: 'Write a high-quality blog post about AI productivity',
    intent: INTENT,
    mode: 'BALANCED',
    domain: 'content',
    qualityTarget: 'HIGH',
    privacyRequirement: 'PRIVATE',
    budget: { maxTokens: 8000, maxCostUsd: 0.5, maxIterations: 3, maxLatencyMs: 60000 },
    requiredCapabilities: ['TEXT_GENERATION'],
    roleAssignments: [
      {
        capability: 'TEXT_GENERATION',
        role: 'PRIMARY_REASONER',
        providerId: 'openai',
        providerName: 'OpenAI',
        modelId: 'gpt-4o',
        quality: 0.91,
        reason: 'Highest evidence of writing quality for this task.',
        evidence: ['Provider benchmark suite 2026'],
      },
    ],
    graph: { nodes: [], edges: [], waves: [['n1'], ['n2', 'n3']] },
    status: 'VERIFYING',
    stage: 'EXECUTION',
    stageStatuses: STAGE_STATUSES,
    providerOutputs: [
      {
        providerId: 'openai',
        role: 'PRIMARY_REASONER',
        capability: 'TEXT_GENERATION',
        output: 'The draft covers AI productivity practices.',
        evidence: [],
        quality: 0.91,
      },
    ],
    conflicts: [],
    failoverEvents: [],
    decisionRecords: [
      {
        id: 'dec-1',
        taskId: 'brain-test-1',
        userId: 'user-1',
        decision: 'provider roles',
        reason: 'Assigned roles to 1 provider across 1 available capabilities (quality-first).',
        alternatives: ['single provider', 'n-provider roles'],
        selected: '1-provider role assignment',
        evidence: [],
        confidence: 0.7,
        constraints: [],
        qualityEstimate: undefined,
        createdAt: '2026-08-11T10:00:00.000Z',
        provenance: 'brain-role-assigner',
      },
    ],
    approvalRequired: [],
    approvalGranted: [],
    traceId: 'trace-test-1',
    createdAt: '2026-08-11T10:00:00.000Z',
    updatedAt: '2026-08-11T10:01:00.000Z',
  };
  return { ...base, ...overrides };
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

describe('brain-ui helpers', () => {
  it('formats stage status into human text', () => {
    expect(formatStageStatus('completed')).toBe('completed');
    expect(formatStageStatus('running')).toBe('running');
    expect(formatStageStatus(undefined)).toBe('pending');
  });

  it('maps modes, roles and stages to labels with fallbacks', () => {
    expect(formatMode('DEEP_RESEARCH')).toBe('Deep research');
    expect(formatMode(undefined)).toBe('Balanced');
    expect(formatRole('FACT_CHECKER')).toBe('Fact checker');
    expect(formatRole(undefined)).toBe('Specialist');
    expect(formatStage('VERIFICATION')).toBe('Verify');
    expect(formatStage(undefined)).toBe('Understand');
  });

  it('formats USD honestly (UNKNOWN stays a dash)', () => {
    expect(formatUsd(0.001)).toBe('$1.00m');
    expect(formatUsd(0.25)).toBe('$0.2500');
    expect(formatUsd(undefined)).toBe('—');
  });

  it('maps confidence to color tiers', () => {
    expect(confidenceBarColor(0.9)).toBe('#22C55E');
    expect(confidenceBarColor(0.6)).toBe('#F59E0B');
    expect(confidenceBarColor(0.2)).toBe('#EF4444');
    expect(confidenceBadge(0.9)).toContain('emerald');
    expect(confidenceBadge(0.6)).toContain('amber');
    expect(confidenceBadge(0.2)).toContain('rose');
  });

  it('maps the current stage to the correct next pipeline action', () => {
    expect(nextStepOf(makeTask({ stage: 'UNDERSTANDING' }))).toBe('plan');
    expect(nextStepOf(makeTask({ stage: 'PLAN' }))).toBe('selectResources');
    expect(nextStepOf(makeTask({ stage: 'INTELLIGENCE' }))).toBe('execute');
    expect(nextStepOf(makeTask({ stage: 'EXECUTION' }))).toBe('verify');
    expect(nextStepOf(makeTask({ stage: 'RESULT' }))).toBeNull();
    expect(nextStepOf(makeTask({ stage: 'FAILED', status: 'FAILED' }))).toBeNull();
    expect(nextStepOf(makeTask({ stage: 'CANCELLED', status: 'CANCELLED' }))).toBeNull();
  });

  it('labels the next pipeline action', () => {
    expect(nextStepLabel('plan')).toBe('Plan capabilities');
    expect(nextStepLabel('selectResources')).toBe('Select providers');
    expect(nextStepLabel('execute')).toBe('Execute');
    expect(nextStepLabel('verify')).toBe('Verify & finalize');
    expect(nextStepLabel(null)).toBeNull();
  });
});

// ── Stage rail ───────────────────────────────────────────────────────────────

describe('BrainStageRail', () => {
  it('renders all six pipeline stages with their status chips', () => {
    render(<BrainStageRail stageStatuses={STAGE_STATUSES} stage="EXECUTION" />);
    expect(screen.getByText('Understand')).toBeDefined();
    expect(screen.getByText('Plan')).toBeDefined();
    expect(screen.getByText('Intelligence')).toBeDefined();
    expect(screen.getByText('Execute')).toBeDefined();
    expect(screen.getByText('Verify')).toBeDefined();
    expect(screen.getByText('Result')).toBeDefined();
    expect(screen.getAllByText('completed').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('running')).toBeDefined();
    expect(screen.getAllByText('pending').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the terminal failure banner instead of the rail', () => {
    render(<BrainStageRail stageStatuses={STAGE_STATUSES} stage="FAILED" />);
    expect(screen.getByText('Task failed')).toBeDefined();
    expect(screen.queryByText('Understand')).toBeNull();
  });

  it('renders the terminal cancelled banner', () => {
    render(<BrainStageRail stageStatuses={STAGE_STATUSES} stage="CANCELLED" />);
    expect(screen.getByText('Task cancelled')).toBeDefined();
  });
});

// ── Meta strip ───────────────────────────────────────────────────────────────

describe('BrainTaskMeta', () => {
  it('shows status, mode, quality and privacy', () => {
    render(<BrainTaskMeta task={makeTask()} />);
    expect(screen.getByText('VERIFYING')).toBeDefined();
    expect(screen.getByText('Balanced mode')).toBeDefined();
    expect(screen.getByText(/Quality: High/)).toBeDefined();
    expect(screen.getByText('Private')).toBeDefined();
    expect(screen.getByText(/1 provider role/)).toBeDefined();
    expect(screen.getByText(/1 output/)).toBeDefined();
  });
});

// ── Provider assignments ─────────────────────────────────────────────────────

describe('BrainProviderAssignments', () => {
  it('renders provider, role, capability, model and quality', () => {
    render(<BrainProviderAssignments task={makeTask()} />);
    expect(screen.getByText('OpenAI')).toBeDefined();
    expect(screen.getByText(/Primary reasoner/)).toBeDefined();
    expect(screen.getByText(/TEXT_GENERATION/)).toBeDefined();
    expect(screen.getByText(/gpt-4o/)).toBeDefined();
    expect(screen.getByText('91')).toBeDefined();
    expect(screen.getByText('Highest evidence of writing quality for this task.')).toBeDefined();
  });

  it('renders the execution-graph waves', () => {
    render(<BrainProviderAssignments task={makeTask()} />);
    expect(screen.getByText(/2 parallel nodes/)).toBeDefined();
  });

  it('renders an honest empty state before selection', () => {
    render(<BrainProviderAssignments task={makeTask({ roleAssignments: [] })} />);
    expect(screen.getByText(/No role assignments yet/)).toBeDefined();
  });
});

// ── Approval panel ───────────────────────────────────────────────────────────

describe('BrainApprovalPanel', () => {
  const onApprove = vi.fn();
  const onReject = vi.fn();
  const onRequest = vi.fn();

  it('renders the all-clear state when nothing is pending', () => {
    render(
      <BrainApprovalPanel
        task={makeTask()}
        onApprove={onApprove}
        onReject={onReject}
        onRequest={onRequest}
        busy={false}
      />,
    );
    expect(screen.getByText(/No sensitive actions pending/)).toBeDefined();
  });

  it('lets the user request approval for a sensitive action', () => {
    render(
      <BrainApprovalPanel
        task={makeTask()}
        onApprove={onApprove}
        onReject={onReject}
        onRequest={onRequest}
        busy={false}
      />,
    );
    fireEvent.click(
      screen
        .getByText('Request approval for a sensitive action (publish, send, deploy…)')
        .closest('summary') as HTMLElement,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(onRequest).toHaveBeenCalledWith('publish');
    fireEvent.click(screen.getByRole('button', { name: 'Deploy' }));
    expect(onRequest).toHaveBeenCalledWith('deploy');
  });

  it('surfaces sensitive actions with Approve / Reject', () => {
    const task = makeTask({
      status: 'AWAITING_APPROVAL',
      approvalRequired: ['publish'],
    });
    render(
      <BrainApprovalPanel
        task={task}
        onApprove={onApprove}
        onReject={onReject}
        onRequest={onRequest}
        busy={false}
      />,
    );
    expect(screen.getByText('Publish')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onApprove).toHaveBeenCalledWith('publish');
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onReject).toHaveBeenCalledWith('publish');
  });

  it('keeps non-sensitive hand-offs informational (no fake approve)', () => {
    const task = makeTask({ approvalRequired: ['missing-capabilities'] });
    render(
      <BrainApprovalPanel
        task={task}
        onApprove={onApprove}
        onReject={onReject}
        onRequest={onRequest}
        busy={false}
      />,
    );
    // The policy key renders verbatim (hyphenated) — the display never hides it.
    expect(screen.getByText(/missing-capabilities/i)).toBeDefined();
    expect(screen.getByText(/never fakes execution/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    // Even with a hand-off pending, the user can still request approval for a
    // sensitive action — the request affordance coexists with the notice.
    fireEvent.click(
      screen
        .getByText('Request approval for a sensitive action (publish, send, deploy…)')
        .closest('summary') as HTMLElement,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(onRequest).toHaveBeenCalledWith('publish');
  });

  it('disables the buttons while an action is busy', () => {
    const task = makeTask({ status: 'AWAITING_APPROVAL', approvalRequired: ['deploy'] });
    render(
      <BrainApprovalPanel
        task={task}
        onApprove={onApprove}
        onReject={onReject}
        onRequest={onRequest}
        busy
      />,
    );
    expect((screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

// ── Verification panel ───────────────────────────────────────────────────────

describe('BrainVerificationPanel', () => {
  it('renders passed checks with a passed badge', () => {
    render(
      <BrainVerificationPanel
        verification={{
          passed: true,
          checks: [
            {
              name: 'execution completed',
              passed: true,
              detail: '1 provider output(s) recorded.',
              evidence: [],
            },
            {
              name: 'no unresolved material conflict',
              passed: true,
              detail: 'No provider conflicts.',
              evidence: [],
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('passed')).toBeDefined();
    expect(screen.getByText('execution completed')).toBeDefined();
    expect(screen.getByText('No provider conflicts.')).toBeDefined();
  });

  it('marks failed checks', () => {
    render(
      <BrainVerificationPanel
        verification={{
          passed: false,
          checks: [
            {
              name: 'evidence policy',
              passed: false,
              detail: 'Evidence required but none available.',
              evidence: [],
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('gaps found')).toBeDefined();
    expect(screen.getByText('evidence policy')).toBeDefined();
  });
});

// ── Synthesis panel ──────────────────────────────────────────────────────────

describe('BrainSynthesisPanel', () => {
  it('renders claims with confidence and provider provenance', () => {
    render(
      <BrainSynthesisPanel
        synthesis={{
          claims: [
            {
              claim: 'AI productivity tools save time when used deliberately.',
              providers: ['openai'],
              evidence: ['Provider benchmark suite 2026'],
              confidence: 0.85,
              conflictStatus: 'AGREEMENT',
            },
          ],
          summary: 'A balanced synthesis of the researched claims.',
          providerCount: 1,
          unresolvedConflicts: [],
        }}
      />,
    );
    expect(screen.getByText('Synthesized result')).toBeDefined();
    expect(screen.getByText(/AI productivity tools save time/)).toBeDefined();
    expect(screen.getByText('85%')).toBeDefined();
    expect(screen.getByText(/openai/)).toBeDefined();
  });

  it('renders unresolved conflicts honestly', () => {
    render(
      <BrainSynthesisPanel
        synthesis={{
          claims: [],
          summary: '',
          providerCount: 2,
          unresolvedConflicts: [
            {
              topic: 'pricing',
              classification: 'UNRESOLVED',
              providers: ['a', 'b'],
              disagreement: 'Free tier differs',
              evidence: [],
              confidence: 0.4,
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Unresolved conflicts')).toBeDefined();
    expect(screen.getByText(/Free tier differs/)).toBeDefined();
  });
});

// ── Outputs panel ────────────────────────────────────────────────────────────

describe('BrainOutputsPanel', () => {
  it('renders recorded provider outputs with role and capability', () => {
    render(<BrainOutputsPanel task={makeTask()} />);
    expect(screen.getByText('openai')).toBeDefined();
    expect(screen.getByText(/The draft covers AI productivity practices/)).toBeDefined();
  });

  it('renders an honest empty state', () => {
    render(<BrainOutputsPanel task={makeTask({ providerOutputs: [] })} />);
    expect(screen.getByText(/No provider outputs recorded yet/)).toBeDefined();
  });
});

// ── Decision records ─────────────────────────────────────────────────────────

describe('BrainDecisionRecordsPanel', () => {
  it('renders an honest empty state', () => {
    render(<BrainDecisionRecordsPanel records={[]} />);
    expect(screen.getByText(/No decisions recorded yet/)).toBeDefined();
  });

  it('explains the decision: reason, selected, alternatives, provenance', () => {
    render(<BrainDecisionRecordsPanel records={makeTask().decisionRecords} />);
    expect(screen.getByText('provider roles')).toBeDefined();
    expect(screen.getByText(/brain-role-assigner/)).toBeDefined();
    // Open the accordion to see the explanation body.
    fireEvent.click(screen.getByText('provider roles'));
    expect(screen.getByText(/Assigned roles to 1 provider/)).toBeDefined();
    expect(screen.getByText(/1-provider role assignment/)).toBeDefined();
    expect(screen.getByText(/single provider · n-provider roles/)).toBeDefined();
    expect(screen.getByText('70%')).toBeDefined();
  });
});
