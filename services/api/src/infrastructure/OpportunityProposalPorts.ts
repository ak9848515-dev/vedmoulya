// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · S7.1 — Bid/proposal DRAFT port (preparation only, human-approved)
//
// The draft is the LAST thing VedMoulya may produce before a human takes over.
// This port therefore has NO submission method: its result type literally
// cannot express "sent", and no implementation of it can reach the external
// source's (nonexistent) write capability.
//
// It creates NO provider layer. The draft is produced by the EXISTING
// `AIOrchestrationService` — the same service the EXISTING
// `ClientOpsAIService.generateProposal` uses — reached through this narrow seam
// so the acquisition router never holds a provider registry. When no
// orchestrator is configured the port returns an HONEST failure
// (`PROPOSAL_DRAFT_UNAVAILABLE`); it never fabricates a draft and never falls
// back to a template pretending to be a model output.
//
// HONESTY RULE — pricing. A draft may only reference a budget the SOURCE
// itself stated. When the source stated none, the prompt requires the draft to
// leave pricing as an explicit question for the human. The port never invents a
// bid amount.
// ─────────────────────────────────────────────────────────────────────────────

/** Everything the draft may be built from. All of it is canonical record data. */
export interface OpportunityProposalContext {
  opportunityId: string;
  title: string;
  description: string;
  category?: string;
  /** Capabilities the SOURCE stated the work needs. */
  requiredCapabilities?: string[];
  /** The canonical evidence lines already stored on the record. */
  evidence?: string[];
  /** The source's stated value label, with its evidence status. Never a guess. */
  estimatedValue?: { label: string; status: string };
  estimatedEffort?: { label: string; status: string };
  riskLevel?: string;
}

export interface OpportunityProposalDraft {
  /** Markdown the human reviews and MAY EDIT before any external action. */
  document: string;
  provider?: string;
  model?: string;
  generatedAt: string;
  /** Structural: an external action ALWAYS still requires the human. */
  authorizationRequired: true;
  /** Structural: this layer never submits. There is no code path that can. */
  submitted: false;
}

export type OpportunityProposalResult =
  | { success: true; data: OpportunityProposalDraft }
  | { success: false; code: string; message: string };

export interface OpportunityProposalPort {
  draft(input: {
    userId: string;
    opportunity: OpportunityProposalContext;
  }): Promise<OpportunityProposalResult>;
}

/** The narrow slice of the EXISTING AI orchestration this port consumes. */
export interface OpportunityProposalOrchestrator {
  orchestrate(request: {
    capability: 'content_generation';
    userInput: string;
    userId?: string;
    qualityTier: 'premium' | 'standard' | 'economy' | 'free';
    constraints?: {
      maxOutputTokens?: number;
      outputFormat?: 'text' | 'json' | 'markdown' | 'code';
    };
    context?: { systemPrompt?: string; identityContext?: string };
  }): Promise<{ content: string; provider?: string; model?: string }>;
}

/** Fixed policy — never a caller-supplied prompt. */
const PROPOSAL_SYSTEM_PROMPT = [
  'You are preparing a DRAFT proposal for a freelance opportunity on behalf of a freelancer.',
  'The draft is a PREPARATION artifact for a human: it will be reviewed, edited and submitted MANUALLY.',
  '',
  'RULES (non-negotiable):',
  '1. Output Markdown only. No preamble, no commentary about these rules.',
  '2. NEVER claim the proposal has been sent, submitted, posted or agreed.',
  '3. NEVER negotiate, contact the client or offer to accept the work.',
  '4. Pricing: include a "Pricing" section. If the client stated a budget, reference it as the',
  '   CLIENT-STATED budget and propose how to position against it. If NO budget was stated, you MUST',
  '   ask the human to set the price — never invent an amount or an hourly rate.',
  '5. Do not invent credentials, past clients, certifications, metrics or delivery guarantees that',
  '   are not present in the supplied information. Missing information becomes a question.',
  '',
  'Structure: Understanding of the requirement, Proposed approach, Milestones, Capabilities applied,',
  'Assumptions & open questions, Pricing.',
].join('\n');

/** Compose the draft prompt from canonical record data only. */
export function buildProposalUserInput(context: OpportunityProposalContext): string {
  const budget = context.estimatedValue
    ? `${context.estimatedValue.label} (evidence status: ${context.estimatedValue.status}, as stated by the source)`
    : 'NOT STATED BY THE SOURCE — ask the human to set the price.';
  return [
    `Opportunity title: ${context.title}`,
    `Requirement description: ${context.description}`,
    context.category !== undefined ? `Category: ${context.category}` : '',
    context.requiredCapabilities !== undefined && context.requiredCapabilities.length > 0
      ? `Required capabilities (stated by the source): ${context.requiredCapabilities.join(', ')}`
      : 'Required capabilities: not stated by the source.',
    `Client-stated budget: ${budget}`,
    context.estimatedEffort !== undefined
      ? `Source-stated effort: ${context.estimatedEffort.label} (${context.estimatedEffort.status})`
      : '',
    context.riskLevel !== undefined ? `Canonical risk level: ${context.riskLevel}` : '',
    context.evidence !== undefined && context.evidence.length > 0
      ? `Canonical evidence: ${context.evidence.join(' | ')}`
      : '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * Create the draft port. Absent an orchestrator, every call returns an honest
 * `PROPOSAL_DRAFT_UNAVAILABLE` — a deployment without AI configured shows
 * "draft unavailable", never a fake proposal.
 */
export function createOpportunityProposalPort(
  orchestrator?: OpportunityProposalOrchestrator,
): OpportunityProposalPort {
  return {
    async draft({ userId, opportunity }): Promise<OpportunityProposalResult> {
      if (orchestrator === undefined) {
        return {
          success: false,
          code: 'PROPOSAL_DRAFT_UNAVAILABLE',
          message:
            'No AI orchestrator is configured, so no proposal draft can be generated. A human may still write the proposal manually.',
        };
      }
      try {
        const response = await orchestrator.orchestrate({
          capability: 'content_generation',
          userInput: buildProposalUserInput(opportunity),
          userId,
          qualityTier: 'standard',
          constraints: { outputFormat: 'markdown', maxOutputTokens: 2000 },
          context: {
            systemPrompt: PROPOSAL_SYSTEM_PROMPT,
            identityContext: 'VedMoulya opportunity proposal preparation',
          },
        });
        const document = typeof response.content === 'string' ? response.content.trim() : '';
        if (document === '') {
          // An empty generation is a failure, never a deliverable draft.
          return {
            success: false,
            code: 'PROPOSAL_DRAFT_FAILED',
            message: 'The AI orchestrator returned an empty draft.',
          };
        }
        return {
          success: true,
          data: {
            document,
            ...(response.provider !== undefined ? { provider: response.provider } : {}),
            ...(response.model !== undefined ? { model: response.model } : {}),
            generatedAt: new Date().toISOString(),
            authorizationRequired: true,
            submitted: false,
          },
        };
      } catch (error) {
        return {
          success: false,
          code: 'PROPOSAL_DRAFT_FAILED',
          message: error instanceof Error ? error.message : 'Proposal draft generation failed.',
        };
      }
    },
  };
}
