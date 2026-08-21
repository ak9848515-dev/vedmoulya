// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem: Career Intelligence Workflow
// SPRINT-054 — AI Career & Freelance Intelligence Workflow
//
// A multi-agent workflow for career/freelance opportunity intelligence.
// 5 agents, 7 steps, 1 approval gate.
// No external actions, no applications submitted, no emails sent.
// ──────────────────────────────────────────────────────────────────

import type { WorkflowStep } from '../types/ecosystem-types.js';

// ── Career Intelligence Workflow Steps ─────────────────────────────

export const STEP_CAREER_RESEARCH: WorkflowStep = {
  id: 'step-career-research',
  title: 'Opportunity Research',
  purpose:
    'Discover relevant career and freelance opportunities based on the user profile and goals. Research legitimate sources and report honestly when live search is unavailable.',
  requiredCapabilities: ['reasoning'],
  agentIds: ['career-research-agent'],
  allowedTools: ['echo', 'current_time'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  automationLevel: 'FULLY_AUTOMATED',
  dependencies: [],
  verificationRequirements: [
    'Output contains at least one opportunity or honest UNAVAILABLE status',
  ],
};

export const STEP_CAREER_MATCH: WorkflowStep = {
  id: 'step-career-match',
  title: 'Career Matching',
  purpose:
    'Compare discovered opportunities against the user profile: skill match, experience match, goal alignment, work mode alignment. Mark unknown information honestly.',
  requiredCapabilities: ['reasoning'],
  agentIds: ['career-match-agent'],
  allowedTools: ['echo'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  automationLevel: 'FULLY_AUTOMATED',
  dependencies: ['step-career-research'],
  verificationRequirements: ['Output contains match analysis for each opportunity'],
};

export const STEP_CAREER_RANK: WorkflowStep = {
  id: 'step-career-rank',
  title: 'Opportunity Ranking',
  purpose:
    'Rank matched opportunities using transparent criteria: fit, goal alignment, realism, learning value, evidence confidence. Provide human-readable rationale for each rank.',
  requiredCapabilities: ['reasoning'],
  agentIds: ['career-ranking-agent'],
  allowedTools: ['echo'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  automationLevel: 'FULLY_AUTOMATED',
  dependencies: ['step-career-match'],
  verificationRequirements: ['Output contains ranked list with rationale'],
};

export const STEP_CAREER_PROPOSAL: WorkflowStep = {
  id: 'step-career-proposal',
  title: 'Proposal Preparation',
  purpose:
    'Prepare a draft proposal for the top-ranked opportunity. Include: opportunity summary, why the founder fits, skill gaps, proposed positioning, questions to ask, risk flags. Never fabricate experience.',
  requiredCapabilities: ['content_generation'],
  agentIds: ['career-proposal-agent'],
  allowedTools: ['echo'],
  riskLevel: 'MEDIUM',
  approvalPolicy: 'AUTO',
  automationLevel: 'FULLY_AUTOMATED',
  dependencies: ['step-career-rank'],
  verificationRequirements: ['Output contains proposal draft with no fabricated claims'],
};

export const STEP_CAREER_APPROVAL: WorkflowStep = {
  id: 'step-career-approval',
  title: 'Founder Review',
  purpose:
    'The career intelligence workflow has prepared opportunities and a proposal. Review the findings before final verification. This approval does NOT authorize any external submission.',
  requiredCapabilities: [],
  agentIds: [],
  allowedTools: [],
  riskLevel: 'MEDIUM',
  approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
  automationLevel: 'HUMAN_APPROVAL',
  dependencies: ['step-career-proposal'],
  verificationRequirements: [],
};

export const STEP_CAREER_VERIFY: WorkflowStep = {
  id: 'step-career-verify',
  title: 'Verification',
  purpose:
    'Verify the proposal: check that no experience is fabricated, no qualifications are invented, no unsupported claims are made, missing data is clearly marked, and ranking rationale is consistent.',
  requiredCapabilities: ['reasoning'],
  agentIds: ['career-verification-agent'],
  allowedTools: ['echo'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  automationLevel: 'FULLY_AUTOMATED',
  dependencies: ['step-career-approval'],
  verificationRequirements: ['Output contains verification result with no fabricated claims'],
};

export const STEP_CAREER_SUMMARIZE: WorkflowStep = {
  id: 'step-career-summarize',
  title: 'Final Summary',
  purpose:
    'Produce the final career intelligence summary: top opportunities, recommended next step, evidence, risks, skill gaps. This is the actionable result for the founder.',
  requiredCapabilities: ['content_generation'],
  agentIds: ['career-proposal-agent'],
  allowedTools: ['echo'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  automationLevel: 'FULLY_AUTOMATED',
  dependencies: ['step-career-verify'],
  verificationRequirements: ['Output contains actionable summary'],
};

/** All career intelligence workflow steps. */
export const CAREER_INTELLIGENCE_STEPS: WorkflowStep[] = [
  STEP_CAREER_RESEARCH,
  STEP_CAREER_MATCH,
  STEP_CAREER_RANK,
  STEP_CAREER_PROPOSAL,
  STEP_CAREER_APPROVAL,
  STEP_CAREER_VERIFY,
  STEP_CAREER_SUMMARIZE,
];

/** The career intelligence workflow definition. */
export const CAREER_INTELLIGENCE_WORKFLOW = {
  id: 'career-freelance-intelligence',
  name: 'AI Career & Freelance Intelligence',
  outcome:
    'Identify the best realistic opportunities for the founder and prepare actionable next steps',
  steps: CAREER_INTELLIGENCE_STEPS,
  riskLevel: 'MEDIUM' as const,
  approvalPolicy: 'HUMAN_APPROVAL_REQUIRED' as const,
  privacyClass: 'PUBLIC' as const,
  completionCriteria: [
    'Opportunities discovered (or honest UNAVAILABLE status)',
    'Opportunities matched against profile',
    'Opportunities ranked with rationale',
    'Proposal prepared for top opportunity',
    'Founder reviewed and approved findings',
    'Verification passed — no fabricated claims',
    'Actionable summary produced',
  ],
  approvalGates: ['step-career-approval'],
  status: 'ACTIVE' as const,
  tags: ['career', 'freelance', 'intelligence', 'certification', 'safe'],
  owner: 'system',
};
