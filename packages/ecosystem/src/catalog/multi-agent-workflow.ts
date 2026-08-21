// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem: Multi-Agent Certification Workflow
// SPRINT-053 — Multi-Agent Orchestration Foundation
//
// A safe multi-agent workflow for certification testing.
// "Opportunity Research & Summary" — 4 specialized agents in sequence.
// No external actions, no irreversible operations.
// ──────────────────────────────────────────────────────────────────

import type { AgentDefinition, WorkflowStep } from '../types/ecosystem-types.js';

// ── Multi-Agent Certification Agents ───────────────────────────────

export const RESEARCH_AGENT: AgentDefinition = {
  id: 'research-agent',
  name: 'Research Agent',
  purpose: 'Gathers information and research findings from available sources',
  requiredCapabilities: ['reasoning'],
  allowedTools: ['echo', 'current_time'],
  preferredProviders: ['openai', 'anthropic', 'google', 'mock'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  privacyClass: 'PUBLIC',
  pricingModel: 'FREE',
  status: 'available',
  tags: ['certification', 'research', 'safe'],
  owner: 'system',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const ANALYSIS_AGENT: AgentDefinition = {
  id: 'analysis-agent',
  name: 'Analysis Agent',
  purpose: 'Analyzes research findings and extracts key insights and patterns',
  requiredCapabilities: ['reasoning'],
  allowedTools: ['calculator', 'echo'],
  preferredProviders: ['openai', 'anthropic', 'google', 'mock'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  privacyClass: 'PUBLIC',
  pricingModel: 'FREE',
  status: 'available',
  tags: ['certification', 'analysis', 'safe'],
  owner: 'system',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const SUMMARY_AGENT: AgentDefinition = {
  id: 'summary-agent',
  name: 'Summary Agent',
  purpose: 'Produces a concise, well-structured summary of analyzed findings',
  requiredCapabilities: ['content_generation'],
  allowedTools: ['echo'],
  preferredProviders: ['openai', 'anthropic', 'google', 'mock'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  privacyClass: 'PUBLIC',
  pricingModel: 'FREE',
  status: 'available',
  tags: ['certification', 'summary', 'safe'],
  owner: 'system',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const VERIFICATION_AGENT: AgentDefinition = {
  id: 'verification-agent',
  name: 'Verification Agent',
  purpose: 'Verifies the summary is complete, accurate, and grounded in evidence',
  requiredCapabilities: ['reasoning'],
  allowedTools: ['echo'],
  preferredProviders: ['openai', 'anthropic', 'google', 'mock'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  privacyClass: 'PUBLIC',
  pricingModel: 'FREE',
  status: 'available',
  tags: ['certification', 'verification', 'safe'],
  owner: 'system',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MULTI_AGENT_AGENTS: AgentDefinition[] = [
  RESEARCH_AGENT,
  ANALYSIS_AGENT,
  SUMMARY_AGENT,
  VERIFICATION_AGENT,
];

// ── Multi-Agent Workflow Steps ─────────────────────────────────────

export const STEP_RESEARCH: WorkflowStep = {
  id: 'step-research',
  title: 'Research',
  purpose: 'Gather relevant information and research findings about the topic.',
  requiredCapabilities: ['reasoning'],
  agentIds: ['research-agent'],
  allowedTools: ['echo', 'current_time'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  automationLevel: 'FULLY_AUTOMATED',
  dependencies: [],
  verificationRequirements: ['Output is non-empty'],
};

export const STEP_ANALYSIS: WorkflowStep = {
  id: 'step-analysis',
  title: 'Analysis',
  purpose: 'Analyze the research findings and extract key insights and patterns.',
  requiredCapabilities: ['reasoning'],
  agentIds: ['analysis-agent'],
  allowedTools: ['calculator', 'echo'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  automationLevel: 'FULLY_AUTOMATED',
  dependencies: ['step-research'],
  verificationRequirements: ['Output contains analysis'],
};

export const STEP_SUMMARY: WorkflowStep = {
  id: 'step-summary',
  title: 'Summary',
  purpose: 'Produce a concise, well-structured summary of the analyzed findings.',
  requiredCapabilities: ['content_generation'],
  agentIds: ['summary-agent'],
  allowedTools: ['echo'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  automationLevel: 'FULLY_AUTOMATED',
  dependencies: ['step-analysis'],
  verificationRequirements: ['Output is non-empty'],
};

export const STEP_MULTI_APPROVAL: WorkflowStep = {
  id: 'step-multi-approval',
  title: 'Review Findings',
  purpose: 'The agents have prepared research findings. Continue to verification?',
  requiredCapabilities: [],
  agentIds: [],
  allowedTools: [],
  riskLevel: 'MEDIUM',
  approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
  automationLevel: 'HUMAN_APPROVAL',
  dependencies: ['step-summary'],
  verificationRequirements: [],
};

export const STEP_MULTI_VERIFY: WorkflowStep = {
  id: 'step-multi-verify',
  title: 'Final Verification',
  purpose: 'Verify the summary is complete and present the final result.',
  requiredCapabilities: ['reasoning'],
  agentIds: ['verification-agent'],
  allowedTools: ['echo'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  automationLevel: 'FULLY_AUTOMATED',
  dependencies: ['step-multi-approval'],
  verificationRequirements: ['Output is non-empty', 'Output contains verification'],
};

export const MULTI_AGENT_STEPS: WorkflowStep[] = [
  STEP_RESEARCH,
  STEP_ANALYSIS,
  STEP_SUMMARY,
  STEP_MULTI_APPROVAL,
  STEP_MULTI_VERIFY,
];

// ── Multi-Agent Workflow Definition ────────────────────────────────

export const MULTI_AGENT_WORKFLOW = {
  id: 'multi-agent-research-summary',
  name: 'Opportunity Research & Summary',
  outcome: 'Multi-agent research, analysis, and summary of a topic',
  steps: MULTI_AGENT_STEPS,
  riskLevel: 'MEDIUM' as const,
  approvalPolicy: 'HUMAN_APPROVAL_REQUIRED' as const,
  privacyClass: 'PUBLIC' as const,
  completionCriteria: [
    'Research findings are non-empty',
    'Analysis contains key insights',
    'Summary is well-structured',
    'Verification confirms completeness',
  ],
  approvalGates: ['step-multi-approval'],
  status: 'ACTIVE' as const,
  tags: ['certification', 'multi-agent', 'research', 'safe'],
  owner: 'system',
};
