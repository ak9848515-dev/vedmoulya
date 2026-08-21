// ──────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Ecosystem Workflow Execution Router
// SPRINT-052 — Live Workflow Execution + Human Approval Certification
//
// Exposes the WorkflowExecutionService through tRPC procedures.
// Owner-scoped, auth-enforced, rate-limited.
// ──────────────────────────────────────────────────────────────────

import type { WorkflowExecutionService } from '@vedmoulya/ecosystem';

export interface EcosystemWorkflowHandlers {
  start: (input: unknown, ctx: { userId: string }) => Promise<unknown>;
  get: (input: unknown, ctx: { userId: string }) => Promise<unknown>;
  list: (input: unknown, ctx: { userId: string }) => Promise<unknown>;
  approve: (input: unknown, ctx: { userId: string }) => Promise<unknown>;
  reject: (input: unknown, ctx: { userId: string }) => Promise<unknown>;
  pause: (input: unknown, ctx: { userId: string }) => Promise<unknown>;
  resume: (input: unknown, ctx: { userId: string }) => Promise<unknown>;
  cancel: (input: unknown, ctx: { userId: string }) => Promise<unknown>;
  listWorkflows: (input: unknown, ctx: { userId: string }) => Promise<unknown>;
  getWorkflow: (input: unknown, ctx: { userId: string }) => Promise<unknown>;
}

