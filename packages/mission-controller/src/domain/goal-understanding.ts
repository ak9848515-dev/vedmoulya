// Goal understanding — analyzes an objective to extract requirements
import type { GoalUnderstandingPort } from '../contracts/mission-ports.js';
import type { MissionConstraints } from '../types/mission-types.js';

export class SimpleGoalUnderstanding implements GoalUnderstandingPort {
  // eslint-disable-next-line @typescript-eslint/require-await
  async understandGoal(
    objective: string,
    _missionContext: string,
    constraints: MissionConstraints,
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

    return {
      goal: objective,
      requiredCapabilities: capabilities,
      constraints: constraintList,
      estimatedComplexity,
    };
  }
}
