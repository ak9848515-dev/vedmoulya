// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem: Certification Workflow Catalog
// SPRINT-052 — Live Workflow Execution + Human Approval Certification
//
// A safe, harmless workflow for certification testing.
// "Personal Knowledge Summary" — produces a grounded summary from
// user-supplied text. No external actions, no irreversible operations.
// ──────────────────────────────────────────────────────────────────

import type { WorkflowStep, AgentDefinition } from '../types/ecosystem-types.js';

// ── Certification Agent ────────────────────────────────────────────

export const CERTIFICATION_AGENT: AgentDefinition = {
  id: 'certification-agent',
  name: 'Certification Agent',
  purpose: 'Safe agent for workflow execution certification testing',
  requiredCapabilities: ['content_generation', 'reasoning'],
  allowedTools: ['echo', 'current_time', 'calculator'],
  preferredProviders: ['openai', 'anthropic', 'google', 'mock'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  privacyClass: 'PUBLIC',
  pricingModel: 'FREE',
  status: 'available',
  tags: ['certification', 'safe', 'test'],
  owner: 'system',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Certification Workflow Steps ───────────────────────────────────

/** Step 1: Read/collect supplied content */
export const STEP_COLLECT: WorkflowStep = {
  id: 'step-collect',
  title: 'Collect Content',
  purpose: 'Read and validate the supplied text content for summarization.',
  requiredCapabilities: ['content_generation'],
  agentIds: ['certification-agent'],
  allowedTools: [],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  automationLevel: 'FULLY_AUTOMATED',
  dependencies: [],
  verificationRequirements: ['Output is non-empty'],
};

/** Step 2: Analyze/summarize using AI capability */
export const STEP_ANALYZE: WorkflowStep = {
  id: 'step-analyze',
  title: 'AI Analysis',
  purpose: 'Analyze the content and produce a structured summary with key points.',
  requiredCapabilities: ['content_generation', 'reasoning'],
  agentIds: ['certification-agent'],
  allowedTools: [],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  automationLevel: 'FULLY_AUTOMATED',
  dependencies: ['step-collect'],
  verificationRequirements: ['Output contains at least one key point'],
};

/** Step 3: Approval gate — safe demonstration of human approval */
export const STEP_APPROVAL: WorkflowStep = {
  id: 'step-approval',
  title: 'Review Summary',
  purpose: 'The AI has prepared a summary. Continue to final verification?',
  requiredCapabilities: [],
  agentIds: ['certification-agent'],
  allowedTools: [],
  riskLevel: 'MEDIUM',
  approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
  automationLevel: 'HUMAN_APPROVAL',
  dependencies: ['step-analyze'],
  verificationRequirements: [],
};

/** Step 4: Verify and present the result */
export const STEP_VERIFY: WorkflowStep = {
  id: 'step-verify',
  title: 'Final Verification',
  purpose: 'Verify the summary is complete and present the final result.',
  requiredCapabilities: ['content_generation'],
  agentIds: ['certification-agent'],
  allowedTools: [],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  automationLevel: 'FULLY_AUTOMATED',
  dependencies: ['step-approval'],
  verificationRequirements: ['Output is non-empty', 'Output contains summary'],
};

/** All certification workflow steps */
export const CERTIFICATION_STEPS: WorkflowStep[] = [
  STEP_COLLECT,
  STEP_ANALYZE,
  STEP_APPROVAL,
  STEP_VERIFY,
];

// ── Certification Workflow Definition ───────────────────────────────

export const CERTIFICATION_WORKFLOW = {
  id: 'certification-knowledge-summary',
  name: 'Personal Knowledge Summary',
  outcome: 'Produce a grounded summary from user-supplied text',
  steps: CERTIFICATION_STEPS,
  riskLevel: 'MEDIUM' as const,
  approvalPolicy: 'HUMAN_APPROVAL_REQUIRED' as const,
  privacyClass: 'PUBLIC' as const,
  completionCriteria: [
    'Summary is non-empty',
    'Summary contains key points from the input',
    'Summary is grounded in the supplied content',
  ],
  approvalGates: ['step-approval'],
  status: 'ACTIVE' as const,
  tags: ['certification', 'safe', 'knowledge', 'summary'],
  owner: 'system',
};