export function createEcosystemWorkflowRouter(
  service: WorkflowExecutionService,
): EcosystemWorkflowHandlers {
  return {
    start: async (input: unknown, ctx: { userId: string }): Promise<unknown> => {
      const { workflowId } = input as { workflowId: string };
      return service.start({ workflowId, ownerId: ctx.userId });
    },

    get: (input: unknown, ctx: { userId: string }): Promise<unknown> => {
      const { executionId } = input as { executionId: string };
      return Promise.resolve(service.get(executionId, ctx.userId));
    },

    list: (_input: unknown, ctx: { userId: string }): Promise<unknown> => {
      return Promise.resolve(service.list(ctx.userId));
    },

    approve: async (input: unknown, ctx: { userId: string }): Promise<unknown> => {
      const { executionId, stepId, note } = input as {
        executionId: string;
        stepId: string;
        note?: string;
      };
      return service.approve(executionId, ctx.userId, stepId, note);
    },

    reject: (input: unknown, ctx: { userId: string }): Promise<unknown> => {
      const { executionId, stepId, note } = input as {
        executionId: string;
        stepId: string;
        note?: string;
      };
      return Promise.resolve(service.reject(executionId, ctx.userId, stepId, note));
    },

    pause: (input: unknown, ctx: { userId: string }): Promise<unknown> => {
      const { executionId } = input as { executionId: string };
      return Promise.resolve(service.pause(executionId, ctx.userId));
    },

    resume: (input: unknown, ctx: { userId: string }): Promise<unknown> => {
      const { executionId } = input as { executionId: string };
      return Promise.resolve(service.resume(executionId, ctx.userId));
    },

    cancel: (input: unknown, ctx: { userId: string }): Promise<unknown> => {
      const { executionId } = input as { executionId: string };
      return Promise.resolve(service.cancel(executionId, ctx.userId));
    },

    listWorkflows: (_input: unknown, _ctx: { userId: string }): Promise<unknown> => {
      // Return the certification workflow catalog
      return Promise.resolve({
        success: true,
        data: [
          {
            id: 'certification-knowledge-summary',
            name: 'Personal Knowledge Summary',
            outcome: 'Produce a grounded summary from user-supplied text',
            steps: 4,
            approvalGates: 1,
            riskLevel: 'MEDIUM',
            status: 'ACTIVE',
          },
          {
            id: 'multi-agent-research-summary',
            name: 'Opportunity Research & Summary',
            outcome: 'Multi-agent research, analysis, and summary of a topic',
            steps: 5,
            approvalGates: 1,
            riskLevel: 'MEDIUM',
            status: 'ACTIVE',
            agents: ['Research Agent', 'Analysis Agent', 'Summary Agent', 'Verification Agent'],
          },
          {
            id: 'career-freelance-intelligence',
            name: 'AI Career & Freelance Intelligence',
            outcome: 'Identify the best realistic opportunities and prepare actionable next steps',
            steps: 7,
            approvalGates: 1,
            riskLevel: 'MEDIUM',
            status: 'ACTIVE',
            agents: [
              'Research Agent',
              'Match Agent',
              'Ranking Agent',
              'Proposal Agent',
              'Verification Agent',
            ],
          },
        ],
      });
    },

    getWorkflow: (input: unknown, _ctx: { userId: string }): Promise<unknown> => {
      const { workflowId } = input as { workflowId: string };
      if (workflowId === 'certification-knowledge-summary') {
        return Promise.resolve({
          success: true,
          data: {
            id: 'certification-knowledge-summary',
            name: 'Personal Knowledge Summary',
            outcome: 'Produce a grounded summary from user-supplied text',
            steps: [
              {
                id: 'step-collect',
                title: 'Collect Content',
                purpose: 'Read and validate the supplied text content',
                riskLevel: 'LOW',
                approvalPolicy: 'AUTO',
              },
              {
                id: 'step-analyze',
                title: 'AI Analysis',
                purpose: 'Analyze the content and produce a structured summary',
                riskLevel: 'LOW',
                approvalPolicy: 'AUTO',
              },
              {
                id: 'step-approval',
                title: 'Review Summary',
                purpose: 'The AI has prepared a summary. Continue to final verification?',
                riskLevel: 'MEDIUM',
                approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
              },
              {
                id: 'step-verify',
                title: 'Final Verification',
                purpose: 'Verify the summary is complete and present the final result',
                riskLevel: 'LOW',
                approvalPolicy: 'AUTO',
              },
            ],
            approvalGates: ['step-approval'],
            riskLevel: 'MEDIUM',
          },
        });
      }
      if (workflowId === 'multi-agent-research-summary') {
        return Promise.resolve({
          success: true,
          data: {
            id: 'multi-agent-research-summary',
            name: 'Opportunity Research & Summary',
            outcome: 'Multi-agent research, analysis, and summary of a topic',
            steps: [
              {
                id: 'step-research',
                title: 'Research',
                purpose: 'Gather relevant information and research findings',
                riskLevel: 'LOW',
                approvalPolicy: 'AUTO',
                agent: 'Research Agent',
              },
              {
                id: 'step-analysis',
                title: 'Analysis',
                purpose: 'Analyze the research findings and extract key insights',
                riskLevel: 'LOW',
                approvalPolicy: 'AUTO',
                agent: 'Analysis Agent',
              },
              {
                id: 'step-summary',
                title: 'Summary',
                purpose: 'Produce a concise, well-structured summary',
                riskLevel: 'LOW',
                approvalPolicy: 'AUTO',
                agent: 'Summary Agent',
              },
              {
                id: 'step-multi-approval',
                title: 'Review Findings',
                purpose: 'The agents have prepared findings. Continue to verification?',
                riskLevel: 'MEDIUM',
                approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
              },
              {
                id: 'step-multi-verify',
                title: 'Final Verification',
                purpose: 'Verify the summary is complete and present the final result',
                riskLevel: 'LOW',
                approvalPolicy: 'AUTO',
                agent: 'Verification Agent',
              },
            ],
            approvalGates: ['step-multi-approval'],
            riskLevel: 'MEDIUM',
            agents: ['Research Agent', 'Analysis Agent', 'Summary Agent', 'Verification Agent'],
          },
        });
      }
      if (workflowId === 'career-freelance-intelligence') {
        return Promise.resolve({
          success: true,
          data: {
            id: 'career-freelance-intelligence',
            name: 'AI Career & Freelance Intelligence',
            outcome: 'Identify the best realistic opportunities and prepare actionable next steps',
            steps: [
              {
                id: 'step-career-research',
                title: 'Opportunity Research',
                purpose: 'Discover relevant career and freelance opportunities',
                riskLevel: 'LOW',
                approvalPolicy: 'AUTO',
                agent: 'Research Agent',
              },
              {
                id: 'step-career-match',
                title: 'Career Matching',
                purpose: 'Compare opportunities against user profile and goals',
                riskLevel: 'LOW',
                approvalPolicy: 'AUTO',
                agent: 'Match Agent',
              },
              {
                id: 'step-career-rank',
                title: 'Opportunity Ranking',
                purpose: 'Rank opportunities using transparent criteria',
                riskLevel: 'LOW',
                approvalPolicy: 'AUTO',
                agent: 'Ranking Agent',
              },
              {
                id: 'step-career-proposal',
                title: 'Proposal Preparation',
                purpose: 'Prepare draft proposal for top opportunity',
                riskLevel: 'MEDIUM',
                approvalPolicy: 'AUTO',
                agent: 'Proposal Agent',
              },
              {
                id: 'step-career-approval',
                title: 'Founder Review',
                purpose: 'Review findings before final verification',
                riskLevel: 'MEDIUM',
                approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
              },
              {
                id: 'step-career-verify',
                title: 'Verification',
                purpose: 'Verify proposal has no fabricated claims',
                riskLevel: 'LOW',
                approvalPolicy: 'AUTO',
                agent: 'Verification Agent',
              },
              {
                id: 'step-career-summarize',
                title: 'Final Summary',
                purpose: 'Produce actionable summary for the founder',
                riskLevel: 'LOW',
                approvalPolicy: 'AUTO',
                agent: 'Proposal Agent',
              },
            ],
            approvalGates: ['step-career-approval'],
            riskLevel: 'MEDIUM',
            agents: [
              'Research Agent',
              'Match Agent',
              'Ranking Agent',
              'Proposal Agent',
              'Verification Agent',
            ],
          },
        });
      }
      return Promise.resolve({ success: false, error: `Workflow not found: ${workflowId}` });
    },
  };
}
