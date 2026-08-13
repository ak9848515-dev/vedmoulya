// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Blueprint Service
// EPIC-007 — Phase 7. Assembles the ApplicationBlueprint — the source
// of truth for a generated application:
//   specification · architecture · taskGraph · technologies · files ·
//   dependencies · environment · database · APIs · tests · deployment ·
//   acceptanceCriteria
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import type {
  ApplicationArchitecture,
  ApplicationBlueprint,
  ApplicationSpecification,
  BlueprintFile,
  BlueprintTechnology,
  DeploymentTargetId,
} from '../types/app-types.js';
import type { ApplicationTaskGraph } from '../types/app-types.js';

export interface BlueprintBuildInput {
  specification: ApplicationSpecification;
  architecture: ApplicationArchitecture;
  taskGraph: ApplicationTaskGraph;
  /** Files the factory plans to generate (path + kind + producing phase). */
  plannedFiles: Array<{
    path: string;
    kind: BlueprintFile['kind'];
    purpose: string;
    producedBy: BlueprintFile['producedBy'];
  }>;
  deploymentTarget: DeploymentTargetId;
}

export class BlueprintService {
  build(input: BlueprintBuildInput): ApplicationBlueprint {
    const { specification, architecture, taskGraph, plannedFiles, deploymentTarget } = input;

    const technologies = this.collectTechnologies(architecture);
    const dependencies = this.collectDependencies(architecture);
    const environment = this.buildEnvironment(specification, deploymentTarget);
    const database = architecture.dataModel.map((entity) => ({
      entity: entity.entity,
      table: this.tableName(entity.entity),
      columns: entity.fields.map((f) => f.name),
    }));

    return {
      blueprintId: `bp-${generateId()}`,
      applicationId: specification.applicationId,
      specification,
      architecture,
      taskGraph,
      technologies,
      files: plannedFiles,
      dependencies,
      environment,
      database,
      apis: architecture.apiContract,
      tests: [
        { name: 'core workflows', scope: 'unit', status: 'planned' },
        { name: 'API contract', scope: 'integration', status: 'planned' },
        { name: 'end-to-end journeys', scope: 'e2e', status: 'planned' },
      ],
      deployment: {
        target: deploymentTarget,
        steps: [
          'Generate project workspace',
          'Run validation gates',
          'Prepare deployment artifact',
          'Require explicit authorization before deploy',
        ],
      },
      acceptanceCriteria: specification.acceptanceCriteria,
      createdAt: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  private collectTechnologies(architecture: ApplicationArchitecture): BlueprintTechnology[] {
    const technologies: BlueprintTechnology[] = [];
    for (const layer of architecture.layers) {
      const category = this.categoryFor(layer.layer);
      const existing = technologies.find((t) => t.name === layer.technology);
      if (!existing) {
        technologies.push({ name: layer.technology, category });
      }
    }
    return technologies;
  }

  private collectDependencies(architecture: ApplicationArchitecture): string[] {
    const deps = new Set<string>();
    for (const layer of architecture.layers) {
      if (layer.reusesPlatform) {
        deps.add('@vedmoulya/* platform packages');
      }
    }
    deps.add('typescript');
    deps.add('vitest');
    return Array.from(deps);
  }

  private buildEnvironment(
    specification: ApplicationSpecification,
    deploymentTarget: DeploymentTargetId,
  ): Record<string, string> {
    const env: Record<string, string> = {
      NODE_ENV: 'production',
      APP_ID: specification.applicationId,
      DEPLOYMENT_TARGET: deploymentTarget,
    };
    if (specification.archetype === 'abap-debugger') {
      env.SAP_KNOWLEDGE_COLLECTION = 'sap-abap';
    }
    if (specification.archetype === 'restaurant-app') {
      env.MENU_CACHE_TTL_S = '300';
    }
    return env;
  }

  private categoryFor(
    layer: ApplicationArchitecture['layers'][number]['layer'],
  ): BlueprintTechnology['category'] {
    switch (layer) {
      case 'frontend':
        return 'frontend';
      case 'backend':
        return 'backend';
      case 'database':
        return 'database';
      case 'auth':
        return 'auth';
      case 'ai':
        return 'ai';
      case 'rag':
        return 'rag';
      case 'tools':
        return 'tooling';
      case 'api':
        return 'tooling';
      case 'testing':
        return 'testing';
      case 'deployment':
        return 'deployment';
      default:
        return 'tooling';
    }
  }

  private tableName(entity: string): string {
    const base = entity
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
    // Pluralize simple English nouns for conventional table names.
    if (/(ch|sh|x|s)$/.test(base)) return `${base}es`;
    if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ies`;
    if (!base.endsWith('s')) return `${base}s`;
    return base;
  }
}
