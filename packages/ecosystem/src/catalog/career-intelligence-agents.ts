// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem: Career Intelligence Agents
// SPRINT-054 — AI Career & Freelance Intelligence Workflow
//
// Five specialized agents for career/freelance opportunity intelligence.
// Each agent is an AgentDefinition — no new engines created.
// ──────────────────────────────────────────────────────────────────

import type { AgentDefinition } from '../types/ecosystem-types.js';

// ── 1. Opportunity Research Agent ──────────────────────────────────

const NOW = new Date().toISOString();

export const CAREER_RESEARCH_AGENT: AgentDefinition = {
  id: 'career-research-agent',
  name: 'Opportunity Research Agent',
  purpose:
    'Discovers relevant career and freelance opportunities using available research capabilities. Never fabricates opportunities — reports honestly when live search is unavailable.',
  requiredCapabilities: ['reasoning'],
  allowedTools: ['echo', 'current_time'],
  preferredProviders: ['openai', 'anthropic', 'google'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  privacyClass: 'PUBLIC',
  pricingModel: 'FREE',
  status: 'available',
  tags: ['career', 'research', 'safe', 'certification'],
  owner: 'system',
  createdAt: NOW,
  updatedAt: NOW,
};

// ── 2. Career Match Agent ──────────────────────────────────────────

export const CAREER_MATCH_AGENT: AgentDefinition = {
  id: 'career-match-agent',
  name: 'Career Match Agent',
  purpose:
    'Compares opportunities against the user profile, skills, experience, and goals. Marks unknown information honestly — never converts UNKNOWN into a positive or negative score without a defined rule.',
  requiredCapabilities: ['reasoning'],
  allowedTools: ['echo'],
  preferredProviders: ['openai', 'anthropic', 'google'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  privacyClass: 'PUBLIC',
  pricingModel: 'FREE',
  status: 'available',
  tags: ['career', 'matching', 'safe', 'certification'],
  owner: 'system',
  createdAt: NOW,
  updatedAt: NOW,
};

// ── 3. Opportunity Ranking Agent ───────────────────────────────────

export const CAREER_RANKING_AGENT: AgentDefinition = {
  id: 'career-ranking-agent',
  name: 'Opportunity Ranking Agent',
  purpose:
    'Ranks matched opportunities using transparent criteria: fit, goal alignment, realism, learning value, and evidence confidence. Every ranking includes a human-readable rationale.',
  requiredCapabilities: ['reasoning'],
  allowedTools: ['echo'],
  preferredProviders: ['openai', 'anthropic', 'google'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  privacyClass: 'PUBLIC',
  pricingModel: 'FREE',
  status: 'available',
  tags: ['career', 'ranking', 'safe', 'certification'],
  owner: 'system',
  createdAt: NOW,
  updatedAt: NOW,
};

// ── 4. Proposal Preparation Agent ──────────────────────────────────

export const CAREER_PROPOSAL_AGENT: AgentDefinition = {
  id: 'career-proposal-agent',
  name: 'Proposal Preparation Agent',
  purpose:
    'Prepares a draft proposal or application approach for the selected opportunity. Never fabricates experience — clearly marks skill gaps and missing information.',
  requiredCapabilities: ['content_generation'],
  allowedTools: ['echo'],
  preferredProviders: ['openai', 'anthropic', 'google'],
  riskLevel: 'MEDIUM',
  approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
  privacyClass: 'PUBLIC',
  pricingModel: 'FREE',
  status: 'available',
  tags: ['career', 'proposal', 'safe', 'certification'],
  owner: 'system',
  createdAt: NOW,
  updatedAt: NOW,
};

// ── 5. Verification Agent ──────────────────────────────────────────

export const CAREER_VERIFICATION_AGENT: AgentDefinition = {
  id: 'career-verification-agent',
  name: 'Verification Agent',
  purpose:
    'Verifies factual consistency of the proposal: checks that no experience is fabricated, no qualifications are invented, no unsupported claims are made, and missing data is clearly marked.',
  requiredCapabilities: ['reasoning'],
  allowedTools: ['echo'],
  preferredProviders: ['openai', 'anthropic', 'google'],
  riskLevel: 'LOW',
  approvalPolicy: 'AUTO',
  privacyClass: 'PUBLIC',
  pricingModel: 'FREE',
  status: 'available',
  tags: ['career', 'verification', 'safe', 'certification'],
  owner: 'system',
  createdAt: NOW,
  updatedAt: NOW,
};

/** All career intelligence agents. */
export const CAREER_INTELLIGENCE_AGENTS: AgentDefinition[] = [
  CAREER_RESEARCH_AGENT,
  CAREER_MATCH_AGENT,
  CAREER_RANKING_AGENT,
  CAREER_PROPOSAL_AGENT,
  CAREER_VERIFICATION_AGENT,
];
