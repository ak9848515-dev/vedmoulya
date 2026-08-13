// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Traceability Indexer
// EPIC-009 — Phase 25. Every major requirement must be traceable:
// Requirement → Design → Architecture → Task → File → Test →
// Validation. The system can answer "Why does this file exist?",
// "Which requirement caused this feature?" and "Which test validates
// this requirement?".
// ──────────────────────────────────────────────────────────────────

import type {
  BuildPlan,
  DesignSpecification,
  ProductArchitecture,
  Requirement,
  RequirementSet,
  TraceabilityIndex,
  TraceabilityLink,
} from '../types/requirement-types.js';

export interface TraceabilityInput {
  sessionId: string;
  requirements: RequirementSet;
  architecture: ProductArchitecture;
  design: DesignSpecification;
  buildPlan: BuildPlan;
}

/** Deterministic mapping: requirement category → design/architecture/task/file/test. */
const CATEGORY_MAP: Record<
  string,
  {
    design: string;
    architecture: string;
    task: string;
    file: string;
    test: string;
    validation: string;
  }
> = {
  functional: {
    design: 'Primary screens',
    architecture: 'API + data model',
    task: 'implementation',
    file: 'src/app/**',
    test: 'src/**/*.test.ts',
    validation: 'unit + integration gates',
  },
  non_functional: {
    design: 'Responsive layout system',
    architecture: 'Platform stack',
    task: 'ui_design',
    file: 'src/styles/**',
    test: 'src/**/*.test.ts',
    validation: 'UI quality gate',
  },
  business_rule: {
    design: 'Workflow states',
    architecture: 'Domain rules',
    task: 'requirements',
    file: 'src/domain/**',
    test: 'src/domain/**/*.test.ts',
    validation: 'business-rule tests',
  },
  user: {
    design: 'Journey screens',
    architecture: 'Auth + roles',
    task: 'ui_design',
    file: 'src/app/**',
    test: 'e2e journeys',
    validation: 'user journey tests',
  },
  data: {
    design: 'Data tables',
    architecture: 'Database schema',
    task: 'data_model',
    file: 'db/schema.sql',
    test: 'db/*.test.ts',
    validation: 'schema validation',
  },
  integration: {
    design: 'Integration settings',
    architecture: 'Adapter seam',
    task: 'implementation',
    file: 'src/integrations/**',
    test: 'src/integrations/**/*.test.ts',
    validation: 'integration tests',
  },
  ai: {
    design: 'AI interaction states',
    architecture: 'AI runtime wiring',
    task: 'ai_engineer',
    file: 'src/ai/**',
    test: 'src/ai/**/*.test.ts',
    validation: 'AI accuracy evaluation',
  },
  ux: {
    design: 'Design system',
    architecture: 'UI layer',
    task: 'ui_design',
    file: 'src/components/**',
    test: 'src/components/**/*.test.tsx',
    validation: 'UI quality gate',
  },
  security: {
    design: 'Auth + permission states',
    architecture: 'Security controls',
    task: 'security_review',
    file: 'src/auth/**',
    test: 'security tests',
    validation: 'security gate (CRITICAL/HIGH block)',
  },
  performance: {
    design: 'Loading states',
    architecture: 'Performance targets',
    task: 'performance_review',
    file: 'src/lib/**',
    test: 'performance benchmarks',
    validation: 'performance review',
  },
  scalability: {
    design: 'Growth plan',
    architecture: 'Stateless tier',
    task: 'architecture',
    file: 'infra/**',
    test: 'scale tests',
    validation: 'architecture validation',
  },
  deployment: {
    design: 'Deploy states',
    architecture: 'Deployment adapter',
    task: 'build',
    file: 'deploy/**',
    test: 'deploy tests',
    validation: 'build + deployment gates',
  },
  compliance: {
    design: 'Privacy controls',
    architecture: 'PII handling',
    task: 'security_review',
    file: 'src/privacy/**',
    test: 'compliance tests',
    validation: 'security + compliance gate',
  },
};

export class TraceabilityIndexer {
  index(input: TraceabilityInput): TraceabilityIndex {
    const links: TraceabilityLink[] = input.requirements.requirements.map((r) =>
      this.linkFor(r, input),
    );
    return { sessionId: input.sessionId, links };
  }

  private linkFor(r: Requirement, input: TraceabilityInput): TraceabilityLink {
    const map = CATEGORY_MAP[r.category] ?? CATEGORY_MAP.functional;
    if (map === undefined) throw new Error('unreachable');
    const architectureLayers = input.architecture.choices
      .filter(
        (c) =>
          c.layer === map.architecture ||
          (r.category === 'security' && c.layer === 'Authorization'),
      )
      .map((c) => c.choice);
    const tasks = input.buildPlan.steps.filter((s) => s.phase === map.task).map((s) => s.id);
    return {
      requirementId: r.id,
      description: r.description,
      design: [map.design, ...input.design.components.slice(0, 2)],
      architecture: architectureLayers.length > 0 ? architectureLayers : [map.architecture],
      tasks: tasks.length > 0 ? tasks : [map.task],
      files: [map.file],
      tests: [map.test],
      validation: [map.validation],
    };
  }
}
