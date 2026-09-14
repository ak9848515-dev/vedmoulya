// Goal understanding — analyzes an objective to extract requirements
import type { GoalUnderstandingPort } from '../contracts/mission-ports.js';
import type { MissionConstraints } from '../types/mission-types.js';
import type { FailureContext } from './failure-context.js';

export class SimpleGoalUnderstanding implements GoalUnderstandingPort {
  // eslint-disable-next-line @typescript-eslint/require-await
  async understandGoal(
    objective: string,
    _missionContext: string,
    constraints: MissionConstraints,
    failureContext?: FailureContext,
  ): Promise<{
    goal: string;
    requiredCapabilities: string[];
    constraints: string[];
    estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  }> {
    const lowerObjective = objective.toLowerCase();
    const capabilities: string[] = [];

    if (
      lowerObjective.includes('code') ||
      lowerObjective.includes('implement') ||
      lowerObjective.includes('build')
    ) {
      capabilities.push('coding');
    }
    if (
      lowerObjective.includes('test') ||
      lowerObjective.includes('verify') ||
      lowerObjective.includes('validate')
    ) {
      capabilities.push('testing');
    }
    if (lowerObjective.includes('deploy') || lowerObjective.includes('release')) {
      capabilities.push('deployment');
    }
    if (lowerObjective.includes('document') || lowerObjective.includes('write docs')) {
      capabilities.push('documentation');
    }
    if (lowerObjective.includes('refactor') || lowerObjective.includes('restructure')) {
      capabilities.push('refactoring');
    }
    if (
      lowerObjective.includes('debug') ||
      lowerObjective.includes('fix') ||
      lowerObjective.includes('repair')
    ) {
      capabilities.push('debugging');
    }
    if (
      lowerObjective.includes('research') ||
      lowerObjective.includes('investigate') ||
      lowerObjective.includes('analyze')
    ) {
      capabilities.push('research');
    }

    const constraintList: string[] = [];
    if (constraints.allowedCapabilities) {
      constraintList.push(`Allowed capabilities: ${constraints.allowedCapabilities.join(', ')}`);
    }
    if (constraints.allowedTools) {
      constraintList.push(`Allowed tools: ${constraints.allowedTools.join(', ')}`);
    }
    if (constraints.deniedTools) {
      constraintList.push(`Denied tools: ${constraints.deniedTools.join(', ')}`);
    }

    // AUTONOMY-02 — Incorporate failure context into constraints
    if (failureContext) {
      // Add failure context as a constraint so the planner is aware
      constraintList.push(`Previous attempt failed: ${failureContext.reason}`);

      if (failureContext.evidence.length > 0) {
        constraintList.push(`Failure evidence: ${failureContext.evidence.slice(0, 3).join('; ')}`);
      }

      if (failureContext.executionError) {
        constraintList.push(`Previous error: ${failureContext.executionError}`);
      }

      // Suggest capability adjustments based on failure
      if (failureContext.failureClass === 'VERIFICATION_FAILURE') {
        constraintList.push('MUST include explicit verification criteria in the plan');
      }
    }

    let estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (
      capabilities.length > 3 ||
      lowerObjective.includes('refactor') ||
      lowerObjective.includes('restructure')
    ) {
      estimatedComplexity = 'HIGH';
    } else if (
      capabilities.length <= 1 &&
      (lowerObjective.includes('update') || lowerObjective.includes('fix'))
    ) {
      estimatedComplexity = 'LOW';
    }

    // AUTONOMY-02 — Adjust goal based on failure context
    let adjustedGoal = objective;
    if (failureContext && failureContext.suggestedAction === 'REVISE_OBJECTIVE') {
      // The goal understanding can suggest adjustments based on failure
      // but the original objective remains the authority
      adjustedGoal = objective; // Keep original as base, planner will interpret with context
    }

    return {
      goal: adjustedGoal,
      requiredCapabilities: capabilities,
      constraints: constraintList,
      estimatedComplexity,
    };
  }
}
